/* Trusted-main, candidate-bound verification-maintenance qualification. */
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import {
  createTrustedMainProjectDiscoveryRegistry,
  discoverProjects,
  structurallyAdmitsProjectPath,
  validateTrustedMainProjectDiscoveryRegistry,
} from "./project-discovery.mjs";

const digest = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const sha = (value) => typeof value === "string" && /^[0-9a-f]{40}$/u.test(value);
const glob = (pattern) =>
  new RegExp(
    `^${pattern
      .replace(/[|\\{}()[\]^$+?.]/gu, "\\$&")
      .replace(/\*\*/gu, "::DOUBLE_STAR::")
      .replace(/\*/gu, "[^/]*")
      .replace(/::DOUBLE_STAR::/gu, ".*")}$`,
    "u",
  );
const matchesAny = (file, patterns) => patterns.some((pattern) => glob(pattern).test(file));
const structurallyCollidesWithTrustedScope = (file, trustedPolicy) => {
  const candidate = String(file).toLowerCase();
  return (trustedPolicy?.ordinaryCandidateEligiblePathGlobs ?? []).some((pattern) => {
    if (!pattern.endsWith("/**") || pattern.slice(0, -3).includes("*")) return false;
    const prefix = pattern.slice(0, -3).toLowerCase();
    return candidate.startsWith(prefix) && candidate[prefix.length] && candidate[prefix.length] !== "/";
  });
};
const execute = promisify(execFile);
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const by = (items, key) => new Map((items ?? []).map((item) => [item?.[key], item]));
const extendsOnly = (before, after) => [...new Set(before ?? [])].every((value) => (after ?? []).includes(value));
const onlyExtends = (before, after, fields) => {
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  return [...keys].every((key) =>
    fields.includes(key) ? extendsOnly(before?.[key], after?.[key]) : same(before?.[key], after?.[key]),
  );
};
const gitShow = async (sha, file) =>
  (await execute("git", ["show", `${sha}:${file}`], { maxBuffer: 16 * 1024 * 1024 })).stdout;
const gitTreePaths = async (sha) =>
  (await execute("git", ["ls-tree", "-r", "--name-only", sha], { maxBuffer: 16 * 1024 * 1024 })).stdout
    .split(/\r?\n/u)
    .filter(Boolean);
const gitTree = async (sha) => (await execute("git", ["rev-parse", `${sha}^{tree}`])).stdout.trim();

const registrationInputs = (trustedPolicy) => trustedPolicy?.ordinaryCandidateProductVerificationRegistration ?? null;
const registrationPaths = (trustedPolicy) => registrationInputs(trustedPolicy)?.pathGlobs ?? [];
const registrationTriggers = (trustedPolicy) => registrationInputs(trustedPolicy)?.semanticPathGlobs ?? [];
const governanceDocumentationInputs = (trustedPolicy) =>
  trustedPolicy?.ordinaryCandidateGovernanceDocumentation ?? null;
const governanceDocumentationPaths = (trustedPolicy) => governanceDocumentationInputs(trustedPolicy)?.pathGlobs ?? [];
const governanceDocumentationExclusions = (trustedPolicy) =>
  governanceDocumentationInputs(trustedPolicy)?.excludedPathGlobs ?? [];
const isOrdinaryGovernanceDocumentation = (file, trustedPolicy) =>
  matchesAny(file, governanceDocumentationPaths(trustedPolicy)) &&
  !matchesAny(file, governanceDocumentationExclusions(trustedPolicy));
const sourceBoundFeatureCatalogReconciliationPaths = (trustedPolicy) =>
  registrationInputs(trustedPolicy)?.sourceBoundFeatureCatalogReconciliationPathGlobs ?? [];
const productSourcePaths = (paths) =>
  (paths ?? []).filter((file) => /^(?:src|prisma|public|scripts)\//u.test(file) && !/\.test\.[^/]+$/u.test(file));
const uniqueOwners = (owners) => [
  ...new Map((owners ?? []).filter((owner) => owner?.id).map((owner) => [owner.id, owner])).values(),
];
const monotonicOwnershipRegistrationOwner = ({ trustedOwners, candidateOwners, expectedPrimaryId }) => {
  if (!expectedPrimaryId) return null;
  const trusted = by(uniqueOwners(trustedOwners), "id");
  const candidate = by(uniqueOwners(candidateOwners), "id");
  if (trusted.has(expectedPrimaryId) || candidate.size !== trusted.size + 1) return null;
  const owner = candidate.get(expectedPrimaryId);
  if (!owner) return null;
  for (const [id, trustedOwner] of trusted) {
    if (!candidate.has(id) || !same(trustedOwner, candidate.get(id))) return null;
  }
  return owner;
};
const mergedTrustedOwners = ({ registryOwners, descriptors }) => {
  const owners = new Map();
  for (const owner of registryOwners) owners.set(owner.id, { ...owner });
  for (const descriptor of descriptors) {
    const existing = owners.get(descriptor.id) ?? {};
    owners.set(descriptor.id, {
      ...existing,
      ...descriptor,
      sourcePaths: [...new Set([...(existing.sourcePaths ?? []), ...(descriptor.sourcePaths ?? [])])],
      testPaths: [...new Set([...(existing.testPaths ?? []), ...(descriptor.testPaths ?? [])])],
      contractIds: [...new Set([...(existing.contractIds ?? []), ...(descriptor.contractIds ?? [])])],
      supportingOwnerIds: [
        ...new Set([...(existing.supportingOwnerIds ?? []), ...(descriptor.supportingOwnerIds ?? [])]),
      ],
    });
  }
  return [...owners.values()];
};
const record = (value) => value && typeof value === "object" && !Array.isArray(value);
const normalizedOwnerToken = (value) =>
  String(value ?? "")
    .replace(/^project[-_ ]*/iu, "")
    .replace(/[^a-z0-9]+/giu, "-")
    .replace(/^-+|-+$/gu, "")
    .toLowerCase();
const sourceEvidenceMatchesOwner = (value, sourcePaths) =>
  (sourcePaths ?? []).some((pattern) => {
    const root = String(pattern).replace(/\/\*\*$/u, "");
    return String(value ?? "") === root || String(value ?? "").startsWith(`${root}/`);
  });
const trustedOwnerForFeatureCatalogRecord = (featureRecord, owners) => {
  const recordText = [featureRecord?.program, featureRecord?.title, featureRecord?.branch].join(" ").toLowerCase();
  const evidence = featureRecord?.evidence ?? [];
  return (owners ?? []).find((owner) => {
    const tokens = [owner?.id, owner?.project].map(normalizedOwnerToken).filter((token) => token.length >= 3);
    return (
      tokens.some((token) => recordText.includes(token)) &&
      evidence.some(
        (entry) =>
          (entry?.kind === "path" || entry?.kind === "test") &&
          sourceEvidenceMatchesOwner(entry?.value, owner?.sourcePaths),
      )
    );
  });
};
const featureCatalogRecord = (value) =>
  Array.isArray(value) && value.length === 1 ? value[0] : record(value) ? value : null;

function verifySourceBoundFeatureCatalogReconciliations({
  trustedPolicy,
  changedPaths,
  trustedRegistries,
  featureCatalogReconciliations,
  owner = null,
  allowMonotonicOwnershipRegistration = false,
  errors,
}) {
  const reconciliationPaths = (changedPaths ?? []).filter((file) =>
    matchesAny(file, sourceBoundFeatureCatalogReconciliationPaths(trustedPolicy)),
  );
  for (const file of reconciliationPaths) {
    const reconciliation = featureCatalogReconciliations?.[file];
    const trusted = featureCatalogRecord(reconciliation?.trusted);
    const candidate = featureCatalogRecord(reconciliation?.candidate);
    if (!record(candidate)) {
      errors.push(`PRODUCT_VERIFICATION_REGISTRATION_FEATURE_CATALOG_RECONCILIATION_SNAPSHOT_REQUIRED:${file}`);
      continue;
    }
    if (!record(trusted)) {
      const firstRegistration =
        allowMonotonicOwnershipRegistration &&
        owner &&
        candidate.status === "BRANCH_COMPLETE_NOT_MERGED" &&
        typeof candidate.branch === "string" &&
        sha(candidate.commit) &&
        Array.isArray(candidate.evidence) &&
        trustedOwnerForFeatureCatalogRecord(candidate, [owner]);
      if (!firstRegistration)
        errors.push(`PRODUCT_VERIFICATION_REGISTRATION_FEATURE_CATALOG_FIRST_RECORD_INVALID:${file}`);
      continue;
    }
    const { status: trustedStatus, branch, commit, limitations: trustedLimitations, ...trustedStable } = trusted;
    const { status: candidateStatus, limitations: candidateLimitations, ...candidateStable } = candidate;
    if (
      trustedStatus !== "BRANCH_COMPLETE_NOT_MERGED" ||
      candidateStatus !== "MAINLINE" ||
      typeof branch !== "string" ||
      !sha(commit) ||
      Object.hasOwn(candidate, "branch") ||
      Object.hasOwn(candidate, "commit") ||
      !Array.isArray(trustedLimitations) ||
      !Array.isArray(candidateLimitations) ||
      !same(trustedStable, candidateStable)
    ) {
      errors.push(`PRODUCT_VERIFICATION_REGISTRATION_FEATURE_CATALOG_RECONCILIATION_INVALID:${file}`);
      continue;
    }
    if (!trustedOwnerForFeatureCatalogRecord(trusted, trustedRegistries?.ownership?.owners))
      errors.push(`PRODUCT_VERIFICATION_REGISTRATION_FEATURE_CATALOG_RECONCILIATION_UNTRUSTED:${file}`);
  }
}

function resolveTrustedPrimaryOwner({
  trustedRegistries,
  trustedProjectDescriptors,
  trustedProjectDescriptor,
  productPaths,
  expectedPrimaryId = null,
  candidateRegistries = null,
  allowMonotonicOwnershipRegistration = false,
}) {
  const errors = [];
  const registryOwners = uniqueOwners(trustedRegistries?.ownership?.owners);
  const descriptors = uniqueOwners([
    ...(trustedProjectDescriptors ?? []),
    ...(trustedProjectDescriptor ? [trustedProjectDescriptor] : []),
  ]);
  const trustedOwners = mergedTrustedOwners({ registryOwners, descriptors });
  const realProductPaths = productSourcePaths(productPaths);
  const descriptorMatches = descriptors.filter((owner) =>
    realProductPaths.some((file) => matchesAny(file, owner?.sourcePaths ?? [])),
  );
  const registryMatches = registryOwners.filter((owner) =>
    realProductPaths.some((file) => matchesAny(file, owner?.sourcePaths ?? [])),
  );
  if (!realProductPaths.length) {
    errors.push(
      "PRODUCT_VERIFICATION_REGISTRATION_PRODUCT_SOURCE_REQUIRED",
      "PRODUCT_VERIFICATION_REGISTRATION_PRODUCT_OWNER_UNRESOLVED",
    );
    return { owner: null, supportingOwners: [], errors, realProductPaths };
  }
  if (expectedPrimaryId) {
    const admittedOwner = allowMonotonicOwnershipRegistration
      ? monotonicOwnershipRegistrationOwner({
          trustedOwners: registryOwners,
          candidateOwners: candidateRegistries?.ownership?.owners,
          expectedPrimaryId,
        })
      : null;
    const owner = trustedOwners.find((candidate) => candidate.id === expectedPrimaryId) ?? admittedOwner;
    const hasTrustedContractAuthority = (trustedRegistries?.contracts?.contracts ?? []).some(
      (contract) => contract?.authority === expectedPrimaryId && contract?.owners?.includes(expectedPrimaryId),
    );
    if (!owner || (!admittedOwner && !hasTrustedContractAuthority)) {
      errors.push("PRODUCT_VERIFICATION_REGISTRATION_NEW_CONTRACT_AUTHORITY_UNTRUSTED");
      return { owner: null, supportingOwners: [], errors, realProductPaths };
    }
    const mappedOwners = admittedOwner ? [...trustedOwners, admittedOwner] : trustedOwners;
    for (const file of realProductPaths) {
      if (!mappedOwners.some((candidate) => matchesAny(file, candidate?.sourcePaths ?? [])))
        errors.push(`PRODUCT_VERIFICATION_REGISTRATION_PRODUCT_PATH_UNMAPPED:${file}`);
    }
    for (const descriptor of descriptorMatches) {
      if (descriptor.id !== owner.id && !(descriptor.supportingOwnerIds ?? []).includes(owner.id))
        errors.push(`PRODUCT_VERIFICATION_REGISTRATION_SUPPORTING_OWNER_REQUIRED:${descriptor.id}`);
    }
    const supportingOwnerIds = new Set(owner.supportingOwnerIds ?? []);
    const supportingOwners = trustedOwners.filter(
      (candidate) =>
        candidate.id !== owner.id &&
        (supportingOwnerIds.has(candidate.id) ||
          realProductPaths.some((file) => matchesAny(file, candidate?.sourcePaths ?? []))),
    );
    if ([...supportingOwnerIds].some((id) => !supportingOwners.some((candidate) => candidate.id === id)))
      errors.push("PRODUCT_VERIFICATION_REGISTRATION_SUPPORTING_OWNER_UNRESOLVED");
    return { owner, supportingOwners, errors, realProductPaths };
  }
  if (descriptorMatches.length > 1) errors.push("PRODUCT_VERIFICATION_REGISTRATION_PRODUCT_OWNER_CONFLICT");
  if (descriptorMatches.length === 1) {
    const owner = descriptorMatches[0];
    const supportingOwnerIds = new Set(owner.supportingOwnerIds ?? []);
    const foreign = registryMatches.filter(
      (candidate) => candidate.id !== owner.id && !supportingOwnerIds.has(candidate.id),
    );
    if (foreign.length) errors.push("PRODUCT_VERIFICATION_REGISTRATION_PRODUCT_OWNER_CONFLICT");
    const supportingOwners = registryOwners.filter((candidate) => supportingOwnerIds.has(candidate.id));
    if (supportingOwners.length !== supportingOwnerIds.size)
      errors.push("PRODUCT_VERIFICATION_REGISTRATION_SUPPORTING_OWNER_UNRESOLVED");
    return { owner, supportingOwners, errors, realProductPaths };
  }
  if (registryMatches.length !== 1) {
    errors.push(
      registryMatches.length > 1
        ? "PRODUCT_VERIFICATION_REGISTRATION_PRODUCT_OWNER_CONFLICT"
        : "PRODUCT_VERIFICATION_REGISTRATION_PRODUCT_OWNER_UNRESOLVED",
    );
    return { owner: null, supportingOwners: [], errors, realProductPaths };
  }
  return { owner: registryMatches[0], supportingOwners: [], errors, realProductPaths };
}

function verifyRegistrationSnapshots({
  trustedRegistries,
  candidateRegistries,
  owner,
  supportingOwners,
  sharedVerificationSuiteIds,
  allowMonotonicOwnershipRegistration = false,
  errors,
}) {
  const ownershipAddition = allowMonotonicOwnershipRegistration
    ? monotonicOwnershipRegistrationOwner({
        trustedOwners: trustedRegistries?.ownership?.owners,
        candidateOwners: candidateRegistries?.ownership?.owners,
        expectedPrimaryId: owner?.id,
      })
    : null;
  if (!same(trustedRegistries?.ownership, candidateRegistries?.ownership) && !ownershipAddition)
    errors.push("PRODUCT_VERIFICATION_REGISTRATION_OWNERSHIP_MUTATION");
  if (!same(trustedRegistries?.trustedProjectDiscovery, candidateRegistries?.trustedProjectDiscovery))
    errors.push("PRODUCT_VERIFICATION_REGISTRATION_TRUSTED_DISCOVERY_MUTATION");
  const trustedContracts = by(trustedRegistries?.contracts?.contracts, "id");
  const candidateContracts = by(candidateRegistries?.contracts?.contracts, "id");
  const ownedContracts = new Set(owner.contractIds ?? []);
  const supportingContractIds = new Set(supportingOwners.flatMap((entry) => entry.contractIds ?? []));
  const permittedContractIds = () => new Set([...ownedContracts, ...supportingContractIds]);
  for (const [id, contract] of trustedContracts) {
    if (!candidateContracts.has(id) || !same(contract, candidateContracts.get(id)))
      errors.push(`PRODUCT_VERIFICATION_REGISTRATION_CONTRACT_MUTATION:${id}`);
  }
  for (const [id, contract] of candidateContracts) {
    if (trustedContracts.has(id)) continue;
    if (contract?.authority !== owner.id || !Array.isArray(contract?.owners) || !contract.owners.includes(owner.id))
      errors.push(`PRODUCT_VERIFICATION_REGISTRATION_CONTRACT_OWNER_INVALID:${id}`);
    else ownedContracts.add(id);
  }

  const trustedSuites = by(trustedRegistries?.suites?.suites, "id");
  const candidateSuites = by(candidateRegistries?.suites?.suites, "id");
  const ownedSuites = new Set();
  const supportingSuiteIds = new Set(
    [...trustedSuites.values()]
      .filter((suite) => supportingOwners.some((supportingOwner) => supportingOwner.id === suite?.owner))
      .map((suite) => suite.id),
  );
  for (const [id, suite] of trustedSuites) {
    const next = candidateSuites.get(id);
    if (!next) errors.push(`PRODUCT_VERIFICATION_REGISTRATION_SUITE_REMOVED:${id}`);
    else if (
      !same(suite, next) &&
      !(suite.owner === owner.id && next.owner === owner.id && onlyExtends(suite, next, ["contracts", "affectedPaths"]))
    )
      errors.push(`PRODUCT_VERIFICATION_REGISTRATION_SUITE_MUTATION:${id}`);
    if (suite.owner === owner.id) ownedSuites.add(id);
  }
  for (const [id, suite] of candidateSuites) {
    if (suite?.owner === owner.id) ownedSuites.add(id);
    if (
      (!trustedSuites.has(id) || suite?.owner === owner.id) &&
      (!Array.isArray(suite?.contracts) || suite.contracts.some((id) => !permittedContractIds().has(id)))
    )
      errors.push(`PRODUCT_VERIFICATION_REGISTRATION_SUITE_CONTRACT_INVALID:${id}`);
  }

  const verifyImpact = (field, identity, allowedExtensions) => {
    const trusted = by(trustedRegistries?.impactMap?.[field], identity);
    const candidate = by(candidateRegistries?.impactMap?.[field], identity);
    for (const [id, entry] of trusted) {
      const next = candidate.get(id);
      if (!next) errors.push(`PRODUCT_VERIFICATION_REGISTRATION_IMPACT_REMOVED:${field}:${id}`);
      else if (!same(entry, next) && !onlyExtends(entry, next, allowedExtensions))
        errors.push(`PRODUCT_VERIFICATION_REGISTRATION_IMPACT_MUTATION:${field}:${id}`);
    }
    for (const [id, entry] of candidate) {
      const contracts = entry?.contractIds ?? (field === "contractMappings" ? [id] : []);
      const suites = entry?.suiteIds ?? [];
      if (
        (!trusted.has(id) || !same(trusted.get(id), entry)) &&
        (contracts.some((contractId) => !permittedContractIds().has(contractId)) ||
          suites.some(
            (suiteId) =>
              !ownedSuites.has(suiteId) &&
              !supportingSuiteIds.has(suiteId) &&
              !sharedVerificationSuiteIds.includes(suiteId),
          ))
      )
        errors.push(`PRODUCT_VERIFICATION_REGISTRATION_IMPACT_OWNER_INVALID:${field}:${id}`);
    }
  };
  verifyImpact("pathMappings", "path", ["suiteIds", "contractIds"]);
  verifyImpact("contractMappings", "contractId", ["suiteIds"]);

  const trustedDispositions = by(trustedRegistries?.fileDispositions?.rules, "match");
  const candidateDispositions = by(candidateRegistries?.fileDispositions?.rules, "match");
  for (const [match, rule] of trustedDispositions) {
    const next = candidateDispositions.get(match);
    if (!next || (rule.owner !== owner.id && !same(rule, next)))
      errors.push(`PRODUCT_VERIFICATION_REGISTRATION_DISPOSITION_MUTATION:${match}`);
  }
  for (const [match, rule] of candidateDispositions) {
    if (!trustedDispositions.has(match) && rule?.owner !== owner.id)
      errors.push(`PRODUCT_VERIFICATION_REGISTRATION_DISPOSITION_OWNER_INVALID:${match}`);
  }

  const trustedCases = by(trustedRegistries?.activeTestRegistry?.cases, "semanticId");
  const candidateCases = by(candidateRegistries?.activeTestRegistry?.cases, "semanticId");
  if (candidateRegistries?.activeTestRegistry?.generated !== true)
    errors.push("PRODUCT_VERIFICATION_REGISTRATION_GENERATED_REGISTRY_INVALID");
  const newBrowserProjects = new Set();
  for (const [semanticId, entry] of trustedCases) {
    const next = candidateCases.get(semanticId);
    if (!next || (entry.owner !== owner.id && !same(entry, next)))
      errors.push(`PRODUCT_VERIFICATION_REGISTRATION_REGISTRY_MUTATION:${semanticId}`);
  }
  for (const [semanticId, entry] of candidateCases) {
    if (trustedCases.has(semanticId)) continue;
    const supportingOwner = supportingOwners.find((candidate) => candidate.id === entry?.owner);
    const allowedCrossProjectCase =
      supportingOwner &&
      trustedSuites.get(entry?.suiteId)?.owner === supportingOwner.id &&
      (entry?.contracts ?? []).every((id) => (supportingOwner.contractIds ?? []).includes(id));
    if (
      (entry?.owner !== owner.id && !allowedCrossProjectCase) ||
      (entry?.owner === owner.id &&
        (!ownedSuites.has(entry?.suiteId) || (entry?.contracts ?? []).some((id) => !permittedContractIds().has(id))))
    )
      errors.push(`PRODUCT_VERIFICATION_REGISTRATION_REGISTRY_OWNER_INVALID:${semanticId}`);
    for (const project of entry?.browserRequirements ?? [])
      if (project !== "NOT_APPLICABLE") newBrowserProjects.add(project);
  }
  return { ownedContracts, ownedSuites, newBrowserProjects };
}

function configuredPlaywrightProjects(source) {
  return new Set([...String(source ?? "").matchAll(/\bname\s*:\s*["']([^"']+)["']/gu)].map((match) => match[1]));
}

export function classifyProductVerificationRegistration({
  trustedPolicy,
  changedPaths,
  trustedRegistries,
  candidateRegistries,
  trustedProjectDescriptor,
  trustedProjectDescriptors = [],
  featureCatalogReconciliations = {},
}) {
  const errors = [];
  const configuration = registrationInputs(trustedPolicy);
  if (
    !configuration ||
    configuration.classification !== "PRODUCT_WITH_VERIFICATION_REGISTRATION" ||
    !Array.isArray(configuration.pathGlobs) ||
    !Array.isArray(configuration.sourceBoundFeatureCatalogReconciliationPathGlobs)
  )
    errors.push("PRODUCT_VERIFICATION_REGISTRATION_POLICY_INVALID");
  if (!trustedRegistries || !candidateRegistries) errors.push("PRODUCT_VERIFICATION_REGISTRATION_SNAPSHOTS_REQUIRED");
  const metadata = (changedPaths ?? []).filter((file) => matchesAny(file, registrationPaths(trustedPolicy)));
  const productPaths = (changedPaths ?? []).filter(
    (file) =>
      !metadata.includes(file) &&
      !matchesAny(file, [
        ...(configuration?.ancillaryPathGlobs ?? []),
        ...(configuration?.sourceBoundFeatureCatalogReconciliationPathGlobs ?? []),
      ]),
  );
  const trustedContracts = by(trustedRegistries?.contracts?.contracts, "id");
  const newAuthorities = new Set(
    (candidateRegistries?.contracts?.contracts ?? [])
      .filter((contract) => !trustedContracts.has(contract?.id))
      .map((contract) => contract?.authority)
      .filter(Boolean),
  );
  const ownerResolution = resolveTrustedPrimaryOwner({
    trustedRegistries,
    trustedProjectDescriptors,
    trustedProjectDescriptor,
    productPaths,
    expectedPrimaryId: newAuthorities.size === 1 ? [...newAuthorities][0] : null,
    candidateRegistries,
    allowMonotonicOwnershipRegistration: configuration?.allowMonotonicOwnershipRegistration === true,
  });
  errors.push(...ownerResolution.errors);
  if (newAuthorities.size > 1) errors.push("PRODUCT_VERIFICATION_REGISTRATION_PRODUCT_OWNER_AMBIGUOUS");
  const owner = ownerResolution.owner;
  if (newAuthorities.size === 1 && owner && owner.id !== [...newAuthorities][0])
    errors.push("PRODUCT_VERIFICATION_REGISTRATION_NEW_CONTRACT_OWNER_MISMATCH");
  if (!owner && !errors.includes("PRODUCT_VERIFICATION_REGISTRATION_PRODUCT_OWNER_UNRESOLVED"))
    errors.push("PRODUCT_VERIFICATION_REGISTRATION_PRODUCT_OWNER_UNRESOLVED");
  if (owner && trustedRegistries && candidateRegistries) {
    const { newBrowserProjects } = verifyRegistrationSnapshots({
      trustedRegistries,
      candidateRegistries,
      owner,
      supportingOwners: ownerResolution.supportingOwners,
      sharedVerificationSuiteIds: configuration.sharedVerificationSuiteIds ?? [],
      allowMonotonicOwnershipRegistration: configuration.allowMonotonicOwnershipRegistration === true,
      errors,
    });
    if (metadata.some((file) => matchesAny(file, configuration?.playwrightConfigPathGlobs ?? []))) {
      const trustedProjects = configuredPlaywrightProjects(trustedRegistries.playwrightConfig);
      const candidateProjects = configuredPlaywrightProjects(candidateRegistries.playwrightConfig);
      if (![...newBrowserProjects].some((project) => candidateProjects.has(project) && !trustedProjects.has(project)))
        errors.push("PRODUCT_VERIFICATION_REGISTRATION_PLAYWRIGHT_PROJECT_UNBOUND");
    }
    if (
      metadata.some((file) => matchesAny(file, configuration?.testRegistrySourcePathGlobs ?? [])) &&
      same(trustedRegistries.testRegistrySource, candidateRegistries.testRegistrySource)
    )
      errors.push("PRODUCT_VERIFICATION_REGISTRATION_TEST_REGISTRY_SOURCE_UNCHANGED");
  }
  verifySourceBoundFeatureCatalogReconciliations({
    trustedPolicy,
    changedPaths,
    trustedRegistries,
    featureCatalogReconciliations,
    owner,
    allowMonotonicOwnershipRegistration: configuration?.allowMonotonicOwnershipRegistration === true,
    errors,
  });
  return {
    classification: errors.length
      ? "PRODUCT_VERIFICATION_REGISTRATION_REJECTED"
      : "PRODUCT_WITH_VERIFICATION_REGISTRATION",
    errors: [...new Set(errors)].sort(),
    ownerId: owner?.id ?? null,
    primaryProductSourcePaths: ownerResolution.realProductPaths,
    metadataPaths: metadata,
  };
}

export function classifyVerificationMaintenance({ trustedPolicy, changedPaths }) {
  const errors = [];
  if (trustedPolicy?.authority !== "SOUNDING_LINE_VERIFICATION_MAINTENANCE" || trustedPolicy?.trustedMainOnly !== true)
    errors.push("MAINTENANCE_TRUSTED_POLICY_INVALID");
  const paths = [...new Set(changedPaths ?? [])].sort();
  if (!paths.length) errors.push("MAINTENANCE_EMPTY_DIFF_REJECTED");
  for (const file of paths) {
    if (matchesAny(file, trustedPolicy?.authorityChangePathGlobs ?? []))
      errors.push(`MAINTENANCE_AUTHORITY_CHANGE_REJECTED:${file}`);
    else if (!matchesAny(file, trustedPolicy?.eligiblePathGlobs ?? []))
      errors.push(`MAINTENANCE_SCOPE_REJECTED:${file}`);
  }
  return {
    classification: errors.length
      ? errors.some((value) => value.startsWith("MAINTENANCE_AUTHORITY_CHANGE_REJECTED"))
        ? "MAINTENANCE_AUTHORITY_CHANGE_REJECTED"
        : "MAINTENANCE_SCOPE_REJECTED"
      : "VERIFICATION_MAINTENANCE",
    changedPaths: paths,
    errors: [...new Set(errors)].sort(),
  };
}

export function classifyOrdinaryCandidate({
  trustedPolicy,
  changedPaths,
  trustedRegistries = null,
  candidateRegistries = null,
  trustedProjectDescriptor = null,
  trustedProjectDescriptors = [],
  featureCatalogReconciliations = {},
}) {
  const errors = [];
  if (trustedPolicy?.authority !== "SOUNDING_LINE_VERIFICATION_MAINTENANCE" || trustedPolicy?.trustedMainOnly !== true)
    errors.push("ORDINARY_CANDIDATE_TRUSTED_POLICY_INVALID");
  const paths = [...new Set(changedPaths ?? [])].sort();
  // This is an admission hint only. It is deliberately built from the path
  // interval rather than candidate-owned maps, so it cannot narrow evidence.
  const projectDiscovery = discoverProjects({ candidatePaths: paths });
  if (!paths.length) errors.push("ORDINARY_CANDIDATE_EMPTY_DIFF_REJECTED");
  const hasRegistration = paths.some((file) => matchesAny(file, registrationTriggers(trustedPolicy)));
  const registrationConfiguration = registrationInputs(trustedPolicy);
  for (const file of paths) {
    const admittedOwnershipRegistration =
      hasRegistration &&
      registrationConfiguration?.allowMonotonicOwnershipRegistration === true &&
      matchesAny(file, registrationConfiguration?.monotonicOwnershipPathGlobs ?? []);
    if (matchesAny(file, trustedPolicy?.authorityChangePathGlobs ?? []) && !admittedOwnershipRegistration)
      errors.push(`ORDINARY_CANDIDATE_AUTHORITY_CHANGE_REJECTED:${file}`);
    else if (
      !admittedOwnershipRegistration &&
      !matchesAny(file, [
        ...(trustedPolicy?.ordinaryCandidateEligiblePathGlobs ?? []),
        ...(hasRegistration
          ? [
              ...registrationPaths(trustedPolicy),
              ...(registrationConfiguration?.ancillaryPathGlobs ?? []),
              ...sourceBoundFeatureCatalogReconciliationPaths(trustedPolicy),
            ]
          : []),
      ]) &&
      !isOrdinaryGovernanceDocumentation(file, trustedPolicy) &&
      (!structurallyAdmitsProjectPath(file, projectDiscovery, paths) ||
        structurallyCollidesWithTrustedScope(file, trustedPolicy))
    )
      errors.push(`ORDINARY_CANDIDATE_UNKNOWN_SCOPE_REJECTED:${file}`);
  }
  const registration = hasRegistration
    ? classifyProductVerificationRegistration({
        trustedPolicy,
        changedPaths: paths,
        trustedRegistries,
        candidateRegistries,
        trustedProjectDescriptor,
        trustedProjectDescriptors,
        featureCatalogReconciliations,
      })
    : null;
  errors.push(...(registration?.errors ?? []));
  return {
    classification: errors.length
      ? errors.some((value) => value.startsWith("ORDINARY_CANDIDATE_AUTHORITY_CHANGE_REJECTED"))
        ? "ORDINARY_CANDIDATE_AUTHORITY_CHANGE_REJECTED"
        : errors.some((value) => value.startsWith("PRODUCT_VERIFICATION_REGISTRATION_"))
          ? "PRODUCT_VERIFICATION_REGISTRATION_REJECTED"
          : "ORDINARY_CANDIDATE_UNKNOWN_SCOPE_REJECTED"
      : (registration?.classification ?? "ORDINARY_CANDIDATE"),
    changedPaths: paths,
    errors: [...new Set(errors)].sort(),
    registration,
    registration,
    projectDiscovery,
  };
}

const registrationFiles = [
  ["contracts", "testing/contracts.json", "json"],
  ["impactMap", "testing/impact-map.json", "json"],
  ["suites", "testing/suites.json", "json"],
  ["fileDispositions", "testing/file-dispositions.json", "json"],
  ["activeTestRegistry", "testing/generated/active-test-registry.json", "json"],
  ["ownership", "testing/ownership.json", "json"],
  ["trustedProjectDiscovery", "testing/trusted-project-discovery.json", "json"],
  ["playwrightConfig", "playwright.config.ts", "text"],
  ["testRegistrySource", "scripts/sounding-line/test-registry.mjs", "text"],
];

async function registrationSnapshot({
  baseSha,
  candidateSha,
  candidateRoot,
  changedPaths = [],
  sourceBoundFeatureCatalogReconciliationPathGlobs = [],
}) {
  const readCandidate = async (file) => {
    if (candidateSha) return gitShow(candidateSha, file);
    return readFile(new URL(`../${file}`, `file://${candidateRoot.replace(/\\/gu, "/")}/`), "utf8");
  };
  const snapshot = async (shaValue, candidate) => {
    const entries = await Promise.all(
      registrationFiles.map(async ([key, file, format]) => {
        const text = candidate ? await readCandidate(file) : await gitShow(shaValue, file);
        return [key, format === "json" ? JSON.parse(text) : text];
      }),
    );
    const result = Object.fromEntries(entries);
    const configPaths = [
      "playwright.config.ts",
      ...(changedPaths ?? []).filter((file) => matchesAny(file, ["playwright*.config.*"])),
    ];
    const configSources = await Promise.all(
      [...new Set(configPaths)].sort().map(async (file) => {
        try {
          return candidate ? await readCandidate(file) : await gitShow(shaValue, file);
        } catch {
          return "";
        }
      }),
    );
    result.playwrightConfig = configSources.filter(Boolean).join("\n");
    return result;
  };
  const trustedRegistries = await snapshot(baseSha, false);
  const candidateRegistries = await snapshot(candidateSha, true);
  const baseTreePaths = new Set(await gitTreePaths(baseSha));
  const featureCatalogReconciliations = Object.fromEntries(
    await Promise.all(
      (changedPaths ?? [])
        .filter((file) => matchesAny(file, sourceBoundFeatureCatalogReconciliationPathGlobs))
        .sort()
        .map(async (file) => [
          file,
          {
            trusted: baseTreePaths.has(file) ? JSON.parse(await gitShow(baseSha, file)) : null,
            candidate: JSON.parse(await readCandidate(file)),
          },
        ]),
    ),
  );
  return {
    trustedRegistries,
    candidateRegistries,
    featureCatalogReconciliations,
  };
}

export function createMaintenancePlan({
  trustedPolicy,
  trustedMainSha,
  candidateSha,
  candidateTree,
  qualifiedBaseSha,
  changedPaths,
}) {
  const classification = classifyVerificationMaintenance({ trustedPolicy, changedPaths });
  const errors = [...classification.errors];
  if (!sha(trustedMainSha)) errors.push("MAINTENANCE_TRUSTED_MAIN_SHA_INVALID");
  if (!sha(candidateSha)) errors.push("MAINTENANCE_CANDIDATE_SHA_INVALID");
  if (!sha(candidateTree)) errors.push("MAINTENANCE_CANDIDATE_TREE_INVALID");
  if (!sha(qualifiedBaseSha)) errors.push("MAINTENANCE_BASE_SHA_INVALID");
  const plan = {
    version: 1,
    authority: "SOUNDING_LINE_VERIFICATION_MAINTENANCE",
    disposition: "MAINTENANCE_GO",
    trustedMainSha,
    trustedPolicyDigest: digest(trustedPolicy),
    candidateSha,
    candidateTree,
    qualifiedBaseSha,
    classification,
    requiredEvidence: trustedPolicy?.requiredEvidence ?? [],
  };
  return { ...plan, planDigest: digest(plan), errors: [...new Set(errors)].sort() };
}

export function finalizeMaintenance({
  plan,
  evidence,
  observedCandidateSha,
  observedTrustedMainSha,
  observedLandedTree = null,
}) {
  const errors = [];
  const planDigest = plan?.planDigest;
  const unsigned = { ...(plan ?? {}) };
  delete unsigned.planDigest;
  delete unsigned.errors;
  if (!plan || planDigest !== digest(unsigned)) errors.push("MAINTENANCE_PLAN_DIGEST_MISMATCH");
  if (plan?.errors?.length) errors.push(...plan.errors);
  if (observedCandidateSha !== plan?.candidateSha) errors.push("MAINTENANCE_CANDIDATE_CHANGED_AFTER_QUALIFICATION");
  if (observedTrustedMainSha !== plan?.trustedMainSha) errors.push("MAINTENANCE_TRUSTED_MAIN_STALE");
  if (observedLandedTree && observedLandedTree !== plan?.candidateTree) errors.push("MAINTENANCE_LANDED_TREE_MISMATCH");
  const byId = new Map((evidence ?? []).map((entry) => [entry.id, entry]));
  for (const id of plan?.requiredEvidence ?? []) {
    const entry = byId.get(id);
    if (!entry || entry.result !== "PASSED" || entry.candidateSha !== plan.candidateSha)
      errors.push(`MAINTENANCE_EVIDENCE_INVALID:${id}`);
  }
  return {
    authority: "SOUNDING_LINE_VERIFICATION_MAINTENANCE_FINALIZER",
    decision: errors.length ? "MAINTENANCE_NO_GO" : "MAINTENANCE_GO",
    planDigest: plan?.planDigest ?? null,
    candidateSha: plan?.candidateSha ?? null,
    trustedMainSha: plan?.trustedMainSha ?? null,
    evidenceDigest: digest(evidence ?? []),
    errors: [...new Set(errors)].sort(),
  };
}

if (process.argv[1]?.endsWith("verification-maintenance.mjs") && process.argv[2] === "plan") {
  const options = Object.fromEntries(
    process.argv
      .slice(3)
      .map((value, index, values) => (value.startsWith("--") ? [value.slice(2), values[index + 1]] : []))
      .filter(([key]) => key),
  );
  const policy = JSON.parse(await readFile(options.policy, "utf8"));
  const paths = JSON.parse(await readFile(options.paths, "utf8"));
  const result = createMaintenancePlan({
    trustedPolicy: policy,
    trustedMainSha: options["trusted-main-sha"],
    candidateSha: options["candidate-sha"],
    candidateTree: options["candidate-tree"],
    qualifiedBaseSha: options["base-sha"],
    changedPaths: paths,
  });
  await writeFile(options.out, `${JSON.stringify(result, null, 2)}\n`);
  process.stdout.write(`${result.classification.classification}\n`);
  process.exitCode = result.errors.length ? 1 : 0;
}
if (process.argv[1]?.endsWith("verification-maintenance.mjs") && process.argv[2] === "ordinary") {
  const options = Object.fromEntries(
    process.argv
      .slice(3)
      .map((value, index, values) => (value.startsWith("--") ? [value.slice(2), values[index + 1]] : []))
      .filter(([key]) => key),
  );
  const policy = JSON.parse(await readFile(options.policy, "utf8"));
  const parsedPaths = JSON.parse(await readFile(options.paths, "utf8"));
  let snapshots = {};
  if (Array.isArray(parsedPaths) && parsedPaths.some((file) => matchesAny(file, registrationTriggers(policy)))) {
    if (!sha(options["trusted-base-sha"]) || (!sha(options["candidate-sha"]) && !options["candidate-root"])) {
      snapshots = { snapshotError: "PRODUCT_VERIFICATION_REGISTRATION_SNAPSHOTS_REQUIRED" };
    } else {
      try {
        snapshots = await registrationSnapshot({
          baseSha: options["trusted-base-sha"],
          candidateSha: options["candidate-sha"],
          candidateRoot: options["candidate-root"] ?? process.cwd(),
          changedPaths: Array.isArray(parsedPaths) ? parsedPaths : [parsedPaths],
          sourceBoundFeatureCatalogReconciliationPathGlobs: sourceBoundFeatureCatalogReconciliationPaths(policy),
        });
        const [trustedMainTreeSha, trustedTreePaths] = await Promise.all([
          gitTree(options["trusted-base-sha"]),
          gitTreePaths(options["trusted-base-sha"]),
        ]);
        const trustedDiscovery = createTrustedMainProjectDiscoveryRegistry({
          trustedMainSha: options["trusted-base-sha"],
          trustedMainTreeSha,
          trustedTreePaths,
          sourceRegistry: snapshots.trustedRegistries.trustedProjectDiscovery,
          owners: snapshots.trustedRegistries.ownership?.owners,
        });
        const discoveryValidity = validateTrustedMainProjectDiscoveryRegistry({
          registry: trustedDiscovery,
          trustedMainSha: options["trusted-base-sha"],
          trustedMainTreeSha,
        });
        if (!discoveryValidity.valid) snapshots.snapshotError = discoveryValidity.code;
        else snapshots.trustedProjectDescriptors = trustedDiscovery.descriptors;
      } catch {
        snapshots = { snapshotError: "PRODUCT_VERIFICATION_REGISTRATION_SNAPSHOTS_UNAVAILABLE" };
      }
    }
  }
  const result = classifyOrdinaryCandidate({
    trustedPolicy: policy,
    changedPaths: Array.isArray(parsedPaths) ? parsedPaths : [parsedPaths],
    ...snapshots,
  });
  if (snapshots.snapshotError) {
    result.errors = [...new Set([...result.errors, snapshots.snapshotError])].sort();
    result.classification = "PRODUCT_VERIFICATION_REGISTRATION_REJECTED";
  }
  await writeFile(options.out, `${JSON.stringify(result, null, 2)}\n`);
  process.stdout.write(`${result.classification}\n`);
  process.exitCode = result.errors.length ? 1 : 0;
}
if (process.argv[1]?.endsWith("verification-maintenance.mjs") && process.argv[2] === "finalize") {
  const options = Object.fromEntries(
    process.argv
      .slice(3)
      .map((value, index, values) => (value.startsWith("--") ? [value.slice(2), values[index + 1]] : []))
      .filter(([key]) => key),
  );
  const plan = JSON.parse(await readFile(options.plan, "utf8"));
  const evidence = JSON.parse(await readFile(options.evidence, "utf8"));
  const result = finalizeMaintenance({
    plan,
    evidence,
    observedCandidateSha: options["candidate-sha"],
    observedTrustedMainSha: options["trusted-main-sha"],
  });
  await writeFile(options.out, `${JSON.stringify(result, null, 2)}\n`);
  process.stdout.write(`${result.decision}\n`);
  process.exitCode = result.decision === "MAINTENANCE_GO" ? 0 : 1;
}
