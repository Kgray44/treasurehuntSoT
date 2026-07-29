import { createHash } from "node:crypto";
import sharp from "sharp";
import { protectedMediaFailure } from "./contracts";

export const protectedMediaRasterPolicyV1 = "sealed-hold-public-image-v1" as const;
export const protectedMediaRasterPolicyVersion = 1 as const;
const supported = new Map<string, "image/png" | "image/jpeg" | "image/webp">([
  ["png", "image/png"],
  ["jpeg", "image/jpeg"],
  ["webp", "image/webp"],
]);
const maximumBytes = 8 * 1024 * 1024;
const maximumDimension = 8_192;
const maximumPixels = 24_000_000;

export type SanitizedRasterDerivative = Readonly<{
  variant: "display" | "thumbnail";
  sourceChecksum: string;
  derivativeChecksum: string;
  bytes: Buffer;
  mediaType: "image/webp";
  width: number;
  height: number;
  receipt: Readonly<{
    policy: typeof protectedMediaRasterPolicyV1;
    version: typeof protectedMediaRasterPolicyVersion;
    orientationApplied: true;
    exifRemoved: true;
    gpsLatitudeRemoved: true;
    gpsLongitudeRemoved: true;
    gpsAltitudeRemoved: true;
    deviceMetadataRemoved: true;
    embeddedThumbnailRemoved: true;
    processor: "sharp";
  }>;
}>;

const checksum = (value: Buffer) => createHash("sha256").update(value).digest("hex");

export async function buildSanitizedRasterDerivatives(input: { bytes: Buffer; declaredMediaType: string }) {
  if (!input.bytes.length || input.bytes.length > maximumBytes)
    throw protectedMediaFailure("PROTECTED_MEDIA_IMAGE_TOO_LARGE");
  let metadata: sharp.Metadata;
  try {
    metadata = await sharp(input.bytes, { limitInputPixels: maximumPixels, failOn: "warning" }).metadata();
  } catch {
    throw protectedMediaFailure("PROTECTED_MEDIA_IMAGE_UNSAFE");
  }
  const detected = supported.get(metadata.format ?? "");
  if (
    !detected ||
    detected !== input.declaredMediaType ||
    !metadata.width ||
    !metadata.height ||
    metadata.width > maximumDimension ||
    metadata.height > maximumDimension ||
    metadata.width * metadata.height > maximumPixels
  )
    throw protectedMediaFailure("PROTECTED_MEDIA_IMAGE_INVALID");
  const sourceChecksum = checksum(input.bytes);
  const build = async (
    variant: "display" | "thumbnail",
    limit: number,
    quality: number,
  ): Promise<SanitizedRasterDerivative> => {
    let encoded: { data: Buffer; info: sharp.OutputInfo };
    try {
      // Metadata is never reattached. rotate() materializes EXIF orientation before WebP encoding.
      encoded = await sharp(input.bytes, { limitInputPixels: maximumPixels, failOn: "warning" })
        .rotate()
        .resize({ width: limit, height: limit, fit: "inside", withoutEnlargement: true })
        .webp({ quality, effort: 4 })
        .toBuffer({ resolveWithObject: true });
    } catch {
      throw protectedMediaFailure("PROTECTED_MEDIA_IMAGE_UNSAFE");
    }
    if (!encoded.info.width || !encoded.info.height) throw protectedMediaFailure("PROTECTED_MEDIA_IMAGE_INVALID");
    return Object.freeze({
      variant,
      sourceChecksum,
      derivativeChecksum: checksum(encoded.data),
      bytes: encoded.data,
      mediaType: "image/webp",
      width: encoded.info.width,
      height: encoded.info.height,
      receipt: Object.freeze({
        policy: protectedMediaRasterPolicyV1,
        version: protectedMediaRasterPolicyVersion,
        orientationApplied: true,
        exifRemoved: true,
        gpsLatitudeRemoved: true,
        gpsLongitudeRemoved: true,
        gpsAltitudeRemoved: true,
        deviceMetadataRemoved: true,
        embeddedThumbnailRemoved: true,
        processor: "sharp",
      }),
    });
  };
  return Object.freeze({ display: await build("display", 2_048, 82), thumbnail: await build("thumbnail", 512, 78) });
}
