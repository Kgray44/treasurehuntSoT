import { defaultReachRuntimePolicy, reachRuntimePolicySchema, type ReachRuntimePolicy } from "./runtime-policy";

export type ReachTrackingLimits = Pick<
  ReachRuntimePolicy,
  "normalMaximumHz" | "calibrationMaximumHz" | "unfocusedMaximumHz" | "modelMaximumHz"
>;
export const defaultReachTrackingLimits: Readonly<ReachTrackingLimits> = Object.freeze({
  normalMaximumHz: defaultReachRuntimePolicy.normalMaximumHz,
  calibrationMaximumHz: defaultReachRuntimePolicy.calibrationMaximumHz,
  unfocusedMaximumHz: defaultReachRuntimePolicy.unfocusedMaximumHz,
  modelMaximumHz: defaultReachRuntimePolicy.modelMaximumHz,
});
export function parseReachTrackingLimits(input: ReachTrackingLimits): ReachTrackingLimits {
  const keys = Object.keys(defaultReachTrackingLimits);
  if (
    !input ||
    typeof input !== "object" ||
    Object.keys(input).length !== keys.length ||
    Object.keys(input).some((key) => !keys.includes(key))
  )
    throw new Error("REACH_TRACKING_LIMITS_INVALID");
  const parsed = reachRuntimePolicySchema.safeParse({ ...defaultReachRuntimePolicy, ...input });
  if (!parsed.success) throw new Error("REACH_TRACKING_LIMITS_INVALID");
  return {
    normalMaximumHz: parsed.data.normalMaximumHz,
    calibrationMaximumHz: parsed.data.calibrationMaximumHz,
    unfocusedMaximumHz: parsed.data.unfocusedMaximumHz,
    modelMaximumHz: parsed.data.modelMaximumHz,
  };
}
export const reachTrackingPacingPolicy = {
  maximumFocusedHz: defaultReachTrackingLimits.normalMaximumHz,
  maximumCalibrationHz: defaultReachTrackingLimits.calibrationMaximumHz,
  maximumUnfocusedHz: defaultReachTrackingLimits.unfocusedMaximumHz,
  maximumModelHz: defaultReachTrackingLimits.modelMaximumHz,
  maximumMainThreadDuty: 0.3,
  // One inference in flight already bounds worker work. Elapsed worker time
  // includes scheduler waits under load and must not add a second idle budget.
  maximumProcessingDuty: 1,
  maximumRecoveryFraction: 0.1,
  timerToleranceMs: 2,
} as const;
const smooth = (previous: number | null, sample: number) =>
  previous === null ? sample : previous + (sample - previous) * (sample > previous ? 0.6 : 0.15);
const validClock = (value: number) => Number.isFinite(value) && value >= 0;

/**
 * Constant-space timing feedback for the runtime's one-in-flight capture loop.
 * Main-thread duty is measured CV time, not a claim about whole-system CPU use.
 * Hidden-page camera shutdown remains the runtime's lifecycle responsibility.
 */
export class ReachTrackingPacer {
  private focused = true;
  private calibrationCollecting = false;
  private limits: ReachTrackingLimits = { ...defaultReachTrackingLimits };
  private interval = 1000 / reachTrackingPacingPolicy.maximumFocusedHz;
  private totalMs: number | null = null;
  private mainMs: number | null = null;
  private lateMs: number | null = null;
  private lastTotal = 0;
  private lastMain = 0;
  private lastLateness = 0;
  private lastCompletedCapture = -Infinity;
  private lastCompletedTime = -Infinity;

  get intervalMs() {
    return this.interval;
  }
  get targetHz() {
    return 1000 / this.interval;
  }
  get phaseCaptureMaximumHz() {
    return !this.focused
      ? this.limits.unfocusedMaximumHz
      : this.calibrationCollecting
        ? this.limits.calibrationMaximumHz
        : this.limits.normalMaximumHz;
  }
  get modelMaximumHz() {
    return this.limits.modelMaximumHz;
  }
  get maximumHz() {
    return Math.min(this.phaseCaptureMaximumHz, this.modelMaximumHz);
  }
  get diagnostics() {
    return {
      focused: this.focused,
      calibrationCollecting: this.calibrationCollecting,
      maximumHz: this.maximumHz,
      phaseCaptureMaximumHz: this.phaseCaptureMaximumHz,
      modelMaximumHz: this.modelMaximumHz,
      targetHz: this.targetHz,
      intervalMs: this.interval,
      smoothedTotalMs: this.totalMs,
      smoothedMainThreadMs: this.mainMs,
      smoothedTimerLatenessMs: this.lateMs,
      mainThreadDutyLimit: reachTrackingPacingPolicy.maximumMainThreadDuty,
      processingDutyLimit: reachTrackingPacingPolicy.maximumProcessingDuty,
    };
  }
  private target(total: number, main: number, late: number, lastTotal: number, lastMain: number, lastLate: number) {
    const minimum = 1000 / this.maximumHz;
    const target = Math.max(
      minimum,
      total / reachTrackingPacingPolicy.maximumProcessingDuty,
      lastTotal / reachTrackingPacingPolicy.maximumProcessingDuty,
      main / reachTrackingPacingPolicy.maximumMainThreadDuty,
      lastMain / reachTrackingPacingPolicy.maximumMainThreadDuty,
      minimum + Math.max(0, Math.max(late, lastLate) - reachTrackingPacingPolicy.timerToleranceMs) * 2,
    );
    if (!Number.isFinite(target)) throw new Error("REACH_PACER_DURATION_INVALID");
    return target;
  }
  setFocused(focused: boolean) {
    this.focused = focused;
    // Losing focus reduces work immediately. Returning focus waits for measured
    // completions before cautiously increasing the capture rate again.
    this.interval = Math.max(
      this.interval,
      this.target(
        this.totalMs ?? 0,
        this.mainMs ?? 0,
        this.lateMs ?? 0,
        this.lastTotal,
        this.lastMain,
        this.lastLateness,
      ),
    );
  }
  /** Only active calibration collection may use the higher foreground ceiling. */
  setCalibrationCollecting(collecting: boolean) {
    if (this.calibrationCollecting === collecting) return;
    this.calibrationCollecting = collecting;
    const target = this.target(
      this.totalMs ?? 0,
      this.mainMs ?? 0,
      this.lateMs ?? 0,
      this.lastTotal,
      this.lastMain,
      this.lastLateness,
    );
    // Before any timing evidence exists this sets the initial mode ceiling.
    // Later increases retain the same bounded, measured recovery as focus.
    this.interval = this.totalMs === null && this.lateMs === null ? target : Math.max(this.interval, target);
  }
  /** Administrative ceilings never alter pressure budgets or timing evidence. */
  setTrackingLimits(limits: ReachTrackingLimits) {
    this.limits = parseReachTrackingLimits(limits);
    const target = this.target(
      this.totalMs ?? 0,
      this.mainMs ?? 0,
      this.lateMs ?? 0,
      this.lastTotal,
      this.lastMain,
      this.lastLateness,
    );
    this.interval = this.totalMs === null && this.lateMs === null ? target : Math.max(this.interval, target);
  }
  nextDelay(now: number, lastCapture: number): number {
    if (!validClock(now) || (lastCapture !== -Infinity && (!validClock(lastCapture) || lastCapture > now)))
      throw new Error("REACH_PACER_CLOCK_INVALID");
    if (lastCapture === -Infinity) return 0;
    return Math.ceil(Math.max(0, this.interval - (now - lastCapture)));
  }
  recordCompleted(capture: number, completed: number, mainThreadCostMs: number) {
    if (
      !validClock(capture) ||
      !validClock(completed) ||
      completed < capture ||
      capture <= this.lastCompletedCapture ||
      capture < this.lastCompletedTime ||
      completed < this.lastCompletedTime ||
      !validClock(mainThreadCostMs) ||
      mainThreadCostMs > completed - capture
    )
      throw new Error("REACH_PACER_CLOCK_INVALID");
    const elapsed = completed - capture;
    const total = smooth(this.totalMs, elapsed);
    const main = smooth(this.mainMs, mainThreadCostMs);
    const target = this.target(total, main, this.lateMs ?? 0, elapsed, mainThreadCostMs, this.lastLateness);
    this.interval = Math.max(target, this.interval * (1 - reachTrackingPacingPolicy.maximumRecoveryFraction));
    this.totalMs = total;
    this.mainMs = main;
    this.lastTotal = elapsed;
    this.lastMain = mainThreadCostMs;
    this.lastCompletedCapture = capture;
    this.lastCompletedTime = completed;
  }
  recordTimerLateness(expected: number, actual: number) {
    if (!validClock(expected) || !validClock(actual)) throw new Error("REACH_PACER_CLOCK_INVALID");
    const lateness = Math.max(0, actual - expected);
    const smoothed = smooth(this.lateMs, lateness);
    const target = this.target(this.totalMs ?? 0, this.mainMs ?? 0, smoothed, this.lastTotal, this.lastMain, lateness);
    this.interval = Math.max(this.interval, target);
    this.lateMs = smoothed;
    this.lastLateness = lateness;
  }
}
