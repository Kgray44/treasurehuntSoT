import { createHash } from "node:crypto";
import sharp from "sharp";
import { CommunityError } from "./domain";
import type { CommunityBinaryScanReceipt } from "./scanner";

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
