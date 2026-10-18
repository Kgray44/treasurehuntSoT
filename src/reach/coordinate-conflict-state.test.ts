// @sounding-line-registration owner=reach suite=unit.reach contracts=reach.phase1.foundation
import { describe, expect, it } from "vitest";
import { IndexImageTracker, type IndexGrayFrame, type IndexModelAnchor } from "./index-image-tracker";
import { selectIndexModelAnchor } from "./hand-detection-authority";
import { syntheticObservation } from "./synthetic";
import { pointingPose } from "../../tests/e2e/fixtures/reach/pointing-poses";

// Public analytic D0 evidence only. Neither current NN labels nor these
// generated textures establish physical finger recognition or accuracy.
const source = "synthetic-current-index-conflict-state";
const point = (x: number, y = 45) => ({ x: x / 159, y: y / 119 });
const binding = {
  providerGeneration: 1,
  cameraLeaseId: "synthetic-independent-conflict-state",
  cameraFrameVersion: 1,
  frameWidth: 320,
  frameHeight: 240,
  mirrorTransform: "NONE" as const,
};
function model(x = 45, currentSource = source): IndexModelAnchor {
  const index = [24, 16, 8, 0].map((dy) => ({ ...point(x, 45 + dy), z: 0 })) as unknown as NonNullable<
    IndexModelAnchor["geometry"]
  >["index"];
  return {
    point: point(x),
    pointing: true,
    contrary: false,
    authority: "POINT",
    authoritySource: currentSource,
    identitySource: currentSource,
    identityObserved: true,
    geometry: { index, palmSpan: 0.2 },
    indexIdentityGeometry: { source: currentSource, index, associationBasis: "INDEX_CHAIN_V1" },
    indexIdentityEvidence: {
      source: currentSource,
      associationBasis: "INDEX_CHAIN_V1",
      joints: index.map((joint, i) => ({ index: i + 5, x: joint.x, y: joint.y })),
    },
    otherDigitEvidence: { source: currentSource, points: [], segments: [] },
    handRegion: {
      source: currentSource,
      palmSpan: 0.2,
      points: Array.from({ length: 12 }, (_, i) => point(20 + (i % 2) * 100, 40 + Math.floor(i / 2) * 12)),
    },
  };
}
function pixels(capture: number, x = 45, blank = false): IndexGrayFrame {
  const data = new Uint8Array(160 * 120).fill(30);
  if (!blank)
    for (let dy = -10; dy <= 10; ++dy)
      for (let dx = -10; dx <= 10; ++dx)
        data[(45 + dy) * 160 + x + dx] = 45 + ((dx * 73 + dy * 127 + dx * dy * 19 + 100000) % 135);
  return { data, width: 160, height: 120, capture, received: capture + 1 };
}
function establish(tracker: IndexImageTracker, manual = false) {
  let selected;
  for (const at of [100, 166, 233])
    selected = tracker.update(pixels(at), model(), manual && at === 100 ? point(45) : undefined);
  expect(selected).toMatchObject({ state: "TRACKING", coordinateSource: manual ? "IMAGE" : "FUSED" });
  return selected!;
}
function trustedOpticalState(tracker: IndexImageTracker) {
  // These are the trusted optical trajectory, not a display-only conflict
  // candidate. Check their acceptance-clock invariant as well as public output.
  const state = tracker as unknown as {
    point: { x: number; y: number } | null;
    template: unknown;
    previous: unknown;
    velocity: { x: number; y: number };
    acceptedAt: number;
    lastReferenceAt: number;
  };
  return {
    point: state.point && { ...state.point },
    template: state.template,
    previous: state.previous,
    velocity: { ...state.velocity },
    acceptedAt: state.acceptedAt,
    lastReferenceAt: state.lastReferenceAt,
  };
}

function anatomicallyClassifiedModel(at: number, open = false): IndexModelAnchor {
  const observation = syntheticObservation(point(45), at, at);
  Object.assign(observation, binding);
  const hand = observation.hands[0];
  hand.continuity = "CONTINUOUS";
  hand.associationBasis = "INDEX_CHAIN_V1";
  // Keep the index at the same image position while extending the other
  // fingers. The production authority, rather than a fixture flag, must
  // identify this explicit negative posture.
  const scale = (24 * 0.75) / 119 / 0.08;
  hand.landmarks = pointingPose({ indexBends: [0, 0, 0], otherBends: open ? [0, 0, 0] : [0, 65, 110] }).map(
    (joint) => ({
      x: 45 / 159 + (joint.x - 0.45) * scale,
      y: 69 / 119 + (joint.y - 0.5) * scale,
      z: joint.z * scale,
      valid: true,
    }),
  );
  const anchor = selectIndexModelAnchor(observation);
  expect(anchor?.authority).toBe(open ? "CONTRARY" : "POINT");
  return anchor!;
}

describe("unresolved coordinate conflict never becomes fresh image-only authority", () => {
  it("retains a registered cropped-index conflict after current neural anatomy disappears", () => {
    const tracker = new IndexImageTracker(binding);
    const selected = establish(tracker);
    const cue = model(69);
    cue.indexCue = { source, index: cue.geometry!.index };
    delete cue.geometry;
    delete cue.authority;
    delete cue.authoritySource;
    expect(cue.indexIdentityEvidence!.joints.map((joint) => joint.index)).toEqual([5, 6, 7, 8]);
    expect(tracker.update(pixels(300), cue)).toMatchObject({ point: null, trackId: selected.trackId });
    // The accepted old patch remains disputed when the registered finger-only
    // cue vanishes. Its next current match cannot clear the conflict by itself.
    for (const at of [366, 433, 500]) {
      const current = tracker.update(pixels(at, 47));
      expect(current).toMatchObject({ point: null, trackId: selected.trackId });
      expect(current.state).not.toBe("TRACKING");
    }
  });

  it.each([false, true])(
    "retains genuine open-hand negative intent after the model disappears, with blank open pixels=%s",
    (blankDuringOpen) => {
      const tracker = new IndexImageTracker(binding);
      let selected;
      for (const at of [100, 166, 233]) selected = tracker.update(pixels(at), anatomicallyClassifiedModel(at));
      expect(selected).toMatchObject({ state: "TRACKING", coordinateSource: "FUSED" });
      for (const at of [300, 366, 433]) {
        const open = tracker.update(pixels(at, 45, blankDuringOpen), anatomicallyClassifiedModel(at, true));
        expect(open.point).toBeNull();
        expect(open.state).not.toBe("TRACKING");
      }
      // The old feature can reappear and move as a distractor after hand
      // recognition vanishes. That does not establish renewed pointing intent.
      for (let i = 0; i < 8; ++i) {
        const current = tracker.update(pixels(500 + i * 66, 45 + i));
        expect(current.point).toBeNull();
        expect(current.state).not.toBe("TRACKING");
      }
    },
  );

  it("withholds every current candidate after the model disappears, including beyond the ordinary loss grace", () => {
    const tracker = new IndexImageTracker(binding);
    const selected = establish(tracker);
    expect(tracker.update(pixels(300), model(69))).toMatchObject({
      point: null,
      reason: "FULL_HAND_INDEX_CONFLICT",
      trackId: selected.trackId,
    });
    for (let i = 0; i < 20; ++i) {
      const output = tracker.update(pixels(366 + i * 100, 47 + i));
      expect(output.point).toBeNull();
      expect(output.state).not.toBe("TRACKING");
    }
  });

  it("keeps a contradictory matched candidate out of the trusted point, patch, motion and acceptance clocks", () => {
    const tracker = new IndexImageTracker(binding);
    const selected = establish(tracker);
    const before = trustedOpticalState(tracker);
    const conflict = tracker.update(pixels(300, 57), model(81));
    expect(conflict).toMatchObject({
      point: null,
      reason: "FULL_HAND_INDEX_CONFLICT",
      trackId: selected.trackId,
      opticalEpoch: selected.opticalEpoch,
    });
    expect(conflict.matchedPoint).not.toBeNull();
    expect(conflict.matchedPoint!.x * 159).toBeCloseTo(57, 1);
    const after = trustedOpticalState(tracker);
    expect(after.point).toEqual(before.point);
    expect(after.template).toBe(before.template);
    expect(after.previous).toBe(before.previous);
    expect(after.velocity).toEqual(before.velocity);
    expect(after.acceptedAt).toBe(before.acceptedAt);
    expect(after.lastReferenceAt).toBe(before.lastReferenceAt);
  });

  it("recovers the same selected index only after three fresh compatible frames spanning120ms", () => {
    const tracker = new IndexImageTracker(binding);
    const selected = establish(tracker);
    expect(tracker.update(pixels(300), model(69)).point).toBeNull();
    for (const at of [366, 433]) expect(tracker.update(pixels(at), model()).point).toBeNull();
    const recovered = tracker.update(pixels(500), model());
    expect(recovered).toMatchObject({ state: "TRACKING", trackId: selected.trackId });
    expect(recovered.point!.x * 159).toBeCloseTo(45, 1);
    expect(recovered.point!.y * 119).toBeCloseTo(45, 1);
  });

  it.each([250, 251])("uses real compatible image proof only within its %sms age boundary", (proofAge) => {
    const tracker = new IndexImageTracker(binding);
    const selected = establish(tracker);
    expect(tracker.update(pixels(300), model(69)).point).toBeNull();
    expect(tracker.update(pixels(366), model()).point).toBeNull();
    expect(tracker.update(pixels(450, 45, true), model()).point).toBeNull();
    const current = tracker.update(pixels(366 + proofAge, 45, true), model());
    expect(current.trackId).toBe(selected.trackId);
    if (proofAge === 250) {
      expect(current).toMatchObject({ state: "TRACKING", coordinateSource: "MODEL" });
      expect(current.point!.x * 159).toBeCloseTo(45, 1);
    } else {
      expect(current.point).toBeNull();
      expect(current.state).not.toBe("TRACKING");
    }
  });

  it("does not renew its first conflict clock or reuse proof across repeated conflicting images", () => {
    const tracker = new IndexImageTracker(binding);
    establish(tracker);
    tracker.update(pixels(300), model(69));
    tracker.update(pixels(366), model());
    const conflictState = () =>
      (tracker as unknown as { coordinateConflict: { at: number; imageProofAt: number | null } | null })
        .coordinateConflict;
    expect(conflictState()).toMatchObject({ at: 300, imageProofAt: 366 });
    for (const at of [400, 466, 533]) {
      expect(tracker.update(pixels(at), model(69)).point).toBeNull();
      expect(conflictState()).toMatchObject({ at: 300, imageProofAt: null });
    }
    for (const at of [600, 666, 733, 800]) expect(tracker.update(pixels(at, 45, true), model()).point).toBeNull();
    expect(conflictState()).toMatchObject({ at: 300, imageProofAt: null });
  });

  it("lets an explicit manual track recover through current matching pixels and same-source confirmed pointing", () => {
    const tracker = new IndexImageTracker(binding);
    const selected = establish(tracker, true);
    expect(tracker.update(pixels(300), model(69)).point).toBeNull();
    for (const at of [366, 433]) expect(tracker.update(pixels(at), model()).point).toBeNull();
    const current = tracker.update(pixels(500), model());
    expect(current).toMatchObject({
      state: "TRACKING",
      coordinateSource: "IMAGE",
      anchorSource: "MANUAL_HINT",
      trackId: selected.trackId,
      opticalEpoch: selected.opticalEpoch,
    });
    expect(current.point!.x * 159).toBeCloseTo(45, 1);
  });

  it("never lets repeated current model guesses reanchor a conflicted manual track from blank pixels", () => {
    const tracker = new IndexImageTracker(binding);
    const selected = establish(tracker, true);
    expect(tracker.update(pixels(300), model(69)).point).toBeNull();
    for (const at of [366, 433, 500, 566, 633, 700, 766]) {
      const current = tracker.update(pixels(at, 45, true), model());
      expect(current).toMatchObject({ point: null, trackId: selected.trackId, opticalEpoch: selected.opticalEpoch });
      expect(current.coordinateSource).not.toBe("MODEL");
    }
  });

  it.each([false, true])("does not let a different model source clear the conflict for manual=%s", (manual) => {
    const tracker = new IndexImageTracker(binding);
    const selected = establish(tracker, manual);
    expect(tracker.update(pixels(300), model(69)).point).toBeNull();
    for (const at of [366, 433, 500, 566, 633]) {
      const current = tracker.update(pixels(at), model(45, "different-current-model-source"));
      expect(current).toMatchObject({ point: null, trackId: selected.trackId, opticalEpoch: selected.opticalEpoch });
    }
  });

  it.each(["CLOCK", "SOURCE"] as const)("does not clear a live latch during %s-rejected recovery", (kind) => {
    const tracker = new IndexImageTracker(binding);
    establish(tracker);
    tracker.update(pixels(300), model(69));
    tracker.update(pixels(366), model());
    tracker.update(pixels(433), model());
    const token = tracker.prepare(pixels(500));
    let clockCalls = 0;
    let sourceChecks = 0;
    expect(() =>
      tracker.complete(
        token,
        model(),
        () => (kind === "CLOCK" && ++clockCalls > 1 ? 651 : 510),
        () => kind !== "SOURCE" || ++sourceChecks === 1,
      ),
    ).toThrow("INVALID_OR_STALE");
    expect(tracker.update(pixels(566)).point).toBeNull();
  });

  it.each(["CLOCK", "SOURCE"] as const)(
    "rolls back a %s-rejected conflict without leaving a latched candidate",
    (kind) => {
      const tracker = new IndexImageTracker(binding);
      const selected = establish(tracker);
      const before = trustedOpticalState(tracker);
      const token = tracker.prepare(pixels(300, 57));
      let clockCalls = 0;
      let sourceChecks = 0;
      expect(() =>
        tracker.complete(
          token,
          model(81),
          () => (kind === "CLOCK" && ++clockCalls > 1 ? 451 : 310),
          () => kind !== "SOURCE" || ++sourceChecks === 1,
        ),
      ).toThrow("INVALID_OR_STALE");
      expect(trustedOpticalState(tracker)).toEqual(before);
      const current = tracker.update(pixels(366));
      expect(current).toMatchObject({
        state: "TRACKING",
        coordinateSource: "IMAGE",
        sequence: selected.sequence + 1,
        trackId: selected.trackId,
        opticalEpoch: selected.opticalEpoch,
      });
      expect(current.point!.x * 159).toBeCloseTo(45, 1);
    },
  );
});
