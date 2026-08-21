import { randomUUID } from "node:crypto";
import {
  NightwatchInvariantError,
  NightwatchLedger,
  type AcceptanceTransaction,
  type ExactCandidateIdentity,
} from "./runtime";
import { BosunLedger } from "./bosun";

export type ExternalRunResult = "PENDING" | "RELEASE_GO" | "REJECTED" | "BINDING_PASS" | "BINDING_REJECTED";

export interface NightwatchControlPlane {
  currentIdentity(candidate: {
    id: string;
    branch: string;
    productHeadSha: string;
    localBaseSha: string;
  }): ExactCandidateIdentity;
  preflight(identity: ExactCandidateIdentity): {
    deterministicRegistryHealthy: boolean;
    ownershipResolved: boolean;
    knownMaintenanceBlocker?: string;
    identityStable: boolean;
    leaseAvailable: boolean;
  };
  dispatchAuthority(input: ExactCandidateIdentity & { transactionId: string; dispatchKey: string }): { runId: string };
  dispatchBinding(
    input: ExactCandidateIdentity & { transactionId: string; authorityRunId: string; dispatchKey: string },
  ): { runId: string };
  observeRun(input: { runId: string; stage: "AUTHORITY" | "BINDING" }): ExternalRunResult;
  requestMerge(
    input: ExactCandidateIdentity & { transactionId: string; bindingRunId: string },
  ): { mergeSha: string; treeSha: string } | null;
  protectedMain(): { sha: string; treeSha: string };
  postMergeBosunProof?(input: ExactCandidateIdentity & { transactionId: string; repairCandidateId: string }): {
    evidenceRef: string;
    rootBlockerRemoved: boolean;
  };
  cancelRun?(input: { runId: string }): void;
}

export interface NightwatchControllerOptions {
  instanceId?: string;
  leaseTtlMs?: number;
  now?: () => number;
}

const iso = (value: number) => new Date(value).toISOString();

/**
 * One deterministic controller step. The daemon wrapper may schedule this repeatedly,
 * but every externally visible operation is first recorded in the durable ledger.
 */
export class NightwatchController {
  readonly instanceId: string;
  private readonly leaseTtlMs: number;
  private readonly now: () => number;
  private readonly bosun: BosunLedger;

  constructor(
    private readonly ledger: NightwatchLedger,
    private readonly controlPlane: NightwatchControlPlane,
    options: NightwatchControllerOptions = {},
  ) {
    this.instanceId = options.instanceId ?? `nightwatchd-${randomUUID()}`;
    this.leaseTtlMs = options.leaseTtlMs ?? 120_000;
    this.now = options.now ?? Date.now;
    this.bosun = new BosunLedger(this.ledger.databasePath, this.ledger);
  }

  start() {
    const at = iso(this.now());
    const lease = this.ledger.claimController(this.instanceId, this.leaseTtlMs, at);
    this.bosun.heartbeat(this.instanceId, "Nightwatch-owned Bosun controller started.", at);
    return lease;
  }

  stop(detail?: string) {
    const at = iso(this.now());
    this.bosun.stop(this.instanceId, detail, at);
    this.bosun.close();
    return this.ledger.releaseController(this.instanceId, detail, at);
  }

  bosunProjection(now = this.now()) {
    return this.bosun.projection(now);
  }

  tick() {
    const at = iso(this.now());
    try {
      this.ledger.recover({ now: this.now() });
      const active = this.ledger
        .acceptanceTransactions()
        .find(
          (entry) =>
            ![
              "INTEGRATED",
              "POST_MERGE_VERIFIED",
              "AUTHORITY_REJECTED",
              "BINDING_REJECTED",
              "SHARED_BLOCKED",
              "PARKED_INTEGRATION_BREAKER",
            ].includes(entry.state),
        );
      const result = active ? this.advance(active, at) : this.beginFront(at);
      this.ledger.heartbeatController({ instanceId: this.instanceId, ttlMs: this.leaseTtlMs, reconciled: true, at });
      this.bosun.heartbeat(this.instanceId, null, at);
      return result;
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown controller failure.";
      this.ledger.degradeController(this.instanceId, detail, at);
      throw error;
    }
  }

  private beginFront(at: string) {
    const candidate = this.ledger.currentQueueFront();
    if (!candidate) return { state: "IDLE" as const };
    if (candidate.state !== "QUEUE_FRONT") return { state: "WAITING" as const, candidateId: candidate.id };
    const identity = this.controlPlane.currentIdentity(candidate);
    const transaction = this.ledger.beginAtomicAcceptance({
      candidateId: candidate.id,
      identity,
      rootFingerprint: `${candidate.objectiveId}:${identity.candidateSha}:${identity.baseSha}`,
      rootIdentity: candidate.objectiveId,
      at,
    });
    const preflight = this.ledger.preflightAcceptance(transaction.id, { ...this.controlPlane.preflight(identity), at });
    if (preflight.result === "BLOCKED")
      return { state: "BLOCKED" as const, transactionId: transaction.id, reason: preflight.reason };
    this.ledger.completeReconciliation(transaction.id, { at });
    this.ledger.freezeAcceptanceCandidate(transaction.id, this.instanceId, this.leaseTtlMs, at);
    this.ledger.setRemainingClosureSteps(transaction.id, [
      "authority qualification",
      "protected binding",
      "protected merge",
      "exact-main proof",
    ]);
    this.ledger.awaitAuthority(transaction.id, at);
    return { state: "AWAITING_AUTHORITY" as const, transactionId: transaction.id };
  }

  private advance(transaction: AcceptanceTransaction, at: string) {
    const budget = this.ledger.transactionBudget(transaction.id, Date.parse(at));
    if (budget.status === "PARKED_BREAKER") {
      for (const run of this.ledger.acceptanceRuns(transaction.id))
        if (run.status === "RUNNING" && run.externalRunId) this.controlPlane.cancelRun?.({ runId: run.externalRunId });
      return { state: "PARKED_INTEGRATION_BREAKER" as const, transactionId: transaction.id, budget };
    }
    if (transaction.state === "AWAITING_AUTHORITY") {
      if (budget.status === "CONTROL_PLANE_REVIEW")
        return { state: "INTEGRATION_HARD_REVIEW" as const, transactionId: transaction.id, budget };
      return this.launchAuthority(transaction, at);
    }
    if (transaction.state === "AUTHORITY_RUNNING") {
      const run = transaction.authorityRunId
        ? this.ledger.acceptanceRuns(transaction.id).find((entry) => entry.id === transaction.authorityRunId)
        : null;
      return run?.externalRunId ? this.observeAuthority(transaction, at) : this.launchAuthority(transaction, at);
    }
    if (transaction.state === "BINDING_PENDING") {
      if (budget.status === "CONTROL_PLANE_REVIEW")
        return { state: "INTEGRATION_HARD_REVIEW" as const, transactionId: transaction.id, budget };
      if (!transaction.authorityRunId) throw new NightwatchInvariantError("AUTHORITY_RUN_MISSING", transaction.id);
      const authority = this.ledger
        .acceptanceRuns(transaction.id)
        .find((entry) => entry.id === transaction.authorityRunId);
      if (!authority?.externalRunId)
        throw new NightwatchInvariantError("AUTHORITY_EXTERNAL_RUN_MISSING", transaction.id);
      return this.launchBinding(transaction, authority.externalRunId, at);
    }
    if (transaction.state === "BINDING_RUNNING") {
      const run = transaction.bindingRunId
        ? this.ledger.acceptanceRuns(transaction.id).find((entry) => entry.id === transaction.bindingRunId)
        : null;
      if (run?.externalRunId) return this.observeBinding(transaction, at);
      if (!transaction.authorityRunId) throw new NightwatchInvariantError("AUTHORITY_RUN_MISSING", transaction.id);
      const authority = this.ledger
        .acceptanceRuns(transaction.id)
        .find((entry) => entry.id === transaction.authorityRunId);
      if (!authority?.externalRunId)
        throw new NightwatchInvariantError("AUTHORITY_EXTERNAL_RUN_MISSING", transaction.id);
      return this.launchBinding(transaction, authority.externalRunId, at);
    }
    if (transaction.state === "MERGING") {
      return this.merge(transaction, at);
    }
    return { state: transaction.state, transactionId: transaction.id };
  }

  private launchAuthority(transaction: AcceptanceTransaction, at: string) {
    const intent = this.ledger.dispatchAuthority(
      transaction.id,
      `nightwatch:${transaction.id}:authority`,
      undefined,
      at,
    );
    const run = intent.externalRunId
      ? intent
      : this.ledger.recordAcceptanceRunExternalId(
          transaction.id,
          intent.id,
          this.controlPlane.dispatchAuthority({
            ...transaction,
            transactionId: transaction.id,
            dispatchKey: intent.dispatchKey,
          }).runId,
          at,
        );
    const repair = this.bosun.liveRepairForTransaction(transaction.id);
    if (repair && !intent.externalRunId) this.bosun.recordAuthorityAttempt(repair.cascadeId, at);
    return { state: "AUTHORITY_RUNNING" as const, transactionId: transaction.id, runId: run.externalRunId };
  }

  private launchBinding(transaction: AcceptanceTransaction, authorityRunId: string, at: string) {
    const intent = this.ledger.dispatchBinding(transaction.id, `nightwatch:${transaction.id}:binding`, undefined, at);
    const run = intent.externalRunId
      ? intent
      : this.ledger.recordAcceptanceRunExternalId(
          transaction.id,
          intent.id,
          this.controlPlane.dispatchBinding({
            ...transaction,
            transactionId: transaction.id,
            authorityRunId,
            dispatchKey: intent.dispatchKey,
          }).runId,
          at,
        );
    return { state: "BINDING_RUNNING" as const, transactionId: transaction.id, runId: run.externalRunId };
  }

  private observeAuthority(transaction: AcceptanceTransaction, at: string) {
    if (!transaction.authorityRunId) throw new NightwatchInvariantError("AUTHORITY_RUN_MISSING", transaction.id);
    const run = this.ledger.acceptanceRuns(transaction.id).find((entry) => entry.id === transaction.authorityRunId);
    if (!run?.externalRunId) throw new NightwatchInvariantError("AUTHORITY_EXTERNAL_RUN_MISSING", transaction.id);
    const result = this.controlPlane.observeRun({ runId: run.externalRunId, stage: "AUTHORITY" });
    if (result === "PENDING")
      return { state: "AUTHORITY_RUNNING" as const, transactionId: transaction.id, runId: run.externalRunId };
    if (result !== "RELEASE_GO" && result !== "REJECTED")
      throw new NightwatchInvariantError("AUTHORITY_RESULT_INVALID", result);
    this.ledger.recordAuthorityResult(transaction.id, run.id, result, at);
    if (result === "RELEASE_GO") {
      this.ledger.setRemainingClosureSteps(transaction.id, [
        "protected binding",
        "protected merge",
        "exact-main proof",
      ]);
      // Receipt validation has already placed the transaction in BINDING_PENDING.
      // Dispatch inside the same durable controller step so no arbitrary poll
      // interval separates exact RELEASE_GO from the single binding intent.
      return this.launchBinding(transaction, run.externalRunId, at);
    }
    return {
      state: "AUTHORITY_REJECTED" as const,
      transactionId: transaction.id,
    };
  }

  private observeBinding(transaction: AcceptanceTransaction, at: string) {
    if (!transaction.bindingRunId) throw new NightwatchInvariantError("BINDING_RUN_MISSING", transaction.id);
    const run = this.ledger.acceptanceRuns(transaction.id).find((entry) => entry.id === transaction.bindingRunId);
    if (!run?.externalRunId) throw new NightwatchInvariantError("BINDING_EXTERNAL_RUN_MISSING", transaction.id);
    const result = this.controlPlane.observeRun({ runId: run.externalRunId, stage: "BINDING" });
    if (result === "PENDING")
      return { state: "BINDING_RUNNING" as const, transactionId: transaction.id, runId: run.externalRunId };
    if (result !== "BINDING_PASS" && result !== "BINDING_REJECTED")
      throw new NightwatchInvariantError("BINDING_RESULT_INVALID", result);
    this.ledger.recordBindingResult(transaction.id, run.id, result, at);
    if (result === "BINDING_PASS") {
      this.ledger.setRemainingClosureSteps(transaction.id, ["protected merge", "exact-main proof"]);
      // BINDING_PASS has established the sealed acceptance precondition. Recheck
      // the exact protected base and attempt the controlled merge immediately,
      // rather than intentionally waiting for another daemon tick.
      return this.merge(transaction, at);
    }
    return {
      state: "BINDING_REJECTED" as const,
      transactionId: transaction.id,
    };
  }

  private merge(transaction: AcceptanceTransaction, at: string) {
    if (!transaction.bindingRunId) throw new NightwatchInvariantError("BINDING_RUN_MISSING", transaction.id);
    const binding = this.ledger.acceptanceRuns(transaction.id).find((entry) => entry.id === transaction.bindingRunId);
    if (!binding?.externalRunId) throw new NightwatchInvariantError("BINDING_EXTERNAL_RUN_MISSING", transaction.id);
    const main = this.controlPlane.protectedMain();
    if (main.sha !== transaction.baseSha) {
      this.ledger.recordTransactionMainAdvance(transaction.id, "PROTECTED_MAIN_ADVANCED_BEFORE_MERGE", at);
      return { state: "MERGE_RACE" as const, transactionId: transaction.id };
    }
    const merged = this.controlPlane.requestMerge({
      ...transaction,
      transactionId: transaction.id,
      bindingRunId: binding.externalRunId,
    });
    if (!merged) return { state: "MERGING" as const, transactionId: transaction.id };
    this.ledger.recordIntegrated(transaction.id, at);
    this.ledger.verifyPostMerge(transaction.id, { mergeSha: merged.mergeSha, treeSha: merged.treeSha }, at);
    this.ledger.setRemainingClosureSteps(transaction.id, []);
    const repair = this.bosun.liveRepairForTransaction(transaction.id);
    if (repair) {
      const proof = this.controlPlane.postMergeBosunProof?.({
        ...transaction,
        transactionId: transaction.id,
        repairCandidateId: repair.candidateId,
      });
      if (!proof) throw new NightwatchInvariantError("BOSUN_POST_MERGE_PROOF_UNAVAILABLE", transaction.id);
      this.bosun.completeLiveRepair(
        transaction.id,
        {
          landedMainSha: merged.mergeSha,
          evidenceRef: proof.evidenceRef,
          rootBlockerRemoved: proof.rootBlockerRemoved,
        },
        at,
      );
    }
    return { state: "POST_MERGE_VERIFIED" as const, transactionId: transaction.id };
  }
}
