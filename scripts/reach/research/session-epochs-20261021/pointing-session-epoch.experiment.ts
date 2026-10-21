// Research only: explicitly invoked; not a unit.reach qualification.
import { describe, expect, it } from "vitest";
import {
  calibrationLayout,
  fitRelativeCalibration,
  relativeLayout,
  validateCalibration,
  type CalibrationBinding,
  type CalibrationSample,
} from "@/reach/calibration";
import {
  REACH_RELATIVE_ASSOCIATION_BASIS,
  REACH_RELATIVE_FEATURE_PROFILE,
  relativeIndexFeatures,
} from "@/reach/coordinates";
import { indexImageAlgorithm, type IndexImageObservation } from "@/reach/index-image-tracker";
import { SampleWindow } from "@/reach/sample-window";
import { ResearchPointingSession, type SessionMeasurementDomain } from "./pointing-session-epoch";

const binding: CalibrationBinding = {
  featureProfile: REACH_RELATIVE_FEATURE_PROFILE,
  associationBasis: REACH_RELATIVE_ASSOCIATION_BASIS,
  providerId: indexImageAlgorithm.providerId,
  providerVersion: indexImageAlgorithm.providerVersion,
  modelDigest: indexImageAlgorithm.algorithmDigest,
  providerGeneration: 1,
  cameraLeaseId: "analytic-session-camera",
  cameraFrameVersion: 1,
  viewportEpoch: 1,
  viewportWidth: 800,
  viewportHeight: 600,
  mirror: false,
  orientation: 0,
  trackId: "analytic-index-a",
  trackGeneration: 1,
  evidenceTier: "D0",
};
const domain: SessionMeasurementDomain = { binding, frameWidth: 640, frameHeight: 480 };
function observed(at: number, change: Partial<IndexImageObservation> = {}): IndexImageObservation {
  return {
    observationVersion: 1,
    providerId: indexImageAlgorithm.providerId,
    providerVersion: indexImageAlgorithm.providerVersion,
    algorithmDigest: indexImageAlgorithm.algorithmDigest,
    providerGeneration: 1,
    cameraLeaseId: binding.cameraLeaseId,
    cameraFrameVersion: 1,
    frameWidth: 640,
    frameHeight: 480,
    mirrorTransform: "NONE",
    orientation: 0,
    sequence: at,
    monotonicCaptureTime: at,
    monotonicPixelOriginTime: at,
    monotonicInferenceTime: at + 1,
    trackId: binding.trackId,
    trackGeneration: 1,
    point: { x: 0.5, y: 0.5 },
    state: "TRACKING",
    anchorSource: "MODEL_INDEX",
    modelAgreement: "AGREE",
    quality: { correlation: 0.99, separation: 0.1, texture: 25, forwardBackwardErrorPixels: 0 },
    uncertaintyRadiusPixels: 1,
    reason: "ANALYTIC_CANONICAL_ENVELOPE",
    measurements: {
      model: null,
      image: null,
      accepted: { x: 0.5, y: 0.5 },
      imageDisposition: "TIP",
      modelDisposition: "QUALIFIED",
    },
    temporalTrack: {
      state: "TRACKING",
      identity: "ESTABLISHED",
      intent: "POINT",
      measurementAgeMs: 1,
      positionUncertaintyPixels: 1,
      sourceGenerationCount: 1,
      hypothesisCount: 1,
      displayPoint: null,
    },
    ...change,
  };
}
function establish(session: ResearchPointingSession, start = 50, change: Partial<IndexImageObservation> = {}) {
  let result = session.snapshot();
  for (let at = start; at <= start + 250; at += 50)
    result = session.observe(session.snapshot().token, observed(at, change), at + 1);
  return result;
}
function collect(targets: { x: number; y: number }[], b: CalibrationBinding, start: number) {
  const groups: CalibrationSample[][] = [];
  let at = start;
  for (const target of targets) {
    const window = new SampleWindow(b, target, "RELATIVE");
    for (let i = 0; i < 30; ++i, at += 50) {
      const result = window.push(relativeIndexFeatures(target), at, b);
      if (result.samples) {
        groups.push(result.samples);
        at += 50;
        break;
      }
    }
  }
  return { groups, at };
}
function checkedFit() {
  const training = collect(relativeLayout.training, binding, 1000);
  const fitted = fitRelativeCalibration(training.groups, binding, training.at);
  const checks = collect(calibrationLayout.validation, binding, training.at + 1000);
  return validateCalibration(fitted, checks.groups);
}

describe("isolated pointing session epochs", () => {
  it("separates stable local readiness from validated screen mapping", () => {
    const session = new ResearchPointingSession(domain, 0);
    const result = establish(session);
    expect(result).toMatchObject({
      state: "LOCAL_READY",
      qualification: false,
      sameEpochMappedPreview: null,
      actionPermission: false,
      physicalAssociation: "UNCLAIMED",
    });
    expect(result.cameraPreview).toEqual({ x: 0.5, y: 0.5 });
  });

  it("retains only an existing exact-epoch mapping after supported same-epoch uncertainty", () => {
    const fit = checkedFit();
    const session = new ResearchPointingSession(domain, 20000, "AUTOMATIC", fit);
    expect(establish(session, 20050).state).toBe("MAPPING_ACTIVE");
    const token = session.snapshot().token;
    expect(session.observe(token, observed(20400, { state: "LOST", point: null }), 20401).cameraPreview).toBeNull();
    const result = establish(session, 20450);
    expect(result.state).toBe("MAPPING_ACTIVE");
    expect(result.token).toBe(token);
    expect(result.mayPoolOldSamples).toBe(false);
  });

  it("requests one automatic local acquisition and revokes older callback tokens", () => {
    const session = new ResearchPointingSession(domain, 0);
    const initial = establish(session);
    const result = session.tick(1501);
    expect(result).toMatchObject({
      state: "LOCAL_REANCHOR",
      command: "ACQUIRE_AUTOMATIC_LOCAL_TRACK",
      cameraPreview: null,
    });
    expect(result.token.epoch).toBe(2);
    expect(session.observe(initial.token, observed(1550), 1551).reason).toBe("REJECTED_SESSION_OR_TOKEN");
    expect(session.observe({ ...result.token }, observed(1550), 1551).reason).toBe("REJECTED_SESSION_OR_TOKEN");
    expect(session.snapshot().token).toBe(result.token);
    expect(session.tick(1502)).toMatchObject({ state: "LOCAL_REANCHOR", reason: "LOCAL_ACQUISITION_PENDING" });
    expect(session.tick(3000)).toMatchObject({ state: "RECALIBRATION_REQUIRED", command: null });
    expect(session.tick(5000).command).toBeNull();
    expect(establish(session, 5100).state).toBe("RECALIBRATION_REQUIRED");
  });

  it("allows the one new acquisition its own fixed stabilization interval", () => {
    const session = new ResearchPointingSession(domain, 0);
    establish(session);
    session.tick(1501);
    const result = establish(session, 1550, { trackId: "analytic-return", trackGeneration: 2 });
    expect(result).toMatchObject({ state: "LOCAL_READY", sameEpochMappedPreview: null });
    expect(result.token.epoch).toBe(2);
  });

  it("rejects a late READY callback even when no timer tick observes the deadline", () => {
    const session = new ResearchPointingSession(domain, 0);
    establish(session);
    const token = session.tick(1501).token;
    for (const at of [2450, 2500, 2550, 2600, 2650])
      session.observe(token, observed(at, { trackId: "analytic-late", trackGeneration: 2 }), at + 1);
    expect(
      session.observe(token, observed(2750, { trackId: "analytic-late", trackGeneration: 2 }), 2751),
    ).toMatchObject({ state: "RECALIBRATION_REQUIRED", cameraPreview: null, command: null });
  });

  it("does not abandon a manual selection during automatic recovery", () => {
    const session = new ResearchPointingSession(domain, 0, "MANUAL");
    establish(session, 50, { anchorSource: "MANUAL_HINT" });
    expect(session.tick(1600)).toMatchObject({
      state: "UNCERTAIN",
      reason: "MANUAL_SELECTION_PRESERVED",
      command: null,
    });
    expect(session.snapshot().token.epoch).toBe(1);
  });

  it("closes the automatic recovery boundary when selection changes to a manual hint", () => {
    const session = new ResearchPointingSession(domain, 0);
    establish(session);
    expect(
      session.observe(session.snapshot().token, observed(350, { anchorSource: "MANUAL_HINT" }), 351),
    ).toMatchObject({ state: "PAUSED", reason: "SELECTION_MODE_CHANGED", cameraPreview: null });
    expect(session.tick(2000).command).toBeNull();
  });

  it("never inherits the saved mapping or physical identity on an individually ready replacement", () => {
    const fit = checkedFit(),
      before = structuredClone(fit);
    const session = new ResearchPointingSession(domain, 20000, "AUTOMATIC", fit);
    establish(session, 20050);
    const result = establish(session, 20400, { trackId: "analytic-index-b", trackGeneration: 2 });
    expect(result).toMatchObject({
      state: "COMPATIBILITY_CHECK",
      sameEpochMappedPreview: null,
      oldEvidence: "RETAIN_UNCHANGED",
      physicalAssociation: "UNCLAIMED",
      actionPermission: false,
    });
    expect(result.token.epoch).toBe(2);
    expect(session.compatibilityResult(result.token, true)).toMatchObject({
      state: "COMPATIBILITY_SUPPORTED",
      sameEpochMappedPreview: null,
      actionPermission: false,
      reason: "RESEARCH_PROPOSAL_ONLY",
    });
    expect(fit).toEqual(before);
  });

  it.each([
    { cameraLeaseId: "foreign-camera" },
    { cameraFrameVersion: 2 },
    { providerGeneration: 2 },
    { frameWidth: 1280 },
    { frameHeight: 720 },
    { mirrorTransform: "PREVIEW_X" as const },
  ])("withdraws output on source or geometry change %j", (change) => {
    const session = new ResearchPointingSession(domain, 0);
    establish(session);
    expect(session.observe(session.snapshot().token, observed(350, change), 351)).toMatchObject({
      state: "PAUSED",
      cameraPreview: null,
      sameEpochMappedPreview: null,
    });
    expect(session.observe(session.snapshot().token, observed(400), 401).reason).toBe("REJECTED_SESSION_OR_TOKEN");
  });

  it("does not refresh stale pixels by processing them again", () => {
    const session = new ResearchPointingSession(domain, 0);
    establish(session);
    const token = session.snapshot().token;
    expect(session.observe(token, observed(500, { monotonicPixelOriginTime: 300 }), 501)).toMatchObject({
      reason: "REJECTED_STALE_OR_REORDERED_INPUT",
      cameraPreview: null,
    });
    expect(session.observe(token, observed(600, { monotonicInferenceTime: 602 }), 601).reason).toBe(
      "REJECTED_STALE_OR_REORDERED_INPUT",
    );
    expect(session.observe(token, observed(299), 601).reason).toBe("REJECTED_STALE_OR_REORDERED_INPUT");
    expect(session.snapshot().token).toBe(token);
  });

  it("does not let an older callback overwrite a newer accepted state", () => {
    const session = new ResearchPointingSession(domain, 0);
    const accepted = establish(session);
    const rejected = session.observe(accepted.token, observed(299, { cameraLeaseId: "old-source" }), 305);
    expect(rejected.reason).toBe("REJECTED_STALE_OR_REORDERED_INPUT");
    expect(session.snapshot()).toEqual({ ...accepted, reason: "STATE" });
  });

  it("does not reopen a failed compatibility attempt on the next good frame", () => {
    const session = new ResearchPointingSession(domain, 20000, "AUTOMATIC", checkedFit());
    establish(session, 20050);
    const replacement = establish(session, 20400, { trackId: "analytic-new", trackGeneration: 2 });
    session.compatibilityResult(replacement.token, false);
    const result = session.observe(
      replacement.token,
      observed(20700, { trackId: "analytic-new", trackGeneration: 2 }),
      20701,
    );
    expect(result).toMatchObject({
      state: "RECALIBRATION_REQUIRED",
      sameEpochMappedPreview: null,
      actionPermission: false,
    });
  });

  it("makes ended and hidden sessions inert, including a late compatibility result", () => {
    for (const end of [false, true]) {
      const session = new ResearchPointingSession(domain, 0);
      const token = establish(session).token;
      if (end) session.end();
      else session.pause();
      expect(session.observe(token, observed(400), 401).reason).toBe("REJECTED_SESSION_OR_TOKEN");
      expect(session.compatibilityResult(token, true).reason).toBe("REJECTED_COMPATIBILITY_CONTEXT");
      expect(session.snapshot()).toMatchObject({
        state: end ? "ENDED" : "PAUSED",
        cameraPreview: null,
        actionPermission: false,
      });
    }
  });

  it("keeps repeated individually ready replacements in distinct nonactionable epochs", () => {
    const session = new ResearchPointingSession(domain, 0);
    establish(session);
    for (let i = 2; i <= 8; ++i) {
      const result = establish(session, i * 400, { trackId: `analytic-index-${i}`, trackGeneration: i });
      expect(result.token.epoch).toBe(i);
      expect(result).toMatchObject({ state: "LOCAL_READY", sameEpochMappedPreview: null, actionPermission: false });
    }
  });

  it("can complete a separately bound fresh setup and five checks without altering old completed evidence", () => {
    const saved = collect(relativeLayout.training.slice(0, 2), binding, 1000).groups;
    const before = structuredClone(saved);
    const newBinding = { ...binding, trackId: "analytic-new-epoch", trackGeneration: 2 };
    const training = collect(relativeLayout.training, newBinding, 20000);
    const fit = fitRelativeCalibration(training.groups, newBinding, training.at);
    const checking = collect(calibrationLayout.validation, newBinding, training.at + 1000);
    const checked = validateCalibration(fit, checking.groups);
    expect(checked).toMatchObject({ status: "VALIDATED", binding: newBinding });
    expect(checked.validationP95).toBeLessThan(1e-12);
    expect(training.groups).toHaveLength(5);
    expect(checking.groups).toHaveLength(5);
    expect(saved).toEqual(before);
    expect(() =>
      new SampleWindow(binding, relativeLayout.training[0], "RELATIVE").push(
        relativeIndexFeatures({ x: 0.5, y: 0.5 }),
        50000,
        newBinding,
      ),
    ).toThrow("SAMPLE_CONTEXT_CHANGED");
  });
});
