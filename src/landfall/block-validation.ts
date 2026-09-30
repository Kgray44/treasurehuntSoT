import type { JsonObject } from "@/chronicle/types";
import { landfallCompletionOptions } from "@/landfall/completion";
import type { LandfallDefinition } from "@/landfall/schema";

export type LandfallBlockFinding = Readonly<{ code: string; message: string; blockId: string }>;
const landfallBlocks = new Set([
  "livingChart",
  "waypointJourney",
  "routeJourney",
  "locationReveal",
  "locationObservation",
  "locationChoice",
]);

/** Cross checks Chronicle references against the exact Landfall draft that will be published. */
export function validateLandfallBlockContracts(
  definition: LandfallDefinition | null | undefined,
  blocks: readonly {
    id: string;
    title: string;
    blockType: string;
    configuration: JsonObject;
    completion: JsonObject;
  }[],
): LandfallBlockFinding[] {
  const findings: LandfallBlockFinding[] = [];
  for (const block of blocks) {
    const ownsLandfall = landfallBlocks.has(block.blockType);
    const usesProvider = block.completion.mode === "landfall";
    if (!ownsLandfall && !usesProvider) continue;
    const add = (code: string, message: string) =>
      findings.push({ code, message: `${block.title}: ${message}`, blockId: block.id });
    if (!definition) {
      add("LANDFALL_DEFINITION_MISSING", "create a Living Chart before using Landfall in a Passage.");
      continue;
    }
    const worldspaceId = String(block.configuration.worldspaceId ?? "");
    const worldspace = definition.worldspaces.find((item) => item.id === worldspaceId);
    if (ownsLandfall && !worldspace) add("LANDFALL_BLOCK_WORLDSPACE", "choose a valid Worldspace.");
    if (
      ["waypointJourney", "locationObservation"].includes(block.blockType) &&
      !definition.waypoints.some(
        (item) => item.id === block.configuration.waypointId && item.worldspaceId === worldspaceId,
      )
    )
      add("LANDFALL_BLOCK_WAYPOINT", "choose a waypoint in this Worldspace.");
    if (
      block.blockType === "routeJourney" &&
      !definition.routes.some((item) => item.id === block.configuration.routeId && item.worldspaceId === worldspaceId)
    )
      add("LANDFALL_BLOCK_ROUTE", "choose a route in this Worldspace.");
    if (block.blockType === "locationReveal") {
      const found =
        block.configuration.targetType === "WAYPOINT"
          ? definition.waypoints.some(
              (item) => item.id === block.configuration.targetId && item.worldspaceId === worldspaceId,
            )
          : block.configuration.targetType === "ROUTE"
            ? definition.routes.some(
                (item) => item.id === block.configuration.targetId && item.worldspaceId === worldspaceId,
              )
            : block.configuration.targetType === "OVERLAY"
              ? definition.maps.some(
                  (item) =>
                    item.worldspaceId === worldspaceId &&
                    item.overlays?.some((overlay) => overlay.id === block.configuration.targetId),
                )
              : false;
      if (!found) add("LANDFALL_REVEAL_TARGET", "choose a waypoint, route, or overlay in this Worldspace to reveal.");
    }
    if (block.blockType === "locationChoice" && Array.isArray(block.configuration.choices))
      for (const option of block.configuration.choices) {
        const choice = option && typeof option === "object" ? (option as JsonObject) : {};
        const waypoint = definition.waypoints.some(
          (item) => item.id === choice.targetWaypointId && item.worldspaceId === worldspaceId,
        );
        const route = definition.routes.some(
          (item) => item.id === choice.targetRouteId && item.worldspaceId === worldspaceId,
        );
        if (waypoint === route) add("LANDFALL_CHOICE_TARGET", "each choice needs exactly one valid waypoint or route.");
      }
    if (usesProvider) {
      let options: ReturnType<typeof landfallCompletionOptions>;
      try {
        options = landfallCompletionOptions(block.completion);
      } catch {
        options = null;
      }
      if (!options) {
        add("LANDFALL_COMPLETION_INVALID", "configure the typed Landfall completion provider.");
        continue;
      }
      const waypoint = definition.waypoints.find(
        (item) => item.id === options.locationId && item.worldspaceId === options.worldspaceId,
      );
      if (!waypoint) add("LANDFALL_COMPLETION_WAYPOINT", "choose a valid completion waypoint.");
      else {
        if (
          options.allowPlayerFallback &&
          (waypoint.fallback.mode !== "PLAYER" ||
            !waypoint.evidenceProfile.allowManualFallback ||
            !waypoint.evidenceProfile.acceptedSources.includes("PLAYER_CONFIRMATION"))
        )
          add("LANDFALL_COMPLETION_FALLBACK", "the selected waypoint does not permit Player fallback.");
        if (options.allowCaptainOverride && !waypoint.evidenceProfile.allowCaptainOverride)
          add("LANDFALL_COMPLETION_CAPTAIN", "the selected waypoint does not permit Captain override.");
      }
    }
  }
  return findings;
}
