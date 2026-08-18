/* Deterministic, non-authorizing discovery for future product projects. */
import { createHash } from "node:crypto";

export const PROJECT_DISCOVERY_SCHEMA_VERSION = 1;

const digest = (value) =>
  createHash("sha256")
    .update(JSON.stringify(canonical(value)))
    .digest("hex");
const canonical = (value) => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])]),
    );
  return value;
};
const sorted = (values) => [...new Set([...values].filter(Boolean))].sort((left, right) => left.localeCompare(right));
const normalized = (value) =>
  String(value ?? "")
    .replace(/^project[ _-]*/iu, "")
    .replace(/([a-z])([A-Z])/gu, "$1-$2")
    .replace(/[^a-z0-9]+/giu, "-")
    .replace(/^-+|-+$/gu, "")
    .toLowerCase();
const ignoredRoots = new Set([
  "app",
  "components",
  "domain",
  "lib",
  "navigation",
  "platform",
  "private-content",
  "server",
  "styles",
  "types",
  "drydock",
  "homeport",
  "language",
  "tideglass",
  "wakebook",
  "wayfarer",
  "fixtures",
  "e2e",
  "sounding-line",
  "agent-context",
  // Feature generation is a shared validation concern, not a product root.
  // A generated catalog fragment names its own product below; the generator
  // implementation itself must never invent a provisional "features" project.
  "features",
]);
const protectedProjectNames = new Set(["sounding-line", "agent-context"]);
const globalGeneratedPath = (file) =>
  file === "playwright.config.ts" ||
  file.startsWith("scripts/features/") ||
  file === "testing/generated/active-test-registry.json";

function pathIdentity(file) {
  const source = String(file).replaceAll("\\", "/");
  const matchers = [
    [/^Development_Docs\/Features\/catalog\/([^/]+)\.json$/u, "feature-catalog-fragment", "catalog"],
    [/^Development_Docs\/Project_(.+?)_Phase_[0-9]+(?:_|\.)/u, "project-fragment", "documentation"],
    [/^Development_Docs\/(?:Projects|Programs)\/([^/]+)/u, "project-document", "documentation"],
    [/^Development_Docs\/Governing\/Project[_ -]?([^/]+?)\.pdf$/u, "project-document", "documentation"],
    [/^src\/([^/]+)/u, "source-root", "source"],
    [/^tests\/([^/]+)/u, "test-root", "test"],
    [/^scripts\/([^/]+)/u, "script-root", "script"],
    [/^prisma\/(?:migrations\/)?([^/]+)/u, "migration", "migration"],
  ];
  for (const [expression, kind, rootType] of matchers) {
    const match = source.match(expression);
    if (!match) continue;
    const projectId = normalized(match[1]);
    if (
      !projectId ||
      protectedProjectNames.has(projectId) ||
      (ignoredRoots.has(projectId) && rootType !== "catalog" && kind !== "project-fragment")
    )
      continue;
    return { projectId, alias: match[1], kind, rootType, source };
  }
  return null;
}

const glob = (pattern) =>
  new RegExp(
    `^${String(pattern)
      .replace(/[|\\{}()[\]^$+?.]/gu, "\\$&")
      .replaceAll("**", "::DOUBLE_STAR::")
      .replaceAll("*", "[^/]*")
      .replaceAll("::DOUBLE_STAR::", ".*")}$`,
    "u",
  );
const matches = (file, patterns = []) => patterns.some((pattern) => glob(pattern).test(file));
const projectForOwner = (owner) => normalized(owner?.project ?? owner?.id);
const specificity = (pattern) => String(pattern).replaceAll("*", "").length;
const mostSpecificOwnersForPaths = (paths, owners) => {
  const matched = (paths ?? []).flatMap((file) => {
    const matchesByOwner = (owners ?? [])
      .map((owner) => ({
        owner,
        score: Math.max(
          -1,
          ...[...(owner?.sourcePaths ?? []), ...(owner?.testPaths ?? [])]
            .filter((pattern) => glob(pattern).test(file))
            .map(specificity),
        ),
      }))
      .filter((entry) => entry.score >= 0);
    const highest = Math.max(-1, ...matchesByOwner.map((entry) => entry.score));
    return matchesByOwner.filter((entry) => entry.score === highest).map((entry) => entry.owner);
  });
  return [...new Map(matched.map((owner) => [owner.id, owner])).values()];
};

export function structuralProjectPath(file) {
  const identity = pathIdentity(file);
  if (!identity) return null;
  if (identity.rootType === "script") return identity;
  return identity;
}

function descriptorFor({
  projectId,
  candidatePaths,
  trustedPaths,
  trustedMainSha,
  candidateSha,
  suites,
  contracts,
  owners,
  featureCatalog,
}) {
  const evidence = [];
  const roots = { source: [], test: [], script: [], documentation: [], migration: [], catalog: [] };
  const aliases = new Set([projectId]);
  const add = (file, trusted) => {
    const identity = pathIdentity(file);
    if (
      !identity ||
      (identity.projectId !== projectId &&
        !(identity.rootType === "migration" && identity.projectId.startsWith(`${projectId}-`)))
    )
      return;
    aliases.add(normalized(identity.alias));
    const root =
      identity.rootType === "catalog" || identity.kind === "project-fragment"
        ? identity.source
        : identity.source
            .split("/")
            .slice(0, identity.rootType === "documentation" ? 3 : 2)
            .join("/");
    roots[identity.rootType].push(root);
    evidence.push({ kind: identity.kind, source: identity.source, trusted });
  };
  for (const file of trustedPaths) add(file, true);
  for (const file of candidatePaths) add(file, false);
  let uniqueEvidence;
  const names = [projectId, ...aliases];
  const containsName = (value) =>
    names.some((name) =>
      String(value ?? "")
        .toLowerCase()
        .includes(name),
    );
  const ownerHints = (owners ?? []).filter(
    (entry) => projectForOwner(entry) === projectId || containsName(entry.id ?? entry.owner),
  );
  const ownerIds = new Set(ownerHints.map((entry) => entry.id));
  const addOwnerShapeEvidence = (file, trusted) => {
    const matchingOwners = mostSpecificOwnersForPaths([file], owners).filter(
      (owner) => projectForOwner(owner) === projectId && ownerHints.includes(owner),
    );
    if (!matchingOwners.length) return;
    const source = String(file).replaceAll("\\", "/");
    const rootType = source.startsWith("src/")
      ? "source"
      : source.startsWith("tests/")
        ? "test"
        : source.startsWith("scripts/")
          ? "script"
          : source.startsWith("Development_Docs/")
            ? "documentation"
            : null;
    if (!rootType) return;
    const root = rootType === "documentation" ? source : source.split("/").slice(0, 2).join("/");
    roots[rootType].push(root);
    evidence.push({
      kind: "trusted-owner-shape",
      source: `owner:${matchingOwners
        .map((owner) => owner.id)
        .sort()
        .join(",")}:${source}`,
      trusted: trusted && matchingOwners.every((owner) => owner.trusted === true),
    });
  };
  for (const file of trustedPaths) addOwnerShapeEvidence(file, true);
  for (const file of candidatePaths) addOwnerShapeEvidence(file, false);
  uniqueEvidence = Object.values(
    evidence.reduce((byKey, entry) => ({ ...byKey, [`${entry.kind}\0${entry.source}\0${entry.trusted}`]: entry }), {}),
  ).sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  const probableSuiteIds = sorted(
    (suites ?? []).filter((entry) => containsName(entry.id) || ownerIds.has(entry.owner)).map((entry) => entry.id),
  );
  const probableContractIds = sorted(
    (contracts ?? [])
      .filter((entry) => containsName(entry.id) || ownerHints.some((owner) => owner.contractIds?.includes(entry.id)))
      .map((entry) => entry.id),
  );
  const probableAdjacentOwners = sorted(ownerHints.map((entry) => entry.id ?? entry.owner));
  const catalogRecords = (featureCatalog ?? []).filter((entry) =>
    containsName(typeof entry === "string" ? entry : JSON.stringify(entry)),
  );
  const trustedRelationship = uniqueEvidence.some(
    (entry) =>
      entry.trusted && ["source-root", "test-root", "project-document", "project-fragment"].includes(entry.kind),
  );
  const trustedOwners = ownerHints.filter((entry) => entry.trusted === true);
  const trustedOwnerIds = new Set(trustedOwners.map((entry) => entry.id));
  for (const id of probableSuiteIds)
    uniqueEvidence.push({
      kind: "test-registry",
      source: `suite:${id}`,
      trusted: trustedRelationship || (suites ?? []).some((entry) => entry.id === id && entry.trusted === true),
    });
  for (const id of probableContractIds)
    uniqueEvidence.push({
      kind: "contract",
      source: `contract:${id}`,
      trusted: trustedRelationship || (contracts ?? []).some((entry) => entry.id === id && entry.trusted === true),
    });
  for (const id of probableAdjacentOwners)
    uniqueEvidence.push({
      kind: "ownership-neighbor",
      source: `owner:${id}`,
      trusted: trustedRelationship || trustedOwnerIds.has(id),
    });
  for (const entry of catalogRecords)
    uniqueEvidence.push({
      kind: "feature-catalog",
      source: `catalog:${typeof entry === "string" ? entry : (entry.id ?? entry.title ?? entry.name ?? "record")}`,
      trusted: trustedRelationship || entry?.trusted === true,
    });
  uniqueEvidence.sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  const trustedKinds = new Set(uniqueEvidence.filter((entry) => entry.trusted).map((entry) => entry.kind));
  const allKinds = new Set(uniqueEvidence.map((entry) => entry.kind));
  const ambiguityReasons = [];
  if (probableAdjacentOwners.length > 1) ambiguityReasons.push("MULTIPLE_COMPATIBLE_OWNER_HINTS");
  const trusted = trustedKinds.size > 0;
  const confidence = ambiguityReasons.length
    ? "AMBIGUOUS"
    : trustedKinds.size >= 3 || allKinds.size >= 4
      ? "HIGH"
      : trustedKinds.size >= 1 || allKinds.size >= 2
        ? "MEDIUM"
        : "LOW";
  const mayNarrowEvidence = trusted && confidence === "HIGH" && ambiguityReasons.length === 0;
  const state = ambiguityReasons.length
    ? "AMBIGUOUS"
    : mayNarrowEvidence
      ? "TRUSTED_DISCOVERED"
      : "PROVISIONAL_CONSERVATIVE";
  const unsigned = {
    schemaVersion: PROJECT_DISCOVERY_SCHEMA_VERSION,
    projectId,
    displayName: projectId
      .split("-")
      .map((part) => part[0].toUpperCase() + part.slice(1))
      .join(" "),
    aliases: sorted(aliases),
    state,
    confidence,
    observedSourceRoots: sorted(roots.source),
    observedTestRoots: sorted(roots.test),
    observedScriptRoots: sorted(roots.script),
    observedDocumentationRoots: sorted(roots.documentation),
    observedMigrationRoots: sorted(roots.migration),
    observedCatalogRoots: sorted(roots.catalog),
    probableContractIds,
    probableSuiteIds,
    probableAdjacentOwners,
    evidence: uniqueEvidence,
    trustedBaseSha: trustedMainSha ?? null,
    candidateSha: candidateSha ?? null,
    mayBroadenEvidence: true,
    mayNarrowEvidence,
    ambiguityReasons,
  };
  return { ...unsigned, descriptorDigest: digest(unsigned) };
}

export function discoverProjects({
  candidatePaths = [],
  trustedPaths = [],
  trustedMainSha = null,
  candidateSha = null,
  suites = [],
  contracts = [],
  owners = [],
  featureCatalog = [],
} = {}) {
  const candidate = sorted(candidatePaths.map((file) => String(file).replaceAll("\\", "/")));
  const trusted = sorted(trustedPaths.map((file) => String(file).replaceAll("\\", "/")));
  const projectCandidatePaths = candidate.filter((file) => !globalGeneratedPath(file));
  const identities = projectCandidatePaths.map(pathIdentity).filter(Boolean);
  const ownerProjects = mostSpecificOwnersForPaths(projectCandidatePaths, owners)
    // An ownership shell without a contract or executable suite is useful
    // admission metadata, but it is not enough to narrow a test plan.
    .filter((owner) => (owner.contractIds?.length ?? 0) > 0 || (suites ?? []).some((suite) => suite.owner === owner.id))
    .map(projectForOwner)
    .filter(Boolean);
  const ids = sorted(
    identities
      .filter(
        (entry) =>
          !(
            entry.rootType === "migration" &&
            identities.some(
              (other) => other.rootType !== "migration" && entry.projectId.startsWith(`${other.projectId}-`),
            )
          ),
      )
      .map((entry) => entry.projectId)
      .concat(ownerProjects),
  );
  return ids.map((projectId) =>
    descriptorFor({
      projectId,
      candidatePaths: candidate,
      trustedPaths: trusted,
      trustedMainSha,
      candidateSha,
      suites,
      contracts,
      owners,
      featureCatalog,
    }),
  );
}

export function structurallyAdmitsProjectPath(file, descriptors = []) {
  const identity = structuralProjectPath(file);
  if (!identity) return false;
  if (identity.rootType !== "script") return true;
  const descriptor = descriptors.find((entry) => entry.projectId === identity.projectId);
  return Boolean(
    descriptor &&
      (descriptor.observedSourceRoots.length ||
        descriptor.observedTestRoots.length ||
        descriptor.observedDocumentationRoots.length),
  );
}

export function createProjectDiscoveryRegistry({ trustedMainSha, trustedMainTreeSha, descriptors = [] }) {
  const unsigned = {
    schemaVersion: PROJECT_DISCOVERY_SCHEMA_VERSION,
    authority: "SOUNDING_LINE_PROJECT_DISCOVERY_DERIVED",
    trustedMainSha,
    trustedMainTreeSha,
    descriptors: [...descriptors]
      .filter((entry) => entry.state === "TRUSTED_DISCOVERED" && entry.mayNarrowEvidence)
      .sort((left, right) => left.projectId.localeCompare(right.projectId)),
  };
  return { ...unsigned, registryDigest: digest(unsigned) };
}

export function validateProjectDiscoveryRegistry({ registry, trustedMainSha, trustedMainTreeSha }) {
  const { registryDigest, ...unsigned } = registry ?? {};
  if (!registry || registry.schemaVersion !== PROJECT_DISCOVERY_SCHEMA_VERSION)
    return { valid: false, code: "PROJECT_DISCOVERY_REGISTRY_SCHEMA_INVALID" };
  if (registryDigest !== digest(unsigned)) return { valid: false, code: "PROJECT_DISCOVERY_REGISTRY_DIGEST_MISMATCH" };
  if (registry.trustedMainSha !== trustedMainSha || registry.trustedMainTreeSha !== trustedMainTreeSha)
    return { valid: false, code: "PROJECT_DISCOVERY_REGISTRY_STALE" };
  if (!registry.descriptors.every((entry) => entry.mayNarrowEvidence && entry.state === "TRUSTED_DISCOVERED"))
    return { valid: false, code: "PROJECT_DISCOVERY_REGISTRY_UNTRUSTED_DESCRIPTOR" };
  return { valid: true, code: "PROJECT_DISCOVERY_REGISTRY_VALID" };
}

export function projectDiscoverySummary(descriptors = []) {
  return descriptors.map((entry) => ({
    projectId: entry.projectId,
    state: entry.state,
    confidence: entry.confidence,
    candidateTimeAuthority: entry.mayNarrowEvidence ? "MAY_BROADEN_AND_NARROW" : "MAY_BROADEN_MAY_NOT_NARROW",
    evidenceKinds: sorted(entry.evidence.map((evidence) => evidence.kind)),
    fallback: entry.mayNarrowEvidence ? null : "CONSERVATIVE_FALLBACK",
  }));
}
