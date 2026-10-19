// @sounding-line-registration owner=reach suite=unit.reach contracts=reach.phase1.foundation
import { describe, expect, it } from "vitest";
import { defaultImageSignalPolicy, sampleImageSignal, type ImageLumaPlane } from "./image-signal";
const plane = (
  width: number,
  height: number,
  value: (x: number, y: number) => number,
  stride = width,
): ImageLumaPlane => {
  const data = new Uint8Array(stride * height).fill(255);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) data[y * stride + x] = value(x, y);
  return { data, width, height, rowStrideBytes: stride };
};
const whole = { kind: "WHOLE_FRAME" as const };
describe("bounded measured image signal", () => {
  it("measures an explicitly supplied dark subject ROI independently of a bright background without identifying a hand", () => {
    const image = plane(80, 60, (x, y) => (x >= 20 && x < 40 && y >= 20 && y < 40 ? 25 : 220));
    const full = sampleImageSignal(image, whole),
      roi = sampleImageSignal(image, { kind: "ROI", x: 20, y: 20, width: 20, height: 20 });
    if (full.status === "INVALID_INPUT" || roi.status === "INVALID_INPUT") throw Error("fixture invalid");
    expect(roi.scope).toBe("ROI");
    expect(roi.meanLuma).toBe(25);
    expect(roi.contrastStandardDeviation).toBe(0);
    expect(roi.laplacianVariance).toBe(0);
    expect(full.meanLuma).toBeGreaterThan(190);
    expect(roi).not.toHaveProperty("handDetected");
    expect(roi).not.toHaveProperty("lightingCause");
    expect(roi).not.toHaveProperty("x");
  });
  it("uses actual dimensions and row stride while excluding padding from all sampled values", () => {
    const image = plane(13, 7, () => 31, 20),
      measurement = sampleImageSignal(image, whole);
    if (measurement.status === "INVALID_INPUT") throw Error("fixture invalid");
    expect(measurement.meanLuma).toBe(31);
    expect(measurement.regionWidth).toBe(13);
    expect(measurement.regionHeight).toBe(7);
    expect(measurement.sampleCount).toBe(91);
    expect(measurement.highClippedFraction).toBe(0);
  });
  it("reports sampled black/white clipping and contrast separately from model or gesture confidence", () => {
    const r = sampleImageSignal(
      plane(64, 64, (x) => (x < 32 ? 0 : 255)),
      whole,
    );
    if (r.status === "INVALID_INPUT") throw Error("fixture invalid");
    expect(r.lowClippedFraction).toBeCloseTo(0.5);
    expect(r.highClippedFraction).toBeCloseTo(0.5);
    expect(r.meanLuma).toBeCloseTo(127.5);
    expect(r.contrastStandardDeviation).toBeCloseTo(127.5);
    expect(r).not.toHaveProperty("confidence");
  });
  it("distinguishes an actual smoothed texture from its sharp source at the same resolution and scope", () => {
    let seed = 1337;
    const original = plane(96, 72, () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed >>> 24;
    });
    const blurred = plane(96, 72, (x, y) => {
      let sum = 0,
        n = 0;
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          const xx = Math.max(0, Math.min(95, x + dx)),
            yy = Math.max(0, Math.min(71, y + dy));
          sum += original.data[yy * 96 + xx];
          n++;
        }
      return Math.round(sum / n);
    });
    const a = sampleImageSignal(original, whole),
      b = sampleImageSignal(blurred, whole);
    if (a.status === "INVALID_INPUT" || b.status === "INVALID_INPUT") throw Error("fixture invalid");
    expect(b.contrastStandardDeviation).toBeLessThan(a.contrastStandardDeviation * 0.3);
    expect(b.meanGradientEnergy!).toBeLessThan(a.meanGradientEnergy! * 0.1);
    expect(b.laplacianVariance!).toBeLessThan(a.laplacianVariance! * 0.05);
    expect(b.meanAbsoluteLaplacian!).toBeLessThan(a.meanAbsoluteLaplacian! * 0.2);
  });
  it("respects a configurable sample budget, is deterministic and does not mutate or retain the source", () => {
    const image = plane(137, 83, (x, y) => (x * 13 + y * 7) % 256),
      before = image.data.slice();
    const policy = { ...defaultImageSignalPolicy, maximumSamples: 73 };
    const a = sampleImageSignal(image, whole, policy),
      b = sampleImageSignal(image, whole, policy);
    expect(a).toEqual(b);
    if (a.status === "INVALID_INPUT") throw Error("fixture invalid");
    expect(a.sampleCount).toBeLessThanOrEqual(73);
    expect(a.sampleCount).toBeGreaterThan(50);
    expect(image.data).toEqual(before);
    expect(a).not.toHaveProperty("data");
  });
  it("discloses insufficient tiny ROI evidence and unavailable derivative samples", () => {
    const r = sampleImageSignal(
      plane(1, 1, () => 100),
      whole,
    );
    if (r.status === "INVALID_INPUT") throw Error("fixture invalid");
    expect(r.status).toBe("INSUFFICIENT_SAMPLES");
    expect(r.sampleCount).toBe(1);
    expect(r.derivativeSampleCount).toBe(0);
    expect(r.laplacianVariance).toBeNull();
    expect(r.meanGradientEnergy).toBeNull();
  });
  it.each([
    { kind: "ROI", x: -1, y: 0, width: 4, height: 4 },
    { kind: "ROI", x: 9, y: 0, width: 4, height: 4 },
    { kind: "ROI", x: 0, y: 0, width: 0, height: 4 },
    { kind: "ROI", x: 0.5, y: 0, width: 4, height: 4 },
  ] as const)("rejects invalid or out-of-image ROI without silently measuring the whole scene: %j", (scope) => {
    expect(
      sampleImageSignal(
        plane(10, 10, () => 90),
        scope,
      ),
    ).toEqual({ version: 1, status: "INVALID_INPUT" });
  });
  it("rejects incomplete geometry, byte planes and excessive or inconsistent sample policies", () => {
    expect(sampleImageSignal({ ...plane(10, 10, () => 0), rowStrideBytes: 9 }, whole).status).toBe("INVALID_INPUT");
    expect(sampleImageSignal({ ...plane(10, 10, () => 0), data: new Uint8Array(90) }, whole).status).toBe(
      "INVALID_INPUT",
    );
    expect(
      sampleImageSignal(
        plane(10, 10, () => 0),
        whole,
        { ...defaultImageSignalPolicy, maximumSamples: 4097 },
      ).status,
    ).toBe("INVALID_INPUT");
    expect(
      sampleImageSignal(
        plane(10, 10, () => 0),
        whole,
        { ...defaultImageSignalPolicy, minimumSamples: 257 },
      ).status,
    ).toBe("INVALID_INPUT");
  });
});
