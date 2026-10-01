import type { PublishedBlock } from "@/chronicle/types";
import { landfallCompletionOptions, landfallOutcomeSatisfies } from "@/landfall/completion";
import type { LandfallJourneyEvent } from "@/landfall/journey-projection";

/** Arrival establishes context for this Passage; the response is a separate Chronicle action. */
export function observationContextReached(
  block: Pick<PublishedBlock, "id" | "blockType" | "configuration" | "completion">,
  events: readonly (LandfallJourneyEvent & { blockId?: string | null })[],
): boolean {
  if (block.blockType !== "locationObservation") return false;
  const requirement = landfallCompletionOptions(block.completion ?? {});
  return events.some((event) => {
    if (event.eventType !== "landfallWaypointConfirmed" || event.blockId !== block.id) return false;
    try {
      const payload = typeof event.payload === "string" ? JSON.parse(event.payload) : event.payload;
      return (
        payload.worldspaceId === block.configuration.worldspaceId &&
        payload.waypointId === block.configuration.waypointId &&
        ["NEARBY", "LIKELY_INSIDE", "CONFIRMED"].includes(payload.outcome) &&
        landfallOutcomeSatisfies(payload.outcome, requirement?.requiredOutcome ?? "CONFIRMED")
      );
    } catch {
      return false;
    }
  });
}
