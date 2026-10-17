// @sounding-line-registration owner=reach suite=unit.reach contracts=reach.phase1.foundation
import { describe, expect, it } from "vitest";
import { PointFilter, type Point } from "./coordinates";

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
function gaussian(seed = 0x12345678) {
  const uniform = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return (seed + 0.5) / 4294967296;
  };
  return () => Math.sqrt(-2 * Math.log(uniform())) * Math.cos(2 * Math.PI * uniform());
}
function steadyMetrics(fps: number) {
  const filter = new PointFilter(),
    noise = gaussian();
  let rawSquared = 0,
    filteredSquared = 0,
    rawJitterSquared = 0,
    filteredJitterSquared = 0,
    sumX = 0,
    sumY = 0,
    count = 0;
  let previous: { raw: Point; filtered: Point } | null = null;
  for (let i = 0; i < fps * 8; i++) {
    const raw = { x: 0.5 + noise() * 0.008, y: 0.5 + noise() * 0.008 };
    const filtered = filter.update(raw, 100 + (i * 1000) / fps)!;
    expect(filtered).not.toBeNull();
    if (i > fps) {
      rawSquared += distance(raw, { x: 0.5, y: 0.5 }) ** 2;
      filteredSquared += distance(filtered, { x: 0.5, y: 0.5 }) ** 2;
      sumX += filtered.x - 0.5;
      sumY += filtered.y - 0.5;
      ++count;
      if (previous) {
        rawJitterSquared += distance(raw, previous.raw) ** 2;
        filteredJitterSquared += distance(filtered, previous.filtered) ** 2;
      }
    }
    previous = { raw, filtered };
  }
  return {
    rmsRatio: Math.sqrt(filteredSquared / rawSquared),
    frameJitterRatio: Math.sqrt(filteredJitterSquared / rawJitterSquared),
    centerBias: Math.hypot(sumX, sumY) / count,
  };
}
describe.each([15, 20, 30, 60])("display smoothing at %s frames per second", (fps) => {
  it("attenuates stationary noise without shifting the center", () => {
    const metrics = steadyMetrics(fps);
    expect(metrics.rmsRatio).toBeLessThanOrEqual(0.6);
    expect(metrics.frameJitterRatio).toBeLessThanOrEqual(0.45);
    expect(metrics.centerBias).toBeLessThan(0.003);
  });
  it("responds to deliberate movement with bounded lag rather than following noise velocity", () => {
    const filter = new PointFilter();
    const lags: number[] = [];
    for (let i = 0; i <= fps * 2; i++) {
      const time = i / fps;
      const x = time < 0.5 ? 0.2 : time < 1.5 ? 0.2 + 0.6 * (time - 0.5) : 0.8;
      const filtered = filter.update({ x, y: 0.5 }, 100 + time * 1000)!;
      expect(filtered).not.toBeNull();
      if (time > 0.75 && time < 1.45) lags.push(((x - filtered.x) / 0.6) * 1000);
    }
    const mean = lags.reduce((sum, lag) => sum + lag, 0) / lags.length;
    const sorted = [...lags].sort((a, b) => a - b);
    expect(mean).toBeLessThanOrEqual(70);
    expect(sorted[Math.ceil(sorted.length * 0.95) - 1]).toBeLessThanOrEqual(100);
  });
  it("reverses promptly, stays inside the observed path and settles after movement ends", () => {
    const filter = new PointFilter();
    const samples: { time: number; filtered: Point }[] = [];
    for (let i = 0; i <= fps * 3; i++) {
      const time = i / fps;
      const x = time < 0.5 ? 0.2 : time < 1.5 ? 0.2 + 0.6 * (time - 0.5) : time < 2.5 ? 0.8 - 0.6 * (time - 1.5) : 0.2;
      const filtered = filter.update({ x, y: 0.5 }, 100 + time * 1000)!;
      expect(filtered).not.toBeNull();
      expect(filtered.x).toBeGreaterThanOrEqual(0.2 - 1e-9);
      expect(filtered.x).toBeLessThanOrEqual(0.8 + 1e-9);
      samples.push({ time, filtered });
    }
    const peak = samples.reduce((best, sample) => (sample.filtered.x > best.filtered.x ? sample : best));
    expect(peak.time).toBeLessThanOrEqual(1.6);
    const settled = samples.find((sample) => sample.time >= 2.5 && Math.abs(sample.filtered.x - 0.2) < 0.01);
    expect(settled).toBeDefined();
    expect(settled!.time - 2.5).toBeLessThanOrEqual(fps === 15 ? 0.21 : 0.16);
  });
});
it.each([0.08, 0.15, -0.08, -0.15])(
  "rejects an isolated %s visual spike without an opposite velocity kick",
  (spike) => {
    const filter = new PointFilter();
    for (let i = 0; i < 12; i++) filter.update({ x: 0.5, y: 0.5 }, 100 + i * 50);
    expect(filter.update({ x: 0.5 + spike, y: 0.5 }, 700)).toEqual({ x: 0.5, y: 0.5 });
    expect(filter.update({ x: 0.5, y: 0.5 }, 750)).toEqual({ x: 0.5, y: 0.5 });
    expect(filter.update({ x: 0.5, y: 0.5 }, 800)).toEqual({ x: 0.5, y: 0.5 });
  },
);
it("does not mistake a continuing fast sweep for unrelated isolated spikes", () => {
  const filter = new PointFilter();
  filter.update({ x: 0.25, y: 0.5 }, 100);
  expect(filter.update({ x: 0.33, y: 0.5 }, 150)).toEqual({ x: 0.25, y: 0.5 });
  const confirmed = filter.update({ x: 0.41, y: 0.5 }, 200)!;
  expect(confirmed.x).toBeGreaterThan(0.35);
  for (let i = 3; i <= 8; i++) {
    const raw = { x: 0.25 + i * 0.08, y: 0.5 };
    const filtered = filter.update(raw, 100 + i * 50)!;
    expect(filtered).not.toBeNull();
    expect((raw.x - filtered.x) / 1.6).toBeLessThan(0.07);
  }
});
it("suppresses a spike during a smooth movement while recovering on its next valid frame", () => {
  const filter = new PointFilter(),
    control = new PointFilter();
  for (let i = 0; i <= 50; i++) {
    const raw = { x: 0.2 + i * 0.01, y: 0.5 };
    const filtered = filter.update(i === 30 ? { ...raw, y: 0.65 } : raw, 100 + i * 50)!;
    const expected = control.update(raw, 100 + i * 50)!;
    expect(filtered).not.toBeNull();
    expect(filtered.y).toBe(0.5);
    if (i > 30) expect(distance(filtered, expected)).toBeLessThan(0.012);
  }
});
it("keeps curved upward movement visible through irregular camera intervals", () => {
  const filter = new PointFilter(),
    noise = gaussian(1234);
  let at = 100,
    previous: Point | null = null;
  for (let i = 0; i < 100; i++) {
    const phase = Math.min(1, (at - 100) / 2500);
    const raw = { x: 0.5 + 0.12 * Math.sin(Math.PI * phase), y: 0.85 - 0.7 * phase };
    const filtered = filter.update({ x: raw.x + noise() * 0.003, y: raw.y + noise() * 0.003 }, at)!;
    expect(filtered).not.toBeNull();
    expect(Number.isFinite(filtered.x) && Number.isFinite(filtered.y)).toBe(true);
    if (previous) expect(distance(filtered, previous)).toBeLessThan(0.06);
    if (phase > 0.2) expect(distance(filtered, raw)).toBeLessThan(0.04);
    previous = filtered;
    at += [30, 50, 45, 40, 35][i % 5];
  }
});
it("keeps a brief gap visible and anchors a long gap without extrapolating missing motion", () => {
  const filter = new PointFilter();
  filter.update({ x: 0.2, y: 0.2 }, 100);
  const brief = filter.update({ x: 0.22, y: 0.2 }, 200)!;
  expect(brief).not.toBeNull();
  expect(brief.x).toBeGreaterThan(0.2);
  expect(brief.x).toBeLessThan(0.22);
  expect(filter.update({ x: 0.8, y: 0.7 }, 351)).toEqual({ x: 0.8, y: 0.7 });
});
it("rejects invalid or reordered inputs without advancing or poisoning valid filter state", () => {
  const filter = new PointFilter();
  filter.update({ x: 0.5, y: 0.5 }, 100);
  expect(filter.update({ x: NaN, y: 0.5 }, 150)).toBeNull();
  expect(filter.update({ x: 0.5, y: 0.5 }, 150)).toEqual({ x: 0.5, y: 0.5 });
  expect(filter.update({ x: 0.2, y: 0.2 }, 149)).toBeNull();
  expect(filter.update({ x: 0.2, y: 0.2 }, 150)).toBeNull();
  expect(filter.update({ x: 0.2, y: 0.2 }, Infinity)).toBeNull();
  expect(filter.update({ x: 0.5, y: 0.5 }, 200)).toEqual({ x: 0.5, y: 0.5 });
});
it("keeps candidate frames on the strict source clock and clears display state on explicit reset", () => {
  const filter = new PointFilter();
  filter.update({ x: 0.5, y: 0.5 }, 100);
  filter.update({ x: 0.65, y: 0.5 }, 150);
  expect(filter.update({ x: 0.65, y: 0.5 }, 150)).toBeNull();
  filter.reset();
  expect(filter.update({ x: 0.8, y: 0.2 }, 200)).toEqual({ x: 0.8, y: 0.2 });
});
it("bounds unconfirmed visual holds and never refreshes their accepted capture time", () => {
  const filter = new PointFilter();
  expect(filter.acceptedCaptureTime).toBeNull();
  filter.update({ x: 0.5, y: 0.5 }, 100);
  expect(filter.acceptedCaptureTime).toBe(100);
  for (let i = 0; i < 40; i++) {
    const at = 150 + i * 50;
    const displayed = filter.update({ x: i % 2 ? 0.8 : 0.2, y: 0.5 }, at);
    if (at <= 250) expect(displayed).toEqual({ x: 0.5, y: 0.5 });
    else expect(displayed).toBeNull();
    expect(filter.acceptedCaptureTime).toBe(100);
  }
  expect(filter.update({ x: 0.8, y: 0.5 }, Infinity)).toBeNull();
  expect(filter.update({ x: 0.8, y: 0.5 }, 2099)).toBeNull();
  expect(filter.update({ x: 0.81, y: 0.5 }, 2150)).not.toBeNull();
  expect(filter.acceptedCaptureTime).toBe(2150);
  filter.reset();
  expect(filter.acceptedCaptureTime).toBeNull();
});
