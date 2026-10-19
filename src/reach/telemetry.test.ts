// @sounding-line-registration owner=reach suite=unit.reach contracts=reach.phase1.foundation
import { describe, expect, it } from "vitest";
import {
  createReachTelemetryReport,
  createReachTelemetryAccumulator,
  encodeReachTelemetrySubmission,
  histogramCount,
  MAX_REACH_TELEMETRY_BYTES,
  MAX_REACH_TELEMETRY_REVISION_BUCKETS,
  observeReachHistogram,
  parseReachTelemetrySubmissionJson,
  projectReachTelemetryRows,
  reachErrorUpperBounds,
  reachConfidenceUpperBounds,
  reachTelemetryReportSchema,
  reachTelemetrySubmissionSchema,
  reachTimingUpperBoundsMs,
  summarizeReachTelemetry,
} from "./telemetry";

const submission = () => ({
  idempotencyKey: "00000000-0000-4000-8000-000000000001",
  reportVersion: 1 as const,
  report: createReachTelemetryReport(1),
});
describe("strict aggregate-only Reach telemetry", () => {
  it("streams more than10000 reports with exact pooled counts, frequencies, confidence and percentile bins", () => {
    const report = createReachTelemetryReport(7);
    report.model = {
      packets: 10,
      accepted: 8,
      late: 2,
      invalid: 0,
      noHand: 1,
      multipleHands: 1,
      postureEligible: 5,
      handCountMissing: 2,
    };
    report.activity.activeMs = report.activity.normalMs = report.activity.focusedMs = 100;
    report.rates.normalCapMs.bins[2] = 100;
    report.rates.normalAchievedHz.bins[1] = 10;
    observeReachHistogram(report.timings.modelResultMs, reachTimingUpperBoundsMs, 110);
    observeReachHistogram(report.confidence.handedness.histogram, reachConfidenceUpperBounds, 0.8);
    report.confidence.handedness.sum = 0.8;
    report.confidence.handedness.count = 1;
    observeReachHistogram(report.calibration.RELATIVE.validationRawErrors, reachErrorUpperBounds, 0.01);
    observeReachHistogram(report.calibration.RELATIVE.validationRawErrors, reachErrorUpperBounds, 0.05);
    const rows = Array<unknown>(10001).fill(report);
    const accumulator = createReachTelemetryAccumulator();
    // Simulated keyset pages retain only the fixed reduction state between pages.
    for (let start = 0; start < rows.length; start += 1000)
      for (const input of rows.slice(start, start + 1000)) accumulator.add(input);
    const streamed = accumulator.finish();
    expect(streamed).toEqual(summarizeReachTelemetry(rows));
    expect(streamed).toMatchObject({
      totalReports: 10001,
      acceptedReports: 10001,
      invalidReports: 0,
      totals: { model: { packets: 100010, accepted: 80008, late: 20002 }, activity: { activeMs: 1000100 } },
      policyRevisions: [{ revision: 7, reports: 10001 }],
      policyRevisionCoverage: { complete: true, untrackedRevisionReports: 0 },
    });
    expect(streamed.confidence.handedness.average).toBeCloseTo(0.8);
    expect(streamed.timings.modelResultMs.observed).toBe(10001);
    expect(streamed.calibration.RELATIVE.pooledRawValidationErrors.p95?.upperInclusive).toBe(0.05);
    expect(streamed.achievedCoupledFrequency.normal.hz).toBe(100);
  }, 15000);
  it("produces the identical complete reduction from one page or many pages and retains no report references", () => {
    const reports = Array.from({ length: 23 }, (_, index) => {
      const report = createReachTelemetryReport(index % 3);
      report.image.tracking = index;
      return report;
    });
    const inputs = [...reports, { unsupported: true }];
    const accumulator = createReachTelemetryAccumulator();
    for (let start = 0; start < inputs.length; start += 3)
      for (const report of inputs.slice(start, start + 3)) accumulator.add(report);
    const result = accumulator.finish();
    expect(result).toEqual(summarizeReachTelemetry(inputs));
    expect(result).toMatchObject({ totalReports: 24, acceptedReports: 23, invalidReports: 1 });
    reports[0].image.tracking = 999;
    result.totals.image.tracking = 999;
    expect(accumulator.finish().totals.image.tracking).toBe(253);
    accumulator.add(createReachTelemetryReport());
    expect(accumulator.summary().acceptedReports).toBe(24);
    expect(result.acceptedReports).toBe(23);
  });
  it("bounds revision metadata while retaining every report in numeric totals with explicit revision coverage", () => {
    const accumulator = createReachTelemetryAccumulator();
    for (let revision = 0; revision < MAX_REACH_TELEMETRY_REVISION_BUCKETS + 3; revision++) {
      const report = createReachTelemetryReport(revision);
      report.events.cameraStarts = 1;
      accumulator.add(report);
    }
    accumulator.add(createReachTelemetryReport(Number.MAX_SAFE_INTEGER));
    const result = accumulator.finish();
    expect(result.policyRevisions).toHaveLength(MAX_REACH_TELEMETRY_REVISION_BUCKETS);
    expect(result.acceptedReports).toBe(MAX_REACH_TELEMETRY_REVISION_BUCKETS + 4);
    expect(result.totals.events.cameraStarts).toBe(MAX_REACH_TELEMETRY_REVISION_BUCKETS + 3);
    expect(result.policyRevisionCoverage).toEqual({
      bucketLimit: MAX_REACH_TELEMETRY_REVISION_BUCKETS,
      retainedRevisionBuckets: MAX_REACH_TELEMETRY_REVISION_BUCKETS,
      untrackedRevisionReports: 4,
      minimumRevision: 0,
      maximumRevision: Number.MAX_SAFE_INTEGER,
      complete: false,
    });
    expect(JSON.stringify(result).length).toBeLessThan(MAX_REACH_TELEMETRY_BYTES);
  });
  it("refuses to expose a partial global reduction after an unexpected input failure", () => {
    const accumulator = createReachTelemetryAccumulator();
    accumulator.add(createReachTelemetryReport());
    const failure = new Error("UNREADABLE_REPORT");
    const hostile = {
      get schemaVersion(): number {
        throw failure;
      },
    };
    expect(() => accumulator.add(hostile)).toThrow(failure);
    expect(() => accumulator.finish()).toThrow(failure);
    expect(() => accumulator.add(createReachTelemetryReport())).toThrow(failure);
  });
  it.each([null, 0, undefined])("also poisons a failed reduction when an input throws%j", (failure) => {
    const accumulator = createReachTelemetryAccumulator();
    const hostile = {
      get schemaVersion(): number {
        throw failure;
      },
    };
    let addReturned = false,
      finishReturned = false;
    try {
      accumulator.add(hostile);
      addReturned = true;
    } catch {
      /* The thrown value may be falsy. */
    }
    try {
      accumulator.finish();
      finishReturned = true;
    } catch {
      /* Partial data must remain unavailable. */
    }
    expect(addReturned).toBe(false);
    expect(finishReturned).toBe(false);
  });
  it("pools real handedness score sums/counts and never calls them pointing confidence", () => {
    const first = createReachTelemetryReport(),
      second = createReachTelemetryReport();
    for (const value of [0.5, 1])
      observeReachHistogram(first.confidence.handedness.histogram, reachConfidenceUpperBounds, value);
    first.confidence.handedness.sum = 1.5;
    first.confidence.handedness.count = 2;
    observeReachHistogram(second.confidence.handedness.histogram, reachConfidenceUpperBounds, 0.9);
    second.confidence.handedness.sum = 0.9;
    second.confidence.handedness.count = 1;
    const result = summarizeReachTelemetry([first, second]);
    expect(result.confidence.handedness.count).toBe(3);
    expect(result.confidence.handedness.average).toBeCloseTo(0.8);
    expect(result.confidence.handedness.interpretation).toContain("not hand-presence, tracking or pointing confidence");
    expect(result.confidence.postureScore.available).toBe(false);
    second.confidence.handedness.count = 3;
    expect(reachTelemetryReportSchema.safeParse(second).success).toBe(false);
  });
  it.each([
    "frames",
    "landmarks",
    "positions",
    "trajectory",
    "coefficients",
    "cameraId",
    "trackId",
    "sessionId",
    "accountId",
    "timestamp",
    "userAgent",
    "fingerprint",
    "notes",
  ])("rejects injected%s at every report boundary", (key) => {
    const report = createReachTelemetryReport();
    expect(reachTelemetryReportSchema.safeParse({ ...report, [key]: "private" }).success).toBe(false);
    expect(reachTelemetryReportSchema.safeParse({ ...report, model: { ...report.model, [key]: [] } }).success).toBe(
      false,
    );
    expect(
      reachTelemetryReportSchema.safeParse({
        ...report,
        timings: { ...report.timings, modelPacketAgeMs: { ...report.timings.modelPacketAgeMs, [key]: [] } },
      }).success,
    ).toBe(false);
  });
  it("requires the report version and rejects false consent, identity and experiment claims", () => {
    expect(reachTelemetrySubmissionSchema.safeParse(submission()).success).toBe(true);
    for (const patch of [
      { consented: false },
      { consentVersion: "OLD" },
      { consented: true },
      { reportVersion: 2 },
      { accountId: "client-account" },
      { idempotencyKey: "stable-device-id" },
    ])
      expect(reachTelemetrySubmissionSchema.safeParse({ ...submission(), ...patch }).success).toBe(false);
    for (const evidenceSource of ["D0_MODEL_PATH_EXPERIMENT", "PHYSICALLY_QUALIFIED", "GUIDED_DEMO"])
      expect(reachTelemetryReportSchema.safeParse({ ...createReachTelemetryReport(), evidenceSource }).success).toBe(
        false,
      );
  });
  it("rejects broken denominators, malformed bins and nonfinite data without throwing safeParse", () => {
    const report = createReachTelemetryReport();
    expect(reachTelemetryReportSchema.safeParse({ ...report, model: { ...report.model, packets: 1 } }).success).toBe(
      false,
    );
    expect(
      reachTelemetryReportSchema.safeParse({ ...report, model: { ...report.model, postureEligible: 1 } }).success,
    ).toBe(false);
    expect(
      reachTelemetryReportSchema.safeParse({ ...report, activity: { ...report.activity, activeMs: 1 } }).success,
    ).toBe(false);
    for (const bins of [[], [NaN], Array(reachTimingUpperBoundsMs.length + 1).fill(100000)])
      expect(() => {
        expect(
          reachTelemetryReportSchema.safeParse({
            ...report,
            timings: { ...report.timings, modelPacketAgeMs: { bins, missing: 0 } },
          }).success,
        ).toBe(false);
      }).not.toThrow();
  });
  it("applies a byte bound before parsing JSON and does not strip forbidden fields", () => {
    expect(encodeReachTelemetrySubmission(submission()).length).toBeLessThan(MAX_REACH_TELEMETRY_BYTES);
    expect(parseReachTelemetrySubmissionJson(encodeReachTelemetrySubmission(submission()))).toEqual(submission());
    expect(() => parseReachTelemetrySubmissionJson(" ".repeat(MAX_REACH_TELEMETRY_BYTES + 1))).toThrow("SIZE_LIMIT");
    expect(() => encodeReachTelemetrySubmission({ ...submission(), raw: { x: 1, y: 2 } })).toThrow();
  });
  it("pools fixed timing bins instead of averaging report P95 values", () => {
    const first = createReachTelemetryReport(),
      second = createReachTelemetryReport();
    for (let i = 0; i < 100; i++) observeReachHistogram(first.timings.modelPacketAgeMs, reachTimingUpperBoundsMs, 10);
    observeReachHistogram(second.timings.modelPacketAgeMs, reachTimingUpperBoundsMs, 1000);
    observeReachHistogram(second.timings.modelPacketAgeMs, reachTimingUpperBoundsMs, undefined);
    const result = summarizeReachTelemetry([first, second]);
    expect(result.timings.modelPacketAgeMs).toMatchObject({
      observed: 101,
      missing: 1,
      p95: { lowerExclusive: 5, upperInclusive: 10 },
    });
    expect(first.timings.modelPacketAgeMs.bins.reduce((n, v) => n + v, 0)).toBe(100);
  });
  it("separates pooled raw validation errors from the distribution of per-check P95 summaries", () => {
    const report = createReachTelemetryReport();
    for (let i = 0; i < 100; i++)
      observeReachHistogram(report.calibration.RELATIVE.validationRawErrors, reachErrorUpperBounds, 0.01);
    observeReachHistogram(report.calibration.RELATIVE.validationRawErrors, reachErrorUpperBounds, 0.5);
    observeReachHistogram(report.calibration.RELATIVE.checkRawP95, reachErrorUpperBounds, 0.01);
    observeReachHistogram(report.calibration.RELATIVE.checkRawP95, reachErrorUpperBounds, 0.5);
    const result = summarizeReachTelemetry([report]);
    expect(result.calibration.RELATIVE.pooledRawValidationErrors.p95?.upperInclusive).toBe(0.01);
    expect(result.calibration.RELATIVE.perCheckRawP95Distribution.p95?.upperInclusive).toBe(0.5);
  });
  it("keeps missingness and overflow explicit rather than fabricating an exact percentile", () => {
    const report = createReachTelemetryReport();
    observeReachHistogram(report.timings.pauseMs, reachTimingUpperBoundsMs, 120000);
    observeReachHistogram(report.timings.pauseMs, reachTimingUpperBoundsMs, NaN);
    const summary = summarizeReachTelemetry([report, { unsupported: true }]);
    expect(summary.invalidReports).toBe(1);
    expect(summary.timings.pauseMs).toMatchObject({
      observed: 1,
      missing: 1,
      p95: { lowerExclusive: 60000, upperInclusive: null, overflow: true },
    });
    expect(summary.fractions.acceptedModelPackets.fraction).toBeNull();
    expect(histogramCount(report.timings.pauseMs)).toBe(2);
  });
  it("counts aggregate windows without inventing accounts, sessions or distinct people", () => {
    const report = createReachTelemetryReport();
    const result = projectReachTelemetryRows([
      { report },
      { report },
      { report },
      { report },
      { report },
      { report: { bad: true } },
    ]);
    expect(result).toMatchObject({
      totalReports: 6,
      acceptedReports: 5,
      invalidReports: 1,
      distinctPeople: null,
      distinctReportingSessions: null,
    });
    expect(JSON.stringify(result)).not.toContain("accountId");
  });
});
