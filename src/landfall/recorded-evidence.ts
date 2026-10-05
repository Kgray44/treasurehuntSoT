import { z } from "zod";
import { landfallId } from "@/landfall/schema";

export const recordedLandfallEvidenceSchema = z.object({
  evidenceId: landfallId,
  worldspaceId: landfallId,
  waypointId: landfallId,
});
export type RecordedLandfallEvidence = z.infer<typeof recordedLandfallEvidenceSchema>;

/** Read-only acknowledgement of an actor-bound canonical event, never a new qualification. */
export function projectRecordedLandfallEvidence(
  event: { sessionId: string; eventType: string; payload: string } | null,
  scope: { sessionId: string; publishedVersionId: string; playerProfileId: string; evidenceId: string },
): RecordedLandfallEvidence | null {
  if (
    !event ||
    event.sessionId !== scope.sessionId ||
    event.eventType !== "landfallWaypointConfirmed" ||
    event.payload.length > 32768
  )
    return null;
  try {
    const value = JSON.parse(event.payload);
    if (
      value.actorProfileId !== scope.playerProfileId ||
      value.publishedVersionId !== scope.publishedVersionId ||
      value.evidenceId !== scope.evidenceId
    )
      return null;
    return recordedLandfallEvidenceSchema.parse(value);
  } catch {
    return null;
  }
}
