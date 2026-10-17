import {
  sampleEvidenceDuration,
  sampleEvidencePolicy,
  stableSamples,
  stableMovementSamples,
  assertCurrentReachBinding,
  isRelativeImageFeatureVector,
  type CalibrationSample,
  type CalibrationBinding,
} from "./calibration";
import type { Point } from "./coordinates";
export type Acquisition = {
  state: "ACQUIRING" | "COLLECTING" | "PAUSED" | "MOVING" | "ACCEPTED" | "EXPIRED";
  progress: number;
  samples: CalibrationSample[] | null;
  rejected: number;
};
const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
/** Retain about 1.5 seconds at the adaptive ceiling, within the existing 5-second clock bound. */
export const sampleWindowCapacity = { supportedMaximumHz: 60, retainedSamples: 90 } as const;
/** Bounded, source-bound evidence. Interruptions freeze progress; resumed evidence must agree spatially. */
export class SampleWindow {
  private samples: CalibrationSample[] = [];
  private candidate: CalibrationSample[] = [];
  private lastInput = -Infinity;
  private lastAccepted = -Infinity;
  private rejected = 0;
  private interrupted = false;
  constructor(
    readonly binding: CalibrationBinding,
    readonly target: Point,
    readonly mode: "ABSOLUTE" | "RELATIVE" = "ABSOLUTE",
  ) {
    assertCurrentReachBinding(binding, mode);
  }
  private result(state: Acquisition["state"], accepted: CalibrationSample[] | null = null): Acquisition {
    const duration = sampleEvidenceDuration(this.samples) ?? 0;
    return {
      state,
      progress: Math.min(
        1,
        this.samples.length / sampleEvidencePolicy.minimumSamples,
        duration / sampleEvidencePolicy.minimumEvidenceMs,
      ),
      samples: accepted,
      rejected: this.rejected,
    };
  }
  reset() {
    this.samples = [];
    this.candidate = [];
    this.lastAccepted = -Infinity;
    this.interrupted = false;
    // The source clock is deliberately retained: reset cannot permit replayed samples.
  }
  private expire(at: number) {
    if (this.samples.length && at - this.lastAccepted > sampleEvidencePolicy.recoveryMs) {
      this.reset();
      return true;
    }
    this.samples = this.samples
      .filter((s) => at - s.at <= sampleEvidencePolicy.maximumWindowMs)
      .slice(-sampleWindowCapacity.retainedSamples);
    return false;
  }
  pause(at: number) {
    if (!Number.isFinite(at) || at < this.lastInput) throw new Error("SAMPLE_CLOCK_INVALID");
    if (this.expire(at)) return this.result("EXPIRED");
    this.interrupted = true;
    this.candidate = [];
    return this.result("PAUSED");
  }
  private stableSpread(samples: CalibrationSample[]) {
    return samples[0].features.every(
      (_, i) =>
        (this.mode === "RELATIVE" && i >= 3) ||
        Math.max(...samples.map((s) => s.features[i])) - Math.min(...samples.map((s) => s.features[i])) <=
          (i < 3 ? 0.02 : 0.08),
    );
  }
  private agrees(features: number[], samples: CalibrationSample[]) {
    const limits = [
      0,
      0.018,
      0.018,
      this.mode === "RELATIVE" ? Infinity : 0.09,
      this.mode === "RELATIVE" ? Infinity : 0.09,
    ];
    return features.every((value, i) => Math.abs(value - median(samples.map((s) => s.features[i]))) <= limits[i]);
  }
  push(features: number[], at: number, binding: CalibrationBinding): Acquisition {
    assertCurrentReachBinding(this.binding, this.mode);
    assertCurrentReachBinding(binding, this.mode);
    if (Object.entries(this.binding).some(([k, v]) => binding[k as keyof CalibrationBinding] !== v))
      throw new Error("SAMPLE_CONTEXT_CHANGED");
    if (
      !Number.isFinite(at) ||
      at <= this.lastInput ||
      features.length !== 5 ||
      features[0] !== 1 ||
      (this.mode === "RELATIVE" && !isRelativeImageFeatureVector(features)) ||
      features.some((v) => !Number.isFinite(v))
    )
      throw new Error("SAMPLE_INVALID_OR_REORDERED");
    this.lastInput = at;
    this.expire(at);
    const sample = { target: this.target, features: [...features], at, continuitySegment: 0 };
    if (
      this.samples.length >= 5 &&
      (!this.agrees(features, this.samples) || !this.stableSpread([...this.samples, sample]))
    ) {
      ++this.rejected;
      this.interrupted = true;
      const previous = this.candidate.at(-1);
      if (
        previous &&
        (at - previous.at > sampleEvidencePolicy.maximumSampleGapMs ||
          !this.agrees(features, this.candidate) ||
          !this.stableSpread([...this.candidate, sample]))
      )
        this.candidate = [];
      this.candidate.push(sample);
      this.candidate = this.candidate.slice(-sampleWindowCapacity.retainedSamples);
      // A deliberate new hold replaces only this unfinished target after sustained, coherent evidence.
      if (this.candidate.length < 5 || at - this.candidate[0].at < 450) return this.result("MOVING");
      this.samples = this.candidate;
      this.candidate = [];
      this.interrupted = false;
    } else {
      this.candidate = [];
      const previous = this.samples.at(-1);
      if (previous) {
        sample.continuitySegment = previous.continuitySegment!;
        if (this.interrupted || at - previous.at > sampleEvidencePolicy.maximumSampleGapMs) ++sample.continuitySegment;
      }
      this.samples.push(sample);
      this.interrupted = false;
    }
    this.lastAccepted = at;
    this.samples = this.samples
      .filter((s) => at - s.at <= sampleEvidencePolicy.maximumWindowMs)
      .slice(-sampleWindowCapacity.retainedSamples);
    if ((this.mode === "RELATIVE" ? stableMovementSamples : stableSamples)(this.samples))
      return this.result(
        "ACCEPTED",
        this.samples.map((s) => ({ ...s, target: { ...s.target }, features: [...s.features] })),
      );
    return this.result(this.samples.length < 5 ? "ACQUIRING" : "COLLECTING");
  }
}
