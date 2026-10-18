// @sounding-line-registration owner=reach suite=unit.reach contracts=reach.phase1.foundation
import { describe, expect, it } from "vitest";
import { pointingPose } from "../../tests/e2e/fixtures/reach/pointing-poses";
import { cosine, handGeometry } from "@/watchglass/hand-geometry";
import { indexGeometry } from "@/watchglass/index-geometry";
import { assessHand } from "@/watchglass/hand-posture";
import { fullHandDecision, selectIndexModelAnchor } from "./hand-detection-authority";
import { syntheticObservation } from "./synthetic";

function observation(options: Parameters<typeof pointingPose>[0] = {}) {
  const value = syntheticObservation({ x: 0.5, y: 0.5 }, 0, 100);
  value.hands[0].landmarks = pointingPose(options);
  return value;
}

function chain(value: ReturnType<typeof observation>, base: number, unit: { x: number; y: number; z: number }) {
  const lengths = base === 5 ? [0.035, 0.025, 0.02] : [0.035, 0.028, 0.022];
  const aspect = value.frameHeight / value.frameWidth;
  for (let offset = 0; offset < 3; offset++) {
    const previous = value.hands[0].landmarks[base + offset];
    value.hands[0].landmarks[base + offset + 1] = {
      x: previous.x + unit.x * lengths[offset],
      y: previous.y + (unit.y * lengths[offset]) / aspect,
      z: previous.z + unit.z * lengths[offset],
      valid: true,
    };
  }
}

/** Generic analytic fold-back geometry; no owner trace or image coordinates. */
function foldedBack() {
  const value = observation({ indexBends: [0, 5, 10] });
  chain(value, 5, { x: 0.5, y: 0.05, z: -Math.sqrt(1 - 0.5 ** 2 - 0.05 ** 2) });
  for (const base of [9, 13, 17]) chain(value, base, { x: 0.2, y: 0.85, z: -Math.sqrt(1 - 0.2 ** 2 - 0.85 ** 2) });
  return value;
}

describe("positive observed secondary-finger gesture authority", () => {
  it("does not label straight depth-aligned fingers folded backward across the palm as open or competing", () => {
    const value = foldedBack(),
      hand = value.hands[0],
      shape = handGeometry(hand, value),
      index = indexGeometry(hand, value);
    expect(index.extended).toBe(true);
    expect(index.depthDominant).toBe(true);
    for (const base of [9, 13, 17]) {
      const finger = shape.finger(base)!;
      expect(finger.straightness).toBeGreaterThan(0.99);
      expect(cosine(finger.axis, index.axis)).toBeGreaterThan(0.35);
      expect(cosine(finger.axis, index.axis)).toBeLessThan(0.8);
      expect(cosine(finger.axis, shape.forward)).toBeLessThan(0);
    }
    expect(assessHand(hand, value)).toMatchObject({ pointing: true, posture: "POINT" });
    expect(fullHandDecision(value).decision).toBe("FULL_POINT");
    expect(selectIndexModelAnchor(value)).toMatchObject({ pointing: true, contrary: false, authority: "POINT" });
  });

  it("requires an independent palm forward basis rather than using the contested index proximal direction", () => {
    const value = foldedBack();
    value.hands[0].landmarks[0].valid = false;
    expect(handGeometry(value.hands[0], value).palmBasis).toBe("FINGER_RELATIONS");
    expect(assessHand(value.hands[0], value)).toMatchObject({ pointing: false, posture: "UNKNOWN" });
    expect(fullHandDecision(value).decision).toBe("FULL_AMBIGUOUS");
    expect(selectIndexModelAnchor(value)).toMatchObject({ authority: "AMBIGUOUS", pointing: false, contrary: false });
  });

  it("uses a currently observed knuckle arch when the wrist is absent", () => {
    const value = foldedBack();
    value.hands[0].landmarks[0].valid = false;
    value.hands[0].landmarks[9].y -= 0.02;
    chain(value, 9, { x: 0.2, y: 0.85, z: -Math.sqrt(1 - 0.2 ** 2 - 0.85 ** 2) });
    expect(handGeometry(value.hands[0], value).palmBasis).toBe("KNUCKLE_ARCH");
    expect(assessHand(value.hands[0], value)).toMatchObject({ pointing: true, posture: "POINT" });
    expect(fullHandDecision(value).decision).toBe("FULL_POINT");
  });

  it.each([0, 50])("pauses for a wrist/parallel-digit direction conflict at depth%s", (depthAngle) => {
    const value = observation({ indexBends: [0, 5, 10], otherBends: [0, 5, 10], depthAngle }),
      hand = value.hands[0],
      middle = hand.landmarks[9];
    hand.landmarks[0] = {
      x: middle.x,
      y: middle.y - 0.1 / (value.frameHeight / value.frameWidth),
      z: middle.z,
      valid: true,
    };
    const shape = handGeometry(hand, value),
      index = indexGeometry(hand, value);
    expect(index.extended).toBe(true);
    expect(index.depthDominant).toBe(depthAngle === 50);
    expect(Math.hypot(index.axis.x, index.axis.y) * value.frameWidth).toBeGreaterThan(12);
    for (const base of [9, 13, 17]) {
      const finger = shape.finger(base)!;
      expect(cosine(finger.axis, index.axis)).toBeGreaterThan(0.85);
      expect(cosine(finger.axis, shape.forward)).toBeLessThan(0);
    }
    expect(assessHand(hand, value)).toMatchObject({
      pointing: false,
      contrary: false,
      posture: "UNKNOWN",
      pointingEvidence: "NONE",
    });
    expect(fullHandDecision(value).decision).toBe("FULL_AMBIGUOUS");
    expect(selectIndexModelAnchor(value)).toMatchObject({ authority: "AMBIGUOUS", pointing: false, contrary: false });
  });

  it("keeps merely marginal index geometry uncertain without an explicit contrary gesture", () => {
    const value = observation({ indexBends: [0, 0, 95] });
    const index = indexGeometry(value.hands[0], value);
    expect(index.marginal).toBe(true);
    expect(index.extended).toBe(false);
    expect(fullHandDecision(value).decision).toBe("FULL_AMBIGUOUS");
    expect(selectIndexModelAnchor(value)).toMatchObject({ authority: "AMBIGUOUS", pointing: false, contrary: false });
  });

  it("does not turn end-on unprojectable open-finger evidence into a positive point", () => {
    const value = observation({ indexBends: [0, 5, 10], otherBends: [0, 5, 10], depthAngle: 90 });
    expect(indexGeometry(value.hands[0], value).extended).toBe(true);
    expect(assessHand(value.hands[0], value)).toMatchObject({ pointing: false, posture: "UNKNOWN" });
    expect(fullHandDecision(value).decision).toBe("FULL_AMBIGUOUS");
    expect(selectIndexModelAnchor(value)).toMatchObject({ authority: "AMBIGUOUS", pointing: false, contrary: false });
  });

  it("does not convert uncertain partial-hand evidence back into a legacy negative", () => {
    const value = observation({ indexBends: [0, 5, 10], otherBends: [0, 5, 10], depthAngle: 90 });
    value.hands[0].landmarks[13].valid = false;
    expect(value.hands[0].landmarks.filter((point) => point.valid)).toHaveLength(20);
    expect(fullHandDecision(value).decision).toBe("UNAVAILABLE");
    expect(assessHand(value.hands[0], value)).toMatchObject({ pointing: false, contrary: false, posture: "UNKNOWN" });
    const anchor = selectIndexModelAnchor(value);
    expect(anchor).toMatchObject({ pointing: false, contrary: false });
    expect(anchor).not.toHaveProperty("authority");
    expect(anchor).not.toHaveProperty("indexCue");
  });

  it("does not let malformed secondary chains manufacture uncertainty about a coherent cropped index", () => {
    const value = foldedBack(),
      hand = value.hands[0],
      aspect = value.frameHeight / value.frameWidth;
    hand.landmarks[0].valid = false;
    for (const base of [9, 13, 17]) {
      for (const [offset, length] of [0.04, 0.001, 0.001].entries()) {
        const previous = hand.landmarks[base + offset];
        hand.landmarks[base + offset + 1] = { ...previous, y: previous.y - length / aspect, valid: true };
      }
    }
    expect(assessHand(hand, value)).toMatchObject({ pointing: true, contrary: false, pointingEvidence: "DISTINCT" });
    expect(selectIndexModelAnchor(value)).toMatchObject({ pointing: true, contrary: false });
    expect(selectIndexModelAnchor(value)).toHaveProperty("indexCue");
  });

  it("retains a clear forward open-palm veto", () => {
    const value = observation({ indexBends: [0, 5, 10], otherBends: [0, 5, 10] });
    expect(assessHand(value.hands[0], value)).toMatchObject({ pointing: false, posture: "OPEN" });
    expect(selectIndexModelAnchor(value)).toMatchObject({ authority: "CONTRARY", pointing: false, contrary: true });
  });

  it("retains one clearly competing forward finger as a veto", () => {
    const value = observation(),
      straight = pointingPose({ otherBends: [0, 0, 0] });
    for (const id of [10, 11, 12]) value.hands[0].landmarks[id] = straight[id];
    expect(assessHand(value.hands[0], value).pointing).toBe(false);
    expect(fullHandDecision(value).decision).toBe("FULL_CONTRARY");
  });

  it("retains clear bent-index and visible pinch vetoes", () => {
    const bent = observation({ indexBends: [0, 100, 150] });
    expect(indexGeometry(bent.hands[0], bent).marginal).toBe(false);
    expect(fullHandDecision(bent).decision).toBe("FULL_CONTRARY");
    const pinch = observation();
    pinch.hands[0].landmarks[4] = { ...pinch.hands[0].landmarks[8] };
    expect(fullHandDecision(pinch).decision).toBe("FULL_CONTRARY");
  });
});
