#!/usr/bin/env node
/*
 * Project Sounding Line policy, inventory, deterministic planning, and the
 * entry point for Phase 2's separately allowlisted local adapters.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import * as runtime from "./runtime.mjs";
import * as phase3 from "./phase3.mjs";
import * as phase4 from "./phase4.mjs";
import { resolveAdapter, resolvePlaywrightAdapter, resolveVitestAdapter } from "./adapters.mjs";
import { validateHostedWaveCapacity, validateHostedWorkflowCapacity } from "./hosted-wave-capacity.mjs";
import { materializeTrustedProjectOwners } from "./project-discovery.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const policyRoot = path.join(repoRoot, "testing");
// Runner-restored dependency layers are not repository source. Including them
// in the local source watermark lets concurrent worker setup perturb otherwise
// identical plans.
const ignoredDirectories = new Set([
  ".git",
  "node_modules",
  ".next",
  "artifacts",
  "coverage",
  "sounding-line-browser-cache",
  "sounding-line-sqlite-baseline",
]);
const ignoredFiles = new Set(["sounding-line-sqlite-baseline-manifest.json"]);
const secretPattern = /(?:api[_-]?key|access[_-]?token|auth[_-]?token|password|secret|private[_-]?key|credential)/iu;
const registryFiles = [
  "ownership.json",
  "contracts.json",
  "resources.json",
  "suites.json",
  "impact-map.json",
  "release-gates.json",
  "quarantine.json",
  "validation-debt.json",
  "file-dispositions.json",
  "test-definition-schema.json",
  "retired-suites.json",
  "browser-capabilities.json",
  "sounding-line-authority.json",
  "evidence-fingerprint-policy.json",
  "prepared-artifacts.json",
  "mainline-train-policy.json",
  "verification-maintenance-policy.json",
  "authority-maintenance-policy.json",
  "root-maintenance-policy.json",
  "control-plane-repair-routes.json",
  "trusted-project-discovery.json",
];

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const canonicalize = (value) => {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`)
      .join(",")}}`;
  return JSON.stringify(value);
};
const stable = (value) => JSON.parse(canonicalize(value));
const output = (value) => process.stdout.write(`${JSON.stringify(stable(value), null, 2)}\n`);
const fail = (message) => {
  process.stderr.write(`SOUNDING_LINE_ERROR ${message}\n`);
  process.exitCode = 1;
};

export async function loadPolicy() {
  const manifest = JSON.parse(await readFile(path.join(policyRoot, "policy-manifest.json"), "utf8"));
  const policy = { manifest };
  for (const file of registryFiles)
    policy[file.replace(/\.json$/u, "")] = JSON.parse(await readFile(path.join(policyRoot, file), "utf8"));
  policy.activeTests = JSON.parse(
    await readFile(path.join(policyRoot, "generated", "active-test-registry.json"), "utf8"),
  );
  policy.digest = sha256(canonicalize(policy));
  return policy;
}

function isSafePath(value) {
  return (
    typeof value === "string" &&
    !path.isAbsolute(value) &&
    !value.includes("..") &&
    !/^[a-z]:/iu.test(value) &&
    !value.includes("\\")
  );
}
function assertKeys(value, allowed, label, errors) {
  for (const key of Object.keys(value)) if (!allowed.includes(key)) errors.push(`${label}: unknown field ${key}`);
}
function scanSensitive(value, label, errors) {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (secretPattern.test(key) && typeof child === "string" && child.length > 0)
      errors.push(`${label}: secret-like value at ${key}`);
    scanSensitive(child, `${label}.${key}`, errors);
  }
}
export function validatePolicy(policy) {
  const errors = [];
  const {
    ownership,
    contracts,
    resources,
    suites,
    "impact-map": impact,
    "release-gates": gates,
    quarantine,
    "validation-debt": debt,
    "test-definition-schema": testDefinitionSchema,
    "retired-suites": retired,
    activeTests,
    manifest,
    "sounding-line-authority": authorityIndex,
    "verification-maintenance-policy": maintenancePolicy,
    "authority-maintenance-policy": authorityMaintenancePolicy,
    "root-maintenance-policy": rootMaintenancePolicy,
    "control-plane-repair-routes": repairRoutePolicy,
    "trusted-project-discovery": trustedProjectDiscovery,
  } = policy;
  assertKeys(
    manifest,
    ["version", "status", "registries", "authority", "plannerAuthority", "phase3"],
    "manifest",
    errors,
  );
  if (!/^\d+\.\d+\.\d+$/u.test(manifest.version)) errors.push("manifest: malformed semantic version");
  for (const file of registryFiles)
    if (!manifest.registries.includes(file)) errors.push(`manifest: missing registry ${file}`);
  assertKeys(
    authorityIndex,
    [
      "authority",
      "currentAuthorityVersion",
      "pendingV14",
      "effectiveV14",
      "correctiveActivation",
      "effectiveAmendments",
      "requiredProtectedAuthorityCheck",
      "runtimeConformance",
      "verificationMaintenance",
      "authorityMaintenance",
      "rootMaintenance",
      "ordinaryCandidateQualification",
      "governingPolicies",
      "developmentValidation",
      "protectedMergeBinding",
      "futureProjectInheritance",
      "hostedExecutionCapacity",
    ],
    "sounding-line-authority",
    errors,
  );
  if (authorityIndex.authority !== "SOUNDING_LINE") errors.push("sounding-line-authority: authority mismatch");
  if (authorityIndex.currentAuthorityVersion !== "1.3" && authorityIndex.currentAuthorityVersion !== "1.4")
    errors.push("sounding-line-authority: current authority version mismatch");
  const v14DocumentMatches = (record) =>
    record?.documentId === "CS-SL-XP-001 v1.4-R1" &&
    record?.documentSha256 === "4D9DE559A24A7A2A8427171EAB679CCD423A1E9BE94FA104CF10B3D14AA31211";
  if (authorityIndex.currentAuthorityVersion === "1.3") {
    if (
      !v14DocumentMatches(authorityIndex.pendingV14) ||
      authorityIndex.pendingV14?.activation !== "PROTECTED_MAINLINE_MERGE_ONLY"
    )
      errors.push("sounding-line-authority: v1.4 pending amendment mismatch");
    if (authorityIndex.effectiveV14 !== undefined || authorityIndex.correctiveActivation !== undefined)
      errors.push("sounding-line-authority: inactive v1.4 cannot carry corrective activation fields");
  }
  if (authorityIndex.currentAuthorityVersion === "1.4") {
    if (
      !v14DocumentMatches(authorityIndex.effectiveV14) ||
      authorityIndex.effectiveV14?.activation !== "OWNER_AUTHORIZED_CORRECTIVE_PROTECTED_MAINLINE_MERGE" ||
      authorityIndex.effectiveV14?.historicalAtomicCutoverRequirement !== "NOT_SATISFIED_HISTORICALLY" ||
      authorityIndex.effectiveV14?.protectedHistory !== "PRESERVED"
    )
      errors.push("sounding-line-authority: effective v1.4 corrective activation mismatch");
    if (
      authorityIndex.pendingV14 !== undefined ||
      authorityIndex.correctiveActivation?.baseAuthorityVersion !== "1.3" ||
      authorityIndex.correctiveActivation?.candidateValidation !== "V13_CUTOVER_NON_MAIN_REF_ONLY" ||
      authorityIndex.correctiveActivation?.qualifiedBaseSha !== "1ebc702d57de63d74c9f80d82a11051446e7b12e" ||
      authorityIndex.correctiveActivation?.candidateRef !==
        "refs/heads/codex/sounding-line-v14-corrective-activation" ||
      authorityIndex.correctiveActivation?.evidenceRequirements !== "NOT_WAIVED"
    )
      errors.push("sounding-line-authority: corrective v1.4 transition mismatch");
  }
  for (const [part, version] of Object.entries({ partI: "1.2", partII: "1.2", partIII: "1.3" }))
    if (authorityIndex.effectiveAmendments?.[part] !== version)
      errors.push(`sounding-line-authority: ${part} must be ${version}`);
  if (authorityIndex.currentAuthorityVersion === "1.4" && authorityIndex.effectiveAmendments?.crossPart !== "1.4")
    errors.push("sounding-line-authority: crossPart must be 1.4 after activation");
  if (authorityIndex.currentAuthorityVersion === "1.3" && authorityIndex.effectiveAmendments?.crossPart !== undefined)
    errors.push("sounding-line-authority: crossPart must remain absent before activation");
  if (authorityIndex.requiredProtectedAuthorityCheck !== "Sounding Line / Mainline Decision")
    errors.push("sounding-line-authority: protected check mismatch");
  const protectedBinding = authorityIndex.protectedMergeBinding;
  if (
    protectedBinding?.enabled !== true ||
    protectedBinding.requiredContext !== authorityIndex.requiredProtectedAuthorityCheck ||
    protectedBinding.authoritativeWorkflowName !== "Sounding Line authoritative" ||
    protectedBinding.qualifiedEvidence !== "SEALED_FINALIZER_ARTIFACT_ONLY" ||
    protectedBinding.semanticCarryForward?.mode !== "FAIL_CLOSED_PATH_CLASSIFICATION" ||
    !Array.isArray(protectedBinding.semanticCarryForward?.unrelatedPathGlobs) ||
    !Array.isArray(protectedBinding.semanticCarryForward?.relevantContractPathGlobs) ||
    !Array.isArray(protectedBinding.legacyQualifiedCandidates)
  )
    errors.push("sounding-line-authority: protected merge binding mismatch");
  if (
    authorityIndex.runtimeConformance?.required !== true ||
    authorityIndex.runtimeConformance?.failureMode !== "FAIL_CLOSED"
  )
    errors.push("sounding-line-authority: runtime conformance must fail closed");
  const maintenance = authorityIndex.verificationMaintenance;
  if (
    maintenance?.version !== "1.4.1" ||
    maintenance?.policy !== "testing/verification-maintenance-policy.json" ||
    maintenance?.trustedMainPolicy !== "REQUIRED" ||
    maintenance?.disposition !== "MAINTENANCE_GO" ||
    maintenance?.releaseAuthority !== "NONE" ||
    maintenance?.ordinaryProductAuthority !== "RELEASE_GO_ONLY" ||
    maintenance?.antiSelfAuthorization !== "FAIL_CLOSED" ||
    maintenance?.protectedBinding !== "EXACT_CANDIDATE_BASE_AND_LANDED_TREE"
  )
    errors.push("sounding-line-authority: verification maintenance policy mismatch");
  const authorityMaintenance = authorityIndex.authorityMaintenance;
  if (
    authorityMaintenance?.version !== "1.4.2" ||
    authorityMaintenance?.policy !== "testing/authority-maintenance-policy.json" ||
    authorityMaintenance?.disposition !== "AUTHORITY_MAINTENANCE_GO" ||
    authorityMaintenance?.releaseAuthority !== "NONE" ||
    authorityMaintenance?.trigger !== "WORKFLOW_DISPATCH_ONLY" ||
    authorityMaintenance?.trustedMainPolicy !== "REQUIRED" ||
    authorityMaintenance?.ownerAuthorization !== "REPOSITORY_OWNER_WORKFLOW_DISPATCH" ||
    authorityMaintenance?.antiSelfAuthorization !== "TRUSTED_BASE_CLASSIFIER_AND_POLICY_REQUIRED" ||
    authorityMaintenance?.protectedBinding !== "EXACT_CANDIDATE_BASE_AND_LANDED_TREE"
  )
    errors.push("sounding-line-authority: authority maintenance policy mismatch");
  const rootMaintenance = authorityIndex.rootMaintenance;
  if (
    rootMaintenance?.version !== "1.0.0" ||
    rootMaintenance?.policy !== "testing/root-maintenance-policy.json" ||
    rootMaintenance?.disposition !== "ROOT_MAINTENANCE_GO" ||
    rootMaintenance?.releaseAuthority !== "NONE" ||
    rootMaintenance?.trigger !== "WORKFLOW_DISPATCH_ONLY" ||
    rootMaintenance?.trustedMainPolicy !== "REQUIRED" ||
    rootMaintenance?.ownerAuthorization !== "REPOSITORY_OWNER_WORKFLOW_DISPATCH" ||
    rootMaintenance?.antiSelfAuthorization !== "TRUSTED_BASE_POLICY_AND_CLASSIFIER_REQUIRED" ||
    rootMaintenance?.protectedBinding !== "EXACT_CANDIDATE_BASE_AND_LANDED_TREE" ||
    rootMaintenance?.rootRepairFallback !== "OWNER_AUTHORIZED_BREAK_GLASS_ONLY_FOR_ROOT_MAINTENANCE_DEFECT"
  )
    errors.push("sounding-line-authority: root maintenance policy mismatch");
  const ordinaryCandidate = authorityIndex.ordinaryCandidateQualification;
  if (
    ordinaryCandidate?.mode !== "V14_CANDIDATE" ||
    ordinaryCandidate?.trustedWorkflowRef !== "refs/heads/main" ||
    ordinaryCandidate?.gate !== "mainline" ||
    ordinaryCandidate?.releaseDisposition !== "RELEASE_GO" ||
    ordinaryCandidate?.currentClaim !== "FORBIDDEN" ||
    ordinaryCandidate?.protectedBinding !== "REQUIRED"
  )
    errors.push("sounding-line-authority: ordinary candidate qualification mismatch");
  const mses = ordinaryCandidate?.minimumSufficientEvidence;
  if (
    mses?.selectionMode !== "EXACT_SEMANTIC_IMPACT_WITH_REQUIRED_SENTINELS" ||
    !Array.isArray(mses?.requiredSafetySentinelSuiteIds) ||
    !mses.requiredSafetySentinelSuiteIds.length ||
    !mses.requiredSafetySentinelSuiteIds.every((suiteId) => suites.suites.some((suite) => suite.id === suiteId)) ||
    mses?.unmappedDisposition !== "CONSERVATIVE_FALLBACK" ||
    !Array.isArray(mses?.exhaustiveGateIds) ||
    !mses.exhaustiveGateIds.includes("release-candidate") ||
    !Number.isInteger(mses?.performanceObjectiveMs) ||
    !Number.isInteger(mses?.performanceCeilingMs) ||
    mses.performanceObjectiveMs > mses.performanceCeilingMs ||
    mses.performanceCeilingMs > 900000
  )
    errors.push("sounding-line-authority: minimum sufficient evidence performance contract mismatch");
  if (
    maintenancePolicy?.authority !== "SOUNDING_LINE_VERIFICATION_MAINTENANCE" ||
    maintenancePolicy?.trustedMainOnly !== true ||
    maintenancePolicy?.protectedContext !== authorityIndex.requiredProtectedAuthorityCheck ||
    !Array.isArray(maintenancePolicy?.eligiblePathGlobs) ||
    !maintenancePolicy.eligiblePathGlobs.length ||
    !Array.isArray(maintenancePolicy?.authorityChangePathGlobs) ||
    !maintenancePolicy.authorityChangePathGlobs.length ||
    !Array.isArray(maintenancePolicy?.requiredEvidence) ||
    !maintenancePolicy.requiredEvidence.length
  )
    errors.push("verification-maintenance-policy: fail-closed contract mismatch");
  if (
    authorityMaintenancePolicy?.authority !== "SOUNDING_LINE_AUTHORITY_MAINTENANCE" ||
    authorityMaintenancePolicy?.disposition !== "AUTHORITY_MAINTENANCE_GO" ||
    authorityMaintenancePolicy?.workflowDispatchOnly !== true ||
    authorityMaintenancePolicy?.trustedMainOnly !== true ||
    authorityMaintenancePolicy?.ownerAuthorization !== "REPOSITORY_OWNER_WORKFLOW_DISPATCH" ||
    !Array.isArray(authorityMaintenancePolicy?.eligiblePathGlobs) ||
    !authorityMaintenancePolicy.eligiblePathGlobs.length ||
    !Array.isArray(authorityMaintenancePolicy?.requiredEvidence) ||
    !authorityMaintenancePolicy.requiredEvidence.includes("ANTI_SELF_AUTHORIZATION")
  )
    errors.push("authority-maintenance-policy: fail-closed contract mismatch");
  if (
    rootMaintenancePolicy?.authority !== "SOUNDING_LINE_ROOT_MAINTENANCE" ||
    rootMaintenancePolicy?.disposition !== "ROOT_MAINTENANCE_GO" ||
    rootMaintenancePolicy?.workflowDispatchOnly !== true ||
    rootMaintenancePolicy?.trustedMainOnly !== true ||
    rootMaintenancePolicy?.ownerAuthorization !== "REPOSITORY_OWNER_WORKFLOW_DISPATCH" ||
    rootMaintenancePolicy?.releaseAuthority !== "NONE" ||
    !Array.isArray(rootMaintenancePolicy?.eligiblePathGlobs) ||
    !rootMaintenancePolicy.eligiblePathGlobs.length ||
    !Array.isArray(rootMaintenancePolicy?.runtimeRepairClasses) ||
    rootMaintenancePolicy.runtimeRepairClasses.length !== 1 ||
    rootMaintenancePolicy.runtimeRepairClasses[0]?.id !== "NIGHTWATCH_BOSUN_RUNTIME" ||
    rootMaintenancePolicy.runtimeRepairClasses[0]?.disposition !== "ROOT_MAINTENANCE_ONLY" ||
    rootMaintenancePolicy.runtimeRepairClasses[0]?.policyMutation !== "BREAK_GLASS_ONLY" ||
    JSON.stringify(rootMaintenancePolicy.runtimeRepairClasses[0]?.pathGlobs) !==
      JSON.stringify(["src/nightwatch/**", "scripts/nightwatch/**"]) ||
    !Array.isArray(rootMaintenancePolicy?.bindingPreflightPaths) ||
    !rootMaintenancePolicy.bindingPreflightPaths.length ||
    !Array.isArray(rootMaintenancePolicy?.requiredEvidence) ||
    !rootMaintenancePolicy.requiredEvidence.includes("ROOT_ANTI_SELF_AUTHORIZATION") ||
    repairRoutePolicy?.authority !== "SOUNDING_LINE_CONTROL_PLANE_REPAIR_ROUTE_INVARIANT" ||
    repairRoutePolicy?.failurePrefix !== "CONTROL_PLANE_REPAIR_ROUTE_INCOMPLETE" ||
    !Array.isArray(repairRoutePolicy?.baselineSourcePaths) ||
    !repairRoutePolicy.baselineSourcePaths.length ||
    JSON.stringify(repairRoutePolicy?.runtimePrerequisiteRoots) !==
      JSON.stringify(["src/nightwatch", "scripts/nightwatch"])
  )
    errors.push("root-maintenance-policy: fail-closed contract mismatch");
  if (
    trustedProjectDiscovery?.authority !== "SOUNDING_LINE_TRUSTED_MAIN_PROJECT_DISCOVERY" ||
    trustedProjectDiscovery?.sourceBound !== true ||
    !Array.isArray(trustedProjectDiscovery?.projects) ||
    trustedProjectDiscovery.projects.some(
      (entry) =>
        !/^project-[a-z0-9-]+$/u.test(entry?.id ?? "") ||
        !Array.isArray(entry?.evidencePaths) ||
        !entry.evidencePaths.length ||
        !Array.isArray(entry?.sourcePaths) ||
        !entry.sourcePaths.length,
    )
  )
    errors.push("trusted-project-discovery: fail-closed contract mismatch");
  if (
    !Array.isArray(maintenancePolicy?.ordinaryCandidateEligiblePathGlobs) ||
    !maintenancePolicy.ordinaryCandidateEligiblePathGlobs.length ||
    maintenancePolicy.ordinaryCandidateEligiblePathGlobs.some((entry) =>
      maintenancePolicy.authorityChangePathGlobs.includes(entry),
    )
  )
    errors.push("verification-maintenance-policy: ordinary candidate boundary mismatch");
  const governanceDocumentation = maintenancePolicy?.ordinaryCandidateGovernanceDocumentation;
  if (
    governanceDocumentation?.classification !== "GOVERNANCE_DOCUMENTATION_ONLY" ||
    !Array.isArray(governanceDocumentation?.pathGlobs) ||
    !governanceDocumentation.pathGlobs.length ||
    !Array.isArray(governanceDocumentation?.excludedPathGlobs) ||
    !governanceDocumentation.excludedPathGlobs.length ||
    governanceDocumentation.pathGlobs.some((entry) => maintenancePolicy.authorityChangePathGlobs.includes(entry)) ||
    governanceDocumentation.excludedPathGlobs.some((entry) =>
      maintenancePolicy.authorityChangePathGlobs.includes(entry),
    )
  )
    errors.push("verification-maintenance-policy: governance documentation boundary mismatch");
  const registration = maintenancePolicy?.ordinaryCandidateProductVerificationRegistration;
  if (
    registration?.classification !== "PRODUCT_WITH_VERIFICATION_REGISTRATION" ||
    registration?.semanticOwnership !== "TRUSTED_OWNERSHIP_OR_TRUSTED_DISCOVERY_DESCRIPTOR" ||
    registration?.monotonicity !== "NO_FOREIGN_MUTATION_OR_REMOVAL" ||
    !Array.isArray(registration?.pathGlobs) ||
    !registration.pathGlobs.length ||
    !Array.isArray(registration?.semanticPathGlobs) ||
    !registration.semanticPathGlobs.length ||
    registration.semanticPathGlobs.some((entry) => !registration.pathGlobs.includes(entry)) ||
    !Array.isArray(registration?.ancillaryPathGlobs) ||
    !Array.isArray(registration?.sourceBoundFeatureCatalogReconciliationPathGlobs) ||
    !registration.sourceBoundFeatureCatalogReconciliationPathGlobs.length ||
    registration.sourceBoundFeatureCatalogReconciliationPathGlobs.some(
      (entry) => entry !== "Development_Docs/Features/branch-complete/*.json",
    ) ||
    !Array.isArray(registration?.playwrightConfigPathGlobs) ||
    !Array.isArray(registration?.testRegistrySourcePathGlobs) ||
    !Array.isArray(registration?.sharedVerificationSuiteIds) ||
    registration.pathGlobs.some((entry) => maintenancePolicy.authorityChangePathGlobs.includes(entry))
  )
    errors.push("verification-maintenance-policy: product verification registration boundary mismatch");
  if (authorityIndex.governingPolicies?.proofMinimization !== "MINIMUM_SUFFICIENT_EVIDENCE")
    errors.push("sounding-line-authority: proof minimization mismatch");
  if (authorityIndex.governingPolicies?.semanticInvalidation !== "EVIDENCE_PRESERVATION_REQUIRED")
    errors.push("sounding-line-authority: semantic invalidation mismatch");
  const recordOnlyClosure = authorityIndex.governingPolicies?.recordOnlyClosure;
  if (
    recordOnlyClosure?.mode !== "FAIL_CLOSED_PROTECTED_MERGE_FINALIZATION" ||
    !Array.isArray(recordOnlyClosure.allowedRecordPathClasses) ||
    !Array.isArray(recordOnlyClosure.requiredEvidence) ||
    !recordOnlyClosure.requiredEvidence.includes("PRIOR_PROTECTED_RELEASE_GO") ||
    !recordOnlyClosure.requiredEvidence.includes("GENERATED_RECORD_CONSISTENCY")
  )
    errors.push("sounding-line-authority: record-only closure policy mismatch");
  if (
    authorityIndex.developmentValidation?.incrementalVerificationRequired !== true ||
    authorityIndex.developmentValidation?.authoritativeDebuggingForbidden !== true ||
    authorityIndex.developmentValidation?.focusedRepairRequiredBeforeReacceptance !== true ||
    authorityIndex.developmentValidation?.authoritativeInvocation !== "EXPLICIT_FROZEN_CANDIDATE_ONLY"
  )
    errors.push("sounding-line-authority: development/finalization boundary mismatch");
  if (authorityIndex.futureProjectInheritance !== true)
    errors.push("sounding-line-authority: future-project inheritance must be enabled");
  const hostedCapacity = validateHostedWaveCapacity({
    capacity: authorityIndex.hostedExecutionCapacity,
    suites: suites.suites,
  });
  errors.push(...hostedCapacity.errors.map((error) => `sounding-line-authority: ${error}`));
  try {
    const workflow = readFileSync(
      path.join(repoRoot, ".github", "workflows", "sounding-line-authoritative.yml"),
      "utf8",
    );
    const workflowCapacity = validateHostedWorkflowCapacity({
      capacity: authorityIndex.hostedExecutionCapacity,
      workflow,
    });
    errors.push(...workflowCapacity.errors.map((error) => `sounding-line-authority: ${error}`));
  } catch (error) {
    errors.push(
      `sounding-line-authority: HOSTED_WAVE_CAPACITY_WORKFLOW_UNREADABLE:${error instanceof Error ? (error.code ?? "unknown") : "unknown"}`,
    );
  }
  const ids = (items, label) => {
    const seen = new Set();
    for (const item of items) {
      if (!item.id || !/^[a-z][a-z0-9.-]*$/u.test(item.id)) errors.push(`${label}: invalid id ${item.id ?? "missing"}`);
      if (seen.has(item.id)) errors.push(`${label}: duplicate id ${item.id}`);
      seen.add(item.id);
    }
    return seen;
  };
  const trustedOwnerMaterialization = materializeTrustedProjectOwners({
    sourceRegistry: trustedProjectDiscovery,
    owners: ownership.owners,
  });
  errors.push(...trustedOwnerMaterialization.errors);
  const effectiveOwners = trustedOwnerMaterialization.owners;
  const ownerIds = ids(effectiveOwners, "owners");
  const contractIds = ids(contracts.contracts, "contracts");
  const resourceIds = ids(resources.resources, "resources");
  const suiteIds = ids(suites.suites, "suites");
  const gateIds = ids(gates.gates, "gates");
  for (const field of testDefinitionSchema.required ?? [])
    if (typeof field !== "string") errors.push("test-definition-schema: invalid required field");
  for (const record of retired.retired ?? []) {
    if (
      record.status !== "ARCHIVED_HISTORICAL_MATRIX" ||
      record.active ||
      record.selectable ||
      record.plannerAuthority !== "none" ||
      record.ciAuthority !== "none" ||
      record.releaseAuthority !== "none"
    )
      errors.push(`retired suite ${record.id}: invalid retirement state`);
    for (const gate of gates.gates)
      if ([...gate.requiredSuites, ...gate.conditionalSuites].some((id) => id.toLowerCase().includes("p34")))
        errors.push(`gate ${gate.id}: active P34 reference`);
  }
  const activeIds = new Set();
  const semanticIds = new Set();
  const historicalAliases = new Set();
  for (const definition of activeTests.cases ?? []) {
    for (const field of testDefinitionSchema.required ?? [])
      if (definition[field] === undefined || definition[field] === null || definition[field] === "")
        errors.push(`test definition ${definition.id ?? "missing"}: missing ${field}`);
    if (!/^sl-test-[a-f0-9]{20}$/u.test(definition.id ?? ""))
      errors.push(`test definition: invalid generated id ${definition.id ?? "missing"}`);
    if (activeIds.has(definition.id)) errors.push(`test definition: duplicate generated id ${definition.id}`);
    activeIds.add(definition.id);
    if (!/^sl-semantic-[a-f0-9]{20}$/u.test(definition.semanticId ?? ""))
      errors.push(`test definition: invalid semantic id ${definition.semanticId ?? "missing"}`);
    if (semanticIds.has(definition.semanticId))
      errors.push(`test definition: duplicate semantic id ${definition.semanticId}`);
    semanticIds.add(definition.semanticId);
    for (const alias of definition.historicalAliases ?? []) {
      if (!/^sl-test-[a-f0-9]{20}$/u.test(alias))
        errors.push(`test definition ${definition.id}: invalid historical alias ${alias}`);
      if (alias === definition.id || activeIds.has(alias))
        errors.push(`test definition ${definition.id}: historical alias collides with active id ${alias}`);
      if (historicalAliases.has(alias))
        errors.push(`test definition ${definition.id}: ambiguous historical alias ${alias}`);
      historicalAliases.add(alias);
    }
    if (!suiteIds.has(definition.suiteId))
      errors.push(`test definition ${definition.id}: unknown suite ${definition.suiteId}`);
    if (!ownerIds.has(definition.owner))
      errors.push(`test definition ${definition.id}: unknown owner ${definition.owner}`);
    if (!Number.isInteger(definition.tier) || definition.tier < 0 || definition.tier > 7)
      errors.push(`test definition ${definition.id}: invalid tier`);
    if (!testDefinitionSchema.enums.risk.includes(definition.risk))
      errors.push(`test definition ${definition.id}: invalid risk`);
    if (!testDefinitionSchema.enums.parallelSafety.includes(definition.parallelSafety))
      errors.push(`test definition ${definition.id}: invalid parallel safety`);
    if (!testDefinitionSchema.enums.retryPolicy.includes(definition.retryPolicy))
      errors.push(`test definition ${definition.id}: invalid retry policy`);
    for (const id of definition.contracts ?? [])
      if (!contractIds.has(id)) errors.push(`test definition ${definition.id}: unknown contract ${id}`);
    for (const id of definition.resources ?? [])
      if (!resourceIds.has(id)) errors.push(`test definition ${definition.id}: unknown resource ${id}`);
    for (const id of definition.gates ?? [])
      if (!gateIds.has(id)) errors.push(`test definition ${definition.id}: unknown gate ${id}`);
    if (
      !Number.isFinite(definition.expectedDurationMs) ||
      definition.expectedDurationMs <= 0 ||
      definition.hardBudgetMs <= definition.expectedDurationMs
    )
      errors.push(`test definition ${definition.id}: invalid duration budget`);
    if (!Array.isArray(definition.contracts) || !definition.contracts.length)
      errors.push(`test definition ${definition.id}: missing protected contract`);
    if (!Array.isArray(definition.positiveCases) || !definition.positiveCases.length)
      errors.push(`test definition ${definition.id}: missing positive coverage declaration`);
    if (
      ["HIGH", "CRITICAL", "RELEASE_CRITICAL"].includes(definition.risk) &&
      (!Array.isArray(definition.negativeCases) ||
        !definition.negativeCases.length ||
        definition.negativeCases.includes("NOT_APPLICABLE"))
    )
      errors.push(`test definition ${definition.id}: high-risk definition lacks negative coverage`);
    for (const field of [
      "browserRequirements",
      "deviceRequirements",
      "viewportRequirements",
      "motionRequirements",
      "networkRequirements",
    ])
      if (!Array.isArray(definition[field]) || !definition[field].length)
        errors.push(`test definition ${definition.id}: missing ${field}`);
    for (const field of [
      "accessibilityRelevance",
      "privacyRelevance",
      "securityRelevance",
      "dataMutationClass",
      "currentStatus",
    ])
      if (typeof definition[field] !== "string" || !definition[field])
        errors.push(`test definition ${definition.id}: missing ${field}`);
  }
  for (const alias of historicalAliases)
    if (activeIds.has(alias)) errors.push(`test definition: historical alias collides with active id ${alias}`);
  for (const owner of effectiveOwners) {
    assertKeys(
      owner,
      ["id", "project", "sourcePaths", "testPaths", "contractIds", "supportingOwnerIds"],
      `owner ${owner.id}`,
      errors,
    );
    for (const value of [...owner.sourcePaths, ...owner.testPaths])
      if (!isSafePath(value)) errors.push(`owner ${owner.id}: unsafe path ${value}`);
    for (const id of owner.contractIds)
      if (!contractIds.has(id)) errors.push(`owner ${owner.id}: missing contract ${id}`);
    if (
      owner.supportingOwnerIds !== undefined &&
      (!Array.isArray(owner.supportingOwnerIds) ||
        owner.supportingOwnerIds.some((id) => typeof id !== "string" || !ownerIds.has(id) || id === owner.id))
    )
      errors.push(`owner ${owner.id}: invalid supporting owner`);
  }
  for (const contract of contracts.contracts) {
    assertKeys(contract, ["id", "name", "authority", "owners", "critical"], `contract ${contract.id}`, errors);
    if (!ownerIds.has(contract.authority))
      errors.push(`contract ${contract.id}: missing authority ${contract.authority}`);
    for (const owner of contract.owners)
      if (!ownerIds.has(owner)) errors.push(`contract ${contract.id}: missing owner ${owner}`);
  }
  for (const suite of suites.suites) {
    assertKeys(
      suite,
      [
        "id",
        "name",
        "tier",
        "owner",
        "command",
        "estimatedDuration",
        "parallelSafe",
        "resources",
        "dependencies",
        "contracts",
        "affectedPaths",
        "releaseGates",
        "currentImplementationState",
        "adapter",
        "testFiles",
        "expectedDurationMs",
        "hardBudgetMs",
      ],
      `suite ${suite.id}`,
      errors,
    );
    if (!ownerIds.has(suite.owner)) errors.push(`suite ${suite.id}: missing owner ${suite.owner}`);
    if (!Number.isInteger(suite.tier) || suite.tier < 0 || suite.tier > 7)
      errors.push(`suite ${suite.id}: invalid tier`);
    for (const id of suite.resources)
      if (!resourceIds.has(id)) errors.push(`suite ${suite.id}: missing resource ${id}`);
    for (const id of suite.dependencies)
      if (!suiteIds.has(id)) errors.push(`suite ${suite.id}: missing dependency ${id}`);
    for (const id of suite.contracts)
      if (!contractIds.has(id)) errors.push(`suite ${suite.id}: missing contract ${id}`);
    for (const id of suite.releaseGates) if (!gateIds.has(id)) errors.push(`suite ${suite.id}: missing gate ${id}`);
    for (const value of suite.affectedPaths)
      if (!isSafePath(value)) errors.push(`suite ${suite.id}: unsafe affected path ${value}`);
    if (suite.adapter !== undefined && typeof suite.adapter !== "string")
      errors.push(`suite ${suite.id}: invalid adapter`);
    if (!suite.adapter && (!Array.isArray(suite.testFiles) || !suite.testFiles.length))
      errors.push(`suite ${suite.id}: missing governed adapter`);
    if (typeof suite.adapter === "string") {
      try {
        resolveAdapter(suite.adapter);
      } catch {
        errors.push(`suite ${suite.id}: unknown governed adapter ${suite.adapter}`);
      }
    }
    if (
      !Number.isFinite(suite.expectedDurationMs) ||
      !Number.isFinite(suite.hardBudgetMs) ||
      suite.expectedDurationMs <= 0 ||
      suite.hardBudgetMs <= suite.expectedDurationMs
    )
      errors.push(`suite ${suite.id}: invalid measured duration budget`);
    if (
      suite.testFiles !== undefined &&
      (!Array.isArray(suite.testFiles) || suite.testFiles.some((value) => !isSafePath(value)))
    )
      errors.push(`suite ${suite.id}: invalid test files`);
  }
  for (const legacy of [
    "unit.core",
    "compatibility.browser",
    "contract.wayfarer-history",
    "security.private-content",
    "harborlight.phase4.unit",
  ])
    if (suiteIds.has(legacy)) errors.push(`stage-10 catalog retains transitional suite ${legacy}`);
  const bySuite = new Map();
  for (const definition of activeTests.cases ?? [])
    bySuite.set(definition.suiteId, (bySuite.get(definition.suiteId) ?? 0) + 1);
  for (const suite of suites.suites)
    if (
      ["vitest-family", "vitest-family-serial", "node-test-browser-family", "playwright-family"].includes(
        suite.adapter,
      ) &&
      !bySuite.get(suite.id)
    )
      errors.push(`suite ${suite.id}: empty active family`);
  for (const gate of gates.gates) {
    assertKeys(gate, ["id", "requiredSuites", "conditionalSuites"], `gate ${gate.id}`, errors);
    for (const id of [...gate.requiredSuites, ...gate.conditionalSuites])
      if (!suiteIds.has(id)) errors.push(`gate ${gate.id}: missing producer suite ${id}`);
  }
  for (const mapping of [...impact.pathMappings, ...impact.contractMappings]) {
    for (const id of mapping.suiteIds) if (!suiteIds.has(id)) errors.push(`impact map: missing suite ${id}`);
    for (const id of mapping.contractIds ?? [mapping.contractId])
      if (id && !contractIds.has(id)) errors.push(`impact map: missing contract ${id}`);
    if (mapping.path && !isSafePath(mapping.path)) errors.push(`impact map: unsafe path ${mapping.path}`);
  }
  for (const entry of quarantine.entries) {
    for (const field of quarantine.requiredFields) if (!(field in entry)) errors.push(`quarantine: missing ${field}`);
    if (!suiteIds.has(entry.suiteId)) errors.push(`quarantine: unknown suite ${entry.suiteId}`);
  }
  for (const entry of debt.entries) {
    if (!entry.id || !ownerIds.has(entry.owner) || !entry.reason || !entry.effect)
      errors.push(`SLP1010 validation debt: invalid entry ${entry.id ?? "missing"}`);
    if (!entry.targetPhase || !entry.classification || !entry.releaseEffect || !entry.reviewTrigger)
      errors.push(`SLP1011 validation debt: incomplete closure fields ${entry.id ?? "missing"}`);
    if (
      ![
        "PHASE_1_RESOLVABLE_NOW",
        "PHASE_2_OWNED",
        "POST_HARBORLIGHT_RECONCILIATION",
        "EXTERNAL_VALIDATION",
        "LEGACY_HARNESS_RETIREMENT",
      ].includes(entry.classification)
    )
      errors.push(`SLP1012 validation debt: invalid classification ${entry.id}`);
  }
  scanSensitive(policy, "policy", errors);
  const dispositions = policy["file-dispositions"];
  for (const rule of dispositions.rules) {
    if (!suiteIds.has(rule.suiteId)) errors.push(`SLP1001 disposition: missing parent suite ${rule.suiteId}`);
    if (!ownerIds.has(rule.owner)) errors.push(`SLP1002 disposition: missing owner ${rule.owner}`);
    if (!isSafePath(rule.match)) errors.push(`SLP1003 disposition: unsafe match ${rule.match}`);
    if (
      ![
        "REGISTERED_SUITE_CHILD",
        "REGISTERED_SETUP_NODE",
        "REGISTERED_TEARDOWN_NODE",
        "REGISTERED_FIXTURE",
        "REGISTERED_ADAPTER",
        "INTENTIONALLY_EXCLUDED",
        "DISCOVERED_UNREGISTERED",
        "OBSOLETE_CANDIDATE",
        "UNKNOWN",
      ].includes(rule.role)
    )
      errors.push(`SLP1004 disposition: invalid role ${rule.role}`);
  }
  return {
    ok: errors.length === 0,
    errors,
    counts: {
      suites: suites.suites.length,
      contracts: contracts.contracts.length,
      owners: effectiveOwners.length,
      resources: resources.resources.length,
      gates: gates.gates.length,
      quarantine: quarantine.entries.length,
      validationDebt: debt.entries.length,
    },
  };
}

async function walk(relative = "") {
  const directory = path.join(repoRoot, relative);
  const entries = await readdir(directory, { withFileTypes: true });
  const results = [];
  for (const entry of entries) {
    const child = path.join(relative, entry.name).replace(/\\/gu, "/");
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) results.push(...(await walk(child)));
    } else if (entry.isFile() && !ignoredFiles.has(entry.name)) results.push(child);
  }
  return results;
}
const globRegex = (pattern) =>
  new RegExp(
    `^${pattern
      .replace(/[.+^${}()|[\]\\]/gu, "\\$&")
      .replace(/\*\*/gu, "§")
      .replace(/\*/gu, "[^/]*")
      .replace(/§/gu, ".*")}$`,
    "u",
  );
const matches = (candidate, pattern) => globRegex(pattern).test(candidate);
function registeredForFile(file, suites) {
  return suites.filter((suite) => suite.affectedPaths.some((pattern) => matches(file, pattern)));
}

async function inventory(policy) {
  const files = await walk();
  const vitest = files.filter((file) =>
    /(?:^src\/.*\.test\.(?:ts|tsx)|^tests\/private-content\/.*\.test\.(?:ts|tsx)|^scripts\/features\/.*\.test\.ts)$/u.test(
      file,
    ),
  );
  const playwright = files.filter((file) => /^tests\/e2e\/.*\.spec\.ts$/u.test(file));
  const powershell = files.filter((file) => /^scripts\/.*\.ps1$/u.test(file));
  const hardCodedPorts = [];
  const lockFiles = [];
  const databasePaths = [];
  for (const file of files.filter((item) => /(?:\.ts|\.tsx|\.mjs|\.ps1|\.json)$/u.test(item))) {
    const content = await readFile(path.join(repoRoot, file), "utf8");
    if (/\b(?:3100|3200)\b/u.test(content)) hardCodedPorts.push(file);
    if (/validation-runtime\.lock/u.test(content)) lockFiles.push(file);
    if (/(?:dev\.db|DATABASE_URL|schema\.sqlite\.prisma)/u.test(content)) databasePaths.push(file);
  }
  const packageJson = JSON.parse(await readFile(path.join(repoRoot, "package.json"), "utf8"));
  const discovered = [...vitest, ...playwright];
  const unregistered = discovered.filter((file) => registeredForFile(file, policy.suites.suites).length === 0);
  const duplicateExecution = discovered
    .filter((file) => registeredForFile(file, policy.suites.suites).length > 1)
    .map((file) => ({
      file,
      suiteIds: registeredForFile(file, policy.suites.suites)
        .map((suite) => suite.id)
        .sort(),
    }));
  const dispositionFor = (file) => policy["file-dispositions"].rules.find((rule) => matches(file, rule.match));
  const mapFile = (file, family) => {
    const rule = dispositionFor(file);
    if (!rule) return { path: file, family, disposition: "DISCOVERED_UNREGISTERED", errorCode: "SLP2001" };
    const suite = policy.suites.suites.find((item) => item.id === rule.suiteId);
    return {
      path: file,
      family,
      disposition: rule.role,
      parentSuiteId: rule.suiteId,
      owner: rule.owner,
      tier: rule.tier,
      adapter: rule.adapter,
      parallelSafety: rule.parallelSafety,
      contracts: suite.contracts,
      resources: suite.resources,
      executionAdapter: suite.command,
    };
  };
  const fileMappings = [
    ...vitest.map((file) => mapFile(file, "vitest")),
    ...playwright.map((file) => mapFile(file, "playwright")),
    ...powershell.map((file) => mapFile(file, "powershell")),
  ].sort((a, b) => a.path.localeCompare(b.path));
  const byFamily = Object.fromEntries(
    ["vitest", "playwright", "powershell"].map((family) => {
      const rows = fileMappings.filter((row) => row.family === family);
      const count = (value) => rows.filter((row) => row.disposition === value).length;
      return [
        family,
        {
          discovered: rows.length,
          mapped: rows.filter((row) => row.parentSuiteId).length,
          excluded: count("INTENTIONALLY_EXCLUDED"),
          unknown: count("UNKNOWN"),
          unregistered: count("DISCOVERED_UNREGISTERED"),
          reconciled:
            rows.length ===
            rows.filter(
              (row) =>
                row.parentSuiteId ||
                row.disposition === "INTENTIONALLY_EXCLUDED" ||
                row.disposition === "OBSOLETE_CANDIDATE" ||
                row.disposition === "UNKNOWN" ||
                row.disposition === "DISCOVERED_UNREGISTERED",
            ).length,
        },
      ];
    }),
  );
  const criticalUnknowns = fileMappings.filter(
    (row) => row.disposition === "UNKNOWN" || row.disposition === "DISCOVERED_UNREGISTERED",
  );
  return {
    schemaVersion: "1.0.0",
    sourceWatermark: sha256(canonicalize(files)),
    readOnly: true,
    commands: Object.keys(packageJson.scripts).sort(),
    files: { vitest, playwright, powershell },
    resources: {
      hardCodedPortFiles: hardCodedPorts.sort(),
      lockFiles: lockFiles.sort(),
      databasePathFiles: databasePaths.sort(),
    },
    reconciliation: {
      discoveredTestFiles: discovered.length,
      unregistered,
      duplicateExecution,
      registeredSuites: policy.suites.suites.map((suite) => suite.id).sort(),
    },
    fileMappings,
    completeness: {
      status: criticalUnknowns.length
        ? "INCOMPLETE"
        : policy["validation-debt"].entries.length
          ? "COMPLETE_WITH_NONCRITICAL_DEBT"
          : "COMPLETE",
      byFramework: byFamily,
      logicalSuiteCount: policy.suites.suites.length,
      suiteChildCount: fileMappings.filter((row) => row.disposition === "REGISTERED_SUITE_CHILD").length,
      criticalUnknownCount: criticalUnknowns.length,
      unresolvedMappingDefects: criticalUnknowns.map((row) => row.path),
    },
  };
}

function addWithDependencies(selected, reasons, suiteId, reason, suitesById) {
  if (!selected.has(suiteId)) selected.add(suiteId);
  if (!reasons.has(suiteId)) reasons.set(suiteId, []);
  reasons.get(suiteId).push(reason);
  for (const dependency of suitesById.get(suiteId).dependencies)
    addWithDependencies(selected, reasons, dependency, `dependency of ${suiteId}`, suitesById);
}
async function plan(policy, changedPaths, scope) {
  const suitesById = new Map(policy.suites.suites.map((suite) => [suite.id, suite]));
  const selected = new Set();
  const reasons = new Map();
  let uncertain = false;
  if (scope === "release") {
    for (const suite of policy.suites.suites)
      addWithDependencies(selected, reasons, suite.id, "release scope is comprehensive", suitesById);
  } else {
    for (const changed of changedPaths) {
      let matched = false;
      for (const mapping of policy["impact-map"].pathMappings)
        if (matches(changed, mapping.path)) {
          matched = true;
          for (const suiteId of mapping.suiteIds)
            addWithDependencies(selected, reasons, suiteId, `direct impact path ${changed}`, suitesById);
          for (const contractId of mapping.contractIds)
            for (const mappingByContract of policy["impact-map"].contractMappings.filter(
              (item) => item.contractId === contractId,
            ))
              for (const suiteId of mappingByContract.suiteIds)
                addWithDependencies(selected, reasons, suiteId, `contract expansion ${contractId}`, suitesById);
        }
      for (const owner of policy.ownership.owners)
        if (owner.sourcePaths.some((pattern) => matches(changed, pattern))) {
          matched = true;
          for (const suite of policy.suites.suites.filter((suite) => suite.owner === owner.id))
            addWithDependencies(selected, reasons, suite.id, `owner expansion ${owner.id} for ${changed}`, suitesById);
        }
      if (!matched) uncertain = true;
    }
    if (uncertain)
      for (const suite of policy.suites.suites)
        addWithDependencies(selected, reasons, suite.id, "uncertain impact broadening", suitesById);
  }
  const selectedEntries = [...selected]
    .sort()
    .map((id) => ({ suiteId: id, reasons: [...new Set(reasons.get(id))].sort() }));
  const omitted = policy.suites.suites
    .filter((suite) => !selected.has(suite.id))
    .map((suite) => ({ suiteId: suite.id, reason: "outside declared impact and no uncertainty" }))
    .sort((a, b) => a.suiteId.localeCompare(b.suiteId));
  const graph = selectedEntries.map(({ suiteId }) => ({
    suiteId,
    dependsOn: suitesById
      .get(suiteId)
      .dependencies.filter((id) => selected.has(id))
      .sort(),
  }));
  const sourceFiles = await walk();
  const result = {
    schemaVersion: "1.0.0",
    nonAuthoritative: true,
    execution: "governed-local",
    policyDigest: policy.digest,
    sourceDigest: sha256(canonicalize(sourceFiles)),
    scope,
    requestedPaths: [...new Set(changedPaths)].sort(),
    uncertaintyBroadened: uncertain,
    selected: selectedEntries,
    omitted,
    graph,
  };
  return { ...result, digest: sha256(canonicalize(result)) };
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  const loadPhase4Json = async (value) => {
    if (!isSafePath(value)) throw new Error("phase4 input must be a safe repository-relative JSON path");
    return JSON.parse(await readFile(path.join(repoRoot, value), "utf8"));
  };
  if (command === "phase4") {
    const [operation, ...values] = args;
    if (operation === "plan-parity" && values.length === 2) {
      output({
        ...phase4.comparePlans(await loadPhase4Json(values[0]), await loadPhase4Json(values[1])),
        nonAuthoritative: true,
      });
      return;
    }
    if (operation === "dual-run" && values.length === 2) {
      output({
        ...phase4.compareDualRun(await loadPhase4Json(values[0]), await loadPhase4Json(values[1])),
        nonAuthoritative: true,
      });
      return;
    }
    if (operation === "release" && values.length === 1) {
      output({ ...phase4.decideRelease(await loadPhase4Json(values[0])), nonAuthoritative: true });
      return;
    }
    if (operation === "cutover" && values.length === 3) {
      output({
        ...phase4.transitionCutover(values[0], values[1], await loadPhase4Json(values[2])),
        nonAuthoritative: true,
      });
      return;
    }
    throw new Error(
      "phase4 usage: plan-parity <local.json> <ci.json> | dual-run <legacy.json> <sounding-line.json> | release <input.json> | cutover <current> <next> <evidence.json>",
    );
  }
  const policy = await loadPolicy();
  if (command === "history") {
    const operation = args[0];
    const store = await phase3.openHistory(process.env.SOUNDING_LINE_HISTORY_ROOT ?? phase3.defaultHistoryRoot());
    try {
      if (operation === "init" || operation === "migrate")
        return output({
          status: "READY",
          schemaVersion: phase3.PHASE3_SCHEMA_VERSION,
          locationPolicy: "outside-worktree",
          root: store.root,
        });
      if (operation === "status")
        return output({
          status: "READY",
          schemaVersion: phase3.PHASE3_SCHEMA_VERSION,
          integrity: store.db.prepare("PRAGMA integrity_check").get()["integrity_check"],
        });
      if (operation === "verify") return output(phase3.verifyHistory(store));
      if (operation === "export-manifest") return output(phase3.exportHistoryManifest(store));
      if (operation === "prune")
        return output(phase3.pruneHistory(store, JSON.parse(await readFile(path.resolve(repoRoot, args[1]), "utf8"))));
      if (operation === "stats") return output(phase3.historyStats(store, args[1]));
      if (operation === "entities")
        return output(phase3.listHistoricalEntities(store, args[1], { subjectId: args[2] }));
      if (operation === "ingest") {
        const receipt = JSON.parse(await readFile(path.resolve(repoRoot, args[1]), "utf8"));
        return output(await phase3.ingestReceipt(store, receipt));
      }
      throw new Error(
        "history usage: init | migrate | status | verify | export-manifest | prune <retention.json> | stats <suite-id> | entities <entity> [subject-id] | ingest <repository-relative.json>",
      );
    } finally {
      store.close();
    }
  }
  if (command === "phase3") {
    const operation = args[0];
    const phase3RuntimeRoot = process.env.SOUNDING_LINE_PHASE3_RUNTIME_ROOT ?? phase3.defaultRuntimeRoot();
    if (operation === "impact")
      return output(phase3.planImpact(JSON.parse(await readFile(path.resolve(repoRoot, args[1]), "utf8"))));
    if (operation === "impact-policy")
      return output(phase3.contractAwareImpact(JSON.parse(await readFile(path.resolve(repoRoot, args[1]), "utf8"))));
    if (operation === "freshness")
      return output(
        phase3.freshness(
          JSON.parse(await readFile(path.resolve(repoRoot, args[1]), "utf8")),
          JSON.parse(await readFile(path.resolve(repoRoot, args[2]), "utf8")),
        ),
      );
    if (operation === "rerun")
      return output(phase3.rerunPlan(JSON.parse(await readFile(path.resolve(repoRoot, args[1]), "utf8"))));
    if (operation === "runtime") {
      const action = args[1];
      if (action === "start")
        return output(
          await phase3.launchController({
            ...JSON.parse(await readFile(path.resolve(repoRoot, args[2]), "utf8")),
            root: phase3RuntimeRoot,
          }),
        );
      if (action === "find-equivalent")
        return output(
          (await phase3.findEquivalentRun({
            ...JSON.parse(await readFile(path.resolve(repoRoot, args[2]), "utf8")),
            root: phase3RuntimeRoot,
          })) ?? {
            status: "NONE",
          },
        );
      if (action === "status") return output(await phase3.readRun(args[2], phase3RuntimeRoot));
      if (action === "follow")
        return output(await phase3.followRunLog(args[2], { root: phase3RuntimeRoot, offset: Number(args[3] ?? 0) }));
      if (action === "cancel") return output(await phase3.cancelRun(args[2], phase3RuntimeRoot));
      if (action === "complete")
        return output(await phase3.completeRun(args[2], args[3] ?? "CLEAN", phase3RuntimeRoot));
      if (action === "resume")
        return output(
          await phase3.resumeRun(
            args[2],
            JSON.parse(await readFile(path.resolve(repoRoot, args[3]), "utf8")),
            phase3RuntimeRoot,
          ),
        );
      if (action === "inspect-orphans") return output(await phase3.inspectOrphans(phase3RuntimeRoot));
      if (action === "recover")
        return output(
          await phase3.recoverRun(args[2], JSON.parse(await readFile(path.resolve(repoRoot, args[3]), "utf8")), {
            root: phase3RuntimeRoot,
          }),
        );
      throw new Error(
        "phase3 runtime usage: start <run.json> | find-equivalent <run.json> | status <run-id> | follow <run-id> [offset] | cancel <run-id> | complete <run-id> [CLEAN] | resume <run-id> <identities.json> | inspect-orphans | recover <run-id> <identities.json>",
      );
    }
    if (operation === "governance" && args[1] === "validate-completion")
      return output({
        valid: phase3.validateCompletionReport(JSON.parse(await readFile(path.resolve(repoRoot, args[2]), "utf8"))),
      });
    if (operation === "governance" && ["record-flake", "record-stale", "record-slow"].includes(args[1])) {
      const store = await phase3.openHistory(process.env.SOUNDING_LINE_HISTORY_ROOT ?? phase3.defaultHistoryRoot());
      try {
        const record = JSON.parse(await readFile(path.resolve(repoRoot, args[2]), "utf8"));
        const result =
          args[1] === "record-flake"
            ? phase3.recordFlakeObservation(store, record)
            : args[1] === "record-stale"
              ? phase3.recordStaleTest(store, record)
              : phase3.recordSlowSuite(store, record);
        return output(result);
      } finally {
        store.close();
      }
    }
    throw new Error(
      "phase3 usage: impact <input.json> | impact-policy <input.json> | freshness <current.json> <evidence.json> | rerun <input.json> | governance validate-completion <report.json> | governance record-flake|record-stale|record-slow <record.json>",
    );
  }
  const argument = (name) => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : undefined;
  };
  const runtimeBase = () =>
    argument("--runtime-base") ?? process.env.SOUNDING_LINE_RUNTIME_ROOT ?? runtime.defaultRuntimeBase();
  const loadRun = async (runId) => {
    const id = String(runId ?? "");
    if (!/^sl-[a-z0-9-]+$/u.test(id)) throw new Error("run id is unsafe");
    const root = path.join(runtimeBase(), id);
    const marker = JSON.parse(await readFile(path.join(root, "run-marker.json"), "utf8"));
    return {
      id,
      root,
      base: runtimeBase(),
      controllerToken: marker.controllerToken,
      createdAt: marker.createdAt,
      host: marker.host,
      state: "RECOVERED",
    };
  };
  if (command === "runtime") {
    const [operation, runId] = args;
    if (operation === "create") {
      const planPath = argument("--plan");
      const scopeArg = args.find((arg) => arg.startsWith("--scope="));
      const requestedPaths = args
        .slice(1)
        .filter((arg) => !arg.startsWith("--"))
        .map((item) => item.replace(/\\/gu, "/"));
      let sealedPlan;
      if (planPath) {
        if (!isSafePath(planPath)) throw new Error("runtime create requires a safe repository-relative --plan");
        sealedPlan = JSON.parse(await readFile(path.join(repoRoot, planPath), "utf8"));
      } else {
        const scope = scopeArg?.slice(8) ?? "change";
        if (!["change", "release"].includes(scope) || (scope === "change" && !requestedPaths.length))
          throw new Error("runtime create requires --plan or a valid --scope with safe paths");
        if (requestedPaths.some((item) => !isSafePath(item)))
          throw new Error("runtime create paths must be safe repository-relative paths");
        sealedPlan = await plan(policy, requestedPaths, scope);
      }
      const run = await runtime.createRuntime({
        base: runtimeBase(),
        repositoryRoot: repoRoot,
        plan: sealedPlan,
        identity: { policyDigest: policy.digest, sourceDigest: (await inventory(policy)).sourceWatermark },
      });
      await mkdir(path.join(run.root, "plans"));
      await writeFile(
        path.join(run.root, "plans", "sealed-plan.json"),
        `${JSON.stringify(sealedPlan, null, 2)}\n`,
        "utf8",
      );
      output({
        status: "CREATED",
        runId: run.id,
        root: run.root,
        planDigest: sealedPlan.digest,
        nonAuthoritative: true,
      });
      return;
    }
    if (operation === "status") {
      const run = await loadRun(runId);
      await runtime.assertRun(run);
      output({ status: run.state, runId: run.id, root: run.root, nonAuthoritative: true });
      return;
    }
    if (operation === "cleanup") {
      const run = await loadRun(runId);
      output({ ...(await runtime.cleanupRuntime(run, "operator-cleanup")), runId: run.id, nonAuthoritative: true });
      return;
    }
    if (operation === "inspect-orphans") {
      output({ status: "INSPECTED", entries: await runtime.inspectOrphans(runtimeBase()), nonAuthoritative: true });
      return;
    }
    if (operation === "run") {
      const adapterId = args[2];
      const adapterArgs = args.slice(3);
      const adapter =
        adapterId === "vitest"
          ? resolveVitestAdapter(adapterArgs)
          : adapterId === "playwright"
            ? resolvePlaywrightAdapter(adapterArgs[0], adapterArgs[1])
            : resolveAdapter(adapterId, adapterArgs);
      const run = await loadRun(runId);
      const result = await runtime.executeProductAdapter(run, adapter, { cwd: repoRoot });
      output({ adapter: adapter.id, exitCode: result.exitCode, runId: run.id, status: result.status });
      if (result.status !== "PASS") process.exitCode = result.exitCode || 1;
      return;
    }
    if (operation === "cancel") throw new Error("runtime cancel is not supported; use marker-verified cleanup");
    throw new Error(
      "runtime usage: create --plan <repository-relative.json> | status <run-id> | run <run-id> <adapter> | cleanup <run-id> | inspect-orphans",
    );
  }
  if (command === "resource") {
    if (args[0] === "list") {
      output({ resources: policy.resources.resources, nonAuthoritative: true });
      return;
    }
    if (args[0] === "leases") {
      const state = await runtime.readJson(path.join(runtimeBase(), "broker-leases.json"), { version: 1, leases: [] });
      output({ ...state, nonAuthoritative: true });
      return;
    }
    throw new Error("resource usage: list | leases");
  }
  if (command === "compatibility" && args[0] === "compare") {
    output(runtime.compatibilityFor(args[1]));
    return;
  }
  if (command === "certification" && args[0] === "report") {
    output({
      status: "CERTIFIED_FOCUSED_SUITES",
      suites: [
        "sounding-line.runtime",
        "harborlight.phase4.unit",
        "harborlight.phase4.sqlite",
        "harborlight.phase4.browser",
      ],
      legacyFullValidation: "GLOBAL_EXCLUSIVE",
      uncertifiedSuites: "GLOBAL_EXCLUSIVE_OR_SERIAL_WITHIN_FAMILY",
      emergencyMode: "EMERGENCY_SERIAL",
      nonAuthoritative: true,
    });
    return;
  }
  if (command === "validate-policy") {
    const result = validatePolicy(policy);
    output({ ...result, policyDigest: policy.digest });
    if (!result.ok) process.exitCode = 1;
    return;
  }
  if (command === "inventory") {
    const result = validatePolicy(policy);
    if (!result.ok) throw new Error(result.errors.join("; "));
    output(await inventory(policy));
    return;
  }
  if (command === "plan") {
    const scopeArg = args.find((arg) => arg.startsWith("--scope="));
    const paths = args.filter((arg) => !arg.startsWith("--")).map((item) => item.replace(/\\/gu, "/"));
    const scope = scopeArg?.slice(8) ?? "change";
    if (!["change", "release"].includes(scope)) throw new Error("--scope must be change or release");
    if (scope === "change" && paths.length === 0)
      throw new Error("plan change requires one or more repository-relative paths");
    if (paths.some((item) => !isSafePath(item))) throw new Error("plan paths must be safe repository-relative paths");
    const result = validatePolicy(policy);
    if (!result.ok) throw new Error(result.errors.join("; "));
    output(await plan(policy, paths, scope));
    return;
  }
  fail(
    "usage: node scripts/sounding-line/cli.mjs <validate-policy|inventory|plan|runtime|resource|compatibility|certification> ...",
  );
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
