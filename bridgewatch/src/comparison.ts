import type { BridgewatchHistoricalEvent, DailyRollup } from "./history.js";

export type ComparisonFidelity = "EXACT" | "ROLLUP" | "COARSE" | "UNAVAILABLE";

export interface ProgramComparison {
  from: string;
  to: string;
  fidelity: ComparisonFidelity;
  events: BridgewatchHistoricalEvent[];
  changed: {
    projectsDiscovered: string[];
    projectsCompleted: string[];
    versionsDiscovered: string[];
    versionsStarted: string[];
    versionsAccepted: string[];
    phasesStarted: string[];
    phasesAccepted: string[];
    phasesMerged: string[];
    pullRequestsOpened: string[];
    pullRequestsMerged: string[];
    pullRequestsClosed: string[];
    branchesChanged: string[];
    soundingLineRuns: string[];
    rootFailures: string[];
    governingDocuments: string[];
    mainAdvances: number;
  };
  rollups?: DailyRollup[];
  coarse?: {
    changedProjectIds: string[];
    eventCounts: Record<string, number>;
    acceptedPhaseChanges: number;
    completedProjectChanges: number;
    rootFailures: number;
    mainAdvances: number;
    pullRequestChanges: number;
    workerChanges: number;
  };
}

const unique = (values: string[]) => [...new Set(values)].sort();

export function summarizeRollups(rollups: readonly DailyRollup[]): NonNullable<ProgramComparison["coarse"]> {
  const eventCounts: Record<string, number> = {};
  for (const rollup of rollups)
    for (const [kind, count] of Object.entries(rollup.eventCounts))
      eventCounts[kind] = (eventCounts[kind] ?? 0) + count;
  return {
    changedProjectIds: unique(rollups.flatMap((rollup) => rollup.projectIds)),
    eventCounts,
    acceptedPhaseChanges: rollups.reduce((total, rollup) => total + rollup.acceptedPhaseChanges, 0),
    completedProjectChanges: rollups.reduce((total, rollup) => total + rollup.completedProjectChanges, 0),
    rootFailures: rollups.reduce((total, rollup) => total + rollup.rootFailures, 0),
    mainAdvances: rollups.reduce((total, rollup) => total + rollup.mainAdvances, 0),
    pullRequestChanges: rollups.reduce((total, rollup) => total + rollup.pullRequestChanges, 0),
    workerChanges: rollups.reduce((total, rollup) => total + rollup.workerChanges, 0),
  };
}

/** Compares only events inside the supplied window; the caller states whether the source is exact or rolled up. */
export function compareProgramHistory(
  events: readonly BridgewatchHistoricalEvent[],
  from: string,
  to: string,
  fidelity: ComparisonFidelity = "EXACT",
): ProgramComparison {
  const fromMs = Date.parse(from);
  const toMs = Date.parse(to);
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || fromMs > toMs) throw new Error("Invalid comparison window");
  const selected = events
    .filter((event) => {
      const at = Date.parse(event.observedAt);
      return Number.isFinite(at) && at >= fromMs && at <= toMs;
    })
    .sort((left, right) => left.observedAt.localeCompare(right.observedAt) || left.id.localeCompare(right.id));
  const ids = (kind: BridgewatchHistoricalEvent["kind"]) =>
    unique(selected.filter((event) => event.kind === kind).map((event) => event.entityId));
  const phases = (state: string) =>
    unique(
      selected
        .filter((event) => event.kind === "PHASE_STATE_CHANGED" && event.current?.state === state)
        .map((event) => event.entityId),
    );
  const versions = (state: string) =>
    unique(
      selected
        .filter((event) => event.kind === "VERSION_STATE_CHANGED" && event.current?.state === state)
        .map((event) => event.entityId),
    );
  return {
    from: new Date(fromMs).toISOString(),
    to: new Date(toMs).toISOString(),
    fidelity,
    events: selected,
    changed: {
      projectsDiscovered: ids("PROJECT_DISCOVERED"),
      projectsCompleted: unique(
        selected
          .filter((event) => event.kind === "PROJECT_STATE_CHANGED" && event.current?.state === "COMPLETE")
          .map((event) => event.entityId),
      ),
      versionsDiscovered: ids("VERSION_DISCOVERED"),
      versionsStarted: versions("IN_DEVELOPMENT"),
      versionsAccepted: versions("ACCEPTED"),
      phasesStarted: phases("ACTIVE"),
      phasesAccepted: phases("ACCEPTED"),
      phasesMerged: phases("MERGED"),
      pullRequestsOpened: ids("PULL_REQUEST_OPENED"),
      pullRequestsMerged: ids("PULL_REQUEST_MERGED"),
      pullRequestsClosed: ids("PULL_REQUEST_CLOSED"),
      branchesChanged: ids("BRANCH_HEALTH_CHANGED"),
      soundingLineRuns: ids("SOUNDING_LINE_RUN_STARTED"),
      rootFailures: ids("SOUNDING_LINE_ROOT_FAILURE"),
      governingDocuments: ids("GOVERNING_DOCUMENT_CHANGED"),
      mainAdvances: selected.filter((event) => event.kind === "MAIN_ADVANCED").length,
    },
  };
}
