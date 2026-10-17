// @sounding-line-registration owner=reach suite=unit.reach contracts=reach.phase1.foundation
import { describe, expect, it } from "vitest";
import { canOpenReachTrial, trialEntryGraceMs } from "./trial-entry";
import { syntheticObservation } from "./synthetic";
import { indexImageAlgorithm, type IndexImageObservation } from "./index-image-tracker";
import type { ReachReadiness } from "./observation";

function input(mode: "ABSOLUTE" | "RELATIVE" = "ABSOLUTE") {
  const observation = syntheticObservation({ x: 0.5, y: 0.5 }, 1, 1000);
  const readiness: ReachReadiness = {
    detectedCount: 1,
    hand: mode === "ABSOLUTE" ? observation.hands[0] : null,
    eligible: false,
    changed: false,
    condition: "READY",
    guidance: "Collection waits for fresh tracking.",
  };
  const imageObservation: IndexImageObservation = {
    observationVersion: 1,
    providerId: indexImageAlgorithm.providerId,
    providerVersion: indexImageAlgorithm.providerVersion,
    algorithmDigest: indexImageAlgorithm.algorithmDigest,
    providerGeneration: 1,
    cameraLeaseId: "image-entry-test",
    cameraFrameVersion: 1,
    frameWidth: 640,
    frameHeight: 480,
    mirrorTransform: "NONE",
    orientation: 0,
    sequence: 1,
    monotonicCaptureTime: 1000,
    monotonicInferenceTime: 1020,
    trackId: "image-entry-1",
    trackGeneration: 1,
    point: { x: 0.5, y: 0.5 },
    state: "TRACKING",
    modelAgreement: "UNAVAILABLE",
    anchorSource: "MANUAL_HINT",
    quality: { correlation: null, separation: null, texture: null, forwardBackwardErrorPixels: null },
    uncertaintyRadiusPixels: null,
    reason: "IMAGE_MATCH",
  };
  return { mode, source: "LIVE" as const, readiness, observation, imageObservation, now: 1200 };
}

describe("bounded target entry separate from sample eligibility", () => {
  it.each(["ABSOLUTE", "RELATIVE"] as const)("opens %s at200ms without crediting collection eligibility", (mode) => {
    const state = input(mode);
    expect(canOpenReachTrial(state)).toBe(true);
    expect(state.readiness.eligible).toBe(false);
  });
  it.each(["ABSOLUTE", "RELATIVE"] as const)("bounds %s entry to0..300ms even if eligibility is stale", (mode) => {
    const state = input(mode);
    for (const age of [0, 150, trialEntryGraceMs]) expect(canOpenReachTrial({ ...state, now: 1000 + age })).toBe(true);
    state.readiness.eligible = true;
    for (const age of [-1, trialEntryGraceMs + 1, Infinity, NaN])
      expect(canOpenReachTrial({ ...state, now: 1000 + age })).toBe(false);
  });
  it.each(["ABSOLUTE", "RELATIVE"] as const)("blocks %s mode/source changes and lost readiness immediately", (mode) => {
    const state = input(mode);
    expect(canOpenReachTrial({ ...state, source: "OFF" })).toBe(false);
    expect(canOpenReachTrial({ ...state, readiness: { ...state.readiness, changed: true } })).toBe(false);
    for (const condition of ["ACQUIRING", "RECOVERING", "AMBIGUOUS", "POSTURE", "NO_HAND"] as const)
      expect(canOpenReachTrial({ ...state, readiness: { ...state.readiness, condition } })).toBe(false);
  });
  it("does not borrow relative readiness for absolute entry or absolute readiness for a new image mode", () => {
    expect(canOpenReachTrial({ ...input("RELATIVE"), mode: "ABSOLUTE" })).toBe(false);
    expect(canOpenReachTrial({ ...input(), mode: "RELATIVE", imageObservation: null })).toBe(false);
  });
  it("blocks contrary, ambiguous and missing image points without using a paused match", () => {
    const state = input("RELATIVE");
    for (const imageState of ["UNCERTAIN", "LOST", "UNSEEDED"] as const)
      expect(
        canOpenReachTrial({
          ...state,
          imageObservation: {
            ...state.imageObservation,
            state: imageState,
            point: null,
            matchedPoint: { x: 0.5, y: 0.5 },
          },
        }),
      ).toBe(false);
    expect(canOpenReachTrial({ ...state, imageObservation: { ...state.imageObservation, point: null } })).toBe(false);
  });
  it("blocks missing, changed, ambiguous or invalid absolute index anatomy immediately", () => {
    for (const fault of ["missing", "new-track", "ambiguous", "invalid-index", "open-hand", "interrupted"] as const) {
      const state = input();
      if (fault === "missing") state.observation.hands = [];
      if (fault === "new-track") state.observation.hands[0] = { ...state.observation.hands[0], trackGeneration: 2 };
      if (fault === "ambiguous") state.observation.hands[0].continuity = "AMBIGUOUS";
      if (fault === "invalid-index") state.observation.hands[0].landmarks[8].valid = false;
      if (fault === "open-hand") {
        const landmarks = state.observation.hands[0].landmarks;
        for (const base of [9, 13, 17])
          for (let joint = 1; joint <= 3; ++joint)
            landmarks[base + joint] = { ...landmarks[base], y: landmarks[base].y - 0.02 * joint };
      }
      if (fault === "interrupted") state.observation.reason = "INTERRUPTED";
      expect(canOpenReachTrial(state)).toBe(false);
    }
  });
});
