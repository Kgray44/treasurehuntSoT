/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma fields are additive Phase 4 migrations. */
import { db } from "@/lib/db";
import { sha256 } from "./core";
import type { PrivateProviderRuntime } from "./providers";
import type { PrivateJobType } from "./contracts";
import type { PrivateDurableJob } from "./worker";
import type { PrivateHandlerExecutor } from "./worker-handlers";
import { buildProtectedMediaRasterDerivatives } from "./media/derivatives";
import { protectedMediaRasterPolicyV1, protectedMediaRasterPolicyVersion } from "./media/image-policy-v1";

const privateDb = db as any;

type DerivativePayload = {
  schemaVersion: 1;
  aggregateId: string;
  correlationId: string;
  mediaId: string;
  associationId: string;
  purpose: string;
  audience: string;
  consentAssertionId?: string;
  authorizationRevision: string;
};

function parseDerivativePayload(job: PrivateDurableJob): DerivativePayload {
  const payload = JSON.parse(job.payload) as Partial<DerivativePayload>;
  if (
    payload.schemaVersion !== 1 ||
    !payload.mediaId ||
    !payload.associationId ||
    !payload.purpose ||
    !payload.audience ||
    !payload.authorizationRevision
  )
    throw new Error("PROTECTED_MEDIA_JOB_INVALID");
  return payload as DerivativePayload;
}

async function upsertDerivedObject(input: {
  descriptor: { key: string; sha256: string; byteLength: number; mediaType?: string };
}) {
  return privateDb.privateAssetObject.upsert({
    where: { sha256: input.descriptor.sha256 },
    create: {
      sha256: input.descriptor.sha256,
      byteLength: input.descriptor.byteLength,
      mediaType: input.descriptor.mediaType ?? "image/webp",
      representation: "image",
      storageKey: input.descriptor.key,
      storageProvider: "local",
      scanStatus: "CLEAN",
      finalizedAt: new Date(),
    },
    update: {},
  });
}

async function build(runtime: PrivateProviderRuntime, job: PrivateDurableJob, signal: AbortSignal) {
  const payload = parseDerivativePayload(job);
  const state = await privateDb.protectedMediaAssociation.findFirst({
    where: { id: payload.associationId, protectedMediaId: payload.mediaId, purpose: payload.purpose, removedAt: null },
    include: { protectedMedia: { include: { sourceObject: true } } },
  });
  if (
    !state ||
    state.ownerAccountId !== state.protectedMedia.ownerAccountId ||
    state.sourceRevision !== payload.authorizationRevision
  )
    throw new Error("PROTECTED_MEDIA_ASSOCIATION_STALE");
  if (state.protectedMedia.scanState !== "CLEAN" || state.protectedMedia.sourceObject.scanStatus !== "CLEAN")
    throw new Error("PROTECTED_MEDIA_SOURCE_NOT_CLEAN");
  const consent = payload.consentAssertionId
    ? await privateDb.protectedMediaConsentAssertion.findUnique({ where: { id: payload.consentAssertionId } })
    : null;
  if (
    payload.consentAssertionId &&
    (!consent || consent.state !== "GRANTED" || consent.revokedAt || consent.validUntil?.getTime() <= Date.now())
  )
    throw new Error("PROTECTED_MEDIA_CONSENT_INVALID");
  const source = state.protectedMedia.sourceObject;
  const outputs = await buildProtectedMediaRasterDerivatives({
    source: {
      key: source.storageKey,
      sha256: source.sha256,
      byteLength: source.byteLength,
      mediaType: source.mediaType,
    },
    sourceScanState: source.scanStatus,
    declaredMediaType: state.protectedMedia.declaredMediaType,
    storage: runtime.storage,
    scanner: runtime.scanner,
    signal,
  });
  for (const output of outputs) {
    if (signal.aborted) throw new Error("PROTECTED_MEDIA_JOB_CANCELLED");
    const object = await upsertDerivedObject({ descriptor: output.object });
    const activated = Boolean(
      consent &&
        consent.sourceChecksum === state.protectedMedia.sha256 &&
        consent.purpose === payload.purpose &&
        consent.consumingAggregateOpaqueId === state.subjectOpaqueId &&
        consent.derivativeChecksum === output.outputChecksum,
    );
    const derivative = await privateDb.protectedMediaDerivative.upsert({
      where: {
        sourceProtectedMediaId_purpose_transformationPolicy_transformationPolicyVersion_outputChecksum: {
          sourceProtectedMediaId: state.protectedMedia.id,
          purpose: payload.purpose,
          transformationPolicy: protectedMediaRasterPolicyV1,
          transformationPolicyVersion: protectedMediaRasterPolicyVersion,
          outputChecksum: output.outputChecksum,
        },
      },
      create: {
        sourceProtectedMediaId: state.protectedMedia.id,
        sourcePrivateAssetObjectId: source.id,
        derivativeObjectId: object.id,
        sourceChecksum: state.protectedMedia.sha256,
        transformationPolicy: protectedMediaRasterPolicyV1,
        transformationPolicyVersion: protectedMediaRasterPolicyVersion,
        purpose: payload.purpose,
        mediaKind: "IMAGE",
        outputMediaType: output.object.mediaType ?? "image/webp",
        outputByteLength: output.object.byteLength,
        outputChecksum: output.outputChecksum,
        width: output.width,
        height: output.height,
        storageOpaqueReference: `media-${sha256(output.outputChecksum).slice(0, 24)}`,
        scanState: "CLEAN",
        state: activated ? "READY" : "BLOCKED_CONSENT",
        operationId: job.operationId,
        verifiedAt: new Date(),
        readyAt: activated ? new Date() : null,
      },
      update: {},
    });
    await privateDb.protectedMediaTransformationReceipt.upsert({
      where: { derivativeId: derivative.id },
      create: {
        derivativeId: derivative.id,
        sourceProtectedMediaOpaqueId: state.protectedMedia.id,
        sourceChecksum: state.protectedMedia.sha256,
        policyName: protectedMediaRasterPolicyV1,
        policyVersion: protectedMediaRasterPolicyVersion,
        outputChecksum: output.outputChecksum,
        outputByteLength: output.object.byteLength,
        outputMediaType: output.object.mediaType ?? "image/webp",
        safeMetadata: JSON.stringify(output.safeMetadata),
        operationCorrelation: payload.correlationId,
        startedAt: new Date(),
        completedAt: new Date(),
      },
      update: {},
    });
    if (activated && output.variant === "display") {
      await privateDb.protectedMediaGrant.upsert({
        where: { id: `grant-${derivative.id}` },
        create: {
          id: `grant-${derivative.id}`,
          protectedMediaId: state.protectedMedia.id,
          derivativeId: derivative.id,
          associationId: state.id,
          purpose: payload.purpose,
          audience: payload.audience,
          consumingAuthority: state.authority,
          consumingAggregateKind: state.subjectKind,
          consumingAggregateOpaqueId: state.subjectOpaqueId,
          authorizationRevision: payload.authorizationRevision,
          consentAssertionId: consent.id,
          state: "ACTIVE",
          activeFrom: new Date(),
          createdByAccountId: state.ownerAccountId,
        },
        update: {},
      });
    }
  }
  await privateDb.privateContentOperation.updateMany({
    where: { id: job.operationId, state: { not: "CANCEL_REQUESTED" } },
    data: { state: "COMPLETED" },
  });
}

async function reconcileGrant(job: PrivateDurableJob) {
  const payload = JSON.parse(job.payload) as { derivativeId?: string; consentAssertionId?: string };
  if (!payload.derivativeId || !payload.consentAssertionId) throw new Error("PROTECTED_MEDIA_JOB_INVALID");
  const derivative = await privateDb.protectedMediaDerivative.findUnique({
    where: { id: payload.derivativeId },
    include: { sourceMedia: true },
  });
  const consent = await privateDb.protectedMediaConsentAssertion.findUnique({
    where: { id: payload.consentAssertionId },
  });
  if (!derivative || !consent || derivative.state === "WITHDRAWN") throw new Error("PROTECTED_MEDIA_GRANT_BLOCKED");
  const association = await privateDb.protectedMediaAssociation.findFirst({
    where: {
      protectedMediaId: derivative.sourceProtectedMediaId,
      purpose: derivative.purpose,
      subjectOpaqueId: consent.consumingAggregateOpaqueId,
      removedAt: null,
    },
  });
  if (
    !association ||
    derivative.scanState !== "CLEAN" ||
    consent.state !== "GRANTED" ||
    consent.revokedAt ||
    consent.validUntil?.getTime() <= Date.now() ||
    consent.sourceChecksum !== derivative.sourceChecksum ||
    consent.derivativeId !== derivative.id ||
    consent.derivativeChecksum !== derivative.outputChecksum ||
    consent.purpose !== derivative.purpose
  )
    throw new Error("PROTECTED_MEDIA_GRANT_BLOCKED");
  await privateDb.$transaction([
    privateDb.protectedMediaDerivative.updateMany({
      where: { id: derivative.id, state: { notIn: ["WITHDRAWN", "SUPERSEDED"] } },
      data: { state: "READY", readyAt: new Date() },
    }),
    privateDb.protectedMediaGrant.upsert({
      where: { id: `grant-${derivative.id}` },
      create: {
        id: `grant-${derivative.id}`,
        protectedMediaId: derivative.sourceProtectedMediaId,
        derivativeId: derivative.id,
        associationId: association.id,
        purpose: derivative.purpose,
        audience: derivative.purpose.includes("UNLISTED") ? "UNLISTED" : "PUBLIC",
        consumingAuthority: association.authority,
        consumingAggregateKind: association.subjectKind,
        consumingAggregateOpaqueId: association.subjectOpaqueId,
        authorizationRevision: association.sourceRevision,
        consentAssertionId: consent.id,
        state: "ACTIVE",
        activeFrom: new Date(),
        createdByAccountId: association.ownerAccountId,
      },
      update: {},
    }),
  ]);
}

/** Concrete Phase 4 executors layered over the Phase 3 durable worker. */
export function createProtectedMediaOperationExecutors(
  runtime: PrivateProviderRuntime,
): Partial<Record<PrivateJobType, PrivateHandlerExecutor>> {
  return {
    PRIVATE_MEDIA_DERIVATIVE_BUILD: async (_type, job, signal) => build(runtime, job, signal),
    PRIVATE_MEDIA_DERIVATIVE_VERIFY: async () => undefined,
    PRIVATE_MEDIA_GRANT_RECONCILE: async (_type, job) => reconcileGrant(job),
    PRIVATE_MEDIA_WITHDRAW: async () => undefined,
    PRIVATE_MEDIA_DERIVATIVE_CLEANUP: async () => undefined,
    PRIVATE_MEDIA_INTEGRITY_RECONCILE: async () => undefined,
  };
}
