export type ProjectState =
  | "PLANNED"
  | "ACTIVE"
  | "TESTING"
  | "REVIEW"
  | "WAITING"
  | "BLOCKED"
  | "STALE"
  | "EXTERNAL_PENDING"
  | "MERGED"
  | "COMPLETE"
  | "UNKNOWN";

export type PhaseState = ProjectState;
export type MilestoneState = "PLANNED" | "IN_PROGRESS" | "ACCEPTED" | "BLOCKED" | "UNKNOWN";
export type EvidenceConfidence = "HIGH" | "MEDIUM" | "LOW";
export type DiscoveryConfidence = "AUTHORITATIVE" | "CORROBORATED" | "PROVISIONAL" | "AMBIGUOUS" | "UNKNOWN";
export type VersionLifecycle =
  | "DISCOVERED"
  | "PLANNED"
  | "IN_DEVELOPMENT"
  | "CANDIDATE"
  | "ACCEPTED"
  | "MAINLINE"
  | "SUPERSEDED"
  | "HISTORICAL"
  | "ABANDONED"
  | "UNKNOWN";

export interface DiscoveryEvidenceRecord {
  kind: "GOVERNING_DOCUMENT" | "BRANCH" | "PULL_REQUEST";
  reference: string;
  confidence: DiscoveryConfidence;
}

export interface ProjectVersionRecord {
  id: string;
  identity: string;
  lifecycle: VersionLifecycle;
  confidence: DiscoveryConfidence;
  evidence: DiscoveryEvidenceRecord[];
  formalTitle?: string;
  purpose?: string;
  governingDocument?: string;
  firstObservedBranch?: string;
  firstPullRequest?: number;
  acceptedSha?: string;
  integratedMainSha?: string;
}

export interface MilestoneRecord {
  id: string;
  title: string;
  weight: number;
  state: MilestoneState;
  evidence: string[];
  acceptedAt?: string;
}

/**
 * A task is a retained unit of observed work, not a command or assignment.
 * Telemetry may supply it through a worker heartbeat; absent telemetry remains
 * explicitly unmeasured rather than inferred from a phase state.
 */
export interface TaskRecord {
  id: string;
  title: string;
  projectId: string;
  phaseId: string;
  workerId?: string;
  branch?: string;
  startedAt?: string;
  heartbeatAt?: string;
  finishedAt?: string;
  result?: string;
  sourceSha?: string;
  evidence: string[];
}

export interface PhaseRecord {
  id: string;
  ordinal: number;
  name: string;
  scope: string;
  state: PhaseState;
  milestones: MilestoneRecord[];
  plannedAt?: string;
  startedAt?: string;
  acceptedAt?: string;
  mergedAt?: string;
  completedAt?: string;
  branch?: string;
  pullRequest?: number;
  acceptedHeadSha?: string;
  integratedMainSha?: string;
  finalDecision?: string;
  completionReceipt?: string;
  limitations?: string[];
  externalPending?: string[];
  /** Prior governed names retained when a source explicitly renames this phase. */
  historicalNames?: string[];
}

export interface ProjectRecord {
  id: string;
  name: string;
  repository: string;
  state: ProjectState;
  governingReferences: string[];
  sourcePaths: string[];
  confidence: EvidenceConfidence;
  phases: PhaseRecord[];
  /** Governing phase denominator when one is explicitly observed; otherwise null. */
  declaredPhaseCount?: number | null;
  /** First-class project versions are observational and never aliases for phases. */
  versions?: ProjectVersionRecord[];
  discoveryConfidence?: DiscoveryConfidence;
  discoveryEvidence?: DiscoveryEvidenceRecord[];
  missingEvidence?: string[];
  limitations?: string[];
  completionReceipt?: string;
  finalMainSha?: string;
  finalDecision?: string;
  /** Prior governed names retained when a source explicitly renames this project. */
  historicalNames?: string[];
}

export interface ProgressView {
  state: "MEASURED" | "UNMEASURED";
  percent: number | null;
  completedWeight: number | null;
  totalWeight: number | null;
}

export function measureMilestones(
  milestones: readonly MilestoneRecord[],
  confidence: EvidenceConfidence,
): ProgressView {
  if (confidence === "LOW" || !milestones.length)
    return { state: "UNMEASURED", percent: null, completedWeight: null, totalWeight: null };
  const totalWeight = milestones.reduce((total, milestone) => total + milestone.weight, 0);
  if (!Number.isFinite(totalWeight) || totalWeight <= 0 || milestones.some((milestone) => milestone.weight <= 0))
    return { state: "UNMEASURED", percent: null, completedWeight: null, totalWeight: null };
  const completedWeight = milestones
    .filter((milestone) => milestone.state === "ACCEPTED")
    .reduce((total, milestone) => total + milestone.weight, 0);
  return {
    state: "MEASURED",
    percent: Math.round((completedWeight / totalWeight) * 100),
    completedWeight,
    totalWeight,
  };
}

export function projectProgress(project: ProjectRecord): ProgressView {
  return measureMilestones(
    project.phases.flatMap((phase) => phase.milestones),
    project.confidence,
  );
}

export function phaseProgress(phase: PhaseRecord, confidence: EvidenceConfidence): ProgressView {
  return measureMilestones(phase.milestones, confidence);
}
