// @sounding-line-registration owner=reach suite=unit.reach contracts=reach.phase1.foundation
import { describe, expect, it } from "vitest";
import { handObservationSchema } from "@/watchglass/hand-observation";
import { handGeometry } from "@/watchglass/hand-geometry";
import { assessHand } from "@/watchglass/hand-posture";
import { pointingPose } from "../../tests/e2e/fixtures/reach/pointing-poses";
import { pointingFeatures } from "./coordinates";
import { syntheticObservation } from "./synthetic";

const frame = { frameWidth: 640, frameHeight: 480 };
/** Analytic anatomy only; no real person's trace or body geometry. */
function croppedPose(options: Parameters<typeof pointingPose>[0] = {}) {
  const observation = syntheticObservation({ x: 0.5, y: 0.5 }, 0, 100);
  const hand = observation.hands[0];
  const raw = pointingPose({ indexBends: [0, 5, 10], depthAngle: 90, ...options }).map((point) => ({
    ...point,
    y: point.y + 0.47,
  }));
  hand.landmarks = raw.map((point) =>
    point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1 ? point : { x: 0, y: 0, z: 0, valid: false },
  );
  hand.offImageFingerLandmarks = raw.flatMap((point, index) =>
    index >= 10 && index !== 17 && !hand.landmarks[index].valid ? [{ index, x: point.x, y: point.y, z: point.z }] : [],
  );
  return { observation, hand, raw };
}

describe("bounded auxiliary off-image non-index anatomy", () => {
  it("supports an observed end-on index with bounded inferred relaxed fingers, without changing validity or features", () => {
    const { hand } = croppedPose();
    expect(hand.offImageFingerLandmarks!.length).toBeGreaterThan(0);
    const without = structuredClone(hand);
    delete without.offImageFingerLandmarks;
    expect(assessHand(without, frame)).toMatchObject({ pointing: false, insufficientFingerEvidence: true });
    expect(assessHand(hand, frame)).toMatchObject({
      pointing: true,
      geometry: true,
      framed: true,
      depthDominant: true,
      offImageFingerSupport: true,
      insufficientFingerEvidence: false,
      partialFraming: true,
      partialFramingReason: "NON_INDEX_INFERRED_OFF_IMAGE",
    });
    expect(hand.landmarks).toEqual(without.landmarks);
    expect(pointingFeatures(hand, frame)).toEqual(pointingFeatures(without, frame));
    expect(handGeometry(hand, frame).finger(9)).toBeNull();
    expect(handGeometry(hand, frame).finger(9, true)?.inferredOffImage).toBe(true);
  });

  it.each([{ otherBends: [0, 5, 10] }, { otherBends: [0, 15, 25] }])(
    "keeps open and ambiguous anatomy rejected with the same visible core: %j",
    (options) => {
      const { hand } = croppedPose(options);
      expect(assessHand(hand, frame).pointing).toBe(false);
    },
  );

  it("retains the competing-finger and pinch vetoes", () => {
    const { hand, raw } = croppedPose();
    const extended = pointingPose({ indexBends: [0, 5, 10], otherBends: [0, 5, 10], depthAngle: 90 });
    for (const index of [10, 11, 12]) {
      hand.landmarks[index] = { ...extended[index], y: extended[index].y + 0.47 };
    }
    hand.offImageFingerLandmarks = hand.offImageFingerLandmarks!.filter((point) => ![10, 11, 12].includes(point.index));
    expect(assessHand(hand, frame).pointing).toBe(false);
    const pinch = croppedPose().hand;
    pinch.landmarks[4] = { ...raw[8] };
    expect(assessHand(pinch, frame).pointing).toBe(false);
  });

  it.each([5, 6, 7, 8, 9, 17])("never rescues missing required index/core landmark %s", (index) => {
    const { hand } = croppedPose();
    hand.landmarks[index] = { x: 0, y: 0, z: 0, valid: false };
    expect(assessHand(hand, frame)).toMatchObject({ requiredValid: false, framed: false, pointing: false });
  });

  it("never rescues a curled or collapsed index", () => {
    const { hand } = croppedPose({ indexBends: [0, 100, 150] });
    expect(assessHand(hand, frame)).toMatchObject({ pointing: false, insufficientFingerEvidence: false });
    const collapsed = croppedPose().hand;
    collapsed.landmarks[7] = { ...collapsed.landmarks[8] };
    expect(assessHand(collapsed, frame).pointing).toBe(false);
  });

  it.each(["excessive", "nonfinite", "duplicate", "inside", "index"])(
    "rejects malformed auxiliary %s estimates at the schema and direct geometry boundary",
    (problem) => {
      const { observation, hand } = croppedPose();
      const auxiliary = hand.offImageFingerLandmarks!;
      if (problem === "excessive") auxiliary[0].y = 1.151;
      if (problem === "nonfinite") auxiliary[0].z = NaN;
      if (problem === "duplicate") auxiliary.push({ ...auxiliary[0] });
      if (problem === "inside") auxiliary[0].y = 0.99;
      if (problem === "index") auxiliary[0].index = 8;
      expect(handObservationSchema.safeParse(observation).success).toBe(false);
      expect(assessHand(hand, frame).pointing).toBe(false);
      expect(assessHand(hand, frame).offImageFingerSupport).toBe(false);
    },
  );

  it("does not count one inferred finger twice as complete and partial evidence", () => {
    const { hand } = croppedPose();
    for (const index of [14, 15, 16, 18, 19, 20]) hand.landmarks[index].valid = false;
    hand.offImageFingerLandmarks = hand.offImageFingerLandmarks!.filter((point) => point.index <= 12);
    expect(assessHand(hand, frame).pointing).toBe(false);
  });

  it("rejects contradictory auxiliary estimates for already observed joints without changing valid observations", () => {
    const { observation, hand } = croppedPose();
    const index = 10;
    expect(hand.landmarks[index].valid).toBe(true);
    hand.offImageFingerLandmarks!.push({ index, x: 0.5, y: 1.05, z: -0.2 });
    expect(handObservationSchema.safeParse(observation).success).toBe(false);
    expect(assessHand(hand, frame).offImageFingerSupport).toBe(false);
    expect(hand.landmarks[index].valid).toBe(true);
  });

  it.each([-1, 21, 999])("fails safely for an auxiliary index outside the landmark array: %s", (index) => {
    const { observation, hand } = croppedPose();
    hand.offImageFingerLandmarks![0].index = index;
    expect(() => handObservationSchema.safeParse(observation)).not.toThrow();
    expect(handObservationSchema.safeParse(observation).success).toBe(false);
    expect(assessHand(hand, frame).offImageFingerSupport).toBe(false);
  });

  it("fails safely for a truncated observed-landmark array with auxiliary references", () => {
    const { observation, hand } = croppedPose();
    hand.landmarks.length = 10;
    expect(() => handObservationSchema.safeParse(observation)).not.toThrow();
    expect(handObservationSchema.safeParse(observation).success).toBe(false);
  });

  it("distinguishes visible index tracking from pointing intent when the palm and other fingers are unavailable", () => {
    const { hand } = croppedPose();
    for (let index = 0; index < 21; index++)
      if (![5, 6, 7, 8].includes(index)) hand.landmarks[index] = { x: 0, y: 0, z: 0, valid: false };
    delete hand.offImageFingerLandmarks;
    expect(assessHand(hand, frame)).toMatchObject({ indexTracked: true, pointing: false, requiredValid: false });
    hand.landmarks[7].valid = false;
    expect(assessHand(hand, frame).indexTracked).toBe(false);
  });

  it("does not call a collapsed index tracked, and tracking alone never turns an open hand into a point", () => {
    const { hand } = croppedPose({ otherBends: [0, 5, 10] });
    expect(assessHand(hand, frame)).toMatchObject({ indexTracked: true, pointing: false });
    hand.landmarks[7] = { ...hand.landmarks[8] };
    expect(assessHand(hand, frame).indexTracked).toBe(false);
  });
});
