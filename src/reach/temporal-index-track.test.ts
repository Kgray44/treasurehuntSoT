// @sounding-line-registration owner=reach suite=unit.reach contracts=reach.phase1.foundation
import { describe, expect, it } from "vitest";
import { TemporalIndexTrack } from "./temporal-index-track";
const evidence = (capture: number, changes: Partial<Parameters<TemporalIndexTrack["observe"]>[0]> = {}) => ({
  capture,
  completed: capture + 10,
  rawTrackId: "optical-1",
  point: { x: 0.4, y: 0.5 },
  uncertaintyPixels: 3,
  identitySupported: true,
  source: "canonical-index-1",
  intent: "POINT" as const,
  ambiguous: false,
  hypotheses: 1,
  width: 640,
  height: 480,
  ...changes,
});
describe("temporal index association is independent of measurement and intent", () => {
  it("starts with a logical identity independent of the optical identifier", () => {
    const track = new TemporalIndexTrack();
    const result = track.observe(evidence(100));
    expect(result.trackId).not.toBe("optical-1");
    expect(result).toMatchObject({
      accept: true,
      snapshot: { state: "TRACKING", identity: "ESTABLISHED", measurementAgeMs: 10 },
    });
  });
  it("keeps association through uncertain posture with no measured point or eligibility", () => {
    const track = new TemporalIndexTrack();
    const first = track.observe(evidence(100));
    const paused = track.observe(evidence(300, { point: null, intent: "UNCERTAIN" }));
    expect(paused).toMatchObject({
      trackId: first.trackId,
      accept: false,
      snapshot: { state: "UNCERTAIN", identity: "ESTABLISHED", intent: "UNCERTAIN", displayPoint: null },
    });
    expect(track.observe(evidence(400)).trackId).toBe(first.trackId);
  });
  it("uses only bounded display prediction, never an accepted measurement", () => {
    const track = new TemporalIndexTrack();
    track.observe(evidence(100));
    track.observe(evidence(150, { point: { x: 0.41, y: 0.5 } }));
    const coast = track.observe(evidence(200, { point: null, identitySupported: false, intent: "UNCERTAIN" }));
    expect(coast.accept).toBe(false);
    expect(coast.snapshot.state).toBe("COASTING");
    expect(coast.snapshot.displayPoint!.x).toBeGreaterThan(0.41);
    expect(coast.snapshot.positionUncertaintyPixels).toBeGreaterThan(3);
    expect(track.observe(evidence(301, { point: null, identitySupported: false })).snapshot.displayPoint).toBeNull();
  });
  it("counts processing delay in the150ms visual freshness boundary", () => {
    const track = new TemporalIndexTrack();
    track.observe(evidence(100));
    const late = track.observe(evidence(200, { completed: 285, point: null, identitySupported: false }));
    expect(late).toMatchObject({
      accept: false,
      snapshot: { state: "REACQUIRING", measurementAgeMs: 185, displayPoint: null },
    });
  });
  it("does not coast through contrary intent or competing associations", () => {
    for (const changes of [{ intent: "CONTRARY" as const }, { ambiguous: true }]) {
      const track = new TemporalIndexTrack();
      track.observe(evidence(100));
      const result = track.observe(evidence(150, { point: null, ...changes }));
      expect(result.accept).toBe(false);
      expect(result.snapshot.displayPoint).toBeNull();
    }
  });
  it("retains logical identity across a separately verified same-source optical epoch", () => {
    const track = new TemporalIndexTrack();
    const first = track.observe(evidence(100));
    const rebound = track.observe(evidence(200, { rawTrackId: "optical-2" }));
    expect(rebound).toMatchObject({ trackId: first.trackId, accept: true });
  });
  it.each(["SOURCE", "RAW_EPOCH"])("never promotes an unverified %s replacement", (kind) => {
    const track = new TemporalIndexTrack();
    const first = track.observe(evidence(100));
    const rejected = track.observe(
      evidence(
        200,
        kind === "SOURCE" ? { source: "unverified-other-hand" } : { rawTrackId: "optical-2", identitySupported: false },
      ),
    );
    expect(rejected).toMatchObject({
      trackId: first.trackId,
      accept: false,
      snapshot: { state: "AMBIGUOUS", identity: "AMBIGUOUS", displayPoint: null },
    });
    expect(track.observe(evidence(300)).trackId).toBe(first.trackId);
  });
  it("expires unsupported association without transferring its saved binding", () => {
    const track = new TemporalIndexTrack();
    const first = track.observe(evidence(100));
    for (const at of [1400, 1500])
      expect(
        track.observe(evidence(at, { point: null, rawTrackId: null, identitySupported: false, source: null })),
      ).toMatchObject({ trackId: null, accept: false, snapshot: { state: "EXPIRED", identity: "EXPIRED" } });
    expect(track.observe(evidence(1600, { rawTrackId: "fresh-optical" })).trackId).not.toBe(first.trackId);
  });
  it("rolls back the entire logical ledger after a rejected final dispatch", () => {
    const track = new TemporalIndexTrack();
    const first = track.observe(evidence(100));
    const checkpoint = track.checkpoint();
    track.observe(evidence(200, { point: { x: 0.6, y: 0.5 } }));
    track.restore(checkpoint);
    const result = track.observe(evidence(200, { point: null, intent: "UNCERTAIN" }));
    expect(result).toMatchObject({ trackId: first.trackId, accept: false, snapshot: { measurementAgeMs: 110 } });
  });
  it("retains only established image identity through sustained model ambiguity without renewing coordinates", () => {
    const track = new TemporalIndexTrack();
    const first = track.observe(evidence(100));
    track.observe(evidence(150, { point: { x: 0.41, y: 0.5 } }));
    const measured = track.checkpoint();
    for (const capture of [300, 600, 900, 1200, 1500, 1800]) {
      const intent = capture === 1800 ? ("CONTRARY" as const) : ("UNCERTAIN" as const);
      const paused = track.observe(
        evidence(capture, { point: null, ambiguous: true, retainedImageIdentity: true, intent }),
      );
      expect(paused).toMatchObject({
        trackId: first.trackId,
        accept: false,
        snapshot: { state: "AMBIGUOUS", identity: "AMBIGUOUS", intent, displayPoint: null },
      });
      expect(track.checkpoint()).toMatchObject({
        logical: measured.logical,
        source: measured.source,
        sources: measured.sources,
        measurement: measured.measurement,
        velocity: measured.velocity,
        identityAt: capture,
      });
    }
    expect(track.observe(evidence(1900))).toMatchObject({
      trackId: first.trackId,
      accept: true,
      snapshot: { state: "TRACKING", identity: "ESTABLISHED", intent: "POINT" },
    });
  });
  it("retains an existing selected source when current image-only evidence carries no model source", () => {
    const track = new TemporalIndexTrack();
    const first = track.observe(evidence(100));
    track.observe(evidence(1200, { point: null, ambiguous: true, retainedImageIdentity: true, source: null }));
    expect(track.checkpoint()).toMatchObject({
      source: "canonical-index-1",
      sources: ["canonical-index-1"],
      identityAt: 1200,
    });
    expect(track.observe(evidence(1400)).trackId).toBe(first.trackId);
  });
  it.each([
    ["missing retained proof", { retainedImageIdentity: false }],
    ["unsupported identity", { identitySupported: false }],
    ["foreign source", { source: "unverified-other-hand" }],
    ["new raw epoch", { rawTrackId: "optical-2" }],
    ["ambiguous coordinate", { point: { x: 0.6, y: 0.5 } }],
    ["late completion", { completed: 451 }],
  ] as const)("cannot renew selected identity from %s", (_name, changes) => {
    const track = new TemporalIndexTrack();
    track.observe(evidence(100));
    const original = track.checkpoint();
    const rejected = track.observe(
      evidence(300, { point: null, ambiguous: true, retainedImageIdentity: true, ...changes }),
    );
    expect(rejected).toMatchObject({
      accept: false,
      snapshot: { state: "AMBIGUOUS", identity: "AMBIGUOUS", displayPoint: null },
    });
    expect(track.checkpoint()).toMatchObject({
      logical: original.logical,
      source: original.source,
      sources: original.sources,
      identityAt: original.identityAt,
      measurement: original.measurement,
      velocity: original.velocity,
    });
    expect(
      track.observe(evidence(1301, { rawTrackId: null, point: null, identitySupported: false, source: null })),
    ).toMatchObject({ trackId: null, accept: false, snapshot: { state: "EXPIRED" } });
  });
  it("does not establish a cold candidate or revive an expired selection from retained proof", () => {
    const candidate = new TemporalIndexTrack();
    candidate.observe(evidence(100, { point: null, identitySupported: false, ambiguous: true }));
    candidate.observe(evidence(300, { point: null, ambiguous: true, retainedImageIdentity: true }));
    expect(candidate.checkpoint()).toMatchObject({ logical: { established: false }, source: null, identityAt: 100 });

    const expired = new TemporalIndexTrack();
    const first = expired.observe(evidence(100));
    const result = expired.observe(evidence(1301, { point: null, ambiguous: true, retainedImageIdentity: true }));
    expect(result.trackId).not.toBe(first.trackId);
    expect(result).toMatchObject({ accept: false, snapshot: { identity: "AMBIGUOUS", displayPoint: null } });
    expect(expired.checkpoint().logical?.established).toBe(false);
  });
  it("cannot attach a previously unknown model source through retained image evidence", () => {
    const track = new TemporalIndexTrack();
    track.observe(evidence(100, { source: null }));
    track.observe(
      evidence(300, {
        point: null,
        ambiguous: true,
        retainedImageIdentity: true,
        source: "unverified-other-hand",
      }),
    );
    expect(track.checkpoint()).toMatchObject({ source: null, sources: [], identityAt: 100 });
  });
  it("uses the existing inclusive identity and completion-age boundaries for retained proof", () => {
    const track = new TemporalIndexTrack();
    const first = track.observe(evidence(100));
    const paused = track.observe(
      evidence(1300, { completed: 1450, point: null, ambiguous: true, retainedImageIdentity: true }),
    );
    expect(paused).toMatchObject({ trackId: first.trackId, accept: false, snapshot: { displayPoint: null } });
    expect(track.checkpoint().identityAt).toBe(1300);
    expect(track.observe(evidence(1400)).trackId).toBe(first.trackId);
  });
  it("restores the previous expiry clock when a retained-image update is rolled back", () => {
    const track = new TemporalIndexTrack();
    track.observe(evidence(100));
    const checkpoint = track.checkpoint();
    track.observe(evidence(1200, { point: null, ambiguous: true, retainedImageIdentity: true }));
    track.restore(checkpoint);
    expect(
      track.observe(evidence(1301, { point: null, rawTrackId: null, identitySupported: false, source: null })),
    ).toMatchObject({ trackId: null, accept: false, snapshot: { state: "EXPIRED", displayPoint: null } });
  });
  it("keeps coordinate availability distinct from explicitly unknown gesture intent", () => {
    const result = new TemporalIndexTrack().observe(
      evidence(100, { identitySupported: false, source: null, intent: "UNCERTAIN" }),
    );
    expect(result).toMatchObject({ accept: true, snapshot: { intent: "UNCERTAIN" } });
  });
});
