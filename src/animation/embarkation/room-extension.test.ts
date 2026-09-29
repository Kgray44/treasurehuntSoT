import { describe, expect, it } from "vitest";
import { roomExtensionUV } from "./room-extension";

describe("room continuation frustum coverage", () => {
  it("covers the exposed ceiling above the eventual application header", () => {
    // Native 1280x720 screening: the 900px room starts 76px below the film.
    // The former delta2 mapping sampled V=1.014244 and visibly repeated its
    // upper texel row. Include extra shutter/lens margin around this case.
    const samples = [
      [0.02962963, 1.08444444],
      [0.97777778, 1.08444444],
      [0.02, 1.1],
      [0.99, 1.1],
      [-0.08, 0.94],
      [1.08, 0.94],
    ];
    for (const source of samples) {
      for (const coordinate of roomExtensionUV(source)) {
        expect(coordinate).toBeGreaterThan(0.001);
        expect(coordinate).toBeLessThan(0.999);
      }
    }
  });
});
