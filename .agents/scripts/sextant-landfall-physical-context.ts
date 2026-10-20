import type { LandfallDefinition } from "../../src/landfall/schema";

/** Extend only the owned synthetic physical fixture; retain its map's privacy policy. */
export function prepareSextantPhysicalContext(definition: LandfallDefinition, referenceAssetId: string) {
  const worldspace = definition.worldspaces.find((item) => item.id === "town")!;
  const waypoint = definition.waypoints.find((item) => item.id === "town-arrival")!;
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
