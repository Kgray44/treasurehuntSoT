import { createHash } from "node:crypto";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { assertExactMediaPublicationConsent, createSafePublicImageDerivative } from "./voyage-log-media";

describe("Voyage Log public-image sanitization", () => {
  it("decodes a synthetic metadata-bearing image into a separate, metadata-free derivative", async () => {
    const original = await sharp({ create: { width: 3, height: 2, channels: 3, background: "#0088cc" } })
      .withExif({ IFD0: { Artist: "Private device identity", Copyright: "Private location metadata" } })
      .jpeg()
      .toBuffer();
    const originalChecksum = createHash("sha256").update(original).digest("hex");
    expect((await sharp(original).metadata()).exif).toBeDefined();
    const derivative = await createSafePublicImageDerivative({ bytes: original, declaredMediaType: "image/jpeg" });
    const publicMetadata = await sharp(derivative.bytes).metadata();
    expect(derivative.sourceChecksum).toBe(originalChecksum);
    expect(derivative.derivativeChecksum).not.toBe(originalChecksum);
    expect(derivative).toMatchObject({
      detectedMediaType: "image/jpeg",
      orientationApplied: true,
      exifRemoved: true,
      gpsLatitudeRemoved: true,
      gpsLongitudeRemoved: true,
      gpsAltitudeRemoved: true,
      deviceMetadataRemoved: true,
      embeddedThumbnailRemoved: true,
    });
    expect(publicMetadata.exif).toBeUndefined();
    expect(publicMetadata.icc).toBeUndefined();
    expect(original).toEqual(original);
  });

  it("rejects consent replay, an altered derivative, and scanner-unconfigured media", async () => {
    const base = {
      approvedVoyageLogId: "log-1",
      approvedOpaqueMediaId: "opaque-1",
      approvedSourceChecksum: "a".repeat(64),
      approvedDerivativeChecksum: "b".repeat(64),
      voyageLogId: "log-1",
      opaqueMediaId: "opaque-1",
      sourceChecksum: "a".repeat(64),
      derivativeChecksum: "b".repeat(64),
      receipt: { result: "CLEAN" as const, sha256: "b".repeat(64) },
    };
    expect(() => assertExactMediaPublicationConsent(base)).not.toThrow();
    expect(() => assertExactMediaPublicationConsent({ ...base, opaqueMediaId: "opaque-2" })).toThrow("does not match");
    expect(() =>
      assertExactMediaPublicationConsent({
        ...base,
        receipt: { result: "SCAN_NOT_CONFIGURED", sha256: "b".repeat(64) },
      }),
    ).toThrow("clean scanner receipt");
  });
});
