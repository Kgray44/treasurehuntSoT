// @sounding-line-registration owner=reach suite=unit.reach contracts=reach.phase1.foundation
import { describe, expect, it } from "vitest";
import { canOpenReachTrial } from "./trial-entry";
import { ActiveHandSelector, ObservationGate } from "./observation";
import { syntheticObservation } from "./synthetic";

const live = { source: "LIVE" as const, sessionStatus: "READY", workerAvailable: true };
describe("session entry separate from fresh sample eligibility", () => {
  it.each(["READY", "STALE_OR_INVALID_OBSERVATION"])(
    "opens an empty trial while the started model is%s",
    (sessionStatus) => {
      expect(canOpenReachTrial({ ...live, sessionStatus })).toBe(true);
    },
  );
  it("does not require a model or recognized posture for an active guided demo", () => {
    expect(canOpenReachTrial({ source: "DEMO", sessionStatus: "DEMO", workerAvailable: false })).toBe(true);
  });
  it("blocks an absent camera worker and camera-ready startup before model initialization", () => {
    expect(canOpenReachTrial({ ...live, source: "OFF" })).toBe(false);
    expect(canOpenReachTrial({ ...live, workerAvailable: false })).toBe(false);
    expect(canOpenReachTrial({ ...live, sessionStatus: "MODEL_STARTING" })).toBe(false);
  });
  it.each(["DISABLED", "REQUESTING", "PERMISSION_DENIED", "CAMERA_BUSY", "SUSPENDED", "MODEL_FAILURE", "ERROR"])(
    "blocks%s camera/model sessions",
    (sessionStatus) => {
      expect(canOpenReachTrial({ ...live, sessionStatus })).toBe(false);
    },
  );
  it("can open while the unchanged150ms source gate rejects stale observations", () => {
    const observation = syntheticObservation({ x: 0.5, y: 0.5 }, 1, 1000);
    const gate = new ObservationGate({
      providerGeneration: observation.providerGeneration,
      cameraLeaseId: observation.cameraLeaseId,
      cameraFrameVersion: observation.cameraFrameVersion,
      orientation: observation.orientation,
      mirrorTransform: observation.mirrorTransform,
    });
    expect(canOpenReachTrial({ ...live, sessionStatus: "STALE_OR_INVALID_OBSERVATION" })).toBe(true);
    expect(() => gate.accept(observation, 1301)).toThrow("FRESHNESS");
  });
  it("can open while a newly invalid index remains ineligible for collection", () => {
    const selector = new ActiveHandSelector();
    const frame = (at: number) => syntheticObservation({ x: 0.5, y: 0.5 }, at, at);
    selector.update(frame(100));
    expect(selector.update(frame(350)).eligible).toBe(true);
    const bad = frame(400);
    bad.hands[0].landmarks[8].valid = false;
    expect(selector.update(bad).eligible).toBe(false);
    expect(canOpenReachTrial(live)).toBe(true);
  });
});
