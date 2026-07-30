import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import * as phase3 from "../../scripts/sounding-line/phase3.mjs";

async function withStore(fn) {
  const root = await mkdtemp(path.join(os.tmpdir(), "sounding-line-phase3-"));
  let store;
  try {
    store = await phase3.openHistory(root);
    return await fn(store, root);
  } finally {
    try {
      store?.close();
    } catch {
      // A completed assertion may already have closed the local test database.
    }
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
    assert.equal(
      phase3.recordHistoricalEntity(store, "historical_attempts", {
        runId: receipt.runId,
        subjectId: "unit.core:attempt-1",
        status: "PASSED",
      }).entity,
      "historical_attempts",
    );
    assert.equal(
      phase3.recordFlakeObservation(store, {
        runId: receipt.runId,
        suiteId: "unit.core",
        attempts: [{ outcome: "FAILED_ROOT" }, { outcome: "PASSED" }],
      }).entity,
      "historical_flake_observations",
    );
    assert.throws(
      () =>
        phase3.recordStaleTest(store, { testId: "contract.test", classification: "STALE", protectedContract: true }),
      /PROTECTED_CONTRACT_REGRESSION_NOT_STALE/,
    );
    assert.equal(
      phase3.recordSlowSuite(store, {
        runId: receipt.runId,
        suiteId: "unit.core",
        durationMs: 40,
        budgetMs: 20,
        bottleneck: "fixture",
      }).entity,
      "historical_slow_suite_records",
    );
    assert.equal(phase3.verifyHistory(store).valid, true);
    assert.equal(phase3.exportHistoryManifest(store).runs.length, 1);
    await assert.rejects(
      () => phase3.ingestReceipt(store, { ...receipt, policyDigest: "forged" }),
      /CONFLICTING_DUPLICATE_RECEIPT/,
    );
    await assert.rejects(
      () => phase3.ingestReceipt(store, { ...receipt, runId: "sl3-source-mismatch" }, { sourceWatermark: "different" }),
      /RECEIPT_SOURCE_MISMATCH/,
    );
    await assert.rejects(
      () => phase3.ingestReceipt(store, { ...receipt, runId: "sl3-policy-mismatch" }, { policyDigest: "different" }),
      /RECEIPT_POLICY_MISMATCH/,
    );
    store.close();
    const reopened = await phase3.openHistory(root);
    assert.deepEqual(
      reopened.db
        .prepare("SELECT version FROM schema_migrations ORDER BY version")
        .all()
        .map((row) => row.version),
      [1, 2],
    );
    reopened.close();
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
    assert.equal(
      phase3.freshness(
        {
          sourceWatermark: "s",
          policyDigest: "p",
          suiteVersion: "v",
          fixtureVersion: "f",
          environmentFingerprint: "e",
          cleanupStatus: "CLEAN",
          contractDigest: "contract-new",
        },
        {
          sourceWatermark: "s",
          policyDigest: "p",
          suiteVersion: "v",
          fixtureVersion: "f",
          environmentFingerprint: "e",
          cleanupStatus: "CLEAN",
          contractDigest: "contract-old",
        },
      ).status,
      "STALE_CONTRACT",
    );
    store.close();
  }));

test("corrupt historical storage fails closed", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "sounding-line-corrupt-"));
  try {
    await writeFile(path.join(root, "history.sqlite"), "not a sqlite database", "utf8");
    await assert.rejects(() => phase3.openHistory(root), /HISTORICAL_STORE_UNAVAILABLE/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

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
  const policyPlan = phase3.contractAwareImpact({
    changedPaths: ["prisma/migrations/20260730/migration.sql"],
    policy: {
      identities: { sourceWatermark: "source", policyDigest: "policy" },
      suites: [
        { id: "unit", affectedPaths: ["src/**"], dependencies: [], resources: [], contracts: [] },
        {
          id: "db",
          affectedPaths: ["prisma/**"],
          dependencies: ["unit"],
          resources: ["sqlite"],
          contracts: ["schema"],
        },
      ],
    },
  });
  assert.equal(policyPlan.conservativeBroadening, true);
  assert.deepEqual(
    policyPlan.nodes.map((node) => node.suiteId),
    ["db", "unit"],
  );
  assert.equal(policyPlan.nodes.find((node) => node.suiteId === "db").action, "EXECUTE");
});

test("durable run journal suppresses equivalent work and refuses unsafe resume", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "sounding-line-runs-"));
  try {
    const input = { root, sourceWatermark: "s", policyDigest: "p", planDigest: "d" };
    await assert.rejects(
      () => phase3.startRun({ ...input, sourceWatermark: "secret-value" }),
      /UNSAFE_SOURCE_WATERMARK/,
    );
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

test("detached controller survives the client launch, handles cooperative cancellation, and records orphan recovery", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "sounding-line-controller-"));
  try {
    const input = { root, sourceWatermark: "s", policyDigest: "p", planDigest: "d", purpose: "controller-test" };
    const started = await phase3.launchController(input);
    assert.equal(started.controllerStarted, true);
    await new Promise((resolve) => setTimeout(resolve, 650));
    assert.equal((await phase3.readRun(started.run.id, root)).state, "RUNNING");
    await phase3.cancelRun(started.run.id, root);
    await new Promise((resolve) => setTimeout(resolve, 650));
    assert.equal((await phase3.readRun(started.run.id, root)).state, "COMPLETED");
    const orphan = await phase3.startRun({ ...input, purpose: "orphan-test" });
    await phase3.updateRun(orphan.run.id, { controller: { pid: 999999, host: os.hostname() } }, root);
    const inspected = await phase3.inspectOrphans(root);
    assert.equal(
      inspected.entries.some((entry) => entry.id === orphan.run.id),
      true,
    );
    assert.equal(
      (await phase3.recoverRun(orphan.run.id, { sourceWatermark: "s", policyDigest: "p", planDigest: "d" }, { root }))
        .state,
      "RECOVERING",
    );
    const ambiguous = await phase3.startRun({ ...input, purpose: "ambiguous-host" });
    await phase3.updateRun(ambiguous.run.id, { controller: { pid: 42, host: "unverifiable-host" } }, root);
    await phase3.inspectOrphans(root);
    assert.equal((await phase3.readRun(ambiguous.run.id, root)).state, "QUARANTINED");
    const nonResumable = await phase3.startRun({
      ...input,
      purpose: "non-resumable",
      nodes: [{ resumeClass: "NON_RESUMABLE" }],
    });
    await phase3.completeRun(nonResumable.run.id, "CLEAN", root);
    await assert.rejects(
      () => phase3.resumeRun(nonResumable.run.id, { sourceWatermark: "s", policyDigest: "p", planDigest: "d" }, root),
      /NON_RESUMABLE_NODE_REQUIRES_NEW_RUN/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("detached controller executes an allowlisted governed adapter through the Phase 2 runtime", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "sounding-line-governed-controller-"));
  try {
    const started = await phase3.launchController({
      root,
      sourceWatermark: "a".repeat(40),
      policyDigest: "b".repeat(64),
      planDigest: "controller-governed-adapter",
      purpose: "governed-controller-test",
      execution: {
        adapterId: "policy",
        repositoryRoot: process.cwd(),
        runtimeBase: path.join(root, "phase2"),
        sourceDigest: "c".repeat(64),
      },
    });
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const current = await phase3.readRun(started.run.id, root);
      if (current.state !== "RUNNING") {
        assert.equal(current.state, "COMPLETED");
        assert.equal(current.executionOutcome, "PASS");
        assert.equal(current.cleanup, "CLEAN");
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    assert.fail("governed controller did not reach a terminal state");
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
