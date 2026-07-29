import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import * as phase3 from "../../../../scripts/sounding-line/preparation/phase3/index.mjs";

const record = {
  runId: "run-1",
  planDigest: "plan",
  sourceWatermark: "source",
  policyDigest: "policy",
  suiteId: "unit.core",
  suiteVersion: "1",
  executorVersion: "1",
  environmentFingerprint: "env",
  finalOutcome: "PASSED",
  executionStartedAt: "2026-01-01T00:00:00Z",
  executionCompletedAt: "2026-01-01T00:00:01Z",
};
test("historical schema rejects missing identity, invalid timing, and secret-like data", () => {
  assert.match(phase3.validateHistoricalRecord(record).canonicalDigest, /^[a-f0-9]{64}$/);
  assert.throws(() => phase3.validateHistoricalRecord({ ...record, runId: "" }), /MISSING_RUNID/);
  assert.throws(
    () => phase3.validateHistoricalRecord({ ...record, executionCompletedAt: "2025-01-01T00:00:00Z" }),
    /INVALID_TIMING/,
  );
  assert.throws(() => phase3.validateHistoricalRecord({ ...record, sessionToken: "never-store" }), /SECRET_LIKE_FIELD/);
});
test("duration statistics retain samples and use a conservative cold-start fallback", () => {
  assert.equal(
    phase3.durationStatistics([{ classification: "VALID_COMPARABLE", executionMilliseconds: 10 }]).sufficient,
    false,
  );
  const stats = phase3.durationStatistics(
    [10, 20, 30, 40, 500].map((executionMilliseconds) => ({
      classification: "VALID_COMPARABLE",
      executionMilliseconds,
    })),
  );
  assert.equal(stats.p90, 500);
  assert.equal(stats.estimate, 500);
});
test("impact planning is deterministic and uncertainty broadens", () => {
  const input = {
    changedPaths: ["src/api/a.ts"],
    mappings: [{ path: "src/api", suiteIds: ["api"] }],
    knownSuites: ["api", "browser"],
    risk: "LOW",
  };
  assert.deepEqual(phase3.planImpact(input), phase3.planImpact(input));
  assert.equal(phase3.planImpact({ ...input, changedPaths: ["new/unknown.ts"] }).selected.length, 2);
  assert.equal(phase3.planImpact({ ...input, risk: "CRITICAL" }).requiredTier, "release");
});
test("freshness and invalidation fail closed", () => {
  const identity = {
    sourceWatermark: "s",
    policyDigest: "p",
    suiteVersion: "v",
    fixtureVersion: "f",
    environmentFingerprint: "e",
    cleanupStatus: "CLEAN",
  };
  assert.equal(phase3.classifyFreshness(identity, identity).status, "FRESH_EXACT");
  assert.equal(phase3.classifyFreshness(identity, { ...identity, policyDigest: "changed" }).status, "STALE_POLICY");
  assert.deepEqual(
    phase3
      .planInvalidation({ nodes: [{ id: "a" }, { id: "b", dependsOn: ["a"] }], changed: ["a"] })
      .map((item) => item.action),
    ["MANDATORY_RERUN", "MANDATORY_RERUN"],
  );
});
test("root/cascade normalization preserves independent roots and exact accounting", () => {
  const result = phase3.normalizeRootCascade([
    { id: "setup", outcome: "FAILED" },
    { id: "dependent", outcome: "FAILED", dependsOn: ["setup"] },
    { id: "independent", outcome: "FAILED" },
  ]);
  assert.deepEqual(
    result.nodes.map((node) => node.outcome),
    ["FAILED_ROOT", "CASCADE_BLOCKED", "FAILED_ROOT"],
  );
  assert.equal(result.reconciles, true);
});
test("failure signatures redact unstable and secret-like values without merging different defects", () => {
  const left = phase3.normalizeFailureSignature({
    failureClass: "ASSERT",
    suiteId: "unit",
    errorCode: "A",
    message: "Bearer abcdefghijklmnopqrstuvwxyz /tmp/x:3142 123e4567-e89b-12d3-a456-426614174000",
  });
  const right = phase3.normalizeFailureSignature({
    failureClass: "ASSERT",
    suiteId: "unit",
    errorCode: "B",
    message: "different",
  });
  assert.match(left.normalized, /\[REDACTED\]/);
  assert.notEqual(left.exact, right.exact);
});
test("shards are deterministic and throttling never weakens evidence", () => {
  const items = [
    { id: "long", estimate: 9 },
    { id: "short-a", estimate: 1 },
    { id: "short-b", estimate: 1 },
  ];
  assert.deepEqual(phase3.balanceShards(items, 2), phase3.balanceShards(items, 2));
  assert.equal(phase3.transitionThrottle("NORMAL", { cpu: 95 }).evidenceRequirementsChanged, false);
  assert.equal(phase3.transitionThrottle("CRITICAL", { cpu: 10 }).state, "RECOVERING");
});
test("completion enforcement requires clean cleanup, fresh evidence, and explained omissions", () => {
  const report = {
    sourceWatermark: "s",
    policyVersion: "p",
    planDigest: "d",
    selectedSuites: ["unit"],
    omittedSuites: [{ suiteId: "browser", explanation: "external only" }],
    results: [],
    cleanup: "CLEAN",
    finalStatus: "BLOCKED",
    reusedEvidence: [],
  };
  assert.equal(phase3.validateCompletionReport(report), true);
  assert.throws(() => phase3.validateCompletionReport({ ...report, cleanup: "UNKNOWN" }), /CLEANUP_REQUIRED/);
});
test("fixture corpus names every required synthetic preparation scenario", async () => {
  const fixture = JSON.parse(await readFile(new URL("./fixtures.json", import.meta.url), "utf8"));
  assert.equal(fixture.fixtureNames.length, 34);
  assert.equal(fixture.banner, phase3.PREPARATION_BANNER);
  assert.match(fixture.privacy, /synthetic/i);
});
