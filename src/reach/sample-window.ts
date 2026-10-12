import { stableSamples, stableMovementSamples, type CalibrationSample, type CalibrationBinding } from "./calibration";
import type { Point } from "./coordinates";
export type Acquisition = {
  state: "ACQUIRING" | "COLLECTING" | "PAUSED" | "MOVING" | "ACCEPTED" | "EXPIRED";
  progress: number;
  samples: CalibrationSample[] | null;
  rejected: number;
};
const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
/** A bounded evidence window. Brief loss pauses evidence; identity/context can never be bridged. */
export class SampleWindow {
  private samples: CalibrationSample[] = [];
  private lastInput = -Infinity;
  private lastAccepted = -Infinity;
  private outliers = 0;
  private rejected = 0;
  private pausedAt: number | null = null;
  constructor(
    readonly binding: CalibrationBinding,
    readonly target: Point,
    readonly mode: "ABSOLUTE" | "RELATIVE" = "ABSOLUTE",
  ) {}
  private result(state: Acquisition["state"], accepted: CalibrationSample[] | null = null): Acquisition {
    const duration = this.samples.reduce(
      (sum, s, i) => sum + (i ? Math.min(100, s.at - this.samples[i - 1].at) : 0),
      0,
    );
    return {
      state,
      progress: Math.min(1, this.samples.length / 15, duration / 600),
      samples: accepted,
      rejected: this.rejected,
    };
  }
  reset() {
    this.samples = [];
    this.lastAccepted = -Infinity;
    this.outliers = 0;
  }
  pause(at: number) {
    if (!Number.isFinite(at)) throw new Error("SAMPLE_CLOCK_INVALID");
    this.pausedAt ??= at;
    if (at - this.lastAccepted > 300) {
      this.reset();
      return this.result("EXPIRED");
    }
    return this.result("PAUSED");
  }
  push(features: number[], at: number, binding: CalibrationBinding): Acquisition {
    if (Object.entries(this.binding).some(([k, v]) => binding[k as keyof CalibrationBinding] !== v))
      throw new Error("SAMPLE_CONTEXT_CHANGED");
    if (
      !Number.isFinite(at) ||
      at <= this.lastInput ||
      features.length !== 5 ||
      features[0] !== 1 ||
      features.some((v) => !Number.isFinite(v))
    )
      throw new Error("SAMPLE_INVALID_OR_REORDERED");
    this.lastInput = at;
    if (at - this.lastAccepted > 300 || (this.pausedAt !== null && at - this.pausedAt > 300)) this.reset();
    this.pausedAt = null;
    if (this.samples.length >= 5) {
      const limits = [
        0,
        0.018,
        0.018,
        this.mode === "RELATIVE" ? Infinity : 0.09,
        this.mode === "RELATIVE" ? Infinity : 0.09,
      ];
      const outlier = features.some(
        (value, i) => Math.abs(value - median(this.samples.map((s) => s.features[i]))) > limits[i],
      );
      if (outlier) {
        ++this.rejected;
        if (++this.outliers < 3) return this.result("MOVING");
        this.reset();
      } else this.outliers = 0;
    }
    this.samples.push({ target: this.target, features: [...features], at });
    this.lastAccepted = at;
    this.samples = this.samples.filter((s) => at - s.at <= 1400).slice(-30);
    if ((this.mode === "RELATIVE" ? stableMovementSamples : stableSamples)(this.samples))
      return this.result(
        "ACCEPTED",
        this.samples.map((s) => ({ ...s, features: [...s.features] })),
      );
    return this.result(this.samples.length < 5 ? "ACQUIRING" : "COLLECTING");
  }
}
