// @sounding-line-registration owner=reach suite=unit.reach contracts=reach.phase1.foundation
import { describe, expect, it } from "vitest";
import { BrowserHandAdapter, HAND_CONTINUITY_GRACE_MS, type HandResult } from "@/watchglass/hand-provider";
import { pointingPose } from "../../tests/e2e/fixtures/reach/pointing-poses";
import { ActiveHandSelector } from "./observation";

const binding = {
  providerGeneration: 1,
  cameraLeaseId: "d0-index-only-reference",
  cameraFrameVersion: 1,
  mirrorTransform: "NONE" as const,
};
function pose(x = 0.45, depthAngle = 0, indexOnly = true) {
  return pointingPose({ indexBends: [0, 10, 20], depthAngle }).map((point, index) =>
    indexOnly && ![5, 6, 7, 8].includes(index) ? { x: -1, y: -1, z: 0 } : { ...point, x: point.x + x - 0.45 },
  );
}
function result(points = pose()): HandResult {
  return { landmarks: [points], handedness: [] };
}
function observe(adapter: BrowserHandAdapter, at: number, points = pose()) {
  return adapter.envelope(result(points), at, at + 5, 640, 480);
}

describe("fixed observed index source association", () => {
  it("acquires and maintains an index-only local track without a palm, wrist or other fingers", () => {
    const adapter = new BrowserHandAdapter(binding, "D0");
    const first = observe(adapter, 100).hands[0];
    expect(first).toMatchObject({
      continuity: "ACQUIRED",
      associationBasis: "INDEX_CHAIN_V1",
      pose: "POINT_CANDIDATE",
    });
    expect(first.landmarks.filter((point) => point.valid)).toHaveLength(4);
    expect(observe(adapter, 200).hands[0]).toMatchObject({ trackId: first.trackId, continuity: "CONTINUOUS" });
  });

  it("does not shift its reference as wrist and other fingers vanish, move arbitrarily or reappear", () => {
    const adapter = new BrowserHandAdapter(binding);
    const full = pose(0.45, 0, false);
    const first = observe(adapter, 100, full).hands[0];
    expect(observe(adapter, 200).hands[0].trackId).toBe(first.trackId);
    const changedPalm = pose(0.45, 0, false).map((point, index) =>
      [5, 6, 7, 8].includes(index) ? point : { ...point, x: 0.9, y: 0.9 },
    );
    expect(observe(adapter, 300, changedPalm).hands[0]).toMatchObject({
      trackId: first.trackId,
      continuity: "CONTINUOUS",
    });
    expect(observe(adapter, 400, full).hands[0].trackId).toBe(first.trackId);
  });

  it.each([10, 20, 30])("continues from end-on to side-on using only the index at %s fps", (fps) => {
    const adapter = new BrowserHandAdapter(binding);
    let identity: string | undefined;
    for (let i = 0; i < 61; i++) {
      const points = pose(0.4 + i * 0.001, 90 - i * 1.5);
      const frame = observe(adapter, 100 + (i * 1000) / fps, points).hands[0];
      identity ??= frame.trackId;
      expect(frame.trackId).toBe(identity);
      expect(frame.continuity).toBe(i ? "CONTINUOUS" : "ACQUIRED");
    }
  });

  it("pauses collection for a missing index joint and recovers the same unchanged source", () => {
    const adapter = new BrowserHandAdapter(binding),
      selector = new ActiveHandSelector();
    selector.update(observe(adapter, 100));
    const ready = selector.update(observe(adapter, 350));
    expect(ready.eligible).toBe(true);
    const partial = pose();
    partial[8] = { x: -1, y: -1, z: 0 };
    const paused = selector.update(observe(adapter, 400, partial));
    expect(paused).toMatchObject({ eligible: false, changed: false, condition: "FRAMING" });
    expect(selector.update(observe(adapter, 450))).toMatchObject({ eligible: true, changed: false });
  });

  it("keeps an incumbent through repeated fresh nondegenerate three-joint observations while no point is eligible", () => {
    const adapter = new BrowserHandAdapter(binding);
    const first = observe(adapter, 100).hands[0];
    const partial = pose();
    partial[8] = { x: -1, y: -1, z: 0 };
    for (const at of [200, 500, 800, 1100, 1350]) {
      expect(observe(adapter, at, partial).hands[0]).toMatchObject({
        trackId: first.trackId,
        continuity: "CONTINUOUS",
        pose: "UNKNOWN",
        occluded: true,
      });
    }
    expect(observe(adapter, 1400).hands[0]).toMatchObject({ trackId: first.trackId, continuity: "CONTINUOUS" });
  });

  it("retires two established finger-only tracks on crossing without reusing old identities", () => {
    const adapter = new BrowserHandAdapter(binding);
    const pair = (a: number, b: number, at: number) =>
      adapter.envelope({ landmarks: [pose(a), pose(b)], handedness: [] }, at, at + 5, 640, 480);
    const first = pair(0.25, 0.75, 100);
    pair(0.26, 0.74, 150);
    expect(pair(0.49, 0.51, 200).hands.every((hand) => hand.continuity === "AMBIGUOUS")).toBe(true);
    expect(
      pair(0.25, 0.75, 250).hands.every((hand) => !first.hands.some((prior) => prior.trackId === hand.trackId)),
    ).toBe(true);
  });

  function malformed(kind: string) {
    const points = pose();
    if (kind === "COLLAPSED") for (const index of [6, 7, 8]) points[index] = { ...points[5] };
    if (kind === "COLLAPSED_BONE") points[7] = { ...points[8] };
    if (kind === "NONFINITE") for (const index of [6, 7]) points[index].z = NaN;
    if (kind === "PARTIAL_COLLAPSED") {
      for (const index of [7, 8]) points[index] = { ...points[6] };
      points[5] = { x: -1, y: -1, z: 0 };
    }
    if (kind === "TINY")
      for (const index of [6, 7, 8]) points[index] = { ...points[5], z: points[5].z - (index - 5) * 0.0002 };
    return points;
  }
  it.each(["COLLAPSED", "COLLAPSED_BONE", "TINY", "NONFINITE", "PARTIAL_COLLAPSED"])(
    "cannot establish a new index track from %s geometry",
    (kind) => {
      const hand = observe(new BrowserHandAdapter(binding), 100, malformed(kind)).hands[0];
      expect(hand.continuity).toBe("AMBIGUOUS");
      expect(hand.pose).toBe("UNKNOWN");
    },
  );

  it.each(["COLLAPSED", "COLLAPSED_BONE", "TINY", "NONFINITE", "PARTIAL_COLLAPSED"])(
    "does not refresh an incumbent from repeated %s geometry",
    (kind) => {
      const adapter = new BrowserHandAdapter(binding);
      const first = observe(adapter, 100).hands[0];
      for (const at of [200, 500, 800, 1100, 1350]) {
        expect(observe(adapter, at, malformed(kind)).hands[0].continuity).toBe("AMBIGUOUS");
      }
      const recovered = observe(adapter, 100 + HAND_CONTINUITY_GRACE_MS + 100).hands[0];
      expect(recovered.trackId).not.toBe(first.trackId);
      expect(recovered.continuity).toBe("ACQUIRED");
    },
  );
});
