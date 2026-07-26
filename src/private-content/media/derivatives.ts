import { Readable } from "node:stream";
import type { PrivateObjectDescriptor, PrivateScannerProvider, PrivateStorageProvider } from "../contracts";
import { protectedMediaFailure } from "./contracts";
import { buildSanitizedRasterDerivatives, protectedMediaRasterPolicyV1 } from "./image-policy-v1";

async function boundedBuffer(stream: Readable, maximum: number, signal?: AbortSignal) {
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of stream) {
    if (signal?.aborted) throw protectedMediaFailure("PROTECTED_MEDIA_OPERATION_CANCELLED");
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    length += bytes.length;
    if (length > maximum) throw protectedMediaFailure("PROTECTED_MEDIA_IMAGE_TOO_LARGE");
    chunks.push(bytes);
  }
  return Buffer.concat(chunks, length);
}

export type BuiltProtectedMediaDerivative = Readonly<{
  variant: "display" | "thumbnail";
  object: PrivateObjectDescriptor;
  sourceChecksum: string;
  outputChecksum: string;
  width: number;
  height: number;
  safeMetadata: Record<string, boolean>;
}>;

/**
 * The worker-only builder reads the original through the private provider,
 * re-encodes it, scans each exact output, and promotes only private objects.
 * It has no route, URL, filename, or storage-key return path.
 */
export async function buildProtectedMediaRasterDerivatives(input: {
  source: PrivateObjectDescriptor;
  sourceScanState: string;
  declaredMediaType: string;
  storage: PrivateStorageProvider;
  scanner: PrivateScannerProvider;
  signal?: AbortSignal;
}): Promise<readonly BuiltProtectedMediaDerivative[]> {
  if (input.sourceScanState !== "CLEAN") throw protectedMediaFailure("PROTECTED_MEDIA_SOURCE_NOT_CLEAN");
  const bytes = await boundedBuffer(await input.storage.read(input.source), 8 * 1024 * 1024, input.signal);
  const generated = await buildSanitizedRasterDerivatives({ bytes, declaredMediaType: input.declaredMediaType });
  const output: BuiltProtectedMediaDerivative[] = [];
  for (const derivative of [generated.display, generated.thumbnail]) {
    if (input.signal?.aborted) throw protectedMediaFailure("PROTECTED_MEDIA_OPERATION_CANCELLED");
    const key = `${protectedMediaRasterPolicyV1}/${derivative.derivativeChecksum.slice(0, 2)}/${derivative.derivativeChecksum}`;
    const staged = await input.storage.put("derivatives", key, Readable.from([derivative.bytes]), {
      expectedSha256: derivative.derivativeChecksum,
      contentLength: derivative.bytes.length,
      signal: input.signal,
    });
    const scan = await input.scanner.scan({ object: staged, mediaType: derivative.mediaType, signal: input.signal });
    if (scan.state !== "CLEAN") {
      await input.storage.moveToQuarantine(staged, `DERIVATIVE_SCAN_${scan.state}`);
      throw protectedMediaFailure("PROTECTED_MEDIA_DERIVATIVE_NOT_CLEAN");
    }
    if (staged.sha256 !== derivative.derivativeChecksum || staged.byteLength !== derivative.bytes.length)
      throw protectedMediaFailure("PROTECTED_MEDIA_DERIVATIVE_VERIFICATION_FAILED");
    output.push(
      Object.freeze({
        variant: derivative.variant,
        object: staged,
        sourceChecksum: derivative.sourceChecksum,
        outputChecksum: derivative.derivativeChecksum,
        width: derivative.width,
        height: derivative.height,
        safeMetadata: {
          orientationApplied: true,
          exifRemoved: true,
          gpsLatitudeRemoved: true,
          gpsLongitudeRemoved: true,
          gpsAltitudeRemoved: true,
          deviceMetadataRemoved: true,
          embeddedThumbnailRemoved: true,
        },
      }),
    );
  }
  return Object.freeze(output);
}
