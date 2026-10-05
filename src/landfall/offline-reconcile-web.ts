import { z } from "zod";
import { landfallId } from "@/landfall/schema";
import { recordedLandfallEvidenceSchema } from "@/landfall/recorded-evidence";
import {
  LandfallOutboxReconciler,
  type LandfallOutbox,
  type LandfallReconciliationTransport,
} from "@/landfall/offline-reconcile";

const authorizationSchema = z.object({
  available: z.literal(true),
  bootstrap: z.object({
    sessionId: landfallId,
    publishedVersionId: landfallId,
    currentSequence: z.number().int().nonnegative(),
    replayOnly: z.boolean(),
  }),
  recordedEvidence: recordedLandfallEvidenceSchema.nullable().optional(),
});
/** Shared Player transport; status/identity checks remain mandatory on every replay. */
export function createPlayerLandfallReconciler(sessionId: string, csrfToken: string, outbox: LandfallOutbox) {
  const endpoint = `/api/player/playthroughs/${encodeURIComponent(sessionId)}/landfall`;
  const revoked = (status: number) => [401, 403, 404].includes(status);
  const transport: LandfallReconciliationTransport = {
    authorize: async (evidence) => {
      const response = await fetch(`${endpoint}?receiptEvidenceId=${encodeURIComponent(evidence.evidenceId)}`, {
        cache: "no-store",
      });
      if (revoked(response.status)) return { state: "REVOKED" };
      if (!response.ok) return { state: "UNAVAILABLE" };
      const value = authorizationSchema.safeParse(await response.json());
      if (!value.success) return { state: "UNAVAILABLE" };
      return { state: "AUTHORIZED", ...value.data.bootstrap, recordedEvidence: value.data.recordedEvidence };
    },
    submit: async (evidence) => {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
        body: JSON.stringify(evidence),
      });
      if (revoked(response.status)) return "REVOKED";
      if (response.status >= 500 || response.status === 429) return "UNAVAILABLE";
      if (!response.ok) return "CONFLICT";
      const value = await response.json();
      const receipt = value?.receipt;
      if (
        receipt?.status !== "CONFIRMED" ||
        receipt.sessionId !== evidence.sessionId ||
        receipt.publishedVersionId !== evidence.publishedVersionId ||
        receipt.evidenceId !== evidence.evidenceId ||
        receipt.waypointId !== evidence.waypointId
      )
        return "UNAVAILABLE";
      return value.duplicate === true ? "DUPLICATE" : "ACCEPTED";
    },
  };
  return new LandfallOutboxReconciler(outbox, transport);
}
