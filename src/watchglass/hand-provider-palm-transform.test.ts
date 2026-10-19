// @sounding-line-registration owner=reach suite=unit.reach contracts=reach.phase1.foundation
import { describe, expect, it } from "vitest";
import { BrowserHandAdapter, type HandResult } from "./hand-provider";
import { pointingPose } from "../../tests/e2e/fixtures/reach/pointing-poses";

type Pose = ReturnType<typeof pointingPose>;
const binding = {
  providerGeneration: 1,
  cameraLeaseId: "synthetic-transported-palm",
  cameraFrameVersion: 1,
  mirrorTransform: "NONE" as const,
};
function original(short = false, depth = 0): Pose {
  const pose = pointingPose({ indexBends: [0, 10, 20], depthAngle: depth });
  if (short)
    for (const i of [6, 7, 8]) {
      pose[i].x = pose[5].x + (pose[i].x - pose[5].x) * 0.6;
      pose[i].y = pose[5].y + (pose[i].y - pose[5].y) * 0.6;
      pose[i].z = pose[5].z + (pose[i].z - pose[5].z) * 0.6;
    }
  pose[0] = { x: -1, y: -1, z: 0, valid: false };
  return pose;
}
function malformed(pose: Pose): Pose {
  const result = pose.map((p) => ({ ...p }));
  for (const i of [6, 7, 8]) result[i] = { ...result[5] };
  return result;
}
function transform(pose: Pose, { x = 0, y = 0, angle = 0, scale = 1 } = {}): Pose {
  const radians = (angle * Math.PI) / 180,
    origin = pose[5];
  return pose.map((p) => {
    if (!p.valid) return { ...p };
    const dx = p.x - origin.x,
      dy = (p.y - origin.y) * 0.75;
    return {
      x: origin.x + x + scale * (dx * Math.cos(radians) - dy * Math.sin(radians)),
      y: origin.y + y + (scale * (dx * Math.sin(radians) + dy * Math.cos(radians))) / 0.75,
      z: p.z * scale,
      valid: true,
    };
  });
}
function observe(adapter: BrowserHandAdapter, at: number, pose: Pose, width = 640, height = 480) {
  return adapter.envelope({ landmarks: [pose], handedness: [] }, at, at + 1, width, height).hands[0];
}
function displaced(short = false, offset = 0.02): Pose {
  const pose = original(short);
  for (const i of [6, 7, 8]) pose[i].x += offset;
  return pose;
}

describe("palm-only quarantine retains an immutable index/palm reference pair", () => {
  it.each(["TRANSLATION", "ROTATION", "SCALE", "COMBINED"])(
    "rejoins a genuine %s hand using the preserved reference transported by observed palm motion",
    (kind) => {
      const adapter = new BrowserHandAdapter(binding),
        first = observe(adapter, 100, original());
      const motion = (t: number) => ({
        x: kind === "TRANSLATION" || kind === "COMBINED" ? 0.24 * t : 0,
        y: kind === "COMBINED" ? -0.08 * t : 0,
        angle: kind === "ROTATION" ? 150 * t : kind === "COMBINED" ? 120 * t : 0,
        scale: kind === "SCALE" || kind === "COMBINED" ? 1 + 0.4 * t : 1,
      });
      for (const [i, t] of [0.2, 0.4, 0.6, 0.8].entries())
        expect(observe(adapter, 150 + i * 50, transform(malformed(original()), motion(t)))).toMatchObject({
          trackId: first.trackId,
          associationBasis: "OBSERVED_PALM_CONTINUITY_V1",
        });
      expect(observe(adapter, 350, transform(original(), motion(1)))).toMatchObject({
        trackId: first.trackId,
        continuity: "CONTINUOUS",
        associationBasis: "INDEX_CHAIN_V1",
      });
    },
  );

  it.each(["REFLECTED_SHORT_INDEX", "NEARBY_PARALLEL_DIGIT"])(
    "does not launder %s within the old absolute radius",
    (kind) => {
      const adapter = new BrowserHandAdapter(binding),
        initial = original(true),
        first = observe(adapter, 100, initial);
      observe(adapter, 150, malformed(initial));
      const wrong = kind === "NEARBY_PARALLEL_DIGIT" ? displaced(true) : original(true);
      if (kind === "REFLECTED_SHORT_INDEX") for (const i of [6, 7, 8]) wrong[i].y = wrong[5].y * 2 - wrong[i].y;
      expect(
        Math.max(...[5, 6, 7, 8].map((i) => Math.hypot(wrong[i].x - initial[i].x, wrong[i].y - initial[i].y))),
      ).toBeLessThan(0.14);
      for (const at of [200, 250, 300])
        expect(observe(adapter, at, wrong)).toMatchObject({
          trackId: first.trackId,
          associationBasis: "OBSERVED_PALM_CONTINUITY_V1",
        });
    },
  );

  it("does not treat a reflected whole-hand image as a proper rotation", () => {
    const adapter = new BrowserHandAdapter(binding),
      first = observe(adapter, 100, original());
    observe(adapter, 150, malformed(original()));
    const mirrored = original().map((p) => (p.valid ? { ...p, x: 0.9 - p.x } : p));
    expect(observe(adapter, 200, mirrored)).toMatchObject({
      trackId: first.trackId,
      associationBasis: "OBSERVED_PALM_CONTINUITY_V1",
    });
  });

  it("retains only palm identity when the observed MCP row has no usable projected spread", () => {
    const adapter = new BrowserHandAdapter(binding),
      initial = original();
    for (const [i, id] of [5, 9, 13, 17].entries()) initial[id] = { ...initial[5], z: i * 0.03 };
    const first = observe(adapter, 100, initial);
    observe(adapter, 150, malformed(initial));
    expect(observe(adapter, 200, initial)).toMatchObject({
      trackId: first.trackId,
      associationBasis: "OBSERVED_PALM_CONTINUITY_V1",
    });
  });

  it("does not turn nonrigid projected depth changes into an unproved index rejoin", () => {
    const adapter = new BrowserHandAdapter(binding),
      first = observe(adapter, 100, original());
    for (const [i, angle] of [20, 40, 60].entries()) observe(adapter, 150 + i * 50, malformed(original(false, angle)));
    expect(observe(adapter, 300, original(false, 80))).toMatchObject({
      trackId: first.trackId,
      associationBasis: "OBSERVED_PALM_CONTINUITY_V1",
    });
  });

  it("cannot transport a reference into another negotiated frame geometry", () => {
    const adapter = new BrowserHandAdapter(binding),
      first = observe(adapter, 100, original());
    observe(adapter, 150, transform(malformed(original()), { x: 0.06 }));
    const current = observe(adapter, 200, transform(original(), { x: 0.12 }), 800, 600);
    expect(current.trackId).not.toBe(first.trackId);
  });

  it("does not use transport to resolve a two-hand crossing", () => {
    const adapter = new BrowserHandAdapter(binding),
      first = observe(adapter, 100, original());
    observe(adapter, 150, malformed(original()));
    const result: HandResult = {
      landmarks: [original(), original().map((p) => ({ ...p, x: p.x + 0.01 }))],
      handedness: [],
    };
    const current = adapter.envelope(result, 200, 201, 640, 480);
    expect(current.hands.every((hand) => hand.continuity === "AMBIGUOUS" && hand.trackId !== first.trackId)).toBe(true);
  });

  it("does not replace the fixed reference from a processing-rejected plausible rejoin", () => {
    const adapter = new BrowserHandAdapter(binding),
      initial = original(true),
      first = observe(adapter, 100, initial);
    observe(adapter, 150, malformed(initial));
    let checks = 0;
    expect(() =>
      adapter.envelope(
        { landmarks: [displaced(true, 0.01)], handedness: [] },
        200,
        201,
        640,
        480,
        () => ++checks === 1,
      ),
    ).toThrow("HAND_PROVIDER_CAPTURE_REJECTED");
    expect(observe(adapter, 250, displaced(true, 0.02))).toMatchObject({
      trackId: first.trackId,
      associationBasis: "OBSERVED_PALM_CONTINUITY_V1",
    });
  });
});
