import { z } from "zod";

export const REACH_TELEMETRY_REPORT_VERSION = 1 as const;
export const MAX_REACH_TELEMETRY_BYTES = 32768;
export const MAX_REACH_TELEMETRY_COUNT = 100000;
export const MAX_REACH_TELEMETRY_ACTIVE_MS = 900000;
export const MAX_REACH_TELEMETRY_REVISION_BUCKETS = 128;
export const reachTimingUpperBoundsMs = [
  5, 10, 16.7, 25, 33.4, 50, 66.7, 83.4, 100, 125, 150, 200, 250, 350, 500, 750, 1000, 1500, 2500, 5000, 10000, 30000,
  60000,
] as const;
export const reachRateUpperBoundsHz = [5, 10, 15, 20, 25, 30, 45, 60] as const;
export const reachErrorUpperBounds = [
  0, 0.005, 0.01, 0.015, 0.02, 0.025, 0.03, 0.04, 0.05, 0.075, 0.1, 0.15, 0.25, 0.5, 1,
] as const;
export const reachCorrelationUpperBounds = [-0.5, 0, 0.25, 0.5, 0.65, 0.75, 0.85, 0.9, 0.95, 0.98, 1] as const;
export const reachUncertaintyUpperBoundsPx = [0, 1, 2, 3, 5, 8, 12, 16, 24, 32, 64, 128, 256] as const;
export const reachConfidenceUpperBounds = [0, 0.25, 0.5, 0.6, 0.7, 0.8, 0.85, 0.9, 0.95, 0.98, 1] as const;
const counter = z.number().int().min(0).max(MAX_REACH_TELEMETRY_COUNT);
const duration = z.number().int().min(0).max(MAX_REACH_TELEMETRY_ACTIVE_MS);
export type ReachHistogram = { bins: number[]; missing: number };
const histogramSchema = (bounds: readonly number[], maximum = MAX_REACH_TELEMETRY_COUNT) =>
  z
    .strictObject({
      bins: z.array(z.number().int().min(0).max(maximum)).length(bounds.length + 1),
      missing: z.number().int().min(0).max(maximum),
    })
    .refine((h) => h.bins.reduce((sum, value) => sum + value, h.missing) <= maximum);
const timing = histogramSchema(reachTimingUpperBoundsMs),
  rate = histogramSchema(reachRateUpperBoundsHz),
  error = histogramSchema(reachErrorUpperBounds);
const calibrationSchema = z.strictObject({
  trainingStarted: counter,
  trainingCompleted: counter,
  trainingCancelled: counter,
  trainingInvalidated: counter,
  checkStarted: counter,
  checkPassed: counter,
  checkFailed: counter,
  checkCancelled: counter,
  checkInvalidated: counter,
  trainingTargetsSaved: counter,
  checkTargetsSaved: counter,
  validationRawErrors: error,
  validationJitter: error,
  trainingResiduals: error,
  checkRawP95: error,
  checkJitterP95: error,
  checkMedian: error,
});
export const reachTelemetryReportSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    evidenceSource: z.literal("LIVE_CLIENT_REPORTED"),
    policyRevision: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    activity: z.strictObject({
      activeMs: duration,
      focusedMs: duration,
      calibrationCollectingMs: duration,
      normalMs: duration,
      calibrationMs: duration,
      droppedActivityMs: duration,
    }),
    model: z.strictObject({
      packets: counter,
      accepted: counter,
      late: counter,
      invalid: counter,
      noHand: counter,
      multipleHands: counter,
      postureEligible: counter,
      handCountMissing: counter,
    }),
    image: z.strictObject({ unseeded: counter, tracking: counter, uncertain: counter, lost: counter, stale: counter }),
    readiness: z.strictObject({
      ready: counter,
      acquiring: counter,
      recovering: counter,
      noHand: counter,
      ambiguous: counter,
      framing: counter,
      geometry: counter,
      posture: counter,
      modelWaiting: counter,
      paused: counter,
    }),
    events: z.strictObject({
      pauses: counter,
      recoveries: counter,
      sourceInvalidations: counter,
      trackingInterruptions: counter,
      manualHints: counter,
      cameraStarts: counter,
      cameraStops: counter,
    }),
    timings: z.strictObject({
      modelPacketAgeMs: timing,
      modelResultMs: timing,
      preprocessingMs: timing,
      imageAnalysisMs: timing,
      captureToImageMs: timing,
      frameIntervalMs: timing,
      pauseMs: timing,
      recoveryMs: timing,
      timerLatenessMs: timing,
    }),
    rates: z.strictObject({
      normalAchievedHz: rate,
      calibrationAchievedHz: rate,
      normalCapMs: histogramSchema(reachRateUpperBoundsHz, MAX_REACH_TELEMETRY_ACTIVE_MS),
      calibrationCapMs: histogramSchema(reachRateUpperBoundsHz, MAX_REACH_TELEMETRY_ACTIVE_MS),
    }),
    imageQuality: z.strictObject({
      correlation: histogramSchema(reachCorrelationUpperBounds),
      separation: error,
      uncertaintyPx: histogramSchema(reachUncertaintyUpperBoundsPx),
    }),
    calibration: z.strictObject({ ABSOLUTE: calibrationSchema, RELATIVE: calibrationSchema }),
    confidence: z.strictObject({
      handedness: z
        .strictObject({
          histogram: histogramSchema(reachConfidenceUpperBounds),
          sum: z.number().finite().min(0).max(MAX_REACH_TELEMETRY_COUNT),
          count: counter,
        })
        .refine(
          (value) =>
            value.sum <= value.count && value.histogram.bins.reduce((total, count) => total + count, 0) === value.count,
        ),
    }),
    droppedEvents: counter,
  })
  .superRefine((report, context) => {
    const fail = (message: string) => context.addIssue({ code: "custom", message });
    if (report.model.accepted + report.model.late + report.model.invalid !== report.model.packets)
      fail("MODEL_DENOMINATOR_MISMATCH");
    if (
      report.model.noHand + report.model.multipleHands > report.model.accepted ||
      report.model.postureEligible > report.model.accepted ||
      report.model.handCountMissing < report.model.late + report.model.invalid ||
      report.model.noHand + report.model.multipleHands + report.model.handCountMissing > report.model.packets
    )
      fail("MODEL_SUBSET_MISMATCH");
    if (
      report.activity.focusedMs > report.activity.activeMs ||
      report.activity.calibrationCollectingMs > report.activity.calibrationMs ||
      report.activity.normalMs + report.activity.calibrationMs !== report.activity.activeMs
    )
      fail("ACTIVITY_DENOMINATOR_MISMATCH");
    if (
      histogramCount(report.rates.normalCapMs) !== report.activity.normalMs ||
      histogramCount(report.rates.calibrationCapMs) !== report.activity.calibrationMs
    )
      fail("CAP_TIME_DENOMINATOR_MISMATCH");
  });
export type ReachTelemetryReport = z.infer<typeof reachTelemetryReportSchema>;
export const reachTelemetrySubmissionSchema = z.strictObject({
  idempotencyKey: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),
  reportVersion: z.literal(REACH_TELEMETRY_REPORT_VERSION),
  report: reachTelemetryReportSchema,
});
export type ReachTelemetrySubmission = z.infer<typeof reachTelemetrySubmissionSchema>;
export type ReachTelemetryMode = "ABSOLUTE" | "RELATIVE";
export type ReachTelemetryCadence = "NORMAL" | "CALIBRATION";
export type ReachTelemetryTiming = keyof ReachTelemetryReport["timings"];
export type ReachTelemetryImageState = keyof ReachTelemetryReport["image"];
export type ReachTelemetryReadiness = keyof ReachTelemetryReport["readiness"];
export type ReachTelemetryEvent = keyof ReachTelemetryReport["events"];
export function createReachHistogram(bounds: readonly number[]): ReachHistogram {
  return { bins: Array(bounds.length + 1).fill(0), missing: 0 };
}
export function histogramCount(histogram: ReachHistogram) {
  return histogram.bins.reduce((sum, value) => sum + value, histogram.missing);
}
/** Fixed bins retain no individual measurement, ordering or timestamps. */
export function observeReachHistogram(
  histogram: ReachHistogram,
  bounds: readonly number[],
  value: number | null | undefined,
  weight = 1,
  maximum = MAX_REACH_TELEMETRY_COUNT,
  minimum = 0,
  maximumValue = Infinity,
) {
  if (!Number.isInteger(weight) || weight <= 0 || histogramCount(histogram) + weight > maximum) return false;
  if (value == null || !Number.isFinite(value) || value < minimum || value > maximumValue) histogram.missing += weight;
  else {
    const index = bounds.findIndex((bound) => value <= bound);
    histogram.bins[index < 0 ? bounds.length : index] += weight;
  }
  return true;
}
export function createReachTelemetryReport(policyRevision = 0): ReachTelemetryReport {
  const h = () => createReachHistogram(reachTimingUpperBoundsMs),
    e = () => createReachHistogram(reachErrorUpperBounds);
  const calibration = () => ({
    trainingStarted: 0,
    trainingCompleted: 0,
    trainingCancelled: 0,
    trainingInvalidated: 0,
    checkStarted: 0,
    checkPassed: 0,
    checkFailed: 0,
    checkCancelled: 0,
    checkInvalidated: 0,
    trainingTargetsSaved: 0,
    checkTargetsSaved: 0,
    validationRawErrors: e(),
    validationJitter: e(),
    trainingResiduals: e(),
    checkRawP95: e(),
    checkJitterP95: e(),
    checkMedian: e(),
  });
  return reachTelemetryReportSchema.parse({
    schemaVersion: 1,
    evidenceSource: "LIVE_CLIENT_REPORTED",
    policyRevision,
    activity: {
      activeMs: 0,
      focusedMs: 0,
      calibrationCollectingMs: 0,
      normalMs: 0,
      calibrationMs: 0,
      droppedActivityMs: 0,
    },
    model: {
      packets: 0,
      accepted: 0,
      late: 0,
      invalid: 0,
      noHand: 0,
      multipleHands: 0,
      postureEligible: 0,
      handCountMissing: 0,
    },
    image: { unseeded: 0, tracking: 0, uncertain: 0, lost: 0, stale: 0 },
    readiness: {
      ready: 0,
      acquiring: 0,
      recovering: 0,
      noHand: 0,
      ambiguous: 0,
      framing: 0,
      geometry: 0,
      posture: 0,
      modelWaiting: 0,
      paused: 0,
    },
    events: {
      pauses: 0,
      recoveries: 0,
      sourceInvalidations: 0,
      trackingInterruptions: 0,
      manualHints: 0,
      cameraStarts: 0,
      cameraStops: 0,
    },
    timings: {
      modelPacketAgeMs: h(),
      modelResultMs: h(),
      preprocessingMs: h(),
      imageAnalysisMs: h(),
      captureToImageMs: h(),
      frameIntervalMs: h(),
      pauseMs: h(),
      recoveryMs: h(),
      timerLatenessMs: h(),
    },
    rates: {
      normalAchievedHz: createReachHistogram(reachRateUpperBoundsHz),
      calibrationAchievedHz: createReachHistogram(reachRateUpperBoundsHz),
      normalCapMs: createReachHistogram(reachRateUpperBoundsHz),
      calibrationCapMs: createReachHistogram(reachRateUpperBoundsHz),
    },
    imageQuality: {
      correlation: createReachHistogram(reachCorrelationUpperBounds),
      separation: e(),
      uncertaintyPx: createReachHistogram(reachUncertaintyUpperBoundsPx),
    },
    calibration: { ABSOLUTE: calibration(), RELATIVE: calibration() },
    confidence: { handedness: { histogram: createReachHistogram(reachConfidenceUpperBounds), sum: 0, count: 0 } },
    droppedEvents: 0,
  });
}
export function encodeReachTelemetrySubmission(input: unknown) {
  const submission = reachTelemetrySubmissionSchema.parse(input),
    json = JSON.stringify(submission);
  if (new TextEncoder().encode(json).byteLength > MAX_REACH_TELEMETRY_BYTES)
    throw new Error("REACH_TELEMETRY_SIZE_LIMIT");
  return json;
}
export function parseReachTelemetrySubmissionJson(json: string) {
  if (new TextEncoder().encode(json).byteLength > MAX_REACH_TELEMETRY_BYTES)
    throw new Error("REACH_TELEMETRY_SIZE_LIMIT");
  return reachTelemetrySubmissionSchema.parse(JSON.parse(json));
}
export function projectReachHistogram(histogram: ReachHistogram, bounds: readonly number[]) {
  const observed = histogram.bins.reduce((sum, value) => sum + value, 0);
  const quantile = (q: number) => {
    if (!observed) return null;
    const rank = Math.ceil(observed * q);
    let count = 0;
    for (let index = 0; index < histogram.bins.length; index++) {
      count += histogram.bins[index];
      if (count >= rank)
        return {
          lowerExclusive: index === 0 ? null : bounds[index - 1],
          upperInclusive: index === bounds.length ? null : bounds[index],
          overflow: index === bounds.length,
        };
    }
    return null;
  };
  return {
    bins: [...histogram.bins],
    observed,
    missing: histogram.missing,
    p50: quantile(0.5),
    p95: quantile(0.95),
    p99: quantile(0.99),
  };
}
function safeAggregateSum(left: number, right: number) {
  const next = left + right;
  if (!Number.isFinite(next) || Math.abs(next) > Number.MAX_SAFE_INTEGER)
    throw new Error("REACH_TELEMETRY_AGGREGATE_OVERFLOW");
  return next;
}
function addTree(target: Record<string, unknown>, source: Record<string, unknown>) {
  if (Array.isArray(target.bins) && Array.isArray(source.bins))
    safeAggregateSum(histogramCount(target as ReachHistogram), histogramCount(source as ReachHistogram));
  for (const [key, value] of Object.entries(source)) {
    if (typeof value === "number") target[key] = safeAggregateSum(target[key] as number, value);
    else if (Array.isArray(value)) {
      const destination = target[key] as number[];
      for (let index = 0; index < value.length; index++)
        destination[index] = safeAggregateSum(destination[index], value[index]);
    } else if (value && typeof value === "object")
      addTree(target[key] as Record<string, unknown>, value as Record<string, unknown>);
  }
}
/** A fixed-size numeric reduction retains neither report rows nor individual measurements. */
export function createReachTelemetryAccumulator() {
  const pooled = createReachTelemetryReport();
  let totalReports = 0,
    acceptedReports = 0,
    invalidReports = 0,
    untrackedRevisionReports = 0,
    minimumRevision: number | null = null,
    maximumRevision: number | null = null,
    failed = false,
    failure: unknown = null;
  const revisions = new Map<number, number>();
  function add(input: unknown) {
    if (failed) throw failure;
    try {
      totalReports = safeAggregateSum(totalReports, 1);
      const parsed = reachTelemetryReportSchema.safeParse(input);
      if (!parsed.success) {
        invalidReports = safeAggregateSum(invalidReports, 1);
        return;
      }
      const report = parsed.data;
      acceptedReports = safeAggregateSum(acceptedReports, 1);
      minimumRevision =
        minimumRevision === null ? report.policyRevision : Math.min(minimumRevision, report.policyRevision);
      maximumRevision =
        maximumRevision === null ? report.policyRevision : Math.max(maximumRevision, report.policyRevision);
      if (revisions.has(report.policyRevision) || revisions.size < MAX_REACH_TELEMETRY_REVISION_BUCKETS)
        revisions.set(report.policyRevision, safeAggregateSum(revisions.get(report.policyRevision) ?? 0, 1));
      else untrackedRevisionReports = safeAggregateSum(untrackedRevisionReports, 1);
      const numeric = {
        activity: report.activity,
        model: report.model,
        image: report.image,
        readiness: report.readiness,
        events: report.events,
        timings: report.timings,
        rates: report.rates,
        imageQuality: report.imageQuality,
        calibration: report.calibration,
        confidence: report.confidence,
        droppedEvents: report.droppedEvents,
      };
      addTree(pooled as unknown as Record<string, unknown>, numeric);
    } catch (error) {
      // A failed reduction must never be exposed as a complete global summary.
      failed = true;
      failure = error;
      throw error;
    }
  }
  function finish() {
    if (failed) throw failure;
    return projectReachTelemetrySummary(structuredClone(pooled), {
      totalReports,
      acceptedReports,
      invalidReports,
      policyRevisions: [...revisions]
        .sort(([left], [right]) => left - right)
        .map(([revision, reports]) => ({ revision, reports })),
      policyRevisionCoverage: {
        bucketLimit: MAX_REACH_TELEMETRY_REVISION_BUCKETS,
        retainedRevisionBuckets: revisions.size,
        untrackedRevisionReports,
        minimumRevision,
        maximumRevision,
        complete: untrackedRevisionReports === 0,
      },
    });
  }
  return { add, finish, summary: finish };
}
type ReachTelemetryCoverage = {
  totalReports: number;
  acceptedReports: number;
  invalidReports: number;
  policyRevisions: { revision: number; reports: number }[];
  policyRevisionCoverage: {
    bucketLimit: number;
    retainedRevisionBuckets: number;
    untrackedRevisionReports: number;
    minimumRevision: number | null;
    maximumRevision: number | null;
    complete: boolean;
  };
};
/** Pooled counts produce percentile ranges. Session/report P95 values are never averaged. */
function projectReachTelemetrySummary(pooled: ReachTelemetryReport, coverage: ReachTelemetryCoverage) {
  const ratio = (numerator: number, denominator: number) => ({
    numerator,
    denominator,
    fraction: denominator ? numerator / denominator : null,
  });
  const calibration = (mode: ReachTelemetryMode) => {
    const {
      validationRawErrors,
      validationJitter,
      trainingResiduals,
      checkRawP95,
      checkJitterP95,
      checkMedian,
      ...outcomes
    } = pooled.calibration[mode];
    return {
      outcomes,
      pooledRawValidationErrors: projectReachHistogram(validationRawErrors, reachErrorUpperBounds),
      pooledValidationJitter: projectReachHistogram(validationJitter, reachErrorUpperBounds),
      pooledTrainingResiduals: projectReachHistogram(trainingResiduals, reachErrorUpperBounds),
      perCheckRawP95Distribution: projectReachHistogram(checkRawP95, reachErrorUpperBounds),
      perCheckJitterP95Distribution: projectReachHistogram(checkJitterP95, reachErrorUpperBounds),
      perCheckMedianDistribution: projectReachHistogram(checkMedian, reachErrorUpperBounds),
    };
  };
  return {
    schemaVersion: 1 as const,
    evidenceSource: "LIVE_CLIENT_REPORTED" as const,
    ...coverage,
    totals: {
      activity: pooled.activity,
      model: pooled.model,
      image: pooled.image,
      readiness: pooled.readiness,
      events: pooled.events,
      droppedEvents: pooled.droppedEvents,
    },
    fractions: {
      acceptedModelPackets: ratio(pooled.model.accepted, pooled.model.packets),
      lateModelPackets: ratio(pooled.model.late, pooled.model.packets),
      invalidModelPackets: ratio(pooled.model.invalid, pooled.model.packets),
      postureEligibleAmongAccepted: ratio(pooled.model.postureEligible, pooled.model.accepted),
      acceptedHandCountCoverage: ratio(pooled.model.packets - pooled.model.handCountMissing, pooled.model.accepted),
    },
    timings: Object.fromEntries(
      Object.entries(pooled.timings).map(([key, histogram]) => [
        key,
        projectReachHistogram(histogram, reachTimingUpperBoundsMs),
      ]),
    ),
    rates: {
      normalAchievedHz: projectReachHistogram(pooled.rates.normalAchievedHz, reachRateUpperBoundsHz),
      calibrationAchievedHz: projectReachHistogram(pooled.rates.calibrationAchievedHz, reachRateUpperBoundsHz),
      normalCapTimeMs: projectReachHistogram(pooled.rates.normalCapMs, reachRateUpperBoundsHz),
      calibrationCapTimeMs: projectReachHistogram(pooled.rates.calibrationCapMs, reachRateUpperBoundsHz),
    },
    achievedCoupledFrequency: {
      normal: {
        packets: histogramCount(pooled.rates.normalAchievedHz),
        activeMs: pooled.activity.normalMs,
        hz: pooled.activity.normalMs
          ? (histogramCount(pooled.rates.normalAchievedHz) * 1000) / pooled.activity.normalMs
          : null,
      },
      calibration: {
        packets: histogramCount(pooled.rates.calibrationAchievedHz),
        activeMs: pooled.activity.calibrationMs,
        hz: pooled.activity.calibrationMs
          ? (histogramCount(pooled.rates.calibrationAchievedHz) * 1000) / pooled.activity.calibrationMs
          : null,
      },
      interpretation:
        "Capture/model dispatch share one-frame-in-flight backpressure. These are reported coupled pipeline frequencies, not independently measured camera-sensor FPS.",
    },
    confidence: {
      handedness: {
        ...projectReachHistogram(pooled.confidence.handedness.histogram, reachConfidenceUpperBounds),
        sum: pooled.confidence.handedness.sum,
        count: pooled.confidence.handedness.count,
        average: pooled.confidence.handedness.count
          ? pooled.confidence.handedness.sum / pooled.confidence.handedness.count
          : null,
        interpretation:
          "MediaPipe handedness classification confidence; not hand-presence, tracking or pointing confidence.",
      },
      postureScore: { available: false, reason: "NO_NUMERIC_POSTURE_SCORE" },
    },
    imageQuality: {
      correlation: projectReachHistogram(pooled.imageQuality.correlation, reachCorrelationUpperBounds),
      separation: projectReachHistogram(pooled.imageQuality.separation, reachErrorUpperBounds),
      uncertaintyPx: projectReachHistogram(pooled.imageQuality.uncertaintyPx, reachUncertaintyUpperBoundsPx),
    },
    calibration: { ABSOLUTE: calibration("ABSOLUTE"), RELATIVE: calibration("RELATIVE") },
    denominators:
      "Reports are windows, not sessions or distinct people. State counts are observations, not time proportions. Timing percentiles pool fixed bins; per-check P95 distributions are separately labeled. Missing values and dropped events remain explicit.",
    physicalQualification: false as const,
    modelPathExperimentsIncluded: false as const,
  };
}
export type ReachTelemetrySummary = ReturnType<typeof projectReachTelemetrySummary>;
/** Convenience wrapper; the streaming API avoids retaining a complete input array. */
export function summarizeReachTelemetry(inputs: readonly unknown[]) {
  const accumulator = createReachTelemetryAccumulator();
  for (const input of inputs) accumulator.add(input);
  return accumulator.finish();
}
/** Reporting windows do not identify accounts, sessions or distinct people. */
export function projectReachTelemetryRows(rows: readonly { report: unknown }[]) {
  const accumulator = createReachTelemetryAccumulator();
  for (const row of rows) accumulator.add(row.report);
  return {
    ...accumulator.finish(),
    distinctPeople: null,
    distinctReportingSessions: null,
  };
}
