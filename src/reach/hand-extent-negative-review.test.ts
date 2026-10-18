// @sounding-line-registration owner=reach suite=unit.reach contracts=reach.phase1.foundation
import { describe, expect, it } from "vitest";
import { IndexImageTracker, type IndexGrayFrame, type IndexModelAnchor } from "./index-image-tracker";

// D0 same-hand extent and analytic pixels. The upper patch stands for a
// distinct outside-hand region; these fixtures make no photographic claim.
const source = "independent-negative-hand-extent";
const point = (x: number, y: number) => ({ x: x / 159, y: y / 119 });
const binding = {
  providerGeneration: 1,
  cameraLeaseId: "synthetic-revoked-index-negative-extent",
  cameraFrameVersion: 1,
  frameWidth: 320,
  frameHeight: 240,
  mirrorTransform: "NONE" as const,
};
function currentModel(): IndexModelAnchor {
  const index = [24, 16, 8, 0].map((dy) => ({ ...point(45, 45 + dy), z: 0 })) as unknown as NonNullable<
    IndexModelAnchor["geometry"]
  >["index"];
  return {
    point: point(45, 45),
    pointing: true,
    contrary: false,
    authority: "POINT",
    authoritySource: source,
    identitySource: source,
    identityObserved: true,
    geometry: { index, palmSpan: 0.2 },
    indexIdentityGeometry: { source, index, associationBasis: "INDEX_CHAIN_V1" },
    indexIdentityEvidence: {
      source,
      associationBasis: "INDEX_CHAIN_V1",
      joints: index.map((joint, i) => ({ index: i + 5, x: joint.x, y: joint.y })),
    },
    otherDigitEvidence: { source, points: [], segments: [] },
    handRegion: {
      source,
      palmSpan: 0.2,
      points: Array.from({ length: 12 }, (_, i) => point(20 + (i % 2) * 80, 45 + Math.floor(i / 2) * 12)),
    },
  };
}
function pixels(capture: number, x = 45, y = 45): IndexGrayFrame {
  const data = new Uint8Array(160 * 120).fill(30);
  for (let dy = -10; dy <= 10; dy++)
    for (let dx = -10; dx <= 10; dx++)
      data[(y + dy) * 160 + x + dx] = 45 + ((dx * 73 + dy * 127 + dx * dy * 19 + 100000) % 135);
  return { data, width: 160, height: 120, capture, received: capture + 1 };
}
function revokeIndexWithCurrentInsideHandConflict(tracker: IndexImageTracker) {
  let selected;
  for (const at of [100, 166, 233]) selected = tracker.update(pixels(at), currentModel());
  expect(selected).toMatchObject({ state: "TRACKING", coordinateSource: "FUSED" });
  const conflicting = tracker.update(pixels(300, 69, 45), currentModel());
  expect(conflicting).toMatchObject({
    point: null,
    reason: "FULL_HAND_INDEX_CONFLICT",
    trackId: selected!.trackId,
    opticalEpoch: selected!.opticalEpoch,
  });
  return selected!;
}

describe("current hand extent remains negative evidence after index permission is revoked", () => {
  it("rejects an outside-hand match while preserving the revoked coordinate permission", () => {
    const tracker = new IndexImageTracker(binding);
    const selected = revokeIndexWithCurrentInsideHandConflict(tracker);
    for (const at of [366, 433, 500, 566, 633]) {
      // Current index is still45,45. The accepted appearance moves from an
      // inside-hand rival at69,45 to69,22, beyond the conservative hull margin.
      const output = tracker.update(pixels(at, 69, 22), currentModel());
      expect(output).toMatchObject({
        point: null,
        matchedPoint: null,
        reason: "IMAGE_OUTSIDE_OBSERVED_HAND",
        trackId: selected.trackId,
        opticalEpoch: selected.opticalEpoch,
      });
      expect(output.quality.correlation).toBeGreaterThanOrEqual(0.75);
      expect(output.coordinateSource).not.toBe("MODEL");
      expect(output.coordinateSource).not.toBe("FUSED");
    }
  });

  it.each(["NO_CURRENT_HAND_IDENTITY", "OTHER_HAND_EXTENT", "INSUFFICIENT_EXTENT"] as const)(
    "cannot use %s to discard a conflicting current image",
    (condition) => {
      const tracker = new IndexImageTracker(binding);
      const selected = revokeIndexWithCurrentInsideHandConflict(tracker);
      const current = currentModel();
      if (condition === "NO_CURRENT_HAND_IDENTITY") delete current.identitySource;
      if (condition === "OTHER_HAND_EXTENT") current.handRegion!.source = "another-observed-hand";
      if (condition === "INSUFFICIENT_EXTENT") current.handRegion!.points = current.handRegion!.points.slice(0, 8);
      const output = tracker.update(pixels(366, 69, 22), current);
      expect(output).toMatchObject({
        point: null,
        reason: "FULL_HAND_INDEX_CONFLICT",
        trackId: selected.trackId,
        opticalEpoch: selected.opticalEpoch,
      });
    },
  );
});
