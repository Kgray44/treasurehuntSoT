// @sounding-line-registration owner=reach suite=unit.reach contracts=reach.phase1.foundation
import { describe, expect, it } from "vitest";
import { BrowserHandAdapter, HAND_CONTINUITY_GRACE_MS, type HandResult } from "@/watchglass/hand-provider";
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
      eligible: true,
      changed: false,
      condition: "READY",
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

describe("bounded recent-motion palm association", () => {
  const scaledResultAt = (x: number, factor: number) => {
    const landmarks = handAt(x);
    const palm = [0, 5, 9, 17].map((i) => landmarks[i]);
    const center = {
      x: palm.reduce((sum, p) => sum + p.x, 0) / palm.length,
      y: palm.reduce((sum, p) => sum + p.y, 0) / palm.length,
    };
    return {
      landmarks: [
        landmarks.map((p) => ({
          x: center.x + (p.x - center.x) * factor,
          y: center.y + (p.y - center.y) * factor,
          z: p.z * factor,
        })),
      ],
      handedness: [],
    };
  };

  it.each([
    { axis: "x", positions: [0.15, 0.27, 0.43, 0.59, 0.75] },
    { axis: "x", positions: [0.75, 0.63, 0.47, 0.31, 0.15] },
    { axis: "y", positions: [0.15, 0.27, 0.43, 0.59, 0.75] },
  ])("retains a coherent $axis trajectory through 0.16-frame steps at 50 ms intervals", ({ axis, positions }) => {
    const adapter = new BrowserHandAdapter(binding);
    let initialId: string | undefined;
    for (const [index, position] of positions.entries()) {
      const point = axis === "x" ? { x: position, y: 0.5 } : { x: 0.5, y: position };
      const landmarks = syntheticObservation(point, 0, 100).hands[0].landmarks;
      const at = 100 + index * 50;
      const hand = adapter.envelope({ landmarks: [landmarks], handedness: [] }, at, at + 5, 640, 480).hands[0];
      initialId ??= hand.trackId;
      expect(hand.trackId).toBe(initialId);
      expect(hand.continuity).toBe(index ? "CONTINUOUS" : "ACQUIRED");
    }
  });

  it("requires two prior reliable palm centers before extending the static radius", () => {
    const adapter = new BrowserHandAdapter(binding);
    const first = adapter.envelope(resultAt(0.2), 100, 105, 640, 480).hands[0];
    const next = adapter.envelope(resultAt(0.36), 150, 155, 640, 480).hands[0];
    expect(next.trackId).not.toBe(first.trackId);
    expect(next.continuity).toBe("ACQUIRED");
  });

  it.each([
    { scales: [1, 1, 5], reason: "five-fold current palm size" },
    { scales: [1, 1, 1.4], reason: "sudden relative size change" },
    { scales: [1, 1.35, 1.35], reason: "incoherent historical palm size" },
  ])("does not extend motion through $reason", ({ scales }) => {
    const adapter = new BrowserHandAdapter(binding);
    const first = adapter.envelope(scaledResultAt(0.2, scales[0]), 100, 105, 640, 480).hands[0];
    expect(adapter.envelope(scaledResultAt(0.32, scales[1]), 150, 155, 640, 480).hands[0].trackId).toBe(first.trackId);
    const next = adapter.envelope(scaledResultAt(0.48, scales[2]), 200, 205, 640, 480).hands[0];
    expect(next.landmarks.every((p) => p.valid)).toBe(true);
    expect(next.pose).toBe("POINT_CANDIDATE");
    expect(next.trackId).not.toBe(first.trackId);
    expect(next.continuity).toBe("ACQUIRED");
  });

  it("retains coherent motion with small natural palm-scale variation", () => {
    const adapter = new BrowserHandAdapter(binding);
    const first = adapter.envelope(scaledResultAt(0.2, 1), 100, 105, 640, 480).hands[0];
    adapter.envelope(scaledResultAt(0.32, 1.03), 150, 155, 640, 480);
    const next = adapter.envelope(scaledResultAt(0.48, 1.06), 200, 205, 640, 480).hands[0];
    expect(next.trackId).toBe(first.trackId);
    expect(next.continuity).toBe("CONTINUOUS");
  });

  it("preserves the existing ordinary spatial matcher without using prediction", () => {
    const adapter = new BrowserHandAdapter(binding);
    const first = adapter.envelope(scaledResultAt(0.48, 1), 100, 105, 640, 480).hands[0];
    const next = adapter.envelope(scaledResultAt(0.48, 5), 150, 155, 640, 480).hands[0];
    expect(next.trackId).toBe(first.trackId);
    expect(next.continuity).toBe("CONTINUOUS");
  });

  it("rejects an abrupt direction change outside the original spatial radius", () => {
    const adapter = new BrowserHandAdapter(binding);
    const first = adapter.envelope(resultAt(0.2), 100, 105, 640, 480).hands[0];
    expect(adapter.envelope(resultAt(0.32), 150, 155, 640, 480).hands[0].trackId).toBe(first.trackId);
    const jump = adapter.envelope(resultAt(0.12), 200, 205, 640, 480).hands[0];
    expect(jump.trackId).not.toBe(first.trackId);
    expect(jump.continuity).toBe("ACQUIRED");
  });

  it("rejects a step above the absolute displacement cap even near a predicted path", () => {
    const adapter = new BrowserHandAdapter(binding);
    const first = adapter.envelope(resultAt(0.15), 100, 105, 640, 480).hands[0];
    expect(adapter.envelope(resultAt(0.28), 125, 130, 640, 480).hands[0].trackId).toBe(first.trackId);
    const jump = adapter.envelope(resultAt(0.53), 175, 180, 640, 480).hands[0];
    expect(jump.trackId).not.toBe(first.trackId);
    expect(jump.continuity).toBe("ACQUIRED");
  });

  it("caps a very short history interval instead of extrapolating its unbounded velocity", () => {
    const adapter = new BrowserHandAdapter(binding);
    const first = adapter.envelope(resultAt(0.15), 100, 105, 640, 480).hands[0];
    adapter.envelope(resultAt(0.28), 110, 115, 640, 480);
    const next = adapter.envelope(resultAt(0.5), 160, 165, 640, 480).hands[0];
    expect(next.trackId).toBe(first.trackId);
    expect(next.continuity).toBe("CONTINUOUS");
  });

  it("does not extrapolate across a gap longer than 200 ms", () => {
    const adapter = new BrowserHandAdapter(binding);
    const first = adapter.envelope(resultAt(0.2), 100, 105, 640, 480).hands[0];
    adapter.envelope(resultAt(0.32), 150, 155, 640, 480);
    const next = adapter.envelope(resultAt(0.48), 351, 356, 640, 480).hands[0];
    expect(next.trackId).not.toBe(first.trackId);
    expect(next.continuity).toBe("ACQUIRED");
  });

  it("clears motion history during a missing-hand observation, preserving only ordinary recovery", () => {
    const adapter = new BrowserHandAdapter(binding);
    const first = adapter.envelope(resultAt(0.2), 100, 105, 640, 480).hands[0];
    adapter.envelope(resultAt(0.32), 150, 155, 640, 480);
    adapter.envelope(absent, 175, 180, 640, 480);
    const next = adapter.envelope(resultAt(0.48), 200, 205, 640, 480).hands[0];
    expect(next.trackId).not.toBe(first.trackId);
  });

  it("does not derive motion from an insufficient palm observation", () => {
    const adapter = new BrowserHandAdapter(binding);
    const first = adapter.envelope(resultAt(0.2), 100, 105, 640, 480).hands[0];
    adapter.envelope(resultAt(0.32), 150, 155, 640, 480);
    const partial = resultAt(0.32);
    for (const index of [0, 5]) partial.landmarks[0][index] = { ...partial.landmarks[0][index], x: -1 };
    expect(adapter.envelope(partial, 175, 180, 640, 480).hands[0].continuity).toBe("AMBIGUOUS");
    const next = adapter.envelope(resultAt(0.48), 200, 205, 640, 480).hands[0];
    expect(next.trackId).not.toBe(first.trackId);
  });

  it("rejects equally plausible predicted tracks and retires their generations", () => {
    const adapter = new BrowserHandAdapter(binding);
    const first = adapter.envelope({ landmarks: [handAt(0.2), handAt(0.8)], handedness: [] }, 100, 105, 640, 480);
    adapter.envelope({ landmarks: [handAt(0.33), handAt(0.67)], handedness: [] }, 150, 155, 640, 480);
    const ambiguous = adapter.envelope(resultAt(0.5), 200, 205, 640, 480).hands[0];
    expect(ambiguous.continuity).toBe("AMBIGUOUS");
    const separated = adapter.envelope({ landmarks: [handAt(0.33), handAt(0.67)], handedness: [] }, 250, 255, 640, 480);
    expect(separated.hands.every((hand) => !first.hands.some((old) => old.trackId === hand.trackId))).toBe(true);
  });

  it("never uses prediction to resolve an ambiguous ordinary spatial association", () => {
    const adapter = new BrowserHandAdapter(binding);
    adapter.envelope({ landmarks: [handAt(0.2), handAt(0.52)], handedness: [] }, 100, 105, 640, 480);
    adapter.envelope({ landmarks: [handAt(0.33), handAt(0.52)], handedness: [] }, 150, 155, 640, 480);
    expect(adapter.envelope(resultAt(0.425), 200, 205, 640, 480).hands[0].continuity).toBe("AMBIGUOUS");
  });

  it("retires crossing trajectories even when each has a recent motion history", () => {
    const adapter = new BrowserHandAdapter(binding);
    const first = adapter.envelope({ landmarks: [handAt(0.2), handAt(0.8)], handedness: [] }, 100, 105, 640, 480);
    adapter.envelope({ landmarks: [handAt(0.33), handAt(0.67)], handedness: [] }, 150, 155, 640, 480);
    const crossing = adapter.envelope({ landmarks: [handAt(0.49), handAt(0.51)], handedness: [] }, 200, 205, 640, 480);
    expect(crossing.hands.every((hand) => hand.continuity === "AMBIGUOUS")).toBe(true);
    const separated = adapter.envelope({ landmarks: [handAt(0.33), handAt(0.67)], handedness: [] }, 250, 255, 640, 480);
    expect(separated.hands.every((hand) => !first.hands.some((old) => old.trackId === hand.trackId))).toBe(true);
  });
});

describe("conservative duplicate model hypotheses", () => {
  const right = { categoryName: "Right", score: 0.95 };
  const pair = (a: HandResult["landmarks"][number] = handAt(), b: HandResult["landmarks"][number] = handAt()) => ({
    landmarks: [a, b],
    handedness: [[right], [right]],
  });

  it("suppresses an exact duplicate and retains the single local track", () => {
    const adapter = new BrowserHandAdapter(binding);
    const first = adapter.envelope({ landmarks: [handAt()], handedness: [[right]] }, 100, 105, 640, 480).hands[0];
    const duplicated = adapter.envelope(pair(), 150, 155, 640, 480);
    expect(duplicated.hands).toHaveLength(1);
    expect(duplicated.reason).toBe("NONE");
    expect(duplicated.hands[0]).toMatchObject({
      trackId: first.trackId,
      trackGeneration: first.trackGeneration,
      continuity: "CONTINUOUS",
      presenceScore: null,
      trackingScore: null,
    });
  });

  it("suppresses a near-identical full pose with small joint noise and a common depth offset", () => {
    const adapter = new BrowserHandAdapter(binding);
    const first = adapter.envelope({ landmarks: [handAt()], handedness: [[right]] }, 100, 105, 640, 480).hands[0];
    const noisy = handAt().map((p, i) => ({
      x: p.x + Math.sin(i) * 0.0003,
      y: p.y + Math.cos(i) * 0.0002,
      z: p.z + 0.004 + Math.sin(i) * 0.0001,
    }));
    const duplicated = adapter.envelope(pair(noisy, handAt()), 150, 155, 640, 480);
    expect(duplicated.hands).toHaveLength(1);
    expect(duplicated.hands[0].trackId).toBe(first.trackId);
  });

  it("prefers prior spatial continuity consistently when duplicate array order reverses", () => {
    const adapter = new BrowserHandAdapter(binding);
    const stable = handAt();
    const offset = stable.map((p) => ({ ...p, x: p.x + 0.001 }));
    const first = adapter.envelope({ landmarks: [stable], handedness: [[right]] }, 100, 105, 640, 480).hands[0];
    for (const [index, landmarks] of [
      [offset, stable],
      [stable, offset],
    ].entries()) {
      const at = 150 + index * 50;
      const next = adapter.envelope({ landmarks, handedness: [[right], [right]] }, at, at + 5, 640, 480);
      expect(next.hands).toHaveLength(1);
      expect(next.hands[0].trackId).toBe(first.trackId);
      expect(next.hands[0].landmarks).toEqual(first.landmarks);
    }
  });

  it("uses a deterministic geometric tie-break before any local track exists", () => {
    const stable = handAt();
    const offset = stable.map((p) => ({ ...p, x: p.x + 0.001 }));
    const a = new BrowserHandAdapter(binding).envelope(pair(offset, stable), 100, 105, 640, 480);
    const b = new BrowserHandAdapter(binding).envelope(pair(stable, offset), 100, 105, 640, 480);
    expect(a.hands).toHaveLength(1);
    expect(b.hands).toHaveLength(1);
    expect(a.hands[0].landmarks).toEqual(b.hands[0].landmarks);
  });

  it("supports duplicate hypotheses with matching clipped wrists using visible index-relative geometry", () => {
    const adapter = new BrowserHandAdapter(binding);
    const first = adapter.envelope({ landmarks: [handAt()], handedness: [[right]] }, 100, 105, 640, 480).hands[0];
    const clipped = handAt();
    clipped[0] = { ...clipped[0], y: 1.1 };
    const noisy = clipped.map((p, i) => ({ ...p, x: p.x + Math.sin(i) * 0.0002, z: p.z + 0.003 }));
    const next = adapter.envelope(pair(noisy, clipped), 150, 155, 640, 480);
    expect(next.hands).toHaveLength(1);
    expect(next.hands[0].trackId).toBe(first.trackId);
    expect(next.hands[0].landmarks[0].valid).toBe(false);
    expect(next.hands[0].continuity).toBe("CONTINUOUS");
  });

  it.each(["FINGER_GEOMETRY", "RELATIVE_DEPTH", "PARTIAL_FINGER_GEOMETRY"])(
    "keeps genuinely different overlapping visible evidence ambiguous: %s",
    (kind) => {
      const adapter = new BrowserHandAdapter(binding);
      const a = handAt(),
        b = handAt();
      if (kind === "RELATIVE_DEPTH") b[8] = { ...b[8], z: 0.02 };
      else b[8] = { ...b[8], x: b[8].x + 0.01 };
      if (kind === "PARTIAL_FINGER_GEOMETRY") {
        a[0] = { ...a[0], y: 1.1 };
        b[0] = { ...b[0], y: 1.1 };
      }
      const next = adapter.envelope(pair(a, b), 100, 105, 640, 480);
      expect(next.hands).toHaveLength(2);
      expect(next.hands.every((hand) => hand.continuity === "AMBIGUOUS")).toBe(true);
    },
  );

  it("keeps opposite-handed overlapping hypotheses ambiguous", () => {
    const adapter = new BrowserHandAdapter(binding);
    const next = adapter.envelope(
      {
        landmarks: [handAt(), handAt()],
        handedness: [[right], [{ categoryName: "Left", score: 0.95 }]],
      },
      100,
      105,
      640,
      480,
    );
    expect(next.hands).toHaveLength(2);
    expect(next.hands.every((hand) => hand.continuity === "AMBIGUOUS")).toBe(true);
  });

  it.each(["UNKNOWN", "WEAK", "VISIBILITY_MISMATCH", "SPARSE"])(
    "abstains when duplicate evidence is incomplete: %s",
    (kind) => {
      const adapter = new BrowserHandAdapter(binding);
      const input = pair();
      if (kind === "UNKNOWN") input.handedness = [];
      if (kind === "WEAK") input.handedness[1] = [{ ...right, score: 0.79 }];
      if (kind === "VISIBILITY_MISMATCH") input.landmarks[1][0] = { ...input.landmarks[1][0], y: 1.1 };
      if (kind === "SPARSE")
        for (const hand of input.landmarks)
          for (const index of [0, 1, 2, 3, 4, 13, 14]) hand[index] = { ...hand[index], x: -1 };
      const next = adapter.envelope(input, 100, 105, 640, 480);
      expect(next.hands).toHaveLength(2);
      expect(next.hands.every((hand) => hand.continuity === "AMBIGUOUS")).toBe(true);
    },
  );

  it("never collapses two previously separate local tracks into a duplicate", () => {
    const adapter = new BrowserHandAdapter(binding);
    const first = adapter.envelope(pair(handAt(0.3), handAt(0.7)), 100, 105, 640, 480);
    const overlap = adapter.envelope(pair(handAt(0.5), handAt(0.5002)), 150, 155, 640, 480);
    expect(overlap.hands).toHaveLength(2);
    expect(overlap.hands.every((hand) => hand.continuity === "AMBIGUOUS")).toBe(true);
    const separated = adapter.envelope(pair(handAt(0.3), handAt(0.7)), 200, 205, 640, 480);
    expect(separated.hands.every((hand) => !first.hands.some((old) => old.trackId === hand.trackId))).toBe(true);
  });

  it("keeps disjoint hands independently tracked", () => {
    const adapter = new BrowserHandAdapter(binding);
    const first = adapter.envelope(pair(handAt(0.3), handAt(0.7)), 100, 105, 640, 480);
    const next = adapter.envelope(pair(handAt(0.31), handAt(0.71)), 150, 155, 640, 480);
    expect(next.hands).toHaveLength(2);
    expect(next.hands.map((hand) => hand.trackId)).toEqual(first.hands.map((hand) => hand.trackId));
    expect(next.hands.every((hand) => hand.continuity === "CONTINUOUS")).toBe(true);
  });
});
