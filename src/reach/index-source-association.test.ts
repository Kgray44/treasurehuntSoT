// @sounding-line-registration owner=reach suite=unit.reach contracts=reach.phase1.foundation
import { describe, expect, it } from "vitest";
import { IndexSourceAssociation, type IndexSourceEvidence } from "./index-source-association";

const proof = (source: string, capture: number, overrides: Partial<IndexSourceEvidence> = {}): IndexSourceEvidence => ({
  source,
  capture,
  fullPoint: true,
  identityObserved: true,
  anatomyCompatible: true,
  appearanceVerified: true,
  tipAgreement: true,
  ambiguous: false,
  ...overrides,
});
function established() {
  const association = new IndexSourceAssociation();
  expect(association.establish({ source: "trusted-A", capture: 100 }).state).toBe("VERIFIED");
  return association;
}
describe("bounded temporary model-source association probation", () => {
  it("requires explicit initial trusted registration regardless of repeated complete proposals", () => {
    const association = new IndexSourceAssociation();
    for (const at of [100, 166, 233, 300])
      expect(association.observe(proof("untrusted", at))).toMatchObject({
        state: "UNESTABLISHED",
        canonicalSource: null,
        candidates: [],
      });
    expect(association.canonicalSource).toBeNull();
    expect(association.establish({ source: "trusted-A", capture: 300 }).state).toBe("VERIFIED");
    expect(association.establish({ source: "other", capture: 400 }).reason).toBe("ALREADY_ESTABLISHED");
    expect(association.canonicalSource).toBe("trusted-A");
  });
  it("promotes only three current complete proofs spanning at least120ms and preserves the logical source", () => {
    const association = established();
    for (const at of [200, 260]) expect(association.observe(proof("temporary-B", at)).canonicalSource).toBeNull();
    expect(association.observe(proof("temporary-B", 320))).toMatchObject({
      state: "PROMOTED",
      canonicalSource: "trusted-A",
      trustedSource: "temporary-B",
      trustedCapture: 320,
      candidates: [],
    });
    expect(association.canonicalSource).toBe("trusted-A");
    expect(association.trustedSource).toBe("temporary-B");
    expect(association.observe(proof("temporary-B", 400, { appearanceVerified: false }))).toMatchObject({
      state: "VERIFIED",
      canonicalSource: null,
      trustedCapture: 400,
    });
  });
  it("does not substitute high frame count for the120ms span", () => {
    const association = established();
    for (const at of [200, 201, 202, 203]) expect(association.observe(proof("B", at)).state).toBe("PROBATION");
    expect(association.observe(proof("B", 320)).state).toBe("PROMOTED");
  });
  it.each([250, 251])("applies the candidate gap boundary at%sms", (gap) => {
    const association = established();
    association.observe(proof("B", 200));
    association.observe(proof("B", 260));
    const out = association.observe(proof("B", 260 + gap));
    expect(out.state).toBe(gap === 250 ? "PROMOTED" : "PROBATION");
    if (gap === 251) expect(out.candidates[0]).toMatchObject({ startedAt: 511, lastAt: 511, frames: 1 });
  });
  it.each([1200, 1201])("does not renew old trust from candidates at the%sms expiry boundary", (age) => {
    const association = established();
    association.observe(proof("B", 100 + age - 130));
    association.observe(proof("B", 100 + age - 60));
    const out = association.observe(proof("B", 100 + age));
    expect(out.state).toBe(age === 1200 ? "PROMOTED" : "EXPIRED");
    if (age === 1201) {
      expect(association.canonicalSource).toBeNull();
      expect(association.trustedSource).toBeNull();
      expect(out.candidates).toEqual([]);
    }
  });
  it.each(["fullPoint", "identityObserved", "anatomyCompatible", "appearanceVerified", "tipAgreement"] as const)(
    "never rebinds without current%s proof",
    (field) => {
      const association = established();
      for (const at of [200, 266, 333, 400])
        expect(association.observe(proof("B", at, { [field]: false }))).toMatchObject({
          state: "PROBATION",
          canonicalSource: null,
          trustedCapture: 100,
          candidates: [],
        });
      expect(association.trustedSource).toBe("trusted-A");
    },
  );
  it("does not count current ambiguous evidence or let it renew old expiry", () => {
    const association = established();
    for (const at of [200, 266, 333, 400])
      expect(association.observe(proof("B", at, { ambiguous: true }))).toMatchObject({
        state: "AMBIGUOUS",
        trustedCapture: 100,
        candidates: [],
      });
    expect(association.observe(proof("B", 1301)).state).toBe("EXPIRED");
  });
  it("blocks a qualified source while any other fresh supported alternative remains live", () => {
    const association = established();
    association.observe(proof("B", 200));
    association.observe(proof("B", 260));
    association.observe(proof("C", 280));
    expect(association.observe(proof("B", 320))).toMatchObject({
      state: "AMBIGUOUS",
      canonicalSource: null,
      trustedCapture: 100,
    });
    expect(association.observe(proof("B", 500)).state).toBe("AMBIGUOUS");
    expect(association.observe(proof("B", 531))).toMatchObject({
      state: "PROMOTED",
      canonicalSource: "trusted-A",
      trustedSource: "B",
    });
  });
  it("does not promote either of two indefinitely interleaved alternatives", () => {
    const association = established();
    for (let i = 0; i < 12; ++i) {
      const out = association.observe(proof(i % 2 ? "C" : "B", 200 + i * 60));
      expect(out.canonicalSource).toBeNull();
      expect(out.trustedCapture).toBe(100);
      expect(out.candidates.length).toBeLessThanOrEqual(3);
    }
    expect(association.trustedSource).toBe("trusted-A");
  });
  it("bounds the candidate set at three without evicting a competing explanation to manufacture a winner", () => {
    const association = established();
    for (const [source, at] of [
      ["B", 200],
      ["C", 220],
      ["D", 240],
    ] as const)
      association.observe(proof(source, at));
    const limit = association.observe(proof("E", 260));
    expect(limit).toMatchObject({ state: "AMBIGUOUS", reason: "SOURCE_CANDIDATE_LIMIT", canonicalSource: null });
    expect(limit.candidates.map((candidate) => candidate.source)).toEqual(["B", "C", "D"]);
    expect(association.observe(proof("E", 511)).candidates).toEqual([
      { source: "E", startedAt: 511, lastAt: 511, frames: 1 },
    ]);
  });
  it("rejects reordered, duplicate and nonfinite captures without corrupting probation", () => {
    const association = established();
    association.observe(proof("B", 200));
    for (const at of [199, 200, NaN, Infinity, -Infinity, -1])
      expect(association.observe(proof("B", at)).state).toBe("REJECTED");
    expect(association.observe(proof("B", 260)).candidates[0].frames).toBe(2);
    expect(association.observe(proof("B", 320)).state).toBe("PROMOTED");
  });
  it("rejects invalid source keys without advancing the evidence clock", () => {
    const association = established();
    for (const source of ["", "   "]) expect(association.observe(proof(source, 200)).state).toBe("REJECTED");
    expect(association.observe(proof("B", 200)).candidates[0].frames).toBe(1);
  });
  it("does not let partial same-source observations refresh trust or clear a competing candidate", () => {
    const association = established();
    association.observe(proof("B", 200));
    expect(association.observe(proof("trusted-A", 260, { identityObserved: false }))).toMatchObject({
      state: "PROBATION",
      trustedCapture: 100,
      candidates: [{ source: "B", frames: 1, lastAt: 200 }],
    });
    expect(association.observe(proof("trusted-A", 1301, { fullPoint: false })).state).toBe("EXPIRED");
  });
  it("requires a candidate to begin probation again after any incomplete current proof", () => {
    const association = established();
    association.observe(proof("B", 200));
    association.observe(proof("B", 260));
    expect(association.observe(proof("B", 300, { tipAgreement: false })).candidates).toEqual([]);
    expect(association.observe(proof("B", 333)).candidates[0]).toMatchObject({ frames: 1, startedAt: 333 });
  });
  it("refreshes a genuinely current old source and clears the interrupted new-source cohort", () => {
    const association = established();
    association.observe(proof("B", 200));
    association.observe(proof("B", 260));
    expect(association.observe(proof("trusted-A", 300))).toMatchObject({
      state: "VERIFIED",
      trustedCapture: 300,
      candidates: [],
    });
    expect(association.observe(proof("B", 333)).candidates[0].frames).toBe(1);
  });
  it("does not blindly restore the original temporary source after promoting an alias", () => {
    const association = established();
    for (const at of [200, 260, 320]) association.observe(proof("B", at));
    expect(association.observe(proof("trusted-A", 400)).state).toBe("PROBATION");
    expect(association.trustedSource).toBe("B");
    association.observe(proof("trusted-A", 460));
    expect(association.observe(proof("trusted-A", 520))).toMatchObject({
      state: "PROMOTED",
      canonicalSource: "trusted-A",
      trustedSource: "trusted-A",
    });
  });
  it("does not expose mutable candidate state or any coordinate/action/calibration fields", () => {
    const association = established();
    const out = association.observe(proof("B", 200));
    (out.candidates[0] as { frames: number }).frames = 999;
    const next = association.observe(proof("B", 260));
    expect(next.candidates[0].frames).toBe(2);
    for (const key of ["point", "actionEligible", "calibrationEligible", "velocity"])
      expect(next).not.toHaveProperty(key);
  });
  it("clears all trust and clocks on an explicit owning-context reset", () => {
    const association = established();
    association.observe(proof("B", 200));
    association.reset();
    expect(association.canonicalSource).toBeNull();
    expect(association.trustedSource).toBeNull();
    expect(association.observe(proof("B", 10))).toMatchObject({ state: "UNESTABLISHED", candidates: [] });
    expect(association.establish({ source: "new-context", capture: 10 })).toMatchObject({
      state: "VERIFIED",
      trustedSource: "new-context",
    });
  });
});
