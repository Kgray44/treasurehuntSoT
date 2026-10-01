import { z } from "zod";
import { landfallId } from "@/landfall/schema";
import type { LandfallObservation } from "@/landfall/observation";

export type WatchglassTarget = {
  sessionId: string;
  playerProfileId: string;
  publishedVersionId: string;
  expectedSequence: number;
  worldspaceId: string;
  worldspaceVersion: number;
  waypointId: string;
  definitionHash: string;
};
const receiptSchema = z.strictObject({
  id: landfallId,
  sessionId: landfallId,
  playerProfileId: landfallId,
  publishedVersionId: landfallId,
  expectedSequence: z.number().int().nonnegative(),
  worldspaceId: landfallId,
  worldspaceVersion: z.number().int().positive(),
  waypointId: landfallId,
  definitionHash: z.string().regex(/^[a-f0-9]{64}$/),
  packageId: landfallId,
  packageVersion: landfallId,
  certificationRef: landfallId,
  observedAt: z.string().datetime({ offset: true }),
  expiresAt: z.string().datetime({ offset: true }),
  result: z.enum(["match", "notMatch", "uncertain"]),
  confidence: z.number().finite().min(0).max(1),
  supportingObservations: z
    .array(z.strictObject({ id: landfallId, observedAt: z.string().datetime({ offset: true }) }))
    .min(1)
    .max(20),
  independentEvidenceRef: landfallId,
  contextEvidenceRefs: z.array(landfallId).max(16),
});
export type WatchglassVerifiedReceipt = z.infer<typeof receiptSchema>;
/** Installed server adapter owns authentication, package certification, abstention and frames.
 * Never construct this object from Creator/Player JSON. No recognition adapter ships here. */
export type WatchglassEvidenceProvider = {
  id: string;
  state: "AVAILABLE" | "UNAVAILABLE" | "NOT_CONFIGURED";
  packageId: string;
  packageVersion: string;
  certificationRef: string;
  worldspaceKinds: readonly ("PHYSICAL" | "VIRTUAL")[];
  verifyReceipt: (opaqueReceipt: string) => unknown;
};
export function readWatchglassHandoff(
  provider: WatchglassEvidenceProvider | undefined,
  opaqueReceipt: string,
  target: WatchglassTarget,
  worldspaceKind: "PHYSICAL" | "VIRTUAL",
  now: number,
):
  | { state: "NOT_CONFIGURED" | "UNAVAILABLE" }
  | { state: "AVAILABLE"; observation: LandfallObservation; observations: LandfallObservation[] } {
  if (!provider || provider.state === "NOT_CONFIGURED") return { state: "NOT_CONFIGURED" };
  if (provider.state !== "AVAILABLE" || !provider.worldspaceKinds.includes(worldspaceKind))
    return { state: "UNAVAILABLE" };
  if (!opaqueReceipt || opaqueReceipt.length > 8192) throw new Error("LANDFALL_WATCHGLASS_RECEIPT_INVALID");
  const receipt = receiptSchema.parse(provider.verifyReceipt(opaqueReceipt));
  if (
    Object.entries(target).some(([key, value]) => receipt[key as keyof typeof receipt] !== value) ||
    receipt.packageId !== provider.packageId ||
    receipt.packageVersion !== provider.packageVersion ||
    receipt.certificationRef !== provider.certificationRef
  )
    throw new Error("LANDFALL_WATCHGLASS_SCOPE_MISMATCH");
  if (
    !Number.isFinite(now) ||
    Date.parse(receipt.observedAt) > now + 1000 ||
    now - Date.parse(receipt.observedAt) > 30_000 ||
    Date.parse(receipt.expiresAt) <= now ||
    Date.parse(receipt.expiresAt) > Date.parse(receipt.observedAt) + 30_000
  )
    throw new Error("LANDFALL_WATCHGLASS_STALE");
  if (receipt.contextEvidenceRefs.includes(receipt.independentEvidenceRef))
    throw new Error("LANDFALL_WATCHGLASS_CIRCULAR_EVIDENCE");
  const supporting = receipt.supportingObservations;
  if (
    new Set(supporting.map((item) => item.id)).size !== supporting.length ||
    supporting.some(
      (item, index) =>
        Date.parse(item.observedAt) > Date.parse(receipt.observedAt) ||
        now - Date.parse(item.observedAt) > 30_000 ||
        (index > 0 && Date.parse(item.observedAt) - Date.parse(supporting[index - 1].observedAt) < 250),
    )
  )
    throw new Error("LANDFALL_WATCHGLASS_SUPPORT_INVALID");
  const observation: LandfallObservation = {
    schemaVersion: 1,
    id: receipt.id,
    sessionId: receipt.sessionId,
    publishedVersionId: receipt.publishedVersionId,
    worldspaceId: receipt.worldspaceId,
    providerId: provider.id,
    source: "WATCHGLASS",
    kind: "SEMANTIC_LOCATION",
    targetLocationId: receipt.waypointId,
    observedAt: receipt.observedAt,
    expiresAt: receipt.expiresAt,
    assertion: receipt.result === "match" ? "PRESENT" : receipt.result === "notMatch" ? "ABSENT" : "UNCERTAIN",
    confidence: receipt.confidence,
    evidenceRef: receipt.independentEvidenceRef,
    provenance: {
      independentEvidenceRef: receipt.independentEvidenceRef,
      contextEvidenceRefs: receipt.contextEvidenceRefs,
    },
  };
  const observations = supporting.map((item) => ({ ...observation, id: item.id, observedAt: item.observedAt }));
  return { state: "AVAILABLE", observation: observations.at(-1)!, observations };
}
