// @sounding-line-registration owner=reach suite=unit.reach contracts=reach.phase1.foundation
import { describe, expect, it, vi } from "vitest";
import {
  createReachTelemetryFetchTransport,
  ReachTelemetryCollector,
  REACH_TELEMETRY_UPLOAD_TIMEOUT_MS,
} from "./telemetry-client";
import {
  histogramCount,
  MAX_REACH_TELEMETRY_ACTIVE_MS,
  MAX_REACH_TELEMETRY_COUNT,
  reachTelemetryReportSchema,
  type ReachTelemetrySubmission,
} from "./telemetry";
const policy = { featureEnabled: true, telemetryEnabled: true, revision: 1 };
function collector(
  options: {
    transport?: (submission: ReachTelemetrySubmission, signal: AbortSignal) => Promise<{ ok: boolean }>;
  } = {},
) {
  let id = 0;
  return new ReachTelemetryCollector({
    policy,
    ...options,
    makeId: () => `00000000-0000-4000-8000-${String(++id).padStart(12, "0")}`,
  });
}
describe("automatic bounded numeric Reach telemetry collector", () => {
  it("records real scalar handedness confidence with explicit unavailable samples", () => {
    const client = collector();
    for (const value of [0.8, 0.9, null, NaN, 1.2]) client.recordHandednessConfidence(value);
    const value = client.snapshot().confidence.handedness;
    expect(value.count).toBe(2);
    expect(value.sum).toBeCloseTo(1.7);
    expect(value.histogram.missing).toBe(3);
    expect(histogramCount(value.histogram)).toBe(5);
  });
  it("bounds a stalled upload without replacing its retry dedup key", async () => {
    vi.useFakeTimers();
    try {
      const sent: ReachTelemetrySubmission[] = [],
        client = collector({
          transport: (submission) => {
            sent.push(submission);
            return new Promise(() => {});
          },
        });
      client.recordEvent("cameraStarts");
      const first = client.flush();
      await vi.advanceTimersByTimeAsync(REACH_TELEMETRY_UPLOAD_TIMEOUT_MS);
      expect(await first).toBe("RETRY_PENDING");
      const retry = client.flush();
      await vi.advanceTimersByTimeAsync(REACH_TELEMETRY_UPLOAD_TIMEOUT_MS);
      expect(await retry).toBe("RETRY_PENDING");
      expect(sent[0].idempotencyKey).toBe(sent[1].idempotencyKey);
      client.dispose();
    } finally {
      vi.useRealTimers();
    }
  });
  it("collects numeric aggregates automatically when global policy allows it", async () => {
    const transport = vi.fn(async () => ({ ok: true })),
      client = collector({ transport });
    expect(client.recordModelPacket({ disposition: "ACCEPTED", packetAgeMs: 20 })).toBe(true);
    expect(client.recordActivity(1000, { focused: true, collecting: false, cadence: "NORMAL", capHz: 15 })).toBe(true);
    expect(await client.flush()).toBe("UPLOADED");
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it.each(["featureEnabled", "telemetryEnabled"] as const)("enforces the global%s ceiling", async (key) => {
    const transport = vi.fn(async () => ({ ok: false })),
      client = collector({ transport });
    client.recordEvent("cameraStarts");
    expect(await client.flush()).toBe("RETRY_PENDING");
    client.setPolicy({ ...policy, [key]: false, revision: 2 });
    expect(client.enabled).toBe(false);
    expect(client.hasPendingUpload).toBe(false);
    expect(client.recordEvent("cameraStarts")).toBe(false);
    expect(await client.flush()).toBe("DISABLED");
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it("retains one dedup key across retries and uses an unrelated key for the next report", async () => {
    const sent: ReachTelemetrySubmission[] = [],
      client = collector({
        transport: async (submission) => {
          sent.push(submission);
          return { ok: sent.length > 1 };
        },
      });
    client.recordEvent("cameraStarts");
    expect(await client.flush()).toBe("RETRY_PENDING");
    client.recordEvent("cameraStops");
    expect(await client.flush()).toBe("UPLOADED");
    expect(await client.flush()).toBe("UPLOADED");
    expect(sent[0].idempotencyKey).toBe(sent[1].idempotencyKey);
    expect(sent[2].idempotencyKey).not.toBe(sent[1].idempotencyKey);
    expect(sent[0].report.events.cameraStops).toBe(0);
    expect(sent[2].report.events.cameraStops).toBe(1);
  });
  it("aborts in-flight work and erases both windows when global policy disables collection", async () => {
    let resolve!: (value: { ok: boolean }) => void, signal!: AbortSignal;
    const client = collector({
      transport: (_submission, supplied) => {
        signal = supplied;
        return new Promise((done) => {
          resolve = done;
        });
      },
    });
    client.recordEvent("cameraStarts");
    const pending = client.flush();
    expect(await client.flush()).toBe("IN_FLIGHT");
    client.recordEvent("cameraStops");
    client.setPolicy({ ...policy, telemetryEnabled: false, revision: 2 });
    expect(signal.aborted).toBe(true);
    expect(client.hasPendingUpload).toBe(false);
    resolve({ ok: true });
    expect(await pending).toBe("DISABLED");
    client.setPolicy({ ...policy, revision: 3 });
    expect(await client.flush()).toBe("EMPTY");
  });
  it("records only fixed aggregate bins and explicit missingness from scalar packet data", () => {
    const client = collector({});
    client.recordModelPacket({
      disposition: "ACCEPTED",
      packetAgeMs: 151,
      handCount: 1,
      postureEligible: true,
      frameIntervalMs: 100,
      cadence: "NORMAL",
    });
    client.recordModelPacket({ disposition: "ACCEPTED", packetAgeMs: 100, handCount: 1, postureEligible: true });
    client.recordModelPacket({ disposition: "INVALID", packetAgeMs: 50, handCount: 0 });
    client.recordImageState("uncertain", { correlation: 0.9, separation: 0.02, uncertaintyPx: 4 });
    const result = client.snapshot();
    expect(result.model).toEqual({
      packets: 3,
      accepted: 1,
      late: 1,
      invalid: 1,
      noHand: 0,
      multipleHands: 0,
      postureEligible: 1,
      handCountMissing: 2,
    });
    expect(histogramCount(result.timings.modelPacketAgeMs)).toBe(3);
    expect(result.timings.modelResultMs.missing).toBe(3);
    expect(result.rates.normalAchievedHz.missing).toBe(2);
    expect(reachTelemetryReportSchema.safeParse(result).success).toBe(true);
  });
  it("weights caps by measured active time and bounds report memory/duration", () => {
    const client = collector({});
    client.recordActivity(1000, { focused: true, collecting: false, cadence: "NORMAL", capHz: 15 });
    client.recordActivity(MAX_REACH_TELEMETRY_ACTIVE_MS, {
      focused: false,
      collecting: true,
      cadence: "CALIBRATION",
      capHz: 60,
    });
    client.recordActivity(1000, { focused: true, collecting: false, cadence: "NORMAL" });
    const report = client.snapshot();
    expect(report.activity.activeMs).toBe(MAX_REACH_TELEMETRY_ACTIVE_MS);
    expect(report.activity.focusedMs).toBe(1000);
    expect(report.activity.calibrationCollectingMs).toBe(MAX_REACH_TELEMETRY_ACTIVE_MS - 1000);
    expect(histogramCount(report.rates.normalCapMs)).toBe(1000);
    expect(histogramCount(report.rates.calibrationCapMs)).toBe(MAX_REACH_TELEMETRY_ACTIVE_MS - 1000);
    expect(report.activity.droppedActivityMs).toBe(2000);
    expect(JSON.stringify(report).length).toBeLessThan(32768);
  });
  it("does not retain scalar residual arrays, positions, or caller-owned mutations", () => {
    const client = collector({}),
      values = [0.01, 0.02, 0.03];
    client.recordValidationSamples("RELATIVE", "RAW", values);
    values.fill(0.9);
    client.recordCalibration("RELATIVE", "CHECK", "PASSED", { rawP95: 0.03, jitterP95: 0.01, median: 0.02 });
    const first = client.snapshot();
    first.calibration.RELATIVE.validationRawErrors.bins.fill(9);
    const second = client.snapshot();
    expect(histogramCount(second.calibration.RELATIVE.validationRawErrors)).toBe(3);
    expect(histogramCount(second.calibration.RELATIVE.checkRawP95)).toBe(1);
    for (const forbidden of [
      "landmarks",
      "cameraId",
      "trackId",
      "sessionId",
      "accountId",
      "timestamp",
      "trajectory",
      "coefficients",
    ])
      expect(JSON.stringify(second)).not.toContain(forbidden);
  });
  it("saturates bounded counters and explicitly counts dropped observations", () => {
    const client = collector({});
    for (let i = 0; i < MAX_REACH_TELEMETRY_COUNT + 2; i++) client.recordEvent("pauses");
    expect(client.snapshot().events.pauses).toBe(MAX_REACH_TELEMETRY_COUNT);
    expect(client.snapshot().droppedEvents).toBe(2);
  });
  it("uses only a same-origin JSON POST and never sends a client identity", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    try {
      const client = collector({ transport: createReachTelemetryFetchTransport() });
      client.recordEvent("cameraStarts");
      await client.flush();
      const [url, options] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
      expect(url).toBe("/api/reach/telemetry");
      expect(options.credentials).toBe("same-origin");
      expect(options.redirect).toBe("error");
      expect(JSON.parse(options.body as string)).toMatchObject({
        reportVersion: 1,
      });
      expect(() => createReachTelemetryFetchTransport("https://other.invalid/upload")).toThrow("SAME_ORIGIN");
      expect(() => createReachTelemetryFetchTransport("//other.invalid/upload")).toThrow("SAME_ORIGIN");
      expect(() => createReachTelemetryFetchTransport("/\\other.invalid/upload")).toThrow("SAME_ORIGIN");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
