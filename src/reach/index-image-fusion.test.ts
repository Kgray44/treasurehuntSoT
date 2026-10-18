// @sounding-line-registration owner=reach suite=unit.reach contracts=reach.phase1.foundation
import { describe, expect, it } from "vitest";
import { IndexImageTracker, type IndexGrayFrame, type IndexModelAnchor } from "./index-image-tracker";
import { IndexImageObservationGate } from "./index-image-observation";

const binding = {
  providerGeneration: 1,
  cameraLeaseId: "synthetic-fusion",
  cameraFrameVersion: 1,
  frameWidth: 320,
  frameHeight: 240,
  mirrorTransform: "NONE" as const,
};
const point = (x: number, y = 45) => ({ x: x / 159, y: y / 119 });
function model(x: number, y = 45, source = "same-complete-hand"): IndexModelAnchor {
  return {
    point: point(x, y),
    pointing: true,
    contrary: false,
    authority: "POINT",
    authoritySource: source,
    identityObserved: true,
    geometry: {
      index: [24, 16, 8, 0].map((dy) => ({ ...point(x, y + dy), z: 0 })) as unknown as NonNullable<
        IndexModelAnchor["geometry"]
      >["index"],
      palmSpan: 0.1,
    },
  };
}
function frame(x: number, at: number, seed: number | null = 0): IndexGrayFrame {
  const data = new Uint8Array(160 * 120).fill(30);
  if (seed !== null)
    for (let dy = -10; dy <= 10; ++dy)
      for (let dx = -10; dx <= 10; ++dx) {
        const xx = x + dx,
          yy = 45 + dy;
        if (xx >= 0 && xx < 160)
          data[yy * 160 + xx] = 45 + ((dx * 73 + dy * 127 + dx * dy * 19 + seed * 41 + 100000) % 135);
      }
  return { data, width: 160, height: 120, capture: at, received: at + 10 };
}
function establish(tracker: IndexImageTracker) {
  let result = tracker.update(frame(45, 100), model(45));
  for (const at of [166, 233]) result = tracker.update(frame(45, at), model(45));
  expect(result).toMatchObject({ state: "TRACKING", coordinateSource: "FUSED" });
  return result;
}
describe("one conditioned model/image relative producer", () => {
  it("retains registration across a brief unavailable model frame but requires current full geometry for action", () => {
    const tracker = new IndexImageTracker(binding),
      seed = establish(tracker);
    expect(tracker.update(frame(47, 300, null))).toMatchObject({ point: null, trackId: seed.trackId });
    expect(tracker.update(frame(48, 333, null), { point: point(48), pointing: true, contrary: false })).toMatchObject({
      point: null,
      trackId: seed.trackId,
    });
    expect(tracker.update(frame(49, 366, null), model(49))).toMatchObject({
      state: "TRACKING",
      coordinateSource: "MODEL",
      trackId: seed.trackId,
    });
  });
  it("preserves continuously verified full-hand identity during contrary posture without collecting a point", () => {
    const tracker = new IndexImageTracker(binding);
    let seed = tracker.update(frame(45, 100, null), model(45));
    for (const at of [166, 233]) seed = tracker.update(frame(45, at, null), model(45));
    for (let at = 300; at <= 1700; at += 200) {
      const contrary = {
        ...model(45),
        geometry: undefined,
        authority: "CONTRARY" as const,
        pointing: false,
        contrary: true,
      };
      expect(tracker.update(frame(45, at, null), contrary)).toMatchObject({
        point: null,
        matchedPoint: null,
        trackId: seed.trackId,
        trackGeneration: seed.trackGeneration,
        opticalEpoch: 0,
      });
    }
    expect(tracker.update(frame(45, 1766, null), model(45)).point).toBeNull();
    expect(tracker.update(frame(45, 1833, null), model(45)).point).toBeNull();
    expect(tracker.update(frame(45, 1900, null), model(45))).toMatchObject({
      state: "TRACKING",
      coordinateSource: "MODEL",
      trackId: seed.trackId,
      point: point(45),
    });
  });
  it.each(["BARE_TAG", "DIFFERENT_SOURCE", "AMBIGUOUS", "GAP"] as const)(
    "does not renew model-only identity from %s",
    (condition) => {
      const tracker = new IndexImageTracker(binding);
      let seed = tracker.update(frame(45, 100, null), model(45));
      for (const at of [166, 233]) seed = tracker.update(frame(45, at, null), model(45));
      const times = condition === "GAP" ? [1600] : [300, 500, 700, 900, 1100, 1300, 1500, 1700];
      for (const at of times) {
        const contrary = {
          ...model(45, 45, condition === "DIFFERENT_SOURCE" ? "other-hand" : "same-complete-hand"),
          geometry: undefined,
          authority: condition === "AMBIGUOUS" ? ("AMBIGUOUS" as const) : ("CONTRARY" as const),
          pointing: false,
          contrary: true,
          identityObserved: condition !== "BARE_TAG",
        };
        expect(tracker.update(frame(45, at, null), contrary).point).toBeNull();
      }
      let returned;
      for (const at of [1800, 1866, 1933]) returned = tracker.update(frame(45, at, null), model(45));
      expect(returned!.trackId).not.toBe(seed.trackId);
    },
  );
  it("reports anatomical-correction uncertainty instead of only the smaller optical proxy", () => {
    const tracker = new IndexImageTracker(binding);
    establish(tracker);
    let observed;
    for (let i = 0; i < 30; ++i) observed = tracker.update(frame(45, 300 + i * 50), model(49));
    expect(observed!.coordinateSource).toBe("FUSED");
    const correction = Math.abs(observed!.point!.x * 159 - 45);
    expect(correction).toBeGreaterThan(3);
    expect(observed!.uncertaintyRadiusPixels).toBeGreaterThanOrEqual(correction * 2 - 1e-9);
  });
  it("initializes from current full-hand anatomy without requiring accidental tip texture", () => {
    const tracker = new IndexImageTracker(binding);
    expect(tracker.update(frame(45, 100, null), model(45))).toMatchObject({ state: "UNSEEDED", point: null });
    expect(tracker.update(frame(45, 166, null), model(45))).toMatchObject({ state: "UNSEEDED", point: null });
    const acquired = tracker.update(frame(45, 233, null), model(45));
    expect(acquired).toMatchObject({ state: "TRACKING", coordinateSource: "MODEL", point: point(45), opticalEpoch: 0 });
    expect(acquired.quality.correlation).toBeNull();
    expect(acquired.uncertaintyRadiusPixels).toBe(12);
    expect(tracker.update(frame(45, 300, null))).toMatchObject({
      point: null,
      state: "LOST",
      trackId: acquired.trackId,
    });
  });
  it("preserves one finger through long changed appearance and reacquires an optical epoch with independent current matches", () => {
    const tracker = new IndexImageTracker(binding),
      seed = establish(tracker);
    let observed = seed;
    for (let i = 1; i <= 25; ++i) {
      const x = 45 + i * 2,
        at = 233 + i * 70;
      observed = tracker.update(frame(x, at, i < 22 ? null : 19), model(x));
      expect(observed).toMatchObject({
        state: "TRACKING",
        trackId: seed.trackId,
        trackGeneration: seed.trackGeneration,
      });
      expect(observed.point!.x * 159).toBeCloseTo(x, 6);
    }
    expect(observed.opticalEpoch).toBeGreaterThan(seed.opticalEpoch!);
    expect(observed.coordinateSource).toBe("FUSED");
    const cropped = tracker.update(frame(97, 2053, 19));
    expect(cropped).toMatchObject({ state: "TRACKING", coordinateSource: "IMAGE", trackId: seed.trackId });
    expect(cropped.point!.x * 159).toBeCloseTo(97, 6);
  });
  it("cannot bridge appearance loss with a different model source or malformed anatomy", () => {
    for (const changed of ["source", "collapsed", "nan", "tip", "scale"] as const) {
      const tracker = new IndexImageTracker(binding),
        seed = establish(tracker);
      for (const at of [300, 366, 433, 500]) {
        const anchor = model(50, 45, changed === "source" ? "different-hand" : "same-complete-hand");
        if (changed === "collapsed")
          anchor.geometry!.index = [0, 0, 0, 0].map(() => ({ ...point(50), z: 0 })) as unknown as NonNullable<
            IndexModelAnchor["geometry"]
          >["index"];
        if (changed === "nan") anchor.geometry!.index[1].z = NaN;
        if (changed === "tip") anchor.geometry!.index[3].x += 0.05;
        if (changed === "scale") anchor.geometry!.palmSpan = 8;
        expect(tracker.update(frame(50, at, null), anchor)).toMatchObject({ point: null, trackId: seed.trackId });
      }
    }
  });
  it("keeps manual selection optical-only through good model appearance failure and expiry", () => {
    const tracker = new IndexImageTracker(binding),
      seed = tracker.update(frame(45, 100), model(45), point(45));
    for (const at of [166, 233, 300, 400, 700, 1301, 1400, 1500]) {
      const observed = tracker.update(frame(50, at, null), model(50));
      expect(observed.point).toBeNull();
      expect(observed.coordinateSource).toBe("IMAGE");
      if (at > 1300) expect(observed).toMatchObject({ trackId: null, reason: "MANUAL_SELECTION_REQUIRED" });
      else expect(observed.trackId).toBe(seed.trackId);
    }
  });
  it("retains accepted disagreeing pixels as a conflict instead of model reanchoring to another digit", () => {
    const tracker = new IndexImageTracker(binding),
      seed = establish(tracker);
    for (const at of [300, 366, 433, 500])
      expect(tracker.update(frame(45, at), model(69))).toMatchObject({
        state: "UNCERTAIN",
        point: null,
        reason: "FULL_HAND_INDEX_CONFLICT",
        trackId: seed.trackId,
        opticalEpoch: seed.opticalEpoch,
      });
    for (const at of [566, 633, 700])
      expect(tracker.update(frame(45, at, null), model(69))).toMatchObject({
        point: null,
        trackId: seed.trackId,
        opticalEpoch: seed.opticalEpoch,
      });
    // Spatial reconfirmation starts a fresh three-frame cohort; old authority
    // age cannot be borrowed by a returning model during image loss.
    tracker.update(frame(45, 766), model(45));
    expect(tracker.update(frame(45, 800, null), model(45)).point).toBeNull();
    expect(tracker.update(frame(45, 833, null), model(45)).point).toBeNull();
    expect(tracker.update(frame(45, 900, null), model(45))).toMatchObject({
      state: "TRACKING",
      coordinateSource: "MODEL",
      trackId: seed.trackId,
    });
  });
  it("does not let contrary or ambiguous hands become model-only pointing", () => {
    for (const authority of ["CONTRARY", "AMBIGUOUS"] as const) {
      const tracker = new IndexImageTracker(binding),
        seed = establish(tracker);
      for (const at of [300, 366, 433])
        expect(
          tracker.update(frame(45, at, null), {
            ...model(45),
            authority,
            pointing: false,
            contrary: authority === "CONTRARY",
          }),
        ).toMatchObject({ point: null, trackId: seed.trackId });
    }
  });
  it("clears verified model identity on a contrary wrong-tip conflict before blur can hide the contradiction", () => {
    const tracker = new IndexImageTracker(binding),
      seed = establish(tracker);
    const wrongContrary = {
      ...model(69),
      geometry: undefined,
      authority: "CONTRARY" as const,
      pointing: false,
      contrary: true,
    };
    expect(tracker.update(frame(45, 300), wrongContrary)).toMatchObject({
      state: "UNCERTAIN",
      reason: "FULL_HAND_INDEX_CONFLICT",
      point: null,
      trackId: seed.trackId,
    });
    for (const at of [366, 433, 500, 566])
      expect(tracker.update(frame(45, at, null), model(69))).toMatchObject({
        point: null,
        trackId: seed.trackId,
        opticalEpoch: seed.opticalEpoch,
      });
  });
  it("does not add large model jitter to stable high-quality pixels, and retains offset on image-only handoff", () => {
    const tracker = new IndexImageTracker(binding),
      seed = establish(tracker);
    const outputs: number[] = [];
    for (let i = 0; i < 40; ++i) {
      const observed = tracker.update(frame(45, 300 + i * 40), model(45 + (i % 2 ? 1 : -1)));
      expect(observed.trackId).toBe(seed.trackId);
      outputs.push(observed.point!.x * 159);
    }
    expect(Math.max(...outputs) - Math.min(...outputs)).toBeLessThan(0.31);
    const returned = tracker.update(frame(45, 1950));
    expect(returned.point!.x * 159).toBeCloseTo(outputs.at(-1)!, 8);
  });
  it("rolls back optical and model renewal if the source-origin predicate expires during completion", () => {
    const tracker = new IndexImageTracker(binding),
      seed = establish(tracker);
    let checks = 0;
    expect(() => tracker.complete(tracker.prepare(frame(47, 300)), model(47), 310, () => ++checks === 1)).toThrow(
      "INVALID_OR_STALE",
    );
    expect(tracker.update(frame(45, 366), model(45))).toMatchObject({
      sequence: 3,
      point: seed.point,
      trackId: seed.trackId,
      opticalEpoch: seed.opticalEpoch,
    });
    const cold = new IndexImageTracker(binding);
    cold.update(frame(45, 100, null), model(45));
    cold.update(frame(45, 166, null), model(45));
    checks = 0;
    expect(() => cold.complete(cold.prepare(frame(45, 233, null)), model(45), 243, () => ++checks === 1)).toThrow(
      "INVALID_OR_STALE",
    );
    expect(cold.update(frame(45, 300, null))).toMatchObject({ trackId: null, point: null, sequence: 2 });
  });
  it("passes real fused, fractional-image and texture-free model packets through the strict production gate", () => {
    for (const kind of ["FUSED", "IMAGE", "MODEL"] as const) {
      const tracker = new IndexImageTracker(binding);
      const gate = new IndexImageObservationGate({
        providerGeneration: binding.providerGeneration,
        cameraLeaseId: binding.cameraLeaseId,
        cameraFrameVersion: binding.cameraFrameVersion,
        mirrorTransform: binding.mirrorTransform,
        orientation: 0,
      });
      let last;
      for (let i = 0; i < 7; ++i) {
        const at = 100 + i * 67;
        const packet =
          kind === "IMAGE"
            ? tracker.update(frame(45, at), null, i === 0 ? point(45.25) : undefined)
            : tracker.update(frame(45, at, kind === "MODEL" ? null : 0), model(kind === "FUSED" ? 46 : 45));
        last = gate.accept(packet, packet.monotonicInferenceTime);
        if (last.state === "TRACKING" && last.matchedPoint) expect(last.matchedPoint).toEqual(last.point);
      }
      expect(last).toMatchObject({ state: "TRACKING", coordinateSource: kind });
      if (kind === "FUSED") expect(last!.point!.x).toBeGreaterThan(point(45).x);
      if (kind === "MODEL") expect(last!.matchedPoint).toBeNull();
      if (kind === "IMAGE") expect(last!.point!.x).toBeCloseTo(point(45.25).x, 10);
    }
  });
});
