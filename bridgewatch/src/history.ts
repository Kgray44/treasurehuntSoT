import { createHash } from "node:crypto";
import type { ProjectRecord } from "./domain.js";
import type { SoundingLineProjection } from "./sounding-line.js";
import type { Heartbeat } from "./telemetry.js";

export const eventKinds = [
  "PROJECT_DISCOVERED",
  "PROJECT_STATE_CHANGED",
  "VERSION_DISCOVERED",
  "VERSION_STATE_CHANGED",
  "PHASE_STATE_CHANGED",
  "MILESTONE_STATE_CHANGED",
  "PULL_REQUEST_OPENED",
  "PULL_REQUEST_MERGED",
  "PULL_REQUEST_CLOSED",
  "PULL_REQUEST_CHECK_STATE_CHANGED",
  "WORKER_STARTED",
  "WORKER_FINISHED",
  "WORKER_BLOCKED",
  "WORKER_STALE",
  "SOUNDING_LINE_RUN_STARTED",
  "SOUNDING_LINE_ROOT_FAILURE",
  "SOUNDING_LINE_DECISION",
  "MAIN_ADVANCED",
  "EXTERNAL_GATE_CHANGED",
  "SOURCE_STATE_CHANGED",
  "BRANCH_HEALTH_CHANGED",
  "GOVERNING_DOCUMENT_CHANGED",
] as const;

export type BridgewatchEventKind = (typeof eventKinds)[number];
export type HistorySource = "project-truth" | "github" | "sounding-line" | "reporter" | "bridgewatch";

export interface SafeHistoricalState {
  state?: string | null;
  sha?: string | null;
  checkState?: string | null;
  ahead?: number | null;
  behind?: number | null;
  [key: string]: string | number | boolean | null | undefined;
}

export interface BridgewatchHistoricalEvent {
  id: string;
  kind: BridgewatchEventKind;
  source: HistorySource;
  projectId?: string;
  phaseId?: string;
  entityType: string;
  entityId: string;
  occurredAt: string;
  observedAt: string;
  previous?: SafeHistoricalState;
  current?: SafeHistoricalState;
  summary: string;
  evidenceRefs: string[];
  dedupeKey: string;
}

export interface GithubPullRequestHistory {
  number: number;
  title: string;
  url: string;
  state: "OPEN" | "MERGED" | "CLOSED" | "UNKNOWN";
  draft?: boolean | null;
  author?: string | null;
  updatedAt: string | null;
  createdAt: string | null;
  closedAt?: string | null;
  mergedAt: string | null;
  headRef: string | null;
  headSha: string | null;
  baseRef?: string | null;
  baseSha?: string | null;
  mergeSha?: string | null;
  commitCount?: number | null;
  changedFiles?: number | null;
  additions?: number | null;
  deletions?: number | null;
  checkState: string | null;
  mergeableState: string | null;
}

export interface BranchHealth {
  name: string;
  headSha: string | null;
  defaultSha: string | null;
  ahead: number | null;
  behind: number | null;
  lastActivityAt: string | null;
  pullRequestNumber: number | null;
  pullRequestState: GithubPullRequestHistory["state"] | null;
  compareState: "AVAILABLE" | "UNMEASURED";
}

export interface GithubHistorySnapshot {
  repository: string;
  defaultBranch: string;
  headSha: string | null;
  pullRequests: GithubPullRequestHistory[];
  branches: BranchHealth[];
  observedAt: string;
}

export interface BridgewatchProgramSnapshot {
  schemaVersion: 1;
  capturedAt: string;
  projects: ProjectRecord[];
  github: GithubHistorySnapshot | null;
  workers: Array<Heartbeat & { effectiveState?: string }>;
  soundingLine: SoundingLineProjection | null;
}

export interface DailyRollup {
  day: string;
  eventCounts: Record<string, number>;
  projectIds: string[];
  acceptedPhaseChanges: number;
  completedProjectChanges: number;
  rootFailures: number;
  mainAdvances: number;
  pullRequestChanges: number;
  workerChanges: number;
}

const hash = (value: string) => createHash("sha256").update(value).digest("hex");

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function snapshotDigest(snapshot: BridgewatchProgramSnapshot): string {
  return hash(
    canonical({
      schemaVersion: snapshot.schemaVersion,
      projects: snapshot.projects,
      github: snapshot.github && { ...snapshot.github, observedAt: undefined },
      workers: snapshot.workers.map((worker) => ({
        workerId: worker.workerId,
        project: worker.project,
        phase: worker.phase,
        state: worker.effectiveState ?? worker.state,
        branch: worker.branch,
        sourceSha: worker.sourceSha,
      })),
      soundingLine: snapshot.soundingLine && { ...snapshot.soundingLine, observedAt: undefined },
    }),
  );
}

function safeState(value: Record<string, unknown>): SafeHistoricalState {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item === null || ["string", "number", "boolean"].includes(typeof item)),
  ) as SafeHistoricalState;
}

function transition(
  kind: BridgewatchEventKind,
  source: HistorySource,
  entityType: string,
  entityId: string,
  observedAt: string,
  previous: SafeHistoricalState | undefined,
  current: SafeHistoricalState | undefined,
  summary: string,
  options: { projectId?: string; phaseId?: string; occurredAt?: string; evidenceRefs?: string[] } = {},
): BridgewatchHistoricalEvent {
  const occurredAt = options.occurredAt ?? observedAt;
  const dedupeKey = canonical({ kind, source, entityType, entityId, previous, current, occurredAt });
  return {
    id: hash(dedupeKey),
    kind,
    source,
    projectId: options.projectId,
    phaseId: options.phaseId,
    entityType,
    entityId,
    occurredAt,
    observedAt,
    previous,
    current,
    summary,
    evidenceRefs: options.evidenceRefs ?? [],
    dedupeKey,
  };
}

function projectsById(snapshot: BridgewatchProgramSnapshot) {
  return new Map(snapshot.projects.map((project) => [project.id, project]));
}

function phasesById(project: ProjectRecord) {
  return new Map(project.phases.map((phase) => [phase.id, phase]));
}

function milestonesById(project: ProjectRecord) {
  return new Map(
    project.phases.flatMap((phase) => phase.milestones.map((milestone) => [milestone.id, { milestone, phase }])),
  );
}

function dateOrObserved(value: string | null | undefined, observedAt: string): string {
  return value && !Number.isNaN(Date.parse(value)) ? value : observedAt;
}

export function deriveEvents(
  previous: BridgewatchProgramSnapshot | null,
  current: BridgewatchProgramSnapshot,
): BridgewatchHistoricalEvent[] {
  // An initial snapshot describes what Bridgewatch first observed. It must not
  // invent a chronology for facts that predate this observer.
  if (!previous) return [];
  const observedAt = current.capturedAt;
  const events: BridgewatchHistoricalEvent[] = [];
  const oldProjects = projectsById(previous);
  for (const project of current.projects) {
    const oldProject = oldProjects.get(project.id);
    if (!oldProject) {
      events.push(
        transition(
          "PROJECT_DISCOVERED",
          "project-truth",
          "project",
          project.id,
          observedAt,
          undefined,
          safeState({ state: project.state }),
          `${project.name} was discovered from repository evidence.`,
          {
            projectId: project.id,
            evidenceRefs:
              project.discoveryEvidence?.map((evidence) => evidence.reference) ?? project.governingReferences,
          },
        ),
      );
      continue;
    }
    if (oldProject.state !== project.state)
      events.push(
        transition(
          "PROJECT_STATE_CHANGED",
          "project-truth",
          "project",
          project.id,
          observedAt,
          safeState({ state: oldProject.state }),
          safeState({ state: project.state }),
          `${project.name}: ${oldProject.state} -> ${project.state}`,
          { projectId: project.id, evidenceRefs: project.governingReferences },
        ),
      );
    const oldVersions = new Map((oldProject.versions ?? []).map((version) => [version.identity, version]));
    for (const version of project.versions ?? []) {
      const previousVersion = oldVersions.get(version.identity);
      const evidenceRefs = version.evidence.map((evidence) => evidence.reference);
      if (!previousVersion)
        events.push(
          transition(
            "VERSION_DISCOVERED",
            "project-truth",
            "project-version",
            `${project.id}:${version.identity}`,
            observedAt,
            undefined,
            safeState({ state: version.lifecycle }),
            `${project.name} / ${version.identity} was discovered.`,
            { projectId: project.id, evidenceRefs },
          ),
        );
      else if (previousVersion.lifecycle !== version.lifecycle)
        events.push(
          transition(
            "VERSION_STATE_CHANGED",
            "project-truth",
            "project-version",
            `${project.id}:${version.identity}`,
            observedAt,
            safeState({ state: previousVersion.lifecycle }),
            safeState({ state: version.lifecycle }),
            `${project.name} / ${version.identity}: ${previousVersion.lifecycle} -> ${version.lifecycle}.`,
            { projectId: project.id, evidenceRefs },
          ),
        );
    }
    const oldPhases = phasesById(oldProject);
    const oldMilestones = milestonesById(oldProject);
    for (const phase of project.phases) {
      const oldPhase = oldPhases.get(phase.id);
      if (oldPhase && oldPhase.state !== phase.state)
        events.push(
          transition(
            "PHASE_STATE_CHANGED",
            "project-truth",
            "phase",
            phase.id,
            observedAt,
            safeState({ state: oldPhase.state }),
            safeState({ state: phase.state }),
            `${project.name} / ${phase.name}: ${oldPhase.state} -> ${phase.state}`,
            {
              projectId: project.id,
              phaseId: phase.id,
              occurredAt: dateOrObserved(phase.completedAt ?? phase.mergedAt ?? phase.acceptedAt, observedAt),
              evidenceRefs: [phase.completionReceipt ?? project.governingReferences[0] ?? ""].filter(Boolean),
            },
          ),
        );
      if (oldPhase && canonical(oldPhase.externalPending ?? []) !== canonical(phase.externalPending ?? []))
        events.push(
          transition(
            "EXTERNAL_GATE_CHANGED",
            "project-truth",
            "phase-external-gate",
            phase.id,
            observedAt,
            safeState({ state: (oldPhase.externalPending ?? []).join(",") || null }),
            safeState({ state: (phase.externalPending ?? []).join(",") || null }),
            `${project.name} / ${phase.name}: external-gate state changed.`,
            {
              projectId: project.id,
              phaseId: phase.id,
              evidenceRefs: [phase.completionReceipt ?? project.governingReferences[0] ?? ""].filter(Boolean),
            },
          ),
        );
      for (const milestone of phase.milestones) {
        const old = oldMilestones.get(milestone.id)?.milestone;
        if (old && old.state !== milestone.state)
          events.push(
            transition(
              "MILESTONE_STATE_CHANGED",
              "project-truth",
              "milestone",
              milestone.id,
              observedAt,
              safeState({ state: old.state }),
              safeState({ state: milestone.state }),
              `${project.name} / ${milestone.title}: ${old.state} -> ${milestone.state}`,
              {
                projectId: project.id,
                phaseId: phase.id,
                occurredAt: dateOrObserved(milestone.acceptedAt, observedAt),
                evidenceRefs: milestone.evidence,
              },
            ),
          );
      }
    }
  }

  const oldGithub = previous.github;
  const github = current.github;
  if (Boolean(oldGithub) !== Boolean(github))
    events.push(
      transition(
        "SOURCE_STATE_CHANGED",
        "bridgewatch",
        "source",
        "github",
        observedAt,
        safeState({ state: oldGithub ? "AVAILABLE" : "UNAVAILABLE" }),
        safeState({ state: github ? "AVAILABLE" : "UNAVAILABLE" }),
        `GitHub source became ${github ? "available" : "unavailable"}.`,
      ),
    );
  if (oldGithub && github) {
    if (oldGithub.headSha !== github.headSha && github.headSha)
      events.push(
        transition(
          "MAIN_ADVANCED",
          "github",
          "branch",
          github.defaultBranch,
          observedAt,
          safeState({ sha: oldGithub.headSha }),
          safeState({ sha: github.headSha }),
          `${github.defaultBranch} advanced from ${oldGithub.headSha ?? "UNKNOWN"} to ${github.headSha}`,
          { evidenceRefs: [`github:${github.repository}:branch:${github.defaultBranch}`] },
        ),
      );
    const oldPulls = new Map(oldGithub.pullRequests.map((pull) => [pull.number, pull]));
    for (const pull of github.pullRequests) {
      const old = oldPulls.get(pull.number);
      const evidence = [`github:${github.repository}:pull:${pull.number}`];
      if (!old && pull.state === "OPEN")
        events.push(
          transition(
            "PULL_REQUEST_OPENED",
            "github",
            "pull-request",
            String(pull.number),
            observedAt,
            undefined,
            safeState({ state: pull.state, checkState: pull.checkState }),
            `PR #${pull.number} opened: ${pull.title}`,
            { occurredAt: dateOrObserved(pull.createdAt, observedAt), evidenceRefs: evidence },
          ),
        );
      if (!old && pull.state === "MERGED")
        events.push(
          transition(
            "PULL_REQUEST_MERGED",
            "github",
            "pull-request",
            String(pull.number),
            observedAt,
            undefined,
            safeState({ state: pull.state, checkState: pull.checkState }),
            `PR #${pull.number} was observed merged: ${pull.title}`,
            { occurredAt: dateOrObserved(pull.mergedAt ?? pull.updatedAt, observedAt), evidenceRefs: evidence },
          ),
        );
      if (!old && pull.state === "CLOSED")
        events.push(
          transition(
            "PULL_REQUEST_CLOSED",
            "github",
            "pull-request",
            String(pull.number),
            observedAt,
            undefined,
            safeState({ state: pull.state, checkState: pull.checkState }),
            `PR #${pull.number} was observed closed: ${pull.title}`,
            { occurredAt: dateOrObserved(pull.updatedAt, observedAt), evidenceRefs: evidence },
          ),
        );
      if (old && old.state !== pull.state) {
        const kind = pull.state === "MERGED" ? "PULL_REQUEST_MERGED" : "PULL_REQUEST_CLOSED";
        events.push(
          transition(
            kind,
            "github",
            "pull-request",
            String(pull.number),
            observedAt,
            safeState({ state: old.state }),
            safeState({ state: pull.state }),
            `PR #${pull.number}: ${old.state} -> ${pull.state}`,
            { occurredAt: dateOrObserved(pull.mergedAt ?? pull.updatedAt, observedAt), evidenceRefs: evidence },
          ),
        );
      }
      if (old && (old.checkState !== pull.checkState || old.mergeableState !== pull.mergeableState))
        events.push(
          transition(
            "PULL_REQUEST_CHECK_STATE_CHANGED",
            "github",
            "pull-request",
            String(pull.number),
            observedAt,
            safeState({ checkState: old.checkState, state: old.mergeableState }),
            safeState({ checkState: pull.checkState, state: pull.mergeableState }),
            `PR #${pull.number} check or mergeability state changed.`,
            { occurredAt: dateOrObserved(pull.updatedAt, observedAt), evidenceRefs: evidence },
          ),
        );
      if (old && old.headRef !== pull.headRef)
        events.push(
          transition(
            "SOURCE_STATE_CHANGED",
            "github",
            "pull-request-branch",
            String(pull.number),
            observedAt,
            safeState({ state: old.headRef }),
            safeState({ state: pull.headRef }),
            `PR #${pull.number} branch association changed.`,
            { occurredAt: dateOrObserved(pull.updatedAt, observedAt), evidenceRefs: evidence },
          ),
        );
    }
    const oldBranches = new Map(oldGithub.branches.map((branch) => [branch.name, branch]));
    for (const branch of github.branches) {
      const old = oldBranches.get(branch.name);
      if (
        old &&
        (old.ahead !== branch.ahead || old.behind !== branch.behind || old.compareState !== branch.compareState)
      )
        events.push(
          transition(
            "BRANCH_HEALTH_CHANGED",
            "github",
            "branch",
            branch.name,
            observedAt,
            safeState({ ahead: old.ahead, behind: old.behind, state: old.compareState }),
            safeState({ ahead: branch.ahead, behind: branch.behind, state: branch.compareState }),
            `${branch.name} divergence changed.`,
            {
              occurredAt: dateOrObserved(branch.lastActivityAt, observedAt),
              evidenceRefs: [`github:${github.repository}:branch:${branch.name}`],
            },
          ),
        );
    }
  }

  const oldWorkers = new Map(previous.workers.map((worker) => [worker.workerId, worker]));
  for (const worker of current.workers) {
    const old = oldWorkers.get(worker.workerId);
    const oldState = old?.effectiveState ?? old?.state;
    const nextState = worker.effectiveState ?? worker.state;
    if (!old)
      events.push(
        transition(
          "WORKER_STARTED",
          "reporter",
          "worker",
          worker.workerId,
          observedAt,
          undefined,
          safeState({ state: nextState }),
          `${worker.workerId} was first observed.`,
          { projectId: worker.project, phaseId: `${worker.project}-p${worker.phase}`, occurredAt: worker.startedAt },
        ),
      );
    else if (oldState !== nextState) {
      const kind =
        nextState === "FINISHED" ? "WORKER_FINISHED" : nextState === "BLOCKED" ? "WORKER_BLOCKED" : "WORKER_STALE";
      events.push(
        transition(
          kind,
          "reporter",
          "worker",
          worker.workerId,
          observedAt,
          safeState({ state: oldState }),
          safeState({ state: nextState }),
          `${worker.workerId}: ${oldState} -> ${nextState}`,
          { projectId: worker.project, phaseId: `${worker.project}-p${worker.phase}`, occurredAt: worker.heartbeatAt },
        ),
      );
    }
  }

  const oldPlans = new Map((previous.soundingLine?.plans ?? []).map((plan) => [plan.id, plan]));
  if (Boolean(previous.soundingLine) !== Boolean(current.soundingLine))
    events.push(
      transition(
        "SOURCE_STATE_CHANGED",
        "bridgewatch",
        "source",
        "sounding-line",
        observedAt,
        safeState({ state: previous.soundingLine ? "AVAILABLE" : "UNAVAILABLE" }),
        safeState({ state: current.soundingLine ? "AVAILABLE" : "UNAVAILABLE" }),
        `Sounding Line source became ${current.soundingLine ? "available" : "unavailable"}.`,
      ),
    );
  for (const plan of current.soundingLine?.plans ?? []) {
    const old = oldPlans.get(plan.id);
    if (!old)
      events.push(
        transition(
          "SOUNDING_LINE_RUN_STARTED",
          "sounding-line",
          "sounding-line-run",
          plan.id,
          observedAt,
          undefined,
          safeState({ state: plan.state }),
          `Sounding Line ${plan.gate} run ${plan.id} was observed.`,
          { occurredAt: dateOrObserved(plan.createdAt, observedAt), evidenceRefs: [`sounding-line:${plan.id}`] },
        ),
      );
    if (old && old.finalDecision !== plan.finalDecision && plan.finalDecision)
      events.push(
        transition(
          "SOUNDING_LINE_DECISION",
          "sounding-line",
          "sounding-line-run",
          plan.id,
          observedAt,
          safeState({ state: old.finalDecision }),
          safeState({ state: plan.finalDecision }),
          `Sounding Line ${plan.id} decided ${plan.finalDecision}.`,
          { evidenceRefs: [`sounding-line:${plan.id}`] },
        ),
      );
    const oldRoots = new Set(
      (old?.nodes ?? []).filter((node) => node.state === "FAILED").map((node) => node.rootFailureId ?? node.id),
    );
    for (const node of plan.nodes.filter((candidate) => candidate.state === "FAILED")) {
      const root = node.rootFailureId ?? node.id;
      if (!oldRoots.has(root))
        events.push(
          transition(
            "SOUNDING_LINE_ROOT_FAILURE",
            "sounding-line",
            "sounding-line-root-failure",
            root,
            observedAt,
            undefined,
            safeState({ state: node.state }),
            `Sounding Line root failure ${root} appeared in ${plan.id}.`,
            {
              occurredAt: dateOrObserved(node.completedAt ?? node.startedAt, observedAt),
              evidenceRefs: [`sounding-line:${plan.id}`],
            },
          ),
        );
    }
  }
  return events;
}

export function rollupForDay(day: string, events: readonly BridgewatchHistoricalEvent[]): DailyRollup {
  const eventCounts: Record<string, number> = {};
  const projectIds = new Set<string>();
  for (const event of events) {
    eventCounts[event.kind] = (eventCounts[event.kind] ?? 0) + 1;
    if (event.projectId) projectIds.add(event.projectId);
  }
  return {
    day,
    eventCounts,
    projectIds: [...projectIds].sort(),
    acceptedPhaseChanges: events.filter(
      (event) => event.kind === "PHASE_STATE_CHANGED" && ["MERGED", "COMPLETE"].includes(String(event.current?.state)),
    ).length,
    completedProjectChanges: events.filter(
      (event) => event.kind === "PROJECT_STATE_CHANGED" && event.current?.state === "COMPLETE",
    ).length,
    rootFailures: eventCounts.SOUNDING_LINE_ROOT_FAILURE ?? 0,
    mainAdvances: eventCounts.MAIN_ADVANCED ?? 0,
    pullRequestChanges: events.filter((event) => event.kind.startsWith("PULL_REQUEST_")).length,
    workerChanges: events.filter((event) => event.kind.startsWith("WORKER_")).length,
  };
}
