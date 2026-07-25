/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma fields are additive Phase 4 migrations. */
import { db } from "@/lib/db";
import { randomUUID } from "node:crypto";
import { sha256 } from "../core";
import {
  protectedMediaFailure,
  type ProtectedMediaAuthority,
  type ProtectedMediaKind,
  type ProtectedMediaPurpose,
  type ProtectedMediaSubjectKind,
  type ProtectedMediaWithdrawalReason,
} from "./contracts";
import { createProtectedMediaConsentAssertion } from "./consent-assertion";
import { protectedMediaPurposePolicies } from "./purpose-policy";
import { withdrawProtectedDerivative } from "./withdrawal";

const privateDb = db as any;

export async function registerProtectedMedia(input: {
  ownerAccountId: string;
  sourcePrivateAssetObjectId: string;
  mediaKind: ProtectedMediaKind;
  declaredMediaType: string;
  accessibilityDescription?: string;
}) {
  const source = await privateDb.privateAssetObject.findUnique({ where: { id: input.sourcePrivateAssetObjectId } });
  if (!source || source.scanStatus !== "CLEAN" || !source.finalizedAt)
    throw protectedMediaFailure("PROTECTED_MEDIA_SOURCE_NOT_CLEAN");
  if (source.mediaType !== input.declaredMediaType) throw protectedMediaFailure("PROTECTED_MEDIA_TYPE_MISMATCH");
  return privateDb.protectedMedia.upsert({
    where: {
      sourcePrivateAssetObjectId_ownerAccountId: {
        sourcePrivateAssetObjectId: source.id,
        ownerAccountId: input.ownerAccountId,
      },
    },
    create: {
      ownerAccountId: input.ownerAccountId,
      sourcePrivateAssetObjectId: source.id,
      mediaKind: input.mediaKind,
      declaredMediaType: input.declaredMediaType,
      detectedMediaType: source.mediaType,
      byteLength: source.byteLength,
      sha256: source.sha256,
      scanState: source.scanStatus,
      accessibilityDescription: input.accessibilityDescription ?? null,
    },
    update: {},
    select: {
      id: true,
      mediaKind: true,
      detectedMediaType: true,
      byteLength: true,
      sha256: true,
      scanState: true,
      accessibilityDescription: true,
      createdAt: true,
    },
  });
}

export async function listOwnerProtectedMedia(ownerAccountId: string) {
  return privateDb.protectedMedia.findMany({
    where: { ownerAccountId, archivedAt: null },
    select: {
      id: true,
      mediaKind: true,
      detectedMediaType: true,
      byteLength: true,
      sha256: true,
      scanState: true,
      availabilityState: true,
      accessibilityDescription: true,
      withdrawnAt: true,
      createdAt: true,
      _count: { select: { associations: true, derivatives: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function updateProtectedMediaAccessibilityDescription(input: {
  ownerAccountId: string;
  mediaId: string;
  description: string;
}) {
  const description = input.description.trim();
  if (!description || description.length > 1_000) throw protectedMediaFailure("PROTECTED_MEDIA_DESCRIPTION_INVALID");
  const updated = await privateDb.protectedMedia.updateMany({
    where: { id: input.mediaId, ownerAccountId: input.ownerAccountId, withdrawnAt: null },
    data: { accessibilityDescription: description },
  });
  if (!updated.count) throw protectedMediaFailure("PROTECTED_MEDIA_NOT_FOUND");
}

export async function createProtectedMediaAssociation(input: {
  ownerAccountId: string;
  mediaId: string;
  authority: ProtectedMediaAuthority;
  subjectKind: ProtectedMediaSubjectKind;
  subjectOpaqueId: string;
  purpose: ProtectedMediaPurpose;
  role: string;
  ordinal?: number;
  sourceRevision: string;
  subjectOwnerConfirmed: boolean;
}) {
  if (!input.subjectOwnerConfirmed) throw protectedMediaFailure("PROTECTED_MEDIA_SUBJECT_FORBIDDEN");
  const media = await privateDb.protectedMedia.findFirst({
    where: { id: input.mediaId, ownerAccountId: input.ownerAccountId, scanState: "CLEAN", withdrawnAt: null },
  });
  if (!media) throw protectedMediaFailure("PROTECTED_MEDIA_NOT_FOUND");
  return privateDb.protectedMediaAssociation.upsert({
    where: {
      protectedMediaId_authority_subjectKind_subjectOpaqueId_purpose_role_ordinal: {
        protectedMediaId: media.id,
        authority: input.authority,
        subjectKind: input.subjectKind,
        subjectOpaqueId: input.subjectOpaqueId,
        purpose: input.purpose,
        role: input.role,
        ordinal: input.ordinal ?? 0,
      },
    },
    create: {
      protectedMediaId: media.id,
      authority: input.authority,
      subjectKind: input.subjectKind,
      subjectOpaqueId: input.subjectOpaqueId,
      purpose: input.purpose,
      role: input.role,
      ordinal: input.ordinal ?? 0,
      ownerAccountId: input.ownerAccountId,
      sourceRevision: input.sourceRevision,
    },
    update: { removedAt: null, sourceRevision: input.sourceRevision },
    select: { id: true, protectedMediaId: true, purpose: true, subjectOpaqueId: true, sourceRevision: true },
  });
}

export async function withdrawProtectedMediaDerivative(input: {
  ownerAccountId: string;
  derivativeId: string;
  reason: ProtectedMediaWithdrawalReason;
}) {
  return privateDb.$transaction(async (tx: any) => {
    const derivative = await tx.protectedMediaDerivative.findFirst({
      where: { id: input.derivativeId, sourceMedia: { ownerAccountId: input.ownerAccountId } },
      include: { sourceMedia: true },
    });
    if (!derivative) throw protectedMediaFailure("PROTECTED_MEDIA_NOT_FOUND");
    const withdrawal = withdrawProtectedDerivative({ state: derivative.state, reason: input.reason });
    if (!withdrawal.idempotent) {
      await tx.protectedMediaDerivative.update({
        where: { id: derivative.id },
        data: { state: "WITHDRAWN", withdrawnAt: withdrawal.withdrawnAt },
      });
      await tx.protectedMediaGrant.updateMany({
        where: { derivativeId: derivative.id, state: "ACTIVE" },
        data: { state: "REVOKED", revokedAt: withdrawal.withdrawnAt, revocationReasonCode: input.reason },
      });
      await tx.protectedMediaWithdrawal.create({
        data: {
          protectedMediaId: derivative.sourceProtectedMediaId,
          derivativeId: derivative.id,
          reasonCode: input.reason,
          actorAccountId: input.ownerAccountId,
        },
      });
    }
    return { derivativeId: derivative.id, withdrawn: true, idempotent: withdrawal.idempotent };
  });
}

export async function submitProtectedMediaConsentAssertion(input: {
  assertion: Parameters<typeof createProtectedMediaConsentAssertion>[0];
}) {
  const assertion = createProtectedMediaConsentAssertion(input.assertion);
  const media = await privateDb.protectedMedia.findUnique({ where: { id: assertion.sourceProtectedMediaId } });
  if (!media || media.sha256 !== assertion.sourceChecksum)
    throw protectedMediaFailure("PROTECTED_MEDIA_CONSENT_INVALID");
  return privateDb.protectedMediaConsentAssertion
    .upsert({
      where: { assertionDigest: assertion.assertionDigest },
      create: {
        id: assertion.id,
        authority: assertion.authority,
        authorityRecordOpaqueId: assertion.authorityRecordOpaqueId,
        authorityRevision: assertion.authorityRevision,
        subjectOpaqueId: assertion.subjectOpaqueId,
        subjectParticipantOpaqueId: assertion.subjectParticipantOpaqueId ?? null,
        consumingAggregateKind: assertion.consumingAggregateKind,
        consumingAggregateOpaqueId: assertion.consumingAggregateOpaqueId,
        purpose: assertion.purpose,
        scopes: JSON.stringify([...assertion.scopes].sort()),
        state: assertion.state,
        sourceProtectedMediaId: assertion.sourceProtectedMediaId,
        sourceChecksum: assertion.sourceChecksum,
        requestedTransformationPolicy: assertion.requestedTransformationPolicy,
        derivativeId: assertion.derivativeId ?? null,
        derivativeChecksum: assertion.derivativeChecksum ?? null,
        validFrom: assertion.validFrom,
        validUntil: assertion.validUntil ?? null,
        revokedAt: assertion.revokedAt ?? null,
        sourceWatermark: assertion.sourceWatermark,
        assertionDigest: assertion.assertionDigest,
      },
      update: {},
      select: { id: true, assertionDigest: true, state: true },
    })
    .then(async (stored: { id: string; assertionDigest: string; state: string }) => {
      if (assertion.derivativeId && assertion.derivativeChecksum) {
        const derivative = await privateDb.protectedMediaDerivative.findUnique({
          where: { id: assertion.derivativeId },
        });
        if (!derivative || derivative.outputChecksum !== assertion.derivativeChecksum)
          throw protectedMediaFailure("PROTECTED_MEDIA_CONSENT_INVALID");
        await privateDb.privateContentJob.upsert({
          where: { idempotencyKey: `media-grant:${derivative.id}:${stored.id}` },
          create: {
            operationId: derivative.operationId,
            type: "PRIVATE_MEDIA_GRANT_RECONCILE",
            idempotencyKey: `media-grant:${derivative.id}:${stored.id}`,
            correlationId: randomUUID(),
            payload: JSON.stringify({
              schemaVersion: 1,
              aggregateId: derivative.sourceProtectedMediaId,
              correlationId: randomUUID(),
              derivativeId: derivative.id,
              consentAssertionId: stored.id,
            }),
          },
          update: {},
        });
      }
      return stored;
    });
}

export async function requestProtectedMediaDerivative(input: {
  ownerAccountId: string;
  mediaId: string;
  associationId: string;
  purpose: ProtectedMediaPurpose;
  audience: "OWNER" | "CREW" | "AUTHENTICATED" | "UNLISTED" | "PUBLIC";
  idempotencyKey: string;
  consentAssertionId?: string;
}) {
  if (!/^[A-Za-z0-9_.:-]{8,160}$/.test(input.idempotencyKey))
    throw protectedMediaFailure("PROTECTED_MEDIA_IDEMPOTENCY_INVALID");
  const association = await privateDb.protectedMediaAssociation.findFirst({
    where: {
      id: input.associationId,
      protectedMediaId: input.mediaId,
      ownerAccountId: input.ownerAccountId,
      removedAt: null,
    },
    include: { protectedMedia: true },
  });
  if (!association || association.protectedMedia.withdrawnAt || association.protectedMedia.scanState !== "CLEAN")
    throw protectedMediaFailure("PROTECTED_MEDIA_NOT_FOUND");
  const policy = protectedMediaPurposePolicies[input.purpose];
  if (
    !policy ||
    !policy.derivativeRequired ||
    association.purpose !== input.purpose ||
    association.authority !== policy.authority ||
    !policy.audiences.includes(input.audience) ||
    association.protectedMedia.mediaKind !== "IMAGE"
  )
    throw protectedMediaFailure("PROTECTED_MEDIA_PURPOSE_FORBIDDEN");
  if (policy.consentScopes.length && !input.consentAssertionId)
    throw protectedMediaFailure("PROTECTED_MEDIA_CONSENT_REQUIRED");
  const consent = input.consentAssertionId
    ? await privateDb.protectedMediaConsentAssertion.findUnique({ where: { id: input.consentAssertionId } })
    : null;
  if (
    consent &&
    (consent.state !== "GRANTED" ||
      consent.revokedAt ||
      consent.validUntil?.getTime() <= Date.now() ||
      consent.sourceProtectedMediaId !== association.protectedMedia.id ||
      consent.sourceChecksum !== association.protectedMedia.sha256 ||
      consent.purpose !== input.purpose ||
      consent.consumingAggregateOpaqueId !== association.subjectOpaqueId)
  )
    throw protectedMediaFailure("PROTECTED_MEDIA_CONSENT_INVALID");
  const idempotencyKey = `media:${input.idempotencyKey}`;
  const fingerprint = sha256(
    JSON.stringify({
      mediaId: input.mediaId,
      associationId: input.associationId,
      purpose: input.purpose,
      audience: input.audience,
      consentAssertionId: input.consentAssertionId ?? null,
    }),
  );
  const existing = await privateDb.privateContentOperation.findUnique({ where: { idempotencyKey } });
  if (existing) {
    if (JSON.parse(existing.progress).fingerprint !== fingerprint)
      throw protectedMediaFailure("PROTECTED_MEDIA_IDEMPOTENCY_CONFLICT");
    return { operationId: existing.id, state: existing.state, reused: true as const };
  }
  const correlationId = randomUUID();
  const operation = await privateDb.privateContentOperation.create({
    data: {
      ownerAccountId: input.ownerAccountId,
      kind: "PRIVATE_MEDIA_DERIVATIVE",
      state: "QUEUED",
      idempotencyKey,
      correlationId,
      progress: JSON.stringify({ fingerprint, phase: "QUEUED" }),
      jobs: {
        create: {
          type: "PRIVATE_MEDIA_DERIVATIVE_BUILD",
          idempotencyKey: `media-build:${fingerprint}`,
          correlationId,
          payload: JSON.stringify({
            schemaVersion: 1,
            aggregateId: association.protectedMedia.id,
            correlationId,
            mediaId: association.protectedMedia.id,
            associationId: association.id,
            purpose: input.purpose,
            audience: input.audience,
            consentAssertionId: input.consentAssertionId,
            authorizationRevision: association.sourceRevision,
          }),
        },
      },
    },
  });
  return { operationId: operation.id, state: operation.state, reused: false as const };
}
