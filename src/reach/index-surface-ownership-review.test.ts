// @sounding-line-registration owner=reach suite=unit.reach contracts=reach.phase1.foundation
import { describe, expect, it } from "vitest";
import { IndexImageTracker, type IndexGrayFrame, type IndexModelAnchor } from "./index-image-tracker";

// Maximum320px analysis grid makes the8px cap active even though the trusted
// palm-derived radius could exceed it. All anatomy and pixels are analytic D0.
const source = "synthetic-independent-index-surface";
const point = (x: number, y: number) => ({ x: x / 319, y: y / 239 });
const binding = {
  providerGeneration: 1,
  cameraLeaseId: "synthetic-current-index-surface-ownership",
  cameraFrameVersion: 1,
  frameWidth: 640,
  frameHeight: 480,
  mirrorTransform: "NONE" as const,
};
function current(x = 90, y = 90, currentSource = source, cue = false): IndexModelAnchor {
  const index = [96, 64, 32, 0].map((dy) => ({ ...point(x, y + dy), z: 0 })) as unknown as NonNullable<
    IndexModelAnchor["geometry"]
  >["index"];
  return {
    point: point(x, y),
    pointing: true,
    contrary: false,
    identitySource: currentSource,
    identityObserved: true,
    indexIdentityGeometry: { source: currentSource, index, associationBasis: "INDEX_CHAIN_V1" },
    indexIdentityEvidence: {
      source: currentSource,
      associationBasis: "INDEX_CHAIN_V1",
      joints: index.map((joint, i) => ({ index: i + 5, x: joint.x, y: joint.y })),
    },
    otherDigitEvidence: { source: currentSource, points: [], segments: [] },
    handRegion: {
      source: currentSource,
      palmSpan: 0.65,
      points: Array.from({ length: 12 }, (_, i) => point(50 + (i % 2) * 200, 30 + Math.floor(i / 2) * 39)),
    },
    ...(cue
      ? { indexCue: { source: currentSource, index } }
      : { authority: "POINT" as const, authoritySource: currentSource, geometry: { index, palmSpan: 0.65 } }),
  };
}
function pixels(capture: number): IndexGrayFrame {
  const data = new Uint8Array(320 * 240).fill(30);
  for (let dy = -10; dy <= 10; ++dy)
    for (let dx = -10; dx <= 10; ++dx)
      data[(90 + dy) * 320 + 90 + dx] = 45 + ((dx * 73 + dy * 127 + dx * dy * 19 + 100000) % 135);
  return { data, width: 320, height: 240, capture, received: capture + 1 };
}
function establish(tracker: IndexImageTracker, manual = false) {
  let selected;
  for (const at of [100, 166, 233])
    selected = tracker.update(pixels(at), current(), manual && at === 100 ? point(90, 90) : undefined);
  expect(selected).toMatchObject({ state: "TRACKING", coordinateSource: manual ? "IMAGE" : "FUSED" });
  return selected!;
}

describe("current anatomical surface ownership is bounded identity support", () => {
  it.each([3.6, 7.5])(
    "owns a current%s-pixel surface match with a verified large palm but outputs only the model tip",
    (d) => {
      const tracker = new IndexImageTracker(binding);
      const selected = establish(tracker);
      const output = tracker.update(pixels(300), current(90 + d, 50));
      expect(output).toMatchObject({
        state: "TRACKING",
        coordinateSource: "MODEL",
        reason: "INDEX_SHAFT_MODEL_TIP",
        trackId: selected.trackId,
        opticalEpoch: selected.opticalEpoch,
      });
      expect(output.point!.x * 319).toBeCloseTo(90 + d, 5);
      expect(output.point!.y * 239).toBeCloseTo(50, 5);
    },
  );

  it("caps ownership at8px even when the current palm-derived radius would exceed9px", () => {
    const tracker = new IndexImageTracker(binding);
    const selected = establish(tracker);
    expect(0.65 * 319 * 0.08).toBeGreaterThan(9);
    expect(tracker.update(pixels(300), current(99, 50))).toMatchObject({
      point: null,
      reason: "FULL_HAND_INDEX_CONFLICT",
      trackId: selected.trackId,
    });
  });

  it.each(["ABSENT", "TOO_FEW_JOINTS", "INVALID_SPAN", "OTHER_REGION_SOURCE", "INSUFFICIENT_STRUCTURED"] as const)(
    "keeps the3px rule when current credible palm evidence is%s",
    (kind) => {
      const tracker = new IndexImageTracker(binding);
      const selected = establish(tracker);
      const candidate = current(93.6, 50);
      if (kind === "ABSENT") delete candidate.handRegion;
      if (kind === "TOO_FEW_JOINTS") candidate.handRegion!.points = candidate.handRegion!.points.slice(0, 8);
      if (kind === "INVALID_SPAN") candidate.handRegion!.palmSpan = NaN;
      if (kind === "OTHER_REGION_SOURCE") candidate.handRegion!.source = "another-current-region";
      if (kind === "INSUFFICIENT_STRUCTURED") {
        candidate.handRegion!.points = candidate.handRegion!.points.slice(0, 8);
        candidate.handRegion!.structuredSupport = true;
      }
      expect(tracker.update(pixels(300), candidate)).toMatchObject({
        point: null,
        reason: "FULL_HAND_INDEX_CONFLICT",
        trackId: selected.trackId,
      });
    },
  );

  it("does not cold-initialize a cropped cue from a textured surface away from its endpoint", () => {
    const tracker = new IndexImageTracker(binding);
    for (const at of [100, 166, 233, 300])
      expect(tracker.update(pixels(at), current(93.6, 50, source, true))).toMatchObject({ point: null, trackId: null });
  });

  it.each(["MANUAL", "OTHER_SOURCE", "DUPLICATED_INDEX", "REVOKED"] as const)(
    "does not grant surface ownership with%s selection evidence",
    (kind) => {
      const tracker = new IndexImageTracker(binding);
      const selected = establish(tracker, kind === "MANUAL");
      let at = 300;
      if (kind === "REVOKED") {
        expect(tracker.update(pixels(at), current(114)).point).toBeNull();
        at = 366;
      }
      const candidate = current(93.6, 50, kind === "OTHER_SOURCE" ? "different-model-source" : source);
      if (kind === "DUPLICATED_INDEX")
        candidate.indexIdentityEvidence!.joints = candidate.indexIdentityEvidence!.joints.map((joint) =>
          joint.index === 8 ? { ...joint, index: 7 } : joint,
        );
      expect(tracker.update(pixels(at), candidate)).toMatchObject({
        point: null,
        trackId: selected.trackId,
        opticalEpoch: selected.opticalEpoch,
      });
    },
  );

  it("rejects current surface ownership when a rival midsegment is nearer although its endpoints are remote", () => {
    const tracker = new IndexImageTracker(binding);
    const selected = establish(tracker);
    const candidate = current(93.6, 50);
    candidate.otherDigitEvidence = {
      source,
      points: [point(60, 90), point(120, 90)],
      segments: [[point(60, 90), point(120, 90)]],
    };
    expect(tracker.update(pixels(300), candidate)).toMatchObject({
      point: null,
      reason: "FULL_HAND_INDEX_CONFLICT",
      trackId: selected.trackId,
    });
  });
});
