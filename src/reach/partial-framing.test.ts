// @sounding-line-registration owner=reach suite=unit.reach contracts=reach.phase1.foundation
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { assessHand } from "@/watchglass/hand-posture";
import { pointingPose } from "../../tests/e2e/fixtures/reach/pointing-poses";
import { pointingFeatures } from "./coordinates";
import { syntheticObservation } from "./synthetic";

const fixtureFrame = { frameWidth: 358, frameHeight: 376 };
const frame = { frameWidth: 640, frameHeight: 480 };
function officialHand() {
  const text = readFileSync("tests/e2e/fixtures/reach/pointing_up_landmarks.pbtxt", "utf8");
  const hand = syntheticObservation({ x: 0.5, y: 0.5 }, 0, 100).hands[0];
  hand.landmarks = [...text.matchAll(/landmark\s*\{\s*x:\s*([\d.e+-]+)\s*y:\s*([\d.e+-]+)\s*z:\s*([\d.e+-]+)/g)]
    .slice(0, 21)
    .map((match) => ({ x: Number(match[1]), y: Number(match[2]), z: Number(match[3]), valid: true }));
  return hand;
}
function analyticHand(otherBends?: number[]) {
  const hand = syntheticObservation({ x: 0.5, y: 0.5 }, 0, 100).hands[0];
  hand.landmarks = pointingPose({ otherBends });
  return hand;
}
function unavailable(hand: ReturnType<typeof officialHand>, ...indices: number[]) {
  for (const index of indices) hand.landmarks[index] = { x: 0, y: 0, z: 0, valid: false };
  return hand;
}
describe("partial hand framing keeps observed pointing evidence", () => {
  it("allows the visible wrist to reach the bottom boundary while core pointing landmarks remain framed", () => {
    const hand = officialHand();
    const offset = 0.995 - hand.landmarks[0].y;
    hand.landmarks = hand.landmarks.map((point) => ({ ...point, y: point.y + offset }));
    expect(assessHand(hand, fixtureFrame)).toMatchObject({
      requiredValid: true,
      framed: true,
      geometry: true,
      pointing: true,
      partialFraming: true,
      partialFramingReason: "WRIST_AT_EDGE",
      palmBasis: "WRIST",
    });
  });
  it("uses the observed knuckle arch when only the wrist passes below the image", () => {
    const hand = officialHand();
    hand.landmarks = hand.landmarks.map((point) => ({ ...point, y: point.y + 0.27 }));
    expect(hand.landmarks[0].y).toBeGreaterThan(1);
    unavailable(hand, 0);
    expect(assessHand(hand, fixtureFrame)).toMatchObject({
      requiredValid: true,
      framed: true,
      geometry: true,
      pointing: true,
      partialFraming: true,
      partialFramingReason: "WRIST_UNAVAILABLE",
      palmBasis: "KNUCKLE_ARCH",
    });
  });
  it("keeps all five calibration features exactly unchanged when wrist evidence disappears", () => {
    const full = officialHand(),
      partial = unavailable(structuredClone(full), 0);
    expect(pointingFeatures(partial, fixtureFrame)).toEqual(pointingFeatures(full, fixtureFrame));
    expect(assessHand(partial, fixtureFrame).pointing).toBe(true);
  });
  it("uses coherent observed finger relationships when the wrist and knuckle arch are unavailable", () => {
    const partial = unavailable(analyticHand(), 0);
    expect(assessHand(partial, frame)).toMatchObject({
      geometry: true,
      pointing: true,
      palmBasis: "FINGER_RELATIONS",
      palmFacing: null,
    });
    expect(pointingFeatures(partial, frame)).toEqual(pointingFeatures(analyticHand(), frame));
  });
  it("does not invent support from a collapsed palm span or index plane", () => {
    const partial = unavailable(analyticHand(), 0);
    partial.landmarks[17] = { ...partial.landmarks[5] };
    expect(assessHand(partial, frame).pointing).toBe(false);
    const flat = unavailable(analyticHand(), 0);
    for (const [offset, index] of [6, 7, 8].entries()) {
      const base = flat.landmarks[5],
        palm = flat.landmarks[17];
      flat.landmarks[index] = {
        ...base,
        x: base.x + ((palm.x - base.x) * (offset + 1)) / 4,
        y: base.y + ((palm.y - base.y) * (offset + 1)) / 4,
        z: base.z + ((palm.z - base.z) * (offset + 1)) / 4,
      };
    }
    expect(assessHand(flat, frame)).toMatchObject({ geometry: false, pointing: false, palmBasis: "UNAVAILABLE" });
  });
  it("does not let the direction of a small visible knuckle arch impose an imaginary wrist position", () => {
    const partial = unavailable(analyticHand(), 0);
    for (const index of [9, 10, 11, 12]) partial.landmarks[index].y += 0.02;
    expect(assessHand(partial, frame)).toMatchObject({ geometry: true, pointing: true, palmBasis: "KNUCKLE_ARCH" });
  });
  it("rejects open palms, competing extended fingers and a curled index without wrist evidence", () => {
    const open = unavailable(analyticHand([0, 5, 10]), 0);
    expect(assessHand(open, frame).pointing).toBe(false);
    const curled = unavailable(analyticHand(), 0);
    const curledPose = pointingPose({ indexBends: [0, 100, 150] });
    for (const index of [6, 7, 8]) curled.landmarks[index] = curledPose[index];
    expect(assessHand(curled, frame).pointing).toBe(false);
    const competing = unavailable(analyticHand(), 0);
    const extended = pointingPose({ otherBends: [0, 5, 10] });
    for (const index of [10, 11, 12]) competing.landmarks[index] = extended[index];
    expect(assessHand(competing, frame).pointing).toBe(false);
  });
  it("can use visible non-index PIP flexion when folded fingertips leave the frame", () => {
    const full = analyticHand(),
      partial = unavailable(structuredClone(full), 12, 16);
    expect(assessHand(partial, frame)).toMatchObject({
      pointing: true,
      partialFraming: true,
      partialFramingReason: "FOLDED_FINGERS_PARTIAL",
    });
    expect(pointingFeatures(partial, frame)).toEqual(pointingFeatures(full, frame));
  });
  it.each([{ otherBends: [0, 5, 10] }, { otherBends: [0, 35, 65] }])(
    "does not turn cropped straight or softly open fingers into relaxed evidence: %j",
    ({ otherBends }) => {
      const partial = unavailable(analyticHand(otherBends), 12, 16, 20);
      expect(assessHand(partial, frame).pointing).toBe(false);
      unavailable(partial, 0);
      expect(assessHand(partial, frame).pointing).toBe(false);
    },
  );
  it("still requires observed non-index joints to establish distinct index intent", () => {
    const partial = unavailable(analyticHand(), 12, 16, 18, 14);
    expect(assessHand(partial, frame).pointing).toBe(false);
  });
  it.each([5, 6, 7, 8, 9, 17])(
    "never treats missing required index or palm landmark %s as recoverable framing",
    (index) => {
      const partial = unavailable(officialHand(), index);
      expect(assessHand(partial, fixtureFrame)).toMatchObject({ requiredValid: false, framed: false, pointing: false });
    },
  );
  it.each([5, 6, 7, 8, 9, 17])("keeps required landmark %s away from a clipped boundary", (index) => {
    const partial = officialHand();
    partial.landmarks[index].y = 0.995;
    expect(assessHand(partial, fixtureFrame).framed).toBe(false);
  });
});
