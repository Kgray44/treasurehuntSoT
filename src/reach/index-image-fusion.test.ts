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
function partial(x: number, y = 45, source = "same-complete-hand"): IndexModelAnchor {
  return {
    point: point(x, y),
    pointing: true,
    contrary: false,
    indexCue: { source, index: model(x, y).geometry!.index },
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
function fingerFrame(x: number, at: number, changedTip = false, otherFinger = false): IndexGrayFrame {
  const value = frame(x, at, null);
  for (let dy = -10; dy <= 35; dy++)
    for (let dx = -10; dx <= 10; dx++) {
      const seed = (changedTip && dy <= 0) || otherFinger ? 19 : 0;
      value.data[(45 + dy) * 160 + x + dx] = 45 + ((dx * 73 + dy * 127 + dx * dy * 19 + seed * 41 + 100000) % 135);
    }
  return value;
}
function establish(tracker: IndexImageTracker) {
  let result = tracker.update(frame(45, 100), model(45));
  for (const at of [166, 233]) result = tracker.update(frame(45, at), model(45));
  expect(result).toMatchObject({ state: "TRACKING", coordinateSource: "FUSED" });
  return result;
}
describe("one conditioned model/image relative producer", () => {
  const withRegion = (anchor: IndexModelAnchor, narrow = false): IndexModelAnchor => ({
    ...anchor,
    identitySource: "same-complete-hand",
    handRegion: {
      source: "same-complete-hand",
      palmSpan: 0.1,
      points: Array.from({ length: 12 }, (_, i) =>
        point(narrow ? 40 + (i % 2) * 10 : 30 + (i % 2) * 55, 40 + Math.floor(i / 2) * 6),
      ),
    },
  });
  it("averages small model/image differences with bounded correction while retaining identity", () => {
    const tracker = new IndexImageTracker(binding);
    let seed;
    for (const at of [100, 166, 233]) seed = tracker.update(frame(45, at), withRegion(model(45)));
    const output = tracker.update(frame(45, 300), withRegion(model(54)));
    expect(output).toMatchObject({ state: "TRACKING", coordinateSource: "FUSED", trackId: seed!.trackId });
    expect(output.point!.x * 159).toBeGreaterThan(45);
    expect(output.point!.x * 159).toBeLessThanOrEqual(45.5);
  });
  it("rejects an optical match outside a credible current hand instead of moving the index onto background texture", () => {
    const tracker = new IndexImageTracker(binding);
    let seed;
    for (const at of [100, 166, 233]) seed = tracker.update(frame(45, at), withRegion(model(45), true));
    for (const at of [300, 366, 433]) {
      const output = tracker.update(frame(69, at), withRegion(model(45), true));
      expect(output).toMatchObject({ state: "TRACKING", coordinateSource: "MODEL", trackId: seed!.trackId });
      expect(output.point!.x * 159).toBeCloseTo(45, 6);
    }
  });
  it("retains inside-hand wrong-digit contradictions despite a credible current hand extent", () => {
    const tracker = new IndexImageTracker(binding);
    let seed;
    for (const at of [100, 166, 233]) seed = tracker.update(frame(45, at), withRegion(model(45)));
    for (const at of [300, 366, 433])
      expect(tracker.update(frame(45, at), withRegion(model(69)))).toMatchObject({
        state: "UNCERTAIN",
        point: null,
        trackId: seed!.trackId,
        reason: "FULL_HAND_INDEX_CONFLICT",
      });
  });
  it("withholds a cursor when a current cropped index contradicts the accepted image", () => {
    const tracker = new IndexImageTracker(binding),
      seed = establish(tracker);
    for (const at of [300, 366, 433])
      expect(tracker.update(frame(45, at), partial(69))).toMatchObject({
        state: "UNCERTAIN",
        point: null,
        trackId: seed.trackId,
        reason: "INDEX_MODEL_IMAGE_CONFLICT",
        opticalEpoch: seed.opticalEpoch,
      });
  });
  it.each(["FULL", "REGISTERED_INDEX"] as const)(
    "reconfirms a new %s image after a conflict without transferring identity or publishing probation",
    (support) => {
      const tracker = new IndexImageTracker(binding);
      const supported = (x: number): IndexModelAnchor => ({
        ...(support === "FULL" ? model(x) : partial(x)),
        identitySource: "same-complete-hand",
      });
      let seed;
      for (const at of [100, 166, 233, 300])
        seed = tracker.update(fingerFrame(45, at), { ...model(45), identitySource: "same-complete-hand" });
      expect(
        tracker.update(fingerFrame(45, 366), { ...model(69), identitySource: "same-complete-hand" }).point,
      ).toBeNull();
      let observed;
      const probation = [];
      for (let i = 0; i < 14; i++) {
        observed = tracker.update(fingerFrame(69, 433 + i * 67, true), supported(69));
        expect(observed.trackId).toBe(seed!.trackId);
        if (observed.reason === "FINGERTIP_RECONFIRMED_SETTLING") {
          probation.push(observed);
          expect(observed.point).toBeNull();
        }
      }
      expect(probation).toHaveLength(1);
      expect(observed).toMatchObject({ state: "TRACKING", trackId: seed!.trackId });
      expect(observed!.opticalEpoch).toBeGreaterThan(seed!.opticalEpoch!);
      expect(observed!.point!.x * 159).toBeCloseTo(69, 1);
    },
  );
  it("does not treat matching base joints as identity proof when the distal index is replaced by a different textured tip", () => {
    const tracker = new IndexImageTracker(binding);
    const anatomy = (wrongTip = false): IndexModelAnchor => ({
      ...model(45),
      identitySource: "same-complete-hand",
      point: point(wrongTip ? 57 : 45),
      geometry: {
        palmSpan: 0.2,
        index: [48, 32, 16, 0].map((dy, i) => ({
          ...point(wrongTip && i >= 2 ? 57 : 45, 45 + dy),
          z: 0,
        })) as unknown as NonNullable<IndexModelAnchor["geometry"]>["index"],
      },
    });
    const image = (at: number, wrongTip = false) => {
      const result = frame(45, at, null);
      for (let dy = -10; dy <= 64; dy++)
        for (let dx = -10; dx <= 10; dx++)
          if (!wrongTip || dy > 20)
            result.data[(45 + dy) * 160 + 45 + dx] = 45 + ((dx * 73 + dy * 127 + dx * dy * 19 + 100000) % 135);
      if (wrongTip) {
        const wrong = frame(57, at, 19);
        for (let y = 35; y <= 55; y++)
          for (let x = 47; x <= 67; x++) result.data[y * 160 + x] = wrong.data[y * 160 + x];
      }
      return result;
    };
    let seed;
    for (const at of [100, 166, 233, 300]) seed = tracker.update(image(at), anatomy());
    expect(seed!.state).toBe("TRACKING");
    tracker.update(image(366), anatomy(true));
    for (let i = 0; i < 30; i++)
      expect(tracker.update(image(433 + i * 67, true), anatomy(true))).toMatchObject({
        point: null,
        trackId: seed!.trackId,
        opticalEpoch: seed!.opticalEpoch,
      });
  });
  it("never replaces the selected index with another distinctive textured region on the same hand", () => {
    const tracker = new IndexImageTracker(binding);
    let seed;
    for (const at of [100, 166, 233, 300])
      seed = tracker.update(fingerFrame(45, at), { ...model(45), identitySource: "same-complete-hand" });
    tracker.update(fingerFrame(45, 366), { ...model(69), identitySource: "same-complete-hand" });
    for (let i = 0; i < 40; i++)
      expect(
        tracker.update(fingerFrame(69, 433 + i * 67, true, true), {
          ...model(69),
          identitySource: "same-complete-hand",
        }),
      ).toMatchObject({ point: null, trackId: seed!.trackId, opticalEpoch: seed!.opticalEpoch });
  });
  it("never reconfirms a wrong model from blank pixels after an accepted contradictory image", () => {
    const tracker = new IndexImageTracker(binding);
    let seed;
    for (const at of [100, 166, 233])
      seed = tracker.update(frame(45, at), { ...model(45), identitySource: "same-complete-hand" });
    tracker.update(frame(45, 300), { ...model(69), identitySource: "same-complete-hand" });
    for (let i = 0; i < 40; i++)
      expect(
        tracker.update(frame(69, 366 + i * 67, null), { ...model(69), identitySource: "same-complete-hand" }),
      ).toMatchObject({ point: null, trackId: seed!.trackId, opticalEpoch: seed!.opticalEpoch });
  });

  it("preserves the verified same-hand identity through anatomy uncertainty while withholding every uncertain point", () => {
    const tracker = new IndexImageTracker(binding);
    const supported = (x = 45): IndexModelAnchor => ({ ...model(x), identitySource: "same-complete-hand" });
    let seed = tracker.update(frame(45, 100, null), supported());
    for (const at of [166, 233]) seed = tracker.update(frame(45, at, null), supported());
    for (let at = 300; at <= 2300; at += 100) {
      expect(
        tracker.update(frame(45, at, null), {
          point: null,
          pointing: false,
          contrary: false,
          authority: "AMBIGUOUS",
          authoritySource: "same-complete-hand",
          identitySource: "same-complete-hand",
          indexIdentityGeometry: { source: "same-complete-hand", index: model(45).geometry!.index },
        }),
      ).toMatchObject({
        point: null,
        matchedPoint: null,
        trackId: seed.trackId,
        trackGeneration: seed.trackGeneration,
      });
    }
    let returned;
    for (const at of [2366, 2433, 2500]) returned = tracker.update(frame(49, at, null), supported(49));
    expect(returned).toMatchObject({
      state: "TRACKING",
      coordinateSource: "MODEL",
      trackId: seed.trackId,
      trackGeneration: seed.trackGeneration,
    });
    expect(returned!.point!.x * 159).toBeCloseTo(49, 6);
  });
  it("never treats same-hand identity-only observations as pointing, optical registration or a cold anchor", () => {
    const tracker = new IndexImageTracker(binding);
    for (let at = 100; at <= 2100; at += 100)
      expect(
        tracker.update(frame(45, at, null), {
          point: null,
          pointing: false,
          contrary: false,
          identitySource: "same-complete-hand",
        }),
      ).toMatchObject({ point: null, trackId: null, opticalEpoch: 0 });
  });
  it.each(["DIFFERENT_SOURCE", "ABSENT", "EXPIRED"] as const)(
    "does not preserve a selected finger through unverified identity %s",
    (kind) => {
      const tracker = new IndexImageTracker(binding);
      const supported: IndexModelAnchor = { ...model(45), identitySource: "same-complete-hand" };
      let seed;
      for (const at of [100, 166, 233]) seed = tracker.update(frame(45, at, null), supported);
      for (const at of kind === "EXPIRED" ? [1600] : [300, 500, 700, 900, 1100, 1300, 1500])
        tracker.update(frame(45, at, null), {
          point: null,
          pointing: false,
          contrary: false,
          ...(kind === "ABSENT"
            ? {}
            : { identitySource: kind === "DIFFERENT_SOURCE" ? "another-hand" : "same-complete-hand" }),
        });
      let returned;
      for (const at of [1800, 1866, 1933]) returned = tracker.update(frame(45, at, null), supported);
      expect(returned!.trackId).not.toBe(seed!.trackId);
    },
  );

  it("uses a current registered index through cropped appearance changes without requiring a palm or changing finger identity", () => {
    const tracker = new IndexImageTracker(binding),
      seed = establish(tracker);
    expect(tracker.update(frame(47, 300, null), partial(47)).point).toBeNull();
    expect(tracker.update(frame(49, 366, null), partial(49)).point).toBeNull();
    for (let i = 0; i < 24; ++i) {
      const x = 51 + i * 2,
        observed = tracker.update(frame(x, 433 + i * 67, null), partial(x));
      expect(observed).toMatchObject({
        state: "TRACKING",
        coordinateSource: "MODEL",
        modelSupport: "REGISTERED_INDEX",
        reason: "INDEX_MODEL_CONTINUITY",
        trackId: seed.trackId,
      });
      expect(observed.point!.x * 159).toBeCloseTo(x, 6);
      expect(observed.uncertaintyRadiusPixels).toBe(16);
    }
    expect(tracker.update(frame(99, 2041, null)).point).toBeNull();
  });
  it("cannot initialize from a featureless partial index or borrow an unassociated full-model cold start", () => {
    const cold = new IndexImageTracker(binding);
    for (let i = 0; i < 8; ++i)
      expect(cold.update(frame(45, 100 + i * 67, null), partial(45))).toMatchObject({ point: null, trackId: null });
    const modelOnly = new IndexImageTracker(binding);
    let seeded;
    for (const at of [100, 166, 233]) seeded = modelOnly.update(frame(45, at, null), model(45));
    expect(seeded!.coordinateSource).toBe("MODEL");
    for (const at of [300, 366, 433, 500])
      expect(modelOnly.update(frame(45, at, null), partial(45))).toMatchObject({
        point: null,
        trackId: seeded!.trackId,
      });
  });
  it.each(["SOURCE", "MISSING", "CURLED", "COLLAPSED", "TIP", "GAP"] as const)(
    "rejects unqualified cropped cue %s",
    (condition) => {
      const tracker = new IndexImageTracker(binding),
        seed = establish(tracker);
      const start = condition === "GAP" ? 600 : 300;
      for (let i = 0; i < 5; ++i) {
        const anchor = partial(47, 45, condition === "SOURCE" ? "another-hand" : "same-complete-hand");
        if (condition === "MISSING") anchor.indexCue = undefined;
        if (condition === "COLLAPSED")
          anchor.indexCue!.index = [0, 0, 0, 0].map(() => ({ ...point(47), z: 0 })) as unknown as NonNullable<
            IndexModelAnchor["indexCue"]
          >["index"];
        if (condition === "CURLED") anchor.indexCue!.index[2].y = anchor.indexCue!.index[0].y;
        if (condition === "TIP") anchor.indexCue!.index[3].x += 0.1;
        expect(tracker.update(frame(47, start + i * 67, null), anchor)).toMatchObject({
          point: null,
          trackId: seed.trackId,
        });
      }
    },
  );
  it("cannot use a partial cue to clear a confirmed contrary hand or override an accepted image conflict", () => {
    const tracker = new IndexImageTracker(binding),
      seed = establish(tracker);
    for (const at of [300, 366, 433])
      tracker.update(frame(45, at), {
        ...model(45),
        geometry: undefined,
        pointing: false,
        contrary: true,
        authority: "CONTRARY",
      });
    for (const at of [500, 566, 633, 700])
      expect(tracker.update(frame(45, at, null), partial(45))).toMatchObject({ point: null, trackId: seed.trackId });
    const conflict = new IndexImageTracker(binding),
      first = establish(conflict);
    conflict.update(frame(45, 300), partial(69));
    for (const at of [366, 433, 500, 566])
      expect(conflict.update(frame(45, at, null), partial(69))).toMatchObject({ point: null, trackId: first.trackId });
  });
  it("exposes only IMAGE fallback when the current cue disappears and current pixels remain good", () => {
    const tracker = new IndexImageTracker(binding);
    establish(tracker);
    for (const at of [300, 366, 433]) tracker.update(frame(45, at), partial(45));
    expect(tracker.update(frame(47, 500))).toMatchObject({
      state: "TRACKING",
      coordinateSource: "IMAGE",
      modelSupport: null,
    });
  });
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
    const observedModel = (): IndexModelAnchor => {
      const current = model(45);
      return {
        ...current,
        identitySource: "same-complete-hand",
        indexIdentityGeometry: {
          source: "same-complete-hand",
          index: current.geometry!.index,
        },
      };
    };
    let seed = tracker.update(frame(45, 100, null), observedModel());
    for (const at of [166, 233]) seed = tracker.update(frame(45, at, null), observedModel());
    for (let at = 300; at <= 1700; at += 200) {
      const contrary = {
        ...observedModel(),
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
    expect(tracker.update(frame(45, 1766, null), observedModel()).point).toBeNull();
    expect(tracker.update(frame(45, 1833, null), observedModel()).point).toBeNull();
    expect(tracker.update(frame(45, 1900, null), observedModel())).toMatchObject({
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
    // With true difference averaging, a high-quality image is deliberately
    // not pulled all the way to a biased model. Exercise a sizeable correction
    // with a lower-confidence, still independently accepted optical match.
    for (let i = 0; i < 30; ++i) {
      const noisy = frame(45, 300 + i * 50);
      let random = 51427;
      for (let y = 35; y <= 55; y++)
        for (let x = 35; x <= 55; x++) {
          random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
          noisy.data[y * 160 + x] = Math.max(
            0,
            Math.min(255, noisy.data[y * 160 + x] + ((random >>> 24) - 127.5) * 0.44),
          );
        }
      observed = tracker.update(noisy, model(52.5));
    }
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
    const retained = new IndexImageTracker(binding),
      initial = establish(retained);
    retained.update(frame(45, 300), { point: point(45), pointing: false, contrary: true });
    for (const at of [366, 433, 500, 566])
      expect(retained.update(frame(45, at), partial(45))).toMatchObject({
        point: null,
        trackId: initial.trackId,
        reason: "COHERENT_MODEL_CONTRARY",
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
