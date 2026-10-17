export const reachTrackingPacingPolicy = {
  maximumFocusedHz: 60,
  maximumUnfocusedHz: 8,
  maximumMainThreadDuty: 0.3,
  maximumProcessingDuty: 0.75,
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
  get diagnostics() {
    return {
      focused: this.focused,
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
    const minimum =
      1000 / (this.focused ? reachTrackingPacingPolicy.maximumFocusedHz : reachTrackingPacingPolicy.maximumUnfocusedHz);
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
