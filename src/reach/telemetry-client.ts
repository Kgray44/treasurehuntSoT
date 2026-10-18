import {
  createReachTelemetryReport,
  encodeReachTelemetrySubmission,
  histogramCount,
  MAX_REACH_TELEMETRY_ACTIVE_MS,
  MAX_REACH_TELEMETRY_COUNT,
  observeReachHistogram,
  reachCorrelationUpperBounds,
  reachErrorUpperBounds,
  reachRateUpperBoundsHz,
  REACH_TELEMETRY_REPORT_VERSION,
  reachConfidenceUpperBounds,
  reachTelemetryReportSchema,
  reachTelemetrySubmissionSchema,
  reachTimingUpperBoundsMs,
  reachUncertaintyUpperBoundsPx,
  type ReachTelemetryCadence,
  type ReachTelemetryEvent,
  type ReachTelemetryImageState,
  type ReachTelemetryMode,
  type ReachTelemetryReadiness,
  type ReachTelemetryReport,
  type ReachTelemetrySubmission,
  type ReachTelemetryTiming,
} from "./telemetry";

export type ReachTelemetryPolicy = { featureEnabled: boolean; telemetryEnabled: boolean; revision: number };
export type ReachTelemetryTransport = (
  submission: ReachTelemetrySubmission,
  signal: AbortSignal,
) => Promise<{ ok: boolean }>;
export type ReachTelemetryFlushResult = "DISABLED" | "EMPTY" | "IN_FLIGHT" | "UPLOADED" | "RETRY_PENDING";
export const REACH_TELEMETRY_UPLOAD_TIMEOUT_MS = 5000;
export type ReachTelemetryModelPacket = {
  disposition: "ACCEPTED" | "LATE" | "INVALID";
  packetAgeMs?: number | null;
  modelResultMs?: number | null;
  preprocessingMs?: number | null;
  frameIntervalMs?: number | null;
  handCount?: number | null;
  postureEligible?: boolean;
  cadence?: ReachTelemetryCadence;
};
export function createReachTelemetryFetchTransport(endpoint = "/api/reach/telemetry"): ReachTelemetryTransport {
  if (!/^\/api\/[a-zA-Z0-9/_-]+$/.test(endpoint)) throw new Error("REACH_TELEMETRY_SAME_ORIGIN_REQUIRED");
  return async (submission, signal) => {
    const response = await fetch(endpoint, {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      redirect: "error",
      headers: { "Content-Type": "application/json" },
      body: encodeReachTelemetrySubmission(submission),
      signal,
    });
    return { ok: response.ok };
  };
}
/** Automatic numeric aggregates have no persistent client/session ID or raw observation buffer. */
export class ReachTelemetryCollector {
  private policy: ReachTelemetryPolicy;
  private disposed = false;
  private report: ReachTelemetryReport;
  private dirty = false;
  private pending: ReachTelemetrySubmission | null = null;
  private inFlight: AbortController | null = null;
  private generation = 0;
  private readonly transport: ReachTelemetryTransport;
  private readonly makeId: () => string;
  constructor(options: { policy: ReachTelemetryPolicy; transport?: ReachTelemetryTransport; makeId?: () => string }) {
    this.policy = {
      featureEnabled: options.policy.featureEnabled === true,
      telemetryEnabled: options.policy.telemetryEnabled === true,
      revision: options.policy.revision,
    };
    this.report = createReachTelemetryReport(options.policy.revision);
    this.transport = options.transport ?? createReachTelemetryFetchTransport();
    this.makeId = options.makeId ?? (() => crypto.randomUUID());
  }
  get enabled() {
    return !this.disposed && this.policy.featureEnabled && this.policy.telemetryEnabled;
  }
  get hasPendingUpload() {
    return this.pending !== null;
  }
  get shouldFlush() {
    return (
      this.enabled &&
      (this.pending !== null || this.report.activity.activeMs >= 60000 || this.report.model.packets >= 5000)
    );
  }
  private reset() {
    this.generation++;
    this.inFlight?.abort();
    this.pending = null;
    this.report = createReachTelemetryReport(this.policy.revision);
    this.dirty = false;
  }
  /** Policy changes discard the old local window rather than mixing revisions. */
  setPolicy(policy: ReachTelemetryPolicy) {
    if (
      policy.revision !== this.policy.revision ||
      policy.featureEnabled !== this.policy.featureEnabled ||
      policy.telemetryEnabled !== this.policy.telemetryEnabled
    ) {
      this.policy = {
        featureEnabled: policy.featureEnabled === true,
        telemetryEnabled: policy.telemetryEnabled === true,
        revision: policy.revision,
      };
      this.reset();
    }
  }
  dispose() {
    this.disposed = true;
    this.reset();
  }
  snapshot() {
    return reachTelemetryReportSchema.parse(this.report);
  }
  private dropped(count = 1) {
    this.report.droppedEvents = Math.min(MAX_REACH_TELEMETRY_COUNT, this.report.droppedEvents + count);
    this.dirty = true;
  }
  private increment(target: Record<string, number>, key: string) {
    if (!Object.hasOwn(target, key) || target[key] >= MAX_REACH_TELEMETRY_COUNT) {
      this.dropped();
      return false;
    }
    target[key]++;
    this.dirty = true;
    return true;
  }
  recordActivity(
    deltaMs: number,
    context: { focused: boolean; collecting: boolean; cadence: ReachTelemetryCadence; capHz?: number | null },
  ) {
    if (
      !this.enabled ||
      !Number.isFinite(deltaMs) ||
      deltaMs < 0 ||
      !["NORMAL", "CALIBRATION"].includes(context.cadence)
    )
      return false;
    const requested = Math.floor(deltaMs),
      accepted = Math.min(requested, MAX_REACH_TELEMETRY_ACTIVE_MS - this.report.activity.activeMs);
    this.report.activity.droppedActivityMs = Math.min(
      MAX_REACH_TELEMETRY_ACTIVE_MS,
      this.report.activity.droppedActivityMs + requested - accepted,
    );
    if (!accepted) {
      if (requested) this.dropped();
      return false;
    }
    const calibration = context.cadence === "CALIBRATION";
    this.report.activity.activeMs += accepted;
    if (context.focused) this.report.activity.focusedMs += accepted;
    if (calibration && context.collecting) this.report.activity.calibrationCollectingMs += accepted;
    this.report.activity[calibration ? "calibrationMs" : "normalMs"] += accepted;
    observeReachHistogram(
      this.report.rates[calibration ? "calibrationCapMs" : "normalCapMs"],
      reachRateUpperBoundsHz,
      context.capHz,
      accepted,
      MAX_REACH_TELEMETRY_ACTIVE_MS,
      0,
      60,
    );
    this.dirty = true;
    return true;
  }
  recordTiming(metric: ReachTelemetryTiming, milliseconds: number | null | undefined) {
    if (!this.enabled || !Object.hasOwn(this.report.timings, metric)) return false;
    if (
      !observeReachHistogram(
        this.report.timings[metric],
        reachTimingUpperBoundsMs,
        milliseconds,
        1,
        MAX_REACH_TELEMETRY_COUNT,
        0,
        MAX_REACH_TELEMETRY_ACTIVE_MS,
      )
    ) {
      this.dropped();
      return false;
    }
    this.dirty = true;
    return true;
  }
  recordModelPacket(packet: ReachTelemetryModelPacket) {
    if (!this.enabled || !["ACCEPTED", "LATE", "INVALID"].includes(packet.disposition)) return false;
    if (this.report.model.packets >= MAX_REACH_TELEMETRY_COUNT) {
      this.dropped();
      return false;
    }
    const disposition =
      packet.disposition === "INVALID"
        ? "invalid"
        : typeof packet.packetAgeMs === "number" && packet.packetAgeMs > 150
          ? "late"
          : packet.disposition === "LATE"
            ? "late"
            : "accepted";
    this.report.model.packets++;
    this.report.model[disposition]++;
    const countKnown =
      disposition === "accepted" && (packet.handCount === 0 || packet.handCount === 1 || packet.handCount === 2);
    if (!countKnown) this.report.model.handCountMissing++;
    if (countKnown && packet.handCount === 0) this.report.model.noHand++;
    if (countKnown && packet.handCount === 2) this.report.model.multipleHands++;
    if (disposition === "accepted" && packet.postureEligible && packet.handCount === 1)
      this.report.model.postureEligible++;
    this.recordTiming("modelPacketAgeMs", packet.packetAgeMs);
    this.recordTiming("modelResultMs", packet.modelResultMs);
    this.recordTiming("preprocessingMs", packet.preprocessingMs);
    this.recordTiming("frameIntervalMs", packet.frameIntervalMs);
    const cadence = packet.cadence ?? "NORMAL",
      histogram = this.report.rates[cadence === "CALIBRATION" ? "calibrationAchievedHz" : "normalAchievedHz"];
    const hz =
      typeof packet.frameIntervalMs === "number" && packet.frameIntervalMs > 0 ? 1000 / packet.frameIntervalMs : null;
    if (!observeReachHistogram(histogram, reachRateUpperBoundsHz, hz)) this.dropped();
    this.dirty = true;
    return true;
  }
  recordImageState(
    state: ReachTelemetryImageState,
    quality: { correlation?: number | null; separation?: number | null; uncertaintyPx?: number | null } = {},
  ) {
    if (!this.enabled || !Object.hasOwn(this.report.image, state)) return false;
    if (!this.increment(this.report.image, state)) return false;
    const values = this.report.imageQuality;
    if (
      !observeReachHistogram(
        values.correlation,
        reachCorrelationUpperBounds,
        quality.correlation,
        1,
        MAX_REACH_TELEMETRY_COUNT,
        -1,
        1,
      )
    )
      this.dropped();
    if (
      !observeReachHistogram(
        values.separation,
        reachErrorUpperBounds,
        quality.separation,
        1,
        MAX_REACH_TELEMETRY_COUNT,
        0,
        4,
      )
    )
      this.dropped();
    if (
      !observeReachHistogram(
        values.uncertaintyPx,
        reachUncertaintyUpperBoundsPx,
        quality.uncertaintyPx,
        1,
        MAX_REACH_TELEMETRY_COUNT,
        0,
        10000,
      )
    )
      this.dropped();
    return true;
  }
  recordReadiness(state: ReachTelemetryReadiness) {
    return this.enabled && this.increment(this.report.readiness, state);
  }
  recordHandednessConfidence(value: number | null | undefined) {
    if (!this.enabled) return false;
    const target = this.report.confidence.handedness;
    if (
      !observeReachHistogram(target.histogram, reachConfidenceUpperBounds, value, 1, MAX_REACH_TELEMETRY_COUNT, 0, 1)
    ) {
      this.dropped();
      return false;
    }
    if (typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1) {
      target.sum += value;
      target.count++;
    }
    this.dirty = true;
    return true;
  }
  recordEvent(event: ReachTelemetryEvent) {
    return this.enabled && this.increment(this.report.events, event);
  }
  recordCalibrationTarget(mode: ReachTelemetryMode, phase: "TRAINING" | "CHECK") {
    if (!this.enabled || !Object.hasOwn(this.report.calibration, mode)) return false;
    return this.increment(
      this.report.calibration[mode] as unknown as Record<string, number>,
      phase === "TRAINING" ? "trainingTargetsSaved" : "checkTargetsSaved",
    );
  }
  recordCalibration(
    mode: ReachTelemetryMode,
    phase: "TRAINING" | "CHECK",
    outcome: "STARTED" | "COMPLETED" | "PASSED" | "FAILED" | "CANCELLED" | "INVALIDATED",
    metrics: { rawP95?: number | null; jitterP95?: number | null; median?: number | null } = {},
  ) {
    if (!this.enabled || !Object.hasOwn(this.report.calibration, mode)) return false;
    const training = {
      STARTED: "trainingStarted",
      COMPLETED: "trainingCompleted",
      CANCELLED: "trainingCancelled",
      INVALIDATED: "trainingInvalidated",
    } as const;
    const check = {
      STARTED: "checkStarted",
      PASSED: "checkPassed",
      FAILED: "checkFailed",
      CANCELLED: "checkCancelled",
      INVALIDATED: "checkInvalidated",
    } as const;
    const key =
      phase === "TRAINING" ? training[outcome as keyof typeof training] : check[outcome as keyof typeof check];
    if (!key) return false;
    const target = this.report.calibration[mode];
    if (!this.increment(target as unknown as Record<string, number>, key)) return false;
    if (phase === "CHECK" && ["PASSED", "FAILED"].includes(outcome)) {
      for (const [histogram, value] of [
        [target.checkRawP95, metrics.rawP95],
        [target.checkJitterP95, metrics.jitterP95],
        [target.checkMedian, metrics.median],
      ] as const)
        if (!observeReachHistogram(histogram, reachErrorUpperBounds, value, 1, MAX_REACH_TELEMETRY_COUNT, 0, 4))
          this.dropped();
    }
    return true;
  }
  /** Local residual scalars are immediately binned; arrays are never retained or uploaded. */
  recordValidationSamples(
    mode: ReachTelemetryMode,
    kind: "RAW" | "JITTER" | "TRAINING",
    values: readonly (number | null | undefined)[],
  ) {
    if (!this.enabled || !Object.hasOwn(this.report.calibration, mode) || !Array.isArray(values)) return false;
    const target = this.report.calibration[mode],
      histogram =
        kind === "RAW"
          ? target.validationRawErrors
          : kind === "JITTER"
            ? target.validationJitter
            : target.trainingResiduals;
    const maximum = Math.min(values.length, MAX_REACH_TELEMETRY_COUNT - histogramCount(histogram));
    for (let index = 0; index < maximum; index++)
      observeReachHistogram(histogram, reachErrorUpperBounds, values[index], 1, MAX_REACH_TELEMETRY_COUNT, 0, 4);
    if (values.length > maximum) this.dropped(values.length - maximum);
    this.dirty ||= maximum > 0;
    return maximum > 0;
  }
  /** At most one sealed retry plus one accumulating bounded window exists. */
  async flush(): Promise<ReachTelemetryFlushResult> {
    if (!this.enabled) return "DISABLED";
    if (this.inFlight) return "IN_FLIGHT";
    if (!this.pending) {
      if (!this.dirty) return "EMPTY";
      try {
        this.pending = reachTelemetrySubmissionSchema.parse({
          idempotencyKey: this.makeId(),
          reportVersion: REACH_TELEMETRY_REPORT_VERSION,
          report: this.report,
        });
        encodeReachTelemetrySubmission(this.pending);
      } catch {
        return "RETRY_PENDING";
      }
      this.report = createReachTelemetryReport(this.policy.revision);
      this.dirty = false;
    }
    const pending = this.pending,
      generation = this.generation,
      controller = new AbortController();
    this.inFlight = controller;
    const timeout = setTimeout(() => controller.abort(), REACH_TELEMETRY_UPLOAD_TIMEOUT_MS);
    let onAbort = () => {};
    try {
      const aborted = new Promise<{ ok: boolean }>((_resolve, reject) => {
        onAbort = () => reject(new Error("REACH_TELEMETRY_UPLOAD_ABORTED"));
        controller.signal.addEventListener("abort", onAbort, { once: true });
      });
      const result = await Promise.race([
        this.transport(reachTelemetrySubmissionSchema.parse(pending), controller.signal),
        aborted,
      ]);
      if (!this.enabled || generation !== this.generation) return "DISABLED";
      if (!result.ok) return "RETRY_PENDING";
      if (this.pending === pending) this.pending = null;
      return "UPLOADED";
    } catch {
      return !this.enabled || generation !== this.generation ? "DISABLED" : "RETRY_PENDING";
    } finally {
      clearTimeout(timeout);
      controller.signal.removeEventListener("abort", onAbort);
      if (this.inFlight === controller) this.inFlight = null;
    }
  }
}
