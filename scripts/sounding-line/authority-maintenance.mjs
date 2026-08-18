/* Trusted-main qualification for narrowly bounded Sounding Line authority maintenance. */
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

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
const matchesAny = (file, patterns) => (patterns ?? []).some((pattern) => glob(pattern).test(file));

export function classifyAuthorityMaintenance({ trustedPolicy, changedPaths, ownerAuthorized = false }) {
  const errors = [];
  if (
    trustedPolicy?.authority !== "SOUNDING_LINE_AUTHORITY_MAINTENANCE" ||
    trustedPolicy?.disposition !== "AUTHORITY_MAINTENANCE_GO" ||
    trustedPolicy?.workflowDispatchOnly !== true ||
    trustedPolicy?.trustedMainOnly !== true
  )
    errors.push("AUTHORITY_MAINTENANCE_TRUSTED_POLICY_INVALID");
  if (ownerAuthorized !== true) errors.push("AUTHORITY_MAINTENANCE_OWNER_AUTHORIZATION_REQUIRED");
  const paths = [...new Set(changedPaths ?? [])].sort();
  if (!paths.length) errors.push("AUTHORITY_MAINTENANCE_EMPTY_DIFF_REJECTED");
  for (const file of paths)
    if (!matchesAny(file, trustedPolicy?.eligiblePathGlobs ?? []))
      errors.push(`AUTHORITY_MAINTENANCE_SCOPE_REJECTED:${file}`);
  return {
    classification: errors.length ? "AUTHORITY_MAINTENANCE_REJECTED" : "SOUNDING_LINE_AUTHORITY_MAINTENANCE",
    changedPaths: paths,
    errors: [...new Set(errors)].sort(),
  };
}

export function createAuthorityMaintenancePlan({
  trustedPolicy,
  trustedMainSha,
  candidateSha,
  candidateTree,
  qualifiedBaseSha,
  changedPaths,
  ownerAuthorized,
}) {
  const classification = classifyAuthorityMaintenance({ trustedPolicy, changedPaths, ownerAuthorized });
  const errors = [...classification.errors];
  if (!sha(trustedMainSha)) errors.push("AUTHORITY_MAINTENANCE_TRUSTED_MAIN_SHA_INVALID");
  if (!sha(candidateSha)) errors.push("AUTHORITY_MAINTENANCE_CANDIDATE_SHA_INVALID");
  if (!sha(candidateTree)) errors.push("AUTHORITY_MAINTENANCE_CANDIDATE_TREE_INVALID");
  if (!sha(qualifiedBaseSha)) errors.push("AUTHORITY_MAINTENANCE_BASE_SHA_INVALID");
  const plan = {
    version: 1,
    authority: "SOUNDING_LINE_AUTHORITY_MAINTENANCE",
    disposition: "AUTHORITY_MAINTENANCE_GO",
    trustedMainSha,
    trustedPolicyDigest: digest(trustedPolicy),
    candidateSha,
    candidateTree,
    qualifiedBaseSha,
    ownerAuthorized: ownerAuthorized === true,
    classification,
    requiredEvidence: trustedPolicy?.requiredEvidence ?? [],
  };
  return { ...plan, planDigest: digest(plan), errors: [...new Set(errors)].sort() };
}

export function finalizeAuthorityMaintenance({
  plan,
  evidence,
  observedCandidateSha,
  observedTrustedMainSha,
  observedLandedTree = null,
}) {
  const errors = [];
  const { planDigest, errors: ignoredErrors, ...unsignedPlan } = plan ?? {};
  void ignoredErrors;
  if (!plan || planDigest !== digest(unsignedPlan)) errors.push("AUTHORITY_MAINTENANCE_PLAN_DIGEST_MISMATCH");
  if (plan?.errors?.length) errors.push(...plan.errors);
  if (plan?.ownerAuthorized !== true) errors.push("AUTHORITY_MAINTENANCE_OWNER_AUTHORIZATION_REQUIRED");
  if (observedCandidateSha !== plan?.candidateSha)
    errors.push("AUTHORITY_MAINTENANCE_CANDIDATE_CHANGED_AFTER_QUALIFICATION");
  if (observedTrustedMainSha !== plan?.trustedMainSha) errors.push("AUTHORITY_MAINTENANCE_TRUSTED_MAIN_STALE");
  if (observedLandedTree && observedLandedTree !== plan?.candidateTree)
    errors.push("AUTHORITY_MAINTENANCE_LANDED_TREE_MISMATCH");
  const evidenceById = new Map((evidence ?? []).map((entry) => [entry.id, entry]));
  for (const id of plan?.requiredEvidence ?? []) {
    const entry = evidenceById.get(id);
    if (!entry || entry.result !== "PASSED" || entry.candidateSha !== plan.candidateSha)
      errors.push(`AUTHORITY_MAINTENANCE_EVIDENCE_INVALID:${id}`);
  }
  return {
    authority: "SOUNDING_LINE_AUTHORITY_MAINTENANCE_FINALIZER",
    decision: errors.length ? "AUTHORITY_MAINTENANCE_NO_GO" : "AUTHORITY_MAINTENANCE_GO",
    planDigest: plan?.planDigest ?? null,
    candidateSha: plan?.candidateSha ?? null,
    trustedMainSha: plan?.trustedMainSha ?? null,
    evidenceDigest: digest(evidence ?? []),
    errors: [...new Set(errors)].sort(),
  };
}

if (process.argv[1]?.endsWith("authority-maintenance.mjs") && process.argv[2] === "plan") {
  const args = process.argv.slice(3);
  const value = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
  const policy = JSON.parse(await readFile(value("--policy"), "utf8"));
  const paths = JSON.parse(await readFile(value("--paths"), "utf8"));
  const result = createAuthorityMaintenancePlan({
    trustedPolicy: policy,
    trustedMainSha: value("--trusted-main-sha"),
    candidateSha: value("--candidate-sha"),
    candidateTree: value("--candidate-tree"),
    qualifiedBaseSha: value("--base-sha"),
    changedPaths: paths,
    ownerAuthorized: value("--owner-authorized") === "true",
  });
  await writeFile(value("--out"), `${JSON.stringify(result, null, 2)}\n`);
  console.log(result.classification.classification);
  process.exitCode = result.errors.length ? 1 : 0;
}

if (process.argv[1]?.endsWith("authority-maintenance.mjs") && process.argv[2] === "finalize") {
  const args = process.argv.slice(3);
  const value = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
  const result = finalizeAuthorityMaintenance({
    plan: JSON.parse(await readFile(value("--plan"), "utf8")),
    evidence: JSON.parse(await readFile(value("--evidence"), "utf8")),
    observedCandidateSha: value("--candidate-sha"),
    observedTrustedMainSha: value("--trusted-main-sha"),
  });
  await writeFile(value("--out"), `${JSON.stringify(result, null, 2)}\n`);
  console.log(result.decision);
  process.exitCode = result.decision === "AUTHORITY_MAINTENANCE_GO" ? 0 : 1;
}
