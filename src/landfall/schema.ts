import { z } from "zod";

/** Landfall definitions are authored data, never executable map or provider code. */
export const landfallId = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);
const text = z.string().min(1).max(240);
const nonnegative = z.number().finite().nonnegative();
const positive = z.number().finite().positive();
const finite = z.number().finite();
const maximumDate = z.string().datetime({ offset: true });

const bounds = z
  .strictObject({ minX: finite, minY: finite, maxX: finite, maxY: finite })
  .refine(({ minX, minY, maxX, maxY }) => minX < maxX && minY < maxY, "Bounds must have positive area.");
const axis = z.enum(["X_RIGHT_Y_UP", "X_RIGHT_Y_DOWN", "X_LEFT_Y_UP", "X_LEFT_Y_DOWN"]);
const affine = z
  .strictObject({
    version: z.number().int().positive(),
    checksum: z.string().regex(/^[a-f0-9]{64}$/),
    a: finite,
    b: finite,
    c: finite,
    d: finite,
    e: finite,
    f: finite,
    maxResidual: nonnegative,
  })
  .refine(({ a, b, c, d }) => Math.abs(a * d - b * c) > 1e-12, "Transform must be invertible.");

export const coordinateReferenceSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("WGS84"),
    id: landfallId,
    version: z.number().int().positive(),
    altitude: z.enum(["IGNORED", "OPTIONAL"]),
  }),
  z.strictObject({
    type: z.literal("CUSTOM_GEOREFERENCED"),
    id: landfallId,
    version: z.number().int().positive(),
    bounds,
    axis,
    unit: text,
    toWgs84: affine,
  }),
  z.strictObject({
    type: z.literal("LOCAL_CARTESIAN_2D"),
    id: landfallId,
    version: z.number().int().positive(),
    bounds,
    axis,
    unit: text,
    origin: z.strictObject({ x: finite, y: finite }),
  }),
  z.strictObject({
    type: z.literal("NORMALIZED_IMAGE_2D"),
    id: landfallId,
    version: z.number().int().positive(),
    bounds,
    axis,
    imageAssetId: landfallId,
    width: positive,
    height: positive,
  }),
  z.strictObject({
    type: z.literal("CUSTOM_VECTOR_2D"),
    id: landfallId,
    version: z.number().int().positive(),
    bounds,
    axis,
    unit: text,
    referenceId: landfallId,
  }),
]);
export type LandfallCoordinateReference = z.infer<typeof coordinateReferenceSchema>;

const coordinateBase = {
  worldspaceId: landfallId,
  referenceId: landfallId,
  referenceVersion: z.number().int().positive(),
};
export const coordinateSchema = z.discriminatedUnion("type", [
  z.strictObject({
    ...coordinateBase,
    type: z.literal("WGS84"),
    latitude: finite.min(-90).max(90),
    longitude: finite.min(-180).max(180),
  }),
  z.strictObject({ ...coordinateBase, type: z.literal("CUSTOM_GEOREFERENCED"), x: finite, y: finite }),
  z.strictObject({ ...coordinateBase, type: z.literal("LOCAL_CARTESIAN_2D"), x: finite, y: finite }),
  z.strictObject({
    ...coordinateBase,
    type: z.literal("NORMALIZED_IMAGE_2D"),
    x: finite.min(0).max(1),
    y: finite.min(0).max(1),
  }),
  z.strictObject({ ...coordinateBase, type: z.literal("CUSTOM_VECTOR_2D"), x: finite, y: finite }),
]);
export type LandfallCoordinate = z.infer<typeof coordinateSchema>;

const coordinates = z.array(coordinateSchema).min(2).max(1024);
const ring = z.array(coordinateSchema).min(4).max(1024);
export const geometrySchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("POINT_RADIUS"), center: coordinateSchema, radius: positive.max(100_000) }),
  z.strictObject({ type: z.literal("POLYGON"), rings: z.array(ring).min(1).max(16) }),
  z.strictObject({ type: z.literal("MULTIPOLYGON"), polygons: z.array(z.array(ring).min(1).max(16)).min(1).max(16) }),
  z.strictObject({ type: z.literal("ROUTE_LINE"), points: coordinates }),
  z.strictObject({ type: z.literal("CORRIDOR"), points: coordinates, width: positive.max(100_000) }),
  z.strictObject({
    type: z.literal("ENTRANCE_GATE"),
    start: coordinateSchema,
    end: coordinateSchema,
    direction: z.enum(["EITHER", "LEFT_TO_RIGHT", "RIGHT_TO_LEFT"]),
  }),
  z.strictObject({
    type: z.literal("APPROXIMATE_REGION"),
    center: coordinateSchema,
    radius: positive.max(100_000),
    publicRadius: positive.max(100_000),
  }),
]);
export type LandfallGeometry = z.infer<typeof geometrySchema>;

export const privacyClassSchema = z.enum([
  "FICTIONAL",
  "GENERIC",
  "PUBLIC_REAL_WORLD",
  "APPROXIMATE_REAL_WORLD",
  "PRIVATE_REAL_WORLD",
]);
export const observationSourceSchema = z.enum([
  "BROWSER_GEOLOCATION",
  "NATIVE_LOCATION",
  "PLAYER_CONFIRMATION",
  "CAPTAIN_CONFIRMATION",
  "WATCHGLASS",
  "VISION_WAYPOINT",
  "STORY_PROGRESSION",
  "CREATOR_LOGIC",
  "GAME_INTEGRATION",
]);
const offlinePolicy = z.enum(["ONLINE", "OFFLINE_READY", "OFFLINE_PARTIAL", "OFFLINE_UNAVAILABLE"]);
const evidenceProfile = z.strictObject({
  precisionProfile: z.enum([
    "BROAD_ARRIVAL",
    "OUTDOOR_WAYPOINT",
    "CLOSE_SEARCH",
    "INDOOR_REGION",
    "EXACT_OBJECT",
    "VIRTUAL_CONTEXT",
  ]),
  acceptedSources: z.array(observationSourceSchema).min(1).max(10),
  requiredAccuracyMeters: positive.max(10_000).optional(),
  requiredSamples: z.number().int().min(1).max(20),
  dwellSeconds: nonnegative.max(3600),
  enterHysteresis: nonnegative.max(1000),
  exitHysteresis: nonnegative.max(1000),
  maximumAgeSeconds: positive.max(3600),
  maximumSpeedMetersPerSecond: positive.max(100).optional(),
  minimumCorroboration: z.number().int().min(1).max(4),
  allowManualFallback: z.boolean(),
  allowCaptainOverride: z.boolean(),
});
export type LandfallEvidenceProfile = z.infer<typeof evidenceProfile>;

const worldspaceSchema = z.strictObject({
  id: landfallId,
  name: text,
  kind: z.enum(["PHYSICAL", "VIRTUAL"]),
  version: z.number().int().positive(),
  coordinateReference: coordinateReferenceSchema,
  mapDefinitionIds: z.array(landfallId).min(1).max(16),
  defaultMapDefinitionId: landfallId,
  observationPolicy: z.strictObject({
    allowedSources: z.array(observationSourceSchema).min(1).max(10),
    requiredFallback: z.boolean(),
  }),
  routePolicy: z.strictObject({ allowOffRoute: z.boolean(), maximumRoutePoints: z.number().int().min(2).max(1024) }),
  privacyPolicy: z.strictObject({
    classification: privacyClassSchema,
    retainRawPhysicalSamples: z.literal(false),
    allowPublicGeometry: z.boolean(),
  }),
  offlinePolicy,
  presentationMetadata: z.strictObject({
    description: z.string().max(500).optional(),
    distanceLabel: z.string().max(24).optional(),
  }),
});
export type LandfallWorldspace = z.infer<typeof worldspaceSchema>;

const mapSchema = z.strictObject({
  id: landfallId,
  worldspaceId: landfallId,
  name: text,
  level: text.optional(),
  role: z.enum(["PRIMARY", "FLOOR", "DETAIL", "OVERVIEW", "ILLUSTRATIVE"]),
  referenceId: landfallId,
  renderer: z.enum(["MAPLIBRE_STYLE", "IMAGE_2D", "VECTOR_2D"]),
  source: z.discriminatedUnion("type", [
    z.strictObject({ type: z.literal("BUILTIN_VECTOR"), providerId: landfallId, styleId: landfallId }),
    z.strictObject({ type: z.literal("BUILTIN_RASTER"), providerId: landfallId, styleId: landfallId }),
    z.strictObject({ type: z.literal("ASSET_IMAGE"), assetId: landfallId }),
    z.strictObject({ type: z.literal("ASSET_VECTOR"), assetId: landfallId }),
    z.strictObject({ type: z.literal("AUTHORED_VECTOR") }),
  ]),
  transform: affine.optional(),
  attribution: z.array(z.strictObject({ label: text, url: z.url().regex(/^https:\/\//) })).max(8),
  overlays: z
    .array(
      z.strictObject({
        id: landfallId,
        assetId: landfallId,
        bounds: z
          .strictObject({
            west: finite.min(-180).max(180),
            south: finite.min(-90).max(90),
            east: finite.min(-180).max(180),
            north: finite.min(-90).max(90),
          })
          .refine(
            (value) => value.west < value.east && value.south < value.north,
            "Overlay bounds must have positive area.",
          ),
        opacity: finite.min(0).max(1),
        hiddenUntilRevealed: z.boolean().optional(),
        attributionLabel: text,
        attributionUrl: z.url().regex(/^https:\/\//),
        privacyClassification: privacyClassSchema,
      }),
    )
    .max(8)
    .optional(),
  camera: z.strictObject({
    center: coordinateSchema,
    zoom: finite.min(0).max(24),
    bearing: finite.min(-360).max(360),
    policy: z.enum(["NORTH_UP", "HEADING_UP", "ROUTE_UP", "LOCKED", "USER_CONTROLLED"]),
  }),
  style: z.strictObject({
    preset: z.enum([
      "PARCHMENT_CHART",
      "NIGHT_HARBOR",
      "FIELD_JOURNAL",
      "MUSEUM_BLUEPRINT",
      "SURVEYOR",
      "MINIMAL_LIGHT",
      "MINIMAL_DARK",
      "CUSTOM_CHRONICLE",
    ]),
    foreground: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    background: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  }),
  privacyClassification: privacyClassSchema,
  offlinePolicy,
});
export type LandfallMapDefinition = z.infer<typeof mapSchema>;

const waypointSchema = z.strictObject({
  id: landfallId,
  worldspaceId: landfallId,
  mapId: landfallId,
  regionId: landfallId.optional(),
  landmarkId: landfallId.optional(),
  name: text,
  description: z.string().max(1000).optional(),
  icon: z.enum(["PIN", "FLAG", "STAR", "COMPASS", "DOOR", "CLUE"]).optional(),
  guidance: z
    .strictObject({
      clue: z.string().max(500).optional(),
      nearbyClue: z.string().max(500).optional(),
      wrongDirectionClue: z.string().max(500).optional(),
      showDistance: z.boolean(),
      showBearing: z.boolean(),
    })
    .optional(),
  type: z.enum([
    "ARRIVAL_POINT",
    "SEARCH_REGION",
    "PASS_THROUGH_GATE",
    "DWELL_ZONE",
    "SEQUENCE_WAYPOINT",
    "OPTIONAL_DISCOVERY",
    "HIDDEN_WAYPOINT",
    "MOVING_TEMPORARY_WAYPOINT",
    "INDOOR_REGION",
    "NATURAL_LANDMARK",
  ]),
  geometry: geometrySchema,
  evidenceProfile,
  sequence: z.strictObject({ afterWaypointIds: z.array(landfallId).max(32), optional: z.boolean() }),
  visibility: z.strictObject({ hiddenUntilRevealed: z.boolean(), publicLabel: z.string().max(240).optional() }),
  completion: z.strictObject({
    requiredOutcome: z.enum(["NEARBY", "LIKELY_INSIDE", "CONFIRMED"]),
    mode: z.enum(["OBSERVED", "STORY_ORDER_ONLY"]),
  }),
  fallback: z.strictObject({
    mode: z.enum(["NONE", "PLAYER", "CAPTAIN", "ALTERNATE_WAYPOINT"]),
    alternateWaypointId: landfallId.optional(),
  }),
  privacyClassification: privacyClassSchema,
  safety: z.strictObject({
    daylightOnly: z.boolean(),
    weatherSensitive: z.boolean(),
    accessibilityLimited: z.boolean(),
    captainSupervised: z.boolean(),
  }),
  expiresAt: maximumDate.optional(),
});
export type LandfallWaypoint = z.infer<typeof waypointSchema>;

const routeSchema = z.strictObject({
  id: landfallId,
  worldspaceId: landfallId,
  name: text,
  model: z.enum([
    "ORDERED",
    "FLEXIBLE",
    "BRANCHING",
    "LOOP",
    "GUIDED_CORRIDOR",
    "HIDDEN",
    "APPROXIMATE",
    "CAPTAIN_DIRECTED",
  ]),
  semantics: z.enum(["NAVIGATIONAL", "ILLUSTRATIVE", "STORY_ORDER_ONLY"]),
  waypointIds: z.array(landfallId).min(1).max(256),
  segmentRegionIds: z.array(landfallId).min(1).max(1023).optional(),
  geometry: geometrySchema.optional(),
  travelMode: z.enum(["WALKING", "CYCLING", "VEHICLE", "BOAT", "INDOOR", "MIXED", "UNSPECIFIED"]),
  offRouteTolerance: nonnegative.max(10_000),
  presentation: z
    .strictObject({
      visibility: z.enum(["FULL", "NEXT_SEGMENT", "ROUGH_BEARING", "HIDDEN"]),
      revealOnSelection: z.boolean(),
      deviationResponse: z.enum(["GUIDANCE", "WARNING", "CAPTAIN_REVIEW", "NONE"]),
    })
    .optional(),
  privacyClassification: privacyClassSchema,
});
export type LandfallRoute = z.infer<typeof routeSchema>;

const transitionSchema = z.strictObject({
  id: landfallId,
  fromWorldspaceId: landfallId,
  toWorldspaceId: landfallId,
  trigger: z.strictObject({ type: z.enum(["CHAPTER", "BLOCK", "CAPTAIN", "PROGRESSION"]), id: landfallId }),
  initialLocationId: landfallId.optional(),
  presentation: z.enum(["DIRECT", "STORYTIDE"]),
  destinationOfflinePolicy: z.enum(["REQUIRE_READY", "WARN", "ONLINE_ONLY"]),
});
export type LandfallTransition = z.infer<typeof transitionSchema>;

export const landfallRegionSchema = z.strictObject({
  id: landfallId,
  worldspaceId: landfallId,
  mapId: landfallId,
  name: text,
  kind: z.enum([
    "SITE",
    "BUILDING",
    "FLOOR",
    "WING",
    "ROOM",
    "GALLERY",
    "CORRIDOR",
    "EXHIBIT_ZONE",
    "OUTDOOR_COMPACT",
    "ENTRANCE",
    "EXIT",
    "STAIRS",
  ]),
  parentId: landfallId.optional(),
  level: text.optional(),
  geometry: geometrySchema,
  privacyClassification: privacyClassSchema,
  hiddenUntilRevealed: z.boolean(),
});
export type LandfallRegion = z.infer<typeof landfallRegionSchema>;
export const landfallLandmarkSchema = z.strictObject({
  id: landfallId,
  regionId: landfallId,
  waypointId: landfallId,
  name: text,
  guidance: z.string().min(1).max(1000),
  referenceAssetIds: z.array(landfallId).min(1).max(8),
  negativeReferenceAssetIds: z.array(landfallId).max(8),
  minimumFrames: z.number().int().min(2).max(5),
  fallback: waypointSchema.shape.fallback,
  privacyClassification: privacyClassSchema,
});
export type LandfallLandmark = z.infer<typeof landfallLandmarkSchema>;

export const landfallDefinitionSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    taleId: landfallId,
    worldspaces: z.array(worldspaceSchema).min(1).max(16),
    maps: z.array(mapSchema).min(1).max(64),
    waypoints: z.array(waypointSchema).max(512),
    routes: z.array(routeSchema).max(128),
    transitions: z.array(transitionSchema).max(64),
    context: z
      .strictObject({
        regions: z.array(landfallRegionSchema).max(256),
        landmarks: z.array(landfallLandmarkSchema).max(256),
      })
      .optional(),
  })
  .superRefine((definition, context) => {
    const issue = (path: (string | number)[], message: string) => context.addIssue({ code: "custom", path, message });
    const unique = (items: { id: string }[], field: string) => {
      const seen = new Set<string>();
      items.forEach((item, i) => {
        if (seen.has(item.id)) issue([field, i, "id"], "ID must be unique.");
        seen.add(item.id);
      });
    };
    unique(definition.worldspaces, "worldspaces");
    unique(definition.maps, "maps");
    unique(definition.waypoints, "waypoints");
    unique(definition.routes, "routes");
    unique(definition.transitions, "transitions");
    const allIds = new Set<string>();
    for (const collection of [
      definition.worldspaces,
      definition.maps,
      definition.waypoints,
      definition.routes,
      definition.transitions,
      definition.context?.regions ?? [],
      definition.context?.landmarks ?? [],
    ]) {
      for (const item of collection) {
        if (allIds.has(item.id)) issue([], `ID ${item.id} is reused across Landfall collections.`);
        allIds.add(item.id);
      }
    }
    const worldspaces = new Map(definition.worldspaces.map((worldspace) => [worldspace.id, worldspace]));
    const maps = new Map(definition.maps.map((map) => [map.id, map]));
    const waypoints = new Map(definition.waypoints.map((waypoint) => [waypoint.id, waypoint]));
    const regions = new Map((definition.context?.regions ?? []).map((region) => [region.id, region]));
    const landmarks = new Map((definition.context?.landmarks ?? []).map((landmark) => [landmark.id, landmark]));
    const validateCoordinate = (coordinate: LandfallCoordinate, worldspaceId: string, path: (string | number)[]) => {
      const worldspace = worldspaces.get(worldspaceId);
      const reference = worldspace?.coordinateReference;
      if (
        !reference ||
        coordinate.worldspaceId !== worldspaceId ||
        coordinate.referenceId !== reference.id ||
        coordinate.referenceVersion !== reference.version ||
        coordinate.type !== reference.type
      ) {
        issue(path, "Coordinate must match the Worldspace and reference version.");
        return;
      }
      if (coordinate.type !== "WGS84" && reference.type !== "WGS84") {
        const b = reference.bounds;
        if (coordinate.x < b.minX || coordinate.x > b.maxX || coordinate.y < b.minY || coordinate.y > b.maxY)
          issue(path, "Coordinate is outside Worldspace bounds.");
      }
    };
    const geometryCoordinates = (geometry: LandfallGeometry): LandfallCoordinate[] => {
      switch (geometry.type) {
        case "POINT_RADIUS":
        case "APPROXIMATE_REGION":
          return [geometry.center];
        case "POLYGON":
          return geometry.rings.flat();
        case "MULTIPOLYGON":
          return geometry.polygons.flat(2);
        case "ROUTE_LINE":
        case "CORRIDOR":
          return geometry.points;
        case "ENTRANCE_GATE":
          return [geometry.start, geometry.end];
      }
    };
    definition.worldspaces.forEach((worldspace, i) => {
      if (
        worldspace.kind === "VIRTUAL" &&
        ["WGS84", "CUSTOM_GEOREFERENCED"].includes(worldspace.coordinateReference.type)
      )
        issue(["worldspaces", i], "Virtual Worldspace requires a virtual coordinate reference.");
      if (
        worldspace.kind === "PHYSICAL" &&
        !["WGS84", "CUSTOM_GEOREFERENCED"].includes(worldspace.coordinateReference.type)
      )
        issue(["worldspaces", i], "Physical Worldspace requires a physical coordinate reference.");
      if (
        worldspace.coordinateReference.type === "NORMALIZED_IMAGE_2D" &&
        (worldspace.coordinateReference.bounds.minX !== 0 ||
          worldspace.coordinateReference.bounds.minY !== 0 ||
          worldspace.coordinateReference.bounds.maxX !== 1 ||
          worldspace.coordinateReference.bounds.maxY !== 1)
      )
        issue(["worldspaces", i, "coordinateReference", "bounds"], "Normalized image bounds must be 0..1.");
      if (!worldspace.mapDefinitionIds.includes(worldspace.defaultMapDefinitionId))
        issue(["worldspaces", i, "defaultMapDefinitionId"], "Default map must belong to Worldspace maps.");
      worldspace.mapDefinitionIds.forEach((mapId) => {
        if (maps.get(mapId)?.worldspaceId !== worldspace.id)
          issue(["worldspaces", i, "mapDefinitionIds"], "Map reference must belong to Worldspace.");
      });
      if (new Set(worldspace.mapDefinitionIds).size !== worldspace.mapDefinitionIds.length)
        issue(["worldspaces", i, "mapDefinitionIds"], "Map references must be unique.");
    });
    definition.maps.forEach((map, i) => {
      const worldspace = worldspaces.get(map.worldspaceId);
      if (
        !worldspace ||
        map.referenceId !== worldspace.coordinateReference.id ||
        !worldspace.mapDefinitionIds.includes(map.id)
      )
        issue(["maps", i], "Map must use its declared Worldspace reference.");
      validateCoordinate(map.camera.center, map.worldspaceId, ["maps", i, "camera", "center"]);
      if (map.source.type === "ASSET_IMAGE" && map.renderer !== "IMAGE_2D")
        issue(["maps", i, "renderer"], "Image source requires image renderer.");
      if (map.source.type === "ASSET_VECTOR" && map.renderer !== "VECTOR_2D")
        issue(["maps", i, "renderer"], "Vector asset requires vector renderer.");
      if (map.source.type === "AUTHORED_VECTOR" && (map.renderer !== "VECTOR_2D" || worldspace?.kind !== "VIRTUAL"))
        issue(["maps", i, "renderer"], "Authored vector maps require a virtual vector renderer.");
      if (map.source.type === "BUILTIN_VECTOR" && map.renderer !== "MAPLIBRE_STYLE")
        issue(["maps", i, "renderer"], "Built-in vector source requires MapLibre renderer.");
      if (
        map.source.type === "BUILTIN_RASTER" &&
        (map.renderer !== "MAPLIBRE_STYLE" ||
          worldspace?.kind !== "PHYSICAL" ||
          map.source.providerId !== "osm-standard" ||
          map.source.styleId !== "standard")
      )
        issue(["maps", i, "source"], "Built-in raster source requires the supported physical map provider.");
      if (worldspace?.kind === "VIRTUAL" && map.renderer === "MAPLIBRE_STYLE")
        issue(["maps", i, "renderer"], "Virtual Worldspace needs a virtual map renderer.");
      if (map.overlays?.length && (worldspace?.kind !== "PHYSICAL" || map.renderer !== "MAPLIBRE_STYLE"))
        issue(["maps", i, "overlays"], "Georeferenced image overlays need a physical MapLibre map.");
      if (map.overlays && new Set(map.overlays.map((overlay) => overlay.id)).size !== map.overlays.length)
        issue(["maps", i, "overlays"], "Overlay IDs must be unique.");
      if (
        worldspace?.coordinateReference.type === "NORMALIZED_IMAGE_2D" &&
        map.source.type === "ASSET_IMAGE" &&
        map.source.assetId !== worldspace.coordinateReference.imageAssetId
      )
        issue(["maps", i, "source", "assetId"], "Image map must use the reference image asset.");
    });
    definition.waypoints.forEach((waypoint, i) => {
      const worldspace = worldspaces.get(waypoint.worldspaceId);
      if (!worldspace || maps.get(waypoint.mapId)?.worldspaceId !== waypoint.worldspaceId)
        issue(["waypoints", i], "Waypoint requires a map in its Worldspace.");
      if (
        waypoint.regionId &&
        (regions.get(waypoint.regionId)?.worldspaceId !== waypoint.worldspaceId ||
          regions.get(waypoint.regionId)?.mapId !== waypoint.mapId)
      )
        issue(["waypoints", i, "regionId"], "Waypoint region must use the same Worldspace and map.");
      if (
        waypoint.landmarkId &&
        (landmarks.get(waypoint.landmarkId)?.waypointId !== waypoint.id ||
          landmarks.get(waypoint.landmarkId)?.regionId !== waypoint.regionId)
      )
        issue(["waypoints", i, "landmarkId"], "Waypoint landmark must bind this waypoint and region.");
      geometryCoordinates(waypoint.geometry).forEach((coordinate, j) =>
        validateCoordinate(coordinate, waypoint.worldspaceId, ["waypoints", i, "geometry", j]),
      );
      if (
        waypoint.evidenceProfile.acceptedSources.some(
          (source) => !worldspace?.observationPolicy.allowedSources.includes(source),
        )
      )
        issue(
          ["waypoints", i, "evidenceProfile", "acceptedSources"],
          "Waypoint source must be permitted by Worldspace.",
        );
      if (worldspace?.kind === "PHYSICAL" && waypoint.evidenceProfile.precisionProfile === "VIRTUAL_CONTEXT")
        issue(["waypoints", i, "evidenceProfile"], "Physical waypoint cannot use virtual context profile.");
      if (worldspace?.kind === "VIRTUAL" && waypoint.evidenceProfile.requiredAccuracyMeters !== undefined)
        issue(["waypoints", i, "evidenceProfile"], "Virtual waypoint cannot require GPS accuracy.");
      if (
        waypoint.evidenceProfile.precisionProfile === "EXACT_OBJECT" &&
        waypoint.evidenceProfile.acceptedSources.every(
          (source) => source === "BROWSER_GEOLOCATION" || source === "NATIVE_LOCATION",
        )
      )
        issue(["waypoints", i, "evidenceProfile"], "Exact object cannot rely on GPS alone.");
      if (waypoint.type === "PASS_THROUGH_GATE" && waypoint.geometry.type !== "ENTRANCE_GATE")
        issue(["waypoints", i, "geometry"], "Pass-through waypoint requires entrance gate geometry.");
      if (waypoint.type === "MOVING_TEMPORARY_WAYPOINT" && !waypoint.expiresAt)
        issue(["waypoints", i, "expiresAt"], "Moving temporary waypoint requires expiry.");
      if (
        worldspace?.observationPolicy.requiredFallback &&
        !waypoint.sequence.optional &&
        waypoint.fallback.mode === "NONE"
      )
        issue(["waypoints", i, "fallback"], "Required waypoint needs a fallback.");
      if (waypoint.fallback.mode === "PLAYER" && !waypoint.evidenceProfile.allowManualFallback)
        issue(["waypoints", i, "fallback"], "Player fallback must be allowed by evidence profile.");
      if (waypoint.fallback.mode === "CAPTAIN" && !waypoint.evidenceProfile.allowCaptainOverride)
        issue(["waypoints", i, "fallback"], "Captain fallback must be allowed by evidence profile.");
      waypoint.sequence.afterWaypointIds.forEach((id) => {
        if (waypoints.get(id)?.worldspaceId !== waypoint.worldspaceId || id === waypoint.id)
          issue(["waypoints", i, "sequence"], "Prerequisite must be another waypoint in the Worldspace.");
      });
      if (
        waypoint.fallback.mode === "ALTERNATE_WAYPOINT" &&
        waypoints.get(waypoint.fallback.alternateWaypointId ?? "")?.worldspaceId !== waypoint.worldspaceId
      )
        issue(["waypoints", i, "fallback"], "Alternate waypoint must be in the Worldspace.");
    });
    const visiting = new Set<string>(),
      visited = new Set<string>();
    const visit = (id: string): void => {
      if (visiting.has(id)) {
        issue(["waypoints"], "Waypoint prerequisites contain a cycle.");
        return;
      }
      if (visited.has(id)) return;
      visiting.add(id);
      for (const prerequisite of waypoints.get(id)?.sequence.afterWaypointIds ?? [])
        if (waypoints.has(prerequisite)) visit(prerequisite);
      visiting.delete(id);
      visited.add(id);
    };
    for (const id of waypoints.keys()) visit(id);
    const privacyRank = {
      FICTIONAL: 0,
      GENERIC: 0,
      PUBLIC_REAL_WORLD: 1,
      APPROXIMATE_REAL_WORLD: 2,
      PRIVATE_REAL_WORLD: 3,
    };
    definition.context?.regions.forEach((region, i) => {
      const path = ["context", "regions", i];
      const map = maps.get(region.mapId),
        worldspace = worldspaces.get(region.worldspaceId);
      if (!worldspace || map?.worldspaceId !== region.worldspaceId)
        issue(path, "Region requires a map in its Worldspace.");
      if (region.level && map?.level && region.level !== map.level) issue(path, "Region level must match its map.");
      if (region.kind === "FLOOR" && !region.level) issue(path, "Floor region requires a level.");
      const parent = region.parentId ? regions.get(region.parentId) : undefined;
      if (region.parentId && (!parent || parent.worldspaceId !== region.worldspaceId))
        issue(path, "Parent region must belong to the same Worldspace.");
      if (parent?.level && region.level && region.kind !== "STAIRS" && parent.level !== region.level)
        issue(path, "Child region must match its parent level.");
      if (map && privacyRank[region.privacyClassification] < privacyRank[map.privacyClassification])
        issue(path, "Region cannot expose more precise privacy than its map.");
      if (parent && privacyRank[region.privacyClassification] < privacyRank[parent.privacyClassification])
        issue(path, "Child region cannot relax parent privacy.");
      const ancestry = new Set([region.id]);
      let current = parent;
      while (current) {
        if (ancestry.has(current.id)) {
          issue(path, "Region hierarchy contains a cycle.");
          break;
        }
        ancestry.add(current.id);
        current = current.parentId ? regions.get(current.parentId) : undefined;
      }
      geometryCoordinates(region.geometry).forEach((coordinate, j) =>
        validateCoordinate(coordinate, region.worldspaceId, [...path, "geometry", j]),
      );
    });
    definition.context?.landmarks.forEach((landmark, i) => {
      const path = ["context", "landmarks", i],
        region = regions.get(landmark.regionId),
        waypoint = waypoints.get(landmark.waypointId);
      if (!region || !waypoint || waypoint.worldspaceId !== region.worldspaceId || waypoint.mapId !== region.mapId)
        issue(path, "Landmark must bind a waypoint in its region Worldspace and map.");
      if (waypoint?.regionId && waypoint.regionId !== landmark.regionId)
        issue(path, "Landmark region must match waypoint region.");
      if (
        waypoint &&
        (landmark.fallback.mode !== waypoint.fallback.mode ||
          landmark.fallback.alternateWaypointId !== waypoint.fallback.alternateWaypointId)
      )
        issue([...path, "fallback"], "Landmark fallback must match its waypoint canonical fallback.");
      if (waypoint && !waypoint.evidenceProfile.acceptedSources.includes("VISION_WAYPOINT"))
        issue(path, "Landmark waypoint must accept VISION_WAYPOINT evidence.");
      if (region && !worldspaces.get(region.worldspaceId)?.observationPolicy.allowedSources.includes("VISION_WAYPOINT"))
        issue(path, "Landmark Worldspace must allow VISION_WAYPOINT evidence.");
      if (region && privacyRank[landmark.privacyClassification] < privacyRank[region.privacyClassification])
        issue(path, "Landmark cannot relax region privacy.");
      const assets = [...landmark.referenceAssetIds, ...landmark.negativeReferenceAssetIds];
      if (new Set(assets).size !== assets.length)
        issue(path, "Reference and negative assets must be distinct and unique.");
      if (waypoint && !waypoint.sequence.optional && landmark.fallback.mode === "NONE")
        issue(path, "Mandatory landmark requires a readable fallback.");
      if (landmark.fallback.mode === "PLAYER" && !waypoint?.evidenceProfile.allowManualFallback)
        issue(path, "Player landmark fallback must be allowed.");
      if (landmark.fallback.mode === "CAPTAIN" && !waypoint?.evidenceProfile.allowCaptainOverride)
        issue(path, "Captain landmark fallback must be allowed.");
      if (
        landmark.fallback.mode === "ALTERNATE_WAYPOINT" &&
        (!region ||
          waypoints.get(landmark.fallback.alternateWaypointId ?? "")?.worldspaceId !== region.worldspaceId ||
          landmark.fallback.alternateWaypointId === landmark.waypointId)
      )
        issue(path, "Landmark alternate fallback must be another waypoint in the Worldspace.");
    });
    definition.routes.forEach((route, i) => {
      const worldspace = worldspaces.get(route.worldspaceId);
      if (!worldspace) issue(["routes", i, "worldspaceId"], "Route Worldspace does not exist.");
      if (route.segmentRegionIds) {
        if (
          !route.geometry ||
          !["ROUTE_LINE", "CORRIDOR"].includes(route.geometry.type) ||
          !("points" in route.geometry) ||
          route.segmentRegionIds.length !== route.geometry.points.length - 1
        )
          issue(["routes", i, "segmentRegionIds"], "Segment regions require one region per route line segment.");
        if (route.segmentRegionIds.some((id) => regions.get(id)?.worldspaceId !== route.worldspaceId))
          issue(["routes", i, "segmentRegionIds"], "Segment regions must belong to route Worldspace.");
      }
      if (
        route.geometry &&
        (route.geometry.type === "ROUTE_LINE" || route.geometry.type === "CORRIDOR") &&
        worldspace &&
        route.geometry.points.length > worldspace.routePolicy.maximumRoutePoints
      )
        issue(["routes", i, "geometry"], "Route exceeds Worldspace point limit.");
      if (route.semantics === "NAVIGATIONAL" && !route.geometry)
        issue(["routes", i, "geometry"], "Navigational route requires geometry.");
      route.waypointIds.forEach((id) => {
        if (waypoints.get(id)?.worldspaceId !== route.worldspaceId)
          issue(["routes", i, "waypointIds"], "Route waypoint must belong to route Worldspace.");
      });
      if (route.geometry)
        geometryCoordinates(route.geometry).forEach((coordinate, j) =>
          validateCoordinate(coordinate, route.worldspaceId, ["routes", i, "geometry", j]),
        );
    });
    definition.transitions.forEach((transition, i) => {
      if (
        !worldspaces.has(transition.fromWorldspaceId) ||
        !worldspaces.has(transition.toWorldspaceId) ||
        transition.fromWorldspaceId === transition.toWorldspaceId
      )
        issue(["transitions", i], "Transition must connect distinct known Worldspaces.");
      if (
        transition.initialLocationId &&
        waypoints.get(transition.initialLocationId)?.worldspaceId !== transition.toWorldspaceId
      )
        issue(["transitions", i, "initialLocationId"], "Initial location must belong to destination Worldspace.");
    });
  });
export type LandfallDefinition = z.infer<typeof landfallDefinitionSchema>;

export function parseLandfallDefinition(value: unknown): LandfallDefinition {
  return landfallDefinitionSchema.parse(value);
}
export function serializeLandfallDefinition(value: LandfallDefinition): string {
  return JSON.stringify(parseLandfallDefinition(value));
}
