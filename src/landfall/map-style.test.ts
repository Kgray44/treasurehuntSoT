import { describe, expect, it } from "vitest";
import { validateLandfallMapStyle } from "@/landfall/map-style";

const style = {
  version: 8,
  sources: { base: { type: "vector", tiles: ["https://example.invalid/{z}/{x}/{y}.pbf"] } },
  layers: [{ id: "base-layer", type: "background", paint: { "background-color": "#eeeeee" } }],
};
describe("Landfall map provider safety", () => {
  it("accepts a bounded declarative HTTPS style", () => {
    expect(validateLandfallMapStyle(style)).toEqual(style);
  });
  it("rejects scripts, local URLs, and provider collisions with canonical overlays", () => {
    expect(() =>
      validateLandfallMapStyle({ ...style, sources: { base: { type: "vector", tiles: ["javascript:alert(1)"] } } }),
    ).toThrow("LANDFALL_MAP_STYLE_URL_UNSAFE");
    expect(() =>
      validateLandfallMapStyle({ ...style, glyphs: "http://localhost:1234/fonts/{fontstack}/{range}.pbf" }),
    ).toThrow("LANDFALL_MAP_STYLE_URL_UNSAFE");
    expect(() =>
      validateLandfallMapStyle({ ...style, layers: [{ id: "landfall-private", type: "background" }] }),
    ).toThrow("LANDFALL_MAP_STYLE_INVALID");
  });
});
