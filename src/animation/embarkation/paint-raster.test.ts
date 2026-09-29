import { describe, expect, it } from "vitest";
import { paintRaster, scalePaintInsets } from "./paint-raster";
import { ConstrainedSheet } from "./cloth";
import { PaintMesh } from "./paint-mesh";

describe("native device-pixel paint registration", () => {
  it("preserves fractional bounds and their screen pixel phase without rescaling", () => {
    for (const ratio of [1, 1.25, 1.5, 2, 3]) {
      const rect = { x: 171.3, y: 186.125, width: 694.0875, height: 159.625 };
      const raster = paintRaster(rect, ratio, 24);
      expect(raster.width).toBe(raster.cssWidth * ratio);
      expect(raster.height).toBeCloseTo(raster.cssHeight * ratio, 10);
      expect((rect.x - raster.insets.left) * ratio).toBeCloseTo(Math.round((rect.x - raster.insets.left) * ratio), 10);
      expect((rect.y - raster.insets.top) * ratio).toBeCloseTo(Math.round((rect.y - raster.insets.top) * ratio), 10);
      expect(raster.cssWidth - raster.insets.left - raster.insets.right).toBeCloseTo(rect.width, 10);
      expect(raster.cssHeight - raster.insets.top - raster.insets.bottom).toBeCloseTo(rect.height, 10);
      for (const inset of Object.values(raster.insets)) {
        expect(inset).toBeGreaterThanOrEqual(24 - 1e-10);
        expect(inset).toBeLessThan(24 + 1 / ratio + 1e-10);
      }
    }
  });
  it("registers asymmetric raster gutters to unchanged physical vertices", () => {
    const rect = { x: 171.3, y: 186.125, width: 694.0875, height: 159.625 },
      scale = 1100 / 720;
    const raster = paintRaster(rect, 1.25, 24),
      insets = scalePaintInsets(raster.insets, scale);
    const sheet = new ConstrainedSheet(rect.width * scale, rect.height * scale, "card", "edge", () => ({
      air: [0, 0, 0],
      holds: [1, 1, 1, 1],
    }));
    const mesh = new PaintMesh(sheet, 24 * scale, insets),
      points = mesh.update(sheet.at(0));
    for (let i = 0; i < points.length / 3; i++) {
      const paintedX = mesh.uv[i * 2] * raster.cssWidth * scale - insets.left - sheet.width / 2;
      const paintedY = sheet.height / 2 + insets.top - (1 - mesh.uv[i * 2 + 1]) * raster.cssHeight * scale;
      expect(points[i * 3]).toBeCloseTo(paintedX, 3);
      expect(points[i * 3 + 1]).toBeCloseTo(paintedY, 3);
    }
  });
});
