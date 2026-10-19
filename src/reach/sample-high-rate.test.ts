// @sounding-line-registration owner=reach suite=unit.reach contracts=reach.phase1.foundation
import { describe, expect, it } from "vitest";
import { sampleEvidenceDuration, sampleEvidencePolicy } from "./calibration";
import { syntheticBinding, syntheticRelativeBinding } from "./foundation-scenarios";
import { SampleWindow, sampleWindowCapacity, type Acquisition } from "./sample-window";

const target = { x: 0.5, y: 0.5 };
const absoluteFeatures = [1, 0.5, 0.5, 0.1, -0.7];
const relativeFeatures = [1, 0.5, 0.5, 0, 0];
describe("bounded high-rate calibration evidence", () => {
  it.each([10, 20, 30, 60])(
    "finishes a stable %ifps hold without reducing the raw count or 600ms requirement",
    (fps) => {
      for (const mode of ["ABSOLUTE", "RELATIVE"] as const) {
        const binding = mode === "ABSOLUTE" ? syntheticBinding : syntheticRelativeBinding;
        const features = mode === "ABSOLUTE" ? absoluteFeatures : relativeFeatures;
        const window = new SampleWindow(binding, target, mode);
        let accepted: Acquisition | null = null;
        for (let i = 0; i < fps * 2; i++) {
          const result = window.push(features, 100 + (i * 1000) / fps, binding);
          if (result.samples) {
            accepted = result;
            break;
          }
          expect(result.progress).toBeLessThan(1);
        }
        expect(accepted?.state).toBe("ACCEPTED");
        expect(accepted!.samples!.length).toBeGreaterThanOrEqual(sampleEvidencePolicy.minimumSamples);
        expect(sampleEvidenceDuration(accepted!.samples!)!).toBeGreaterThanOrEqual(
          sampleEvidencePolicy.minimumEvidenceMs,
        );
        expect(accepted!.samples!.at(-1)!.at - accepted!.samples![0].at).toBeGreaterThanOrEqual(600);
        if (fps === 60) expect(accepted!.samples!.length).toBeGreaterThan(30);
      }
    },
  );

  it("keeps both count and clock capacity bounded at the supported 60Hz ceiling", () => {
    const window = new SampleWindow(syntheticRelativeBinding, target, "RELATIVE");
    let result: Acquisition | null = null;
    for (let i = 0; i < 400; i++)
      result = window.push(relativeFeatures, 100 + (i * 1000) / 60, syntheticRelativeBinding);
    expect(sampleWindowCapacity.supportedMaximumHz).toBe(60);
    expect(result!.samples!.length).toBeLessThanOrEqual(sampleWindowCapacity.retainedSamples);
    expect(result!.samples!.at(-1)!.at - result!.samples![0].at).toBeLessThanOrEqual(
      sampleEvidencePolicy.maximumWindowMs,
    );
    expect(sampleEvidencePolicy).toMatchObject({
      minimumSamples: 15,
      minimumEvidenceMs: 600,
      maximumWindowMs: 5000,
      recoveryMs: 2500,
    });
  });

  it("does not credit a 60Hz outlier or a brief occlusion as hold evidence", () => {
    const window = new SampleWindow(syntheticRelativeBinding, target, "RELATIVE");
    let before!: Acquisition;
    for (let i = 0; i < 18; i++)
      before = window.push(relativeFeatures, 100 + (i * 1000) / 60, syntheticRelativeBinding);
    expect(window.push([1, 0.8, 0.5, 0, 0], 400, syntheticRelativeBinding)).toMatchObject({
      state: "MOVING",
      progress: before.progress,
    });
    window.pause(450);
    const resumed = window.push(relativeFeatures, 700, syntheticRelativeBinding);
    expect(resumed.progress).toBe(before.progress);
    expect(resumed.samples).toBeNull();
    let result = resumed;
    for (let i = 1; i <= 60 && !result.samples; i++)
      result = window.push(relativeFeatures, 700 + (i * 1000) / 60, syntheticRelativeBinding);
    expect(result.state).toBe("ACCEPTED");
    expect(result.rejected).toBe(1);
    expect(result.samples!.every((sample) => sample.features[1] === 0.5)).toBe(true);
    expect(sampleEvidenceDuration(result.samples!)!).toBeGreaterThanOrEqual(600);
    expect(sampleEvidenceDuration(result.samples!)!).toBeLessThan(result.samples!.at(-1)!.at - result.samples![0].at);
  });

  it("expires a long interruption instead of combining old high-rate samples with a new hold", () => {
    const window = new SampleWindow(syntheticRelativeBinding, target, "RELATIVE");
    for (let i = 0; i < 20; i++) window.push(relativeFeatures, 100 + (i * 1000) / 60, syntheticRelativeBinding);
    expect(window.pause(3000)).toMatchObject({ state: "EXPIRED", progress: 0 });
    let result = window.push(relativeFeatures, 3050, syntheticRelativeBinding);
    expect(result).toMatchObject({ state: "ACQUIRING", progress: 0, samples: null });
    for (let i = 1; i <= 60 && !result.samples; i++)
      result = window.push(relativeFeatures, 3050 + (i * 1000) / 60, syntheticRelativeBinding);
    expect(result.state).toBe("ACCEPTED");
    expect(result.samples!.every((sample) => sample.at >= 3050)).toBe(true);
    expect(sampleEvidenceDuration(result.samples!)!).toBeGreaterThanOrEqual(600);
  });
});
