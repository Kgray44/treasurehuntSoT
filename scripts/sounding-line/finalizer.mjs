/* The only module permitted to emit a Sounding Line release decision. */
import { createHash } from "node:crypto";

const digest = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

export function finalize({ plan, receipts }) {
  const mandatory = new Set(plan.nodes.map((node) => node.id));
  const seen = new Set(receipts.map((receipt) => receipt.suiteId));
  const missing = [...mandatory].filter((id) => !seen.has(id));
  const invalid = receipts.filter(
    (receipt) =>
      receipt.sourceSha !== plan.sourceSha ||
      receipt.policyDigest !== plan.policyDigest ||
      receipt.planDigest !== plan.planDigest ||
      receipt.cleanupState !== "CLEAN",
  );
  const failed = receipts.filter((receipt) => receipt.result !== "PASSED");
  const decision =
    missing.length || invalid.length ? "EVIDENCE_INVALID" : failed.length ? "RELEASE_NO_GO" : "RELEASE_GO";
  return {
    authority: "SOUNDING_LINE_FINALIZER",
    decision,
    gate: plan.gate,
    planDigest: plan.planDigest,
    receipts,
    missingMandatorySuites: missing,
    invalidEvidence: invalid.map((receipt) => receipt.suiteId),
    evidenceDigest: digest(receipts),
  };
}
