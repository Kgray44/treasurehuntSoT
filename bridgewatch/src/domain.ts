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

export interface MilestoneRecord {
  id: string;
  title: string;
  weight: number;
  state: MilestoneState;
  evidence: string[];
  acceptedAt?: string;
}

export interface PhaseRecord {
  id: string;
  ordinal: number;
  name: string;
  scope: string;
  state: PhaseState;
  milestones: MilestoneRecord[];
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
  missingEvidence?: string[];
  limitations?: string[];
  completionReceipt?: string;
  finalMainSha?: string;
  finalDecision?: string;
}

export interface ProgressView {
  state: "MEASURED" | "UNMEASURED";
  percent: number | null;
  completedWeight: number | null;
  totalWeight: number | null;
}

export function measureMilestones(milestones: readonly MilestoneRecord[], confidence: EvidenceConfidence): ProgressView {
  if (confidence === "LOW" || !milestones.length) return { state: "UNMEASURED", percent: null, completedWeight: null, totalWeight: null };
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
  return measureMilestones(project.phases.flatMap((phase) => phase.milestones), project.confidence);
}

export function phaseProgress(phase: PhaseRecord, confidence: EvidenceConfidence): ProgressView {
  return measureMilestones(phase.milestones, confidence);
}
