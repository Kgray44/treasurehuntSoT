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
const glob = (pattern) =>
  new RegExp(
    `^${String(pattern)
      .replace(/[|\\{}()[\]^$+?.]/gu, "\\$&")
      .replace(/\*\*\//gu, "::DOUBLE_STAR_SLASH::")
      .replace(/\*\*/gu, "::DOUBLE_STAR::")
      .replace(/\*/gu, "[^/]*")
      .replace(/::DOUBLE_STAR_SLASH::/gu, "(?:.*/)?")
      .replace(/::DOUBLE_STAR::/gu, ".*")}$`,
    "u",
  );
const matchesAny = (file, patterns) => (patterns ?? []).some((pattern) => glob(pattern).test(file));
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
const broadOwnershipRoots = new Set([
  "src/**",
  "src/components/**",
  "src/app/**",
  "scripts/**",
  "tests/**",
  "prisma/**",
]);

const same = (left, right) => JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));

function pathIdentity(file) {
  const source = String(file).replaceAll("\\", "/");
  const matchers = [
    [/^Development_Docs\/Features\/catalog\/([^/]+)\.json$/u, "feature-catalog-fragment", "catalog"],
    [/^Development_Docs\/Project_(.+?)_Phase_[0-9]+(?:_|\.)/u, "project-fragment", "documentation"],
    [/^Development_Docs\/(?:Projects|Programs)\/([^/]+)/u, "project-document", "documentation"],
    [/^Development_Docs\/Governing\/Project[_ -]?([^/]+?)\.pdf$/u, "project-document", "documentation"],
    [/^src\/([^/]+)/u, "source-root", "source"],
    [/^tests\/([^/]+)/u, "test-root", "test"],
    // A root-level script filename is not a project root. Only a bounded
    // script directory can supply a path-derived project identity; an exact
    // trusted owner may still attribute a root-level script separately.
    [/^scripts\/([^/]+)\//u, "script-root", "script"],
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

function stronglyProvenProjectIds(candidatePaths = []) {
  const roots = { documentation: new Set(), source: new Set(), test: new Set() };
  for (const candidate of candidatePaths) {
    const source = String(candidate).replaceAll("\\", "/");
    const matchers = [
      [/^Development_Docs\/Projects\/Project_([^/]+)\//u, "documentation"],
      [/^src\/([^/]+)\//u, "source"],
      [/^tests\/([^/]+)\//u, "test"],
    ];
    for (const [expression, kind] of matchers) {
      const match = source.match(expression);
      if (match) roots[kind].add(normalized(match[1]));
    }
  }
  return [...roots.documentation]
    .filter((projectId) => roots.source.has(projectId) && roots.test.has(projectId))
    .sort((left, right) => left.localeCompare(right));
}

export function structurallyAdmitsProjectPath(
  file,
  descriptors = [],
  candidatePaths = [],
  trustedOwners = [],
  trustedProjectDescriptors = [],
) {
  const identity = structuralProjectPath(file);
  const provenProjectIds = stronglyProvenProjectIds(candidatePaths);
  const trustedDescriptorMatches = (trustedProjectDescriptors ?? []).filter(
    (descriptor) =>
      identity?.rootType === "script" &&
      descriptor?.projectId === identity.projectId &&
      matchesAny(file, descriptor?.sourcePaths ?? []) &&
      (candidatePaths ?? []).some((path) => matchesAny(path, descriptor?.testPaths ?? [])),
  );
  // A trusted project declaration can admit only its own declared helper when
  // the candidate also changes its declared test surface. This bridges legacy
  // ownership records without letting a candidate invent project scope.
  if (trustedDescriptorMatches.length === 1) return true;
  const helperOwners = (trustedOwners ?? []).filter((owner) => {
    const ownedProject = normalized(owner?.project ?? owner?.id);
    return (
      matchesAny(file, owner?.helperPaths ?? []) ||
      Boolean(identity?.rootType === "script" && ownedProject && ownedProject === identity.projectId)
    );
  });
  const ownedHelperHasCorrelatedTest =
    helperOwners.length === 1 &&
    (candidatePaths ?? []).some((path) => matchesAny(path, helperOwners[0]?.testPaths ?? []));
  // A project-owned helper can be supplied with its owning project's registered
  // test in the same candidate.  The project declaration is trusted-main data;
  // the candidate cannot broaden the declaration or use it without the
  // correlated test surface.
  if (ownedHelperHasCorrelatedTest) return true;
  if (!identity) {
    const isProjectSupplement =
      file === "README.md" ||
      /^Development_Docs\/Project_[^/]+_Documentation_Migration_Matrix\.csv$/u.test(String(file));
    if (isProjectSupplement) {
      if (descriptors.length === 1) {
        const [descriptor] = descriptors;
        // Root-level project supplements have no reliable path-derived project id.
        // Admit them only when the same candidate proves one non-ambiguous project
        // across source, tests, and project documentation. This can broaden
        // admission, but never changes authority or narrows required evidence.
        if (
          descriptor.state !== "AMBIGUOUS" &&
          descriptor.observedSourceRoots.length &&
          descriptor.observedTestRoots.length &&
          descriptor.observedDocumentationRoots.length
        )
          return true;
      }
      return descriptors.length === 0 && provenProjectIds.length === 1;
    }
    const script = String(file).match(/^scripts\/([^/]+)\//u);
    return Boolean(script && provenProjectIds.includes(normalized(script[1])));
  }
  if (identity.rootType !== "script") return true;
  const descriptor = descriptors.find((entry) => entry.projectId === identity.projectId);
  return Boolean(
    (descriptor &&
      (descriptor.observedSourceRoots.length ||
        descriptor.observedTestRoots.length ||
        descriptor.observedDocumentationRoots.length)) ||
      provenProjectIds.includes(identity.projectId),
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

// A trusted-main registry is intentionally data-driven. A project can only be
// promoted by a record already present on protected main whose bounded evidence
// and source/test relationships resolve against that same tree. Candidate paths
// never enter this function, so they cannot establish ownership for themselves.
export function createTrustedMainProjectDiscoveryRegistry({
  trustedMainSha,
  trustedMainTreeSha,
  trustedTreePaths = [],
  sourceRegistry = {},
  owners = [],
} = {}) {
  const treePaths = new Set((trustedTreePaths ?? []).map((entry) => String(entry).replaceAll("\\", "/")));
  const ownerIds = new Set((owners ?? []).map((entry) => entry?.id).filter(Boolean));
  const errors = [];
  const descriptors = [];
  for (const record of sourceRegistry?.projects ?? []) {
    const id = String(record?.id ?? "");
    const documentationRoot = String(record?.documentationRoot ?? "")
      .replaceAll("\\", "/")
      .replace(/\/$/u, "");
    const evidencePaths = sorted(record?.evidencePaths ?? []);
    const sourcePaths = sorted(record?.sourcePaths ?? []);
    const testPaths = sorted(record?.testPaths ?? []);
    const supportingOwnerIds = sorted(record?.supportingOwnerIds ?? []);
    const recordErrors = [];
    if (!/^project-[a-z0-9-]+$/u.test(id)) recordErrors.push("PROJECT_DISCOVERY_TRUSTED_ID_INVALID");
    if (!documentationRoot.startsWith("Development_Docs/Projects/Project "))
      recordErrors.push("PROJECT_DISCOVERY_DOCUMENTATION_ROOT_INVALID");
    if (!evidencePaths.length || evidencePaths.some((entry) => !treePaths.has(entry)))
      recordErrors.push("PROJECT_DISCOVERY_EVIDENCE_NOT_ON_TRUSTED_MAIN");
    if (!documentationRoot || ![...treePaths].some((entry) => entry.startsWith(`${documentationRoot}/`)))
      recordErrors.push("PROJECT_DISCOVERY_DOCUMENTATION_ROOT_NOT_ON_TRUSTED_MAIN");
    if (!sourcePaths.length || sourcePaths.some((entry) => broadOwnershipRoots.has(entry)))
      recordErrors.push("PROJECT_DISCOVERY_SOURCE_SCOPE_INVALID");
    if (
      [...sourcePaths, ...testPaths].some(
        (entry) => !entry || ![...treePaths].some((treePath) => matchesAny(treePath, [entry])),
      )
    )
      recordErrors.push("PROJECT_DISCOVERY_RELATIONSHIP_NOT_ON_TRUSTED_MAIN");
    if (supportingOwnerIds.some((ownerId) => !ownerIds.has(ownerId)))
      recordErrors.push("PROJECT_DISCOVERY_SUPPORTING_OWNER_UNRESOLVED");
    if (recordErrors.length) {
      errors.push(...recordErrors.map((code) => `${code}:${id || "UNKNOWN"}`));
      continue;
    }
    const unsigned = {
      schemaVersion: PROJECT_DISCOVERY_SCHEMA_VERSION,
      projectId: id,
      id,
      displayName: String(record.displayName ?? id),
      aliases: sorted([id, ...(record.aliases ?? [])]),
      documentationRoot,
      sourcePaths,
      testPaths,
      contractIds: sorted(record.contractIds ?? []),
      supportingOwnerIds,
      evidencePaths,
      state: "TRUSTED_DISCOVERED",
      confidence: "HIGH",
      trustedMainSha: trustedMainSha ?? null,
      trustedMainTreeSha: trustedMainTreeSha ?? null,
      mayBroadenEvidence: true,
      mayNarrowEvidence: true,
    };
    descriptors.push({ ...unsigned, descriptorDigest: digest(unsigned) });
  }
  const unsigned = {
    schemaVersion: PROJECT_DISCOVERY_SCHEMA_VERSION,
    authority: "SOUNDING_LINE_TRUSTED_MAIN_PROJECT_DISCOVERY",
    trustedMainSha: trustedMainSha ?? null,
    trustedMainTreeSha: trustedMainTreeSha ?? null,
    descriptors: descriptors.sort((left, right) => left.id.localeCompare(right.id)),
  };
  return { ...unsigned, registryDigest: digest(unsigned), errors: [...new Set(errors)].sort() };
}

// Static policy needs the same bounded owner identities used by ordinary
// registration admission. This materializes only descriptors from the trusted
// discovery registry; it never consumes candidate paths or candidate discovery
// hints. A hand-maintained ownership entry may coexist only when it is exactly
// equivalent, so the two trusted registries cannot silently diverge.
export function materializeTrustedProjectOwners({ sourceRegistry = {}, owners = [] } = {}) {
  const materialized = [];
  const errors = [];
  const byId = new Map((owners ?? []).map((owner) => [owner?.id, owner]));
  const knownOwnerIds = new Set(
    [
      ...(owners ?? []).map((owner) => owner?.id),
      ...(sourceRegistry?.projects ?? []).map((record) => record?.id),
    ].filter(Boolean),
  );
  for (const record of sourceRegistry?.projects ?? []) {
    const id = String(record?.id ?? "");
    const sourcePaths = sorted(record?.sourcePaths ?? []);
    const testPaths = sorted(record?.testPaths ?? []);
    const contractIds = sorted(record?.contractIds ?? []);
    const supportingOwnerIds = sorted(record?.supportingOwnerIds ?? []);
    if (!/^project-[a-z0-9-]+$/u.test(id)) {
      errors.push(`PROJECT_DISCOVERY_OWNER_ID_INVALID:${id || "UNKNOWN"}`);
      continue;
    }
    if (!sourcePaths.length || sourcePaths.some((entry) => broadOwnershipRoots.has(entry))) {
      errors.push(`PROJECT_DISCOVERY_OWNER_SOURCE_SCOPE_INVALID:${id}`);
      continue;
    }
    if (supportingOwnerIds.some((supportingOwnerId) => !knownOwnerIds.has(supportingOwnerId))) {
      errors.push(`PROJECT_DISCOVERY_OWNER_SUPPORTING_OWNER_UNRESOLVED:${id}`);
      continue;
    }
    const owner = { id, project: id, sourcePaths, testPaths, contractIds };
    const existing = byId.get(id);
    if (existing && !same(existing, owner)) {
      errors.push(`PROJECT_DISCOVERY_OWNER_COLLISION:${id}`);
      continue;
    }
    if (!existing) {
      byId.set(id, owner);
      materialized.push(owner);
    }
  }
  return {
    owners: [...(owners ?? []), ...materialized].sort((left, right) => left.id.localeCompare(right.id)),
    materialized: materialized.sort((left, right) => left.id.localeCompare(right.id)),
    errors: [...new Set(errors)].sort(),
  };
}
export function validateTrustedMainProjectDiscoveryRegistry({ registry, trustedMainSha, trustedMainTreeSha }) {
  const { registryDigest, ...unsigned } = registry ?? {};
  delete unsigned.errors;
  if (!registry || registry.authority !== "SOUNDING_LINE_TRUSTED_MAIN_PROJECT_DISCOVERY")
    return { valid: false, code: "PROJECT_DISCOVERY_TRUSTED_REGISTRY_SCHEMA_INVALID" };
  if (registryDigest !== digest(unsigned))
    return { valid: false, code: "PROJECT_DISCOVERY_TRUSTED_REGISTRY_DIGEST_MISMATCH" };
  if (registry.errors?.length) return { valid: false, code: "PROJECT_DISCOVERY_TRUSTED_REGISTRY_EVIDENCE_INVALID" };
  if (registry.trustedMainSha !== trustedMainSha || registry.trustedMainTreeSha !== trustedMainTreeSha)
    return { valid: false, code: "PROJECT_DISCOVERY_TRUSTED_REGISTRY_STALE" };
  if (!registry.descriptors.every((entry) => entry.state === "TRUSTED_DISCOVERED" && entry.mayNarrowEvidence))
    return { valid: false, code: "PROJECT_DISCOVERY_TRUSTED_REGISTRY_UNTRUSTED_DESCRIPTOR" };
  return { valid: true, code: "PROJECT_DISCOVERY_TRUSTED_REGISTRY_VALID" };
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
