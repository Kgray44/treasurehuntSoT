import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import * as phase3 from "../../scripts/sounding-line/phase3.mjs";

async function withStore(fn) {
  const root = await mkdtemp(path.join(os.tmpdir(), "sounding-line-phase3-"));
  try {
    return await fn(await phase3.openHistory(root), root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
const receipt = {
  runId: "sl3-run-test",
  sourceWatermark: "source-a",
  policyDigest: "policy-a",
  planDigest: "plan-a",
  cleanupStatus: "CLEAN",
  evidenceClass: "MACHINE_RECEIPT",
  suites: [{ suiteId: "unit.core", outcome: "PASSED", durationMs: 21, environmentDigest: "env", fixtureVersion: "v1" }],
};

test("historical store is outside the repository, migrates idempotently, and ingests a receipt transactionally", async () =>
  withStore(async (store, root) => {
    assert.ok(store.file.startsWith(root));
    assert.equal((await phase3.ingestReceipt(store, receipt)).idempotent, false);
    assert.equal((await phase3.ingestReceipt(store, receipt)).idempotent, true);
    assert.equal(phase3.historyStats(store, "unit.core").outcomes.PASSED, 1);
    assert.equal(phase3.verifyHistory(store).valid, true);
    assert.equal(phase3.exportHistoryManifest(store).runs.length, 1);
    await assert.rejects(
      () => phase3.ingestReceipt(store, { ...receipt, policyDigest: "forged" }),
      /CONFLICTING_DUPLICATE_RECEIPT/,
    );
    store.close();
  }));

test("receipt ingestion rejects sensitive data and unknown cleanup does not become clean", async () =>
  withStore(async (store) => {
    await assert.rejects(
      () => phase3.ingestReceipt(store, { ...receipt, runId: "sl3-run-secret", accessToken: "not-allowed" }),
      /SENSITIVE_RECEIPT_FIELD/,
    );
    assert.equal(
      phase3.freshness(
        {
          sourceWatermark: "s",
          policyDigest: "p",
          suiteVersion: "v",
          fixtureVersion: "f",
          environmentFingerprint: "e",
          cleanupStatus: "CLEAN",
        },
        {
          sourceWatermark: "s",
          policyDigest: "p",
          suiteVersion: "v",
          fixtureVersion: "f",
          environmentFingerprint: "e",
          cleanupStatus: "UNKNOWN",
        },
      ).reusable,
      false,
    );
    store.close();
  }));

test("impact, rerun, signatures, root cascades, shards, and throttle stay deterministic and conservative", () => {
  const plan = phase3.planImpact({ changedPaths: ["new/unknown.ts"], knownSuites: ["a", "b"], mappings: [] });
  assert.equal(plan.selected.length, 2);
  assert.equal(plan.omitted.length, 0);
  assert.deepEqual(
    phase3
      .rerunPlan({ nodes: [{ id: "a" }, { id: "b", dependsOn: ["a"] }], changed: ["a"] })
      .nodes.map((x) => x.action),
    ["MANDATORY_RERUN", "MANDATORY_RERUN"],
  );
  assert.equal(
    phase3.normalizeFailureSignature({
      failureClass: "server",
      suiteId: "a",
      message: "http://x:3100/tmp/a-123e4567-e89b-12d3-a456-426614174000",
    }).exact,
    phase3.normalizeFailureSignature({
      failureClass: "server",
      suiteId: "a",
      message: "http://x:3201/tmp/b-123e4567-e89b-12d3-a456-426614174000",
    }).exact,
  );
  const normalized = phase3.normalizeRootCascade([
    { id: "setup", outcome: "FAILED" },
    { id: "child", outcome: "FAILED", dependsOn: ["setup"] },
  ]);
  assert.deepEqual(
    normalized.nodes.map((x) => x.outcome),
    ["FAILED_ROOT", "CASCADE_BLOCKED"],
  );
  assert.equal(normalized.reconciles, true);
  assert.deepEqual(
    phase3.balanceShards(
      [
        { id: "a", estimate: 3 },
        { id: "b", estimate: 2 },
      ],
      2,
    ),
    phase3.balanceShards(
      [
        { id: "a", estimate: 3 },
        { id: "b", estimate: 2 },
      ],
      2,
    ),
  );
  assert.equal(phase3.transitionThrottle("NORMAL", { cpu: 99 }).launchHeavy, false);
});

test("durable run journal suppresses equivalent work and refuses unsafe resume", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "sounding-line-runs-"));
  try {
    const input = { root, sourceWatermark: "s", policyDigest: "p", planDigest: "d" };
    const first = await phase3.startRun(input);
    const second = await phase3.startRun(input);
    assert.equal(second.duplicateSuppressed, true);
    assert.equal((await phase3.followRunLog(first.run.id, { root })).lines.at(-1).endsWith("RUN_STARTED"), true);
    await phase3.cancelRun(first.run.id, root);
    await assert.rejects(
      () => phase3.resumeRun(first.run.id, { sourceWatermark: "other", policyDigest: "p", planDigest: "d" }, root),
      /UNSAFE_RESUME_SOURCEWATERMARK/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("completion governance rejects premature authority and unsupported external claims", () => {
  const base = {
    sourceWatermark: "s",
    policyVersion: "1.2.0",
    planDigest: "p",
    selectedSuites: ["unit.core"],
    omittedSuites: [],
    results: {},
    cleanup: "CLEAN",
    finalStatus: "PHASE_LOCAL_COMPLETE",
    executionUsage: {
      elapsed: "PT1S",
      source: "test",
      tokens: { input: 1, output: 1, cached: 0, total: 2 },
      toolCalls: 1,
      availability: {
        input: "AVAILABLE",
        output: "AVAILABLE",
        cached: "AVAILABLE",
        total: "AVAILABLE",
        toolCalls: "AVAILABLE",
      },
    },
  };
  assert.equal(phase3.validateCompletionReport(base), true);
  assert.throws(
    () => phase3.validateCompletionReport({ ...base, finalStatus: "PHASE_3_MAINLINE" }),
    /UNSUPPORTED_COMPLETION_AUTHORITY/,
  );
  assert.throws(
    () => phase3.validateCompletionReport({ ...base, externalGates: [{ status: "VALIDATED" }] }),
    /EXTERNAL_GATE_EVIDENCE_REQUIRED/,
  );
});
