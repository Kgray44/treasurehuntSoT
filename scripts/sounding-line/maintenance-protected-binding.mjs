/* Bind a trusted-main MAINTENANCE_GO to GitHub's synthetic merge identity. */
import { createHash } from "node:crypto";

const digest = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const sha = (value) => typeof value === "string" && /^[0-9a-f]{40}$/u.test(value);

export function qualifyMaintenanceProtectedMerge({
  plan,
  finalization,
  candidateSha,
  currentBaseSha,
  mergeSha,
  mergeTree,
  mergeParents,
}) {
  const errors = [];
  const { planDigest, errors: _ignored, ...unsignedPlan } = plan ?? {};
  if (!plan || planDigest !== digest(unsignedPlan)) errors.push("MAINTENANCE_PLAN_DIGEST_MISMATCH");
  if (plan?.authority !== "SOUNDING_LINE_VERIFICATION_MAINTENANCE" || plan?.disposition !== "MAINTENANCE_GO")
    errors.push("MAINTENANCE_PLAN_AUTHORITY_INVALID");
  if (plan?.classification?.classification !== "VERIFICATION_MAINTENANCE" || plan?.classification?.errors?.length)
    errors.push("MAINTENANCE_SCOPE_INVALID");
  if (
    plan?.candidateSha !== candidateSha ||
    plan?.qualifiedBaseSha !== currentBaseSha ||
    plan?.trustedMainSha !== currentBaseSha
  )
    errors.push("MAINTENANCE_TRUSTED_IDENTITY_INVALID");
  if (plan?.candidateTree !== mergeTree) errors.push("MAINTENANCE_LANDED_TREE_MISMATCH");
  if (
    finalization?.authority !== "SOUNDING_LINE_VERIFICATION_MAINTENANCE_FINALIZER" ||
    finalization?.decision !== "MAINTENANCE_GO" ||
    finalization?.planDigest !== plan?.planDigest
  )
    errors.push("MAINTENANCE_FINALIZATION_INVALID");
  if (!sha(candidateSha) || !sha(currentBaseSha) || !sha(mergeSha) || !sha(mergeTree))
    errors.push("MAINTENANCE_MERGE_IDENTITY_INVALID");
  if (
    !Array.isArray(mergeParents) ||
    mergeParents.length !== 2 ||
    !mergeParents.includes(candidateSha) ||
    !mergeParents.includes(currentBaseSha)
  )
    errors.push("MAINTENANCE_SYNTHETIC_MERGE_INVALID");
  return {
    authority: "SOUNDING_LINE_MAINTENANCE_PROTECTED_BINDING",
    decision: errors.length ? "BINDING_NO_GO" : "BINDING_PASS",
    candidateSha,
    currentBaseSha,
    mergeSha,
    mergeTree,
    errors: [...new Set(errors)].sort(),
  };
}
