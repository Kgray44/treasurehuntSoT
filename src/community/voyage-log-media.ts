import { createHash } from "node:crypto";
import sharp from "sharp";
import { CommunityError } from "./domain";
import type { CommunityBinaryScanReceipt } from "./scanner";
import { db } from "@/lib/db";

const supportedRasterFormats = new Map([
  ["png", "image/png"],
  ["jpeg", "image/jpeg"],
  ["webp", "image/webp"],
]);
const maximumBytes = 8 * 1024 * 1024;
const maximumDimension = 8_192;
const maximumPixels = 24_000_000;

export type SafePublicImageDerivative = Readonly<{
  detectedMediaType: "image/png" | "image/jpeg" | "image/webp";
  sourceChecksum: string;
  derivativeChecksum: string;
  byteLength: number;
  width: number;
  height: number;
  orientationApplied: true;
  exifRemoved: true;
  gpsLatitudeRemoved: true;
  gpsLongitudeRemoved: true;
  gpsAltitudeRemoved: true;
  deviceMetadataRemoved: true;
  embeddedThumbnailRemoved: true;
  bytes: Uint8Array;
}>;

function checksum(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * Decodes a bounded raster image and re-encodes a separate WebP derivative.
 * Sharp does not preserve metadata unless explicitly asked, so EXIF, GPS,
 * device metadata, and embedded thumbnails cannot transit to the derivative.
 */
export async function createSafePublicImageDerivative(input: {
  bytes: Uint8Array;
  declaredMediaType: string;
}): Promise<SafePublicImageDerivative> {
  if (!input.bytes.byteLength || input.bytes.byteLength > maximumBytes)
    throw new CommunityError("COMMUNITY_MEDIA_TOO_LARGE", "Public media exceeds the permitted byte limit.");
  const source = Buffer.from(input.bytes);
  let metadata: sharp.Metadata;
  try {
    metadata = await sharp(source, { limitInputPixels: maximumPixels, failOn: "warning" }).metadata();
  } catch {
    throw new CommunityError("COMMUNITY_MEDIA_UNSAFE", "Public media could not be safely decoded.");
  }
  const detected = supportedRasterFormats.get(metadata.format ?? "");
  if (!detected || detected !== input.declaredMediaType)
    throw new CommunityError(
      "COMMUNITY_MEDIA_TYPE_MISMATCH",
      "The public-media type does not match its decoded bytes.",
    );
  if (
    !metadata.width ||
    !metadata.height ||
    metadata.width > maximumDimension ||
    metadata.height > maximumDimension ||
    metadata.width * metadata.height > maximumPixels
  )
    throw new CommunityError(
      "COMMUNITY_MEDIA_DIMENSIONS_INVALID",
      "Public media dimensions exceed the permitted limit.",
    );

  let encoded: { data: Buffer; info: sharp.OutputInfo };
  try {
    encoded = await sharp(source, { limitInputPixels: maximumPixels, failOn: "warning" })
      .rotate()
      .resize({ width: 2_048, height: 2_048, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82, effort: 4 })
      .toBuffer({ resolveWithObject: true });
  } catch {
    throw new CommunityError("COMMUNITY_MEDIA_UNSAFE", "Public media could not be safely sanitized.");
  }
  if (!encoded.info.width || !encoded.info.height)
    throw new CommunityError("COMMUNITY_MEDIA_UNSAFE", "Public media has no safe rendered dimensions.");
  return Object.freeze({
    detectedMediaType: detected as SafePublicImageDerivative["detectedMediaType"],
    sourceChecksum: checksum(source),
    derivativeChecksum: checksum(encoded.data),
    byteLength: encoded.data.byteLength,
    width: encoded.info.width,
    height: encoded.info.height,
    orientationApplied: true,
    exifRemoved: true,
    gpsLatitudeRemoved: true,
    gpsLongitudeRemoved: true,
    gpsAltitudeRemoved: true,
    deviceMetadataRemoved: true,
    embeddedThumbnailRemoved: true,
    bytes: new Uint8Array(encoded.data),
  });
}

/** Exact binding prevents consent replay against a different original or derivative. */
export function assertExactMediaPublicationConsent(input: {
  approvedVoyageLogId: string;
  approvedOpaqueMediaId: string;
  approvedSourceChecksum: string;
  approvedDerivativeChecksum: string;
  voyageLogId: string;
  opaqueMediaId: string;
  sourceChecksum: string;
  derivativeChecksum: string;
  receipt: Pick<CommunityBinaryScanReceipt, "result" | "sha256">;
}) {
  if (
    input.approvedVoyageLogId !== input.voyageLogId ||
    input.approvedOpaqueMediaId !== input.opaqueMediaId ||
    input.approvedSourceChecksum !== input.sourceChecksum ||
    input.approvedDerivativeChecksum !== input.derivativeChecksum
  )
    throw new CommunityError(
      "COMMUNITY_MEDIA_CONSENT_MISMATCH",
      "Media consent does not match this Voyage Log derivative.",
    );
  if (input.receipt.result !== "CLEAN" || input.receipt.sha256 !== input.derivativeChecksum)
    throw new CommunityError(
      "COMMUNITY_MEDIA_NOT_READY",
      "Public media requires a clean scanner receipt for this exact derivative.",
    );
}

/** Sealed Hold owns the protected original and durable public derivative storage. */
export interface SealedHoldPublicDerivativePort {
  writePublicDerivative(input: {
    voyageLogId: string;
    sourceOpaqueId: string;
    derivativeChecksum: string;
    mediaType: string;
    bytes: Uint8Array;
  }): Promise<{ opaqueDerivativeReference: string }>;
}

export async function selectVoyageLogPublicMedia(input: {
  ownerAccountId: string;
  voyageLogId: string;
  sourceOpaqueId: string;
  subjectParticipantId?: string;
  declaredMediaType: string;
  sourceBytes: Uint8Array;
  scannerReceipt: Pick<CommunityBinaryScanReceipt, "result" | "sha256">;
  derivatives: SealedHoldPublicDerivativePort;
}) {
  const log = await db.communityVoyageLog.findUnique({
    where: { id: input.voyageLogId },
    select: { ownerAccountId: true },
  });
  if (!log || log.ownerAccountId !== input.ownerAccountId)
    throw new CommunityError("COMMUNITY_VOYAGE_LOG_NOT_FOUND", "Voyage Log not found.");
  const derivative = await createSafePublicImageDerivative({
    bytes: input.sourceBytes,
    declaredMediaType: input.declaredMediaType,
  });
  if (input.scannerReceipt.result !== "CLEAN" || input.scannerReceipt.sha256 !== derivative.sourceChecksum)
    throw new CommunityError(
      "COMMUNITY_MEDIA_NOT_READY",
      "Selected media is not clean for this exact source checksum.",
    );
  const stored = await input.derivatives.writePublicDerivative({
    voyageLogId: input.voyageLogId,
    sourceOpaqueId: input.sourceOpaqueId,
    derivativeChecksum: derivative.derivativeChecksum,
    mediaType: "image/webp",
    bytes: derivative.bytes,
  });
  const existing = await db.communityVoyageLogMedia.findUnique({
    where: {
      voyageLogId_privateMediaReference: {
        voyageLogId: input.voyageLogId,
        privateMediaReference: input.sourceOpaqueId,
      },
    },
    select: { id: true, sourceChecksum: true, derivativeChecksum: true },
  });
  const changed =
    !!existing &&
    (existing.sourceChecksum !== derivative.sourceChecksum ||
      existing.derivativeChecksum !== derivative.derivativeChecksum);
  const media = await db.$transaction(async (tx) => {
    const record = await tx.communityVoyageLogMedia.upsert({
      where: {
        voyageLogId_privateMediaReference: {
          voyageLogId: input.voyageLogId,
          privateMediaReference: input.sourceOpaqueId,
        },
      },
      update: {
        sourceChecksum: derivative.sourceChecksum,
        subjectParticipantId: input.subjectParticipantId ?? null,
        detectedMediaType: derivative.detectedMediaType,
        derivativeChecksum: derivative.derivativeChecksum,
        derivativeStorageReference: stored.opaqueDerivativeReference,
        processingStatus: "READY",
        scanStatus: "CLEAN",
        exifGpsRemoved: true,
      },
      create: {
        voyageLogId: input.voyageLogId,
        privateMediaReference: input.sourceOpaqueId,
        sourceChecksum: derivative.sourceChecksum,
        subjectParticipantId: input.subjectParticipantId ?? null,
        detectedMediaType: derivative.detectedMediaType,
        derivativeChecksum: derivative.derivativeChecksum,
        derivativeStorageReference: stored.opaqueDerivativeReference,
        processingStatus: "READY",
        scanStatus: "CLEAN",
        exifGpsRemoved: true,
      },
    });
    if (changed) {
      await tx.communityVoyageLogMediaConsent.deleteMany({ where: { voyageLogMediaId: record.id } });
      await tx.communityVoyageLog.update({
        where: { id: input.voyageLogId },
        data: {
          lifecycleState: "CONSENT_REVIEW_REQUIRED",
          consentRevision: { increment: 1 },
          publishedAt: null,
          searchIndexedAt: null,
          openGraphInvalidatedAt: new Date(),
        },
      });
    }
    return record;
  });
  return {
    id: media.id,
    sourceOpaqueId: input.sourceOpaqueId,
    sourceChecksum: derivative.sourceChecksum,
    derivativeChecksum: derivative.derivativeChecksum,
    detectedMediaType: derivative.detectedMediaType,
    changed,
  };
}

export async function removeVoyageLogPublicMedia(input: {
  ownerAccountId: string;
  voyageLogId: string;
  mediaId: string;
}) {
  const media = await db.communityVoyageLogMedia.findFirst({
    where: { id: input.mediaId, voyageLogId: input.voyageLogId },
    select: { id: true, voyageLogId: true },
  });
  const log = await db.communityVoyageLog.findUnique({
    where: { id: input.voyageLogId },
    select: { ownerAccountId: true },
  });
  if (!media || !log || log.ownerAccountId !== input.ownerAccountId)
    throw new CommunityError("COMMUNITY_VOYAGE_LOG_NOT_FOUND", "Voyage Log media not found.");
  await db.$transaction(async (tx) => {
    await tx.communityVoyageLogMediaConsent.deleteMany({ where: { voyageLogMediaId: media.id } });
    await tx.communityVoyageLogMedia.delete({ where: { id: media.id } });
    await tx.communityVoyageLog.update({
      where: { id: media.voyageLogId },
      data: {
        lifecycleState: "CONSENT_REVIEW_REQUIRED",
        consentRevision: { increment: 1 },
        publishedAt: null,
        searchIndexedAt: null,
        openGraphInvalidatedAt: new Date(),
      },
    });
  });
}

/** Owner-only projection; protected storage references never leave the server. */
export async function readOwnerVoyageLogPublicMedia(input: { ownerAccountId: string; voyageLogId: string }) {
  const log = await db.communityVoyageLog.findUnique({
    where: { id: input.voyageLogId },
    select: { ownerAccountId: true },
  });
  if (!log || log.ownerAccountId !== input.ownerAccountId)
    throw new CommunityError("COMMUNITY_VOYAGE_LOG_NOT_FOUND", "Voyage Log not found.");
  const media = await db.communityVoyageLogMedia.findMany({
    where: { voyageLogId: input.voyageLogId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      privateMediaReference: true,
      subjectParticipantId: true,
      detectedMediaType: true,
      sourceChecksum: true,
      derivativeChecksum: true,
      processingStatus: true,
      scanStatus: true,
      exifGpsRemoved: true,
    },
  });
  return media.map((item) => ({
    id: item.id,
    sourceOpaqueId: item.privateMediaReference,
    subjectParticipantId: item.subjectParticipantId,
    detectedMediaType: item.detectedMediaType,
    sourceChecksum: item.sourceChecksum,
    derivativeChecksum: item.derivativeChecksum,
    processingStatus: item.processingStatus,
    scanStatus: item.scanStatus,
    exifGpsRemoved: item.exifGpsRemoved,
  }));
}
