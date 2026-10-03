import type { LandfallDefinition, LandfallWaypoint } from "@/landfall/schema";
/** Deployable source paths, rather than merely declared source enums. Watchglass
 * and game/native integrations remain unavailable in the shipped application. */
export function landfallSourceCapabilities(definition: LandfallDefinition, waypoint: LandfallWaypoint) {
  const world = definition.worldspaces.find((item) => item.id === waypoint.worldspaceId)!;
  const allowed = (source: LandfallWaypoint["evidenceProfile"]["acceptedSources"][number]) =>
    waypoint.evidenceProfile.acceptedSources.includes(source) &&
    world.observationPolicy.allowedSources.includes(source);
  const fine =
    ["EXACT_OBJECT", "INDOOR_REGION"].includes(waypoint.evidenceProfile.precisionProfile) ||
    waypoint.type === "NATURAL_LANDMARK" ||
    definition.context?.regions.some(
      (region) => region.id === waypoint.regionId && !["SITE", "BUILDING", "OUTDOOR_COMPACT"].includes(region.kind),
    );
  const player =
    allowed("PLAYER_CONFIRMATION") &&
    waypoint.fallback.mode === "PLAYER" &&
    waypoint.evidenceProfile.allowManualFallback;
  const location = world.kind === "PHYSICAL" && !fine && allowed("BROWSER_GEOLOCATION");
  const landmark =
    world.kind === "PHYSICAL" &&
    allowed("VISION_WAYPOINT") &&
    !!definition.context?.landmarks.some((item) => item.id === waypoint.landmarkId && item.referenceAssetIds.length);
  const count = Number(player) + Number(location) + Number(landmark);
  const fallback =
    player ||
    (waypoint.fallback.mode === "CAPTAIN" && waypoint.evidenceProfile.allowCaptainOverride) ||
    waypoint.fallback.mode === "ALTERNATE_WAYPOINT";
  return {
    player,
    location,
    landmark,
    count,
    fallback,
    description: `Independent checks available: ${[player ? "Player confirmation" : "", location ? "foreground location" : "", landmark ? "authored landmark comparison" : ""].filter(Boolean).join(", ") || "none"}. Watchglass and game integration are not configured.`,
  };
}
