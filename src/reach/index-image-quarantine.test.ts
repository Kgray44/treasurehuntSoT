// @sounding-line-registration owner=reach suite=unit.reach contracts=reach.phase1.foundation
import { describe, expect, it, vi } from "vitest";
import { IndexImageTracker, type IndexGrayFrame, type IndexModelAnchor } from "./index-image-tracker";
import type { TemporalIndexTrack } from "./temporal-index-track";

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
function contextualSource(hand: string, generation: number) {
  return JSON.stringify([
    "synthetic-provider",
    "synthetic-model",
    "synthetic-algorithm",
    1,
    binding.cameraLeaseId,
    1,
    320,
    240,
    "NONE",
    0,
    hand,
    generation,
  ]);
}

describe("fixed-reference image quarantine follows candidates without trusting them", () => {
  it("retains established selected material through foreign model ambiguity without committing image coordinates", () => {
    const tracker = new IndexImageTracker(binding);
    const rawA = contextualSource("hand-a", 1);
    const rawB = contextualSource("hand-b", 2);
    let selected;
    for (const at of [100, 166, 233]) selected = tracker.update(pixels(at), model(45, rawA));
    expect(selected).toMatchObject({ state: "TRACKING", coordinateSource: "FUSED" });
    const before = opticalState(tracker);
    const internal = tracker as unknown as {
      temporal: TemporalIndexTrack;
      sourceCanonical: string | null;
      trustedModelSource: string | null;
      sourceAssociation: import("./index-source-association").IndexSourceAssociation;
    };
    const original = internal.temporal.checkpoint();
    const observed = vi.spyOn(internal.temporal, "observe");
    for (const at of [300, 450, 600, 750, 900, 1050, 1200, 1350, 1500, 1650, 1800]) {
      // B has neither the old separated-part proof nor the selected source.
      // Current unique A pixels may retain A's identity, never B's coordinates.
      const paused = tracker.update(pixels(at), model(69, rawB));
      expect(paused).toMatchObject({
        state: "UNCERTAIN",
        reason: "FULL_HAND_AMBIGUOUS",
        trackId: selected!.trackId,
        point: null,
        measurements: { model: point(69), modelDisposition: "CANDIDATE", accepted: null },
        temporalTrack: { state: "AMBIGUOUS", identity: "AMBIGUOUS", displayPoint: null },
      });
      expect(paused.matchedPoint!.x * 159).toBeCloseTo(45, 1);
      expect(paused.temporalTrack!.measurementAgeMs).toBe(at + 1 - 233);
      expect(opticalState(tracker)).toEqual(before);
      expect(internal.temporal.checkpoint()).toMatchObject({
        logical: original.logical,
        source: rawA,
        sources: [rawA],
        identityAt: at,
        measurement: original.measurement,
        velocity: original.velocity,
      });
      expect(internal.sourceCanonical).toBe(rawA);
      expect(internal.trustedModelSource).toBe(rawA);
      expect(internal.sourceAssociation.trustedSource).not.toBe(rawB);
    }
    expect(observed.mock.calls).toHaveLength(11);
    for (const [evidence] of observed.mock.calls)
      expect(evidence).toMatchObject({ source: rawA, point: null, ambiguous: true, retainedImageIdentity: true });
    observed.mockRestore();
    let recovered;
    for (const at of [1900, 1966, 2033]) recovered = tracker.update(pixels(at), model(45, rawA));
    expect(recovered, JSON.stringify(recovered)).toMatchObject({ state: "TRACKING", trackId: selected!.trackId });
    expect(recovered!.point!.x * 159).toBeCloseTo(45, 1);
  });

  it("never renews retained-image identity through a genuine coordinate conflict or subsequent model absence", () => {
    const tracker = new IndexImageTracker(binding);
    const selected = startConflict(tracker);
    const internal = tracker as unknown as { temporal: TemporalIndexTrack };
    const observed = vi.spyOn(internal.temporal, "observe");
    const before = opticalState(tracker);
    // Begin after the existing pre-conflict measurement's150ms display budget.
    for (const at of [433, 566, 699]) {
      const paused = tracker.update(pixels(at, 57), model(57, "unverified-foreign-hand"));
      expect(paused).toMatchObject({ point: null, trackId: selected.trackId });
      expect(paused.temporalTrack!.displayPoint).toBeNull();
      expect(opticalState(tracker)).toEqual(before);
    }
    for (const at of [832, 1000, 1200]) {
      const absent = tracker.update(pixels(at, 57));
      expect(absent).toMatchObject({ point: null, trackId: selected.trackId });
      expect(absent.temporalTrack!.displayPoint).toBeNull();
      expect(opticalState(tracker)).toEqual(before);
    }
    expect(observed.mock.calls.every(([evidence]) => evidence.retainedImageIdentity !== true)).toBe(true);
    expect(internal.temporal.checkpoint().identityAt).toBe(300);
    observed.mockRestore();
    const expired = tracker.update(pixels(1601, 57));
    expect(expired).toMatchObject({ point: null, trackId: null });
    expect(expired.temporalTrack!.displayPoint).toBeNull();
  });

  it.each(["FOREIGN_SOURCE", "TIP_INNOVATION", "ANATOMY", "REPEATED_PIXELS"] as const)(
    "cannot reopen the selected source from %s after long ambiguity",
    (kind) => {
      const tracker = new IndexImageTracker(binding);
      const rawA = contextualSource("hand-a", 1);
      const rawB = contextualSource("hand-b", 2);
      let selected;
      for (const at of [100, 166, 233]) selected = tracker.update(pixels(at), model(45, rawA));
      for (let at = 300; at <= 1800; at += 150)
        expect(tracker.update(pixels(at), model(69, rawB))).toMatchObject({
          point: null,
          trackId: selected!.trackId,
          reason: "FULL_HAND_AMBIGUOUS",
        });
      const before = opticalState(tracker);
      let candidate = model(kind === "TIP_INNOVATION" ? 54 : 45, kind === "FOREIGN_SOURCE" ? rawB : rawA);
      if (kind === "ANATOMY") {
        // Same tip and valid straight bones, but90degrees from the fixed trusted
        // index axis. A plausible new chain is not the retained chain's proof.
        const index = [24, 16, 8, 0].map((dx) => ({ ...point(45 - dx), z: 0 })) as unknown as NonNullable<
          IndexModelAnchor["geometry"]
        >["index"];
        candidate = {
          ...candidate,
          geometry: { index, palmSpan: 0.2 },
          indexIdentityGeometry: { source: rawA, index, associationBasis: "INDEX_CHAIN_V1" },
          indexIdentityEvidence: {
            source: rawA,
            associationBasis: "INDEX_CHAIN_V1",
            joints: index.map((joint, i) => ({ index: i + 5, x: joint.x, y: joint.y })),
          },
        };
      }
      for (const at of [1900, 1966, 2033]) {
        const frame = pixels(at);
        if (kind === "REPEATED_PIXELS") {
          const rival = pixels(at, 69);
          for (let y = 35; y <= 55; ++y)
            for (let x = 59; x <= 79; ++x) frame.data[y * 160 + x] = rival.data[y * 160 + x];
        }
        const rejected = tracker.update(frame, candidate);
        expect(rejected).toMatchObject({ point: null, trackId: selected!.trackId });
        expect(rejected.temporalTrack!.displayPoint).toBeNull();
        expect(rejected.measurements!.accepted).toBeNull();
        expect(rejected.measurements!.modelDisposition).toBe("CANDIDATE");
        expect(opticalState(tracker)).toEqual(before);
      }
    },
  );

  it("requires a recent retained-material association before reopening an exact old model source", () => {
    const tracker = new IndexImageTracker(binding);
    const rawA = contextualSource("hand-a", 1);
    const rawB = contextualSource("hand-b", 2);
    let selected;
    for (const at of [100, 166, 233]) selected = tracker.update(pixels(at), model(45, rawA));
    for (let at = 300; at <= 1800; at += 150) tracker.update(pixels(at), model(69, rawB));
    const before = opticalState(tracker);
    const oldSource = tracker.update(pixels(2051), model(45, rawA));
    expect(oldSource).toMatchObject({
      reason: "FULL_HAND_AMBIGUOUS",
      trackId: selected!.trackId,
      point: null,
      measurements: { modelDisposition: "CANDIDATE", accepted: null },
      temporalTrack: { state: "AMBIGUOUS", displayPoint: null },
    });
    expect(opticalState(tracker)).toEqual(before);
    // This fresh image may restart bounded association evidence; it cannot
    // retroactively make the stale pre-entry association a full-hand proof.
  });

  it("allows only the previously proved actual alias to return to its retained canonical material", () => {
    const tracker = new IndexImageTracker(binding);
    const rawA = contextualSource("hand-a", 1);
    const rawB = contextualSource("hand-b", 2);
    const rawC = contextualSource("unverified-hand-c", 3);
    const wholeIndexPixels = (capture: number) => {
      const frame = pixels(capture);
      // Extend the analytic texture across the named shaft regions so aliasB
      // first earns the ordinary two-separated-old-parts proof, including DIP.
      for (let dy = -12; dy <= 36; ++dy)
        for (let dx = -10; dx <= 10; ++dx)
          frame.data[(45 + dy) * 160 + 45 + dx] = 45 + ((dx * 73 + dy * 127 + dx * dy * 19 + 100000) % 135);
      return frame;
    };
    let selected;
    for (const at of [100, 166, 233]) selected = tracker.update(wholeIndexPixels(at), model(45, rawA));
    let aliased;
    for (const at of [300, 366, 433, 500, 566, 633]) aliased = tracker.update(wholeIndexPixels(at), model(45, rawB));
    expect(aliased).toMatchObject({ state: "TRACKING", trackId: selected!.trackId });
    const internal = tracker as unknown as { trustedModelSource: string | null };
    expect(internal.trustedModelSource).toBe(rawB);
    for (let at = 700; at <= 2200; at += 150)
      expect(tracker.update(wholeIndexPixels(at), model(69, rawC))).toMatchObject({
        point: null,
        trackId: selected!.trackId,
        reason: "FULL_HAND_AMBIGUOUS",
      });
    let returned;
    for (const at of [2300, 2366, 2433]) returned = tracker.update(wholeIndexPixels(at), model(45, rawB));
    expect(returned, JSON.stringify(returned)).toMatchObject({ state: "TRACKING", trackId: selected!.trackId });
    expect(internal.trustedModelSource).toBe(rawB);
  });

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

  it("retains old-source image search without lending its proof to a foreign same-context model ID", () => {
    const tracker = new IndexImageTracker(binding);
    const context = [
      "synthetic-provider",
      "synthetic-model",
      "synthetic-algorithm",
      1,
      binding.cameraLeaseId,
      1,
      320,
      240,
      "NONE",
      0,
    ];
    const rawA = JSON.stringify([...context, "hand-a", 1]);
    const rawB = JSON.stringify([...context, "hand-b", 2]);
    let selected;
    for (const at of [100, 166, 233]) selected = tracker.update(pixels(at), model(45, rawA));
    expect(selected).toMatchObject({ state: "TRACKING", coordinateSource: "FUSED" });
    expectCandidate(tracker.update(pixels(300, 57), model(81, rawA)), 57, selected!.trackId);
    const internal = tracker as unknown as {
      sourceAssociation: import("./index-source-association").IndexSourceAssociation;
      quarantinedSearch: { source: string; point: { x: number }; frozenTrustedAt: number } | null;
    };
    const helper = internal.sourceAssociation;
    const trusted = helper.checkpoint();
    const history = opticalState(tracker);
    const observed = vi.spyOn(helper, "observe");
    for (const [at, x] of [
      [366, 69],
      [433, 81],
      [500, 93],
    ]) {
      // B's tip exactly agrees with the moving OLD-A optical hypothesis, but
      // B must receive the standard trusted45 search, not that hypothesis.
      expectCandidate(tracker.update(pixels(at, x), model(x, rawB)), x, selected!.trackId);
      expect(opticalState(tracker)).toEqual(history);
      expect(internal.quarantinedSearch).toMatchObject({ source: rawA, point: { x }, frozenTrustedAt: 233 });
      expect(helper.checkpoint()).toMatchObject({
        canonical: trusted.canonical,
        trusted: rawA,
        trustedAt: trusted.trustedAt,
        candidates: [],
      });
    }
    const foreignEvidence = observed.mock.calls
      .map(([evidence]) => evidence)
      .filter((evidence) => evidence.source === rawB);
    expect(foreignEvidence).toHaveLength(3);
    expect(foreignEvidence.every((evidence) => evidence.appearanceVerified === false)).toBe(true);
    expect(
      foreignEvidence.filter((evidence) => evidence.capture >= 433).map((evidence) => evidence.tipAgreement),
    ).toEqual([false, false]);
    observed.mockRestore();
    // The original source may recover its own retained fixed-reference search;
    // a different source cannot inherit it merely by agreeing with its point.
    for (const at of [566, 633])
      expectCandidate(tracker.update(pixels(at, 93), model(93, rawA)), 93, selected!.trackId);
    const recovered = tracker.update(pixels(699, 93), model(93, rawA));
    expect(recovered).toMatchObject({ state: "TRACKING", trackId: selected!.trackId });
    expect(recovered.point!.x * 159).toBeCloseTo(93, 1);
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
