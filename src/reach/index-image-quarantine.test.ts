// @sounding-line-registration owner=reach suite=unit.reach contracts=reach.phase1.foundation
import { describe, expect, it, vi } from "vitest";
import { IndexImageTracker, type IndexGrayFrame, type IndexModelAnchor } from "./index-image-tracker";

// Public analytic pixels only. A quarantined search hypothesis supplies neither
// finger recognition nor trusted measurement, gesture, or calibration evidence.
const source = "synthetic-fixed-reference-quarantine";
const point = (x: number, y = 45) => ({ x: x / 159, y: y / 119 });
const binding = {
  providerGeneration: 1,
  cameraLeaseId: "synthetic-independent-image-quarantine",
  cameraFrameVersion: 1,
  frameWidth: 320,
  frameHeight: 240,
  mirrorTransform: "NONE" as const,
};
function model(x = 45, currentSource = source): IndexModelAnchor {
  const index = [24, 16, 8, 0].map((dy) => ({ ...point(x, 45 + dy), z: 0 })) as unknown as NonNullable<
    IndexModelAnchor["geometry"]
  >["index"];
  return {
    point: point(x),
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
      joints: index.map((joint, i) => ({ index: i + 5, x: joint.x, y: joint.y })),
    },
    otherDigitEvidence: { source: currentSource, points: [], segments: [] },
    handRegion: {
      source: currentSource,
      palmSpan: 0.2,
      points: Array.from({ length: 12 }, (_, i) => point(20 + (i % 2) * 120, 40 + Math.floor(i / 2) * 12)),
    },
  };
}
function pixels(capture: number, x = 45): IndexGrayFrame {
  const data = new Uint8Array(160 * 120).fill(30);
  for (let dy = -10; dy <= 10; ++dy)
    for (let dx = -10; dx <= 10; ++dx)
      data[(45 + dy) * 160 + x + dx] = 45 + ((dx * 73 + dy * 127 + dx * dy * 19 + 100000) % 135);
  return { data, width: 160, height: 120, capture, received: capture + 1 };
}
function establish(tracker: IndexImageTracker) {
  let selected;
  for (const at of [100, 166, 233]) selected = tracker.update(pixels(at), model());
  expect(selected).toMatchObject({ state: "TRACKING", coordinateSource: "FUSED" });
  return selected!;
}
function opticalState(tracker: IndexImageTracker) {
  const state = tracker as unknown as {
    point: { x: number; y: number } | null;
    template: unknown;
    previous: unknown;
    reference: unknown;
    fingerReference: unknown;
    velocity: { x: number; y: number };
    acceptedAt: number;
    lastReferenceAt: number;
    modelAcceptedAt: number;
  };
  return {
    point: state.point && { ...state.point },
    template: state.template,
    previous: state.previous,
    reference: state.reference,
    fingerReference: state.fingerReference,
    velocity: { ...state.velocity },
    acceptedAt: state.acceptedAt,
    lastReferenceAt: state.lastReferenceAt,
    modelAcceptedAt: state.modelAcceptedAt,
  };
}
function expectCandidate(
  output: ReturnType<IndexImageTracker["update"]>,
  x: number,
  trackId: string | null,
  displayed = true,
) {
  expect(output).toMatchObject({ state: "UNCERTAIN", point: null, trackId });
  expect(
    output.measurements?.image,
    JSON.stringify({ reason: output.reason, measurements: output.measurements }),
  ).not.toBeNull();
  expect(output.measurements!.image!.x * 159).toBeCloseTo(x, 1);
  if (displayed) {
    expect(output.matchedPoint).not.toBeNull();
    expect(output.matchedPoint!.x * 159).toBeCloseTo(x, 1);
  } else expect(output.matchedPoint).toBeNull();
  expect(output.measurements?.accepted).toBeNull();
}
function startConflict(tracker: IndexImageTracker) {
  const selected = establish(tracker);
  expectCandidate(tracker.update(pixels(300, 57), model(81)), 57, selected.trackId);
  return selected;
}

describe("fixed-reference image quarantine follows candidates without trusting them", () => {
  it("keeps one identity beyond the old 32px center and recovers only with three current compatible frames", () => {
    const tracker = new IndexImageTracker(binding);
    const selected = startConflict(tracker);
    for (const [at, x] of [
      [366, 69],
      [433, 81],
      [500, 93],
    ])
      expectCandidate(tracker.update(pixels(at, x), model(x + 24)), x, selected.trackId);
    // An actual old-template match can move while the model is absent; it
    // cannot clear the unresolved coordinate contradiction or become a point.
    expectCandidate(tracker.update(pixels(566, 105)), 105, selected.trackId, false);
    for (const at of [633, 699]) expectCandidate(tracker.update(pixels(at, 105), model(105)), 105, selected.trackId);
    const recovered = tracker.update(pixels(766, 105), model(105));
    expect(recovered).toMatchObject({ state: "TRACKING", trackId: selected.trackId });
    expect(recovered.point!.x * 159).toBeCloseTo(105, 1);
  });

  it("does not commit candidate position, patches, optical motion, appearance bank, or measurement clocks", () => {
    const tracker = new IndexImageTracker(binding);
    const selected = establish(tracker);
    const before = opticalState(tracker);
    for (const [at, x] of [
      [300, 57],
      [366, 69],
      [433, 81],
      [500, 93],
    ]) {
      expectCandidate(tracker.update(pixels(at, x), model(x + 24)), x, selected.trackId);
      expect(opticalState(tracker)).toEqual(before);
    }
    expectCandidate(tracker.update(pixels(566, 105)), 105, selected.trackId, false);
    expect(opticalState(tracker)).toEqual(before);
  });

  it("does not advance quarantine from an adaptive-only match", () => {
    const tracker = new IndexImageTracker(binding);
    const selected = startConflict(tracker);
    type Matches = {
      stable: { accepted: unknown; reason: string | null; quality: unknown };
      adaptive: { accepted: unknown; reason: string | null; quality: unknown };
    } | null;
    const internal = tracker as unknown as { computeMatches(frame: IndexGrayFrame): Matches };
    const compute = internal.computeMatches.bind(tracker);
    const spy = vi.spyOn(internal, "computeMatches").mockImplementationOnce((frame) => {
      const result = compute(frame);
      expect(result?.adaptive.accepted).not.toBeNull();
      return result && { ...result, stable: { ...result.stable, accepted: null, reason: "APPEARANCE_MISMATCH" } };
    });
    expect(tracker.update(pixels(366, 69), model(93)).point).toBeNull();
    spy.mockRestore();
    // 93 is inside a search centered on the rejected adaptive69, but outside
    // one centered on the last fixed-reference candidate57.
    const current = tracker.update(pixels(433, 93), model(117));
    expect(current).toMatchObject({ point: null, trackId: selected.trackId });
    expect(current.matchedPoint).toBeNull();
  });

  it.each([250, 251])("expires candidate-to-candidate search after a %sms gap", (gap) => {
    const tracker = new IndexImageTracker(binding);
    const selected = startConflict(tracker);
    const current = tracker.update(pixels(300 + gap, 81), model(105));
    expect(current.point).toBeNull();
    if (gap === 250) expectCandidate(current, 81, selected.trackId);
    else expect(current.matchedPoint).toBeNull();
  });

  it("never refreshes the original trusted 1200ms deadline from ongoing conflict candidates", () => {
    const tracker = new IndexImageTracker(binding);
    const selected = startConflict(tracker);
    for (let i = 1; i <= 11; ++i)
      expectCandidate(
        tracker.update(pixels(300 + i * 100, 57 + i * 2), model(81 + i * 2)),
        57 + i * 2,
        selected.trackId,
      );
    const expired = tracker.update(pixels(1434, 81), model(105));
    expect(expired.point).toBeNull();
    expect(expired.matchedPoint).toBeNull();
  });

  it("does not advance the old source's candidate from foreign-source current anatomy", () => {
    const tracker = new IndexImageTracker(binding);
    const selected = startConflict(tracker);
    expect(tracker.update(pixels(366, 69), model(93, "different-provider-context")).point).toBeNull();
    // Repeated foreign frames must not recreate a search proposal after the
    // first one cleared it. Both still match the old fixed patch locally.
    expect(tracker.update(pixels(433, 69), model(93, "different-provider-context")).point).toBeNull();
    const current = tracker.update(pixels(500, 93), model(117));
    expect(current).toMatchObject({ point: null, trackId: selected.trackId });
    expect(current.matchedPoint).toBeNull();
  });

  it("invalidates a quarantined search center when an explicit hint creates a new optical epoch", () => {
    const tracker = new IndexImageTracker(binding);
    const selected = startConflict(tracker);
    expectCandidate(tracker.update(pixels(366, 69), model(93)), 69, selected.trackId);
    const oldReference = opticalState(tracker).reference;
    const manual = tracker.update(pixels(433, 25), undefined, point(25));
    expect(manual.anchorSource).toBe("MANUAL_HINT");
    expect(opticalState(tracker).reference).not.toBe(oldReference);
    const current = tracker.update(pixels(500, 93));
    expect(current.point).toBeNull();
    expect(current.matchedPoint).toBeNull();
  });

  it.each(["CLOCK", "SOURCE"] as const)("rolls back search-only movement after a %s-rejected completion", (kind) => {
    const tracker = new IndexImageTracker(binding);
    startConflict(tracker);
    const before = opticalState(tracker);
    const token = tracker.prepare(pixels(366, 81));
    let clocks = 0;
    let sourceChecks = 0;
    expect(() =>
      tracker.complete(
        token,
        model(105),
        () => (kind === "CLOCK" && ++clocks > 1 ? 517 : 376),
        () => kind !== "SOURCE" || ++sourceChecks === 1,
      ),
    ).toThrow("INVALID_OR_STALE");
    expect(opticalState(tracker)).toEqual(before);
    // If the rejected candidate81 leaked, its next search could reach105.
    // The valid candidate remains57, so that jump cannot be searched/trusted.
    const current = tracker.update(pixels(433, 105), model(129));
    expect(current.point).toBeNull();
    expect(current.matchedPoint).toBeNull();
  });
});
