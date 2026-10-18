// @sounding-line-registration owner=reach suite=unit.reach contracts=reach.phase1.foundation
import { describe, expect, it } from "vitest";
import {
  IndexImageTracker,
  indexShapeContinues,
  type IndexGrayFrame,
  type IndexModelAnchor,
} from "./index-image-tracker";

// Analytic D0 counterexamples. Complete model metadata deliberately makes these
// eligible proposals; their labels are not physical recognition ground truth.
const source = "adversarial-current-index-and-hand";
const width = 160;
const height = 120;
const binding = {
  providerGeneration: 1,
  cameraLeaseId: "synthetic-independent-fusion-adversaries",
  cameraFrameVersion: 1,
  frameWidth: 320,
  frameHeight: 240,
  mirrorTransform: "NONE" as const,
};
type Point = { x: number; y: number };
type Chain = NonNullable<IndexModelAnchor["geometry"]>["index"];
type Rival = "NONE" | "SHAFT_MIDSEGMENT" | "FORWARD_MIDSEGMENT";
const point = (x: number, y: number): Point => ({ x: x / (width - 1), y: y / (height - 1) });

function currentModel(x = 45, y = 45, rival: Rival = "NONE"): IndexModelAnchor {
  const index = [48, 32, 16, 0].map((offset) => ({ ...point(x, y + offset), z: 0 })) as unknown as Chain;
  const thumb = [point(25, 93), point(18, 75), point(20, 57), point(25, 45)];
  const middle =
    rival === "SHAFT_MIDSEGMENT"
      ? [point(65, 91), point(60, 45), point(30, 45), point(36, 72)]
      : rival === "FORWARD_MIDSEGMENT"
        ? [point(65, 91), point(60, 33), point(30, 33), point(36, 72)]
        : [point(65, 91), point(60, 76), point(70, 81), point(68, 91)];
  const ring = [point(84, 94), point(81, 79), point(91, 83), point(88, 94)];
  const pinky = [point(103, 98), point(98, 85), point(108, 90), point(104, 100)];
  const fingers = [thumb, middle, ring, pinky];
  const otherPoints = fingers.flat();
  const otherSegments = fingers.flatMap((finger) => finger.slice(1).map((joint, i) => [finger[i], joint] as const));
  // A wrong label can preserve the model's same-hand scale and internal index
  // shape. Do not let a changed palm span accidentally reject the adversary.
  const palmSpan = 0.37;
  return {
    point: point(x, y),
    pointing: true,
    contrary: false,
    authority: "POINT",
    authoritySource: source,
    identitySource: source,
    identityObserved: true,
    geometry: { index, palmSpan },
    indexIdentityGeometry: { source, index, associationBasis: "INDEX_CHAIN_V1" },
    indexIdentityEvidence: {
      source,
      associationBasis: "INDEX_CHAIN_V1",
      joints: index.map((joint, i) => ({ index: i + 5, x: joint.x, y: joint.y })),
    },
    otherDigitEvidence: { source, points: otherPoints, segments: otherSegments },
    handRegion: {
      source,
      palmSpan,
      points: [...index, ...otherPoints],
      otherFingerPoints: otherPoints,
      otherFingerSegments: otherSegments,
    },
  };
}

function pixels(at: number, x = 45, y = 45, blank = false): IndexGrayFrame {
  const data = new Uint8Array(width * height).fill(30);
  if (!blank)
    for (let dy = -10; dy <= 10; ++dy)
      for (let dx = -10; dx <= 10; ++dx)
        data[(y + dy) * width + x + dx] = 45 + ((dx * 73 + dy * 127 + dx * dy * 19 + 100000) % 135);
  return { data, width, height, capture: at, received: at + 1 };
}

function expectCompleteCurrentMetadata(anchor: IndexModelAnchor) {
  expect(anchor).toMatchObject({
    authority: "POINT",
    authoritySource: source,
    identitySource: source,
    identityObserved: true,
    indexIdentityEvidence: { source, associationBasis: "INDEX_CHAIN_V1" },
    indexIdentityGeometry: { source, associationBasis: "INDEX_CHAIN_V1" },
    otherDigitEvidence: { source },
    handRegion: { source },
  });
  expect(anchor.indexIdentityEvidence!.joints.map((joint) => joint.index)).toEqual([5, 6, 7, 8]);
  expect(anchor.indexIdentityEvidence!.joints).toHaveLength(4);
  expect(anchor.handRegion!.points).toHaveLength(20);
  expect(anchor.otherDigitEvidence!.points).toHaveLength(16);
  expect(anchor.otherDigitEvidence!.segments).toHaveLength(12);
  for (const p of [...anchor.handRegion!.points, ...anchor.indexIdentityEvidence!.joints]) {
    expect(p.x).toBeGreaterThanOrEqual(0);
    expect(p.x).toBeLessThanOrEqual(1);
    expect(p.y).toBeGreaterThanOrEqual(0);
    expect(p.y).toBeLessThanOrEqual(1);
  }
}

function establish(tracker: IndexImageTracker) {
  let selected;
  for (const at of [100, 166, 233]) {
    const anchor = currentModel();
    expectCompleteCurrentMetadata(anchor);
    selected = tracker.update(pixels(at), anchor);
  }
  expect(selected).toMatchObject({ state: "TRACKING", coordinateSource: "FUSED" });
  expect(selected!.point!.x * 159).toBeCloseTo(45, 6);
  expect(selected!.point!.y * 119).toBeCloseTo(45, 6);
  return selected!;
}

describe("independent fusion adversaries with complete current index metadata", () => {
  it.each([12, 24])(
    "does not promote a same-source rigidly translated wrong model digit by %s pixels",
    (translation) => {
      const tracker = new IndexImageTracker(binding);
      const selected = establish(tracker);
      for (const at of [300, 366, 433, 500, 566, 633]) {
        const wrong = currentModel(45 + translation);
        expectCompleteCurrentMetadata(wrong);
        expect(wrong.geometry!.palmSpan).toBe(currentModel().geometry!.palmSpan);
        expect(indexShapeContinues(currentModel().geometry!.index, wrong.geometry!.index, 0.75, 0.35, 60)).toBe(true);
        const output = tracker.update(pixels(at), wrong);
        expect(output).toMatchObject({
          state: "UNCERTAIN",
          point: null,
          reason: "FULL_HAND_INDEX_CONFLICT",
          trackId: selected.trackId,
          opticalEpoch: selected.opticalEpoch,
        });
      }
      // Removing the contradictory pixels must not let model repetition alone
      // restore permission that the accepted current conflict already revoked.
      for (const at of [700, 766, 833, 900, 966, 1033]) {
        const output = tracker.update(pixels(at, 45, 45, true), currentModel(45 + translation));
        expect(output).toMatchObject({ point: null, trackId: selected.trackId, opticalEpoch: selected.opticalEpoch });
      }
    },
  );

  it("withholds a shaft-like NCC coordinate on an observed rival midsegment despite remote rival joints", () => {
    const tracker = new IndexImageTracker(binding);
    const selected = establish(tracker);
    for (const at of [300, 366, 433, 500]) {
      const current = currentModel(45, 25, "SHAFT_MIDSEGMENT");
      expectCompleteCurrentMetadata(current);
      const segment = current.otherDigitEvidence!.segments[4];
      expect(segment).toEqual([point(60, 45), point(30, 45)]);
      expect(segment.every((p) => Math.hypot(p.x * 159 - 45, p.y * 119 - 45) > 14)).toBe(true);
      const output = tracker.update(pixels(at), current);
      expect(output).toMatchObject({
        point: null,
        reason: "FULL_HAND_INDEX_CONFLICT",
        trackId: selected.trackId,
        opticalEpoch: selected.opticalEpoch,
      });
    }
  });

  it("uses the otherwise identical current shaft proposal when no competing segment is present", () => {
    const tracker = new IndexImageTracker(binding);
    const selected = establish(tracker);
    const output = tracker.update(pixels(300), currentModel(45, 25));
    expect(output).toMatchObject({
      state: "TRACKING",
      coordinateSource: "MODEL",
      reason: "INDEX_SHAFT_MODEL_TIP",
      trackId: selected.trackId,
      opticalEpoch: selected.opticalEpoch,
    });
    expect(output.point!.y * 119).toBeCloseTo(25, 6);
  });

  it("does not retain a forward NCC endpoint on a rival midsegment through the distal-ray corridor", () => {
    const tracker = new IndexImageTracker(binding);
    const selected = establish(tracker);
    for (const at of [300, 366, 433, 500]) {
      const current = currentModel(45, 45, "FORWARD_MIDSEGMENT");
      expectCompleteCurrentMetadata(current);
      expect(current.otherDigitEvidence!.segments[4]).toEqual([point(60, 33), point(30, 33)]);
      const output = tracker.update(pixels(at, 45, 33), current);
      expect(output).toMatchObject({
        point: null,
        reason: "FULL_HAND_INDEX_CONFLICT",
        trackId: selected.trackId,
        opticalEpoch: selected.opticalEpoch,
      });
    }
  });

  it("retains the otherwise identical registered optical endpoint when the distal corridor has no rival", () => {
    const tracker = new IndexImageTracker(binding);
    const selected = establish(tracker);
    const output = tracker.update(pixels(300, 45, 33), currentModel());
    expect(output).toMatchObject({
      state: "TRACKING",
      coordinateSource: "IMAGE",
      reason: "IMAGE_TIP_MODEL_ENDPOINT_UNCERTAIN",
      trackId: selected.trackId,
      opticalEpoch: selected.opticalEpoch,
    });
    expect(output.point!.y * 119).toBeCloseTo(33, 1);
  });
});
