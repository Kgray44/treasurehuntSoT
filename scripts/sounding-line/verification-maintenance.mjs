/* Trusted-main, candidate-bound verification-maintenance qualification. */
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
const matchesAny = (file, patterns) => patterns.some((pattern) => glob(pattern).test(file));

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
  const { planDigest, errors: _planErrors, ...unsigned } = plan ?? {};
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
