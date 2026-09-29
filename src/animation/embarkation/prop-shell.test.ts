import { describe, expect, it } from "vitest";
import { alphaContours, propShellVertices } from "./prop-shell";
import { propMaterial } from "./prop-material";

describe("Hero material silhouette shells", () => {
  it("retains the ring opening, torn indentation and closed outer boundary", () => {
    const w = 15,
      h = 13,
      alpha = new Float32Array(w * h);
    for (let y = 1; y < h - 1; y++)
      for (let x = 1; x < w - 1; x++)
        alpha[y * w + x] = (x >= 6 && x <= 8 && y >= 5 && y <= 7) || (x === 1 && y < 5) ? 0 : 1;
    const contours = alphaContours(alpha, w, h);
    const degree = new Map<string, number>();
    for (const segment of contours)
      for (const i of [0, 2]) {
        const key = [segment[i], segment[i + 1]].map((v) => v.toFixed(8)).join(":");
        degree.set(key, (degree.get(key) ?? 0) + 1);
      }
    expect([...degree.values()].every((n) => n === 2)).toBe(true);
    const inner = contours.filter(([u, v]) => u > 0.3 && u < 0.65 && v > 0.3 && v < 0.65);
    expect(inner.length).toBeGreaterThan(8);
    const vertices = propShellVertices(contours, 2);
    const edgeStart = 2 * 2 * 2 * 6 * 4;
    expect(vertices.length - edgeStart).toBe(contours.length * 6 * 4);
    for (let i = edgeStart; i < vertices.length; i += 24) {
      expect(vertices[i + 2]).toBe(-0.5);
      expect(vertices[i + 10]).toBe(0.5);
      expect(vertices[i + 3]).toBe(1);
    }
  });
  it("interpolates feathered alpha instead of extending the texture rectangle", () => {
    const a = [0, 0, 0, 0, 0.8, 0, 0, 0, 0];
    const contours = alphaContours(a, 3, 3);
    expect(contours.length).toBe(4);
    const coordinates = contours.flat();
    expect(Math.min(...coordinates)).toBeCloseTo(0.375);
    expect(Math.max(...coordinates)).toBeCloseTo(0.625);
    expect(alphaContours(Array(9).fill(0), 3, 3)).toEqual([]);
  });
  it("never assigns an opaque paper reverse to ink glyphs, light or typography", () => {
    for (const asset of ["derived/ink-0", "derived/light-2", "focus-line"]) expect(propMaterial(asset).backing).toBe(0);
    expect(propMaterial("derived/scrap-2").backing).toBe(1);
    expect(propMaterial("P7-sailcloth").backing).toBe(2);
    expect(propMaterial("P2-compass").thicknessRatio).toBeGreaterThan(propMaterial("P1-map-fragment").thicknessRatio);
  });
});
