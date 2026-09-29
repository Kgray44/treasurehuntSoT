import { describe, expect, it } from "vitest";
import { linearToSrgb, srgbToLinear, DATA_TEXTURES } from "./color";
describe("film color contract", () => {
  it("round-trips encoded artwork, including the transfer-function knee", () => {
    for (let i = 0; i <= 4096; i++) expect(linearToSrgb(srgbToLinear(i / 4096))).toBeCloseTo(i / 4096, 12);
    expect(srgbToLinear(0.04045)).toBeCloseTo(0.0031308, 7);
    expect(linearToSrgb(1.5)).toBeGreaterThan(1);
  });
  it("uses light, rather than encoded byte values, for alpha and addition", () => {
    expect(linearToSrgb(0.5)).toBeCloseTo(0.735356983, 8);
    expect(linearToSrgb(srgbToLinear(0.5) * 2)).toBeCloseTo(0.68583612, 7);
    expect(DATA_TEXTURES.has("reconciliationMask")).toBe(true);
    expect(DATA_TEXTURES.has("room")).toBe(false);
  });
});
