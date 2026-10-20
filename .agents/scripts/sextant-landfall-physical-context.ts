import type { LandfallDefinition } from "../../src/landfall/schema";
import { landfallFixture } from "../../src/landfall/fixtures";
import { validateLandfallDefinition } from "../../src/landfall/definition";

/** A separate synthetic map, not a privacy downgrade of the approximate map. */
export function sextantGenericPhysicalDefinition(taleId: string): LandfallDefinition {
  const definition = structuredClone(landfallFixture);
  const world = structuredClone(definition.worldspaces[0]);
  const map = structuredClone(definition.maps[0]);
  const waypoint = structuredClone(definition.waypoints[0]);
  const route = structuredClone(definition.routes[0]);
  world.id = "synthetic-generic-field";
  world.name = "Synthetic generic field";
  world.coordinateReference.id = "synthetic-generic-wgs84";
  world.privacyPolicy.classification = "GENERIC";
  map.id = "synthetic-generic-field-map";
  map.worldspaceId = world.id;
  map.referenceId = world.coordinateReference.id;
  map.privacyClassification = "GENERIC";
  const coordinate = (latitude: number, longitude: number) => ({
    type: "WGS84" as const,
    worldspaceId: world.id,
    referenceId: world.coordinateReference.id,
    referenceVersion: 1,
    latitude,
    longitude,
  });
  map.camera.center = coordinate(0, 0);
  world.mapDefinitionIds = [map.id];
  world.defaultMapDefinitionId = map.id;
  waypoint.id = "synthetic-generic-arrival";
  waypoint.worldspaceId = world.id;
  waypoint.mapId = map.id;
  waypoint.geometry = { type: "POINT_RADIUS", center: coordinate(0, 0), radius: 100 };
  route.id = "synthetic-generic-route";
  route.worldspaceId = world.id;
  route.waypointIds = [waypoint.id];
  route.geometry = { type: "CORRIDOR", points: [coordinate(-0.001, 0), coordinate(0, 0)], width: 60 };
  route.privacyClassification = "GENERIC";
  Object.assign(definition, {
    taleId,
    worldspaces: [world],
    maps: [map],
    waypoints: [waypoint],
    routes: [route],
    transitions: [],
  });
  return validateLandfallDefinition(definition);
}

/** Extend only the owned synthetic physical fixture; retain its map's privacy policy. */
export function prepareSextantPhysicalContext(
  definition: LandfallDefinition,
  referenceAssetId: string,
  scope = { worldspaceId: "town", waypointId: "town-arrival" },
) {
  const worldspace = definition.worldspaces.find((item) => item.id === scope.worldspaceId)!;
  const waypoint = definition.waypoints.find((item) => item.id === scope.waypointId)!;
  const map = definition.maps.find((item) => item.id === waypoint.mapId)!;
  worldspace.observationPolicy.allowedSources.push("NATIVE_LOCATION", "WATCHGLASS");
  // This synthetic worldspace permits testing the ordinary optional-service UI.
  // The actual map, region and landmark keep their existing privacy protection.
  worldspace.privacyPolicy.classification = "GENERIC";
  waypoint.evidenceProfile.acceptedSources.push("WATCHGLASS");
  waypoint.regionId = "synthetic-physical-region";
  waypoint.landmarkId = "synthetic-field-landmark";
  waypoint.installations = [
    {
      id: "synthetic-optional-installation",
      medium: "QR",
      label: "Synthetic optional tag",
      accessibilityAlternative: "Use the readable observation or Captain path.",
    },
  ];
  definition.context = {
    regions: [
      {
        id: waypoint.regionId,
        worldspaceId: worldspace.id,
        mapId: map.id,
        name: "Synthetic field context",
        kind: "SITE",
        geometry: structuredClone(waypoint.geometry),
        hiddenUntilRevealed: false,
        privacyClassification: map.privacyClassification,
      },
    ],
    landmarks: [
      {
        id: waypoint.landmarkId,
        regionId: waypoint.regionId,
        waypointId: waypoint.id,
        name: "Synthetic field arch",
        privacyClassification: map.privacyClassification,
        referenceAssetIds: [referenceAssetId],
        negativeReferenceAssetIds: [],
        minimumFrames: 2,
        guidance: "Use the readable observation or Captain path when surrounding-area evidence is unavailable.",
        fallback: waypoint.fallback,
      },
    ],
  };
}
