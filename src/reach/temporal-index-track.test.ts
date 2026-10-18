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
  it("keeps coordinate availability distinct from explicitly unknown gesture intent", () => {
    const result = new TemporalIndexTrack().observe(
      evidence(100, { identitySupported: false, source: null, intent: "UNCERTAIN" }),
    );
    expect(result).toMatchObject({ accept: true, snapshot: { intent: "UNCERTAIN" } });
  });
});
