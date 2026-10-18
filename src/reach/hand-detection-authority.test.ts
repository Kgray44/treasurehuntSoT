// @sounding-line-registration owner=reach suite=unit.reach contracts=reach.phase1.foundation
import { describe, expect, it } from "vitest";
import { pointingPose } from "../../tests/e2e/fixtures/reach/pointing-poses";
import { fullHandDecision, selectIndexModelAnchor } from "./hand-detection-authority";
import { syntheticObservation } from "./synthetic";
import { indexGeometry } from "@/watchglass/index-geometry";
import { cosine, handGeometry } from "@/watchglass/hand-geometry";

function observation(options: Parameters<typeof pointingPose>[0] = {}) {
  const value = syntheticObservation({ x: 0.5, y: 0.5 }, 0, 100);
  value.hands[0].landmarks = pointingPose(options);
  return value;
}
const missing = { x: 0, y: 0, z: 0, valid: false };
function secondaryAngles(value: ReturnType<typeof observation>, base: number, degrees: number[]) {
  const hand = value.hands[0],
    index = indexGeometry(hand, value);
  const unit = { x: index.axis.x / index.reach, y: index.axis.y / index.reach, z: index.axis.z / index.reach };
  const aspect = value.frameHeight / value.frameWidth;
  for (let i = 0; i < 3; ++i) {
    const angle = (degrees[i] * Math.PI) / 180,
      length = [0.035, 0.028, 0.022][i],
      prior = hand.landmarks[base + i];
    hand.landmarks[base + i + 1] = {
      x: prior.x + (unit.x * Math.cos(angle) + Math.sin(angle)) * length,
      y: prior.y + (unit.y * Math.cos(angle) * length) / aspect,
      z: prior.z + unit.z * Math.cos(angle) * length,
      valid: true,
    };
  }
}

describe("whole-hand authority before index fallback", () => {
  it("supplies a conservative observed region for a registered cropped hand with a complete index and proximal support", () => {
    const value = observation();
    value.hands[0].continuity = "CONTINUOUS";
    const keep = [1, 2, 3, 5, 6, 7, 8, 9, 10, 13, 17];
    for (let id = 0; id < 21; id++) if (!keep.includes(id)) value.hands[0].landmarks[id] = missing;
    const current = selectIndexModelAnchor(value)!;
    expect(current.handRegion).toMatchObject({ source: current.identitySource, structuredSupport: true });
    expect(current.handRegion!.points).toHaveLength(11);
    value.hands[0].continuity = "ACQUIRED";
    expect(selectIndexModelAnchor(value)).not.toHaveProperty("handRegion");
  });
  it("cannot create a whole-hand exclusion region from an isolated index or two hand hypotheses", () => {
    const value = observation();
    value.hands[0].continuity = "CONTINUOUS";
    for (let id = 0; id < 21; id++) if (![5, 6, 7, 8].includes(id)) value.hands[0].landmarks[id] = missing;
    expect(selectIndexModelAnchor(value)).not.toHaveProperty("handRegion");
    const two = observation();
    two.hands[0].continuity = "CONTINUOUS";
    two.hands.push({ ...two.hands[0], trackId: "other-hand", trackGeneration: 2 });
    expect(selectIndexModelAnchor(two)).not.toHaveProperty("handRegion");
  });
  it("reports current same-hand continuity separately from uncertain index geometry", () => {
    const current = observation();
    current.hands[0].continuity = "CONTINUOUS";
    const source = selectIndexModelAnchor(current)!.identitySource;
    expect(source).toBe(selectIndexModelAnchor(current)!.authoritySource);
    current.hands[0].landmarks[7] = missing;
    expect(selectIndexModelAnchor(current)).toMatchObject({
      authority: "AMBIGUOUS",
      identitySource: source,
      pointing: false,
      point: null,
    });
    current.hands[0].continuity = "AMBIGUOUS";
    expect(selectIndexModelAnchor(current)).not.toHaveProperty("identitySource");
    current.hands[0].continuity = "ACQUIRED";
    expect(selectIndexModelAnchor(current)).not.toHaveProperty("identitySource");
  });

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

  it.each([0, 85].flatMap((depthAngle) => [110, 150].map((angle) => ({ depthAngle, angle }))))(
    "does not call two straight secondary chains pointing opposite the index an open hand (%o)",
    ({ depthAngle, angle }) => {
      const value = observation({ indexBends: [0, 5, 10], depthAngle });
      for (const base of [9, 17]) secondaryAngles(value, base, [angle, angle, angle]);
      const geometry = handGeometry(value.hands[0], value),
        index = indexGeometry(value.hands[0], value);
      for (const base of [9, 17]) {
        const finger = geometry.finger(base)!;
        expect(finger.straightness).toBeGreaterThan(0.99);
        expect(cosine(finger.axis, index.axis)).toBeLessThan(0);
      }
      expect(fullHandDecision(value).decision).toBe("FULL_POINT");
    },
  );

  it.each([0, 85])("still vetoes genuinely forward splayed open fingers at depth%s", (depthAngle) => {
    const value = observation({ indexBends: [0, 5, 10], depthAngle });
    secondaryAngles(value, 9, [45, 80, 80]);
    secondaryAngles(value, 17, [-80, -45, -45]);
    const geometry = handGeometry(value.hands[0], value),
      index = indexGeometry(value.hands[0], value);
    for (const base of [9, 17]) {
      const finger = geometry.finger(base)!;
      expect(finger.straightness).toBeGreaterThan(0.93);
      expect(finger.straightness).toBeLessThan(0.96);
      expect(finger.pipAlignment).toBeGreaterThan(0.7);
      expect(finger.pipAlignment).toBeLessThan(0.85);
      expect(cosine(finger.axis, index.axis)).toBeGreaterThan(0.35);
    }
    expect(fullHandDecision(value).decision).toBe("FULL_CONTRARY");
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

  it("exposes a current partial index cue with the same canonical source and no fabricated palm authority", () => {
    const value = observation();
    const full = selectIndexModelAnchor(value)!;
    expect(full).not.toHaveProperty("indexCue");
    for (let id = 0; id < 21; id++) if (![5, 6, 7, 8].includes(id)) value.hands[0].landmarks[id] = missing;
    const partial = selectIndexModelAnchor(value)!;
    expect(partial.indexCue?.source).toBe(full.authoritySource);
    expect(partial.indexCue?.index).toEqual(full.geometry!.index);
    expect(partial).not.toHaveProperty("geometry");
    expect(partial).not.toHaveProperty("authority");
    expect(partial).not.toHaveProperty("identityObserved");
    const saved = partial.indexCue!.index[3].x;
    value.hands[0].landmarks[8].x += 0.01;
    expect(partial.indexCue!.index[3].x).toBe(saved);
    value.cameraLeaseId = "another-camera";
    expect(selectIndexModelAnchor(value)!.indexCue?.source).not.toBe(partial.indexCue?.source);
    value.hands[0].landmarks[7] = missing;
    expect(selectIndexModelAnchor(value)).toBeNull();
  });

  it("does not offer a partial pointing cue past an open hand, bent index or multiple hands", () => {
    const open = observation({ otherBends: [0, 0, 0] });
    expect(selectIndexModelAnchor(open)).not.toHaveProperty("indexCue");
    const bent = observation({ indexBends: [0, 100, 150] });
    for (let id = 0; id < 21; id++) if (![5, 6, 7, 8].includes(id)) bent.hands[0].landmarks[id] = missing;
    expect(selectIndexModelAnchor(bent)?.indexCue).toBeUndefined();
    const two = observation();
    for (let id = 0; id < 21; id++) if (![5, 6, 7, 8].includes(id)) two.hands[0].landmarks[id] = missing;
    two.hands.push(structuredClone(two.hands[0]));
    expect(selectIndexModelAnchor(two)).toBeNull();
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
