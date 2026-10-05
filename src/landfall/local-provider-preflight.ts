import type { LandfallDefinition } from "@/landfall/schema";
import type { LandfallProviderPlan, ProviderStatus } from "@/landfall/provider-policy";

type Requirement = LandfallProviderPlan["requirements"][number];

/** Authored-data readiness only. Never asserts deployment, client permissions or device health. */
export function localLandfallProviderPreflight(
  definition: LandfallDefinition,
  requirement: Requirement,
): ProviderStatus[] {
  const world = definition.worldspaces.find((item) => item.id === requirement.worldspaceId);
  if (!world) return [];
  const maps = definition.maps.filter((item) => item.worldspaceId === world.id);
  const waypoints = definition.waypoints.filter((item) => item.worldspaceId === world.id);
  const routes = definition.routes.filter((item) => item.worldspaceId === world.id);
  const regions = definition.context?.regions.filter((item) => item.worldspaceId === world.id) ?? [];
  const supported: string[] = [];
  const capability = requirement.capability;
  switch (requirement.family) {
    case "MAP_RENDERER":
      if (["render", "accessible"].includes(capability) && maps.length) supported.push("semantic-chart");
      break;
    case "MAP_DATA":
      if (capability === "vector" && maps.some((map) => map.source.type === "AUTHORED_VECTOR"))
        supported.push("authored-map");
      break;
    case "GEOCODING":
      if (
        (["forward", "local"].includes(capability) && (waypoints.length || regions.length)) ||
        (["reverse", "bounded", "proximity"].includes(capability) &&
          waypoints.some((waypoint) => waypoint.geometry.type === "POINT_RADIUS"))
      )
        supported.push("authored-places");
      break;
    case "ROUTING":
      if (
        routes.some(
          (route) =>
            route.waypointIds.length &&
            (capability === "authored" ||
              (capability === "virtual" && world.kind === "VIRTUAL") ||
              (capability === "indoor" &&
                route.waypointIds.some((id) =>
                  waypoints.some(
                    (waypoint) =>
                      waypoint.id === id &&
                      regions.some(
                        (region) =>
                          region.id === waypoint.regionId &&
                          ["ROOM", "FLOOR", "GALLERY", "CORRIDOR", "STAIRS"].includes(region.kind),
                      ),
                  ),
                ))),
        )
      )
        supported.push("authored-routes");
      break;
    case "ELEVATION":
      if (
        regions.some((region) => region.level) &&
        (["floor", "authored"].includes(capability) || (capability === "virtual" && world.kind === "VIRTUAL"))
      )
        supported.push("authored-elevation");
      break;
    case "VIRTUAL_REGION":
      if (world.kind === "VIRTUAL" && capability === "authored" && regions.length) supported.push("virtual-regions");
      break;
  }
  return supported
    .filter((id) => !requirement.providerId || requirement.providerId === id)
    .map((id) => ({
      id,
      health: "READY",
      enabled: true,
      configured: true,
      credentialAvailable: false,
    }));
}
