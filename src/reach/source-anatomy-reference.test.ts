// @sounding-line-registration owner=reach suite=unit.reach contracts=reach.phase1.foundation
import { describe, expect, it } from "vitest";
import { IndexImageTracker, type IndexGrayFrame, type IndexModelAnchor } from "./index-image-tracker";

type Geometry = NonNullable<IndexModelAnchor["geometry"]>;
type ReferenceState = {
  sourceAnatomy: Geometry | null;
  sourceAssociation: { checkpoint(): { trustedAt: number | null } };
  appearanceSupportsIndex(frame: IndexGrayFrame, index: Geometry["index"], source: string): boolean;
};
const binding = {
  providerGeneration: 1,
  cameraLeaseId: "synthetic-anatomy-reference",
  cameraFrameVersion: 1,
  frameWidth: 320,
  frameHeight: 240,
  mirrorTransform: "NONE" as const,
};
const source = (id: string, provider = "synthetic-provider") =>
  JSON.stringify([provider, "1", "synthetic-digest", 1, binding.cameraLeaseId, 1, 320, 240, "NONE", 0, id, 1]);
const original = source("selected-hand"),
  alias = source("temporary-new-hand");
const point = (x: number, y: number) => ({ x: x / 159, y: y / 119 });
function model(scale = 1, currentSource = original): IndexModelAnchor {
  const index = [3, 2, 1, 0].map((i) => ({ ...point(45, 45 + 8 * i * scale), z: 0 })) as unknown as Geometry["index"];
  return {
    point: point(45, 45),
    pointing: true,
    contrary: false,
    authority: "POINT",
    authoritySource: currentSource,
    identitySource: currentSource,
    identityObserved: true,
    geometry: { index, palmSpan: 0.2 },
    indexIdentityGeometry: { source: currentSource, index, associationBasis: "INDEX_CHAIN_V1" },
    indexIdentityEvidence: {
      source: currentSource,
      associationBasis: "INDEX_CHAIN_V1",
      joints: index.map((joint, i) => ({ ...joint, index: i + 5 })),
    },
  };
}
function image(capture: number, scope: "INDEX" | "TIP_ONLY" | "BLANK" = "INDEX"): IndexGrayFrame {
  const data = new Uint8Array(160 * 120).fill(30);
  if (scope !== "BLANK")
    for (let y = 35; y <= (scope === "TIP_ONLY" ? 50 : 90); y++)
      for (let x = 35; x <= 55; x++) data[y * 160 + x] = 45 + ((x * 73 + y * 127 + x * y * 19 + 100000) % 135);
  return { data, width: 160, height: 120, capture, received: capture + 1 };
}
const state = (tracker: IndexImageTracker) => tracker as unknown as ReferenceState;
const snapshot = (tracker: IndexImageTracker) => structuredClone(state(tracker).sourceAnatomy);
function established() {
  const tracker = new IndexImageTracker(binding);
  let first;
  for (const at of [100, 166, 232, 298]) first = tracker.update(image(at), model());
  expect(first).toMatchObject({ state: "TRACKING", coordinateSource: "FUSED" });
  return { tracker, first: first! };
}

describe("trusted measured anatomy reference for temporary source recovery", () => {
  it("uses a later proven24→31.2px pose for alias probation without weakening current geometry cohorts", () => {
    const { tracker, first } = established();
    let at = 364;
    for (const scale of [1.1, 1.2, 1.3])
      for (let i = 0; i < 4; i++, at += 66) {
        const anchor = model(scale),
          frame = image(at);
        expect(tracker.update(frame, anchor)).toMatchObject({
          state: "TRACKING",
          coordinateSource: "FUSED",
          trackId: first.trackId,
        });
        expect(state(tracker).appearanceSupportsIndex(frame, anchor.geometry!.index, original)).toBe(true);
      }
    const current = snapshot(tracker)!;
    expect((current.index[0].y - current.index[3].y) * 119).toBeCloseTo(31.2);
    for (let i = 0; i < 2; i++, at += 66)
      expect(tracker.update(image(at), model(1.3, alias))).toMatchObject({ trackId: first.trackId, point: null });
    let recovered;
    for (let i = 0; i < 5; i++, at += 66) recovered = tracker.update(image(at), model(1.3, alias));
    expect(recovered).toMatchObject({ state: "TRACKING", trackId: first.trackId, modelAgreement: "AGREE" });
    expect(recovered!.point!.x).toBeCloseTo(45 / 159, 2);
  });

  it("cannot learn anatomy from a current unproved alias candidate", () => {
    const { tracker, first } = established(),
      before = snapshot(tracker);
    expect(tracker.update(image(364), model(1.1, alias))).toMatchObject({ trackId: first.trackId, point: null });
    expect(snapshot(tracker)).toEqual(before);
  });

  it("does not refresh from negative intent and retains its no-point latch through dropout", () => {
    const { tracker } = established(),
      before = snapshot(tracker);
    for (const at of [364, 430, 496]) {
      const negative = { ...model(1.1), authority: "CONTRARY" as const, pointing: false, contrary: true };
      expect(tracker.update(image(at), negative).point).toBeNull();
      expect(snapshot(tracker)).toEqual(before);
    }
    expect(tracker.update(image(562)).point).toBeNull();
  });

  it("does not replace the paired image reference during current model-only continuation", () => {
    const { tracker } = established(),
      before = snapshot(tracker);
    let latest;
    for (const at of [364, 430, 496, 562]) latest = tracker.update(image(at, "BLANK"), model(1.3));
    expect(latest).toMatchObject({ state: "TRACKING", coordinateSource: "MODEL" });
    expect(snapshot(tracker)).toEqual(before);
  });

  it("rolls anatomy and source proof back if completion crosses the unchanged150ms limit", () => {
    const { tracker } = established(),
      before = snapshot(tracker);
    const trustedAt = state(tracker).sourceAssociation.checkpoint().trustedAt;
    const token = tracker.prepare(image(364));
    let clocks = 0;
    expect(() => tracker.complete(token, model(1.1), () => (++clocks < 3 ? 365 : 515))).toThrow(/STALE/);
    expect(snapshot(tracker)).toEqual(before);
    expect(state(tracker).sourceAssociation.checkpoint().trustedAt).toBe(trustedAt);
    expect(tracker.update(image(430), model(1.1))).toMatchObject({ state: "TRACKING", coordinateSource: "FUSED" });
    expect((state(tracker).sourceAnatomy!.index[0].y - state(tracker).sourceAnatomy!.index[3].y) * 119).toBeCloseTo(
      26.4,
    );
  });

  it("cannot refresh or rebind changed provider provenance", () => {
    const { tracker, first } = established(),
      before = snapshot(tracker);
    const foreign = source("selected-hand", "foreign-provider");
    for (const at of [364, 430, 496, 562]) {
      expect(tracker.update(image(at), model(1.1, foreign))).toMatchObject({ trackId: first.trackId, point: null });
      expect(snapshot(tracker)).toEqual(before);
    }
  });

  it("does not ratchet cumulative proximal guesses when only the fingertip retains appearance proof", () => {
    const { tracker } = established(),
      before = snapshot(tracker);
    let at = 364;
    for (const scale of [1.1, 1.2, 1.3])
      for (let i = 0; i < 4; i++, at += 66) {
        const anchor = model(scale),
          frame = image(at, "TIP_ONLY");
        tracker.update(frame, anchor);
        expect(state(tracker).appearanceSupportsIndex(frame, anchor.geometry!.index, original)).toBe(false);
        expect(snapshot(tracker)).toEqual(before);
      }
  });

  it("requires all four explicitly named current indexed observations for a refresh", () => {
    const { tracker } = established(),
      before = snapshot(tracker);
    for (const at of [364, 430, 496]) {
      const anchor = model(1.1);
      delete anchor.indexIdentityEvidence;
      expect(tracker.update(image(at), anchor)).toMatchObject({ state: "TRACKING" });
      expect(snapshot(tracker)).toEqual(before);
    }
  });

  it("keeps the proven anatomy snapshot independent of later caller mutations", () => {
    const { tracker } = established(),
      anchor = model(1.1);
    expect(tracker.update(image(364), anchor)).toMatchObject({ state: "TRACKING", coordinateSource: "FUSED" });
    const before = snapshot(tracker);
    (anchor.geometry!.index[0] as { x: number }).x = 0.9;
    anchor.geometry!.palmSpan = 0.5;
    expect(snapshot(tracker)).toEqual(before);
  });
});
