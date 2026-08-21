import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BosunAutoZeroExecutor, BosunLedger, createRepositoryAutoZeroActions, normalizeBosunFingerprint, planBaselineAutoZeroClosure } from "./bosun";
import { BosunLiveRepairCoordinator } from "./bosun-live";
import { NightwatchController, type NightwatchControlPlane } from "./controller";
import { NightwatchLedger } from "./runtime";

const databasePath = () => join(mkdtempSync(join(tmpdir(), "bosun-b0-b1-")), "nightwatch.sqlite");
const identity = { candidateSha: "a".repeat(40), candidateTreeSha: "b".repeat(40), baseSha: "c".repeat(40), baseTreeSha: "d".repeat(40), candidateRef: "refs/heads/codex/canary" };
const finding = { owner: "sounding-line", category: "generated-drift", resource: "active-test-registry", contract: "registry-determinism", runtimeClass: "repository", repairClass: "AUTO_0" as const };

const parent = (path: string, at = "2026-08-21T00:00:00.000Z") => {
  const ledger = new NightwatchLedger(path);
  ledger.createCandidate({ id: "candidate-a", objectiveId: "product-a", project: "Project A", increment: "1", branch: "codex/a", productHeadSha: identity.candidateSha, localBaseSha: identity.baseSha });
  ledger.transitionCandidate("candidate-a", "LOCALLY_COMPLETE");
  ledger.transitionCandidate("candidate-a", "QUEUE_READY");
  ledger.queueCandidate("candidate-a", { readyAt: at });
  return { ledger, transaction: ledger.beginAtomicAcceptance({ candidateId: "candidate-a", identity, rootFingerprint: "parent-root", at }) };
};

describe("Project Bosun B0 durable convergence", () => {
  it("deduplicates findings, preserves the canonical repair across restart, and projects Bridgewatch truth", () => {
    const path = databasePath();
    const { ledger, transaction } = parent(path);
    const bosun = new BosunLedger(path, ledger);
    try {
      bosun.heartbeat("bosund-canary", null, "2026-08-21T00:00:01.000Z");
      const reportAt = "2026-08-21T00:00:01.000Z";
      const first = bosun.reportFinding({ finding, parentTransactionId: transaction.id, blockedCandidateId: "candidate-a", closureSteps: ["regenerate registry", "post-merge proof"], at: reportAt });
      const second = bosun.reportFinding({ finding: { ...finding, category: "generated drift" }, parentTransactionId: transaction.id, blockedCandidateId: "candidate-b", closureSteps: ["ignored duplicate plan"], at: reportAt });
      expect(normalizeBosunFingerprint(finding)).toBe(normalizeBosunFingerprint({ ...finding, category: "generated drift" }));
      expect(second.cascade.id).toBe(first.cascade.id);
      expect(second.cascade.blockedCandidates).toEqual(["candidate-a", "candidate-b"]);
      expect(bosun.createOrReuseRepair(first.cascade.id, "MW-001", 401, reportAt).created).toBe(true);
      expect(bosun.createOrReuseRepair(first.cascade.id, "MW-002", 402, reportAt).created).toBe(false);
      expect(bosun.projection(Date.parse("2026-08-21T00:00:02.000Z"))).toMatchObject({ station: "BOSUN", state: "LIVE", activeCascadeCount: 1 });
      bosun.close();
      const restarted = new BosunLedger(path, ledger);
      try {
        const cascade = restarted.projection(Date.parse("2026-08-21T00:00:03.000Z")).cascades[0]!;
        expect(cascade).toMatchObject({ id: first.cascade.id, activeObjectiveId: "MW-001", activeRepairPr: 401, repairPrCount: 1, duplicateRepairsSuppressed: 1, blockedCandidates: ["candidate-a", "candidate-b"] });
      } finally { restarted.close(); }
    } finally { try { bosun.close(); } catch {} ledger.close(); }
  });

  it("inherits the parent breaker and cannot create a repair descendant after parking", () => {
    const path = databasePath();
    const { ledger, transaction } = parent(path);
    const bosun = new BosunLedger(path, ledger);
    try {
      const late = "2026-08-21T01:31:00.000Z";
      const report = bosun.reportFinding({ finding, parentTransactionId: transaction.id, blockedCandidateId: "candidate-a", closureSteps: [], at: late });
      expect(report.cascade.status).toBe("PARKED_PARENT_BREAKER");
      expect(() => bosun.createOrReuseRepair(report.cascade.id, "MW-late", 500, late)).toThrow("PARKED_PARENT_BREAKER");
      expect(bosun.projection(Date.parse(late)).cascades[0]).toMatchObject({ status: "PARKED_PARENT_BREAKER", activeObjectiveId: null });
    } finally { bosun.close(); ledger.close(); }
  });

  it("requires post-merge proof and wakes a blocked Nightwatch candidate once", () => {
    const path = databasePath();
    const { ledger, transaction } = parent(path);
    const bosun = new BosunLedger(path, ledger);
    try {
      const at = "2026-08-21T00:01:00.000Z";
      ledger.transitionCandidate("candidate-a", "BLOCKED_BY_BOSUN", { at });
      const report = bosun.reportFinding({ finding, parentTransactionId: transaction.id, blockedCandidateId: "candidate-a", closureSteps: [], at });
      expect(() => bosun.converge(report.cascade.id, "f".repeat(40), at)).toThrow("BOSUN_POST_MERGE_PROOF_REQUIRED");
      bosun.recordPostMergeProof(report.cascade.id, { landedMainSha: "f".repeat(40), evidenceRef: "baseline-receipt", rootBlockerRemoved: true }, at);
      expect(bosun.converge(report.cascade.id, "f".repeat(40), at)).toMatchObject({ status: "CONVERGED", dependentWakeupCount: 1 });
      expect(ledger.getCandidate("candidate-a").state).toBe("QUEUE_FRONT");
    } finally { bosun.close(); ledger.close(); }
  });
});

describe("Project Bosun B1 AUTO_0", () => {
  it("builds one fixed-point compound closure plan from the complete baseline AUTO_0 set", () => {
    const plan = planBaselineAutoZeroClosure([
      { checkId: "active-test-registry", fingerprint: "registry", repairability: "AUTO_0", dependencies: ["registry"] },
      { checkId: "p34-retirement-ledger", fingerprint: "p34", repairability: "AUTO_0", dependencies: ["ledger"] },
      { checkId: "deepwater-policy", fingerprint: "deepwater", repairability: "AUTO_0", dependencies: ["policy"] },
    ]);
    expect(plan).toMatchObject({ status: "READY", fixedPointRequired: true, actionIds: ["active-test-registry", "deepwater-policy", "p34-retirement-ledger"] });
    expect(plan.expectedPaths).toContain("testing/generated/active-test-registry.json");
    expect(plan.expectedPaths).toContain("Development_Docs/Programs/Deepwater/deepwater-phase-status.json");
  });

  it("refuses to convert an owner baseline blocker into AUTO_0 repair authority", () => {
    expect(planBaselineAutoZeroClosure([{ checkId: "policy", fingerprint: "policy", repairability: "OWNER", dependencies: ["policy"] }]))
      .toMatchObject({ status: "OWNER_REQUIRED", actionIds: [] });
  });

  it("runs a compound closure serially before repeating it for the fixed-point proof", async () => {
    const executor = new BosunAutoZeroExecutor();
    const order: string[] = [];
    const action = (id: "active-test-registry" | "document-index") => ({
      id,
      allowedPaths: [`${id}.json`],
      run: async () => {
        order.push(id);
        return { changedPaths: [`${id}.json`], outputIdentity: { id, output: "stable" } };
      },
    });
    await expect(executor.executeCompound([action("active-test-registry"), action("document-index")], {
      "active-test-registry": ["active-test-registry.json"],
      "document-index": ["document-index.json"],
    })).resolves.toMatchObject({ fixedPoint: true });
    expect(order).toEqual(["active-test-registry", "active-test-registry", "document-index", "document-index", "active-test-registry", "active-test-registry", "document-index", "document-index"]);
  });

  it("accepts a deterministic subset of receipt-bound generator outputs", async () => {
    const executor = new BosunAutoZeroExecutor();
    const result = await executor.execute({ id: "document-index", allowedPaths: ["Development_Docs/document-index.json", "Development_Docs/Project_Ledgerlight_Documentation_Migration_Matrix.csv"], run: async () => ({ changedPaths: ["Development_Docs/Project_Ledgerlight_Documentation_Migration_Matrix.csv"], outputIdentity: { definitions: 1, digest: "trusted" } }) }, ["Development_Docs/document-index.json", "Development_Docs/Project_Ledgerlight_Documentation_Migration_Matrix.csv"]);
    expect(result).toMatchObject({ deterministic: true, changedPaths: ["Development_Docs/Project_Ledgerlight_Documentation_Migration_Matrix.csv"] });
  });

  it("fails closed when a deterministic action escapes its allowed generated path", async () => {
    const executor = new BosunAutoZeroExecutor();
    await expect(executor.execute({ id: "document-index", allowedPaths: ["Development_Docs/INDEX.md"], run: async () => ({ changedPaths: ["Development_Docs/INDEX.md", "src/unsafe.ts"], outputIdentity: "same" }) }, ["Development_Docs/INDEX.md", "src/unsafe.ts"])).rejects.toThrow("BOSUN_AUTO_0_SCOPE_ESCAPE");
  });

  it("keeps the Feature Catalog action unavailable until its governed runner is explicitly configured", async () => {
    const actions = createRepositoryAutoZeroActions(process.cwd());
    await expect(actions.featureCatalog.run()).rejects.toThrow("BOSUN_AUTO_0_ACTION_UNCONFIGURED");
  });
});

describe("Project Bosun B1.1 live repair integration", () => {
  it("keeps one repair identity through restart, accepts it once, and wakes every attached candidate once", () => {
    const path = databasePath();
    const { ledger, transaction } = parent(path);
    const bosun = new BosunLedger(path, ledger);
    let now = Date.parse("2026-08-21T00:00:00.000Z");
    const results: Array<"RELEASE_GO" | "BINDING_PASS"> = ["RELEASE_GO", "BINDING_PASS"];
    const control: NightwatchControlPlane = {
      currentIdentity: () => identity,
      preflight: () => ({ deterministicRegistryHealthy: true, ownershipResolved: true, identityStable: true, leaseAvailable: true }),
      dispatchAuthority: () => ({ runId: "authority-live" }),
      dispatchBinding: () => ({ runId: "binding-live" }),
      observeRun: () => results.shift() ?? "PENDING",
      protectedMain: () => ({ sha: identity.baseSha, treeSha: identity.baseTreeSha }),
      requestMerge: () => ({ mergeSha: "e".repeat(40), treeSha: identity.candidateTreeSha }),
      postMergeBosunProof: () => ({ evidenceRef: "fresh-protected-main-generator-proof", rootBlockerRemoved: true }),
    };
    try {
      ledger.createCandidate({ id: "candidate-b", objectiveId: "product-b", project: "Project B", increment: "1", branch: "codex/b", productHeadSha: "b".repeat(40), localBaseSha: identity.baseSha });
      ledger.transitionCandidate("candidate-b", "BLOCKED_BY_BOSUN");
      const coordinator = new BosunLiveRepairCoordinator(ledger, bosun);
      const attached = coordinator.attachAutoZeroRepair({
        parentTransactionId: transaction.id,
        blockedCandidateIds: ["candidate-a", "candidate-b"],
        finding,
        repairCandidate: { id: "bosun-auto-0", objectiveId: "bosun-auto-0-registry", project: "Bosun", increment: "B1.1", branch: "refs/heads/codex/bosun-auto-0", productHeadSha: identity.candidateSha, localBaseSha: identity.baseSha },
        identity,
        repairPr: 777,
        actionId: "active-test-registry",
        outputDigest: "deterministic-output",
        focusedEvidenceRef: "registry-twice",
        at: new Date(now).toISOString(),
      });
      expect(attached.maintenance).toMatchObject({ candidateId: "bosun-auto-0", state: "AWAITING_AUTHORITY", cascadeId: transaction.cascadeId });
      expect(bosun.liveRepairForTransaction(attached.maintenance.id)).toMatchObject({ repairPr: 777, candidateSha: identity.candidateSha, baseSha: identity.baseSha });
      bosun.close();
      const controller = new NightwatchController(ledger, control, { instanceId: "nightwatchd-bosun-live", now: () => now });
      controller.start();
      now += 1_000;
      expect(controller.tick()).toMatchObject({ state: "AUTHORITY_RUNNING", runId: "authority-live" });
      now += 1_000;
      expect(controller.tick()).toMatchObject({ state: "BINDING_PENDING" });
      now += 1_000;
      expect(controller.tick()).toMatchObject({ state: "BINDING_RUNNING", runId: "binding-live" });
      now += 1_000;
      expect(controller.tick()).toMatchObject({ state: "MERGING" });
      now += 1_000;
      expect(controller.tick()).toMatchObject({ state: "POST_MERGE_VERIFIED" });
      const restarted = new BosunLedger(path, ledger);
      try {
        expect(restarted.projection(now).cascades[0]).toMatchObject({ status: "CONVERGED", repairPrCount: 1, authorityAttempts: 1, dependentWakeupCount: 2 });
        expect(ledger.getCandidate("candidate-a").state).toBe("QUEUE_FRONT");
        expect(ledger.getCandidate("candidate-b").state).toBe("QUEUED");
        expect(restarted.liveRepairForTransaction(attached.maintenance.id)?.completedAt).toBeTruthy();
      } finally { restarted.close(); }
      controller.stop();
    } finally { try { bosun.close(); } catch {} ledger.close(); }
  });
});
