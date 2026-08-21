import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { NightwatchInvariantError, NightwatchLedger } from "./runtime";

const databasePath = () => join(mkdtempSync(join(tmpdir(), "nightwatch-increment-a-")), "nightwatch.sqlite");
const candidateInput = (id: string, objectiveId = `objective-${id}`) => ({
  id,
  objectiveId,
  project: "project-alpha",
  increment: "increment-a",
  branch: `codex/${id}`,
  productHeadSha: `${id}-head`,
  localBaseSha: `${id}-base`,
});
const queue = (ledger: NightwatchLedger, id: string, options = {}) => {
  ledger.createCandidate(candidateInput(id));
  ledger.transitionCandidate(id, "LOCALLY_COMPLETE");
  ledger.transitionCandidate(id, "QUEUE_READY");
  return ledger.queueCandidate(id, options);
};
const completeFront = (ledger: NightwatchLedger, id: string, owner = "integrator") => {
  const lease = ledger.acquireIntegrationAcceptance(id, owner, 60_000);
  ledger.beginReconciliation(id, lease.id);
  ledger.transitionCandidate(id, "QUALIFYING");
  ledger.transitionCandidate(id, "ACCEPTANCE_PENDING");
  ledger.transitionCandidate(id, "INTEGRATED");
  ledger.transitionCandidate(id, "POST_MERGE_VERIFIED", { reason: "exact-main-proof" });
  ledger.releaseLease(lease.id, owner);
  return ledger.selectQueueFront();
};

describe("Nightwatch candidate lifecycle", () => {
  it("enforces explicit legal transitions and fails closed on illegal ones", () => {
    const ledger = new NightwatchLedger(":memory:");
    try {
      ledger.createCandidate(candidateInput("alpha"));
      expect(() => ledger.transitionCandidate("alpha", "INTEGRATED")).toThrow("ILLEGAL_CANDIDATE_TRANSITION");
      ledger.transitionCandidate("alpha", "LOCALLY_COMPLETE");
      ledger.transitionCandidate("alpha", "QUEUE_READY");
      ledger.queueCandidate("alpha");
      expect(ledger.getCandidate("alpha").state).toBe("QUEUE_FRONT");
      expect(ledger.transitionsFor("QUEUE_FRONT")).toContain("RECONCILING");
    } finally {
      ledger.close();
    }
  });

  it("enforces one active candidate per objective and preserves successor lineage", () => {
    const ledger = new NightwatchLedger(":memory:");
    try {
      ledger.createCandidate(candidateInput("alpha", "same-objective"));
      expect(() => ledger.createCandidate(candidateInput("beta", "same-objective"))).toThrow(
        "OBJECTIVE_ALREADY_HAS_ACTIVE_CANDIDATE",
      );
      const successor = ledger.createSuccessor(
        "alpha",
        candidateInput("beta", "same-objective"),
        "owner approved replacement",
      );
      expect(ledger.getCandidate("alpha")).toMatchObject({
        state: "SUPERSEDED",
        active: false,
        terminalReason: "owner approved replacement",
      });
      expect(successor).toMatchObject({ predecessorId: "alpha", state: "IMPLEMENTING", active: true });
    } finally {
      ledger.close();
    }
  });
});

describe("Nightwatch Integration Queue", () => {
  it("orders eligible work deterministically while age eventually defeats priority starvation", () => {
    const ledger = new NightwatchLedger(":memory:");
    try {
      const now = Date.parse("2026-08-20T00:00:00.000Z");
      queue(ledger, "front", { readyAt: new Date(now).toISOString() });
      queue(ledger, "old-small", {
        priority: 0,
        readyAt: new Date(now - 60 * 3_600_000).toISOString(),
        estimatedSize: 1,
      });
      queue(ledger, "new-priority", { priority: 2, readyAt: new Date(now).toISOString(), estimatedSize: 100 });
      expect(ledger.rankEligibleQueue(now).map((entry) => entry.candidateId)).toEqual(["old-small", "new-priority"]);
      expect(ledger.rankEligibleQueue(now)).toEqual(ledger.rankEligibleQueue(now));
    } finally {
      ledger.close();
    }
  });

  it("leaves non-front candidates frozen across main advances, then reconciles the next front once", () => {
    const ledger = new NightwatchLedger(":memory:");
    try {
      queue(ledger, "alpha");
      queue(ledger, "beta");
      ledger.recordMainAdvance("main-after-alpha");
      expect(ledger.getCandidate("beta").state).toBe("QUEUED");
      expect(ledger.events("beta").some((event) => event.type === "RECONCILIATION_BEGUN")).toBe(false);
      expect(() => ledger.beginReconciliation("beta", "missing")).toThrow("QUEUE_FRONT_REQUIRED");

      expect(completeFront(ledger, "alpha")?.id).toBe("beta");
      const betaLease = ledger.acquireIntegrationAcceptance("beta", "integrator", 60_000);
      ledger.beginReconciliation("beta", betaLease.id);
      expect(ledger.getQueueEntry("beta").reconciliationCount).toBe(1);
    } finally {
      ledger.close();
    }
  });

  it("allows a blocked queue front to yield without erasing candidate history", () => {
    const ledger = new NightwatchLedger(":memory:");
    try {
      queue(ledger, "alpha");
      queue(ledger, "beta");
      const next = ledger.blockQueueFront("alpha", "MW-00418 shared validation defect");
      expect(next?.id).toBe("beta");
      expect(ledger.getCandidate("alpha").state).toBe("BLOCKED_BY_BOSUN");
      expect(ledger.events("alpha").map((event) => event.type)).toContain("QUEUE_FRONT_BLOCKED");
    } finally {
      ledger.close();
    }
  });

  it("does not consider a dependent candidate eligible until its dependency has post-merge proof", () => {
    const ledger = new NightwatchLedger(":memory:");
    try {
      queue(ledger, "alpha");
      queue(ledger, "beta", { dependencies: ["alpha"] });
      queue(ledger, "gamma");
      expect(ledger.rankEligibleQueue().map((entry) => entry.candidateId)).toEqual(["gamma"]);
      ledger.blockQueueFront("alpha", "independent work may proceed");
      expect(ledger.currentQueueFront()?.id).toBe("gamma");
    } finally {
      ledger.close();
    }
  });
});

describe("Nightwatch migration reservation and leases", () => {
  it("atomically reserves multi-ID ranges, rejects collisions, and supports release and expiry", () => {
    const ledger = new NightwatchLedger(":memory:");
    try {
      const first = ledger.reserveMigrationRange({
        family: "test-family",
        project: "project-alpha",
        objectiveId: "alpha",
        count: 3,
        startId: 10,
        ttlMs: 1_000,
        now: 0,
      });
      expect(first).toMatchObject({ startId: 10, endId: 12, state: "ACTIVE" });
      expect(() =>
        ledger.reserveMigrationRange({
          family: "test-family",
          project: "project-beta",
          objectiveId: "beta",
          count: 2,
          startId: 12,
          ttlMs: 1_000,
          now: 10,
        }),
      ).toThrow("MIGRATION_RESERVATION_COLLISION");
      ledger.releaseReservation(first.id, "project-alpha");
      const replacement = ledger.reserveMigrationRange({
        family: "test-family",
        project: "project-beta",
        objectiveId: "beta",
        count: 2,
        startId: 12,
        ttlMs: 1,
        now: 10,
      });
      ledger.recover({ now: 12 });
      expect(ledger.reservations().find((entry) => entry.id === replacement.id)?.state).toBe("EXPIRED");
    } finally {
      ledger.close();
    }
  });

  it("rejects conflicting leases and recovers stale ownership after restart", () => {
    const file = databasePath();
    const first = new NightwatchLedger(file);
    queue(first, "alpha");
    const reservation = first.reserveMigrationRange({
      family: "test-family",
      project: "project-alpha",
      objectiveId: "objective-alpha",
      count: 1,
      startId: 30,
      ttlMs: 1,
      now: 0,
    });
    const lease = first.acquireLease({
      type: "SOURCE_WRITE",
      scope: "src/nightwatch/**",
      owner: "worker-a",
      ttlMs: 1,
      now: 0,
    });
    expect(() =>
      first.acquireLease({ type: "SOURCE_WRITE", scope: "src/nightwatch/**", owner: "worker-b", ttlMs: 1_000, now: 0 }),
    ).toThrow("LEASE_COLLISION");
    first.close();

    const restarted = new NightwatchLedger(file);
    try {
      expect(restarted.recover({ now: 2 }).expiredLeases).toBe(1);
      expect(restarted.getCandidate("alpha").state).toBe("QUEUE_FRONT");
      expect(restarted.leases().find((entry) => entry.id === lease.id)?.state).toBe("EXPIRED");
      expect(restarted.reservations().find((entry) => entry.id === reservation.id)?.state).toBe("EXPIRED");
      expect(
        restarted.acquireLease({
          type: "SOURCE_WRITE",
          scope: "src/nightwatch/**",
          owner: "worker-b",
          ttlMs: 1_000,
          now: 2,
        }).state,
      ).toBe("ACTIVE");
    } finally {
      restarted.close();
    }
  });
});

describe("Nightwatch projection and persistence safety", () => {
  it("projects real queue, blockers, reservations, and acceptance ownership without private data", () => {
    const ledger = new NightwatchLedger(":memory:");
    try {
      queue(ledger, "alpha");
      const reservation = ledger.reserveMigrationRange({
        family: "test-family",
        project: "project-alpha",
        objectiveId: "objective-alpha",
        count: 1,
        startId: 50,
        ttlMs: 1_000,
      });
      const lease = ledger.acquireIntegrationAcceptance("alpha", "integrator", 1_000);
      const projection = ledger.projection();
      expect(projection.queueFront?.id).toBe("alpha");
      expect(projection.migrationReservations).toContainEqual(
        expect.objectContaining({ id: reservation.id, startId: 50 }),
      );
      expect(projection.acceptanceOwnership).toMatchObject({ id: lease.id, owner: "integrator" });
      expect(JSON.stringify(projection)).not.toMatch(/token|password|credential/i);
    } finally {
      ledger.close();
    }
  });

  it("rejects sensitive input and fails safely for malformed persisted state", () => {
    const ledger = new NightwatchLedger(":memory:");
    try {
      expect(() => ledger.createCandidate({ ...candidateInput("alpha"), token: "not allowed" } as never)).toThrow(
        NightwatchInvariantError,
      );
    } finally {
      ledger.close();
    }

    const file = databasePath();
    const valid = new NightwatchLedger(file);
    valid.close();
    const raw = new DatabaseSync(file);
    raw.exec(`
      INSERT INTO objectives(objective_id, project, increment, created_at) VALUES ('objective', 'project', 'increment', '2026-08-20T00:00:00.000Z');
      INSERT INTO candidates(candidate_id, objective_id, project, increment, branch, product_head_sha, local_base_sha, created_at, state, active)
        VALUES ('broken', 'objective', 'project', 'increment', 'branch', 'head', 'base', '2026-08-20T00:00:00.000Z', 'NOT_A_STATE', 1);
    `);
    raw.close();
    expect(() => new NightwatchLedger(file)).toThrow("MALFORMED_PERSISTED_STATE");
  });
});

describe("Nightwatch Increment A.1 atomic acceptance sequencer", () => {
  const identity = (suffix = "one") => ({
    candidateSha: `candidate-${suffix}`,
    candidateTreeSha: `candidate-tree-${suffix}`,
    baseSha: `base-${suffix}`,
    baseTreeSha: `base-tree-${suffix}`,
    candidateRef: `refs/heads/codex/candidate-${suffix}`,
  });
  const prepare = (ledger: NightwatchLedger, at = "2026-08-21T00:00:00.000Z") => {
    queue(ledger, "atomic");
    const transaction = ledger.beginAtomicAcceptance({
      candidateId: "atomic",
      identity: identity(),
      rootFingerprint: "semantic-root-a",
      at,
    });
    expect(
      ledger.preflightAcceptance(transaction.id, {
        deterministicRegistryHealthy: true,
        ownershipResolved: true,
        identityStable: true,
        leaseAvailable: true,
        at,
      }),
    ).toMatchObject({ result: "PASS" });
    ledger.completeReconciliation(transaction.id, { preservedEvidenceCount: 2, at });
    ledger.freezeAcceptanceCandidate(transaction.id, "integrator", 3_600_000, at);
    ledger.awaitAuthority(transaction.id, at);
    return transaction.id;
  };

  it("keeps missing authority pending, deduplicates authority, then immediately makes binding eligible after RELEASE_GO", () => {
    const ledger = new NightwatchLedger(":memory:");
    try {
      const id = prepare(ledger);
      expect(ledger.getAcceptanceTransaction(id).state).toBe("AWAITING_AUTHORITY");
      expect(() => ledger.dispatchBinding(id, "binding-too-early")).toThrow("BINDING_DISPATCH_NOT_READY");
      const first = ledger.dispatchAuthority(id, "pr-sync-1", "authority-1");
      expect(ledger.dispatchAuthority(id, "pr-sync-duplicate", "authority-duplicate").id).toBe(first.id);
      expect(ledger.acceptanceRuns(id)).toHaveLength(1);
      expect(ledger.recordAuthorityResult(id, first.id, "RELEASE_GO").state).toBe("BINDING_PENDING");
      const binding = ledger.dispatchBinding(id, "release-go-1", "binding-1");
      expect(ledger.dispatchBinding(id, "release-go-duplicate").id).toBe(binding.id);
      expect(ledger.acceptanceRuns(id)).toHaveLength(2);
    } finally {
      ledger.close();
    }
  });

  it("advances BINDING_PASS to merge and persists exact post-merge identity", () => {
    const ledger = new NightwatchLedger(":memory:");
    try {
      const id = prepare(ledger);
      const authority = ledger.dispatchAuthority(id, "authority");
      ledger.recordAuthorityResult(id, authority.id, "RELEASE_GO");
      const binding = ledger.dispatchBinding(id, "binding");
      expect(ledger.recordBindingResult(id, binding.id, "BINDING_PASS").state).toBe("MERGING");
      ledger.recordIntegrated(id);
      const verified = ledger.verifyPostMerge(id, { mergeSha: "merge-one", treeSha: "landed-tree-one" });
      expect(verified).toMatchObject({ state: "POST_MERGE_VERIFIED", candidateSha: "candidate-one", baseSha: "base-one" });
      expect(ledger.getCandidate("atomic").state).toBe("POST_MERGE_VERIFIED");
    } finally {
      ledger.close();
    }
  });

  it("classifies main movement after authority as MERGE_RACE and reuses the candidate/cascade for reconciliation", () => {
    const ledger = new NightwatchLedger(":memory:");
    try {
      const id = prepare(ledger);
      const authority = ledger.dispatchAuthority(id, "authority");
      ledger.recordAuthorityResult(id, authority.id, "RELEASE_GO");
      expect(ledger.recordTransactionMainAdvance(id, "main advanced after authority").state).toBe("MERGE_RACE");
      const next = ledger.beginAtomicAcceptance({ candidateId: "atomic", identity: identity("two"), rootFingerprint: "semantic-root-a" });
      expect(next.cascadeId).toBe(ledger.getAcceptanceTransaction(id).cascadeId);
      expect(ledger.getCandidate("atomic").predecessorId).toBeUndefined();
      expect(ledger.integrationCascades()[0]).toMatchObject({ mainlineRebuilds: 1, authorityAttempts: 1 });
    } finally {
      ledger.close();
    }
  });

  it("survives restart and trips the cumulative cascade breaker without charging product failure", () => {
    const file = databasePath();
    const start = "2026-08-21T00:00:00.000Z";
    const first = new NightwatchLedger(file);
    const id = prepare(first, start);
    const cascadeId = first.getAcceptanceTransaction(id).cascadeId;
    first.recordMaintenanceDescendant(id, { candidateId: "atomic", generation: 1, at: "2026-08-21T00:10:00.000Z" });
    first.close();

    const restarted = new NightwatchLedger(file);
    try {
      expect(restarted.getAcceptanceTransaction(id)).toMatchObject({ state: "AWAITING_AUTHORITY", candidateSha: "candidate-one" });
      const budget = restarted.integrationBudget(cascadeId, Date.parse("2026-08-21T01:31:00.000Z"));
      expect(budget).toMatchObject({ status: "PARKED_BREAKER", maintenanceAmplificationRatio: 1 });
      expect(restarted.getAcceptanceTransaction(id).state).toBe("PARKED_INTEGRATION_BREAKER");
      expect(restarted.getCandidate("atomic").state).toBe("ACCEPTANCE_PENDING");
    } finally {
      restarted.close();
    }
  });
});
