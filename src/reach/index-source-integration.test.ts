// @sounding-line-registration owner=reach suite=unit.reach contracts=reach.phase1.foundation
import { describe, expect, it } from "vitest";
import { IndexImageTracker, type IndexGrayFrame, type IndexModelAnchor } from "./index-image-tracker";
import { sameIndexSourceContext } from "./index-source-association";
const binding = {
  providerGeneration: 1,
  cameraLeaseId: "synthetic-source-alias",
  cameraFrameVersion: 1,
  frameWidth: 320,
  frameHeight: 240,
  mirrorTransform: "NONE" as const,
};
const source = (
  id: string,
  context: unknown[] = ["test-provider", "1", "test-digest", 1, "synthetic-source-alias", 1, 320, 240, "NONE", 0],
) => JSON.stringify([...context, id, 1]);
const a = source("hand-1"),
  b = source("hand-2");
const point = (x: number, y: number) => ({ x: x / 159, y: y / 119 });
function model(currentSource = a): IndexModelAnchor {
  const index = [69, 61, 53, 45].map((y) => ({ ...point(45, y), z: 0 })) as unknown as NonNullable<
    IndexModelAnchor["geometry"]
  >["index"];
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
      joints: index.map((p, i) => ({ ...p, index: i + 5 })),
    },
  };
}
function image(capture: number, parts = true): IndexGrayFrame {
  const data = new Uint8Array(160 * 120).fill(30);
  for (let y = 35; y <= 79; y++)
    for (let x = 35; x <= 55; x++) {
      if (!parts && y > 50) continue;
      data[y * 160 + x] = 45 + ((x * 73 + y * 127 + x * y * 19 + 100000) % 135);
    }
  return { data, width: 160, height: 120, capture, received: capture + 1 };
}
function establish(tracker: IndexImageTracker) {
  let result;
  for (const at of [100, 166, 233]) result = tracker.update(image(at), model());
  expect(result).toMatchObject({ state: "TRACKING", coordinateSource: "FUSED" });
  return result!;
}
describe("source alias integration preserves trusted anatomical and optical provenance", () => {
  it("reacquires a changed temporary model ID through fresh old-tip and separated index-part evidence", () => {
    const tracker = new IndexImageTracker(binding);
    const first = establish(tracker);
    for (const at of [300, 366]) {
      const result = tracker.update(image(at), model(b));
      expect(result.trackId).toBe(first.trackId);
      expect(result.point).toBeNull();
    }
    let result;
    for (const at of [433, 500, 566, 633]) result = tracker.update(image(at), model(b));
    expect(result).toMatchObject({ state: "TRACKING", trackId: first.trackId });
    expect(result!.point!.x).toBeCloseTo(45 / 159, 2);
  });
  it("quarantines an unproven foreign source before it can replace trusted skin references", () => {
    const tracker = new IndexImageTracker(binding);
    const first = establish(tracker);
    const state = tracker as unknown as { fingerReference: unknown; handIdentity: { source: string } | null };
    const oldBank = state.fingerReference;
    expect(oldBank).not.toBeNull();
    for (const at of [300, 366, 433, 500, 566]) {
      const result = tracker.update(image(at, false), model(b));
      expect(result).toMatchObject({ trackId: first.trackId, point: null });
      expect(state.fingerReference).toBe(oldBank);
      expect(state.handIdentity?.source).toBe(a);
    }
  });
  it("retains genuine contrary intent after a proved alias and later model dropout", () => {
    const tracker = new IndexImageTracker(binding);
    establish(tracker);
    for (const at of [300, 366, 433, 500, 566, 633]) tracker.update(image(at), model(b));
    for (const at of [700, 766, 833]) {
      const open = { ...model(b), pointing: false, contrary: true, authority: "CONTRARY" as const };
      expect(tracker.update(image(at), open).point).toBeNull();
    }
    for (const at of [900, 966, 1033]) expect(tracker.update(image(at)).point).toBeNull();
  });
  it("retains a known alias negative cohort across the1200ms positive-proof expiry boundary", () => {
    const tracker = new IndexImageTracker(binding);
    const first = establish(tracker);
    for (const at of [300, 366, 433, 500, 566, 633]) tracker.update(image(at), model(b));
    // Fresh image measurements continue, but they do not manufacture new
    // full-hand source-rebind proof while the neural model is unavailable.
    for (const at of [900, 1166, 1433, 1666])
      expect(tracker.update(image(at))).toMatchObject({ state: "TRACKING", trackId: first.trackId });
    const state = tracker as unknown as {
      sourceAssociation: { checkpoint(): { trustedAt: number | null } };
      trustedModelSource: string | null;
    };
    expect(state.sourceAssociation.checkpoint().trustedAt).toBe(633);
    expect(state.trustedModelSource).toBe(b);
    for (const at of [1766, 1833, 1900]) {
      const open = { ...model(b), pointing: false, contrary: true, authority: "CONTRARY" as const };
      expect(tracker.update(image(at), open)).toMatchObject({ trackId: first.trackId, point: null });
    }
    // Third fresh negative is1267ms after the last positive proof. The expiry
    // cannot turn its posture into an unavailable/ambiguous result and erase
    // the negative cohort. Negative continuity grants no coordinate permission.
    expect(state.sourceAssociation.checkpoint().trustedAt).toBeNull();
    for (const at of [1966, 2033, 2100, 2166]) {
      const current = tracker.update(image(at));
      expect(current).toMatchObject({ trackId: first.trackId, point: null });
      expect(current.state).not.toBe("TRACKING");
    }
  });
  it("requires fresh probation when the original temporary source returns after an alias", () => {
    const tracker = new IndexImageTracker(binding);
    const first = establish(tracker);
    for (const at of [300, 366, 433, 500, 566, 633]) tracker.update(image(at), model(b));
    for (const at of [700, 766])
      expect(tracker.update(image(at), model(a))).toMatchObject({ trackId: first.trackId, point: null });
    let result;
    for (const at of [833, 900, 966, 1033]) result = tracker.update(image(at), model(a));
    expect(result).toMatchObject({ trackId: first.trackId, state: "TRACKING" });
  });
  it("does not use positive-proof expiry to restore the original source after a proved alias", () => {
    const tracker = new IndexImageTracker(binding);
    const first = establish(tracker);
    for (const at of [300, 366, 433, 500, 566, 633]) tracker.update(image(at), model(b));
    for (const at of [900, 1166, 1433, 1666])
      expect(tracker.update(image(at))).toMatchObject({ state: "TRACKING", trackId: first.trackId });
    const state = tracker as unknown as {
      sourceAssociation: { checkpoint(): { trustedAt: number | null } };
      trustedModelSource: string | null;
    };
    expect(state.sourceAssociation.checkpoint().trustedAt).toBe(633);
    for (const at of [1900, 1966, 2033, 2100]) {
      const current = tracker.update(image(at), model(a));
      expect(current).toMatchObject({ trackId: first.trackId, point: null });
      expect(current.state).not.toBe("TRACKING");
      expect(state.trustedModelSource).toBe(b);
    }
    // A returning canonical string is a different current temporary generation,
    // not fresh proof that the expired association may be restored by name.
    expect(state.sourceAssociation.checkpoint().trustedAt).toBeNull();
  });
  it.each(Array.from({ length: 10 }, (_, i) => i))("never aliases changed provenance field%s", (field) => {
    const context = ["test-provider", "1", "test-digest", 1, "synthetic-source-alias", 1, 320, 240, "NONE", 0];
    const other = [...context];
    other[field] = typeof other[field] === "number" ? Number(other[field]) + 1 : "changed";
    const foreign = source("hand-2", other);
    expect(sameIndexSourceContext(a, foreign)).toBe(false);
    const tracker = new IndexImageTracker(binding);
    const first = establish(tracker);
    for (const at of [300, 366, 433, 500])
      expect(tracker.update(image(at), model(foreign))).toMatchObject({ trackId: first.trackId, point: null });
  });
  it("does not alias opaque names or malformed source envelopes", () => {
    expect(sameIndexSourceContext("A", "B")).toBe(false);
    expect(sameIndexSourceContext("[]", "[]")).toBe(false);
    expect(sameIndexSourceContext(a, b)).toBe(true);
  });
});
