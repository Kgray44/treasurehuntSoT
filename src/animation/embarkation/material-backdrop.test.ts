import { describe, expect, it } from "vitest";
import { gaussianKernel } from "./material-backdrop";
describe("CSS glass blur kernel", () => {
  it("preserves constant color and the specified CSS variance at device scales", () => {
    for (const css of [9, 14])
      for (const dpr of [1, 1.25, 2, 3]) {
        const sigma = css * dpr,
          { radius, weights } = gaussianKernel(sigma);
        let sum = weights[0],
          variance = 0;
        for (let i = 1; i <= radius; i++) {
          sum += 2 * weights[i];
          variance += 2 * i * i * weights[i];
        }
        expect(sum).toBeCloseTo(1, 6);
        // Three-sigma truncation keeps over 97% of the ideal second moment.
        expect(variance / sigma ** 2).toBeGreaterThan(0.97);
        expect(variance / sigma ** 2).toBeLessThanOrEqual(1);
        expect(weights.slice(radius + 1).every((v) => v === 0)).toBe(true);
      }
  });
  it("leaves unblurred material unchanged", () => {
    const kernel = gaussianKernel(0);
    expect(kernel.radius).toBe(0);
    expect(kernel.weights[0]).toBe(1);
    expect(kernel.weights.slice(1).every((v) => v === 0)).toBe(true);
  });
});
