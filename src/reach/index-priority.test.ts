// @sounding-line-registration owner=reach suite=unit.reach contracts=reach.phase1.foundation
import { describe, expect, it } from "vitest";
import { assessHand } from "@/watchglass/hand-posture";
import { indexGeometry } from "@/watchglass/index-geometry";
import { pointingPose } from "../../tests/e2e/fixtures/reach/pointing-poses";
import { syntheticObservation } from "./synthetic";

const frame = { frameWidth: 640, frameHeight: 480 };
function hand(options: Parameters<typeof pointingPose>[0] = {}, indexOnly = false) {
  const hand = syntheticObservation({ x: 0.5, y: 0.5 }, 0, 100).hands[0];
  hand.landmarks = pointingPose(options);
  if (indexOnly)
    for (let index = 0; index < 21; index++)
      if (![5, 6, 7, 8].includes(index)) hand.landmarks[index] = { x: 0, y: 0, z: 0, valid: false };
  return hand;
}

describe("observed index priority and honest intent evidence", () => {
  it.each([0, 35, 55, 70, 85, 90])("uses the observed index alone at depth orientation %s", (depthAngle) => {
    const point = hand({ indexBends: [0, 10, 20], depthAngle }, true);
    expect(assessHand(point, frame)).toMatchObject({
      indexTracked: true,
      requiredValid: true,
      framed: true,
      geometry: true,
      pointing: true,
      intentEvidence: "HEURISTIC_INDEX_ONLY",
      offImageFingerSupport: false,
    });
    expect(indexGeometry(point, frame).chain).toBeGreaterThan(0);
  });

  it("makes the intended cropped-open-hand ambiguity explicit instead of claiming verified intent", () => {
    const open = hand({ indexBends: [0, 5, 10], otherBends: [0, 5, 10] });
    expect(assessHand(open, frame).pointing).toBe(false);
    const cropped = hand({ indexBends: [0, 5, 10], otherBends: [0, 5, 10] }, true);
    expect(assessHand(cropped, frame)).toMatchObject({ pointing: true, intentEvidence: "HEURISTIC_INDEX_ONLY" });
  });

  it("retains a clearly projected competing middle finger and thumb pinch as contrary evidence", () => {
    const competing = hand({ indexBends: [0, 5, 10] });
    const open = pointingPose({ otherBends: [0, 5, 10] });
    for (const index of [10, 11, 12]) competing.landmarks[index] = open[index];
    expect(assessHand(competing, frame).pointing).toBe(false);
    const pinched = hand({}, true);
    pinched.landmarks[4] = { ...pinched.landmarks[8] };
    expect(assessHand(pinched, frame).pointing).toBe(false);
  });

  it.each([{ indexBends: [0, 100, 150] }, { indexBends: [0, 0, 145] }])(
    "rejects curled and hooked index anatomy without requiring a palm: %j",
    (options) => {
      expect(assessHand(hand(options, true), frame).pointing).toBe(false);
    },
  );

  it.each([5, 6, 7, 8])("does not reconstruct a missing index joint %s", (index) => {
    const point = hand({}, true);
    point.landmarks[index] = { x: 0, y: 0, z: 0, valid: false };
    expect(indexGeometry(point, frame)).toMatchObject({ complete: false, indexTracked: false, geometry: false });
    expect(assessHand(point, frame).pointing).toBe(false);
  });

  it.each([NaN, Infinity, -Infinity])("rejects a nonfinite index coordinate: %s", (value) => {
    const point = hand({}, true);
    point.landmarks[7].z = value;
    expect(indexGeometry(point, frame).complete).toBe(false);
    expect(assessHand(point, frame).pointing).toBe(false);
  });

  it("rejects zero, too-small, excessive or proportionally malformed index chains", () => {
    const collapsed = hand({}, true);
    for (const index of [6, 7, 8]) collapsed.landmarks[index] = { ...collapsed.landmarks[5] };
    expect(indexGeometry(collapsed, frame).geometry).toBe(false);
    const tiny = hand({}, true);
    const base = tiny.landmarks[5];
    for (const index of [6, 7, 8])
      tiny.landmarks[index] = {
        ...tiny.landmarks[index],
        x: base.x + (tiny.landmarks[index].x - base.x) * 0.01,
        y: base.y + (tiny.landmarks[index].y - base.y) * 0.01,
        z: base.z + (tiny.landmarks[index].z - base.z) * 0.01,
      };
    expect(indexGeometry(tiny, frame).geometry).toBe(false);
    const excessive = hand({}, true);
    excessive.landmarks[6].z = -1;
    excessive.landmarks[7].z = -2;
    excessive.landmarks[8].z = -3;
    expect(indexGeometry(excessive, frame).geometry).toBe(false);
    const malformed = hand({}, true);
    malformed.landmarks[7] = { ...malformed.landmarks[6], z: malformed.landmarks[6].z - 0.0001 };
    expect(indexGeometry(malformed, frame).geometry).toBe(false);
  });

  it("does not invent a point from an empty raw hand", () => {
    const empty = hand({}, true);
    empty.landmarks = empty.landmarks.map(() => ({ x: 0, y: 0, z: 0, valid: false }));
    expect(assessHand(empty, frame)).toMatchObject({ detected: false, pointing: false, indexTracked: false });
  });

  it("corrects image aspect before using inferred joint geometry", () => {
    const reference = indexGeometry(hand({ depthAngle: 75 }, true), frame);
    for (const aspect of [0.5, 1, 1.5]) {
      const shape = indexGeometry(hand({ depthAngle: 75, aspect }, true), {
        frameWidth: 1000,
        frameHeight: aspect * 1000,
      });
      expect(shape.chain).toBeCloseTo(reference.chain);
      expect(shape.straightness).toBeCloseTo(reference.straightness);
      expect(shape.extended).toBe(reference.extended);
    }
  });
});
