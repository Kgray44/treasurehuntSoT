/* Prisma client generation follows the additive Phase 4 migrations. */
import { db } from "@/lib/db";
import {
  protectedMediaFailure,
  type ProtectedMediaAuthority,
  type ProtectedMediaKind,
  type ProtectedMediaPurpose,
  type ProtectedMediaSubjectKind,
  type ProtectedMediaWithdrawalReason,
} from "./contracts";
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
