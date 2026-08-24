import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BosunLedger } from "./bosun";
import { NightwatchLedger } from "./runtime";
import {
  createStandingDelegation,
  defaultAutonomyBudgets,
  delegatedActionClasses,
  hardStopActionClasses,
} from "./unattended-autonomy";

const identity = {
  candidateSha: "a".repeat(40),
  candidateTreeSha: "b".repeat(40),
  baseSha: "c".repeat(40),
  baseTreeSha: "d".repeat(40),
  candidateRef: "refs/heads/codex/unattended-autonomy",
};

const databasePath = () => join(mkdtempSync(join(tmpdir(), "nightwatch-unattended-")), "nightwatch.sqlite");

const delegate = (objectiveId: string, project = "Nightwatch", budgets = {}) =>
  createStandingDelegation({
    objectiveId,
    project,
    auditIdentity: `owner-objective:${objectiveId}`,
    budgets,
  });

const candidate = (ledger: NightwatchLedger, id = "candidate-a", objectiveId = "objective-a", budgets = {}) =>
  ledger.createCandidate({
    id,
    objectiveId,
    project: "Nightwatch",
    increment: "Unattended Autonomy Hardening",
    branch: `codex/${id}`,
    productHeadSha: identity.candidateSha,
    localBaseSha: identity.baseSha,
    standingDelegation: delegate(objectiveId, "Nightwatch", budgets),
  });

describe("UNATTENDED_CONTINUATION standing delegation", () => {
  it("keeps the checked-in machine-readable defaults aligned with the executable policy", () => {
    const policy = JSON.parse(readFileSync("testing/unattended-autonomy-policy.json", "utf8"));
    expect(policy.standingDelegation.defaultBudgets).toEqual(defaultAutonomyBudgets);
    expect(policy.hardStops).toEqual(hardStopActionClasses);
    expect([...policy.routing.automaticActionClasses, ...policy.routing.budgetedActionClasses].sort()).toEqual(
      [...delegatedActionClasses].sort(),
    );
  });

  it("simulation 1: regenerates deterministic drift and reconciles a candidate-induced policy digest without an owner pause", () => {
    const ledger = new NightwatchLedger(":memory:");
    try {
      candidate(ledger);
      const generated = ledger.recordAutonomyAction({
        objectiveId: "objective-a",
        candidateId: "candidate-a",
        rootCause: "generated-index-stale",
        actionClass: "generated-state-regeneration",
        project: "Nightwatch",
        inScope: true,
        reversible: true,
      });
      const policyDigest = ledger.recordAutonomyAction({
        objectiveId: "objective-a",
        candidateId: "candidate-a",
        rootCause: "candidate-policy-digest-stale-by-construction",
        actionClass: "policy-identity-reconciliation",
        project: "Nightwatch",
        inScope: true,
        reversible: true,
      });
      expect(generated).toMatchObject({ status: "CONTINUE", route: { routing: "AUTO_DELEGATED" } });
      expect(policyDigest).toMatchObject({ status: "CONTINUE", route: { routing: "AUTO_DELEGATED" } });
      expect(ledger.getCandidate("candidate-a").state).not.toBe("PARKED_OWNER_REQUIRED");
      expect(ledger.ownerEscalations("objective-a")).toEqual([]);
    } finally {
      ledger.close();
    }
  });

  it("simulation 2: hands a safe shared repair to Bosun under the parent envelope without an authorization round trip", () => {
    const path = databasePath();
    const ledger = new NightwatchLedger(path);
    const bosun = new BosunLedger(path, ledger);
    try {
      candidate(ledger);
      ledger.transitionCandidate("candidate-a", "LOCALLY_COMPLETE");
      ledger.transitionCandidate("candidate-a", "QUEUE_READY");
      ledger.queueCandidate("candidate-a");
      const transaction = ledger.beginAtomicAcceptance({
        candidateId: "candidate-a",
        identity,
        rootFingerprint: "unattended-parent",
      });
      const report = bosun.reportFinding({
        parentTransactionId: transaction.id,
        blockedCandidateId: "candidate-a",
        closureSteps: ["focused repair", "Sounding Line acceptance", "post-merge proof"],
        finding: {
          owner: "shared-control-plane",
          category: "deterministic-shared-fixture-drift",
          resource: "testing/generated/active-test-registry.json",
          contract: "active-test-registry",
          runtimeClass: "nightwatch",
          repairClass: "OWNER",
          autonomyActionClass: "shared-maintenance-repair",
          autonomyInScope: true,
          autonomyReversible: true,
          autonomyMaintenanceDepth: 0,
        },
      });
      expect(report.cascade).toMatchObject({ status: "ACTIVE" });
      expect(report.objective).toMatchObject({
        repairClass: "OWNER",
        ownerRequiredRouting: "DELEGATED_WITH_BUDGET",
        state: "OBJECTIVE_READY",
      });
      expect(ledger.getCandidate("candidate-a").state).not.toBe("PARKED_OWNER_REQUIRED");
    } finally {
      bosun.close();
      ledger.close();
    }
  });

  it("simulation 3: rejects blind retries, continues with a materially different strategy, and parks once the strategy budget is exhausted", () => {
    const ledger = new NightwatchLedger(":memory:");
    try {
      candidate(ledger, "candidate-a", "objective-a", { maxDistinctStrategiesPerRootCause: 2 });
      expect(
        ledger.recordStrategyContinuation({
          objectiveId: "objective-a",
          rootCause: "identity-stale",
          strategy: "regenerate-from-base",
          semanticPrecondition: "candidate-policy-input-changed",
          outcome: "FAILED",
        }),
      ).toMatchObject({ state: "CONTINUE" });
      expect(
        ledger.recordStrategyContinuation({
          objectiveId: "objective-a",
          rootCause: "identity-stale",
          strategy: "regenerate-from-base",
          semanticPrecondition: "candidate-policy-input-changed",
          outcome: "FAILED",
        }),
      ).toMatchObject({ state: "BLIND_RETRY_REJECTED" });
      expect(
        ledger.recordStrategyContinuation({
          objectiveId: "objective-a",
          rootCause: "identity-stale",
          strategy: "reconcile-candidate-bound-record",
          semanticPrecondition: "candidate-policy-input-changed",
          outcome: "SUCCEEDED",
        }),
      ).toMatchObject({ state: "CONTINUE", distinctStrategyCount: 2 });
      expect(
        ledger.recordStrategyContinuation({
          objectiveId: "objective-a",
          rootCause: "identity-stale",
          strategy: "third-unneeded-strategy",
          semanticPrecondition: "candidate-policy-input-changed",
          outcome: "FAILED",
        }),
      ).toMatchObject({ state: "EXHAUSTED", reason: "MAX_DISTINCT_STRATEGIES_REACHED" });
      const escalation = ledger.recordOwnerEscalation({
        objectiveId: "objective-a",
        protectedMainIdentity: { sha: identity.baseSha, treeSha: identity.baseTreeSha },
        candidateIdentity: { candidateId: "candidate-a", sha: identity.candidateSha, treeSha: identity.candidateTreeSha, baseSha: identity.baseSha },
        rootCause: "identity-stale",
        delegationGap: "All delegated materially distinct strategies were exhausted.",
        hardStopClass: "AUTONOMY_BUDGET_EXHAUSTED",
        strategiesAttempted: ["regenerate-from-base", "reconcile-candidate-bound-record"],
        exhaustionReason: "MAX_DISTINCT_STRATEGIES_REACHED",
        requestedDecision: "Choose whether to widen the strategy budget or alter the governing invariant.",
        options: [
          { option: "Widen budget", consequence: "Permits one additional bounded strategy." },
          { option: "Retain budget", consequence: "Leaves the exact candidate parked for later work." },
        ],
        preservedWorkLocation: "codex/candidate-a",
      });
      expect(escalation.options).toHaveLength(2);
      expect(ledger.getCandidate("candidate-a").state).toBe("PARKED_OWNER_REQUIRED");
      expect(ledger.events("objective-a").some((event) => event.type === "AUTONOMY_BLIND_RETRY_REJECTED")).toBe(true);
    } finally {
      ledger.close();
    }
  });

  it("keeps true hard stops and unrelated scope outside the envelope", () => {
    const ledger = new NightwatchLedger(":memory:");
    try {
      candidate(ledger);
      expect(
        ledger.routeOwnerRequired({
          objectiveId: "objective-a",
          actionClass: "branch-protection-weakening",
          project: "Nightwatch",
          inScope: true,
          reversible: false,
        }),
      ).toMatchObject({ routing: "TRUE_OWNER_REQUIRED", reason: "EXPLICIT_HARD_STOP" });
      expect(
        ledger.routeOwnerRequired({
          objectiveId: "objective-a",
          actionClass: "focused-code-repair",
          project: "Unrelated Product",
          inScope: false,
          reversible: true,
        }),
      ).toMatchObject({ routing: "TRUE_OWNER_REQUIRED", reason: "DELEGATION_RISK_OR_SCOPE_BOUNDARY" });
    } finally {
      ledger.close();
    }
  });

  it("permits one delegated maintenance candidate and rejects a same-objective successor repair", () => {
    const ledger = new NightwatchLedger(":memory:");
    try {
      candidate(ledger);
      expect(
        ledger.recordAutonomyAction({
          objectiveId: "objective-a",
          candidateId: "candidate-a",
          rootCause: "shared-deterministic-defect-a",
          actionClass: "shared-maintenance-repair",
          project: "Nightwatch",
          inScope: true,
          reversible: true,
          sharedMaintenance: true,
          repairCandidateId: "bosun-repair-a",
        }),
      ).toMatchObject({ status: "CONTINUE", route: { routing: "DELEGATED_WITH_BUDGET" } });
      expect(
        ledger.recordAutonomyAction({
          objectiveId: "objective-a",
          candidateId: "candidate-a",
          rootCause: "shared-deterministic-defect-b",
          actionClass: "shared-maintenance-repair",
          project: "Nightwatch",
          inScope: true,
          reversible: true,
          sharedMaintenance: true,
          repairCandidateId: "bosun-repair-b",
        }),
      ).toMatchObject({ status: "EXHAUSTED" });
    } finally {
      ledger.close();
    }
  });

  it("turns an expired autonomous wall-clock budget into a diagnostic checkpoint before more work begins", () => {
    const ledger = new NightwatchLedger(":memory:");
    try {
      const createdAt = "2026-08-23T00:00:00.000Z";
      ledger.createCandidate({
        id: "candidate-wall-clock",
        objectiveId: "objective-wall-clock",
        project: "Nightwatch",
        increment: "Unattended Autonomy Hardening",
        branch: "codex/wall-clock",
        productHeadSha: identity.candidateSha,
        localBaseSha: identity.baseSha,
        createdAt,
        standingDelegation: delegate("objective-wall-clock", "Nightwatch", { maxWallClockMs: 1 }),
      });
      expect(
        ledger.recordAutonomyAction({
          objectiveId: "objective-wall-clock",
          candidateId: "candidate-wall-clock",
          rootCause: "long-running-diagnostic",
          actionClass: "focused-code-repair",
          project: "Nightwatch",
          inScope: true,
          reversible: true,
          at: "2026-08-23T00:00:00.001Z",
        }),
      ).toMatchObject({ status: "EXHAUSTED" });
    } finally {
      ledger.close();
    }
  });
});
