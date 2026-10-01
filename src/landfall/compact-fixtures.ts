import { landfallFixture, physicalCoordinate } from "@/landfall/fixtures";
import { validateLandfallDefinition } from "@/landfall/definition";
import type { LandfallDefinition, LandfallGeometry, LandfallRegion } from "@/landfall/schema";

/** Fictional compact-site geometry; never a retained field walk or private floor layout. */
export function compactSiteFixture(kind: "MUSEUM" | "GARDEN" = "MUSEUM"): LandfallDefinition {
  const definition = structuredClone(landfallFixture);
  const world = definition.worldspaces[0];
  const map = definition.maps[0];
  world.name = kind === "MUSEUM" ? "Fictional Lantern Museum" : "Fictional Lantern Garden";
  world.privacyPolicy.classification = "PRIVATE_REAL_WORLD";
  world.privacyPolicy.allowPublicGeometry = false;
  map.name = "Site and ground level";
  map.privacyClassification = "PRIVATE_REAL_WORLD";
  map.level = "Ground";
  definition.worldspaces = [world];
  definition.maps = [map];
  definition.transitions = [];
  const at = (x: number, y: number) => physicalCoordinate(44 + y / 111_000, -72 + x / 80_000);
  const area = (x: number, y: number, radius: number): LandfallGeometry => ({
    type: "POINT_RADIUS",
    center: at(x, y),
    radius,
  });
  const regions: LandfallRegion[] = [];
  const add = (
    id: string,
    name: string,
    regionKind: LandfallRegion["kind"],
    geometry: LandfallGeometry,
    parentId?: string,
    mapId = map.id,
    level?: string,
  ) =>
    regions.push({
      id,
      name,
      kind: regionKind,
      worldspaceId: world.id,
      mapId,
      geometry,
      ...(parentId ? { parentId } : {}),
      ...(level ? { level } : {}),
      privacyClassification: "PRIVATE_REAL_WORLD",
      hiddenUntilRevealed: false,
    });
  add("compact-site", "Property", "SITE", area(0, 0, 160));
  add(
    "compact-building",
    kind === "MUSEUM" ? "Museum building" : "Garden conservatory",
    "BUILDING",
    area(0, 0, 65),
    "compact-site",
  );
  add("compact-entrance", "East entrance", "ENTRANCE", area(45, 0, 10), "compact-building", map.id, "Ground");
  add("compact-floor-ground", "Ground level", "FLOOR", area(0, 0, 60), "compact-building", map.id, "Ground");
  add(
    "compact-east-gallery",
    kind === "MUSEUM" ? "East gallery" : "Fern house",
    "GALLERY",
    area(15, 10, 18),
    "compact-floor-ground",
    map.id,
    "Ground",
  );
  add(
    "compact-west-gallery",
    kind === "MUSEUM" ? "West gallery" : "Rose court",
    "GALLERY",
    area(-25, 10, 18),
    "compact-floor-ground",
    map.id,
    "Ground",
  );
  add(
    "compact-corridor",
    "North passage",
    "CORRIDOR",
    { type: "CORRIDOR", points: [at(35, 0), at(10, 0), at(-30, 0)], width: 4 },
    "compact-floor-ground",
    map.id,
    "Ground",
  );
  add(
    "compact-parallel",
    "South passage",
    "CORRIDOR",
    { type: "CORRIDOR", points: [at(35, -7), at(10, -7), at(-30, -7)], width: 4 },
    "compact-floor-ground",
    map.id,
    "Ground",
  );
  add(
    "compact-target",
    "Mural and plaque search area",
    "EXHIBIT_ZONE",
    area(-25, 10, 6),
    "compact-west-gallery",
    map.id,
    "Ground",
  );
  if (kind === "MUSEUM") {
    const upper = {
      ...structuredClone(map),
      id: "compact-map-upper",
      name: "Upper gallery level",
      level: "Upper",
      role: "FLOOR" as const,
    };
    definition.maps.push(upper);
    world.mapDefinitionIds.push(upper.id);
    add("compact-floor-upper", "Upper level", "FLOOR", area(0, 0, 60), "compact-building", upper.id, "Upper");
    add(
      "compact-upper-gallery",
      "Upper gallery",
      "GALLERY",
      area(-25, 10, 18),
      "compact-floor-upper",
      upper.id,
      "Upper",
    );
    add("compact-stairs", "Gallery stairs", "STAIRS", area(-40, 0, 5), "compact-building", map.id);
  }
  const prototype = structuredClone(definition.waypoints[0]);
  const waypoint = (id: string, name: string, regionId: string, geometry: LandfallGeometry, optional = false) => ({
    ...structuredClone(prototype),
    id,
    name,
    mapId: map.id,
    worldspaceId: world.id,
    regionId,
    geometry,
    privacyClassification: "PRIVATE_REAL_WORLD" as const,
    visibility: { hiddenUntilRevealed: false },
    sequence: { afterWaypointIds: [], optional },
    fallback: { mode: "PLAYER" as const },
    evidenceProfile: {
      ...prototype.evidenceProfile,
      acceptedSources: [
        "BROWSER_GEOLOCATION",
        "PLAYER_CONFIRMATION",
        "CAPTAIN_CONFIRMATION",
        "VISION_WAYPOINT",
      ] as typeof prototype.evidenceProfile.acceptedSources,
      requiredSamples: 2,
      dwellSeconds: 0,
      allowManualFallback: true,
      allowCaptainOverride: true,
    },
  });
  definition.waypoints = [
    waypoint("compact-arrival", "Museum property reached", "compact-site", area(0, 0, 150)),
    waypoint("compact-door", "Enter through the east entrance", "compact-entrance", area(45, 0, 12)),
    waypoint("compact-room", "Continue along the gallery", "compact-west-gallery", area(-25, 10, 18)),
    waypoint("compact-landmark-target", "Look for the Lantern mural", "compact-target", area(-25, 10, 8)),
    waypoint("compact-observation", "Read the plaque beside the mural", "compact-target", area(-25, 10, 8)),
    waypoint("compact-optional", "Optional garden sculpture", "compact-site", area(70, 45, 12), true),
    waypoint("compact-fallback", "Accessible east-gallery route", "compact-east-gallery", area(15, 10, 18), true),
  ];
  definition.waypoints[2].type = "INDOOR_REGION";
  definition.waypoints[2].evidenceProfile.precisionProfile = "INDOOR_REGION";
  definition.waypoints[2].completion.requiredOutcome = "LIKELY_INSIDE";
  definition.waypoints[3].type = "NATURAL_LANDMARK";
  definition.waypoints[3].landmarkId = "compact-mural";
  definition.waypoints[3].evidenceProfile.precisionProfile = "EXACT_OBJECT";
  definition.waypoints[4].evidenceProfile.precisionProfile = "EXACT_OBJECT";
  world.observationPolicy.allowedSources = [
    "BROWSER_GEOLOCATION",
    "PLAYER_CONFIRMATION",
    "CAPTAIN_CONFIRMATION",
    "VISION_WAYPOINT",
  ];
  definition.routes = [
    {
      ...structuredClone(definition.routes[0]),
      id: "compact-route",
      name: "Museum gallery walk",
      worldspaceId: world.id,
      model: "GUIDED_CORRIDOR",
      travelMode: kind === "MUSEUM" ? "INDOOR" : "MIXED",
      waypointIds: definition.waypoints.filter((item) => !item.sequence.optional).map((item) => item.id),
      geometry: { type: "CORRIDOR", points: [at(45, 0), at(15, 0), at(-25, 0), at(-25, 10)], width: 4 },
      segmentRegionIds: ["compact-entrance", "compact-corridor", "compact-west-gallery"],
      offRouteTolerance: 3,
      privacyClassification: "PRIVATE_REAL_WORLD",
    },
  ];
  definition.context = {
    regions,
    landmarks: [
      {
        id: "compact-mural",
        regionId: "compact-target",
        waypointId: "compact-landmark-target",
        name: "Lantern mural",
        guidance:
          "Look for the triangular Lantern mural. Align the camera with the authored view, or use the accessible observation or Captain path.",
        referenceAssetIds: ["compact-reference-positive"],
        negativeReferenceAssetIds: ["compact-reference-negative"],
        minimumFrames: 2,
        fallback: { mode: "PLAYER" },
        privacyClassification: "PRIVATE_REAL_WORLD",
      },
    ],
  };
  return validateLandfallDefinition(definition);
}
