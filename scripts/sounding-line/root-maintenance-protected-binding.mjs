/* Bind a sealed Root Maintenance decision to one synthetic protected merge. */
import { createHash } from "node:crypto";

const digest = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const sha = (value) => typeof value === "string" && /^[0-9a-f]{40}$/u.test(value);

export function qualifyRootMaintenanceProtectedMerge({
  plan,
  finalization,
  candidateSha,
  currentBaseSha,
  mergeSha,
  mergeTree,
  mergeParents,
  prNumber,
}) {
  const errors = [];
  const { planDigest, errors: ignoredErrors, ...unsignedPlan } = plan ?? {};
  void ignoredErrors;
  if (!plan || planDigest !== digest(unsignedPlan)) errors.push("ROOT_MAINTENANCE_PLAN_DIGEST_MISMATCH");
  if (plan?.authority !== "SOUNDING_LINE_ROOT_MAINTENANCE" || plan?.disposition !== "ROOT_MAINTENANCE_GO")
    errors.push("ROOT_MAINTENANCE_PLAN_AUTHORITY_INVALID");
  if (plan?.classification?.classification !== "SOUNDING_LINE_ROOT_MAINTENANCE" || plan?.classification?.errors?.length)
    errors.push("ROOT_MAINTENANCE_SCOPE_INVALID");
  if (plan?.ownerAuthorized !== true) errors.push("ROOT_MAINTENANCE_OWNER_AUTHORIZATION_REQUIRED");
  if (
    plan?.candidateSha !== candidateSha ||
    plan?.qualifiedBaseSha !== currentBaseSha ||
    plan?.trustedMainSha !== currentBaseSha ||
    plan?.prNumber !== prNumber
  )
    errors.push("ROOT_MAINTENANCE_TRUSTED_IDENTITY_INVALID");
  if (plan?.candidateTree !== mergeTree) errors.push("ROOT_MAINTENANCE_LANDED_TREE_MISMATCH");
  if (
    finalization?.authority !== "SOUNDING_LINE_ROOT_MAINTENANCE_FINALIZER" ||
    finalization?.decision !== "ROOT_MAINTENANCE_GO" ||
    finalization?.planDigest !== plan?.planDigest ||
    finalization?.prNumber !== prNumber
  )
    errors.push("ROOT_MAINTENANCE_FINALIZATION_INVALID");
  if (![candidateSha, currentBaseSha, mergeSha, mergeTree].every(sha))
    errors.push("ROOT_MAINTENANCE_MERGE_IDENTITY_INVALID");
  if (
    !Array.isArray(mergeParents) ||
    mergeParents.length !== 2 ||
    !mergeParents.includes(candidateSha) ||
    !mergeParents.includes(currentBaseSha)
  )
    errors.push("ROOT_MAINTENANCE_SYNTHETIC_MERGE_INVALID");
  return {
    authority: "SOUNDING_LINE_ROOT_MAINTENANCE_PROTECTED_BINDING",
    decision: errors.length ? "BINDING_NO_GO" : "BINDING_PASS",
    errors: [...new Set(errors)].sort(),
  };
}
