// @sounding-line-registration owner=reach suite=unit.reach contracts=reach.phase1.foundation
import { describe, expect, it } from "vitest";
import { pointingPose } from "../../tests/e2e/fixtures/reach/pointing-poses";
import { fullHandDecision, selectIndexModelAnchor } from "./hand-detection-authority";
import { syntheticObservation } from "./synthetic";

function observation(options: Parameters<typeof pointingPose>[0] = {}) {
  const value = syntheticObservation({ x: 0.5, y: 0.5 }, 0, 100);
  value.hands[0].landmarks = pointingPose(options);
  return value;
}
const missing = { x: 0, y: 0, z: 0, valid: false };

describe("whole-hand authority before index fallback", () => {
  it.each([0, 55, 85, 90])("recognizes comfortable whole-hand pointing at depth orientation%s", (depthAngle) => {
    const value = observation({ depthAngle });
    expect(fullHandDecision(value)).toMatchObject({ decision: "FULL_POINT" });
    expect(selectIndexModelAnchor(value)).toMatchObject({ authority: "POINT", pointing: true, contrary: false });
    expect(selectIndexModelAnchor(value)?.point).toEqual({
      x: value.hands[0].landmarks[8].x,
      y: value.hands[0].landmarks[8].y,
    });
  });

  it("keeps the wrist optional when the observed knuckle row and other fingers suffice", () => {
    const value = observation();
    value.hands[0].landmarks[0] = missing;
    expect(fullHandDecision(value).decision).toBe("FULL_POINT");
  });

  it("supplies same-capture observed anatomy only for a conditioned full index point", () => {
    const value = observation();
    const anchor = selectIndexModelAnchor(value)!;
    expect(anchor.geometry?.index).toEqual(
      [5, 6, 7, 8].map((id) => {
        const { x, y, z } = value.hands[0].landmarks[id];
        return { x, y, z };
      }),
    );
    expect(anchor.geometry?.palmSpan).toBeGreaterThan(0);
    expect(anchor.identityObserved).toBe(true);
    const savedX = anchor.geometry!.index[3].x;
    value.hands[0].landmarks[8].x += 0.01;
    expect(anchor.geometry!.index[3].x).toBe(savedX);
    for (const pose of [observation({ otherBends: [0, 5, 10] }), observation({ indexBends: [0, 100, 150] })]) {
      expect(selectIndexModelAnchor(pose)).not.toHaveProperty("geometry");
      expect(selectIndexModelAnchor(pose)).toMatchObject({ pointing: false, identityObserved: true });
    }
    for (let id = 0; id < 21; id++) if (![5, 6, 7, 8].includes(id)) value.hands[0].landmarks[id] = missing;
    expect(selectIndexModelAnchor(value)).not.toHaveProperty("geometry");
    expect(selectIndexModelAnchor(value)).not.toHaveProperty("identityObserved");
  });

  it.each([0, 90])("uses full3D other-finger evidence to reject an open hand at depth orientation%s", (depthAngle) => {
    const value = observation({ indexBends: [0, 5, 10], otherBends: [0, 5, 10], depthAngle });
    expect(selectIndexModelAnchor(value)).toMatchObject({ authority: "CONTRARY", pointing: false, contrary: true });
  });

  it("rejects bent index, a competing straight middle finger and a visible pinch", () => {
    const bent = observation({ indexBends: [0, 100, 150] });
    expect(fullHandDecision(bent).decision).toBe("FULL_CONTRARY");
    const competing = observation(),
      straight = pointingPose({ otherBends: [0, 0, 0] });
    for (const id of [10, 11, 12]) competing.hands[0].landmarks[id] = straight[id];
    expect(fullHandDecision(competing).decision).toBe("FULL_CONTRARY");
    const pinched = observation();
    pinched.hands[0].landmarks[4] = { ...pinched.hands[0].landmarks[8] };
    expect(fullHandDecision(pinched).decision).toBe("FULL_CONTRARY");
  });

  it.each([6, 7, 8])("does not fall back past a whole hand with missing index joint%s", (id) => {
    const value = observation();
    value.hands[0].landmarks[id] = missing;
    expect(fullHandDecision(value)).toMatchObject({ decision: "FULL_AMBIGUOUS", indexPoint: null });
    expect(selectIndexModelAnchor(value)).toMatchObject({ authority: "AMBIGUOUS", point: null, pointing: false });
  });

  it("does not treat many in-bounds points as a whole hand without complete finger anatomy", () => {
    const value = observation();
    for (const id of [10, 14, 18]) value.hands[0].landmarks[id] = missing;
    expect(value.hands[0].landmarks.filter((p) => p.valid)).toHaveLength(18);
    expect(fullHandDecision(value).decision).toBe("UNAVAILABLE");
    expect(selectIndexModelAnchor(value)).not.toHaveProperty("authority");
  });

  it("does not use bounded off-image estimates to manufacture available full-hand evidence", () => {
    const value = observation();
    for (const id of [12, 16, 20]) value.hands[0].landmarks[id] = missing;
    value.hands[0].offImageFingerLandmarks = [12, 16, 20].map((index) => ({ index, x: 1.05, y: 0.5, z: 0 }));
    expect(fullHandDecision(value).decision).toBe("UNAVAILABLE");
  });

  it.each(["collapsed", "unordered", "nonfinite"])("rejects a%s knuckle row despite a21-joint array", (caseName) => {
    const value = observation(),
      points = value.hands[0].landmarks;
    if (caseName === "collapsed") points[17] = { ...points[5] };
    if (caseName === "unordered") [points[9], points[13]] = [points[13], points[9]];
    if (caseName === "nonfinite") points[9].z = NaN;
    expect(fullHandDecision(value).decision).toBe("UNAVAILABLE");
  });

  it("abstains for two viable full hands or an ambiguous full-hand association", () => {
    const value = observation();
    value.hands.push({ ...structuredClone(value.hands[0]), trackId: "second-hand", trackGeneration: 2 });
    expect(selectIndexModelAnchor(value)).toMatchObject({ authority: "AMBIGUOUS", point: null });
    value.hands.pop();
    value.hands[0].continuity = "AMBIGUOUS";
    expect(selectIndexModelAnchor(value)).toMatchObject({ authority: "AMBIGUOUS", point: null });
  });

  it("keeps one viable full hand authoritative beside an incomplete secondary hypothesis", () => {
    const value = observation(),
      partial = structuredClone(value.hands[0]);
    partial.trackId = "partial-second-hand";
    for (let id = 0; id < 21; id++) if (![5, 6, 7, 8].includes(id)) partial.landmarks[id] = missing;
    value.hands.push(partial);
    expect(selectIndexModelAnchor(value)).toMatchObject({ authority: "POINT" });
  });

  it("uses the explicit index fallback only when the full hand is unavailable", () => {
    const value = observation();
    for (let id = 0; id < 21; id++) if (![5, 6, 7, 8].includes(id)) value.hands[0].landmarks[id] = missing;
    expect(fullHandDecision(value).decision).toBe("UNAVAILABLE");
    expect(selectIndexModelAnchor(value)).toMatchObject({ pointing: true, contrary: false });
    expect(selectIndexModelAnchor(value)).not.toHaveProperty("authority");
    value.hands = [];
    expect(selectIndexModelAnchor(value)).toBeNull();
  });

  it("scopes full authority to track/source binding rather than handedness or fingertip coordinates", () => {
    const initial = observation(),
      key = selectIndexModelAnchor(initial)!.authoritySource;
    expect(key).toBeTruthy();
    const moved = structuredClone(initial);
    for (const point of moved.hands[0].landmarks) point.x += 0.01;
    moved.hands[0].handedness = "LEFT";
    expect(selectIndexModelAnchor(moved)!.authoritySource).toBe(key);
    for (const mutate of [
      (o: typeof initial) => {
        o.hands[0].trackId = "new-hand";
      },
      (o: typeof initial) => {
        o.hands[0].trackGeneration++;
      },
      (o: typeof initial) => {
        o.providerGeneration++;
      },
      (o: typeof initial) => {
        o.cameraLeaseId = "new-camera";
      },
      (o: typeof initial) => {
        o.cameraFrameVersion++;
      },
      (o: typeof initial) => {
        o.modelDigest = "f".repeat(64);
      },
      (o: typeof initial) => {
        o.mirrorTransform = "PREVIEW_X";
      },
    ]) {
      const changed = structuredClone(initial);
      mutate(changed);
      expect(selectIndexModelAnchor(changed)!.authoritySource).not.toBe(key);
    }
    const ambiguous = observation();
    ambiguous.hands[0].continuity = "AMBIGUOUS";
    expect(selectIndexModelAnchor(ambiguous)).not.toHaveProperty("authoritySource");
  });
});
