// @sounding-line-registration owner=reach suite=unit.reach contracts=reach.phase1.foundation
import { describe, expect, it } from "vitest";
import { assessHand } from "@/watchglass/hand-posture";
import { pointingPose } from "../../tests/e2e/fixtures/reach/pointing-poses";
import { pointingFeatures } from "./coordinates";
import { syntheticObservation } from "./synthetic";

const frame = { frameWidth: 640, frameHeight: 480 };
function endOnHand(aspect = 0.75) {
  const hand = syntheticObservation({ x: 0.5, y: 0.5 }, 0, 100).hands[0];
  // Keep the palm and all non-index fingers facing the camera. Only the index
  // points into depth, unlike rotating the whole hand through ninety degrees.
  hand.landmarks = pointingPose({ aspect });
  const base = hand.landmarks[5];
  for (const [offset, index] of [6, 7, 8].entries())
    hand.landmarks[index] = { ...base, z: base.z - [0.035, 0.06, 0.08][offset] };
  return hand;
}
describe("camera-directed index overlapping the palm in the image", () => {
  it("recognizes exact zero-XY projection using coherent inferred depth without folding the index", () => {
    const hand = endOnHand();
    for (const index of [6, 7, 8]) {
      expect(hand.landmarks[index].x).toBe(hand.landmarks[5].x);
      expect(hand.landmarks[index].y).toBe(hand.landmarks[5].y);
    }
    expect(assessHand(hand, frame)).toMatchObject({
      pointing: true,
      geometry: true,
      depthDominant: true,
      depthEvidence: "MONOCULAR_INFERRED",
    });
    expect(pointingFeatures(hand, frame)).toEqual([1, hand.landmarks[5].x, hand.landmarks[5].y, 0, 0]);
  });
  it.each([-1, 1])("retains end-on eligibility with small image/depth perturbations in direction %s", (sign) => {
    const hand = endOnHand();
    for (const [offset, index] of [6, 7, 8].entries()) {
      hand.landmarks[index].x += sign * [0.0015, -0.001, 0.002][offset];
      hand.landmarks[index].y += sign * [0.001, 0.002, 0.004][offset];
      hand.landmarks[index].z += sign * [0.001, -0.002, 0.001][offset];
    }
    expect(assessHand(hand, frame)).toMatchObject({ pointing: true, depthDominant: true });
    expect(pointingFeatures(hand, frame)).toHaveLength(5);
    expect(pointingFeatures(hand, frame).every(Number.isFinite)).toBe(true);
  });
  it("accepts a gentle bend on an index whose overall direction remains toward the camera", () => {
    const hand = endOnHand();
    for (const [offset, index] of [6, 7, 8].entries()) {
      hand.landmarks[index].x += [0.001, 0.004, 0.012][offset];
      hand.landmarks[index].y += [0.001, 0.004, 0.012][offset];
    }
    expect(assessHand(hand, frame)).toMatchObject({ pointing: true, depthDominant: true });
  });
  it.each([0.5, 0.75, 1, 1.5])("preserves the frame contract and five-dimensional features at aspect %s", (aspect) => {
    const hand = endOnHand(aspect),
      context = { frameWidth: 1000, frameHeight: aspect * 1000 };
    expect(assessHand(hand, context).pointing).toBe(true);
    expect(pointingFeatures(hand, context)).toEqual([1, hand.landmarks[5].x, hand.landmarks[5].y, 0, 0]);
  });
  it("can recognize an end-on index without the wrist or a curved knuckle row", () => {
    const hand = endOnHand(),
      full = pointingFeatures(hand, frame);
    hand.landmarks[0] = { x: 0, y: 0, z: 0, valid: false };
    expect(assessHand(hand, frame)).toMatchObject({ pointing: true, palmBasis: "FINGER_RELATIONS", palmFacing: null });
    expect(pointingFeatures(hand, frame)).toEqual(full);
  });
  it("rejects a folded-over-palm index and a reversed distal hook despite image overlap", () => {
    const folded = endOnHand();
    for (const [offset, index] of [6, 7, 8].entries()) {
      folded.landmarks[index].y += [0.024, 0.045, 0.025][offset];
      folded.landmarks[index].z = [-0.03, -0.02, -0.005][offset];
    }
    expect(assessHand(folded, frame).pointing).toBe(false);
    const hooked = endOnHand();
    hooked.landmarks[8].z = -0.04;
    expect(assessHand(hooked, frame).pointing).toBe(false);
  });
  it("rejects open fingers in the image plane or all directed end-on", () => {
    const open = endOnHand(),
      extended = pointingPose({ otherBends: [0, 5, 10] });
    for (const index of [10, 11, 12, 14, 15, 16, 18, 19, 20]) open.landmarks[index] = extended[index];
    expect(assessHand(open, frame).pointing).toBe(false);
    const allEndOn = endOnHand();
    for (const base of [9, 13, 17])
      for (const [offset, index] of [base + 1, base + 2, base + 3].entries())
        allEndOn.landmarks[index] = { ...allEndOn.landmarks[base], z: -[0.035, 0.06, 0.08][offset] };
    expect(assessHand(allEndOn, frame).pointing).toBe(false);
  });
  it("rejects a competing fully extended middle finger also directed toward the camera", () => {
    const hand = endOnHand();
    for (const [offset, index] of [10, 11, 12].entries())
      hand.landmarks[index] = { ...hand.landmarks[9], z: -[0.035, 0.06, 0.08][offset] };
    expect(assessHand(hand, frame).pointing).toBe(false);
  });
  it("rejects a visible thumb/index pinch at the end-on index tip", () => {
    const hand = endOnHand();
    hand.landmarks[4] = { ...hand.landmarks[8] };
    expect(assessHand(hand, frame).pointing).toBe(false);
  });
  it("does not invent depth when the entire index has collapsed image and depth coordinates", () => {
    const hand = endOnHand();
    for (const index of [6, 7, 8]) hand.landmarks[index].z = hand.landmarks[5].z;
    expect(assessHand(hand, frame).pointing).toBe(false);
    expect(() => pointingFeatures(hand, frame)).toThrow("POINT_AXIS_DEGENERATE");
    const missing = endOnHand();
    missing.landmarks[8].valid = false;
    expect(assessHand(missing, frame).pointing).toBe(false);
  });
});
