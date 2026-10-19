// @sounding-line-registration owner=reach suite=unit.reach contracts=reach.phase1.foundation
import { describe, expect, it } from "vitest";
import { BrowserHandAdapter, type HandResult } from "./hand-provider";
import { indexGeometry } from "./index-geometry";
import { selectIndexModelAnchor } from "@/reach/hand-detection-authority";
import { IndexImageTracker } from "@/reach/index-image-tracker";
import { pointingPose } from "../../tests/e2e/fixtures/reach/pointing-poses";

const binding = {
  providerGeneration: 1,
  cameraLeaseId: "synthetic-palm-rejoin",
  cameraFrameVersion: 1,
  frameWidth: 640,
  frameHeight: 480,
  mirrorTransform: "NONE" as const,
};
type Pose = ReturnType<typeof pointingPose>;
const missing = { x: -1, y: -1, z: 0, valid: false };
function original(): Pose {
  const points = pointingPose({ indexBends: [0, 10, 20] });
  points[0] = { ...missing };
  return points;
}
function palmOnly(): Pose {
  const points = original();
  for (const id of [6, 7, 8]) points[id] = { ...points[5] };
  for (const id of [12, 16, 20]) points[id] = { ...missing };
  return points;
}
function wrong(cropped = false): Pose {
  const points = original();
  // A complete plausible model chain on the other side of the same MCP row.
  // Its mean remains within the old ordinary radius, but the distal joints do not.
  for (const id of [6, 7, 8]) points[id].y = points[5].y * 2 - points[id].y;
  if (cropped) for (let id = 0; id < points.length; id++) if (id < 5 || id > 8) points[id] = { ...missing };
  return points;
}
function observe(adapter: BrowserHandAdapter, at: number, points: Pose) {
  const result: HandResult = { landmarks: [points], handedness: [] };
  return adapter.envelope(result, at, at + 1, 640, 480);
}
function pixels(at: number, textured = false) {
  const data = new Uint8Array(160 * 120).fill(30);
  if (textured) {
    const tip = original()[8],
      x = Math.round(tip.x * 159),
      y = Math.round(tip.y * 119);
    for (let dy = -10; dy <= 10; dy++)
      for (let dx = -10; dx <= 10; dx++)
        data[(y + dy) * 160 + x + dx] = 45 + ((dx * 73 + dy * 127 + dx * dy * 19 + 100000) % 135);
  }
  return { data, width: 160, height: 120, capture: at, received: at + 1 };
}

describe("a palm observation cannot replace the pre-palm index reference", () => {
  it("keeps every complete but displaced palm-matched chain on the palm basis until the preserved index truly rejoins", () => {
    const adapter = new BrowserHandAdapter(binding),
      first = observe(adapter, 100, original()).hands[0];
    expect(observe(adapter, 150, palmOnly()).hands[0]).toMatchObject({
      trackId: first.trackId,
      associationBasis: "OBSERVED_PALM_CONTINUITY_V1",
    });
    for (const at of [200, 250, 300]) {
      const current = observe(adapter, at, wrong());
      expect(indexGeometry(current.hands[0], current).geometry).toBe(true);
      expect(current.hands[0]).toMatchObject({
        trackId: first.trackId,
        continuity: "CONTINUOUS",
        associationBasis: "OBSERVED_PALM_CONTINUITY_V1",
      });
    }
    expect(observe(adapter, 350, original()).hands[0]).toMatchObject({
      trackId: first.trackId,
      continuity: "CONTINUOUS",
      associationBasis: "INDEX_CHAIN_V1",
    });
  });

  it("cannot convert a short palm-only match into cropped wrong-digit index registration in the actual producer", () => {
    const adapter = new BrowserHandAdapter(binding),
      tracker = new IndexImageTracker(binding);
    let selected;
    for (const at of [100, 166, 233, 300]) {
      const observation = observe(adapter, at, original());
      selected = tracker.update(pixels(at, true), selectIndexModelAnchor(observation));
    }
    expect(selected).toMatchObject({ state: "TRACKING", coordinateSource: "FUSED" });
    const originalHand = observe(adapter, 350, palmOnly());
    expect(tracker.update(pixels(350), selectIndexModelAnchor(originalHand))).toMatchObject({
      trackId: selected!.trackId,
      point: null,
    });
    const replaced = observe(adapter, 400, wrong());
    expect(replaced.hands[0]).toMatchObject({
      trackId: originalHand.hands[0].trackId,
      associationBasis: "OBSERVED_PALM_CONTINUITY_V1",
    });
    tracker.update(pixels(400), selectIndexModelAnchor(replaced));
    for (const at of [450, 500, 566, 633]) {
      const current = observe(adapter, at, wrong(true));
      const anchor = selectIndexModelAnchor(current);
      expect(current.hands[0].trackId).not.toBe(originalHand.hands[0].trackId);
      expect(anchor?.indexIdentityGeometry?.source).not.toBe(selectIndexModelAnchor(originalHand)?.identitySource);
      expect(tracker.update(pixels(at), anchor)).toMatchObject({ trackId: selected!.trackId, point: null });
    }
  });

  it("allows a legitimate current index plus coherent palm to rejoin and continue the same selected producer", () => {
    const adapter = new BrowserHandAdapter(binding),
      tracker = new IndexImageTracker(binding);
    let selected;
    for (const at of [100, 166, 233, 300])
      selected = tracker.update(pixels(at, true), selectIndexModelAnchor(observe(adapter, at, original())));
    tracker.update(pixels(350), selectIndexModelAnchor(observe(adapter, 350, palmOnly())));
    const returned = observe(adapter, 400, original());
    expect(returned.hands[0].associationBasis).toBe("INDEX_CHAIN_V1");
    let continued;
    for (const at of [450, 500, 566])
      continued = tracker.update(pixels(at), selectIndexModelAnchor(observe(adapter, at, original())));
    expect(continued).toMatchObject({ trackId: selected!.trackId, state: "TRACKING", coordinateSource: "MODEL" });
  });

  it("requires the current palm as well as the preserved index while rejoining", () => {
    const adapter = new BrowserHandAdapter(binding),
      first = observe(adapter, 100, original()).hands[0];
    observe(adapter, 150, palmOnly());
    const cropped = original();
    for (const id of [9, 13, 17]) cropped[id] = { ...missing };
    expect(observe(adapter, 200, cropped).hands[0].trackId).not.toBe(first.trackId);
  });
});
