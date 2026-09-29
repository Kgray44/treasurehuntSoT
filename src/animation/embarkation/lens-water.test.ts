import { describe, expect, it } from "vitest";
import { LENS_IMPACTS, LENS_LIFETIME, LENS_MERGE_AGE, lensWaterState } from "./lens-water";

describe("lens-water adhesion and drainage", () => {
  const first = LENS_IMPACTS[0];
  it("keeps impact identity and deterministic arbitrary seeking", () => {
    const times = [5, 6.08, 6.7, 7.1, 7.8, 10.8, 15.4, 19, 35.8];
    const expected = times.map((t) => lensWaterState(t, 1280, 720));
    expect(
      times
        .toReversed()
        .map((t) => lensWaterState(t, 1280, 720))
        .reverse(),
    ).toEqual(expected);
    expect(lensWaterState(first.time - 0.001, 1280, 720).bulbs).toHaveLength(0);
    expect(lensWaterState(35.8, 1280, 720).bulbs).toHaveLength(0);
  });
  it("holds an adhered bead then accelerates downward without unbounded elongation", () => {
    const at = (age: number) => lensWaterState(first.time + age, 1280, 720).bulbs;
    expect(at(0.2)[1]).toBe(first.y);
    expect(at(0.6)[1]).toBe(first.y);
    expect(at(1.7)[1] - at(1.8)[1]).toBeGreaterThan(at(1.3)[1] - at(1.4)[1]);
    for (let age = 0.1; age < LENS_LIFETIME; age += 0.03) {
      const b = at(age);
      expect(b[3] / ((b[2] * 1280) / 720)).toBeLessThanOrEqual(1.181);
    }
  });
  it("brings independent beads together continuously and conserves their center of mass", () => {
    const at = (age: number) => lensWaterState(first.time + age, 1280, 720);
    expect(at(0.2).events[0].separation).toBeGreaterThan(0.05);
    expect(at(LENS_MERGE_AGE).events[0].separation).toBeCloseTo(0.014, 9);
    expect(at(LENS_MERGE_AGE + 0.45).events[0].separation).toBeLessThan(0.000001);
    const before = at(LENS_MERGE_AGE - 0.000001).bulbs,
      after = at(LENS_MERGE_AGE + 0.000001).bulbs;
    expect(Math.abs(before[1] - after[1])).toBeLessThan(0.000001);
    expect(Math.abs(before[5] - after[5])).toBeLessThan(0.000001);
    const age = 1.5,
      b = at(age).bulbs;
    const expected = (first.y - 0.11 * (age - 0.72) ** 2 + 0.28 * (first.y + 0.055 - 0.13 * (age - 0.32) ** 2)) / 1.28;
    expect((b[1] + 0.28 * b[5]) / 1.28).toBeCloseTo(expected, 10);
  });
  it("preserves bead shape across viewport aspect ratios and exits before arrival", () => {
    for (const [w, h] of [
      [390, 844],
      [1280, 720],
      [2560, 1080],
    ]) {
      const b = lensWaterState(first.time + 0.5, w, h).bulbs;
      expect(b[2] * w).toBeCloseTo(b[3] * h, 5);
      const last = lensWaterState(LENS_IMPACTS.at(-1)!.time + LENS_LIFETIME - 0.001, w, h);
      for (let i = 0; i < last.bulbs.length; i += 4) expect(last.bulbs[i + 1] + last.bulbs[i + 3]).toBeLessThan(0);
    }
  });
});
