// @sounding-line-registration owner=reach suite=unit.reach contracts=reach.phase1.foundation
import { describe, expect, it } from "vitest";
import { createNccScratch, searchNcc, type NccFrame, type NccPoint, type NccTemplate } from "./index-ncc";

// The pre-optimization scalar calculation remains independent of the kernel.
function scalar(frame: NccFrame, template: NccTemplate, around: NccPoint, radius: number, previous?: NccPoint) {
  const cx = Math.round(around.x),
    cy = Math.round(around.y),
    px = Math.round(previous?.x ?? around.x),
    py = Math.round(previous?.y ?? around.y);
  const minX = Math.min(cx, px) - radius,
    maxX = Math.max(cx, px) + radius,
    minY = Math.min(cy, py) - radius,
    maxY = Math.max(cy, py) + radius;
  const scores: number[] = [];
  let best = -1,
    point: NccPoint | null = null;
  for (let y = minY; y <= maxY; ++y)
    for (let x = minX; x <= maxX; ++x) {
      let score = -1;
      if (
        ((Math.abs(x - cx) <= radius && Math.abs(y - cy) <= radius) ||
          (Math.abs(x - px) <= radius && Math.abs(y - py) <= radius)) &&
        x - template.radius >= 1 &&
        y - template.radius >= 1 &&
        x + template.radius < frame.width - 1 &&
        y + template.radius < frame.height - 1
      ) {
        let sum = 0,
          squared = 0,
          product = 0,
          i = 0;
        for (let dy = -template.radius; dy <= template.radius; ++dy)
          for (let dx = -template.radius; dx <= template.radius; ++dx) {
            const value = frame.data[(y + dy) * frame.width + x + dx];
            sum += value;
            squared += value * value;
            product += value * template.values[i++];
          }
        const size = template.values.length,
          variance = squared - (sum * sum) / size;
        if (!(variance < size * 6 ** 2))
          score = (product - sum * template.mean) / Math.sqrt(variance * size * template.deviation ** 2);
      }
      scores.push(score);
      if (score > best) {
        best = score;
        point = { x, y };
      }
    }
  let second = -1;
  if (point)
    for (let i = 0; i < scores.length; ++i) {
      const x = minX + (i % (maxX - minX + 1)),
        y = minY + Math.floor(i / (maxX - minX + 1));
      if (Math.hypot(x - point.x, y - point.y) > 3) second = Math.max(second, scores[i]);
    }
  return { match: point ? { point, correlation: best, separation: best - second } : null, scores };
}
function frame(width = 160, height = 120, seed = 1): NccFrame {
  let state = seed;
  const data = Uint8Array.from({ length: width * height }, () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state >>> 24;
  });
  return { data, width, height, capture: seed };
}
function template(f: NccFrame, x: number, y: number, radius = 7): NccTemplate {
  const values = new Float32Array((radius * 2 + 1) ** 2);
  let sum = 0,
    squared = 0,
    i = 0;
  for (let dy = -radius; dy <= radius; ++dy)
    for (let dx = -radius; dx <= radius; ++dx) {
      const value = f.data[(y + dy) * f.width + x + dx];
      values[i++] = value;
      sum += value;
      squared += value * value;
    }
  const mean = sum / values.length;
  return { values, mean, deviation: Math.sqrt(Math.max(0, squared / values.length - mean * mean)), radius };
}
function equal(
  f: NccFrame,
  t: NccTemplate,
  around: NccPoint,
  radius = 24,
  previous?: NccPoint,
  scratch = createNccScratch(),
) {
  const expected = scalar(f, t, around, radius, previous),
    scores = new Float64Array(expected.scores.length);
  expect(searchNcc(f, t, around, radius, scores, previous, scratch)).toEqual(expected.match);
  expect(Array.from(scores)).toEqual(expected.scores);
  return expected.match;
}
describe("exact bounded NCC kernel", () => {
  it("refines fractional translations without changing any integer score, winner, rival or tie", () => {
    const original = frame(160, 120, 21),
      t = template(original, 70, 60);
    const integerErrors: number[] = [],
      refinedErrors: number[] = [];
    for (const shift of [0.1, 0.2, 0.3, 0.4, 0.6, 0.7, 0.8, 0.9]) {
      const moved = { ...original, data: new Uint8Array(original.data.length), capture: 100 + shift };
      for (let y = 0; y < original.height; ++y)
        for (let x = 1; x < original.width; ++x)
          moved.data[y * original.width + x] = Math.round(
            original.data[y * original.width + x] * (1 - shift) + original.data[y * original.width + x - 1] * shift,
          );
      const exactScores = new Float64Array(49 * 49),
        refinedScores = new Float64Array(49 * 49);
      const exact = searchNcc(moved, t, { x: 70, y: 60 }, 24, exactScores)!;
      const refined = searchNcc(moved, t, { x: 70, y: 60 }, 24, refinedScores, undefined, createNccScratch(), true)!;
      expect(refined).toMatchObject(exact);
      expect(Array.from(refinedScores)).toEqual(Array.from(exactScores));
      integerErrors.push(Math.abs(exact.point.x - 70 - shift));
      refinedErrors.push(Math.abs((refined.refinedPoint?.x ?? refined.point.x) - 70 - shift));
      if (refined.refinedPoint)
        expect(
          Math.hypot(refined.refinedPoint.x - refined.point.x, refined.refinedPoint.y - refined.point.y),
        ).toBeLessThanOrEqual(Math.SQRT1_2);
    }
    expect(refinedErrors.reduce((a, b) => a + b, 0)).toBeLessThan(integerErrors.reduce((a, b) => a + b, 0));
    expect(Math.max(...refinedErrors)).toBeLessThan(0.25);
    const scores = new Float64Array(49 * 49);
    expect(searchNcc(original, t, { x: 70, y: 60 }, 24, scores, undefined, createNccScratch(), true)).toEqual({
      point: { x: 70, y: 60 },
      correlation: 1,
      separation: expect.any(Number),
    });
  });
  it.each([1, 17, 971])("preserves every score, rival peak and tie on noisy images (seed%s)", (seed) => {
    const f = frame(160, 120, seed),
      t = template(f, 71, 63);
    equal(f, t, { x: 71.49, y: 63.5 }, 24, { x: 59.2, y: 75.1 });
  });
  it.each([4, 5, 6, 7])("preserves reduced edge template radius%s", (radius) => {
    const f = frame(),
      t = template(f, 30, 29, radius);
    equal(f, t, { x: 13.6, y: 12.5 }, 24, { x: 2.2, y: 3.1 });
    equal(f, t, { x: 159, y: 119 }, 4);
  });
  it("retains the first row-major winner and rejects a repeated-pattern rival", () => {
    const f = frame();
    for (let y = 0; y < f.height; ++y)
      for (let x = 0; x < f.width; ++x) f.data[y * f.width + x] = (x % 12) * 13 + (y % 9) * 7;
    const match = equal(f, template(f, 60, 60), { x: 60, y: 60 });
    expect(match?.separation).toBe(0);
  });
  it("rejects flat candidates exactly, without inventing a valid point", () => {
    const f = frame(),
      t = template(f, 60, 60);
    f.data.fill(255);
    expect(equal(f, t, { x: 60, y: 60 })).toBeNull();
  });
  it.each([11, 12, 13])(
    "keeps low-texture candidates around the original variance boundary (contrast%s)",
    (contrast) => {
      const f = frame(),
        t = template(f, 60, 60);
      for (let y = 0; y < f.height; ++y)
        for (let x = 0; x < f.width; ++x) f.data[y * f.width + x] = 120 + ((x + y) % 2 ? contrast : 0);
      equal(f, t, { x: 60, y: 60 });
    },
  );
  it("preserves maximum-grid scores without integer overflow", () => {
    const f = frame(640, 640, 212),
      t = template(f, 610, 610);
    equal(f, t, { x: 610, y: 610 }, 24, { x: 598, y: 598 });
  });
  it("shares current moments across independent reverse history without sharing template scores", () => {
    const current = frame(160, 120, 90),
      history = frame(160, 120, 91),
      scratch = createNccScratch();
    equal(current, template(current, 60, 60), { x: 60, y: 60 }, 24, { x: 70, y: 55 }, scratch);
    const cached = scratch.regions.find((r) => r.data === current.data),
      sums = cached!.sums;
    equal(history, template(current, 60, 60), { x: 60, y: 60 }, 4, undefined, scratch);
    equal(current, template(current, 61, 61), { x: 60, y: 60 }, 24, { x: 70, y: 55 }, scratch);
    expect(scratch.regions.find((r) => r.data === current.data)?.sums).toBe(sums);
    expect(scratch.regions).toHaveLength(2);
    expect(Math.max(...scratch.regions.map((r) => r.sums.length))).toBeLessThanOrEqual(80 * 80);
  });
  it("invalidates moments for a new capture even when the input buffer is reused", () => {
    const f = frame(),
      t = template(f, 60, 60),
      scratch = createNccScratch();
    equal(f, t, { x: 60, y: 60 }, 24, undefined, scratch);
    f.data.fill(80);
    f.capture = 2;
    expect(equal(f, t, { x: 60, y: 60 }, 24, undefined, scratch)).toBeNull();
  });
  it("does not cache a mutable generic frame without a capture epoch", () => {
    const f = frame(),
      t = template(f, 60, 60),
      scratch = createNccScratch();
    delete f.capture;
    equal(f, t, { x: 60, y: 60 }, 24, undefined, scratch);
    f.data.fill(90);
    expect(equal(f, t, { x: 60, y: 60 }, 24, undefined, scratch)).toBeNull();
  });
  it("retains both square domains and a strong rival outside the predicted square", () => {
    const f = frame(),
      t = template(f, 40, 60);
    for (let dy = -7; dy <= 7; ++dy)
      for (let dx = -7; dx <= 7; ++dx) f.data[(60 + dy) * f.width + 80 + dx] = t.values[(dy + 7) * 15 + dx + 7];
    const match = equal(f, t, { x: 72, y: 60 }, 24, { x: 56, y: 60 });
    expect(match?.separation).toBe(0);
  });
  it("bounds malformed frame, score and search allocations", () => {
    const f = frame(),
      t = template(f, 60, 60),
      scores = new Float64Array(65 * 65);
    expect(() => searchNcc({ ...f, width: 641 }, t, { x: 60, y: 60 }, 24, scores)).toThrow("NCC_SEARCH_INPUT_INVALID");
    expect(() => searchNcc(f, t, { x: NaN, y: 60 }, 24, scores)).toThrow("NCC_SEARCH_INPUT_INVALID");
    expect(() => searchNcc(f, t, { x: 60, y: 60 }, 24, new Float64Array(1))).toThrow("NCC_SCORE_CAPACITY_EXCEEDED");
    expect(() => searchNcc(f, t, { x: 60, y: 60 }, 24, scores, { x: 1, y: 60 })).toThrow();
  });
});
