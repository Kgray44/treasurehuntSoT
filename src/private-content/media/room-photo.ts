import { createHash, randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import type { PrismaClient } from "@prisma/client";
import { db } from "@/lib/db";
import type { PrivateObjectDescriptor } from "../contracts";
import type { PrivateProviderRuntime } from "../providers";
import { buildSanitizedRasterDerivatives, protectedMediaRasterPolicyV1 } from "./image-policy-v1";
import { protectedMediaFailure } from "./contracts";
import { createProtectedMediaConsentAssertion, validateProtectedMediaConsentAssertion } from "./consent-assertion";
import { authorizeProtectedMediaDelivery } from "./delivery";

export const roomPhotoPurpose = "SPATIAL_ROOM_RECONSTRUCTION" as const;
export const roomPhotoConsentRevision = "creator-room-photo-openai-v1";
const checksum = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
function fail(code: string): never {
  throw protectedMediaFailure(code);
}
const maximumBytes = 8 * 1024 * 1024;

/** Existing Sealed Hold storage, scanner, object, media, derivative, receipt and grant authorities.
 * This port accepts explicit Creator consent only; it never grants another purpose or a public audience.
 */
export async function importProtectedRoomPhoto(input: {
  ownerAccountId: string;
  definitionId: string;
  bytes: Buffer;
  declaredMediaType: string;
  consent: boolean;
  runtime: PrivateProviderRuntime;
  signal?: AbortSignal;
  store?: PrismaClient;
}) {
  if (!input.consent) fail("PROTECTED_MEDIA_CONSENT_REQUIRED");
  if (!input.bytes.length || input.bytes.length > maximumBytes) fail("PROTECTED_MEDIA_IMAGE_TOO_LARGE");
  if (input.signal?.aborted) fail("PROTECTED_MEDIA_OPERATION_CANCELLED");
  const store = input.store ?? db;
  const owned = await store.reusableAuthoringItem.findFirst({
    where: {
      id: input.definitionId,
      ownerAccountId: input.ownerAccountId,
      kind: "PARALLAX_STUDIO",
      archivedAt: null,
    },
  });
  if (!owned) fail("PROTECTED_MEDIA_SUBJECT_FORBIDDEN");
  if (!input.runtime.configuration.PRIVATE_CONTENT_ENABLED) fail("PROTECTED_MEDIA_IMPORT_UNAVAILABLE");
  const health = await Promise.all([input.runtime.storage.health(), input.runtime.scanner.health()]);
  if (health.some((probe) => !probe.configured || !probe.healthy)) fail("PROTECTED_MEDIA_IMPORT_UNAVAILABLE");
  const generated = await buildSanitizedRasterDerivatives({
    bytes: input.bytes,
    declaredMediaType: input.declaredMediaType,
  });
  const staged: PrivateObjectDescriptor[] = [];
  const correlation = randomUUID(),
    now = new Date();
  const until = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  try {
    const scanAndStore = async (bytes: Buffer, mediaType: string, namespace: "objects" | "derivatives") => {
      const object = await input.runtime.storage.put(
        namespace,
        `room-photo/${correlation}/${checksum(bytes)}`,
        Readable.from([bytes]),
        { contentLength: bytes.length, expectedSha256: checksum(bytes), signal: input.signal },
      );
      staged.push(object);
      const scan = await input.runtime.scanner.scan({ object, mediaType, signal: input.signal });
      if (scan.state !== "CLEAN") fail("PROTECTED_MEDIA_SOURCE_NOT_CLEAN");
      return { object, mediaType, scan };
    };
    const source = await scanAndStore(input.bytes, input.declaredMediaType, "objects");
    const display = await scanAndStore(generated.display.bytes, "image/webp", "derivatives");
    if (input.signal?.aborted) fail("PROTECTED_MEDIA_OPERATION_CANCELLED");
    const result = await store.$transaction(async (tx) => {
      const owned = await tx.reusableAuthoringItem.findFirst({
        where: {
          id: input.definitionId,
          ownerAccountId: input.ownerAccountId,
          kind: "PARALLAX_STUDIO",
          archivedAt: null,
        },
      });
      if (!owned) fail("PROTECTED_MEDIA_SUBJECT_FORBIDDEN");
      const recordObject = async (stored: typeof source) => {
        const object = await tx.privateAssetObject.upsert({
          where: { sha256: stored.object.sha256 },
          create: {
            sha256: stored.object.sha256,
            byteLength: stored.object.byteLength,
            mediaType: stored.mediaType,
            representation: "image",
            storageKey: stored.object.key,
            storageProvider: input.runtime.storage.name,
            scanStatus: "CLEAN",
            finalizedAt: now,
          },
          update: {},
        });
        if (object.scanStatus !== "CLEAN" || !object.finalizedAt || object.mediaType !== stored.mediaType)
          fail("PROTECTED_MEDIA_SOURCE_NOT_CLEAN");
        await tx.privateContentScan.create({
          data: {
            objectId: object.id,
            provider: stored.scan.provider,
            state: stored.scan.state,
            safeCode: stored.scan.safeCode,
            scannedAt: now,
          },
        });
        return object;
      };
      const original = await recordObject(source),
        sanitized = await recordObject(display);
      const media = await tx.protectedMedia.upsert({
        where: {
          sourcePrivateAssetObjectId_ownerAccountId: {
            sourcePrivateAssetObjectId: original.id,
            ownerAccountId: input.ownerAccountId,
          },
        },
        create: {
          ownerAccountId: input.ownerAccountId,
          sourcePrivateAssetObjectId: original.id,
          mediaKind: "IMAGE",
          declaredMediaType: input.declaredMediaType,
          detectedMediaType: input.declaredMediaType,
          byteLength: original.byteLength,
          sha256: original.sha256,
          scanState: "CLEAN",
          accessibilityDescription: "Creator room photograph for approximate room authoring",
        },
        update: {},
      });
      if (media.withdrawnAt || media.archivedAt || media.scanState !== "CLEAN") fail("PROTECTED_MEDIA_NOT_FOUND");
      const association = await tx.protectedMediaAssociation.upsert({
        where: {
          protectedMediaId_authority_subjectKind_subjectOpaqueId_purpose_role_ordinal: {
            protectedMediaId: media.id,
            authority: "SEALED_HOLD",
            subjectKind: "SPATIAL_ROOM_DRAFT",
            subjectOpaqueId: input.definitionId,
            purpose: roomPhotoPurpose,
            role: "ROOM_REFERENCE",
            ordinal: 0,
          },
        },
        create: {
          protectedMediaId: media.id,
          authority: "SEALED_HOLD",
          subjectKind: "SPATIAL_ROOM_DRAFT",
          subjectOpaqueId: input.definitionId,
          purpose: roomPhotoPurpose,
          role: "ROOM_REFERENCE",
          ownerAccountId: input.ownerAccountId,
          sourceRevision: roomPhotoConsentRevision,
        },
        update: { removedAt: null, sourceRevision: roomPhotoConsentRevision },
      });
      const operation = await tx.privateContentOperation.create({
        data: {
          ownerAccountId: input.ownerAccountId,
          kind: "PRIVATE_MEDIA_DERIVATIVE",
          state: "COMPLETED",
          idempotencyKey: `room-photo:${correlation}`,
          correlationId: correlation,
          progress: JSON.stringify({ phase: "COMPLETE", purpose: roomPhotoPurpose }),
        },
      });
      const derivative = await tx.protectedMediaDerivative.upsert({
        where: {
          sourceProtectedMediaId_purpose_transformationPolicy_transformationPolicyVersion_outputChecksum: {
            sourceProtectedMediaId: media.id,
            purpose: roomPhotoPurpose,
            transformationPolicy: protectedMediaRasterPolicyV1,
            transformationPolicyVersion: 1,
            outputChecksum: display.object.sha256,
          },
        },
        create: {
          sourceProtectedMediaId: media.id,
          sourcePrivateAssetObjectId: original.id,
          derivativeObjectId: sanitized.id,
          sourceChecksum: original.sha256,
          transformationPolicy: protectedMediaRasterPolicyV1,
          transformationPolicyVersion: 1,
          purpose: roomPhotoPurpose,
          mediaKind: "IMAGE",
          outputMediaType: "image/webp",
          outputByteLength: sanitized.byteLength,
          outputChecksum: sanitized.sha256,
          width: generated.display.width,
          height: generated.display.height,
          storageOpaqueReference: randomUUID(),
          scanState: "CLEAN",
          state: "READY",
          operationId: operation.id,
          verifiedAt: now,
          readyAt: now,
        },
        update: {},
      });
      if (derivative.withdrawnAt || derivative.state !== "READY") fail("PROTECTED_MEDIA_NOT_FOUND");
      const assertion = createProtectedMediaConsentAssertion({
        id: randomUUID(),
        authority: "SEALED_HOLD",
        authorityRecordOpaqueId: association.id,
        authorityRevision: roomPhotoConsentRevision,
        subjectOpaqueId: input.ownerAccountId,
        consumingAggregateKind: "SPATIAL_ROOM_DRAFT",
        consumingAggregateOpaqueId: input.definitionId,
        purpose: roomPhotoPurpose,
        scopes: ["PHOTO", "EXTERNAL_AI_ROOM"],
        state: "GRANTED",
        sourceProtectedMediaId: media.id,
        sourceChecksum: media.sha256,
        requestedTransformationPolicy: protectedMediaRasterPolicyV1,
        derivativeId: derivative.id,
        derivativeChecksum: derivative.outputChecksum,
        validFrom: now,
        validUntil: until,
        sourceWatermark: roomPhotoConsentRevision,
      });
      await tx.protectedMediaConsentAssertion.create({
        data: { ...assertion, scopes: JSON.stringify(assertion.scopes) },
      });
      await tx.protectedMediaGrant.create({
        data: {
          protectedMediaId: media.id,
          derivativeId: derivative.id,
          associationId: association.id,
          purpose: roomPhotoPurpose,
          audience: "OWNER",
          consumingAuthority: "SEALED_HOLD",
          consumingAggregateKind: "SPATIAL_ROOM_DRAFT",
          consumingAggregateOpaqueId: input.definitionId,
          authorizationRevision: roomPhotoConsentRevision,
          consentAssertionId: assertion.id,
          state: "ACTIVE",
          activeFrom: now,
          expiresAt: until,
          createdByAccountId: input.ownerAccountId,
        },
      });
      await tx.protectedMediaTransformationReceipt.upsert({
        where: { derivativeId: derivative.id },
        create: {
          derivativeId: derivative.id,
          sourceProtectedMediaOpaqueId: media.id,
          sourceChecksum: media.sha256,
          policyName: protectedMediaRasterPolicyV1,
          policyVersion: 1,
          outputChecksum: derivative.outputChecksum,
          outputByteLength: derivative.outputByteLength,
          outputMediaType: "image/webp",
          safeMetadata: JSON.stringify(generated.display.receipt),
          operationCorrelation: correlation,
          startedAt: now,
          completedAt: new Date(),
        },
        update: {},
      });
      return {
        mediaId: media.id,
        width: generated.display.width,
        height: generated.display.height,
        permissionExpiresAt: until.toISOString(),
      };
    });
    return result;
  } catch (error) {
    // Uncommitted bytes receive no grants. Existing storage owns quarantine/retention.
    await Promise.allSettled(
      staged.map((object) => input.runtime.storage.moveToQuarantine(object, "ROOM_PHOTO_IMPORT_FAILED")),
    );
    throw error;
  }
}

/** Revalidate exact owner, subject, purpose, consent, scans and metadata receipt before any provider dispatch. */
export async function readProtectedRoomPhoto(input: {
  ownerAccountId: string;
  definitionId: string;
  mediaId: string;
  runtime: PrivateProviderRuntime;
  signal?: AbortSignal;
  store?: PrismaClient;
}) {
  const now = new Date();
  const grant = await (input.store ?? db).protectedMediaGrant.findFirst({
    where: {
      protectedMediaId: input.mediaId,
      purpose: roomPhotoPurpose,
      audience: "OWNER",
      consumingAuthority: "SEALED_HOLD",
      consumingAggregateKind: "SPATIAL_ROOM_DRAFT",
      consumingAggregateOpaqueId: input.definitionId,
      state: "ACTIVE",
      revokedAt: null,
      activeFrom: { lte: now },
      expiresAt: { gt: now },
      association: { ownerAccountId: input.ownerAccountId, removedAt: null },
      sourceMedia: {
        ownerAccountId: input.ownerAccountId,
        withdrawnAt: null,
        archivedAt: null,
        scanState: "CLEAN",
        availabilityState: "AVAILABLE",
      },
    },
    include: {
      sourceMedia: { include: { sourceObject: true } },
      association: true,
      consentAssertion: true,
      derivative: { include: { derivativeObject: true, receipt: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!grant?.derivative || !grant.consentAssertion) fail("PROTECTED_MEDIA_DELIVERY_FORBIDDEN");
  const derivative = grant.derivative,
    assertion = grant.consentAssertion;
  if (
    assertion.authority !== "SEALED_HOLD" ||
    assertion.state !== "GRANTED" ||
    assertion.purpose !== roomPhotoPurpose ||
    assertion.consumingAggregateKind !== "SPATIAL_ROOM_DRAFT" ||
    assertion.subjectOpaqueId !== input.ownerAccountId ||
    derivative.sourceChecksum !== grant.sourceMedia.sha256 ||
    !derivative.width ||
    !derivative.height ||
    derivative.width > 2048 ||
    derivative.height > 2048
  )
    fail("PROTECTED_MEDIA_CONSENT_INVALID");
  if (
    grant.sourceMedia.sourceObject.scanStatus !== "CLEAN" ||
    derivative.derivativeObject.scanStatus !== "CLEAN" ||
    !grant.sourceMedia.sourceObject.finalizedAt ||
    !derivative.derivativeObject.finalizedAt ||
    !derivative.receipt ||
    derivative.receipt.sourceChecksum !== grant.sourceMedia.sha256 ||
    derivative.receipt.outputChecksum !== derivative.outputChecksum ||
    derivative.transformationPolicy !== protectedMediaRasterPolicyV1 ||
    derivative.outputMediaType !== "image/webp" ||
    derivative.state !== "READY"
  )
    fail("PROTECTED_MEDIA_DELIVERY_FORBIDDEN");
  authorizeProtectedMediaDelivery({
    derivative: { ...derivative, state: "READY", withdrawnAt: derivative.withdrawnAt ?? undefined },
    grant: {
      ...grant,
      purpose: roomPhotoPurpose,
      audience: "OWNER",
      state: "ACTIVE",
      expiresAt: grant.expiresAt ?? undefined,
      revokedAt: grant.revokedAt ?? undefined,
    },
    currentAuthorizationRevision: roomPhotoConsentRevision,
  });
  validateProtectedMediaConsentAssertion({
    assertion: {
      ...assertion,
      authority: "SEALED_HOLD",
      consumingAggregateKind: "SPATIAL_ROOM_DRAFT",
      purpose: roomPhotoPurpose,
      state: "GRANTED",
      scopes: JSON.parse(assertion.scopes),
      subjectParticipantOpaqueId: assertion.subjectParticipantOpaqueId ?? undefined,
      derivativeId: assertion.derivativeId ?? undefined,
      derivativeChecksum: assertion.derivativeChecksum ?? undefined,
      validUntil: assertion.validUntil ?? undefined,
      revokedAt: assertion.revokedAt ?? undefined,
    },
    authority: "SEALED_HOLD",
    purpose: roomPhotoPurpose,
    sourceMediaId: input.mediaId,
    sourceChecksum: grant.sourceMedia.sha256,
    aggregateKind: "SPATIAL_ROOM_DRAFT",
    aggregateId: input.definitionId,
    requiredScopes: ["PHOTO", "EXTERNAL_AI_ROOM"],
    derivativeId: derivative.id,
    derivativeChecksum: derivative.outputChecksum,
  });
  const receipt = JSON.parse(derivative.receipt.safeMetadata) as Record<string, unknown>;
  if (
    [
      "exifRemoved",
      "deviceMetadataRemoved",
      "gpsLatitudeRemoved",
      "gpsLongitudeRemoved",
      "gpsAltitudeRemoved",
      "orientationApplied",
      "embeddedThumbnailRemoved",
    ].some((key) => receipt[key] !== true)
  )
    fail("PROTECTED_MEDIA_DELIVERY_FORBIDDEN");
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of await input.runtime.storage.read({
    key: derivative.derivativeObject.storageKey,
    sha256: derivative.outputChecksum,
    byteLength: derivative.outputByteLength,
  })) {
    if (input.signal?.aborted) fail("PROTECTED_MEDIA_OPERATION_CANCELLED");
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    length += bytes.length;
    if (length > maximumBytes) fail("PROTECTED_MEDIA_IMAGE_TOO_LARGE");
    chunks.push(bytes);
  }
  const bytes = Buffer.concat(chunks, length);
  if (length !== derivative.outputByteLength || checksum(bytes) !== derivative.outputChecksum)
    fail("PROTECTED_MEDIA_SOURCE_CORRUPT");
  return {
    mediaId: input.mediaId,
    bytes,
    mediaType: "image/webp" as const,
    width: derivative.width!,
    height: derivative.height!,
  };
}

export async function withdrawRoomPhotoPermission(input: {
  ownerAccountId: string;
  definitionId: string;
  mediaId: string;
  store?: PrismaClient;
}) {
  return (input.store ?? db).$transaction(async (tx) => {
    const grants = await tx.protectedMediaGrant.findMany({
      where: {
        protectedMediaId: input.mediaId,
        purpose: roomPhotoPurpose,
        consumingAggregateOpaqueId: input.definitionId,
        association: { ownerAccountId: input.ownerAccountId },
        sourceMedia: { ownerAccountId: input.ownerAccountId },
      },
    });
    if (!grants.length) fail("PROTECTED_MEDIA_NOT_FOUND");
    const now = new Date();
    await tx.protectedMediaGrant.updateMany({
      where: { id: { in: grants.map((grant) => grant.id) } },
      data: { state: "REVOKED", revokedAt: now, revocationReasonCode: "OWNER_WITHDRAWN" },
    });
    await tx.protectedMediaConsentAssertion.updateMany({
      where: { id: { in: grants.flatMap((grant) => (grant.consentAssertionId ? [grant.consentAssertionId] : [])) } },
      data: { state: "REVOKED", revokedAt: now },
    });
    return { withdrawn: true };
  });
}

/** Owner-visible authorization metadata only; images and storage identities stay server-side. */
export async function listRoomPhotoPermissions(ownerAccountId: string, definitionId: string, store = db) {
  const owned = await store.reusableAuthoringItem.findFirst({
    where: { id: definitionId, ownerAccountId, kind: "PARALLAX_STUDIO", archivedAt: null },
    select: { id: true },
  });
  if (!owned) fail("PROTECTED_MEDIA_SUBJECT_FORBIDDEN");
  const now = new Date();
  const grants = await store.protectedMediaGrant.findMany({
    where: {
      purpose: roomPhotoPurpose,
      consumingAggregateOpaqueId: definitionId,
      audience: "OWNER",
      state: "ACTIVE",
      revokedAt: null,
      expiresAt: { gt: now },
      association: { ownerAccountId, removedAt: null },
      sourceMedia: { ownerAccountId, withdrawnAt: null },
    },
    select: { protectedMediaId: true, expiresAt: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return [
    ...new Map(
      grants.map((grant) => [
        grant.protectedMediaId,
        {
          mediaId: grant.protectedMediaId,
          permissionExpiresAt: grant.expiresAt!.toISOString(),
        },
      ]),
    ).values(),
  ];
}
