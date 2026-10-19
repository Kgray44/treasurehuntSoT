// @sounding-line-registration owner=reach suite=unit.reach contracts=reach.phase1.foundation
import { describe, expect, it } from "vitest";
import { IndexImageTracker, type IndexModelAnchor } from "./index-image-tracker";
import { selectIndexModelAnchor } from "./hand-detection-authority";
import { syntheticObservation } from "./synthetic";
import { pointingPose } from "../../tests/e2e/fixtures/reach/pointing-poses";

// Analytic D0 pixels and anatomy; no recognition or physical accuracy claim.
const source = "synthetic-selected-index";
const binding = {
  providerGeneration: 1,
  cameraLeaseId: "synthetic-shaft-identity",
  cameraFrameVersion: 1,
  frameWidth: 320,
  frameHeight: 240,
  mirrorTransform: "NONE" as const,
};
type Chain = NonNullable<IndexModelAnchor["geometry"]>["index"];
const point = (x: number, y: number) => ({ x: x / 159, y: y / 119 });
function anchor(
  y = 45,
  options: { source?: string; cue?: boolean; tilt?: boolean; depth?: number } = {},
): IndexModelAnchor {
  const currentSource = options.source ?? source,
    angle = ((options.depth ?? 0) * Math.PI) / 180;
  const index = [48, 32, 16, 0].map((offset) => ({
    ...point(options.tilt ? 25 + offset : 45, options.tilt ? 45 : y + offset * Math.cos(angle)),
    z: (offset * 0.75 * Math.sin(angle)) / 119,
  })) as unknown as Chain;
  return {
    point: { x: index[3].x, y: index[3].y },
    pointing: true,
    contrary: false,
    identitySource: currentSource,
    identityObserved: true,
    indexIdentityEvidence: {
      source: currentSource,
      associationBasis: "INDEX_CHAIN_V1",
      joints: index.map((joint, i) => ({ index: i + 5, x: joint.x, y: joint.y })),
    },
    indexIdentityGeometry: { source: currentSource, associationBasis: "INDEX_CHAIN_V1", index },
    ...(options.cue
      ? { indexCue: { source: currentSource, index } }
      : {
          authority: "POINT" as const,
          authoritySource: currentSource,
          geometry: { index, palmSpan: 0.2 },
        }),
  };
}
function pixels(capture: number, newTip = false, blank = false) {
  const data = new Uint8Array(160 * 120).fill(30);
  const paint = (y: number, seed: number) => {
    for (let dy = -10; dy <= 10; dy++)
      for (let dx = -10; dx <= 10; dx++)
        data[(y + dy) * 160 + 45 + dx] = 45 + ((dx * 73 + dy * 127 + dx * dy * 19 + seed * 41 + 100000) % 135);
  };
  if (!blank) paint(45, 0);
  if (newTip) paint(25, 19);
  return { data, width: 160, height: 120, capture, received: capture + 1 };
}
function establish(tracker: IndexImageTracker, options: { manual?: boolean; depth?: number } = {}) {
  let selected;
  for (const at of [100, 166, 233])
    selected = tracker.update(pixels(at), anchor(45, options), options.manual && at === 100 ? point(45, 45) : null);
  expect(selected).toMatchObject({ state: "TRACKING", coordinateSource: options.manual ? "IMAGE" : "FUSED" });
  return selected!;
}
function region(current: IndexModelAnchor): NonNullable<IndexModelAnchor["handRegion"]> {
  return {
    source,
    palmSpan: 0.2,
    points: Array.from({ length: 12 }, (_, i) => point(20 + (i % 2) * 70, 15 + Math.floor(i / 2) * 19)),
    ...current.handRegion,
  };
}
function observedAnchor(at: number, y = 45, cropped = false, rival = false) {
  const observation = syntheticObservation(point(45, y), at, at);
  Object.assign(observation, binding);
  const hand = observation.hands[0],
    index = anchor(y).geometry!.index;
  const scale = 0.2 / Math.hypot(0.09, 0.03),
    base = index[0];
  hand.continuity = "CONTINUOUS";
  hand.associationBasis = "INDEX_CHAIN_V1";
  hand.landmarks = pointingPose().map((joint) => {
    const x = base.x + (joint.x - 0.45) * scale,
      yy = base.y + (joint.y - 0.5) * scale;
    return { x, y: yy, z: joint.z * scale, valid: x >= 0 && x <= 1 && yy >= 0 && yy <= 1 };
  });
  index.forEach((joint, i) => {
    hand.landmarks[i + 5] = { ...joint, valid: true };
  });
  if (cropped) for (const id of [13, 17]) hand.landmarks[id] = { x: 0, y: 0, z: 0, valid: false };
  if (rival) {
    hand.landmarks[14] = { ...point(20, 45), z: 0, valid: true };
    hand.landmarks[15] = { ...point(75, 45), z: 0, valid: true };
  }
  return selectIndexModelAnchor(observation)!;
}

describe("a selected index shaft match is identity evidence, never a fingertip coordinate", () => {
  it("keeps visible rival segments authoritative after cropping removes the palm hull", () => {
    for (const rival of [false, true]) {
      const tracker = new IndexImageTracker(binding);
      let selected;
      for (const at of [100, 166, 233]) {
        const current = observedAnchor(at);
        expect(current.authority).toBe("POINT");
        selected = tracker.update(pixels(at), current);
      }
      expect(selected).toMatchObject({ state: "TRACKING", coordinateSource: "FUSED" });
      let result;
      for (const at of [300, 366, 433]) {
        const current = observedAnchor(at, 25, true, rival);
        expect(current).not.toHaveProperty("handRegion");
        expect(current.authority).toBeUndefined();
        expect(current.indexCue).toBeDefined();
        expect(current.otherDigitEvidence?.source).toBe(current.identitySource);
        if (rival) {
          expect(current.otherDigitEvidence?.segments).toContainEqual([point(20, 45), point(75, 45)]);
          expect(current.otherDigitEvidence!.points.every((p) => Math.hypot(p.x * 159 - 45, p.y * 119 - 45) > 2)).toBe(
            true,
          );
        }
        result = tracker.update(pixels(at), current);
        if (rival)
          expect(result).toMatchObject({
            point: null,
            trackId: selected!.trackId,
            opticalEpoch: selected!.opticalEpoch,
          });
      }
      if (!rival) {
        expect(result).toMatchObject({
          state: "TRACKING",
          coordinateSource: "MODEL",
          modelSupport: "REGISTERED_INDEX",
          trackId: selected!.trackId,
        });
        expect(result!.point!.y * 119).toBeCloseTo(25, 6);
      }
    }
  });

  it("uses the current model endpoint while shaft pixels stay fixed, then requires independent new-tip probation before a new optical epoch", () => {
    const tracker = new IndexImageTracker(binding),
      first = establish(tracker);
    for (const at of [300, 366, 433]) {
      const current = tracker.update(pixels(at), anchor(25));
      expect(current).toMatchObject({
        state: "TRACKING",
        coordinateSource: "MODEL",
        reason: "INDEX_SHAFT_MODEL_TIP",
        trackId: first.trackId,
        opticalEpoch: first.opticalEpoch,
      });
      expect(current.point!.x * 159).toBeCloseTo(45, 6);
      expect(current.point!.y * 119).toBeCloseTo(25, 6);
      expect(current.point!.y * 119).not.toBeCloseTo(45, 6);
    }
    for (const at of [500, 566])
      expect(tracker.update(pixels(at, true), anchor(25)).opticalEpoch).toBe(first.opticalEpoch);
    const renewed = tracker.update(pixels(633, true), anchor(25));
    expect(renewed.trackId).toBe(first.trackId);
    expect(renewed.opticalEpoch).toBeGreaterThan(first.opticalEpoch!);
    expect(renewed.point!.y * 119).toBeCloseTo(25, 6);
  });

  it("still requires three current cropped-index frames spanning120ms before model-only continuation", () => {
    const tracker = new IndexImageTracker(binding),
      first = establish(tracker);
    for (const at of [300, 366]) expect(tracker.update(pixels(at), anchor(25, { cue: true })).point).toBeNull();
    const current = tracker.update(pixels(433), anchor(25, { cue: true }));
    expect(current).toMatchObject({
      state: "TRACKING",
      coordinateSource: "MODEL",
      modelSupport: "REGISTERED_INDEX",
      trackId: first.trackId,
      opticalEpoch: first.opticalEpoch,
    });
    expect(current.point!.y * 119).toBeCloseTo(25, 6);
  });

  it("rejects a different tilted chain crossing the same patch instead of using intersection as identity", () => {
    const tracker = new IndexImageTracker(binding),
      first = establish(tracker);
    expect(tracker.update(pixels(300), anchor(45, { tilt: true }))).toMatchObject({
      point: null,
      reason: "FULL_HAND_INDEX_CONFLICT",
      trackId: first.trackId,
      opticalEpoch: first.opticalEpoch,
    });
  });

  it.each(["POINT", "SEGMENT"])(
    "abstains when a rival finger %s is equally compatible with the shaft patch",
    (kind) => {
      const tracker = new IndexImageTracker(binding),
        first = establish(tracker),
        current = anchor(25);
      current.handRegion = region(current);
      if (kind === "POINT") current.handRegion.otherFingerPoints = [point(46, 45)];
      else {
        current.handRegion.otherFingerPoints = [point(20, 45), point(75, 45)];
        current.handRegion.otherFingerSegments = [[point(20, 45), point(75, 45)]];
      }
      expect(tracker.update(pixels(300), current)).toMatchObject({
        point: null,
        reason: "FULL_HAND_INDEX_CONFLICT",
        trackId: first.trackId,
      });
    },
  );

  it.each(["MISSING_DISTAL", "DUPLICATED_DISTAL", "OLD_JOINT_POSITIONS", "OTHER_SOURCE", "CONTRARY"])(
    "cannot bridge %s evidence",
    (kind) => {
      const tracker = new IndexImageTracker(binding),
        first = establish(tracker),
        current = anchor(25, { source: kind === "OTHER_SOURCE" ? "other-hand" : source });
      if (kind === "MISSING_DISTAL")
        current.indexIdentityEvidence!.joints = current.indexIdentityEvidence!.joints.slice(0, 3);
      if (kind === "DUPLICATED_DISTAL")
        current.indexIdentityEvidence!.joints = current.indexIdentityEvidence!.joints.map((joint) =>
          joint.index === 8 ? { ...joint, index: 7 } : joint,
        );
      if (kind === "OLD_JOINT_POSITIONS")
        current.indexIdentityEvidence!.joints = anchor().indexIdentityEvidence!.joints;
      if (kind === "CONTRARY") {
        current.authority = "CONTRARY";
        current.pointing = false;
        current.contrary = true;
        current.geometry = undefined;
      }
      expect(tracker.update(pixels(300), current)).toMatchObject({
        point: null,
        trackId: first.trackId,
        opticalEpoch: first.opticalEpoch,
      });
    },
  );

  it("does not treat a short foreshortened endpoint capsule as an independently observed shaft", () => {
    const tracker = new IndexImageTracker(binding),
      first = establish(tracker, { depth: 60 });
    // Tip error9px; the patch is2.35px from a6.65px projected shaft, so the
    // ordinary3px capsule alone is insufficient to distinguish shaft from tip.
    expect(tracker.update(pixels(300), anchor(36, { depth: 78 }))).toMatchObject({
      point: null,
      reason: "FULL_HAND_INDEX_CONFLICT",
      trackId: first.trackId,
    });
  });

  it("does not revive an expired index certificate while the same palm identity remains", () => {
    const tracker = new IndexImageTracker(binding),
      first = establish(tracker);
    for (const at of [300, 500])
      tracker.update(pixels(at), {
        point: null,
        pointing: false,
        contrary: false,
        authority: "AMBIGUOUS",
        authoritySource: source,
        identitySource: source,
      });
    expect(tracker.update(pixels(566), anchor(25))).toMatchObject({
      point: null,
      trackId: first.trackId,
      opticalEpoch: first.opticalEpoch,
    });
  });

  it("does not erase a previous accepted optical contradiction with a later shaft-like intersection", () => {
    const tracker = new IndexImageTracker(binding),
      first = establish(tracker),
      conflicting = anchor();
    conflicting.point!.x += 30 / 159;
    conflicting.geometry!.index = conflicting.geometry!.index.map((joint) => ({
      ...joint,
      x: joint.x + 30 / 159,
    })) as unknown as Chain;
    conflicting.indexIdentityGeometry!.index = conflicting.geometry!.index;
    conflicting.indexIdentityEvidence!.joints = conflicting.geometry!.index.map((joint, i) => ({
      index: i + 5,
      x: joint.x,
      y: joint.y,
    }));
    expect(tracker.update(pixels(300), conflicting).point).toBeNull();
    expect(tracker.update(pixels(366), anchor(25))).toMatchObject({
      point: null,
      trackId: first.trackId,
      opticalEpoch: first.opticalEpoch,
    });
  });

  it("does not let manual selection borrow model shaft identity", () => {
    const tracker = new IndexImageTracker(binding),
      first = establish(tracker, { manual: true });
    expect(tracker.update(pixels(300), anchor(25))).toMatchObject({
      point: null,
      anchorSource: "MANUAL_HINT",
      trackId: first.trackId,
      opticalEpoch: first.opticalEpoch,
    });
  });

  it("rolls back a stale bridge completion so it cannot add a cropped-model probation frame", () => {
    const tracker = new IndexImageTracker(binding),
      first = establish(tracker),
      token = tracker.prepare(pixels(300));
    let clockCalls = 0;
    expect(() => tracker.complete(token, anchor(25, { cue: true }), () => (++clockCalls === 1 ? 301 : 451))).toThrow(
      "INDEX_IMAGE_FRAME_INVALID_OR_STALE",
    );
    for (const [i, at] of [366, 433].entries()) {
      const current = tracker.update(pixels(at), anchor(25, { cue: true }));
      expect(current).toMatchObject({
        point: null,
        trackId: first.trackId,
        sequence: first.sequence + i + 1,
        opticalEpoch: first.opticalEpoch,
      });
    }
    const current = tracker.update(pixels(500), anchor(25, { cue: true }));
    expect(current).toMatchObject({ state: "TRACKING", coordinateSource: "MODEL", trackId: first.trackId });
    expect(current.point!.y * 119).toBeCloseTo(25, 6);
  });
});
