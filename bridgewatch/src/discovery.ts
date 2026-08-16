export type DiscoveryConfidence = "AUTHORITATIVE" | "CORROBORATED" | "PROVISIONAL" | "AMBIGUOUS" | "UNKNOWN";
export type VersionLifecycle =
  | "DISCOVERED"
  | "PLANNED"
  | "IN_DEVELOPMENT"
  | "CANDIDATE"
  | "ACCEPTED"
  | "MAINLINE"
  | "HISTORICAL"
  | "UNKNOWN";

export interface DiscoveryDocument {
  path: string;
  text: string;
}

export interface DiscoveryBranch {
  name: string;
  headSha?: string | null;
}

export interface DiscoveryPullRequest {
  number: number;
  title: string;
  state: "OPEN" | "MERGED" | "CLOSED" | "UNKNOWN";
  headRef?: string | null;
}

export interface DiscoveryEvidence {
  kind: "GOVERNING_DOCUMENT" | "BRANCH" | "PULL_REQUEST";
  reference: string;
  confidence: DiscoveryConfidence;
}

export interface DiscoveredPhase {
  ordinal: number;
  name: string;
  confidence: DiscoveryConfidence;
  evidence: DiscoveryEvidence[];
}

export interface DiscoveredVersion {
  identity: string;
  lifecycle: VersionLifecycle;
  confidence: DiscoveryConfidence;
  evidence: DiscoveryEvidence[];
}

export interface DiscoveredProject {
  id: string;
  name: string;
  confidence: DiscoveryConfidence;
  phaseCount: number | null;
  phases: DiscoveredPhase[];
  versions: DiscoveredVersion[];
  evidence: DiscoveryEvidence[];
}

export interface DiscoveryResult {
  projects: DiscoveredProject[];
  unclassified: DiscoveryEvidence[];
}

export interface DiscoveryInput {
  observedAt: string;
  knownProjects?: Array<{ id: string; name: string }>;
  documents: DiscoveryDocument[];
  branches: DiscoveryBranch[];
  pullRequests: DiscoveryPullRequest[];
}

const confidenceRank: Record<DiscoveryConfidence, number> = {
  UNKNOWN: 0,
  AMBIGUOUS: 1,
  PROVISIONAL: 2,
  CORROBORATED: 3,
  AUTHORITATIVE: 4,
};

const lifecycleRank: Record<VersionLifecycle, number> = {
  UNKNOWN: 0,
  DISCOVERED: 1,
  PLANNED: 2,
  IN_DEVELOPMENT: 3,
  CANDIDATE: 4,
  ACCEPTED: 5,
  MAINLINE: 6,
  HISTORICAL: 7,
};

const projectId = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "");

const displayName = (id: string) =>
  `Project ${id
    .split("-")
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ")}`;

function projectIdentity(name: string, knownProjects: readonly { id: string; name: string }[] = []) {
  const raw = name
    .replace(/^Project\s+/iu, "")
    .trim()
    .toLowerCase();
  const retained = [...knownProjects]
    .sort((left, right) => right.name.length - left.name.length)
    .find((project) => {
      const canonical = project.name
        .replace(/^Project\s+/iu, "")
        .trim()
        .toLowerCase();
      return raw === canonical || raw.startsWith(`${canonical} `);
    });
  return retained ?? { id: projectId(raw), name };
}

function uniqueEvidence(evidence: readonly DiscoveryEvidence[]): DiscoveryEvidence[] {
  return [...new Map(evidence.map((entry) => [`${entry.kind}:${entry.reference}`, entry])).values()].sort(
    (left, right) => left.kind.localeCompare(right.kind) || left.reference.localeCompare(right.reference),
  );
}

function strongest(...values: DiscoveryConfidence[]): DiscoveryConfidence {
  return values.reduce((best, value) => (confidenceRank[value] > confidenceRank[best] ? value : best), "UNKNOWN");
}

function newestLifecycle(...values: VersionLifecycle[]): VersionLifecycle {
  return values.reduce((best, value) => (lifecycleRank[value] > lifecycleRank[best] ? value : best), "UNKNOWN");
}

function versionFromText(value: string): string | null {
  const match = /\b(v\d+(?:\.\d+)*|R\d+|Version\s+\d+|Amendment\s+v\d+(?:\.\d+)*)\b/iu.exec(value);
  return match?.[1] ?? null;
}

function documentProjectTitle(
  value: string,
): { name: string; version: string | null; phase: DiscoveredPhase | null; allowsPhaseSections: boolean } | null {
  const frontMatter = /^---\s*\r?\n([\s\S]*?)\r?\n---/u.exec(value)?.[1];
  const frontMatterTitle = frontMatter
    ?.split(/\r?\n/u)
    .map((line) => /^title:\s*(.+)$/iu.exec(line)?.[1]?.trim())
    .find(Boolean);
  const headingTitle = value
    .split(/\r?\n/u)
    .map((line) => /^\s*#\s+(.+)$/u.exec(line)?.[1]?.trim())
    .find(Boolean);
  // Only a document's declared title may establish a project identity. Searching
  // arbitrary body text turns catalog prose and receipt references into projects.
  const title = frontMatterTitle ?? headingTitle;
  if (!title) return null;
  if (
    /\b(?:completion\s+receipt|qualification\s+record|final\s+(?:accessibility|performance|visual\s+quality)\s+report)\b/iu.test(
      title,
    )
  )
    return null;
  if (!/^Project\s+[A-Z]/u.test(title) || /\bRevision\b/iu.test(title)) return null;
  const declaredVersion = versionFromText(title);
  const phaseMatch = /\bPhase\s+(\d{1,3})(?:\s*[:—-]\s*([^\r\n]+))?/iu.exec(title);
  if (!declaredVersion && !phaseMatch && !/\bGoverning\s+Document\b/iu.test(title)) return null;
  const match =
    /^Project\s+([A-Za-z][A-Za-z0-9 ]*?)(?=\s+(?:Phase\s+\d+|v\d|R\d|Version\s+\d|Amendment\s+v\d|Governing\s+Document)|\s*(?:—|-|:|$))/u.exec(
      title,
    );
  const rawName = match?.[1];
  if (!rawName) return null;
  return {
    name: `Project ${rawName.trim()}`,
    version: declaredVersion,
    // A phase-specific record has already supplied its one declared phase in
    // the title. Only an explicit version/governing document can safely use
    // its section headings as a phase denominator; other records frequently
    // mention historical phases in prose.
    allowsPhaseSections: Boolean(declaredVersion) || /\bGoverning\s+Document\b/iu.test(title),
    phase: phaseMatch
      ? {
          ordinal: Number(phaseMatch[1]),
          name: phaseMatch[2]?.trim() || `Phase ${phaseMatch[1]}`,
          confidence: "AUTHORITATIVE",
          evidence: [],
        }
      : null,
  };
}

function branchProject(value: string): { id: string; phase: number | null; version: string | null } | null {
  const match = /(?:^|\/)project-([a-z0-9]+(?:-[a-z0-9]+)*?)-(?:phase(\d+)|(v\d+(?:\.\d+)*|r\d+))(?:-|$)/iu.exec(value);
  const id = match?.[1];
  if (!id) return null;
  return { id: id.toLowerCase(), phase: match[2] ? Number(match[2]) : null, version: match[3] ?? null };
}

function titleProject(value: string): { id: string; name: string; version: string | null } | null {
  if (/\bdependency\b/iu.test(value)) return null;
  const match =
    /\bProject\s+([A-Za-z][A-Za-z0-9 ]*?)(?=\s+(?:v\d|R\d|Version\s+\d|Amendment\s+v\d)|\s*(?:—|-|:|$))/u.exec(value);
  const rawName = match?.[1];
  if (!rawName) return null;
  const name = `Project ${rawName.trim()}`;
  return { id: projectId(rawName), name, version: versionFromText(value) };
}

interface MutableProject extends Omit<DiscoveredProject, "phases" | "versions"> {
  phases: Map<number, DiscoveredPhase>;
  versions: Map<string, DiscoveredVersion>;
}

function addProject(
  projects: Map<string, MutableProject>,
  id: string,
  name: string,
  confidence: DiscoveryConfidence,
  evidence: DiscoveryEvidence,
): MutableProject {
  const existing = projects.get(id);
  if (existing) {
    existing.confidence = strongest(existing.confidence, confidence);
    existing.evidence = uniqueEvidence([...existing.evidence, evidence]);
    return existing;
  }
  const project: MutableProject = {
    id,
    name,
    confidence,
    phaseCount: null,
    phases: new Map(),
    versions: new Map(),
    evidence: [evidence],
  };
  projects.set(id, project);
  return project;
}

function addVersion(
  project: MutableProject,
  identity: string,
  lifecycle: VersionLifecycle,
  confidence: DiscoveryConfidence,
  evidence: DiscoveryEvidence,
) {
  const existing = project.versions.get(identity);
  if (existing) {
    existing.confidence = strongest(existing.confidence, confidence);
    existing.lifecycle = newestLifecycle(existing.lifecycle, lifecycle);
    existing.evidence = uniqueEvidence([...existing.evidence, evidence]);
    return;
  }
  project.versions.set(identity, { identity, lifecycle, confidence, evidence: [evidence] });
}

function addPhase(
  project: MutableProject,
  ordinal: number,
  name: string,
  confidence: DiscoveryConfidence,
  evidence: DiscoveryEvidence,
) {
  const existing = project.phases.get(ordinal);
  if (existing) {
    existing.confidence = strongest(existing.confidence, confidence);
    existing.evidence = uniqueEvidence([...existing.evidence, evidence]);
    return;
  }
  project.phases.set(ordinal, { ordinal, name: name.trim() || `Phase ${ordinal}`, confidence, evidence: [evidence] });
}

/**
 * Pure, bounded reconciliation of evidence already collected by Bridgewatch.
 * Filesystem, Git, and GitHub readers are deliberately outside this function.
 */
export function discoverObservations(input: DiscoveryInput): DiscoveryResult {
  const projects = new Map<string, MutableProject>();
  const unclassified: DiscoveryEvidence[] = [];

  for (const document of input.documents) {
    const title = documentProjectTitle(document.text);
    if (!title) continue;
    const identity = projectIdentity(title.name, input.knownProjects);
    const evidence: DiscoveryEvidence = {
      kind: "GOVERNING_DOCUMENT",
      reference: document.path,
      confidence: "AUTHORITATIVE",
    };
    const project = addProject(projects, identity.id, identity.name, "AUTHORITATIVE", evidence);
    if (title.version) addVersion(project, title.version, "PLANNED", "AUTHORITATIVE", evidence);
    if (title.phase) addPhase(project, title.phase.ordinal, title.phase.name, "AUTHORITATIVE", evidence);
    if (title.allowsPhaseSections)
      for (const match of document.text.matchAll(/^\s*#{1,6}\s*Phase\s+(\d{1,3})\s*[:—-]?\s*([^\r\n]*)/gimu))
        addPhase(project, Number(match[1]), match[2] || `Phase ${match[1]}`, "AUTHORITATIVE", evidence);
    project.phaseCount = project.phases.size || null;
  }

  for (const branch of input.branches) {
    const parsed = branchProject(branch.name);
    if (!parsed) {
      unclassified.push({ kind: "BRANCH", reference: branch.name, confidence: "AMBIGUOUS" });
      continue;
    }
    const evidence: DiscoveryEvidence = { kind: "BRANCH", reference: branch.name, confidence: "PROVISIONAL" };
    const identity = projectIdentity(displayName(parsed.id), input.knownProjects);
    const project = addProject(projects, identity.id, identity.name, "PROVISIONAL", evidence);
    if (parsed.phase) addPhase(project, parsed.phase, `Phase ${parsed.phase}`, "PROVISIONAL", evidence);
    if (parsed.version) addVersion(project, parsed.version, "IN_DEVELOPMENT", "PROVISIONAL", evidence);
  }

  for (const pull of input.pullRequests) {
    const parsed =
      titleProject(pull.title) ??
      (pull.headRef
        ? (() => {
            const branch = branchProject(pull.headRef);
            return branch ? { id: branch.id, name: displayName(branch.id), version: branch.version } : null;
          })()
        : null);
    if (!parsed) {
      unclassified.push({ kind: "PULL_REQUEST", reference: `#${pull.number}: ${pull.title}`, confidence: "AMBIGUOUS" });
      continue;
    }
    const evidence: DiscoveryEvidence = {
      kind: "PULL_REQUEST",
      reference: `#${pull.number}`,
      confidence: "CORROBORATED",
    };
    const identity = projectIdentity(parsed.name, input.knownProjects);
    const project = addProject(projects, identity.id, identity.name, "CORROBORATED", evidence);
    if (parsed.version)
      addVersion(
        project,
        parsed.version,
        pull.state === "OPEN" ? "CANDIDATE" : pull.state === "MERGED" ? "MAINLINE" : "HISTORICAL",
        "CORROBORATED",
        evidence,
      );
  }

  return {
    projects: [...projects.values()]
      .map((project) => ({
        ...project,
        phases: [...project.phases.values()].sort((left, right) => left.ordinal - right.ordinal),
        versions: [...project.versions.values()].sort((left, right) => left.identity.localeCompare(right.identity)),
      }))
      .sort((left, right) => left.name.localeCompare(right.name)),
    unclassified: uniqueEvidence(unclassified),
  };
}
