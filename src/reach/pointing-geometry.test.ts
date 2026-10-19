// @sounding-line-registration owner=reach suite=unit.reach contracts=reach.phase1.foundation
import { describe, expect, it } from "vitest";
import { assessHand } from "@/watchglass/hand-posture";
import { handGeometry } from "@/watchglass/hand-geometry";
import { pointingPose } from "../../tests/e2e/fixtures/reach/pointing-poses";
import { pointingFeatures } from "./coordinates";
import { syntheticObservation } from "./synthetic";

const frame = { frameWidth: 640, frameHeight: 480 };
function hand(pose: Parameters<typeof pointingPose>[0] = {}) {
  const hand = syntheticObservation({ x: 0.5, y: 0.5 }, 0, 100).hands[0];
  hand.landmarks = pointingPose(pose);
  return hand;
}
describe("natural pointing anatomy and inferred depth geometry", () => {
  it("accepts a softly bent index and relaxed fingers without requiring a fist", () => {
    const relaxed = hand();
    expect(assessHand(relaxed, frame)).toMatchObject({
      pointing: true,
      pointingEvidence: "DISTINCT",
      posture: "POINT",
    });
    const geometry = handGeometry(relaxed, frame);
    expect(geometry.finger(5)!.straightness).toBeLessThan(0.95);
    expect(geometry.finger(9)!.straightness).toBeGreaterThan(0.65);
  });
  it.each([0, 35, 55, 70, 85, 90])(
    "retains joint relationships with the index directed %s degrees into depth",
    (depthAngle) => {
      const point = hand({ indexBends: [0, 10, 20], depthAngle });
      expect(assessHand(point, frame)).toMatchObject({
        geometry: true,
        pointing: true,
        depthEvidence: "MONOCULAR_INFERRED",
      });
      const features = pointingFeatures(point, frame);
      expect(features).toHaveLength(5);
      expect(features.every(Number.isFinite)).toBe(true);
      expect(Math.abs(features[3])).toBeLessThan(2);
      expect(Math.abs(features[4])).toBeLessThan(2);
      if (depthAngle >= 55) expect(assessHand(point, frame).depthDominant).toBe(true);
    },
  );
  it("uses 3D palm width when the projected palm is narrow", () => {
    const point = hand({ indexBends: [0, 10, 20], palmTurn: 80 });
    const [base, little] = [point.landmarks[5], point.landmarks[17]];
    expect(Math.hypot(base.x - little.x, base.y - little.y)).toBeLessThan(0.045);
    expect(assessHand(point, frame)).toMatchObject({ pointing: true, geometry: true });
    expect(pointingFeatures(point, frame).every(Number.isFinite)).toBe(true);
  });
  it.each([0.5, 0.75, 1, 1.5])("corrects image aspect %s before assessing anatomy", (aspect) => {
    const point = hand({ aspect, depthAngle: 55 });
    const context = { frameWidth: 1000, frameHeight: aspect * 1000 };
    expect(assessHand(point, context).pointing).toBe(true);
    const geometry = handGeometry(point, context);
    expect(geometry.finger(5)!.straightness).toBeCloseTo(handGeometry(hand(), frame).finger(5)!.straightness);
  });
  it.each([
    { indexBends: [0, 5, 10], otherBends: [0, 5, 10] },
    { indexBends: [0, 35, 65], otherBends: [0, 35, 65] },
    { indexBends: [0, 100, 150] },
    { indexBends: [0, 0, 145] },
  ])("rejects open/ambiguous hands and folded-back joints: %j", (pose) => {
    expect(assessHand(hand(pose), frame).pointing).toBe(false);
  });
  it("uses the index-only heuristic when other fingers are hidden, while rejecting a visible pinch", () => {
    const missing = hand();
    for (const index of [10, 14]) missing.landmarks[index].valid = false;
    expect(assessHand(missing, frame)).toMatchObject({ pointing: true, intentEvidence: "HEURISTIC_INDEX_ONLY" });
    const pinch = hand();
    pinch.landmarks[4] = { ...pinch.landmarks[8] };
    expect(assessHand(pinch, frame).pointing).toBe(false);
  });
  it("rejects a competing fully extended middle finger without requiring the other fingers to be clenched", () => {
    const twoFingers = hand({ indexBends: [0, 5, 10] });
    const extended = pointingPose({ indexBends: [0, 5, 10], otherBends: [0, 5, 10] });
    for (const index of [10, 11, 12]) twoFingers.landmarks[index] = extended[index];
    expect(assessHand(twoFingers, frame).pointing).toBe(false);
  });
  it("does not let collapsed non-index estimates override the coherent index", () => {
    const collapsed = hand();
    for (const base of [9, 13])
      for (const index of [1, 2, 3]) collapsed.landmarks[base + index] = { ...collapsed.landmarks[base] };
    expect(assessHand(collapsed, frame)).toMatchObject({ pointing: true, intentEvidence: "HEURISTIC_INDEX_ONLY" });
  });
  it("does not rescue invalid/collapsed index geometry from inferred depth", () => {
    const collapsed = hand({ depthAngle: 80 });
    collapsed.landmarks[7] = { ...collapsed.landmarks[8] };
    expect(assessHand(collapsed, frame).pointing).toBe(false);
    const missing = hand({ depthAngle: 80 });
    missing.landmarks[8].valid = false;
    expect(() => pointingFeatures(missing, frame)).toThrow("POINT_AXIS_DEGENERATE");
  });
  it("keeps source features unmirrored and translation/scale invariant apart from observed tip position", () => {
    const original = hand({ depthAngle: 60 });
    const moved = structuredClone(original);
    moved.landmarks = moved.landmarks.map((p) => ({
      ...p,
      x: 0.5 + (p.x - 0.45) * 0.8,
      y: 0.55 + (p.y - 0.5) * 0.8,
      z: p.z * 0.8,
    }));
    const a = pointingFeatures(original, frame),
      b = pointingFeatures(moved, frame);
    expect(b[1]).toBe(moved.landmarks[8].x);
    expect(b[2]).toBe(moved.landmarks[8].y);
    expect(b[3]).toBeCloseTo(a[3]);
    expect(b[4]).toBeCloseTo(a[4]);
  });
});
