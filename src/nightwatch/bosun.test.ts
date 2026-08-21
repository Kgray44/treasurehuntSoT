import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BosunAutoZeroExecutor, BosunLedger, createRepositoryAutoZeroActions, normalizeBosunFingerprint } from "./bosun";
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
});

describe("Project Bosun B1 AUTO_0", () => {
  it("requires deterministic output and exact expected paths", async () => {
    const executor = new BosunAutoZeroExecutor();
    const result = await executor.execute({ id: "active-test-registry", allowedPaths: ["testing/generated/active-test-registry.json"], run: async () => ({ changedPaths: ["testing/generated/active-test-registry.json"], outputIdentity: { definitions: 1, digest: "trusted" } }) }, ["testing/generated/active-test-registry.json"]);
    expect(result).toMatchObject({ deterministic: true, changedPaths: ["testing/generated/active-test-registry.json"] });
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
