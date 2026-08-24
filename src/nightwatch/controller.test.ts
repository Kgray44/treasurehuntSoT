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
  it("uses Direct Mainline for one ordinary candidate and obtains protected binding after Sounding Line GO", () => {
    const ledger = queuedLedger();
    let now = Date.parse("2026-08-21T00:00:00.000Z");
    const results: Array<"PENDING" | "RELEASE_GO" | "BINDING_PASS"> = ["PENDING", "RELEASE_GO", "BINDING_PASS"];
    let trainDispatches = 0;
    let bindingDispatches = 0;
    const controller = new NightwatchController(
      ledger,
      {
        ...controlPlane(results),
        dispatchMainlineTrain: () => {
          trainDispatches += 1;
          return { runId: "mainline-train-remote" };
        },
        observeMainlineTrain: () => "PENDING",
        dispatchBinding: () => {
          bindingDispatches += 1;
          return { runId: "binding-remote" };
        },
      },
      { instanceId: "nightwatchd-train-test", now: () => now },
    );
    try {
      controller.start();
      expect(controller.tick()).toMatchObject({ state: "AWAITING_AUTHORITY" });
      now += 1_000;
      expect(controller.tick()).toMatchObject({ state: "AUTHORITY_RUNNING", runId: "authority-remote" });
      now += 1_000;
      expect(controller.tick()).toMatchObject({ state: "AUTHORITY_RUNNING" });
      now += 1_000;
      expect(controller.tick()).toMatchObject({ state: "BINDING_RUNNING", runId: "binding-remote" });
      now += 1_000;
      expect(controller.tick()).toMatchObject({ state: "POST_MERGE_VERIFIED" });
      expect(trainDispatches).toBe(0);
      expect(bindingDispatches).toBe(1);
      expect(ledger.acceptanceRuns()).toHaveLength(2);
    } finally {
      ledger.close();
    }
  });

  it("uses the Mainline Train only when multiple compatible candidates are READY", () => {
    const ledger = queuedLedger();
    ledger.createCandidate({
      id: "companion",
      objectiveId: "nightwatch-companion",
      project: "Nightwatch",
      increment: "A.2",
      branch: "codex/companion",
      productHeadSha: identity.candidateSha,
      localBaseSha: identity.baseSha,
    });
    ledger.transitionCandidate("companion", "LOCALLY_COMPLETE");
    ledger.transitionCandidate("companion", "QUEUE_READY");
    ledger.queueCandidate("companion");
    let now = Date.parse("2026-08-21T00:00:00.000Z");
    let dispatchReceiver: unknown = null;
    const plane: NightwatchControlPlane = {
      ...controlPlane([]),
      dispatchMainlineTrain() {
        dispatchReceiver = this;
        return { runId: "mainline-train-receiver" };
      },
      observeMainlineTrain: () => "PENDING",
    };
    const controller = new NightwatchController(ledger, plane, {
      instanceId: "nightwatchd-train-receiver-test",
      now: () => now,
    });
    try {
      controller.start();
      controller.tick();
      now += 1_000;
      expect(controller.tick()).toMatchObject({ state: "TRAIN_QUALIFYING", runId: "mainline-train-receiver" });
      expect(dispatchReceiver).toBe(plane);
    } finally {
      ledger.close();
    }
  });

  it("routes a failed Train optimization to one fresh Safe Direct Fallback authority run", () => {
    const ledger = queuedLedger();
    ledger.createCandidate({
      id: "companion",
      objectiveId: "nightwatch-companion-fallback",
      project: "Nightwatch",
      increment: "A.2",
      branch: "codex/companion-fallback",
      productHeadSha: identity.candidateSha,
      localBaseSha: identity.baseSha,
    });
    ledger.transitionCandidate("companion", "LOCALLY_COMPLETE");
    ledger.transitionCandidate("companion", "QUEUE_READY");
    ledger.queueCandidate("companion");
    let now = Date.parse("2026-08-21T00:00:00.000Z");
    const directRoutes: Array<string | undefined> = [];
    const controller = new NightwatchController(
      ledger,
      {
        ...controlPlane(["RELEASE_GO", "BINDING_PASS"]),
        dispatchAuthority: (input) => {
          directRoutes.push(input.integrationRoute);
          return { runId: "safe-direct-authority" };
        },
        dispatchMainlineTrain: () => ({ runId: "failed-train" }),
        observeMainlineTrain: () => "REJECTED",
        dispatchBinding: () => ({ runId: "safe-direct-binding" }),
      },
      { instanceId: "nightwatchd-safe-direct-test", now: () => now },
    );
    try {
      controller.start();
      controller.tick();
      now += 1_000;
      expect(controller.tick()).toMatchObject({ state: "TRAIN_QUALIFYING", runId: "failed-train" });
      now += 1_000;
      expect(controller.tick()).toMatchObject({ state: "AUTHORITY_RUNNING", runId: "safe-direct-authority" });
      expect(directRoutes).toEqual(["SAFE_DIRECT_FALLBACK"]);
      expect(ledger.acceptanceRuns()).toHaveLength(2);
      now += 1_000;
      expect(controller.tick()).toMatchObject({ state: "BINDING_RUNNING", runId: "safe-direct-binding" });
      now += 1_000;
      expect(controller.tick()).toMatchObject({ state: "POST_MERGE_VERIFIED" });
    } finally {
      ledger.close();
    }
  });

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
      expect(controller.tick()).toMatchObject({ state: "BINDING_RUNNING", runId: "binding-remote" });
      now += 1_000;
      expect(controller.tick()).toMatchObject({ state: "POST_MERGE_VERIFIED" });
      expect(ledger.acceptanceRuns()).toHaveLength(2);
      expect(ledger.controllerHealth(now)).toMatchObject({ state: "LIVE", instanceId: "nightwatchd-test" });
      expect(controller.bosunProjection(now)).toMatchObject({
        station: "BOSUN",
        state: "LIVE",
        controllerId: "nightwatchd-test",
      });
    } finally {
      ledger.close();
    }
  });

  it("rechecks the exact protected base before the receipt-triggered merge", () => {
    const ledger = queuedLedger();
    let now = Date.parse("2026-08-21T00:00:00.000Z");
    let mergeRequests = 0;
    const controller = new NightwatchController(
      ledger,
      {
        ...controlPlane(["PENDING", "RELEASE_GO", "BINDING_PASS"]),
        protectedMain: () => ({ sha: "f".repeat(40), treeSha: "e".repeat(40) }),
        requestMerge: () => {
          mergeRequests += 1;
          return null;
        },
      },
      { instanceId: "nightwatchd-race-test", now: () => now },
    );
    try {
      controller.start();
      controller.tick();
      now += 1_000;
      controller.tick();
      now += 1_000;
      controller.tick();
      now += 1_000;
      controller.tick();
      now += 1_000;
      expect(controller.tick()).toMatchObject({ state: "MERGE_RACE" });
      expect(mergeRequests).toBe(0);
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

  it("does not block an ordinary candidate on unrelated Baseline Certification state", () => {
    const ledger = queuedLedger();
    const plane: NightwatchControlPlane = {
      ...controlPlane([]),
      preflight: () => ({
        deterministicRegistryHealthy: true,
        ownershipResolved: true,
        identityStable: true,
        leaseAvailable: true,
      }),
    };
    const controller = new NightwatchController(ledger, plane, { instanceId: "nightwatchd-baseline-test" });
    try {
      controller.start();
      expect(controller.tick()).toMatchObject({ state: "AWAITING_AUTHORITY" });
      expect(ledger.acceptanceRuns()).toHaveLength(0);
    } finally {
      ledger.close();
    }
  });
});
