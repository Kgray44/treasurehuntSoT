import { BosunLedger, type AutoZeroActionId, type BosunFinding, type BosunRepairActionId } from "./bosun";
import { NightwatchInvariantError, NightwatchLedger, type CandidateInput, type ExactCandidateIdentity } from "./runtime";

export type BosunAutoZeroRepairInput = {
  parentTransactionId: string;
  blockedCandidateIds: string[];
  finding: BosunFinding;
  generation?: number;
  repairCandidate: CandidateInput;
  identity: ExactCandidateIdentity;
  repairPr: number;
  actionId: AutoZeroActionId;
  outputDigest: string;
  focusedEvidenceRef: string;
  at?: string;
};

export type BosunOwnerRepairInput = Omit<BosunAutoZeroRepairInput, "actionId"> & {
  actionId: "owner-policy-identity-rebaseline";
  ownerAuthorization: string;
};

export type BosunDelegatedRepairInput = Omit<BosunAutoZeroRepairInput, "actionId"> & {
  actionId: "delegated-shared-maintenance";
};

/**
 * The only bridge from a deterministic AUTO_0 result to Nightwatch's live
 * acceptance machine. It deliberately accepts a pre-created PR/identity: Git
 * worktree mutation stays in the executor, while this durable coordinator
 * owns deduplication, parent-budget inheritance, and exact acceptance setup.
 */
export class BosunLiveRepairCoordinator {
  constructor(
    private readonly nightwatch: NightwatchLedger,
    private readonly bosun: BosunLedger,
  ) {}

  attachAutoZeroRepair(input: BosunAutoZeroRepairInput) {
    return this.attachRepair(input, "AUTO_0");
  }

  /**
   * OWNER objectives never start on their own. This bridge requires the exact
   * durable authorization recorded on the objective before it can attach one
   * normal Root Maintenance repair lineage.
   */
  attachOwnerRepair(input: BosunOwnerRepairInput) {
    return this.attachRepair(input, "OWNER", input.ownerAuthorization);
  }

  /** A delegated repair still uses normal Sounding Line acceptance; only the routine owner pause is removed. */
  attachDelegatedRepair(input: BosunDelegatedRepairInput) {
    const repairClass = input.finding.repairClass;
    if (repairClass === "EXTERNAL")
      throw new NightwatchInvariantError("BOSUN_DELEGATED_REPAIR_CLASS_INVALID", repairClass);
    if (repairClass === "AUTO_0")
      throw new NightwatchInvariantError("BOSUN_DELEGATED_REPAIR_CLASS_INVALID", repairClass);
    return this.attachRepair(input, repairClass, undefined, true);
  }

  private attachRepair(
    input: Omit<BosunAutoZeroRepairInput, "actionId"> & { actionId: BosunRepairActionId },
    requiredRepairClass: "AUTO_0" | "AUTO_1" | "AUTO_2" | "OWNER",
    ownerAuthorization?: string,
    delegated = false,
  ) {
    if (!input.blockedCandidateIds.length)
      throw new NightwatchInvariantError("BOSUN_BLOCKED_CANDIDATE_REQUIRED", input.parentTransactionId);
    const closureSteps = [
      `${requiredRepairClass} focused verification`,
      "protected acceptance",
      "post-merge convergence",
    ];
    let cascadeId: string | null = null;
    let objectiveId: string | null = null;
    for (const candidateId of [...new Set(input.blockedCandidateIds)].sort()) {
      const reported = this.bosun.reportFinding({
        finding: input.finding,
        parentTransactionId: input.parentTransactionId,
        blockedCandidateId: candidateId,
        closureSteps,
        at: input.at,
      });
      cascadeId ??= reported.cascade.id;
      if (cascadeId !== reported.cascade.id) throw new NightwatchInvariantError("BOSUN_CASCADE_IDENTITY_MISMATCH", candidateId);
      if (!reported.objective) throw new NightwatchInvariantError("BOSUN_OBJECTIVE_NOT_READY", reported.cascade.id);
      if (reported.objective.repairClass !== requiredRepairClass)
        throw new NightwatchInvariantError("BOSUN_REPAIR_CLASS_MISMATCH", reported.cascade.id);
      objectiveId ??= reported.objective.id;
      if (objectiveId !== reported.objective.id) throw new NightwatchInvariantError("BOSUN_OBJECTIVE_IDENTITY_MISMATCH", candidateId);
    }
    const cascade = cascadeId!;
    const objective = this.bosun.objectiveForCascade(cascade);
    if (!objective || objective.id !== objectiveId) throw new NightwatchInvariantError("BOSUN_OBJECTIVE_IDENTITY_MISMATCH", cascade);
    if (requiredRepairClass === "OWNER" && !delegated) {
      if (!ownerAuthorization) throw new NightwatchInvariantError("BOSUN_OWNER_AUTHORIZATION_REQUIRED", cascade);
      if (objective.state === "OWNER_REQUIRED") this.bosun.authorizeOwnerObjective(cascade, ownerAuthorization, input.at);
      else if (objective.state !== "OBJECTIVE_READY") throw new NightwatchInvariantError("BOSUN_OBJECTIVE_NOT_READY", cascade);
    } else if (objective.state !== "OBJECTIVE_READY") {
      throw new NightwatchInvariantError("BOSUN_OBJECTIVE_NOT_READY", cascade);
    }
    if (delegated) {
      const parent = this.nightwatch.getAcceptanceTransaction(input.parentTransactionId);
      const candidate = this.nightwatch.getCandidate(parent.candidateId);
      const autonomy = this.nightwatch.recordAutonomyAction({
        objectiveId: candidate.objectiveId,
        candidateId: candidate.id,
        rootCause: objective.findingFingerprint,
        actionClass: input.finding.autonomyActionClass ?? "shared-maintenance-repair",
        project: candidate.project,
        inScope: input.finding.autonomyInScope === true,
        reversible: input.finding.autonomyReversible === true,
        sharedMaintenance: true,
        repairCandidateId: input.repairCandidate.id,
        maintenanceDepth: input.generation ?? 0,
        at: input.at,
      });
      if (autonomy.status !== "CONTINUE")
        throw new NightwatchInvariantError("BOSUN_DELEGATED_REPAIR_BUDGET_EXHAUSTED", cascade);
    }
    const repair = this.bosun.createOrReuseRepair(cascade, objectiveId!, input.repairPr, input.at);
    if (!repair.created) throw new NightwatchInvariantError("BOSUN_LIVE_REPAIR_ALREADY_ACTIVE", cascade);
    const maintenance = this.nightwatch.beginBosunMaintenanceAcceptance({
      parentTransactionId: input.parentTransactionId,
      findingFingerprint: repair.cascade.rootFingerprint,
      generation: input.generation ?? 0,
      repairCandidate: input.repairCandidate,
      identity: input.identity,
      focusedEvidence: [input.focusedEvidenceRef],
      at: input.at,
    });
    const live = this.bosun.registerLiveRepair({
      cascadeId: cascade,
      parentTransactionId: input.parentTransactionId,
      transactionId: maintenance.transaction.id,
      candidateId: input.repairCandidate.id,
      repairPr: input.repairPr,
      actionId: input.actionId,
      candidateSha: input.identity.candidateSha,
      baseSha: input.identity.baseSha,
      focusedEvidenceRef: input.focusedEvidenceRef,
      outputDigest: input.outputDigest,
    });
    return { cascade: repair.cascade, maintenance: maintenance.transaction, live, budget: maintenance.budget };
  }
}
