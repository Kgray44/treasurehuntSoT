/* ADR-EGS-001's trusted, minimal engineering-control-plane classifier. */
import { createHash } from "node:crypto";
import process from "node:process";
import { readFile, writeFile } from "node:fs/promises";
import { classifyOrdinaryCandidate, loadOrdinaryCandidateSnapshots } from "./verification-maintenance.mjs";

const sha = (value) => typeof value === "string" && /^[0-9a-f]{40}$/u.test(value);
const digest = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const glob = (pattern) =>
  new RegExp(
    `^${String(pattern)
      .replace(/[|\\{}()[\]^$+?.]/gu, "\\$&")
      .replace(/\*\*/gu, "::DOUBLE_STAR::")
      .replace(/\*/gu, "[^/]*")
      .replace(/::DOUBLE_STAR::/gu, ".*")}$`,
    "u",
  );
const matchesAny = (file, patterns) => (patterns ?? []).some((pattern) => glob(pattern).test(file));
const uniquePaths = (paths) => [...new Set((paths ?? []).map(String))].sort();
const policyValid = (policy) =>
  policy?.version === "1.0.0" &&
  policy?.decision === "ADR-EGS-001" &&
  policy?.authorities?.verification === "SOUNDING_LINE" &&
  policy?.authorities?.flow === "NIGHTWATCH" &&
  policy?.ordinary?.integrationPath === "DIRECT_MAINLINE_SINGLE_CANDIDATE" &&
  policy?.ordinary?.mainlineTrain === "OPTIONAL_MULTI_CANDIDATE_OPTIMIZATION" &&
  policy?.ordinary?.trainFailureRoute === "SAFE_DIRECT_FALLBACK" &&
  policy?.ordinary?.ordinaryBaselineCertification === "NOT_A_MERGE_PREREQUISITE" &&
  policy?.ordinary?.ordinaryDeepwater === "PRODUCT_REALIZATION_OR_REACHABILITY_ONLY" &&
  policy?.ordinary?.provenanceOnlyGeneratedState === "POST_MERGE_RECONCILIATION" &&
  policy?.releaseCandidate === "EXHAUSTIVE_UNCHANGED" &&
  policy?.controlPlaneChange?.trustedBasePolicy === "REQUIRED" &&
  policy?.controlPlaneChange?.antiSelfAuthorization === "TRUSTED_BASE_CLASSIFIER_AND_POLICY_REQUIRED" &&
  policy?.controlPlaneChange?.protectedBinding === "EXACT_CANDIDATE_BASE_AND_LANDED_TREE" &&
  policy?.breakGlass?.ownerAuthorization === "EXPLICIT_REPOSITORY_OWNER_DISPATCH";

export function classifyEngineeringChange({
  trustedPolicy,
  changedPaths,
  ownerAuthorized = false,
  requestedClass = null,
  trustedControlPlaneAvailable = true,
  breakGlassScope = null,
  expiresAt = null,
  beforeAfterEvidence = [],
}) {
  const paths = uniquePaths(changedPaths);
  const errors = [];
  if (!policyValid(trustedPolicy)) errors.push("ENGINEERING_GOVERNANCE_TRUSTED_POLICY_INVALID");
  if (!paths.length) errors.push("ENGINEERING_GOVERNANCE_EMPTY_DIFF_REJECTED");
  const isBreakGlass = requestedClass === "BREAK_GLASS";
  if (requestedClass === "RELEASE_CANDIDATE") errors.push("RELEASE_CANDIDATE_EXHAUSTIVE_PATH_REQUIRED");
  else if (requestedClass && !["BREAK_GLASS", "CONTROL_PLANE_CHANGE"].includes(requestedClass))
    errors.push("ENGINEERING_GOVERNANCE_REQUESTED_CLASS_UNKNOWN");
  const controlPaths = paths.filter((file) => matchesAny(file, trustedPolicy?.controlPlanePathGlobs));
  const bosunOnly =
    paths.length > 0 && paths.every((file) => matchesAny(file, trustedPolicy?.ordinaryBosunRepairPathGlobs));
  if (isBreakGlass) {
    if (trustedControlPlaneAvailable) errors.push("BREAK_GLASS_TRUSTED_CONTROL_PLANE_AVAILABLE");
    if (ownerAuthorized !== true) errors.push("BREAK_GLASS_OWNER_AUTHORIZATION_REQUIRED");
    if (!breakGlassScope || !Array.isArray(breakGlassScope.paths) || !breakGlassScope.paths.length)
      errors.push("BREAK_GLASS_EXACT_SCOPE_REQUIRED");
    else if (uniquePaths(breakGlassScope.paths).join("\n") !== paths.join("\n"))
      errors.push("BREAK_GLASS_SCOPE_MISMATCH");
    if (!expiresAt || Number.isNaN(Date.parse(expiresAt)) || Date.parse(expiresAt) <= Date.now())
      errors.push("BREAK_GLASS_EXPIRY_REQUIRED");
    if (!Array.isArray(beforeAfterEvidence) || beforeAfterEvidence.length < 2)
      errors.push("BREAK_GLASS_BEFORE_AFTER_EVIDENCE_REQUIRED");
    if (paths.some((file) => /^src\/(?!nightwatch\/bosun)/u.test(file)))
      errors.push("BREAK_GLASS_PRODUCT_SCOPE_REJECTED");
    return { classification: errors.length ? "BREAK_GLASS_REJECTED" : "BREAK_GLASS", changedPaths: paths, errors };
  }
  if ((controlPaths.length && !bosunOnly) || requestedClass === "CONTROL_PLANE_CHANGE") {
    if (requestedClass === "CONTROL_PLANE_CHANGE" && !controlPaths.length)
      errors.push("CONTROL_PLANE_CHANGE_SCOPE_REQUIRED");
    if (ownerAuthorized !== true) errors.push("CONTROL_PLANE_CHANGE_OWNER_AUTHORIZATION_REQUIRED");
    return {
      classification: errors.length ? "CONTROL_PLANE_CHANGE_REJECTED" : "CONTROL_PLANE_CHANGE",
      changedPaths: paths,
      controlPaths,
      errors,
    };
  }
  return { classification: errors.length ? "ORDINARY_REJECTED" : "ORDINARY", changedPaths: paths, errors };
}

export function classifySimplifiedCandidate({
  trustedGovernancePolicy,
  trustedOrdinaryPolicy,
  changedPaths,
  ownerAuthorized = false,
  requestedClass = null,
  trustedControlPlaneAvailable = true,
  breakGlassScope = null,
  expiresAt = null,
  beforeAfterEvidence = [],
  ...ordinaryInputs
}) {
  const engineering = classifyEngineeringChange({
    trustedPolicy: trustedGovernancePolicy,
    changedPaths,
    ownerAuthorized,
    requestedClass,
    trustedControlPlaneAvailable,
    breakGlassScope,
    expiresAt,
    beforeAfterEvidence,
  });
  if (engineering.classification !== "ORDINARY") return { ...engineering, ordinary: null };
  const ordinary = classifyOrdinaryCandidate({ trustedPolicy: trustedOrdinaryPolicy, changedPaths, ...ordinaryInputs });
  return {
    classification: ordinary.errors.length ? "ORDINARY_REJECTED" : "ORDINARY",
    changedPaths: engineering.changedPaths,
    errors: ordinary.errors,
    ordinary,
  };
}

export function createEngineeringControlPlan({
  trustedPolicy,
  trustedMainSha,
  candidateSha,
  candidateTree,
  qualifiedBaseSha,
  changedPaths,
  ownerAuthorized,
  requestedClass,
  trustedControlPlaneAvailable,
  breakGlassScope,
  expiresAt,
  beforeAfterEvidence,
}) {
  const classification = classifyEngineeringChange({
    trustedPolicy,
    changedPaths,
    ownerAuthorized,
    requestedClass,
    trustedControlPlaneAvailable,
    breakGlassScope,
    expiresAt,
    beforeAfterEvidence,
  });
  const errors = [...classification.errors];
  if (![trustedMainSha, candidateSha, candidateTree, qualifiedBaseSha].every(sha))
    errors.push("ENGINEERING_CONTROL_IDENTITY_INVALID");
  if (trustedMainSha !== qualifiedBaseSha) errors.push("ENGINEERING_CONTROL_TRUSTED_BASE_MISMATCH");
  const plan = {
    version: 1,
    authority: "SOUNDING_LINE_ENGINEERING_CONTROL",
    classification: classification.classification,
    trustedMainSha,
    trustedPolicyDigest: digest(trustedPolicy),
    candidateSha,
    candidateTree,
    qualifiedBaseSha,
    ownerAuthorized: ownerAuthorized === true,
    changedPaths: classification.changedPaths,
    breakGlass: requestedClass === "BREAK_GLASS" ? { scope: breakGlassScope, expiresAt, beforeAfterEvidence } : null,
    requiredEvidence:
      classification.classification === "CONTROL_PLANE_CHANGE"
        ? (trustedPolicy?.controlPlaneChange?.requiredEvidence ?? [])
        : classification.classification === "BREAK_GLASS"
          ? ["OWNER_AUTHORIZATION", "BEFORE_AFTER_EVIDENCE", "NORMAL_PATH_SELF_VERIFICATION"]
          : [],
  };
  return { ...plan, planDigest: digest(plan), errors: [...new Set(errors)].sort() };
}

export function finalizeEngineeringControlPlan({
  plan,
  evidence,
  observedCandidateSha,
  observedTrustedMainSha,
  observedLandedTree,
}) {
  const { planDigest, errors: ignoredErrors, ...unsigned } = plan ?? {};
  void ignoredErrors;
  const errors = [];
  if (!plan || planDigest !== digest(unsigned)) errors.push("ENGINEERING_CONTROL_PLAN_DIGEST_MISMATCH");
  if (plan?.errors?.length) errors.push(...plan.errors);
  if (observedCandidateSha !== plan?.candidateSha)
    errors.push("ENGINEERING_CONTROL_CANDIDATE_CHANGED_AFTER_QUALIFICATION");
  if (observedTrustedMainSha !== plan?.trustedMainSha) errors.push("ENGINEERING_CONTROL_TRUSTED_MAIN_STALE");
  if (observedLandedTree && observedLandedTree !== plan?.candidateTree)
    errors.push("ENGINEERING_CONTROL_LANDED_TREE_MISMATCH");
  const byId = new Map((evidence ?? []).map((entry) => [entry.id, entry]));
  for (const id of plan?.requiredEvidence ?? [])
    if (byId.get(id)?.result !== "PASSED" || byId.get(id)?.candidateSha !== plan?.candidateSha)
      errors.push(`ENGINEERING_CONTROL_EVIDENCE_INVALID:${id}`);
  return {
    authority: "SOUNDING_LINE_ENGINEERING_CONTROL_FINALIZER",
    decision: errors.length ? "ENGINEERING_CONTROL_NO_GO" : "ENGINEERING_CONTROL_GO",
    classification: plan?.classification ?? null,
    planDigest: plan?.planDigest ?? null,
    candidateSha: plan?.candidateSha ?? null,
    trustedMainSha: plan?.trustedMainSha ?? null,
    errors: [...new Set(errors)].sort(),
  };
}

export function classifyAuxiliaryGovernanceImpact({ effects = {} } = {}) {
  const value = (name) => effects[name] === true;
  return {
    featureCatalog: value("capability") || value("availability") || value("limitation"),
    deepwater:
      value("capabilityRealization") ||
      value("frontendExposure") ||
      value("routeReachability") ||
      value("backendToProduct"),
    documentationIndex: value("documentStructure"),
    changelogAndUserDocs: value("userVisibleBehavior"),
    governingDocuments: value("governingArchitecture"),
    unknown: Object.values(effects).some((entry) => entry === "UNKNOWN"),
  };
}

if (process.argv[1]?.endsWith("engineering-governance.mjs") && process.argv[2] === "ordinary") {
  const options = Object.fromEntries(
    process.argv
      .slice(3)
      .map((value, index, values) => (value.startsWith("--") ? [value.slice(2), values[index + 1]] : []))
      .filter(([key]) => key),
  );
  const [trustedGovernancePolicy, trustedOrdinaryPolicy, parsedPaths] = await Promise.all([
    readFile(options.governance, "utf8").then(JSON.parse),
    readFile(options["ordinary-policy"], "utf8").then(JSON.parse),
    readFile(options.paths, "utf8").then(JSON.parse),
  ]);
  const changedPaths = Array.isArray(parsedPaths) ? parsedPaths : [parsedPaths];
  const snapshots = await loadOrdinaryCandidateSnapshots({
    trustedPolicy: trustedOrdinaryPolicy,
    changedPaths,
    trustedBaseSha: options["trusted-base-sha"],
    candidateSha: options["candidate-sha"],
    candidateRoot: options["candidate-root"],
  });
  const result = classifySimplifiedCandidate({
    trustedGovernancePolicy,
    trustedOrdinaryPolicy,
    changedPaths,
    ...snapshots,
  });
  if (snapshots.snapshotError) {
    result.errors = [...new Set([...result.errors, snapshots.snapshotError])].sort();
    result.classification = "ORDINARY_REJECTED";
  }
  await writeFile(options.out, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  process.stdout.write(`${result.classification}\n`);
  process.exitCode = result.errors.length ? 1 : 0;
}
