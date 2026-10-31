import { describe, expect, it } from "vitest";
import { CUT, camera, atmosphericDepth } from "./program";
import { eyePosition } from "./projection";
import { TitleSnag, SNAG_BIRTH, findGlyphContact, glyphAlpha, type GlyphMask } from "./title-snag";

// Deliberately narrow solid letter stem with a large transparent surround.
// Runtime uses the actual font raster; this test detects rectangle colliders.
const glyph: GlyphMask = { width: 360, height: 124, alpha: new Uint8Array(360 * 124) };
for (let y = 61; y < 84; y++) for (let x = 210; x < 218; x++) glyph.alpha[y * 360 + x] = 255;
describe("visible-letter paper contact", () => {
  it("finds ink rather than treating transparent text bounds as a solid surface", () => {
    expect(glyphAlpha(glyph, findGlyphContact(glyph))).toBe(255);
    expect(glyphAlpha(glyph, [0.4, 0.43])).toBe(0);
    expect(() => findGlyphContact({ ...glyph, alpha: new Uint8Array(glyph.alpha.length) })).toThrow();
  });
  it.each([
    [1280, 720],
    [390, 844],
    [800, 1100],
    [2560, 1080],
  ])(
    "strikes a glyph with momentum, holds a small material area and releases without resetting it (%s x %s)",
    (width, height) => {
      const snag = new TitleSnag({ viewport: { width, height }, aspect: 510 / 594, glyph });
      const first = snag.sheet.at(SNAG_BIRTH);
      expect(Math.min(...first.positions.filter((_, i) => i % 3 === 2))).toBeGreaterThan(
        eyePosition(camera(SNAG_BIRTH))[2],
      );
      snag.sheet.at(CUT.catch + 0.05);
      expect(snag.contact).not.toBeNull();
      expect(Math.abs(snag.contact!.time - CUT.catch)).toBeLessThan(0.02);
      expect(glyphAlpha(glyph, snag.contact!.uv)).toBe(255);
      expect(snag.contact!.velocity[2]).toBeLessThan(-1000);
      let largest = 0,
        freeSpan = 0;
      for (let time = CUT.catch + 0.05; time < CUT.peel; time += 1 / 30) {
        const state = snag.inspect(time);
        largest = Math.max(largest, state.strain.max);
        expect(Math.hypot(...state.pin.map((v, i) => v - state.point![i]))).toBeLessThan(0.05);
        const frame = snag.sheet.at(time);
        freeSpan = Math.max(
          freeSpan,
          Math.max(...frame.positions.filter((_, i) => i % 3 === 2)) -
            Math.min(...frame.positions.filter((_, i) => i % 3 === 2)),
        );
      }
      expect(largest).toBeLessThan(0.015);
      expect(freeSpan).toBeGreaterThan(20);
      const before = snag.inspect(CUT.peel - 0.001),
        after = snag.inspect(CUT.peel + 0.001);
      expect(Math.hypot(...before.pin.map((v, i) => v - after.pin[i]))).toBeLessThan(10);
      expect(after.held).toBe(false);
      const late = snag.inspect(CUT.peel + 2);
      expect(late.pin[2]).toBeLessThan(after.pin[2] - 1200);
      const end = snag.inspect(CUT.room);
      expect(atmosphericDepth(camera(CUT.room).position[2] - end.nearestZ)).toBeLessThan(0.001);
      const cached = new TitleSnag(snag.spec, snag.exportCache());
      expect(cached.inspect(CUT.catch + 0.5)).toEqual(snag.inspect(CUT.catch + 0.5));
    },
  );
});
