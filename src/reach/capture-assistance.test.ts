// @sounding-line-registration owner=reach suite=unit.reach contracts=reach.phase1.foundation
import { describe, expect, it } from "vitest";
import {
  ReachCaptureAssistance,
  defaultReachCaptureAssistancePolicy,
  type CaptureAssistanceCandidate,
  type CaptureAssistanceContext,
} from "./capture-assistance";
import type { CaptureHealthDiagnosis } from "./capture-health";

const context: CaptureAssistanceContext = { binding: "camera-a", enabled: true, foreground: true, authorized: true };
const health = (now: number, overrides: Partial<CaptureHealthDiagnosis> = {}): CaptureHealthDiagnosis => ({
  context: "baseline",
  sourceBinding: "camera-a",
  state: "DEGRADED",
  windowStartedMs: 0,
  lastCaptureMs: now,
  evidenceMs: 2000,
  captureHz: 15,
  usableFraction: 0.2,
  staleFraction: 0,
  rejectedFraction: 0,
  conflictFraction: 0,
  contraryFraction: 0,
  pressureFraction: 0,
  measured: ["MODEL_ACQUISITION_GAP"],
  hypotheses: [],
  ...overrides,
});
const aid = (overrides: Partial<CaptureAssistanceCandidate> = {}): CaptureAssistanceCandidate => ({
  id: "current-qualified-aid",
  kind: "REGION_ACQUISITION",
  access: "AVAILABLE",
  authorized: true,
  qualifiedProfile: "watchglass-qualified-profile-v1",
  preservesPrimaryGeometry: true,
  work: "NEUTRAL",
  addresses: ["MODEL_ACQUISITION_GAP"],
  ...overrides,
});
const trialHealth = (now: number, overrides: Partial<CaptureHealthDiagnosis> = {}) =>
  health(now, {
    context: "aid-mode-1",
    state: "HEALTHY",
    windowStartedMs: 2100,
    evidenceMs: 2100,
    usableFraction: 0.95,
    measured: [],
    ...overrides,
  });
function started() {
  const planner = new ReachCaptureAssistance();
  const candidate = aid();
  const request = planner.update(context, health(2000), [candidate], 2000)[0];
  if (request.type !== "REQUEST") throw new Error("test expected request");
  expect(planner.acknowledge(request.requestId, context.binding, "aid-mode-1", true, 2100)).toEqual([]);
  return { planner, candidate, request };
}
describe("bounded capability-driven capture assistance", () => {
  it("leaves a healthy ordinary camera alone and needs no extra hardware", () => {
    const planner = new ReachCaptureAssistance();
    expect(planner.update(context, health(2000, { state: "HEALTHY" }), [], 2000)).toEqual([]);
    expect(planner.snapshot().reason).toBe("CAMERA_BASELINE");
    expect(planner.update(context, health(3000), [], 3000)).toEqual([]);
    expect(planner.snapshot().reason).toBe("NO_QUALIFIED_ASSISTANCE_AVAILABLE");
  });
  it.each([
    { access: "UNKNOWN" as const },
    { access: "DENIED" as const },
    { access: "BUSY" as const },
    { access: "UNSUPPORTED" as const },
    { authorized: false },
    { qualifiedProfile: null },
    { preservesPrimaryGeometry: false },
  ])("does not mistake detected or unqualified hardware for usable assistance (%j)", (overrides) => {
    const planner = new ReachCaptureAssistance();
    expect(planner.update(context, health(2000), [aid(overrides)], 2000)).toEqual([]);
  });
  it("requires the cause and current source to match, with no sensor- or vendor-name rules", () => {
    const planner = new ReachCaptureAssistance();
    expect(planner.update(context, health(2000), [aid({ addresses: ["LIGHTING_OR_CONTRAST"] })], 2000)).toEqual([]);
    expect(planner.update(context, health(2100, { sourceBinding: "old-camera" }), [aid()], 2100)).toEqual([]);
    expect(planner.update(context, health(2200, { lastCaptureMs: 2000 }), [aid()], 2200)).toEqual([]);
  });
  it("prioritizes less work under measured processing pressure instead of starting extra sensors", () => {
    const planner = new ReachCaptureAssistance();
    const loaded = health(2000, { measured: ["PROCESSING_PRESSURE"], hypotheses: ["LIGHTING_OR_CONTRAST"] });
    const actions = planner.update(
      context,
      loaded,
      [
        aid({ id: "infrared", kind: "INFRARED_ASSIST", work: "INCREASES", addresses: ["LIGHTING_OR_CONTRAST"] }),
        aid({ id: "analysis", kind: "LOWER_ANALYSIS_COST", work: "REDUCES", addresses: ["PROCESSING_PRESSURE"] }),
      ],
      2000,
    );
    expect(actions[0].type === "REQUEST" && actions[0].candidate.id).toBe("analysis");
  });
  it("requires a fresh separate trial window and enough evidence before retaining a useful aid", () => {
    const { planner, candidate } = started();
    expect(planner.update(context, health(2200, { usableFraction: 1 }), [candidate], 2200)).toEqual([]);
    expect(planner.snapshot().state).toBe("TRIAL");
    planner.update(context, trialHealth(4300), [candidate], 4300);
    expect(planner.snapshot().state).toBe("ASSISTED");
  });
  it.each([
    { conflictFraction: 0.01 },
    { rejectedFraction: 0.01 },
    { staleFraction: 0.01 },
    { contraryFraction: 0.01 },
    { measured: ["PROCESSING_PRESSURE" as const], pressureFraction: 1 },
    { usableFraction: 0.25 },
  ])("rolls back rather than counting unsafe detection coverage as improvement (%j)", (overrides) => {
    const { planner, candidate } = started();
    expect(planner.update(context, trialHealth(4300, overrides), [candidate], 4300)[0]).toMatchObject({
      type: "RELEASE",
    });
    expect(planner.snapshot().state).toBe("BACKOFF");
  });
  it("expires a request and cleans up late success without reactivating capture", () => {
    const planner = new ReachCaptureAssistance();
    const request = planner.update(context, health(2000), [aid()], 2000)[0];
    if (request.type !== "REQUEST") throw new Error("expected request");
    expect(planner.update(context, health(5000), [aid()], 5000)[0]).toMatchObject({
      type: "RELEASE",
      reason: "ASSISTANCE_REQUEST_TIMEOUT",
    });
    expect(planner.acknowledge(request.requestId, "camera-a", "late-mode", true, 5100)[0]).toMatchObject({
      type: "RELEASE",
      reason: "SUPERSEDED_REQUEST",
    });
    expect(planner.snapshot().state).toBe("BACKOFF");
  });
  it("rejects better recognition when camera delivery has become substantially slower", () => {
    const { planner, candidate } = started();
    expect(planner.update(context, trialHealth(4300, { captureHz: 5 }), [candidate], 4300)[0]).toMatchObject({
      type: "RELEASE",
      reason: "ASSISTANCE_DID_NOT_IMPROVE_TRACKING",
    });
  });
  it("allows a neutral same-camera lighting trial under existing pressure without adding another workload", () => {
    const planner = new ReachCaptureAssistance();
    const candidate = aid({ kind: "EXPOSURE", addresses: ["LIGHTING_OR_CONTRAST"], work: "NEUTRAL" });
    const before = health(2000, {
      measured: ["PROCESSING_PRESSURE"],
      hypotheses: ["LIGHTING_OR_CONTRAST"],
      pressureFraction: 1,
    });
    const request = planner.update(context, before, [candidate], 2000)[0];
    expect(request.type).toBe("REQUEST");
    planner.acknowledge(request.requestId, "camera-a", "aid-mode-1", true, 2100);
    planner.update(
      context,
      trialHealth(4300, { measured: ["PROCESSING_PRESSURE"], pressureFraction: 1 }),
      [candidate],
      4300,
    );
    expect(planner.snapshot().state).toBe("ASSISTED");
  });
  it("makes acknowledgement idempotent without accidentally releasing an active trial", () => {
    const { planner, request } = started();
    expect(planner.acknowledge(request.requestId, "camera-a", "aid-mode-1", true, 2200)).toEqual([]);
    expect(planner.snapshot().state).toBe("TRIAL");
  });
  it.each([{ enabled: false }, { foreground: false }, { authorized: false }])(
    "releases assistance immediately on lifecycle/policy changes (%j)",
    (overrides) => {
      const { planner, candidate, request } = started();
      expect(planner.update({ ...context, ...overrides }, health(2200), [candidate], 2200)[0]).toMatchObject({
        type: "RELEASE",
        requestId: request.requestId,
      });
      expect(planner.snapshot().state).toBe("STOPPED");
      expect(planner.acknowledge(request.requestId, "camera-a", "aid-mode-1", true, 2300)[0]).toMatchObject({
        type: "RELEASE",
      });
    },
  );
  it("does not accept an old binding, changed qualification or stale result as successful assistance", () => {
    const { planner, candidate } = started();
    planner.update(context, trialHealth(4300, { sourceBinding: "old-camera" }), [candidate], 4300);
    expect(planner.snapshot().state).toBe("TRIAL");
    planner.update(context, trialHealth(4500, { lastCaptureMs: 4300 }), [candidate], 4500);
    expect(planner.snapshot().state).toBe("TRIAL");
    expect(
      planner.update(context, trialHealth(4600), [{ ...candidate, qualifiedProfile: "different-profile" }], 4600)[0],
    ).toMatchObject({ type: "RELEASE" });
  });
  it("rolls back a trial without evidence at its bounded deadline", () => {
    const { planner, candidate } = started();
    expect(planner.update(context, trialHealth(10100), [candidate], 10100)[0]).toMatchObject({
      type: "RELEASE",
      reason: "ASSISTANCE_TRIAL_TIMEOUT",
    });
  });
  it("does not accept then immediately reject the same still-degraded trial", () => {
    const { planner, candidate } = started();
    planner.update(context, trialHealth(4300, { state: "DEGRADED", usableFraction: 0.4 }), [candidate], 4300);
    expect(planner.snapshot().state).toBe("TRIAL");
    planner.update(context, trialHealth(4400, { state: "DEGRADED", usableFraction: 0.4 }), [candidate], 4400);
    expect(planner.snapshot().state).toBe("TRIAL");
  });
  it("bounds assisted resource use if matching fresh evidence stops arriving", () => {
    const { planner, candidate } = started();
    planner.update(context, trialHealth(4300), [candidate], 4300);
    expect(planner.snapshot().deadlineMs).toBe(5800);
    planner.update(context, trialHealth(5700, { context: "wrong-mode" }), [candidate], 5700);
    expect(planner.snapshot().deadlineMs).toBe(5800);
    expect(planner.update(context, trialHealth(5800, { context: "wrong-mode" }), [candidate], 5800)[0]).toMatchObject({
      type: "RELEASE",
      reason: "ASSISTANCE_EVIDENCE_TIMEOUT",
    });
  });
  it("keeps a good assisted mode until independent baseline evidence sustains recovery", () => {
    const { planner, candidate } = started();
    planner.update(context, trialHealth(4300), [candidate], 4300);
    planner.update(context, trialHealth(10000), [candidate], 10000);
    expect(planner.snapshot().state).toBe("ASSISTED");
    const probe = (at: number) =>
      health(at, { state: "HEALTHY", windowStartedMs: 2100, usableFraction: 1, measured: [] });
    planner.update(context, trialHealth(10100), [candidate], 10100, probe(10100));
    expect(planner.update(context, trialHealth(15000), [candidate], 15000, probe(15000))).toEqual([]);
    expect(planner.update(context, trialHealth(15100), [candidate], 15100, probe(15100))[0]).toMatchObject({
      type: "RELEASE",
      reason: "BASELINE_RECOVERED",
    });
  });
  it.each([
    { captureHz: 5 },
    { pressureFraction: 1 },
    { staleFraction: 0.01 },
    { conflictFraction: 0.01 },
    { contraryFraction: 0.01 },
  ])("keeps checking safety and cadence after a trial was accepted (%j)", (overrides) => {
    const { planner, candidate } = started();
    planner.update(context, trialHealth(4300), [candidate], 4300);
    expect(planner.snapshot().state).toBe("ASSISTED");
    expect(planner.update(context, trialHealth(4400, overrides), [candidate], 4400)[0]).toMatchObject({
      type: "RELEASE",
      reason: "ASSISTANCE_EVIDENCE_WORSENED",
    });
  });
  it("backs off failed candidates and has a finite context trial budget", () => {
    const planner = new ReachCaptureAssistance({ ...defaultReachCaptureAssistancePolicy, maximumTrialsPerContext: 1 });
    const candidates = [aid(), aid({ id: "second" })];
    planner.update(context, health(2000), candidates, 2000);
    planner.update(context, health(5000), candidates, 5000);
    expect(planner.update(context, health(6000), candidates, 6000)).toEqual([]);
    expect(planner.update(context, health(35000), candidates, 35000)).toEqual([]);
    expect(planner.snapshot().reason).toBe("ASSISTANCE_TRIAL_BUDGET_EXHAUSTED");
    const next = { ...context, binding: "new-camera" };
    expect(planner.update(next, health(35100, { sourceBinding: "new-camera" }), candidates, 35100)[0]).toMatchObject({
      type: "REQUEST",
    });
  });
  it("rejects invalid time without issuing commands", () => {
    const planner = new ReachCaptureAssistance();
    planner.update(context, health(2000), [], 2000);
    expect(() => planner.update(context, health(1999), [aid()], 1999)).toThrow("CLOCK_INVALID");
  });
});
