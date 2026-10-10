import { receiptSchema, spatialMomentSchema, type InstanceBinding } from "./contracts";

/** Receiving owner checks identity/freshness. User-reported interactions never certify physical accuracy. */
export function evaluateSpatialEvidence(input: unknown, momentInput: unknown, binding: InstanceBinding, now: Date) {
  const receipt = receiptSchema.parse(input),
    moment = spatialMomentSchema.parse(momentInput);
  for (const field of ["sessionId", "chronicleVersionId", "blockId", "actorId"] as const)
    if (receipt[field] !== binding[field]) throw new Error("PARALLAX_EVIDENCE_SCOPE_MISMATCH");
  if (
    receipt.instanceId !== `instance:${moment.attachment.id}:${binding.runId}` ||
    receipt.spatialDefinitionVersionId !== moment.version.id ||
    receipt.versionChecksum !== moment.version.checksum
  )
    throw new Error("PARALLAX_EVIDENCE_VERSION_MISMATCH");
  const entity = moment.version.entities.find((e) => e.id === receipt.entityId);
  if (!entity || !entity.interactions.includes(receipt.interactionType) || entity.anchorId !== receipt.anchorId)
    throw new Error("PARALLAX_EVIDENCE_ENTITY_MISMATCH");
  const age = now.getTime() - Date.parse(receipt.observedAt);
  if (age > 120000 || age < -5000) throw new Error("PARALLAX_EVIDENCE_STALE");
  if (receipt.synthetic) throw new Error("PARALLAX_SIMULATION_FORBIDDEN");
  return {
    receipt,
    disposition: "OBSERVED_ONLY" as const,
    progressionChanged: false as const,
    physicalQualification: "NOT_ESTABLISHED" as const,
  };
}
