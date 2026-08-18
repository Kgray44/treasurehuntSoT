import type { DiscoveredProject, DiscoveryEvidence, DiscoveryResult } from "./discovery.js";
import type {
  DiscoveryConfidence,
  EvidenceConfidence,
  PhaseRecord,
  ProjectRecord,
  ProjectState,
  ProjectVersionRecord,
  VersionLifecycle,
} from "./domain.js";

const confidenceFor = (confidence: DiscoveryConfidence): EvidenceConfidence =>
  confidence === "AUTHORITATIVE" ? "HIGH" : confidence === "CORROBORATED" ? "MEDIUM" : "LOW";

const projectStateFor = (project: DiscoveredProject, hasRetainedRecord: boolean): ProjectState => {
  const lifecycleRank: Record<VersionLifecycle, number> = {
    UNKNOWN: 0,
    DISCOVERED: 1,
    PLANNED: 2,
    IN_DEVELOPMENT: 3,
    CANDIDATE: 4,
    ACCEPTED: 5,
    MAINLINE: 6,
    HISTORICAL: 7,
    SUPERSEDED: 8,
    ABANDONED: 9,
  };
  const lifecycle = project.versions.reduce<VersionLifecycle>(
    (current, version) => (lifecycleRank[version.lifecycle] > lifecycleRank[current] ? version.lifecycle : current),
    "UNKNOWN",
  );
  if (["CANDIDATE", "IN_DEVELOPMENT", "DISCOVERED"].includes(lifecycle)) return "ACTIVE";
  if (project.phases.some((phase) => phase.confidence === "PROVISIONAL")) return "ACTIVE";
  if (lifecycle === "PLANNED" && !hasRetainedRecord) return "PLANNED";
  return hasRetainedRecord ? "UNKNOWN" : "UNKNOWN";
};

const phaseStateFor = (confidence: DiscoveryConfidence): ProjectState =>
  confidence === "AUTHORITATIVE" ? "PLANNED" : "ACTIVE";

const phaseFromDiscovery = (projectId: string, phase: DiscoveredProject["phases"][number]): PhaseRecord => ({
  id: `${projectId}-p${phase.ordinal}`,
  ordinal: phase.ordinal,
  name: phase.name,
  scope: "Automatically discovered phase; inspect its retained evidence for governing scope.",
  state: phaseStateFor(phase.confidence),
  milestones: [],
  limitations: ["No accepted lifecycle record has been observed for this discovered phase."],
});

const evidenceReferences = (evidence: readonly DiscoveryEvidence[]) => evidence.map((item) => item.reference);

const versionFromDiscovery = (
  projectId: string,
  version: DiscoveredProject["versions"][number],
): ProjectVersionRecord => ({
  id: `${projectId}:${version.identity}`,
  identity: version.identity,
  lifecycle: version.lifecycle,
  confidence: version.confidence,
  evidence: version.evidence,
  governingDocument: version.evidence.find((item) => item.kind === "GOVERNING_DOCUMENT")?.reference,
  firstObservedBranch: version.evidence.find((item) => item.kind === "BRANCH")?.reference,
  firstPullRequest:
    Number(version.evidence.find((item) => item.kind === "PULL_REQUEST")?.reference.replace(/^#/u, "")) || undefined,
});

function mergeProject(retained: ProjectRecord | undefined, discovered: DiscoveredProject): ProjectRecord {
  const retainedPhases = new Map((retained?.phases ?? []).map((phase) => [phase.ordinal, phase]));
  const phases = [...retainedPhases.values()];
  for (const phase of discovered.phases)
    if (!retainedPhases.has(phase.ordinal)) phases.push(phaseFromDiscovery(discovered.id, phase));
  const versions = new Map((retained?.versions ?? []).map((version) => [version.identity, version]));
  for (const version of discovered.versions)
    versions.set(version.identity, versionFromDiscovery(discovered.id, version));
  const inferredState = projectStateFor(discovered, Boolean(retained));
  return {
    id: discovered.id,
    name: retained?.name ?? discovered.name,
    repository: retained?.repository ?? "UNKNOWN",
    state: inferredState === "UNKNOWN" ? (retained?.state ?? "UNKNOWN") : inferredState,
    governingReferences: [
      ...new Set([...(retained?.governingReferences ?? []), ...evidenceReferences(discovered.evidence)]),
    ],
    sourcePaths: [...new Set([...(retained?.sourcePaths ?? []), ...evidenceReferences(discovered.evidence)])],
    confidence: retained?.confidence ?? confidenceFor(discovered.confidence),
    phases: phases.sort((left, right) => left.ordinal - right.ordinal),
    declaredPhaseCount: discovered.phaseCount,
    versions: [...versions.values()].sort((left, right) => left.identity.localeCompare(right.identity)),
    discoveryConfidence: discovered.confidence,
    discoveryEvidence: discovered.evidence,
    missingEvidence:
      retained?.missingEvidence ??
      (discovered.confidence === "AUTHORITATIVE" ? undefined : ["No governing project record has been observed yet."]),
    limitations: retained?.limitations,
    completionReceipt: retained?.completionReceipt,
    finalMainSha: retained?.finalMainSha,
    finalDecision: retained?.finalDecision,
    historicalNames: retained?.historicalNames,
  };
}

/** Merges fresh discovery with retained Phase 1–3 facts without allowing inference to overwrite accepted evidence. */
export function reconcileProjectRecords(
  retainedRecords: readonly ProjectRecord[],
  discovery: DiscoveryResult,
): ProjectRecord[] {
  const retained = new Map(retainedRecords.map((project) => [project.id, project]));
  const reconciled = discovery.projects.map((project) => mergeProject(retained.get(project.id), project));
  for (const project of retainedRecords)
    if (!discovery.projects.some((candidate) => candidate.id === project.id)) reconciled.push(project);
  return reconciled.sort((left, right) => left.name.localeCompare(right.name));
}
