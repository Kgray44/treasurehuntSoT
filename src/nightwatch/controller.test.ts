import { describe, expect, it } from "vitest";
import { NightwatchController, type NightwatchControlPlane } from "./controller";
import { NightwatchLedger } from "./runtime";

const identity = {
  candidateSha: "a".repeat(40),
  candidateTreeSha: "b".repeat(40),
  baseSha: "c".repeat(40),
  baseTreeSha: "d".repeat(40),
  candidateRef: "refs/heads/codex/canary",
};

const controlPlane = (results: Array<"PENDING" | "RELEASE_GO" | "BINDING_PASS">): NightwatchControlPlane => ({
  currentIdentity: () => identity,
  preflight: () => ({
    deterministicRegistryHealthy: true,
    ownershipResolved: true,
    identityStable: true,
    leaseAvailable: true,
  }),
  dispatchAuthority: () => ({ runId: "authority-remote" }),
  dispatchBinding: () => ({ runId: "binding-remote" }),
  observeRun: () => results.shift() ?? "PENDING",
  protectedMain: () => ({ sha: identity.baseSha, treeSha: identity.baseTreeSha }),
  requestMerge: () => ({ mergeSha: "e".repeat(40), treeSha: identity.candidateTreeSha }),
});

const queuedLedger = () => {
  const ledger = new NightwatchLedger(":memory:");
  ledger.createCandidate({
    id: "canary",
    objectiveId: "nightwatch-canary",
    project: "Nightwatch",
    increment: "A.2",
    branch: "codex/canary",
    productHeadSha: identity.candidateSha,
    localBaseSha: identity.baseSha,
  });
  ledger.transitionCandidate("canary", "LOCALLY_COMPLETE");
  ledger.transitionCandidate("canary", "QUEUE_READY");
  ledger.queueCandidate("canary");
  return ledger;
};

describe("Nightwatch controller", () => {
  it("persists one authority and one binding dispatch across duplicate ticks", () => {
    const ledger = queuedLedger();
    let now = Date.parse("2026-08-21T00:00:00.000Z");
    const controller = new NightwatchController(ledger, controlPlane(["PENDING", "RELEASE_GO", "BINDING_PASS"]), {
      instanceId: "nightwatchd-test",
      now: () => now,
    });
    try {
      controller.start();
      expect(controller.tick()).toMatchObject({ state: "AWAITING_AUTHORITY" });
      now += 1_000;
      expect(controller.tick()).toMatchObject({ state: "AUTHORITY_RUNNING", runId: "authority-remote" });
      now += 1_000;
      expect(controller.tick()).toMatchObject({ state: "AUTHORITY_RUNNING" });
      expect(ledger.acceptanceRuns()).toHaveLength(1);
      now += 1_000;
      expect(controller.tick()).toMatchObject({ state: "BINDING_PENDING" });
      now += 1_000;
      expect(controller.tick()).toMatchObject({ state: "BINDING_RUNNING", runId: "binding-remote" });
      now += 1_000;
      expect(controller.tick()).toMatchObject({ state: "MERGING" });
      now += 1_000;
      expect(controller.tick()).toMatchObject({ state: "POST_MERGE_VERIFIED" });
      expect(ledger.acceptanceRuns()).toHaveLength(2);
      expect(ledger.controllerHealth(now)).toMatchObject({ state: "LIVE", instanceId: "nightwatchd-test" });
      expect(controller.bosunProjection(now)).toMatchObject({ station: "BOSUN", state: "LIVE", controllerId: "nightwatchd-test" });
    } finally {
      ledger.close();
    }
  });

  it("reuses a durable dispatch intent after a controller restart", () => {
    const ledger = queuedLedger();
    let now = Date.parse("2026-08-21T00:00:00.000Z");
    let authorityDispatches = 0;
    const plane: NightwatchControlPlane = {
      ...controlPlane(["PENDING"]),
      dispatchAuthority: (input) => {
        authorityDispatches += 1;
        expect(input.dispatchKey).toContain("nightwatch:");
        return { runId: "authority-recovered" };
      },
    };
    const first = new NightwatchController(ledger, plane, { instanceId: "nightwatchd-first", now: () => now });
    try {
      first.start();
      first.tick();
      const transaction = ledger.acceptanceTransactions()[0]!;
      const intent = ledger.dispatchAuthority(
        transaction.id,
        `nightwatch:${transaction.id}:authority`,
        undefined,
        new Date(now).toISOString(),
      );
      expect(intent.externalRunId).toBeNull();
      first.stop();
      now += 1_000;
      const restarted = new NightwatchController(ledger, plane, {
        instanceId: "nightwatchd-restarted",
        now: () => now,
      });
      restarted.start();
      expect(restarted.tick()).toMatchObject({ state: "AUTHORITY_RUNNING", runId: "authority-recovered" });
      expect(authorityDispatches).toBe(1);
      now += 1_000;
      restarted.tick();
      expect(authorityDispatches).toBe(1);
      restarted.stop();
    } finally {
      ledger.close();
    }
  });
});
