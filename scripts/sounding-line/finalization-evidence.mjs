import { createHash } from "node:crypto";

const digest = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

export function v14FinalizationEvidence(finalization) {
  const { receipts, physicalReceipts, runtimeConformance, physicalRuntimeConformance } = finalization ?? {};
  if (![receipts, physicalReceipts, runtimeConformance, physicalRuntimeConformance].every(Array.isArray)) return null;
  return { receipts, physicalReceipts, runtimeConformance, physicalRuntimeConformance };
}

export function finalizationEvidenceDigest({ authorityVersion, finalization }) {
  if (authorityVersion === "1.4") {
    const evidence = v14FinalizationEvidence(finalization);
    return evidence ? digest(evidence) : null;
  }
  return digest(finalization?.receipts ?? []);
}
