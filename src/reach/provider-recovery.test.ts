// @sounding-line-registration owner=reach suite=unit.reach contracts=reach.phase1.foundation
import { describe, expect, it } from "vitest";
import { BrowserHandAdapter, HAND_CONTINUITY_GRACE_MS } from "@/watchglass/hand-provider";
import { ActiveHandSelector } from "./observation";
import { syntheticObservation } from "./synthetic";

const binding = {
  providerGeneration: 1,
  cameraLeaseId: "recovery-test-camera",
  cameraFrameVersion: 1,
  mirrorTransform: "NONE" as const,
};
const handAt = (x = 0.5) => syntheticObservation({ x, y: 0.5 }, 0, 100).hands[0].landmarks;
const resultAt = (x = 0.5) => ({ landmarks: [handAt(x)], handedness: [] });
const absent = { landmarks: [], handedness: [] };

describe("bounded local hand continuity through brief occlusion", () => {
  it("recovers the same local track after a brief gap without emitting a hand during absence", () => {
    const adapter = new BrowserHandAdapter(binding);
    const first = adapter.envelope(resultAt(), 100, 105, 640, 480).hands[0];
    for (const at of [150, 350, 650, 950]) {
      expect(adapter.envelope(absent, at, at + 5, 640, 480).hands).toEqual([]);
    }
    const recovered = adapter.envelope(resultAt(0.51), 1100, 1105, 640, 480).hands[0];
    expect(recovered).toMatchObject({
      trackId: first.trackId,
      trackGeneration: first.trackGeneration,
      continuity: "CONTINUOUS",
      presenceScore: null,
      trackingScore: null,
    });
  });

  it("expires from the last actually observed hand even when absence observations keep arriving", () => {
    const adapter = new BrowserHandAdapter(binding);
    const first = adapter.envelope(resultAt(), 100, 105, 640, 480).hands[0];
    for (const at of [350, 650, 950, 1200, 1350]) adapter.envelope(absent, at, at + 5, 640, 480);
    const at = 100 + HAND_CONTINUITY_GRACE_MS + 100;
    const recovered = adapter.envelope(resultAt(), at, at + 5, 640, 480).hands[0];
    expect(recovered.trackGeneration).toBeGreaterThan(first.trackGeneration);
    expect(recovered.trackId).not.toBe(first.trackId);
    expect(recovered.continuity).toBe("ACQUIRED");
  });

  it("does not carry an old track to an implausible hand position inside the grace period", () => {
    const adapter = new BrowserHandAdapter(binding);
    const first = adapter.envelope(resultAt(0.25), 100, 105, 640, 480).hands[0];
    adapter.envelope(absent, 400, 405, 640, 480);
    const next = adapter.envelope(resultAt(0.8), 800, 805, 640, 480).hands[0];
    expect(next.trackGeneration).toBeGreaterThan(first.trackGeneration);
    expect(next.continuity).toBe("ACQUIRED");
  });

  it("keeps palm identity through one uncertain index tip and its restoration", () => {
    const adapter = new BrowserHandAdapter(binding);
    const first = adapter.envelope(resultAt(), 100, 105, 640, 480).hands[0];
    const partial = resultAt();
    partial.landmarks[0][8] = { ...partial.landmarks[0][8], x: -1 };
    const uncertain = adapter.envelope(partial, 150, 155, 640, 480).hands[0];
    expect(uncertain).toMatchObject({ trackId: first.trackId, trackGeneration: first.trackGeneration, occluded: true });
    expect(uncertain.landmarks[8].valid).toBe(false);
    const recovered = adapter.envelope(resultAt(), 200, 205, 640, 480).hands[0];
    expect(recovered).toMatchObject({
      trackId: first.trackId,
      trackGeneration: first.trackGeneration,
      continuity: "CONTINUOUS",
    });
  });

  it("pauses selection for an uncertain index tip and reacquires without a context change", () => {
    const adapter = new BrowserHandAdapter(binding);
    const selector = new ActiveHandSelector();
    selector.update(adapter.envelope(resultAt(), 100, 105, 640, 480));
    expect(selector.update(adapter.envelope(resultAt(), 350, 355, 640, 480)).eligible).toBe(true);
    const partial = resultAt();
    partial.landmarks[0][8] = { ...partial.landmarks[0][8], x: -1 };
    expect(selector.update(adapter.envelope(partial, 400, 405, 640, 480))).toMatchObject({
      eligible: false,
      changed: false,
    });
    expect(selector.update(adapter.envelope(resultAt(), 450, 455, 640, 480))).toMatchObject({
      eligible: false,
      changed: false,
      condition: "ACQUIRING",
    });
    expect(selector.update(adapter.envelope(resultAt(), 570, 575, 640, 480))).toMatchObject({
      eligible: true,
      changed: false,
    });
  });

  it("uses an observed palm center without inventing a scale when a palm edge is uncertain", () => {
    const adapter = new BrowserHandAdapter(binding);
    const first = adapter.envelope(resultAt(), 100, 105, 640, 480).hands[0];
    const partial = resultAt();
    partial.landmarks[0][5] = { ...partial.landmarks[0][5], x: -1 };
    const uncertain = adapter.envelope(partial, 150, 155, 640, 480).hands[0];
    expect(uncertain).toMatchObject({ trackId: first.trackId, trackGeneration: first.trackGeneration, occluded: true });
    const recovered = adapter.envelope(resultAt(), 200, 205, 640, 480).hands[0];
    expect(recovered.trackId).toBe(first.trackId);
  });

  it("pauses an insufficient palm frame and recovers its unrefreshed prior track", () => {
    const adapter = new BrowserHandAdapter(binding);
    const first = adapter.envelope(resultAt(), 100, 105, 640, 480).hands[0];
    const partial = resultAt();
    for (const index of [0, 5]) partial.landmarks[0][index] = { ...partial.landmarks[0][index], x: -1 };
    for (const at of [200, 500, 800]) {
      const uncertain = adapter.envelope(partial, at, at + 5, 640, 480).hands[0];
      expect(uncertain.continuity).toBe("AMBIGUOUS");
      expect(uncertain.occluded).toBe(true);
    }
    const recovered = adapter.envelope(resultAt(), 1100, 1105, 640, 480).hands[0];
    expect(recovered).toMatchObject({
      trackId: first.trackId,
      trackGeneration: first.trackGeneration,
      continuity: "CONTINUOUS",
    });
  });

  it("does not refresh a missing palm through repeated partial frames", () => {
    const adapter = new BrowserHandAdapter(binding);
    const first = adapter.envelope(resultAt(), 100, 105, 640, 480).hands[0];
    const partial = resultAt();
    for (const index of [0, 5]) partial.landmarks[0][index] = { ...partial.landmarks[0][index], x: -1 };
    for (const at of [200, 500, 800, 1100, 1350]) adapter.envelope(partial, at, at + 5, 640, 480);
    const recovered = adapter.envelope(resultAt(), 1400, 1405, 640, 480).hands[0];
    expect(recovered.trackId).not.toBe(first.trackId);
    expect(recovered.continuity).toBe("ACQUIRED");
  });

  it("retains an occluded track when an incidental other hand remains visible", () => {
    const adapter = new BrowserHandAdapter(binding);
    const first = adapter.envelope(resultAt(0.25), 100, 105, 640, 480).hands[0];
    const other = adapter.envelope(resultAt(0.8), 400, 405, 640, 480).hands[0];
    expect(other.trackId).not.toBe(first.trackId);
    const recovered = adapter.envelope({ landmarks: [handAt(0.8), handAt(0.25)], handedness: [] }, 900, 905, 640, 480);
    expect(recovered.hands[0].trackId).toBe(other.trackId);
    expect(recovered.hands[1]).toMatchObject({
      trackId: first.trackId,
      trackGeneration: first.trackGeneration,
      continuity: "CONTINUOUS",
    });
  });

  it("retires crossed tracks immediately so separation cannot resurrect them within the grace period", () => {
    const adapter = new BrowserHandAdapter(binding);
    const first = adapter.envelope({ landmarks: [handAt(0.35), handAt(0.65)], handedness: [] }, 100, 105, 640, 480);
    const crossing = adapter.envelope({ landmarks: [handAt(0.49), handAt(0.51)], handedness: [] }, 150, 155, 640, 480);
    expect(crossing.hands.every((hand) => hand.continuity === "AMBIGUOUS")).toBe(true);
    adapter.envelope(absent, 350, 355, 640, 480);
    const separated = adapter.envelope({ landmarks: [handAt(0.35), handAt(0.65)], handedness: [] }, 700, 705, 640, 480);
    expect(separated.hands.every((hand) => hand.continuity === "ACQUIRED")).toBe(true);
    expect(separated.hands.every((hand) => !first.hands.some((old) => old.trackId === hand.trackId))).toBe(true);
  });
});
