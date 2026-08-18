/* Bind a sealed authority-maintenance decision to GitHub's synthetic protected merge. */
import { createHash } from "node:crypto";

const digest = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const sha = (value) => typeof value === "string" && /^[0-9a-f]{40}$/u.test(value);

export function qualifyAuthorityMaintenanceProtectedMerge({
  plan,
  finalization,
  candidateSha,
  currentBaseSha,
  mergeSha,
  mergeTree,
  mergeParents,
}) {
  const errors = [];
  const { planDigest, errors: ignoredErrors, ...unsignedPlan } = plan ?? {};
  void ignoredErrors;
  if (!plan || planDigest !== digest(unsignedPlan)) errors.push("AUTHORITY_MAINTENANCE_PLAN_DIGEST_MISMATCH");
  if (plan?.authority !== "SOUNDING_LINE_AUTHORITY_MAINTENANCE" || plan?.disposition !== "AUTHORITY_MAINTENANCE_GO")
    errors.push("AUTHORITY_MAINTENANCE_PLAN_AUTHORITY_INVALID");
  if (
    plan?.classification?.classification !== "SOUNDING_LINE_AUTHORITY_MAINTENANCE" ||
    plan?.classification?.errors?.length
  )
    errors.push("AUTHORITY_MAINTENANCE_SCOPE_INVALID");
  if (plan?.ownerAuthorized !== true) errors.push("AUTHORITY_MAINTENANCE_OWNER_AUTHORIZATION_REQUIRED");
  if (
    plan?.candidateSha !== candidateSha ||
    plan?.qualifiedBaseSha !== currentBaseSha ||
    plan?.trustedMainSha !== currentBaseSha
  )
    errors.push("AUTHORITY_MAINTENANCE_TRUSTED_IDENTITY_INVALID");
  if (plan?.candidateTree !== mergeTree) errors.push("AUTHORITY_MAINTENANCE_LANDED_TREE_MISMATCH");
  if (
    finalization?.authority !== "SOUNDING_LINE_AUTHORITY_MAINTENANCE_FINALIZER" ||
    finalization?.decision !== "AUTHORITY_MAINTENANCE_GO" ||
    finalization?.planDigest !== plan?.planDigest
  )
    errors.push("AUTHORITY_MAINTENANCE_FINALIZATION_INVALID");
  if (!sha(candidateSha) || !sha(currentBaseSha) || !sha(mergeSha) || !sha(mergeTree))
    errors.push("AUTHORITY_MAINTENANCE_MERGE_IDENTITY_INVALID");
  if (
    !Array.isArray(mergeParents) ||
    mergeParents.length !== 2 ||
    !mergeParents.includes(candidateSha) ||
    !mergeParents.includes(currentBaseSha)
  )
    errors.push("AUTHORITY_MAINTENANCE_SYNTHETIC_MERGE_INVALID");
  return {
    authority: "SOUNDING_LINE_AUTHORITY_MAINTENANCE_PROTECTED_BINDING",
    decision: errors.length ? "BINDING_NO_GO" : "BINDING_PASS",
    errors: [...new Set(errors)].sort(),
  };
}
