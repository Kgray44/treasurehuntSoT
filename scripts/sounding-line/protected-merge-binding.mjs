/*
 * The protected-merge bridge consumes an already sealed finalizer decision.
 * It deliberately has no execution, planning, worker, or release-decision API.
 */
import { createHash } from "node:crypto";
import { isApprovedRecordPath, RECORD_ONLY_EVIDENCE_IDS, RECORD_ONLY_SUITE_ID } from "./record-only-closure.mjs";

export const PROTECTED_MAINLINE_CONTEXT = "Sounding Line / Mainline Decision";

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

const matchesAny = (path, patterns = []) => patterns.some((pattern) => glob(pattern).test(path));

function validateFinalizedEvidence({ plan, finalization, qualified }) {
  const errors = [];
  const { planDigest, ...unsignedPlan } = plan ?? {};
  if (!plan || planDigest !== digest(unsignedPlan)) errors.push("SEALED_PLAN_DIGEST_MISMATCH");
  if (!finalization || finalization.authority !== "SOUNDING_LINE_FINALIZER") errors.push("FINALIZER_AUTHORITY_INVALID");
  if (finalization?.decision !== "RELEASE_GO") errors.push("FINALIZER_RELEASE_GO_REQUIRED");
  if (plan?.sourceSha !== qualified.candidateSha) errors.push("QUALIFIED_CANDIDATE_SOURCE_MISMATCH");
  if (plan?.gate !== "mainline" || finalization?.gate !== "mainline") errors.push("QUALIFIED_MAINLINE_GATE_REQUIRED");
  if (plan?.planDigest !== finalization?.planDigest || plan?.planDigest !== qualified.planDigest)
    errors.push("QUALIFIED_PLAN_DIGEST_MISMATCH");
  if (plan?.policyDigest !== qualified.policyDigest) errors.push("QUALIFIED_POLICY_DIGEST_MISMATCH");
  if (plan?.inventoryDigest !== qualified.inventoryDigest) errors.push("QUALIFIED_INVENTORY_DIGEST_MISMATCH");
  if (plan?.authorityDigest !== qualified.authorityDigest) errors.push("QUALIFIED_AUTHORITY_DIGEST_MISMATCH");
  if (finalization?.evidenceDigest !== digest(finalization?.receipts ?? []))
    errors.push("FINALIZATION_EVIDENCE_DIGEST_MISMATCH");
  if (finalization?.evidenceDigest !== qualified.evidenceDigest) errors.push("QUALIFIED_EVIDENCE_DIGEST_MISMATCH");
  const required = new Set((plan?.nodes ?? []).map((node) => node.id));
  const receipts = finalization?.receipts ?? [];
  const counts = new Map(receipts.map((receipt) => [receipt.suiteId, 0]));
  for (const receipt of receipts) counts.set(receipt.suiteId, (counts.get(receipt.suiteId) ?? 0) + 1);
  if (receipts.length !== required.size || receipts.length !== qualified.mandatoryReceiptCount)
    errors.push("MANDATORY_RECEIPT_COUNT_MISMATCH");
  for (const suiteId of required) if (counts.get(suiteId) !== 1) errors.push(`MANDATORY_RECEIPT_INVALID:${suiteId}`);
  for (const receipt of receipts) {
    if (!required.has(receipt.suiteId)) errors.push(`UNKNOWN_RECEIPT:${receipt.suiteId}`);
    if (
      receipt.sourceSha !== qualified.candidateSha ||
      receipt.policyDigest !== plan?.policyDigest ||
      receipt.inventoryDigest !== plan?.inventoryDigest ||
      receipt.planDigest !== plan?.planDigest ||
      receipt.gate !== "mainline" ||
      receipt.cleanupState !== "CLEAN" ||
      receipt.result !== "PASSED" ||
      receipt.exitCode !== 0 ||
      receipt.timedOut === true
    )
      errors.push(`MANDATORY_RECEIPT_INVALID:${receipt.suiteId}`);
  }
  return errors;
}

function validateRecordOnlyPlan({
  plan,
  qualified,
  candidateSha,
  currentBaseSha,
  mergeSha,
  recordOnlyChangedPaths,
  recordOnlyAncestryValid,
}) {
  const errors = [];
  const recordOnly = plan?.recordOnly;
  if (recordOnly?.version !== 1 || recordOnly?.mode !== "FAIL_CLOSED_RECORD_ONLY")
    errors.push("RECORD_ONLY_PLAN_MODE_INVALID");
  if (
    recordOnly?.candidateSha !== candidateSha ||
    recordOnly?.currentBaseSha !== currentBaseSha ||
    recordOnly?.mergeSha !== mergeSha ||
    !sha(recordOnly?.candidateMergeBaseSha)
  )
    errors.push("RECORD_ONLY_PLAN_IDENTITY_INVALID");
  if (qualified?.qualifiedBaseSha !== currentBaseSha) errors.push("RECORD_ONLY_QUALIFIED_BASE_MISMATCH");
  if (recordOnlyAncestryValid !== true) errors.push("RECORD_ONLY_IMPLEMENTATION_ANCESTRY_INVALID");
  const expectedPaths = recordOnly?.changedPaths;
  if (
    !Array.isArray(expectedPaths) ||
    !expectedPaths.length ||
    expectedPaths.some((value) => !isApprovedRecordPath(value))
  )
    errors.push("RECORD_ONLY_PATH_CLASSIFICATION_INVALID");
  const observedPaths = Array.isArray(recordOnlyChangedPaths) ? recordOnlyChangedPaths : [];
  if (
    !Array.isArray(recordOnlyChangedPaths) ||
    expectedPaths?.length !== observedPaths.length ||
    expectedPaths?.some((value, index) => value !== observedPaths[index])
  )
    errors.push("RECORD_ONLY_DIFF_BINDING_INVALID");
  const prior = recordOnly?.priorAuthority;
  if (
    !Number.isSafeInteger(prior?.prNumber) ||
    !Number.isSafeInteger(prior?.authorityRunId) ||
    !sha(prior?.implementationCandidateSha) ||
    !sha(prior?.implementationMergeSha) ||
    prior?.protectedContext !== PROTECTED_MAINLINE_CONTEXT
  )
    errors.push("RECORD_ONLY_PRIOR_AUTHORITY_INVALID");
  const actualEvidence = recordOnly?.evidence;
  if (
    !Array.isArray(actualEvidence) ||
    actualEvidence.length !== RECORD_ONLY_EVIDENCE_IDS.length ||
    actualEvidence.some((entry) => entry?.result !== "PASSED") ||
    actualEvidence.map((entry) => entry.id).join("\n") !== RECORD_ONLY_EVIDENCE_IDS.join("\n")
  )
    errors.push("RECORD_ONLY_EVIDENCE_SET_INVALID");
  const nodes = plan?.nodes ?? [];
  if (
    nodes.length !== 1 ||
    nodes[0]?.id !== RECORD_ONLY_SUITE_ID ||
    nodes[0]?.adapter !== "record-only-static" ||
    nodes[0]?.resources?.join("\n") !== "node-slot" ||
    plan?.runtimeConformanceRequired !== true ||
    plan?.runtimeConformanceSuiteId !== RECORD_ONLY_SUITE_ID
  )
    errors.push("RECORD_ONLY_PLAN_SCOPE_INVALID");
  return errors;
}

export function classifyBaseAdvance({ qualifiedBaseSha, currentBaseSha, changedPaths, semanticPolicy }) {
  if (qualifiedBaseSha === currentBaseSha) return { status: "EXACT_BASE", preserved: [], rejected: [] };
  if (!Array.isArray(changedPaths) || changedPaths.length === 0)
    return { status: "FAIL_CLOSED", preserved: [], rejected: ["BASE_ADVANCE_DIFF_UNAVAILABLE"] };
  const preserved = [];
  const rejected = [];
  for (const path of changedPaths) {
    if (matchesAny(path, semanticPolicy.relevantContractPathGlobs)) rejected.push(path);
    else if (matchesAny(path, semanticPolicy.unrelatedPathGlobs)) preserved.push(path);
    else rejected.push(path);
  }
  return rejected.length
    ? { status: "RECONCILIATION_REQUIRED", preserved, rejected }
    : { status: "SEMANTIC_CARRY_FORWARD", preserved, rejected };
}

export function qualifyProtectedMerge({
  authority,
  qualified,
  plan,
  finalization,
  prNumber,
  candidateSha,
  currentBaseSha,
  mergeSha,
  mergeParents,
  changedPaths,
  baseAncestryValid,
  authorityRunId,
  recordOnlyChangedPaths,
  recordOnlyAncestryValid,
}) {
  const errors = [];
  const binding = authority?.protectedMergeBinding;
  if (!binding?.enabled || binding.requiredContext !== PROTECTED_MAINLINE_CONTEXT)
    errors.push("PROTECTED_BINDING_POLICY_INVALID");
  if (!sha(candidateSha) || !sha(currentBaseSha) || !sha(mergeSha)) errors.push("MERGE_IDENTITY_INVALID");
  if (!qualified || qualified.prNumber !== Number(prNumber) || qualified.candidateSha !== candidateSha)
    errors.push("QUALIFIED_PR_OR_HEAD_MISMATCH");
  if (!qualified || qualified.authoritativeRunId !== Number(authorityRunId)) errors.push("QUALIFIED_RUN_MISMATCH");
  const recordOnly = plan?.recordOnly?.mode === "FAIL_CLOSED_RECORD_ONLY";
  if (!sha(qualified?.qualifiedBaseSha)) errors.push("QUALIFIED_BASE_SHA_INVALID");
  if (!recordOnly && baseAncestryValid !== true) errors.push("QUALIFIED_BASE_ANCESTRY_INVALID");
  if (!Array.isArray(mergeParents) || mergeParents.length !== 2) errors.push("SYNTHETIC_MERGE_PARENT_COUNT_INVALID");
  else if (!mergeParents.includes(candidateSha) || !mergeParents.includes(currentBaseSha))
    errors.push("SYNTHETIC_MERGE_COMPOSITION_INVALID");
  errors.push(...validateFinalizedEvidence({ plan, finalization, qualified: qualified ?? {} }));
  if (recordOnly)
    errors.push(
      ...validateRecordOnlyPlan({
        plan,
        qualified,
        candidateSha,
        currentBaseSha,
        mergeSha,
        recordOnlyChangedPaths,
        recordOnlyAncestryValid,
      }),
    );
  const carryForward = recordOnly
    ? {
        status: "RECORD_ONLY_EXACT_CANDIDATE_DIFF",
        preserved: plan.recordOnly.changedPaths,
        rejected: [],
      }
    : classifyBaseAdvance({
        qualifiedBaseSha: qualified?.qualifiedBaseSha,
        currentBaseSha,
        changedPaths,
        semanticPolicy: binding?.semanticCarryForward ?? {},
      });
  if (carryForward.status === "RECONCILIATION_REQUIRED" || carryForward.status === "FAIL_CLOSED")
    errors.push("BASE_ADVANCE_RECONCILIATION_REQUIRED");
  return {
    authority: "SOUNDING_LINE_PROTECTED_MERGE_BINDING",
    decision: errors.length ? "BINDING_NO_GO" : "BINDING_PASS",
    protectedContext: PROTECTED_MAINLINE_CONTEXT,
    prNumber: Number(prNumber),
    candidateSha,
    currentBaseSha,
    mergeSha,
    qualifiedBaseSha: qualified?.qualifiedBaseSha ?? null,
    authoritativeRunId: Number(authorityRunId),
    carryForward,
    errors: [...new Set(errors)].sort(),
  };
}
