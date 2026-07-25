import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { buildSanitizedRasterDerivatives } from "@/private-content/media/image-policy-v1";

describe("protected media raster policy", () => {
  it("creates separate bounded WebP variants without metadata", async () => {
    const source = await sharp({ create: { width: 1200, height: 800, channels: 3, background: "#5588aa" } })
      .jpeg()
      .withMetadata({ exif: { IFD0: { Make: "CAMERA_SERIAL_SENTINEL", Model: "GPS_SENTINEL" } } })
      .toBuffer();
    const result = await buildSanitizedRasterDerivatives({ bytes: source, declaredMediaType: "image/jpeg" });
    expect(result.display.derivativeChecksum).not.toBe(result.display.sourceChecksum);
    expect(result.thumbnail.width).toBeLessThanOrEqual(512);
    expect((await sharp(result.display.bytes).metadata()).exif).toBeUndefined();
    expect(result.display.bytes.toString("latin1")).not.toContain("GPS_SENTINEL");
  });
});
