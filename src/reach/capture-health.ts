import { z } from "zod";
import { reachImmutableSafety } from "./runtime-policy";

const fraction = z.number().finite().min(0).max(1);
const duration = z.number().finite().positive().max(60000);
/** Versioned, device-independent interpretation policy. Accuracy gates are not tunable here. */
export const reachCaptureHealthPolicySchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    windowMs: duration,
    minimumEvidenceMs: duration,
    maximumEvidenceGapMs: duration,
    maximumSamples: z.number().int().min(16).max(10000),
    degradedLossFraction: fraction,
    healthyUsableFraction: fraction,
    recoveryEvidenceMs: duration,
    causeEvidenceFraction: fraction.refine((n) => n > 0),
    lowMeanLuminance: fraction,
    lowLuminanceDeviation: fraction,
    relativeLuminanceFloor: fraction,
    relativeDetailFloor: fraction,
    processingLatencySafetyFraction: fraction.refine((n) => n > 0),
    maximumMainThreadSliceMs: duration,
  })
  .superRefine((p, c) => {
    if (p.minimumEvidenceMs > p.windowMs || p.recoveryEvidenceMs > p.windowMs)
      c.addIssue({ code: "custom", message: "Evidence must fit the rolling window." });
    if (p.maximumEvidenceGapMs > reachImmutableSafety.maximumContinuousCaptureGapMs)
      c.addIssue({ code: "custom", message: "An interruption cannot be counted as continuous evidence." });
    if (p.degradedLossFraction <= 1 - p.healthyUsableFraction)
      c.addIssue({ code: "custom", message: "Healthy and degraded bands must have hysteresis." });
  });
export type ReachCaptureHealthPolicy = z.infer<typeof reachCaptureHealthPolicySchema>;
export const defaultReachCaptureHealthPolicy: Readonly<ReachCaptureHealthPolicy> = Object.freeze({
  schemaVersion: 1,
  windowMs: 6000,
  minimumEvidenceMs: 1200,
  maximumEvidenceGapMs: reachImmutableSafety.maximumContinuousCaptureGapMs,
  maximumSamples: 1800,
  degradedLossFraction: 0.6,
  healthyUsableFraction: 0.8,
  recoveryEvidenceMs: 2000,
  causeEvidenceFraction: 0.5,
  lowMeanLuminance: 0.16,
  lowLuminanceDeviation: 0.035,
  relativeLuminanceFloor: 0.55,
  relativeDetailFloor: 0.45,
  processingLatencySafetyFraction: 0.8,
  maximumMainThreadSliceMs: 32,
});

/** Capacity-limited steady pacing is different from current latency/jank pressure. */
export function captureProcessingPressure(
  pacing: {
    intervalMs: number;
    smoothedTotalMs: number | null;
    smoothedMainThreadMs: number | null;
    smoothedTimerLatenessMs: number | null;
    mainThreadDutyLimit: number;
  },
  timerToleranceMs: number,
  policy: ReachCaptureHealthPolicy = defaultReachCaptureHealthPolicy,
) {
  return (
    (pacing.smoothedTotalMs ?? 0) >=
      reachImmutableSafety.maximumObservationAgeMs * policy.processingLatencySafetyFraction ||
    (pacing.smoothedMainThreadMs ?? 0) > pacing.intervalMs * pacing.mainThreadDutyLimit ||
    (pacing.smoothedMainThreadMs ?? 0) > policy.maximumMainThreadSliceMs ||
    (pacing.smoothedTimerLatenessMs ?? 0) > timerToleranceMs
  );
}

/** Watchglass measurements, not an assertion that a region contains a hand. */
export type CaptureImageSignal = {
  scope: "SUBJECT_REGION" | "WHOLE_FRAME";
  meanLuminance: number;
  luminanceDeviation: number;
  detail: number;
};
export type ReachCaptureEvidence = {
  sourceBinding: string;
  /** Ephemeral exact primary-source binding and processing-mode identity; never uploaded. */
  context: string;
  captureMs: number;
  receivedMs: number;
  accepted: boolean;
  trackingExpected: boolean;
  usablePoint: boolean;
  modelHandPresent: boolean;
  freshImageContinuity: boolean;
  identityConflict: boolean;
  contraryGesture: boolean;
  processingPressure: boolean;
  imageSignal: CaptureImageSignal | null;
};
export type CaptureHealthCause =
  | "STALE_CAPTURE"
  | "REJECTED_OBSERVATION"
  | "PROCESSING_PRESSURE"
  | "IDENTITY_CONFLICT"
  | "MODEL_ACQUISITION_GAP"
  | "LOW_SUBJECT_SIGNAL"
  | "LIGHTING_OR_CONTRAST"
  | "DETAIL_LOSS_OR_MOTION"
  | "UNKNOWN";
export type CaptureHealthDiagnosis = {
  state: "WARMING" | "NO_POINTING_INTENT" | "HEALTHY" | "INTERRUPTED" | "DEGRADED" | "RECOVERING";
  context: string | null;
  sourceBinding: string | null;
  windowStartedMs: number | null;
  lastCaptureMs: number | null;
  evidenceMs: number;
  captureHz: number | null;
  usableFraction: number | null;
  staleFraction: number | null;
  rejectedFraction: number | null;
  conflictFraction: number | null;
  contraryFraction: number | null;
  pressureFraction: number | null;
  measured: CaptureHealthCause[];
  hypotheses: CaptureHealthCause[];
};
type Sample = ReachCaptureEvidence & { fresh: boolean; late: boolean };
const clock = (n: number) => Number.isFinite(n) && n >= 0;
const unit = (n: number) => Number.isFinite(n) && n >= 0 && n <= 1;
const cloneSignal = (signal: CaptureImageSignal | null): CaptureImageSignal | null => {
  if (signal === null) return null;
  if (
    !["SUBJECT_REGION", "WHOLE_FRAME"].includes(signal.scope) ||
    ![signal.meanLuminance, signal.luminanceDeviation, signal.detail].every(unit)
  )
    throw new Error("REACH_CAPTURE_SIGNAL_INVALID");
  return { ...signal };
};

/** Bounded, time-weighted diagnostics. It never authorizes a pointer or mutates calibration. */
export class ReachCaptureHealth {
  private samples: Sample[] = [];
  private context: string | null = null;
  private degraded = false;
  private recoveryStarted: number | null = null;
  private baseline: CaptureImageSignal | null = null;
  private establishedHealthy = false;
  private policy: ReachCaptureHealthPolicy;
  constructor(policy: ReachCaptureHealthPolicy = defaultReachCaptureHealthPolicy) {
    this.policy = reachCaptureHealthPolicySchema.parse(policy);
  }
  reset() {
    this.samples = [];
    this.context = null;
    this.degraded = false;
    this.recoveryStarted = null;
    this.baseline = null;
    this.establishedHealthy = false;
  }
  record(input: ReachCaptureEvidence): CaptureHealthDiagnosis {
    if (
      !input.context ||
      !input.sourceBinding ||
      !clock(input.captureMs) ||
      !clock(input.receivedMs) ||
      input.receivedMs < input.captureMs
    )
      throw new Error("REACH_CAPTURE_EVIDENCE_INVALID");
    const imageSignal = cloneSignal(input.imageSignal);
    if (this.context !== input.context || this.samples.at(-1)?.sourceBinding !== input.sourceBinding) {
      this.reset();
      this.context = input.context;
    }
    const previous = this.samples.at(-1);
    if (previous && (input.captureMs <= previous.captureMs || input.receivedMs < previous.receivedMs))
      throw new Error("REACH_CAPTURE_EVIDENCE_REORDERED");
    const fresh = input.accepted && input.receivedMs - input.captureMs <= reachImmutableSafety.maximumObservationAgeMs;
    if (previous && input.captureMs - previous.captureMs > this.policy.maximumEvidenceGapMs)
      this.recoveryStarted = null;
    if (!fresh || !input.trackingExpected || !input.usablePoint || input.identityConflict || input.contraryGesture)
      this.recoveryStarted = null;
    const sample = {
      ...input,
      imageSignal,
      fresh,
      late: input.receivedMs - input.captureMs > reachImmutableSafety.maximumObservationAgeMs,
    };
    this.samples.push(sample);
    const floor = input.captureMs - this.policy.windowMs;
    // Keep one boundary sample; cap memory independently of the negotiated sensor rate.
    while (this.samples.length > 1 && this.samples[1].captureMs <= floor) this.samples.shift();
    while (this.samples.length > this.policy.maximumSamples) this.samples.shift();
    return this.diagnose(input.receivedMs);
  }
  diagnose(nowMs: number): CaptureHealthDiagnosis {
    if (!clock(nowMs)) throw new Error("REACH_CAPTURE_CLOCK_INVALID");
    const last = this.samples.at(-1);
    if (last && nowMs < last.receivedMs) throw new Error("REACH_CAPTURE_CLOCK_REVERSED");
    const floor = nowMs - this.policy.windowMs;
    let evidence = 0,
      usable = 0,
      stale = 0,
      rejected = 0,
      conflict = 0,
      contrary = 0,
      pressure = 0;
    let acquisition = 0,
      lowSubject = 0,
      lowLight = 0,
      detailLoss = 0;
    let signalWeight = 0,
      meanSignal = 0,
      deviationSignal = 0,
      detailSignal = 0;
    let captureDuration = 0,
      captureUnits = 0;
    for (let i = 0; i + 1 < this.samples.length; ++i) {
      const sample = this.samples[i],
        next = this.samples[i + 1];
      const gap = next.captureMs - sample.captureMs;
      const weight = Math.max(0, Math.min(next.captureMs, nowMs) - Math.max(sample.captureMs, floor));
      captureDuration += weight;
      captureUnits += weight / gap;
      // A missing interval contributes no guessed hand or diagnostic evidence.
      if (!sample.trackingExpected || gap > this.policy.maximumEvidenceGapMs) continue;
      evidence += weight;
      if (sample.fresh && sample.usablePoint && !sample.identityConflict && !sample.contraryGesture) usable += weight;
      if (sample.late) stale += weight;
      if (!sample.accepted && !sample.late) rejected += weight;
      if (sample.identityConflict) conflict += weight;
      if (sample.contraryGesture) contrary += weight;
      if (sample.processingPressure) pressure += weight;
      if (sample.fresh && sample.freshImageContinuity && !sample.modelHandPresent && !sample.identityConflict)
        acquisition += weight;
      const signal = sample.imageSignal;
      if (sample.fresh && signal?.scope === "SUBJECT_REGION") {
        if (sample.usablePoint && !sample.identityConflict && !sample.contraryGesture) {
          signalWeight += weight;
          meanSignal += signal.meanLuminance * weight;
          deviationSignal += signal.luminanceDeviation * weight;
          detailSignal += signal.detail * weight;
        }
        if (
          signal.meanLuminance < this.policy.lowMeanLuminance ||
          signal.luminanceDeviation < this.policy.lowLuminanceDeviation
        )
          lowSubject += weight;
        if (
          signal.meanLuminance < this.policy.lowMeanLuminance ||
          (this.baseline && signal.meanLuminance < this.baseline.meanLuminance * this.policy.relativeLuminanceFloor)
        )
          lowLight += weight;
        if (this.baseline && signal.detail < this.baseline.detail * this.policy.relativeDetailFloor)
          detailLoss += weight;
      }
    }
    const fraction = (n: number) => (evidence > 0 ? n / evidence : null);
    const measured: CaptureHealthCause[] = [],
      hypotheses: CaptureHealthCause[] = [];
    const sufficient = evidence >= this.policy.minimumEvidenceMs;
    const cause = (n: number) => sufficient && n / evidence >= this.policy.causeEvidenceFraction;
    if (cause(stale)) measured.push("STALE_CAPTURE");
    if (cause(rejected)) measured.push("REJECTED_OBSERVATION");
    if (cause(pressure)) measured.push("PROCESSING_PRESSURE");
    if (cause(conflict)) measured.push("IDENTITY_CONFLICT");
    if (cause(acquisition)) measured.push("MODEL_ACQUISITION_GAP");
    if (cause(lowSubject)) measured.push("LOW_SUBJECT_SIGNAL");
    if (cause(lowLight)) hypotheses.push("LIGHTING_OR_CONTRAST");
    if (cause(detailLoss)) hypotheses.push("DETAIL_LOSS_OR_MOTION");
    const currentGood = !!last?.fresh && last.usablePoint && !last.identityConflict && !last.contraryGesture;
    const interrupted = !!last && nowMs - last.captureMs > reachImmutableSafety.maximumObservationAgeMs;
    let state: CaptureHealthDiagnosis["state"] = "WARMING";
    if (last && !last.trackingExpected) {
      state = "NO_POINTING_INTENT";
      this.recoveryStarted = null;
    } else if (interrupted) {
      state = "INTERRUPTED";
    } else if (sufficient) {
      if (usable / evidence <= 1 - this.policy.degradedLossFraction) this.degraded = true;
      if (this.degraded) {
        if (currentGood && usable / evidence >= this.policy.healthyUsableFraction) {
          this.recoveryStarted ??= last!.captureMs;
          if (last!.captureMs - this.recoveryStarted >= this.policy.recoveryEvidenceMs) {
            this.degraded = false;
            this.establishedHealthy = true;
            this.recoveryStarted = null;
            state = "HEALTHY";
          } else state = "RECOVERING";
        } else {
          this.recoveryStarted = null;
          state = "DEGRADED";
        }
      } else {
        if (currentGood && usable / evidence >= this.policy.healthyUsableFraction) this.establishedHealthy = true;
        state = currentGood && this.establishedHealthy ? "HEALTHY" : "INTERRUPTED";
      }
    }
    // Learn light/detail only from sustained accepted subject tracking, never from a dark background or a failed trial.
    if (
      state === "HEALTHY" &&
      usable / evidence >= this.policy.healthyUsableFraction &&
      signalWeight >= this.policy.minimumEvidenceMs &&
      !this.baseline
    )
      this.baseline = {
        scope: "SUBJECT_REGION",
        meanLuminance: meanSignal / signalWeight,
        luminanceDeviation: deviationSignal / signalWeight,
        detail: detailSignal / signalWeight,
      };
    if (state === "DEGRADED" && measured.length === 0 && hypotheses.length === 0) hypotheses.push("UNKNOWN");
    return {
      state,
      context: this.context,
      sourceBinding: last?.sourceBinding ?? null,
      windowStartedMs: this.samples[0]?.captureMs ?? null,
      lastCaptureMs: last?.captureMs ?? null,
      evidenceMs: evidence,
      captureHz: captureDuration > 0 ? (captureUnits * 1000) / captureDuration : null,
      usableFraction: fraction(usable),
      staleFraction: fraction(stale),
      rejectedFraction: fraction(rejected),
      conflictFraction: fraction(conflict),
      contraryFraction: fraction(contrary),
      pressureFraction: fraction(pressure),
      measured,
      hypotheses,
    };
  }
}
