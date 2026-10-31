import { describe, expect, it } from "vitest";
import { ConstrainedSheet } from "./cloth";
import { PaintMesh } from "./paint-mesh";
describe("canonical paint to constrained material topology", () => {
  it("preserves every material vertex and extends only the transparent paint gutter", () => {
    const sheet = new ConstrainedSheet(480, 310, "paper", "multi", () => ({
      air: [250, 80, -5100],
      holds: [1, 1, 1, 1],
    }));
    const mesh = new PaintMesh(sheet, 24),
      frame = sheet.at(0.65),
      positions = mesh.update(frame);
    const columns = sheet.columns + 2;
    for (let y = 0; y < sheet.rows; y++)
      for (let x = 0; x < sheet.columns; x++) {
        const src = (y * sheet.columns + x) * 3,
          dst = ((y + 1) * columns + x + 1) * 3;
        expect(positions[dst]).toBeCloseTo(frame.positions[src], 5);
        expect(positions[dst + 1]).toBeCloseTo(-frame.positions[src + 1], 5);
        expect(positions[dst + 2]).toBeCloseTo(frame.positions[src + 2], 5);
      }
    expect(Math.min(...mesh.uv)).toBe(0);
    expect(Math.max(...mesh.uv)).toBe(1);
  });
  it("maps a flat canonical layout exactly, including nonsquare surfaces and fractional padding", () => {
    for (const [width, height, padding] of [
      [480, 310, 24],
      [160, 570, 19.2],
      [850, 74, 12],
    ]) {
      const sheet = new ConstrainedSheet(width, height, "card", "edge", () => ({
        air: [0, 0, 0],
        holds: [1, 1, 1, 1],
      }));
      const mesh = new PaintMesh(sheet, padding),
        p = mesh.update(sheet.at(0));
      for (let i = 0; i < mesh.uv.length / 2; i++) {
        expect(p[i * 3]).toBeCloseTo((mesh.uv[i * 2] - 0.5) * (width + 2 * padding), 3);
        expect(p[i * 3 + 1]).toBeCloseTo((mesh.uv[i * 2 + 1] - 0.5) * (height + 2 * padding), 3);
        expect(p[i * 3 + 2]).toBe(0);
      }
    }
  });
});
