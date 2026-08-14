/* The only module permitted to emit a Sounding Line release decision. */
import { createHash } from "node:crypto";

const digest = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

export function finalize({ plan, receipts, runtimeConformance = [] }) {
  if (
    plan?.authorityVersion === "1.4" &&
    !["CURRENT_AUTHORITATIVE_V14", "V14_CANDIDATE_QUALIFICATION"].includes(plan?.authorityBoundary)
  )
    return {
      authority: "SOUNDING_LINE_FINALIZER",
      decision: "EVIDENCE_INVALID",
      gate: plan?.gate ?? null,
      planDigest: plan?.planDigest ?? null,
      receipts: receipts ?? [],
      missingMandatorySuites: [],
      duplicateSuiteReceipts: [],
      unknownSuiteReceipts: [],
      invalidEvidence: ["ORDINARY_RELEASE_AUTHORITY_BOUNDARY_INVALID"],
      missingRuntimeConformance: [],
      invalidRuntimeConformance: [],
      evidenceDigest: digest(receipts ?? []),
    };
  if (plan?.authority && plan.authority !== "SOUNDING_LINE")
    return {
      authority: "SOUNDING_LINE_FINALIZER",
      decision: "EVIDENCE_INVALID",
      gate: plan?.gate ?? null,
      planDigest: plan?.planDigest ?? null,
      receipts: receipts ?? [],
      missingMandatorySuites: [],
      duplicateSuiteReceipts: [],
      unknownSuiteReceipts: [],
      invalidEvidence: ["ORDINARY_RELEASE_CANNOT_CONSUME_MAINTENANCE_EVIDENCE"],
      missingRuntimeConformance: [],
      invalidRuntimeConformance: [],
      evidenceDigest: digest(receipts ?? []),
    };
  const mandatory = new Set(plan.nodes.map((node) => node.id));
  const duplicates = [
    ...new Set(receipts.map((receipt) => receipt.suiteId).filter((id, index, ids) => ids.indexOf(id) !== index)),
  ];
  const unknown = receipts.filter((receipt) => !mandatory.has(receipt.suiteId));
  const seen = new Set(receipts.map((receipt) => receipt.suiteId));
  const missing = [...mandatory].filter((id) => !seen.has(id));
  const invalid = receipts.filter(
    (receipt) =>
      receipt.sourceSha !== plan.sourceSha ||
      receipt.policyDigest !== plan.policyDigest ||
      receipt.inventoryDigest !== plan.inventoryDigest ||
      receipt.planDigest !== plan.planDigest ||
      receipt.gate !== plan.gate ||
      receipt.cleanupState !== "CLEAN" ||
      receipt.exitCode !== 0 ||
      receipt.timedOut === true,
  );
  const failed = receipts.filter((receipt) => receipt.result !== "PASSED");
  const conformanceBySuite = new Map(runtimeConformance.map((receipt) => [receipt.suiteId, receipt]));
  const missingConformance = plan.runtimeConformanceRequired
    ? [...mandatory].filter((suiteId) => !conformanceBySuite.has(suiteId))
    : [];
  const invalidConformance = plan.runtimeConformanceRequired
    ? runtimeConformance.filter(
        (receipt) =>
          !mandatory.has(receipt.suiteId) ||
          receipt.result !== "PASSED" ||
          receipt.planDigest !== plan.planDigest ||
          receipt.authorityDigest !== plan.authorityDigest,
      )
    : [];
  const decision =
    missing.length ||
    invalid.length ||
    duplicates.length ||
    unknown.length ||
    missingConformance.length ||
    invalidConformance.length
      ? "EVIDENCE_INVALID"
      : failed.length
        ? "RELEASE_NO_GO"
        : "RELEASE_GO";
  return {
    authority: "SOUNDING_LINE_FINALIZER",
    decision,
    gate: plan.gate,
    planDigest: plan.planDigest,
    receipts,
    missingMandatorySuites: missing,
    duplicateSuiteReceipts: duplicates,
    unknownSuiteReceipts: unknown.map((receipt) => receipt.suiteId),
    invalidEvidence: invalid.map((receipt) => receipt.suiteId),
    missingRuntimeConformance: missingConformance,
    invalidRuntimeConformance: invalidConformance.map((receipt) => receipt.suiteId),
    evidenceDigest: digest(receipts),
  };
}
