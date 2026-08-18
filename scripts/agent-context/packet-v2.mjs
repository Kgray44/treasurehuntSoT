import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { createLogbook } from "./logbook.mjs";

export const PACKET_SCHEMA_VERSION = "2.0";
export const GENERATOR_VERSION = "project-trim-mscp-2.0.0";
export const CONFIDENCE_LEVELS = ["EXACT", "BOUNDED", "COARSE", "UNKNOWN"];
export const STALENESS_STATES = ["FRESH", "PARTIALLY_STALE", "STALE", "CONFLICTED", "UNKNOWN"];

const SECRET_KEY =
  /(?:^|[_-])(secret|password|passwd|token|credential|cookie|authorization|private[_-]?key)(?:$|[_-])/i;
const SECRET_VALUE =
  /(?:gh[pousr]_[A-Za-z0-9]{30,}|AKIA[0-9A-Z]{16}|Bearer\s+[A-Za-z0-9._~+\/-]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/;
const unique = (values) => [
  ...new Set(values.filter((value) => value !== null && value !== undefined && value !== "")),
];
const posix = (value) => String(value).replaceAll("\\", "/");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const gitQueryCache = new Map();

export function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])]),
    );
  return value;
}

export const canonicalJson = (value) => JSON.stringify(canonicalize(value));

function sanitize(value, key = "") {
  if (SECRET_KEY.test(key)) return "[REDACTED]";
  if (Array.isArray(value)) return value.map((item) => sanitize(item));
  if (value && typeof value === "object")
    return Object.fromEntries(Object.entries(value).map(([itemKey, item]) => [itemKey, sanitize(item, itemKey)]));
  if (typeof value === "string" && SECRET_VALUE.test(value)) return "[REDACTED]";
  return value;
}

function git(root, args, fallback = null) {
  const cacheable = true;
  const key = `${path.resolve(root)}\0${args.join("\0")}`;
  if (cacheable && gitQueryCache.has(key)) return gitQueryCache.get(key);
  try {
    const result = execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      maxBuffer: 16 * 1024 * 1024,
    }).trim();
    if (cacheable) gitQueryCache.set(key, result);
    return result;
  } catch {
    return fallback;
  }
}

function gitFresh(root, args, fallback = null) {
  try {
    return execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      maxBuffer: 16 * 1024 * 1024,
    }).trim();
  } catch {
    return fallback;
  }
}

function readJson(root, relativePath, fallback = {}) {
  try {
    return JSON.parse(readFileSync(path.join(root, relativePath), "utf8"));
  } catch {
    return fallback;
  }
}

function globMatches(pattern, candidate) {
  const normalizedPattern = posix(pattern);
  const normalizedCandidate = posix(candidate);
  const escape = (value) => value.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
  const expression = `^${normalizedPattern
    .split("**")
    .map((part) => part.split("*").map(escape).join("[^/]*"))
    .join(".*")}$`;
  return new RegExp(expression).test(normalizedCandidate);
}

function sourceIdentity(root) {
  const [headSha = null, headTreeSha = null] = (git(root, ["show", "-s", "--format=%H%x09%T", "HEAD"], "") || "").split(
    "\t",
  );
  const [originMainSha = null, originMainTreeSha = null] = (
    gitFresh(root, ["show", "-s", "--format=%H%x09%T", "origin/main"], "") || ""
  ).split("\t");
  const branch = git(root, ["symbolic-ref", "--quiet", "--short", "HEAD"]);
  const porcelain = git(root, ["status", "--porcelain=v1"], "").split(/\r?\n/u).filter(Boolean);
  return {
    originMainSha,
    originMainTreeSha,
    baseSha: originMainSha ?? headSha,
    headSha,
    headTreeSha,
    branch,
    worktree: posix(path.resolve(root)),
    dirtyState: {
      dirty: porcelain.length > 0,
      changedPathCount: porcelain.length,
      paths: porcelain.slice(0, 50).map((entry) => posix(entry.slice(3))),
      truncated: porcelain.length > 50,
    },
  };
}

function fileIdentity(root, relativePath) {
  const normalized = posix(relativePath);
  const absolute = path.join(root, normalized);
  if (!existsSync(absolute))
    return {
      path: normalized,
      exists: false,
      gitBlobSha: null,
      acceptedBlobSha: null,
      sha256: null,
      sizeBytes: null,
      identityKind: "MISSING",
    };
  const content = readFileSync(absolute);
  const gitBlobSha = createHash("sha1")
    .update(Buffer.concat([Buffer.from(`blob ${content.length}\0`), content]))
    .digest("hex");
  return {
    path: normalized,
    exists: true,
    gitBlobSha,
    acceptedBlobSha: null,
    sha256: sha256(content),
    sizeBytes: statSync(absolute).size,
    identityKind: gitBlobSha ? "GIT_BLOB_AND_SHA256" : "SHA256",
  };
}

function descriptorIdentity(root, descriptor) {
  const identity = fileIdentity(root, descriptor.path);
  return { ...identity, version: descriptor.version ?? null };
}

function binding(root, section, sourcePaths, sectionValue, extra = {}) {
  const sources = unique(sourcePaths)
    .sort()
    .map((entry) => fileIdentity(root, entry));
  return {
    section,
    sources,
    sourceDigest: sha256(canonicalJson(sources)),
    contentDigest: sha256(canonicalJson(sectionValue)),
    ...extra,
  };
}

function classify(input) {
  if (input.taskClass) return input.taskClass;
  const text = `${input.id ?? ""} ${input.objective ?? ""}`.toLowerCase();
  if (/release|closure|finali[sz]e/u.test(text)) return "release-closure";
  if (/integrat|reconcile|merge/u.test(text)) return "integration";
  if (/security|privacy|auth/u.test(text)) return "security-sensitive";
  if (/doc|record|index/u.test(text)) return "documentation-only";
  if (/infra|workflow|runtime|deploy/u.test(text)) return "infrastructure";
  if (/fix|bug|repair|regression/u.test(text)) return "bug-repair";
  return "product-phase";
}

function loadRegistries(root) {
  return {
    ownership: readJson(root, "testing/ownership.json", { owners: [] }),
    contracts: readJson(root, "testing/contracts.json", { contracts: [] }),
    impact: readJson(root, "testing/impact-map.json", { pathMappings: [], contractMappings: [] }),
    suites: readJson(root, "testing/suites.json", { suites: [] }),
    resources: readJson(root, "testing/resources.json", { resources: [] }),
    debt: readJson(root, "testing/validation-debt.json", { entries: [] }),
    authority: readJson(root, "testing/sounding-line-authority.json", {}),
    documents: readJson(root, "Development_Docs/document-index.json", { records: [] }),
    packageManifest: readJson(root, "package.json", {}),
  };
}

function registryClosure(registries, requestedPaths) {
  const paths = unique(requestedPaths.map(posix));
  const mappings = paths.flatMap((candidate) =>
    (registries.impact.pathMappings ?? [])
      .filter((entry) => globMatches(entry.path, candidate))
      .map((entry) => ({
        candidate,
        mappingPath: entry.path,
        suiteIds: entry.suiteIds ?? [],
        contractIds: entry.contractIds ?? [],
      })),
  );
  const ownerSpecificity = (pattern) => posix(pattern).replaceAll("*", "").length;
  const selectedOwnerIds = new Set();
  for (const candidate of paths) {
    const matches = (registries.ownership.owners ?? []).flatMap((owner) =>
      (owner.sourcePaths ?? [])
        .filter((pattern) => globMatches(pattern, candidate))
        .map((pattern) => ({ owner, specificity: ownerSpecificity(pattern) })),
    );
    const maximum = Math.max(-1, ...matches.map((entry) => entry.specificity));
    for (const match of matches.filter((entry) => entry.specificity === maximum)) selectedOwnerIds.add(match.owner.id);
  }
  const owners = (registries.ownership.owners ?? []).filter((owner) => selectedOwnerIds.has(owner.id));
  const unmappedPaths = paths.filter(
    (candidate) =>
      !mappings.some((entry) => entry.candidate === candidate) &&
      !owners.some((owner) => (owner.sourcePaths ?? []).some((pattern) => globMatches(pattern, candidate))),
  );
  const contractIds = unique([
    ...owners.flatMap((owner) => owner.contractIds ?? []),
    ...mappings.flatMap((entry) => entry.contractIds),
  ]);
  const contractSuiteIds = (registries.impact.contractMappings ?? [])
    .filter((entry) => contractIds.includes(entry.contractId))
    .flatMap((entry) => entry.suiteIds ?? []);
  const requiredSentinels =
    registries.authority?.ordinaryCandidateQualification?.minimumSufficientEvidence?.requiredSafetySentinelSuiteIds ??
    [];
  const suiteIds = unique([...mappings.flatMap((entry) => entry.suiteIds), ...contractSuiteIds, ...requiredSentinels]);
  const contracts = (registries.contracts.contracts ?? []).filter((entry) => contractIds.includes(entry.id));
  const suites = (registries.suites.suites ?? []).filter((entry) => suiteIds.includes(entry.id));
  const resourceIds = unique(suites.flatMap((entry) => entry.resources ?? []));
  const resources = (registries.resources.resources ?? []).filter((entry) => resourceIds.includes(entry.id));
  return {
    paths,
    mappings,
    owners,
    unmappedPaths,
    contractIds,
    suiteIds,
    contracts,
    suites,
    resources,
    requiredSentinels,
  };
}

function authoritySlices(root, input, registries, taskClass) {
  const trimTask =
    /project\s*trim/i.test(input.project ?? "") ||
    (input.paths ?? []).some((entry) => /agent-context|Project_Trim/u.test(entry));
  const defaults = [
    {
      path: "AGENTS.md",
      version: null,
      sections: ["Repository Instructions"],
      ownershipDomain: "repository-workflow",
      summary: "Bootstrap current testing and Project Trim context workflows; derived packets never replace authority.",
      relevanceReason: "Permanent repository task bootstrap.",
      precedence: "CURRENT_REPOSITORY_INSTRUCTION",
      exactTextRequired: false,
    },
    {
      path: ".agents/context-workflow.md",
      version: "Phase 1 current",
      sections: ["Bootstrap and truth", "Expansion and recording", "Execution profiles"],
      ownershipDomain: "project-trim",
      summary:
        "Use minimum sufficient context, expand autonomously under uncertainty, and preserve the no-context-prison rule.",
      relevanceReason: "Controls packet use and context expansion.",
      precedence: "CURRENT_PROJECT_TRIM_WORKFLOW",
      exactTextRequired: false,
    },
    {
      path: ".agents/testing-workflow.md",
      version: "current",
      sections: ["Development verification", "Candidate qualification", "Authoritative acceptance"],
      ownershipDomain: "sounding-line",
      summary:
        "Separate focused development verification from frozen-candidate qualification and authoritative acceptance.",
      relevanceReason: "Controls verification lifecycle for engineering tasks.",
      precedence: "CURRENT_TESTING_WORKFLOW",
      exactTextRequired: taskClass === "release-closure",
    },
    {
      path: "testing/sounding-line-authority.json",
      version: registries.authority.currentAuthorityVersion ?? null,
      sections: ["ordinaryCandidateQualification", "developmentValidation", "protectedMergeBinding"],
      ownershipDomain: "sounding-line",
      summary: "Sounding Line exclusively controls verification selection, RELEASE_GO, and protected merge binding.",
      relevanceReason: "Supplies current verification and release authority.",
      precedence: "CURRENT_MACHINE_READABLE_SOUNDING_LINE_AUTHORITY",
      exactTextRequired: taskClass === "release-closure",
    },
  ];
  if (trimTask)
    defaults.push({
      path: "Development_Docs/Governing/Project_Trim_Codex_Context_and_Inference_Efficiency_Governing_Document_v1.0-R1.pdf",
      version: "1.0-R1",
      sections: ["6", "12", "13", "14", "15", "16", "24", "25", "27", "28.3"],
      ownershipDomain: "project-trim",
      summary:
        "Phase 2 hardens the MSCP with source-bound authority/source/schema/test/delta slices, confidence, staleness, deterministic JSON/Markdown, benchmarks, and conservative fallback.",
      relevanceReason: "Primary governing baseline for Project Trim Phase 2.",
      precedence: "CURRENT_GOVERNING_BASELINE",
      exactTextRequired: true,
    });
  const requested = [...defaults, ...(input.authorities ?? [])];
  const deduped = requested.filter(
    (entry, index) => requested.findIndex((candidate) => posix(candidate.path) === posix(entry.path)) === index,
  );
  const excluded = [];
  const slices = deduped
    .filter((descriptor) => {
      const record = (registries.documents.records ?? []).find((entry) => posix(entry.path) === posix(descriptor.path));
      const superseded = descriptor.superseded === true || record?.status === "superseded";
      if (superseded) excluded.push({ path: posix(descriptor.path), reason: "SUPERSEDED_AUTHORITY_EXCLUDED" });
      return !superseded;
    })
    .map((descriptor) => ({
      path: posix(descriptor.path),
      version: descriptor.version ?? null,
      sourceIdentity: descriptorIdentity(root, descriptor),
      requirementIds: descriptor.requirementIds ?? descriptor.sections ?? [],
      sections: descriptor.sections ?? [],
      ownershipDomain: descriptor.ownershipDomain ?? "UNKNOWN",
      normativeSummary:
        descriptor.summary ??
        "Exact authority pointer supplied; load source text before relying on unspecified wording.",
      relevanceReason: descriptor.relevanceReason ?? "Explicit task authority input.",
      precedence: descriptor.precedence ?? "EXPLICIT_TASK_AUTHORITY",
      exactTextRequired: Boolean(descriptor.exactTextRequired),
      confidence:
        descriptor.summary && (descriptor.sections?.length || descriptor.requirementIds?.length) ? "EXACT" : "COARSE",
      stalenessTriggers: ["SOURCE_DIGEST_CHANGED", "VERSION_CHANGED", "PRECEDENCE_CHANGED", "CONFLICT_DETECTED"],
      conflict: Boolean(descriptor.conflict),
    }));
  const conflicts = [
    ...(input.authorityConflict
      ? [{ reason: "EXPLICIT_AUTHORITY_CONFLICT", paths: slices.map((entry) => entry.path) }]
      : []),
    ...slices
      .filter((entry) => entry.conflict)
      .map((entry) => ({ reason: "AUTHORITY_DESCRIPTOR_CONFLICT", paths: [entry.path] })),
  ];
  return {
    slices,
    excluded,
    conflicts,
    confidence: conflicts.length
      ? "UNKNOWN"
      : slices.every((entry) => entry.confidence === "EXACT")
        ? "EXACT"
        : "BOUNDED",
  };
}

function sourceSlice(root, input, closure) {
  const selected = unique([...(input.paths ?? []), ...(input.additionalPointers ?? [])]).map(posix);
  const requestedSet = new Set((input.paths ?? []).map(posix));
  const entries = selected.map((selectedPath) => {
    const impactMappings = closure.mappings.filter((entry) => entry.candidate === selectedPath);
    const owners = closure.owners
      .filter((owner) => (owner.sourcePaths ?? []).some((pattern) => globMatches(pattern, selectedPath)))
      .map((owner) => owner.id);
    const identity = fileIdentity(root, selectedPath);
    const mapped = impactMappings.length > 0 || owners.length > 0;
    return {
      path: selectedPath,
      symbols: input.symbols?.[selectedPath] ?? [],
      sourceIdentity: identity,
      mappingProvenance: [
        ...(requestedSet.has(selectedPath)
          ? [{ source: "TASK_CONTRACT", reason: "Explicit implementation path" }]
          : []),
        ...impactMappings.map((entry) => ({ source: "testing/impact-map.json", mapping: entry.mappingPath })),
        ...owners.map((owner) => ({ source: "testing/ownership.json", owner })),
        ...(!requestedSet.has(selectedPath)
          ? [{ source: "TASK_ADDITIONAL_POINTER", reason: "Explicit supporting source" }]
          : []),
      ],
      confidence: identity.exists && mapped ? "EXACT" : identity.exists ? "BOUNDED" : mapped ? "COARSE" : "UNKNOWN",
      stalenessTriggers: [
        "GIT_BLOB_CHANGED",
        "OWNERSHIP_MAPPING_CHANGED",
        "IMPACT_MAPPING_CHANGED",
        "INTERSECTING_MAINLINE_DELTA",
      ],
    };
  });
  return {
    entries,
    unmappedPaths: closure.unmappedPaths,
    confidence: closure.unmappedPaths.length
      ? "UNKNOWN"
      : entries.every((entry) => entry.confidence === "EXACT")
        ? "EXACT"
        : "BOUNDED",
  };
}

function extractImports(root, entries) {
  const imports = [];
  for (const entry of entries) {
    if (!entry.sourceIdentity.exists || !/\.(?:[cm]?[jt]sx?)$/u.test(entry.path)) continue;
    const text = readFileSync(path.join(root, entry.path), "utf8");
    const matcher = /(?:from\s+|import\s*\(|require\s*\()\s*["']([^"']+)["']/gu;
    for (const match of text.matchAll(matcher))
      if (!match[1].startsWith(".") && !match[1].startsWith("node:")) imports.push(match[1]);
  }
  return unique(imports).sort();
}

function packageName(specifier) {
  if (specifier.startsWith("@")) return specifier.split("/").slice(0, 2).join("/");
  return specifier.split("/")[0];
}

function schemaSlice(root, input, sourceEntries) {
  const pointerPaths = unique([
    ...(input.schemaPointers ?? []),
    ...(input.paths ?? []).filter((entry) =>
      /(?:^|\/)(?:prisma|migrations?|fixtures?|providers?)(?:\/|$)/iu.test(posix(entry)),
    ),
  ]).map(posix);
  const requestedModels = new Set(input.schemaModels ?? []);
  for (const entry of sourceEntries) {
    if (!entry.sourceIdentity.exists || !/\.(?:[cm]?[jt]sx?)$/u.test(entry.path)) continue;
    const text = readFileSync(path.join(root, entry.path), "utf8");
    for (const match of text.matchAll(/\bprisma\.([A-Za-z][A-Za-z0-9_]*)/gu)) requestedModels.add(match[1]);
  }
  const models = [];
  for (const pointerPath of pointerPaths.filter((entry) => /schema(?:\.sqlite)?\.prisma$/u.test(entry))) {
    const absolute = path.join(root, pointerPath);
    if (!existsSync(absolute)) continue;
    const text = readFileSync(absolute, "utf8");
    for (const match of text.matchAll(/\bmodel\s+([A-Za-z][A-Za-z0-9_]*)\s*\{/gu)) {
      if (
        requestedModels.size &&
        [...requestedModels].some((candidate) => candidate.toLowerCase() === match[1].toLowerCase())
      )
        models.push({
          name: match[1],
          source: pointerPath,
          selectionProvenance: requestedModels.size ? "SOURCE_USAGE_OR_TASK_INPUT" : "SCHEMA_POINTER_CLOSURE",
        });
    }
  }
  const migrations = pointerPaths.filter((entry) => /(?:^|\/)migrations?(?:\/|$)/u.test(entry));
  return {
    applicability: pointerPaths.length ? "APPLICABLE" : "NOT_APPLICABLE_FROM_CURRENT_MAPPING",
    sources: pointerPaths.map((entry) => ({ path: entry, sourceIdentity: fileIdentity(root, entry) })),
    models,
    migrations,
    storageProviders: input.storageProviders ?? [],
    selectionProvenance: pointerPaths.length
      ? ["TASK_SCHEMA_POINTERS", "PATH_CLASSIFICATION", "BOUNDED_SOURCE_USAGE_SCAN"]
      : [],
    confidence: pointerPaths.length
      ? pointerPaths.every((entry) => existsSync(path.join(root, entry)))
        ? "BOUNDED"
        : "COARSE"
      : "UNKNOWN",
    stalenessTriggers: ["SCHEMA_DIGEST_CHANGED", "MIGRATION_DIGEST_CHANGED", "PROVIDER_OWNERSHIP_CHANGED"],
  };
}

function verificationSlice(closure, registries) {
  const riskFloor = closure.contracts.some((entry) => entry.critical)
    ? "CRITICAL_CONTRACT_FLOOR"
    : "MAPPED_CONTRACT_FLOOR";
  return {
    authority: {
      source: "testing/sounding-line-authority.json",
      version: registries.authority.currentAuthorityVersion ?? null,
      releaseAuthority: "SOUNDING_LINE_ONLY",
    },
    contracts: closure.contracts.map(({ id, name, authority, owners, critical }) => ({
      id,
      name,
      authority,
      owners,
      critical,
    })),
    suites: closure.suites.map(
      ({ id, owner, contracts, resources, releaseGates, affectedPaths, currentImplementationState }) => ({
        id,
        owner,
        contracts: contracts ?? [],
        resources: resources ?? [],
        releaseGates: releaseGates ?? [],
        affectedPaths: affectedPaths ?? [],
        currentImplementationState: currentImplementationState ?? null,
        selectionProvenance: closure.requiredSentinels.includes(id)
          ? "REQUIRED_SAFETY_SENTINEL"
          : "IMPACT_OR_CONTRACT_MAPPING",
      }),
    ),
    resources: closure.resources,
    requiredSentinels: closure.requiredSentinels,
    riskFloor,
    mappingProvenance: [
      "testing/impact-map.json",
      "testing/contracts.json",
      "testing/suites.json",
      "testing/resources.json",
      "testing/sounding-line-authority.json",
    ],
    confidence: closure.unmappedPaths.length ? "COARSE" : closure.suites.length ? "EXACT" : "UNKNOWN",
    stalenessTriggers: [
      "SOUNDING_LINE_AUTHORITY_CHANGED",
      "SUITE_REGISTRY_CHANGED",
      "CONTRACT_MAPPING_CHANGED",
      "RESOURCE_REGISTRY_CHANGED",
    ],
  };
}

function dependencySlice(root, sourceEntries, closure, registries) {
  const importSpecifiers = extractImports(root, sourceEntries);
  const packageNames = unique(importSpecifiers.map(packageName));
  const manifestDependencies = {
    ...(registries.packageManifest.dependencies ?? {}),
    ...(registries.packageManifest.devDependencies ?? {}),
  };
  const packages = packageNames.map((name) => ({
    name,
    declaredVersion: manifestDependencies[name] ?? null,
    importSpecifiers: importSpecifiers.filter((entry) => packageName(entry) === name),
  }));
  const manifestPaths = ["package.json", "package-lock.json"].filter((entry) => existsSync(path.join(root, entry)));
  return {
    manifests: manifestPaths.map((entry) => ({ path: entry, sourceIdentity: fileIdentity(root, entry) })),
    packages,
    suiteDependencies: unique(closure.suites.flatMap((entry) => entry.dependencies ?? [])),
    resourceDependencies: closure.resources.map((entry) => ({
      id: entry.id,
      capacity: entry.capacity,
      exclusive: entry.exclusive,
    })),
    selectionProvenance: [
      "BOUNDED_SOURCE_IMPORT_SCAN",
      "package.json",
      "testing/suites.json",
      "testing/resources.json",
    ],
    confidence: packages.every((entry) => entry.declaredVersion) ? "BOUNDED" : packages.length ? "COARSE" : "BOUNDED",
    stalenessTriggers: [
      "PACKAGE_MANIFEST_CHANGED",
      "LOCKFILE_CHANGED",
      "SOURCE_IMPORT_CHANGED",
      "SUITE_DEPENDENCY_CHANGED",
    ],
  };
}

function changedPaths(root, baseSha, currentSha) {
  if (!baseSha || !currentSha || baseSha === currentSha) return [];
  return git(root, ["diff", "--name-only", `${baseSha}..${currentSha}`], "")
    .split(/\r?\n/u)
    .filter(Boolean)
    .map(posix)
    .sort();
}

function deltaCategory(changedPath) {
  if (
    /^(?:AGENTS\.md|\.agents\/|Development_Docs\/Governing\/|testing\/sounding-line-authority\.json)/u.test(changedPath)
  )
    return "authority";
  if (/^(?:prisma\/|.*migrations?\/)/u.test(changedPath)) return "schema-data";
  if (/^(?:package(?:-lock)?\.json|pnpm-lock\.yaml|yarn\.lock)/u.test(changedPath)) return "dependencies";
  if (/^(?:testing\/|tests\/|.*\.test\.|.*\.spec\.)/u.test(changedPath)) return "contracts-tests";
  if (/^(?:Development_Docs\/|docs\/|CHANGELOG\.md)/u.test(changedPath)) return "documentation";
  if (/^(?:src\/|scripts\/|bridgewatch\/)/u.test(changedPath)) return "source";
  return "other";
}

function mainDelta(root, input, sourceEntries, authorities, registries) {
  const [currentMainSha = null, currentMainTreeSha = null] = (
    gitFresh(root, ["show", "-s", "--format=%H%x09%T", "origin/main"], "") || ""
  ).split("\t");
  const baseSha = input.deltaBaseSha ?? currentMainSha;
  const baseTreeSha = baseSha ? git(root, ["show", "-s", "--format=%T", baseSha]) : null;
  const paths = changedPaths(root, baseSha, currentMainSha);
  const grouped = Object.fromEntries(
    ["authority", "schema-data", "dependencies", "contracts-tests", "documentation", "source", "other"].map((key) => [
      key,
      [],
    ]),
  );
  for (const changedPath of paths) grouped[deltaCategory(changedPath)].push(changedPath);
  const selectedPaths = sourceEntries.map((entry) => entry.path);
  const authorityPaths = authorities.map((entry) => entry.path);
  const mappings = registryClosure(registries, paths);
  const ownerGroups = Object.fromEntries(
    (registries.ownership.owners ?? [])
      .map((owner) => [
        owner.id,
        paths.filter((candidate) => (owner.sourcePaths ?? []).some((pattern) => globMatches(pattern, candidate))),
      ])
      .filter(([, entries]) => entries.length),
  );
  return {
    baseSha,
    baseTreeSha,
    currentMainSha,
    currentMainTreeSha,
    changedPathCount: paths.length,
    changedPaths: paths,
    grouped,
    groupedByOwner: ownerGroups,
    authorityChanges: paths.filter((entry) => authorityPaths.includes(entry) || deltaCategory(entry) === "authority"),
    schemaMigrationChanges: grouped["schema-data"],
    dependencyChanges: grouped.dependencies,
    contractTestChanges: grouped["contracts-tests"],
    selectedSourceIntersections: paths.filter((entry) =>
      selectedPaths.some(
        (selected) => entry === selected || globMatches(selected, entry) || globMatches(entry, selected),
      ),
    ),
    acceptedAssumptionIntersections: paths.filter((entry) =>
      (input.assumptionPaths ?? []).some(
        (assumption) => globMatches(assumption, entry) || globMatches(entry, assumption),
      ),
    ),
    unmappedChangedPaths: mappings.unmappedPaths,
    selectionProvenance:
      "git diff --name-only <base>..<current origin/main> composed with current ownership and impact registries",
    confidence: baseSha && currentMainSha ? (mappings.unmappedPaths.length ? "COARSE" : "EXACT") : "UNKNOWN",
    stalenessTriggers: [
      "ORIGIN_MAIN_MOVED",
      "SELECTED_SOURCE_INTERSECTION",
      "AUTHORITY_CHANGE",
      "SCHEMA_OR_DEPENDENCY_CHANGE",
      "UNMAPPED_CHANGE",
    ],
  };
}

function ownershipSlice(closure) {
  const producerIds = closure.owners.map((entry) => entry.id);
  const adjacent = unique(
    closure.contracts.flatMap((entry) => entry.owners ?? []).filter((entry) => !producerIds.includes(entry)),
  );
  return {
    canonicalProducers: closure.owners.map(({ id, project, sourcePaths, testPaths, contractIds }) => ({
      id,
      project,
      sourcePaths,
      testPaths,
      contractIds,
    })),
    consumers: adjacent,
    adjacentProjectSeams: closure.contracts
      .filter((entry) => (entry.owners ?? []).length > 1)
      .map((entry) => ({ contractId: entry.id, owners: entry.owners })),
    authorityOwners: unique(closure.contracts.map((entry) => entry.authority)),
    mappingProvenance: ["testing/ownership.json", "testing/contracts.json", "testing/impact-map.json"],
    confidence: closure.unmappedPaths.length ? "COARSE" : closure.owners.length ? "EXACT" : "UNKNOWN",
  };
}

function priorPlateau(root, input) {
  const discoveredPath =
    input.acceptedCapsulePath ??
    (input.project === "Project Trim" && /^Phase 3(?:\b|\s)/u.test(input.increment ?? "")
      ? ".agents/handoffs/project-trim-phase-2.accepted.json"
      : null);
  if (discoveredPath && existsSync(path.join(root, discoveredPath))) {
    const capsule = readJson(root, discoveredPath, null);
    if (capsule?.state === "ACCEPTED" && capsule.acceptedMainSha && capsule.acceptedTreeSha)
      return {
        status: "ACCEPTED_CAPSULE_BOUND",
        pointer: fileIdentity(root, discoveredPath),
        acceptedMainSha: capsule.acceptedMainSha,
        acceptedTreeSha: capsule.acceptedTreeSha,
        capsuleDigest: capsule.integrity?.semanticDigest ?? null,
        currentLimitations: capsule.knownLimitations ?? [],
        confidence: "EXACT",
      };
    return {
      status: "CAPSULE_INVALID_REQUIRES_EXACT_REVIEW",
      pointer: fileIdentity(root, discoveredPath),
      acceptedMainSha: null,
      currentLimitations: ["Accepted capsule is missing an accepted main/tree identity."],
      confidence: "UNKNOWN",
    };
  }
  if (!input.priorAcceptedStatusPath)
    return {
      status: "NOT_SUPPLIED",
      pointer: null,
      acceptedMainSha: input.deltaBaseSha ?? null,
      currentLimitations: input.priorLimitations ?? [],
      confidence: "UNKNOWN",
    };
  return {
    status: "POINTER_BOUND",
    pointer: fileIdentity(root, input.priorAcceptedStatusPath),
    acceptedMainSha: input.deltaBaseSha ?? null,
    currentLimitations: input.priorLimitations ?? [],
    confidence: existsSync(path.join(root, input.priorAcceptedStatusPath)) ? "BOUNDED" : "UNKNOWN",
  };
}

function materialPacket(packet) {
  const clone = structuredClone(packet);
  delete clone.ledgerTemplate;
  delete clone.observation;
  delete clone.validation;
  if (clone.integrity) delete clone.integrity.semanticDigest;
  return clone;
}

export function buildPacket(root, rawInput = {}) {
  const input = sanitize(rawInput);
  const registries = loadRegistries(root);
  const taskClass = classify(input);
  const profilesDocument = readJson(root, "agent-context-profiles.json", { profiles: {} });
  const profile = profilesDocument.profiles?.[taskClass];
  if (!profile) throw new Error(`UNKNOWN_TASK_CLASS:${taskClass}`);
  const closure = registryClosure(registries, input.paths ?? []);
  const authority = authoritySlices(root, input, registries, taskClass);
  const sources = sourceSlice(root, input, closure);
  const ownership = ownershipSlice(closure);
  const schema = schemaSlice(root, input, sources.entries);
  const verification = verificationSlice(closure, registries);
  ownership.owners = ownership.canonicalProducers;
  ownership.contracts = verification.contracts;
  const dependencies = dependencySlice(root, sources.entries, closure, registries);
  const delta = mainDelta(root, input, sources.entries, authority.slices, registries);
  const plateau = priorPlateau(root, input);
  const debt = (registries.debt.entries ?? []).filter(
    (entry) =>
      closure.contractIds.some((id) => (entry.affectedContracts ?? []).includes(id)) ||
      closure.suiteIds.some((id) => (entry.affectedSuites ?? []).includes(id)),
  );
  const confidence = authority.conflicts.length
    ? "STALE_REQUIRES_ESCALATION"
    : closure.unmappedPaths.length
      ? "PARTIAL_REQUIRES_EXPANSION"
      : "BOUNDED";
  const pointerCount =
    sources.entries.length + authority.slices.length + (plateau.pointer ? 1 : 0) + (schema.sources.length ? 1 : 0) + 3;
  const navigationPointerCount = Math.min(
    profile.pointerGuidance.maximum,
    Math.max(profile.pointerGuidance.minimum, pointerCount),
  );
  const knownRiskDetails = [
    ...closure.unmappedPaths.map((entry) => ({
      code: "UNMAPPED_PATH",
      path: entry,
      affectedSlice: "sourceSlice",
      confidence: "UNKNOWN",
      nextAction: `Search current ownership/impact/contracts for ${entry}; retain conservative SOURCE and TEST expansion until resolved.`,
    })),
    ...authority.conflicts.map((entry) => ({
      code: "AUTHORITY_CONFLICT",
      affectedSlice: "authority",
      confidence: "UNKNOWN",
      nextAction: "Load exact current authority text and resolve precedence; escalate only if irreconcilable.",
      detail: entry,
    })),
    ...debt.map((entry) => ({
      code: "VALIDATION_DEBT",
      id: entry.id,
      affectedSlice: "verificationSlice",
      confidence: "BOUNDED",
      nextAction: entry.reviewTrigger ?? entry.resolution ?? "Review current debt record.",
    })),
    ...(delta.unmappedChangedPaths.length
      ? [
          {
            code: "UNMAPPED_MAINLINE_DELTA",
            paths: delta.unmappedChangedPaths,
            affectedSlice: "mainDelta",
            confidence: "COARSE",
            nextAction: "Perform targeted current-source and ownership search for unmapped accepted changes.",
          },
        ]
      : []),
  ];
  const packet = {
    schemaVersion: PACKET_SCHEMA_VERSION,
    packetType: "MINIMUM_SUFFICIENT_CONTEXT_PACKET",
    task: {
      id: input.id ?? "unidentified-task",
      project: input.project ?? null,
      increment: input.increment ?? null,
      taskClass,
      executionProfile: input.executionProfile ?? "STANDARD_AUTONOMOUS",
    },
    sourceIdentity: sourceIdentity(root),
    scope: {
      objective: input.objective ?? "Objective must be supplied by the authorized task.",
      nonGoals: input.nonGoals ?? [],
      completionContract: input.completionContract ?? [
        "Follow current source authority and Sounding Line acceptance path.",
      ],
      locallyAttainableBoundary:
        input.locallyAttainableBoundary ??
        "Complete all safe in-scope local work; stop only at a genuine governed boundary.",
    },
    profile: {
      id: taskClass,
      sourceIdentity: fileIdentity(root, "agent-context-profiles.json"),
      initialContextEmphasis: profile.initialContextEmphasis,
      normallyDeferred: profile.normallyDeferred,
      expansionTriggers: profile.expansionTriggers,
      fallback: profile.fallback,
      pointerGuidance: profile.pointerGuidance,
      observedPointerCount: pointerCount,
      withinPointerGuidance:
        pointerCount >= profile.pointerGuidance.minimum && pointerCount <= profile.pointerGuidance.maximum,
      pointerGuidanceDisposition:
        pointerCount <= profile.pointerGuidance.maximum
          ? "WITHIN_GUIDANCE"
          : "EXPLICIT_TASK_POINTERS_EXCEED_SOFT_GUIDANCE; RETAINED_WITH_VISIBLE_ACCOUNTING",
    },
    authority,
    priorPlateau: plateau,
    priorAcceptedStatus: plateau.pointer,
    ownership,
    ownershipCompatibility: {
      owners: ownership.canonicalProducers,
      contracts: verification.contracts,
    },
    sourceSlice: sources.entries,
    sourceSliceContract: sources,
    schemaSlice: schema,
    dataSlice: schema,
    verificationSlice: [verification.authority, ...verification.suites],
    verificationSliceContract: verification,
    dependencySlice: dependencies,
    mainDelta: delta,
    knownRisks: knownRiskDetails.map((entry) => `${entry.code}:${entry.path ?? entry.id ?? entry.affectedSlice}`),
    knownRiskDetails,
    completionContract: input.completionContract ?? [
      "Complete authorized scope and use Sounding Line governed acceptance.",
    ],
    expansionPolicy: {
      autonomousReadingBoundary:
        "Directly relevant repository authority, source, schema, test, history, adjacent-project seam, operations, and security context.",
      allowedClasses: [
        "AUTHORITY",
        "SOURCE",
        "SCHEMA",
        "TEST",
        "HISTORY",
        "ADJACENT_PROJECT",
        "OPERATIONS",
        "SECURITY",
      ],
      ledgerLocation: `.agent-context/${(input.id ?? "task").replace(/[^a-z0-9._-]/gi, "-")}.ledger.json`,
      noContextPrison: true,
      unknownRule: "UNKNOWN_CONTEXT_REQUIRES_CONSERVATIVE_TARGETED_EXPANSION",
    },
    autonomousExpansionPolicy:
      "Classify the unresolved question; read the smallest useful AUTHORITY, SOURCE, SCHEMA, TEST, HISTORY, ADJACENT_PROJECT, OPERATIONS, or SECURITY set; record it; continue. Context expansion is not scope expansion.",
    confidence,
    confidenceLevel: authority.conflicts.length || closure.unmappedPaths.length ? "UNKNOWN" : "BOUNDED",
    conservativeFallback: closure.unmappedPaths.length
      ? "UNKNOWN_MAPPING_REQUIRES_TARGETED_SEARCH_AND_EXPANSION"
      : profile.fallback,
    staleness: {
      state: authority.conflicts.length ? "CONFLICTED" : "FRESH",
      reasons: authority.conflicts,
      affectedSlices: authority.conflicts.length ? ["authority"] : [],
      targetedRegenerationSupported: true,
    },
    generator: {
      version: GENERATOR_VERSION,
      schemaVersion: PACKET_SCHEMA_VERSION,
      path: "scripts/agent-context/build-context.mjs",
      implementation: "scripts/agent-context/packet-v2.mjs",
      schema: "scripts/agent-context/packet-v2.schema.json",
      profileSource: "agent-context-profiles.json",
      pointerCount: navigationPointerCount,
      actualPointerCount: pointerCount,
      integrity: "derived-nonauthoritative; current source and governing authority prevail",
      secretPolicy:
        "sensitive keys and recognized credential forms are redacted; full prompts and private content are excluded",
    },
    observation: {
      generatedAt: new Date().toISOString(),
      dynamicFields: ["observation.generatedAt", "sourceIdentity.dirtyState", "sourceIdentity.worktree"],
      semanticDigestExcludes: ["observation", "ledgerTemplate", "validation", "integrity.semanticDigest"],
    },
  };
  const sectionBindings = {
    authority: binding(
      root,
      "authority",
      authority.slices.map((entry) => entry.path).concat("Development_Docs/document-index.json"),
      packet.authority,
    ),
    priorPlateau: binding(root, "priorPlateau", plateau.pointer ? [plateau.pointer.path] : [], packet.priorPlateau),
    ownership: binding(
      root,
      "ownership",
      ["testing/ownership.json", "testing/contracts.json", "testing/impact-map.json"],
      packet.ownership,
    ),
    sourceSlice: binding(
      root,
      "sourceSlice",
      sources.entries.map((entry) => entry.path).concat("testing/ownership.json", "testing/impact-map.json"),
      packet.sourceSliceContract,
    ),
    schemaSlice: binding(
      root,
      "schemaSlice",
      schema.sources.map((entry) => entry.path),
      packet.schemaSlice,
    ),
    verificationSlice: binding(
      root,
      "verificationSlice",
      [
        "testing/sounding-line-authority.json",
        "testing/contracts.json",
        "testing/impact-map.json",
        "testing/suites.json",
        "testing/resources.json",
      ],
      packet.verificationSliceContract,
    ),
    dependencySlice: binding(
      root,
      "dependencySlice",
      dependencies.manifests.map((entry) => entry.path).concat("testing/suites.json", "testing/resources.json"),
      packet.dependencySlice,
    ),
    mainDelta: binding(root, "mainDelta", ["testing/ownership.json", "testing/impact-map.json"], packet.mainDelta, {
      originMainSha: packet.sourceIdentity.originMainSha,
      baseSha: packet.mainDelta.baseSha,
    }),
    profile: binding(root, "profile", ["agent-context-profiles.json"], packet.profile),
    generator: binding(
      root,
      "generator",
      [
        "scripts/agent-context/build-context.mjs",
        "scripts/agent-context/packet-v2.mjs",
        "scripts/agent-context/packet-v2.schema.json",
      ],
      packet.generator,
      { generatorVersion: GENERATOR_VERSION },
    ),
  };
  packet.integrity = {
    normalization:
      "UTF-8 file bytes for SHA-256 and Git blob identity; canonical JSON uses recursively sorted object keys and array order",
    sectionBindings,
    semanticDigest: null,
  };
  packet.integrity.semanticDigest = sha256(canonicalJson(materialPacket(packet)));
  packet.ledgerTemplate = createLogbook(packet.task.id, packet.integrity.semanticDigest);
  packet.ledgerTemplate.usage = null;
  const validation = validatePacket(packet);
  if (validation.errors.length) throw new Error(`INVALID_CONTEXT_PACKET:${validation.errors.join("|")}`);
  packet.validation = validation;
  return packet;
}

export function validatePacket(packet) {
  const errors = [];
  const warnings = [];
  for (const field of [
    "task",
    "sourceIdentity",
    "scope",
    "authority",
    "ownership",
    "sourceSlice",
    "schemaSlice",
    "verificationSlice",
    "dependencySlice",
    "mainDelta",
    "expansionPolicy",
    "integrity",
  ])
    if (packet[field] === undefined || packet[field] === null) errors.push(`MISSING_REQUIRED_SECTION:${field}`);
  if (!CONFIDENCE_LEVELS.includes(packet.confidenceLevel))
    errors.push(`INVALID_CONFIDENCE_LEVEL:${packet.confidenceLevel}`);
  if (!STALENESS_STATES.includes(packet.staleness?.state))
    errors.push(`INVALID_STALENESS_STATE:${packet.staleness?.state}`);
  if (packet.authority?.slices?.some((entry) => !entry.path || !entry.sourceIdentity || !entry.relevanceReason))
    errors.push("INVALID_AUTHORITY_SLICE_CONTRACT");
  if (
    packet.sourceSlice?.some(
      (entry) => !entry.path || !entry.sourceIdentity || !entry.mappingProvenance || !entry.confidence,
    )
  )
    errors.push("INVALID_SOURCE_SLICE_CONTRACT");
  if (packet.sourceSliceContract?.unmappedPaths?.length) warnings.push("UNMAPPED_SOURCE_PATHS_REQUIRE_EXPANSION");
  if (SECRET_VALUE.test(JSON.stringify(packet))) errors.push("SECRET_LIKE_VALUE_RETAINED");
  if (packet.authority?.conflicts?.length && packet.staleness?.state !== "CONFLICTED")
    errors.push("AUTHORITY_CONFLICT_NOT_SURFACED");
  return { valid: errors.length === 0, errors, warnings };
}

export function inspectPacketStaleness(root, packet) {
  const results = {};
  const affectedSlices = [];
  const reasons = [];
  let unknown = false;
  for (const [section, expected] of Object.entries(packet.integrity?.sectionBindings ?? {})) {
    const currentSources = expected.sources.map((entry) => fileIdentity(root, entry.path));
    const currentSourceDigest = sha256(canonicalJson(currentSources));
    const sectionReasons = [];
    if (currentSources.some((entry) => !entry.exists) && expected.sources.some((entry) => entry.exists)) {
      sectionReasons.push("BOUND_SOURCE_MISSING");
      unknown = true;
    }
    if (currentSourceDigest !== expected.sourceDigest) sectionReasons.push("BOUND_SOURCE_IDENTITY_CHANGED");
    if (section === "generator" && expected.generatorVersion !== GENERATOR_VERSION)
      sectionReasons.push("GENERATOR_VERSION_CHANGED");
    if (section === "mainDelta") {
      const currentOriginMain = gitFresh(root, ["show", "-s", "--format=%H", "origin/main"]);
      if (currentOriginMain !== expected.originMainSha) sectionReasons.push("ORIGIN_MAIN_MOVED");
    }
    results[section] = {
      state: sectionReasons.length ? "STALE" : "FRESH",
      reasons: sectionReasons,
      expectedSourceDigest: expected.sourceDigest,
      currentSourceDigest,
    };
    if (sectionReasons.length) {
      affectedSlices.push(section);
      reasons.push(...sectionReasons.map((reason) => ({ section, reason })));
    }
  }
  const conflicted = packet.authority?.conflicts?.length > 0;
  const sectionCount = Object.keys(results).length;
  const state = conflicted
    ? "CONFLICTED"
    : unknown
      ? "UNKNOWN"
      : affectedSlices.length === 0
        ? "FRESH"
        : affectedSlices.length === sectionCount
          ? "STALE"
          : "PARTIALLY_STALE";
  return {
    state,
    affectedSlices: unique(affectedSlices),
    reasons,
    sections: results,
    targetedRegenerationSupported: true,
  };
}

const REFRESHABLE = new Set([
  "authority",
  "priorPlateau",
  "ownership",
  "sourceSlice",
  "schemaSlice",
  "verificationSlice",
  "dependencySlice",
  "mainDelta",
  "profile",
  "generator",
]);

export function refreshPacketSlices(root, previousPacket, rawInput, requestedSections = []) {
  const selected = unique(requestedSections);
  if (!selected.length) throw new Error("TARGETED_REGENERATION_REQUIRES_SLICE");
  for (const section of selected)
    if (!REFRESHABLE.has(section)) throw new Error(`UNSUPPORTED_REGENERATION_SLICE:${section}`);
  const fresh = buildPacket(root, rawInput);
  if (selected.includes("generator")) return fresh;
  const refreshed = structuredClone(previousPacket);
  const fieldMap = {
    authority: ["authority"],
    priorPlateau: ["priorPlateau", "priorAcceptedStatus"],
    ownership: ["ownership"],
    sourceSlice: [
      "sourceSlice",
      "sourceSliceContract",
      "knownRisks",
      "knownRiskDetails",
      "confidence",
      "confidenceLevel",
      "conservativeFallback",
    ],
    schemaSlice: ["schemaSlice", "dataSlice"],
    verificationSlice: ["verificationSlice", "verificationSliceContract"],
    dependencySlice: ["dependencySlice"],
    mainDelta: ["mainDelta"],
    profile: ["profile"],
  };
  for (const section of selected) {
    for (const field of fieldMap[section]) refreshed[field] = fresh[field];
    refreshed.integrity.sectionBindings[section] = fresh.integrity.sectionBindings[section];
  }
  refreshed.sourceIdentity = fresh.sourceIdentity;
  refreshed.observation = fresh.observation;
  refreshed.staleness = inspectPacketStaleness(root, refreshed);
  refreshed.integrity.semanticDigest = sha256(canonicalJson(materialPacket(refreshed)));
  refreshed.ledgerTemplate.packetIdentity = refreshed.integrity.semanticDigest;
  refreshed.validation = validatePacket(refreshed);
  if (!refreshed.validation.valid)
    throw new Error(`INVALID_REFRESHED_CONTEXT_PACKET:${refreshed.validation.errors.join("|")}`);
  return refreshed;
}

function list(items, render = (item) => String(item)) {
  return items?.length ? items.map((item) => `- ${render(item)}`).join("\n") : "- None";
}

export function packetMarkdown(packet) {
  const authority = packet.authority?.slices ?? [];
  const sources = packet.sourceSlice ?? [];
  const suites = packet.verificationSliceContract?.suites ?? [];
  const risks = packet.knownRiskDetails ?? [];
  packet.verificationSlice.riskFloor = packet.verificationSliceContract.riskFloor;
  packet.verificationSlice.requiredSentinels = packet.verificationSliceContract.requiredSentinels;
  return `# Minimum Sufficient Context Packet\n\n## Objective\n${packet.scope.objective}\n\n## Task and current source\n- ID: ${packet.task.id}\n- Project / increment: ${packet.task.project ?? "Unspecified"} / ${packet.task.increment ?? "Unspecified"}\n- Class / profile: ${packet.task.taskClass} / ${packet.task.executionProfile}\n- origin/main: ${packet.sourceIdentity.originMainSha ?? "UNAVAILABLE"} (${packet.sourceIdentity.originMainTreeSha ?? "tree unavailable"})\n- Head: ${packet.sourceIdentity.headSha ?? "UNAVAILABLE"}; dirty: ${packet.sourceIdentity.dirtyState.dirty}\n- Packet: schema ${packet.schemaVersion}; generator ${packet.generator.version}; ${packet.staleness.state}; confidence ${packet.confidenceLevel}\n\n## Applicable authority\n${list(authority, (entry) => `${entry.path} [${entry.sections.join(", ") || "exact pointer"}] - ${entry.relevanceReason}${entry.exactTextRequired ? " (exact text required)" : ""}`)}\n\n## Prior plateau\n${packet.priorPlateau.pointer ? `- ${packet.priorPlateau.pointer.path} @ ${packet.priorPlateau.acceptedMainSha ?? "accepted SHA unavailable"}` : "- No accepted plateau pointer supplied; expand conservatively if history matters."}\n\n## Likely implementation and data\n${list(sources, (entry) => `${entry.path} [${entry.confidence}]`)}\n${packet.schemaSlice.applicability === "APPLICABLE" ? list(packet.schemaSlice.models, (entry) => `Prisma model ${entry.name} via ${entry.source}`) : "- Schema/data mapping not applicable from the current bounded path set."}\n\n## Verification\n- Risk floor: ${packet.verificationSlice.riskFloor}\n- Required sentinels: ${packet.verificationSlice.requiredSentinels.join(", ") || "None"}\n${list(suites, (entry) => `${entry.id} [${entry.selectionProvenance}]`)}\n\n## Mainline delta\n- ${packet.mainDelta.baseSha ?? "UNAVAILABLE"} -> ${packet.mainDelta.currentMainSha ?? "UNAVAILABLE"}; ${packet.mainDelta.changedPathCount} changed path(s)\n- Selected-source intersections: ${packet.mainDelta.selectedSourceIntersections.join(", ") || "None"}\n- Unmapped changes: ${packet.mainDelta.unmappedChangedPaths.join(", ") || "None"}\n\n## Known uncertainty and conservative next action\n${list(risks, (entry) => `${entry.code}${entry.path ? `: ${entry.path}` : entry.id ? `: ${entry.id}` : ""} - ${entry.nextAction}`)}\n\n## Completion contract\n${list(packet.completionContract)}\n\n## Expansion instructions\n${packet.autonomousExpansionPolicy}\nLedger: ${packet.expansionPolicy.ledgerLocation}. A packet is a starting map, never a context prison.\n\n## Integrity\n- Semantic digest: ${packet.integrity.semanticDigest}\n- Dynamic fields excluded from semantic identity: ${packet.observation.semanticDigestExcludes.join(", ")}\n`;
}

export { sanitize };
