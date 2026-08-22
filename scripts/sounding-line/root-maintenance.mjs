/* Trusted-main, owner-only admission for control-plane repair. */
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

export function classifyRootMaintenance({ trustedPolicy, changedPaths, ownerAuthorized = false }) {
  const errors = [];
  if (
    trustedPolicy?.authority !== "SOUNDING_LINE_ROOT_MAINTENANCE" ||
    trustedPolicy?.disposition !== "ROOT_MAINTENANCE_GO" ||
    trustedPolicy?.workflowDispatchOnly !== true ||
    trustedPolicy?.trustedMainOnly !== true ||
    trustedPolicy?.ownerAuthorization !== "REPOSITORY_OWNER_WORKFLOW_DISPATCH" ||
    trustedPolicy?.releaseAuthority !== "NONE"
  )
    errors.push("ROOT_MAINTENANCE_TRUSTED_POLICY_INVALID");
  if (ownerAuthorized !== true) errors.push("ROOT_MAINTENANCE_OWNER_AUTHORIZATION_REQUIRED");
  const paths = [...new Set(changedPaths ?? [])].sort();
  if (!paths.length) errors.push("ROOT_MAINTENANCE_EMPTY_DIFF_REJECTED");
  for (const file of paths)
    if (!matchesAny(file, trustedPolicy?.eligiblePathGlobs ?? []))
      errors.push(`ROOT_MAINTENANCE_SCOPE_REJECTED:${file}`);
  return {
    classification: errors.length ? "ROOT_MAINTENANCE_REJECTED" : "SOUNDING_LINE_ROOT_MAINTENANCE",
    changedPaths: paths,
    errors: [...new Set(errors)].sort(),
  };
}

export function createRootMaintenancePlan({
  trustedPolicy,
  trustedMainSha,
  candidateSha,
  candidateTree,
  qualifiedBaseSha,
  prNumber,
  changedPaths,
  ownerAuthorized,
}) {
  const classification = classifyRootMaintenance({ trustedPolicy, changedPaths, ownerAuthorized });
  const errors = [...classification.errors];
  if (![trustedMainSha, candidateSha, candidateTree, qualifiedBaseSha].every(sha))
    errors.push("ROOT_MAINTENANCE_IDENTITY_INVALID");
  if (trustedMainSha !== qualifiedBaseSha) errors.push("ROOT_MAINTENANCE_TRUSTED_BASE_MISMATCH");
  if (!Number.isSafeInteger(prNumber) || prNumber < 1) errors.push("ROOT_MAINTENANCE_PR_BINDING_INVALID");
  const plan = {
    version: 1,
    authority: "SOUNDING_LINE_ROOT_MAINTENANCE",
    disposition: "ROOT_MAINTENANCE_GO",
    trustedMainSha,
    trustedPolicyDigest: digest(trustedPolicy),
    candidateSha,
    candidateTree,
    qualifiedBaseSha,
    prNumber,
    ownerAuthorized: ownerAuthorized === true,
    classification,
    requiredEvidence: trustedPolicy?.requiredEvidence ?? [],
  };
  return { ...plan, planDigest: digest(plan), errors: [...new Set(errors)].sort() };
}

export function finalizeRootMaintenance({
  plan,
  evidence,
  observedCandidateSha,
  observedTrustedMainSha,
  observedPrNumber,
}) {
  const errors = [];
  const { planDigest, errors: ignoredErrors, ...unsignedPlan } = plan ?? {};
  void ignoredErrors;
  if (!plan || planDigest !== digest(unsignedPlan)) errors.push("ROOT_MAINTENANCE_PLAN_DIGEST_MISMATCH");
  if (plan?.errors?.length) errors.push(...plan.errors);
  if (plan?.ownerAuthorized !== true) errors.push("ROOT_MAINTENANCE_OWNER_AUTHORIZATION_REQUIRED");
  if (observedCandidateSha !== plan?.candidateSha)
    errors.push("ROOT_MAINTENANCE_CANDIDATE_CHANGED_AFTER_QUALIFICATION");
  if (observedTrustedMainSha !== plan?.trustedMainSha) errors.push("ROOT_MAINTENANCE_TRUSTED_MAIN_STALE");
  if (observedPrNumber !== plan?.prNumber) errors.push("ROOT_MAINTENANCE_PR_CHANGED_AFTER_QUALIFICATION");
  const evidenceById = new Map((evidence ?? []).map((entry) => [entry.id, entry]));
  for (const id of plan?.requiredEvidence ?? []) {
    const entry = evidenceById.get(id);
    if (!entry || entry.result !== "PASSED" || entry.candidateSha !== plan.candidateSha)
      errors.push(`ROOT_MAINTENANCE_EVIDENCE_INVALID:${id}`);
  }
  return {
    authority: "SOUNDING_LINE_ROOT_MAINTENANCE_FINALIZER",
    decision: errors.length ? "ROOT_MAINTENANCE_NO_GO" : "ROOT_MAINTENANCE_GO",
    planDigest: plan?.planDigest ?? null,
    candidateSha: plan?.candidateSha ?? null,
    trustedMainSha: plan?.trustedMainSha ?? null,
    prNumber: plan?.prNumber ?? null,
    evidenceDigest: digest(evidence ?? []),
    errors: [...new Set(errors)].sort(),
  };
}

if (process.argv[2] === "plan" || process.argv[2] === "finalize") {
  const args = process.argv.slice(3);
  const value = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
  const result =
    process.argv[2] === "plan"
      ? createRootMaintenancePlan({
          trustedPolicy: JSON.parse(await readFile(value("--policy"), "utf8")),
          trustedMainSha: value("--trusted-main-sha"),
          candidateSha: value("--candidate-sha"),
          candidateTree: value("--candidate-tree"),
          qualifiedBaseSha: value("--base-sha"),
          prNumber: Number(value("--pr-number")),
          changedPaths: JSON.parse(await readFile(value("--paths"), "utf8")),
          ownerAuthorized: value("--owner-authorized") === "true",
        })
      : finalizeRootMaintenance({
          plan: JSON.parse(await readFile(value("--plan"), "utf8")),
          evidence: JSON.parse(await readFile(value("--evidence"), "utf8")),
          observedCandidateSha: value("--candidate-sha"),
          observedTrustedMainSha: value("--trusted-main-sha"),
          observedPrNumber: Number(value("--pr-number")),
        });
  await writeFile(value("--out"), `${JSON.stringify(result, null, 2)}\n`);
  console.log(result.classification?.classification ?? result.decision);
  process.exitCode = result.errors.length || result.decision === "ROOT_MAINTENANCE_NO_GO" ? 1 : 0;
}
