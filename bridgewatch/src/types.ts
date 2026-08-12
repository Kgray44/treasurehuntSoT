export type SourceState = "FRESH" | "STALE" | "DEGRADED" | "UNAVAILABLE" | "UNMEASURED";
export type ProjectState = "ACTIVE" | "BLOCKED" | "MERGED" | "COMPLETE" | "UNKNOWN";
export type AttentionLevel = "NONE" | "NOTICE" | "ACTION" | "BLOCKED";

export interface ProjectDefinition {
  id: string;
  name: string;
  repository: string;
  phase: string;
  state: ProjectState;
  recordPath: string;
  milestone?: { completed: number; total: number; label: string };
}

export interface SourceHealth {
  name: "github" | "registry";
  state: SourceState;
  observedAt: string | null;
  detail: string | null;
}

export interface WorkflowRun {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  url: string;
  updatedAt: string;
}

export interface PullRequest {
  number: number;
  title: string;
  url: string;
  updatedAt: string;
  draft: boolean;
}

export interface GithubSnapshot {
  repository: string;
  defaultBranch: string;
  headSha: string | null;
  openPullRequests: PullRequest[];
  workflows: WorkflowRun[];
  observedAt: string;
}

export interface AttentionItem {
  level: AttentionLevel;
  projectId: string;
  code: string;
  message: string;
}

export interface ProjectView extends ProjectDefinition {
  milestonePercent: number | null;
  milestoneState: "MEASURED" | "UNMEASURED";
  source: SourceHealth;
  github: GithubSnapshot | null;
  attention: AttentionItem[];
}
