// @sounding-line-registration owner=reach suite=unit.reach contracts=reach.phase1.foundation
import { describe, expect, it } from "vitest";
import { BrowserHandAdapter, type HandResult } from "@/watchglass/hand-provider";
import { pointingPose } from "../../tests/e2e/fixtures/reach/pointing-poses";
import { ObservationGate } from "./observation";
import { syntheticObservation } from "./synthetic";

const binding = {
  providerGeneration: 1,
  cameraLeaseId: "synthetic-atomic-camera",
  cameraFrameVersion: 1,
  mirrorTransform: "NONE" as const,
};
const raw = (): HandResult => ({
  landmarks: [pointingPose()],
  handedness: [[{ categoryName: "Right", score: 0.95 }]],
});

describe("model association and observation admission commit together", () => {
  it("does not bind frame dimensions or consume clocks when origin expires during admission", () => {
    const gate = new ObservationGate({ ...binding, orientation: 0 });
    const first = { ...syntheticObservation({ x: 0.5, y: 0.5 }, 0, 100), ...binding };
    expect(() => gate.accept({ ...first, frameWidth: 1280 }, 110, () => false)).toThrow(
      "OBSERVATION_CLOCK_OR_FRESHNESS",
    );
    expect(gate.accept(first, 110)).toEqual(first);
  });

  it("does not poison adapter identity or sequence with a future inference rejected by the real gate", () => {
    const adapter = new BrowserHandAdapter(binding);
    const gate = new ObservationGate({ ...binding, orientation: 0 });
    const admission = (candidate?: ReturnType<BrowserHandAdapter["envelope"]>) => {
      if (candidate) gate.accept(candidate, 110, () => true);
      return true;
    };
    expect(() => adapter.envelope(raw(), 100, 1000, 640, 480, admission)).toThrow("OBSERVATION_CLOCK_OR_FRESHNESS");
    const accepted = adapter.envelope(raw(), 100, 105, 640, 480, admission);
    expect(accepted.sequence).toBe(0);
    expect(accepted.hands[0].trackGeneration).toBe(1);
  });

  it("preserves the incumbent after a changed frame is rejected before association commits", () => {
    const adapter = new BrowserHandAdapter(binding);
    const gate = new ObservationGate({ ...binding, orientation: 0 });
    const admit = (now: number) => (candidate?: ReturnType<BrowserHandAdapter["envelope"]>) => {
      if (candidate) gate.accept(candidate, now, () => true);
      return true;
    };
    const first = adapter.envelope(raw(), 100, 105, 640, 480, admit(110));
    expect(() => adapter.envelope(raw(), 150, 155, 1280, 480, admit(160))).toThrow("OBSERVATION_FRAME_CHANGED");
    const next = adapter.envelope(raw(), 150, 155, 640, 480, admit(160));
    expect(next.sequence).toBe(1);
    expect(next.hands[0].trackId).toBe(first.hands[0].trackId);
  });
});
