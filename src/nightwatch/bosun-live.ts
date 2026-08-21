import { BosunLedger, type AutoZeroActionId, type BosunFinding } from "./bosun";
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
    if (!input.blockedCandidateIds.length)
      throw new NightwatchInvariantError("BOSUN_BLOCKED_CANDIDATE_REQUIRED", input.parentTransactionId);
    const closureSteps = ["AUTO_0 focused verification", "protected acceptance", "post-merge convergence"];
    let cascadeId: string | null = null;
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
    }
    const cascade = cascadeId!;
    const repair = this.bosun.createOrReuseRepair(cascade, input.repairCandidate.id, input.repairPr, input.at);
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
