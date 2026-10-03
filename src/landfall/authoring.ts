import { approximateContextKinds, projectContextRegion } from "@/landfall/context-projection";
import { landfallSourceCapabilities } from "@/landfall/source-capabilities";
import { validateLandfallDefinition } from "@/landfall/definition";
import { landfallProviderFindings } from "@/landfall/provider-authoring";
import type {
  LandfallCoordinate,
  LandfallDefinition,
  LandfallMapDefinition,
  LandfallWaypoint,
  LandfallWorldspace,
} from "@/landfall/schema";

export type LandfallAuthoringFinding = Readonly<{
  code: string;
  severity: "warning" | "blocker";
  message: string;
  targetId?: string;
}>;

const safety = {
  daylightOnly: false,
  weatherSensitive: false,
  accessibilityLimited: false,
  captainSupervised: false,
};

const palette = {
  PARCHMENT_CHART: { foreground: "#4e3422", background: "#f1dfb7" },
  NIGHT_HARBOR: { foreground: "#e9c78a", background: "#102535" },
  FIELD_JOURNAL: { foreground: "#243648", background: "#f5f1e6" },
  MUSEUM_BLUEPRINT: { foreground: "#e1e9e8", background: "#254459" },
  SURVEYOR: { foreground: "#183c42", background: "#e4ece7" },
  MINIMAL_LIGHT: { foreground: "#263649", background: "#f7f8f8" },
  MINIMAL_DARK: { foreground: "#e8eaed", background: "#1b2635" },
  CUSTOM_CHRONICLE: { foreground: "#4e3422", background: "#f1dfb7" },
} as const;

export function applyLandfallPreset(map: LandfallMapDefinition, preset: keyof typeof palette): LandfallMapDefinition {
  return { ...map, style: { preset, ...palette[preset] } };
}

export function coordinateAt(worldspace: LandfallWorldspace, x: number, y: number): LandfallCoordinate {
  const reference = worldspace.coordinateReference;
  const base = {
    worldspaceId: worldspace.id,
    referenceId: reference.id,
    referenceVersion: reference.version,
  };
  if (reference.type === "WGS84") return { ...base, type: "WGS84", longitude: x, latitude: y };
  return { ...base, type: reference.type, x, y } as LandfallCoordinate;
}

export function createLandfallWorldspace(input: {
  taleId: string;
  name: string;
  kind: "PHYSICAL" | "VIRTUAL";
  latitude?: number;
  longitude?: number;
  imageAssetId?: string;
  imageWidth?: number;
  imageHeight?: number;
}): LandfallDefinition {
  const worldspaceId = crypto.randomUUID();
  const mapId = crypto.randomUUID();
  const referenceId = crypto.randomUUID();
  const physical = input.kind === "PHYSICAL";
  const image = !physical && Boolean(input.imageAssetId);
  const reference: LandfallWorldspace["coordinateReference"] = physical
    ? { type: "WGS84", id: referenceId, version: 1, altitude: "IGNORED" }
    : image
      ? {
          type: "NORMALIZED_IMAGE_2D",
          id: referenceId,
          version: 1,
          bounds: { minX: 0, minY: 0, maxX: 1, maxY: 1 },
          axis: "X_RIGHT_Y_DOWN",
          imageAssetId: input.imageAssetId!,
          width: input.imageWidth ?? 1000,
          height: input.imageHeight ?? 1000,
        }
      : {
          type: "LOCAL_CARTESIAN_2D",
          id: referenceId,
          version: 1,
          bounds: { minX: 0, minY: 0, maxX: 1000, maxY: 1000 },
          axis: "X_RIGHT_Y_DOWN",
          unit: "map unit",
          origin: { x: 0, y: 0 },
        };
  const worldspace: LandfallWorldspace = {
    id: worldspaceId,
    name: input.name,
    kind: input.kind,
    version: 1,
    coordinateReference: reference,
    mapDefinitionIds: [mapId],
    defaultMapDefinitionId: mapId,
    observationPolicy: {
      allowedSources: physical
        ? ["BROWSER_GEOLOCATION", "NATIVE_LOCATION", "PLAYER_CONFIRMATION", "CAPTAIN_CONFIRMATION"]
        : ["PLAYER_CONFIRMATION", "CAPTAIN_CONFIRMATION", "STORY_PROGRESSION"],
      requiredFallback: true,
    },
    routePolicy: { allowOffRoute: true, maximumRoutePoints: 1024 },
    privacyPolicy: {
      classification: physical ? "APPROXIMATE_REAL_WORLD" : "FICTIONAL",
      retainRawPhysicalSamples: false,
      allowPublicGeometry: !physical,
    },
    offlinePolicy: physical ? "OFFLINE_PARTIAL" : "OFFLINE_READY",
    presentationMetadata: { distanceLabel: physical ? "meters" : "map units" },
  };
  const cameraCenter = coordinateAt(
    worldspace,
    physical ? (input.longitude ?? 0) : image ? 0.5 : 500,
    physical ? (input.latitude ?? 0) : image ? 0.5 : 500,
  );
  const map: LandfallMapDefinition = {
    id: mapId,
    worldspaceId,
    name: `${input.name} chart`,
    role: "PRIMARY",
    referenceId,
    renderer: physical ? "MAPLIBRE_STYLE" : image ? "IMAGE_2D" : "VECTOR_2D",
    source: physical
      ? { type: "BUILTIN_RASTER", providerId: "osm-standard", styleId: "standard" }
      : image
        ? { type: "ASSET_IMAGE", assetId: input.imageAssetId! }
        : { type: "AUTHORED_VECTOR" },
    attribution: physical
      ? [{ label: "© OpenStreetMap contributors", url: "https://www.openstreetmap.org/copyright" }]
      : [],
    camera: { center: cameraCenter, zoom: physical ? 12 : 1, bearing: 0, policy: "USER_CONTROLLED" },
    style: {
      preset: physical ? "FIELD_JOURNAL" : "PARCHMENT_CHART",
      ...palette[physical ? "FIELD_JOURNAL" : "PARCHMENT_CHART"],
    },
    privacyClassification: worldspace.privacyPolicy.classification,
    offlinePolicy: worldspace.offlinePolicy,
  };
  return validateLandfallDefinition({
    schemaVersion: 1,
    taleId: input.taleId,
    worldspaces: [worldspace],
    maps: [map],
    waypoints: [],
    routes: [],
    transitions: [],
  });
}

export function addLandfallWorldspace(
  definition: LandfallDefinition | null,
  input: Parameters<typeof createLandfallWorldspace>[0],
): LandfallDefinition {
  const next = createLandfallWorldspace(input);
  if (!definition) return next;
  if (definition.taleId !== input.taleId) throw new Error("The Worldspace belongs to another Chronicle.");
  return validateLandfallDefinition({
    ...definition,
    worldspaces: [...definition.worldspaces, ...next.worldspaces],
    maps: [...definition.maps, ...next.maps],
  });
}

export function createLandfallWaypoint(
  worldspace: LandfallWorldspace,
  map: LandfallMapDefinition,
  center: LandfallCoordinate,
  name: string,
): LandfallWaypoint {
  const physical = worldspace.kind === "PHYSICAL";
  return {
    id: crypto.randomUUID(),
    worldspaceId: worldspace.id,
    mapId: map.id,
    name,
    type: "ARRIVAL_POINT",
    geometry: { type: "POINT_RADIUS", center, radius: physical ? 100 : 30 },
    evidenceProfile: {
      precisionProfile: physical ? "BROAD_ARRIVAL" : "VIRTUAL_CONTEXT",
      acceptedSources: physical
        ? ["BROWSER_GEOLOCATION", "NATIVE_LOCATION", "PLAYER_CONFIRMATION"]
        : ["PLAYER_CONFIRMATION"],
      ...(physical ? { requiredAccuracyMeters: 50, maximumSpeedMetersPerSecond: 45 } : {}),
      requiredSamples: physical ? 2 : 1,
      dwellSeconds: 0,
      enterHysteresis: 0,
      exitHysteresis: physical ? 10 : 0,
      maximumAgeSeconds: physical ? 30 : 600,
      minimumCorroboration: 1,
      allowManualFallback: true,
      allowCaptainOverride: true,
    },
    sequence: { afterWaypointIds: [], optional: false },
    visibility: { hiddenUntilRevealed: false, publicLabel: name },
    completion: { requiredOutcome: "CONFIRMED", mode: "OBSERVED" },
    fallback: { mode: "PLAYER" },
    privacyClassification: worldspace.privacyPolicy.classification,
    safety,
  };
}

export function landfallAuthoringFindings(
  definition: LandfallDefinition,
  taleVisibility: string,
  assets?: ReadonlyArray<{ id: string; mimeType: string; variants: ReadonlyArray<{ processingState: string }> }>,
): LandfallAuthoringFinding[] {
  const findings: LandfallAuthoringFinding[] = landfallProviderFindings(definition);
  for (const waypoint of definition.waypoints) {
    const capability = landfallSourceCapabilities(definition, waypoint);
    if ((waypoint.evidenceProfile.fusionPolicy?.minimumIndependentSources ?? 1) > capability.count)
      findings.push({
        code: "LANDFALL_FUSION_PROVIDER_UNAVAILABLE",
        severity: capability.fallback ? "warning" : "blocker",
        targetId: waypoint.id,
        message: `${waypoint.name}: this evidence policy exceeds the currently available independent checks. ${capability.description} ${capability.fallback ? "Use the configured alternate path until the required providers exist." : "Configure a valid fallback or reduce the policy before publishing."}`,
      });
    const worldspace = definition.worldspaces.find((item) => item.id === waypoint.worldspaceId)!;
    if (
      worldspace.kind === "PHYSICAL" &&
      waypoint.evidenceProfile.precisionProfile === "EXACT_OBJECT" &&
      waypoint.evidenceProfile.acceptedSources.every((source) =>
        ["BROWSER_GEOLOCATION", "NATIVE_LOCATION"].includes(source),
      )
    )
      findings.push({
        code: "LANDFALL_EXACT_TARGET_INDEPENDENT_EVIDENCE",
        severity: "blocker",
        targetId: waypoint.id,
        message: `${waypoint.name}: GPS alone cannot identify an exact object. Configure independent target evidence and a readable fallback.`,
      });
    if (worldspace.kind === "PHYSICAL" && waypoint.geometry.type === "POINT_RADIUS") {
      const accuracy = waypoint.evidenceProfile.requiredAccuracyMeters;
      if (accuracy && waypoint.geometry.radius < accuracy * 2)
        findings.push({
          code: "LANDFALL_RADIUS_BELOW_ACCURACY",
          severity: "warning",
          message: `${waypoint.name}: the arrival radius is smaller than twice the requested accuracy. A field test may fail even nearby.`,
          targetId: waypoint.id,
        });
    }
    if (!waypoint.sequence.optional && waypoint.fallback.mode === "NONE")
      findings.push({
        code: "LANDFALL_REQUIRED_FALLBACK",
        severity: "blocker",
        message: `${waypoint.name}: a required location needs a Player, Captain, or alternate path if location is unavailable.`,
        targetId: waypoint.id,
      });
    if (taleVisibility === "PUBLIC" && waypoint.privacyClassification === "PRIVATE_REAL_WORLD")
      findings.push({
        code: "LANDFALL_PUBLIC_PRIVATE_GEOMETRY",
        severity: "warning",
        message: `${waypoint.name}: private real-world geometry must be excluded from any public or Community projection.`,
        targetId: waypoint.id,
      });
  }
  for (const region of definition.context?.regions ?? []) {
    const worldspace = definition.worldspaces.find((item) => item.id === region.worldspaceId)!;
    if (
      worldspace.kind === "PHYSICAL" &&
      ["APPROXIMATE_REAL_WORLD", "GENERIC"].includes(region.privacyClassification) &&
      (!approximateContextKinds.has(region.kind) || !projectContextRegion(region, worldspace, "PLAYER"))
    )
      findings.push({
        code: "LANDFALL_CONTEXT_PRIVACY_PRECISION",
        severity: "blocker",
        targetId: region.id,
        message: `${region.name}: generalized privacy cannot safely evaluate this fine region. Use a private Chronicle layout or an intentionally public exact location.`,
      });
    const map = definition.maps.find((item) => item.id === region.mapId);
    if (["FLOOR", "ROOM", "GALLERY", "EXHIBIT_ZONE"].includes(region.kind) && !region.level && !map?.level)
      findings.push({
        code: "LANDFALL_CONTEXT_LEVEL_UNSUPPORTED",
        severity: "warning",
        targetId: region.id,
        message: `${region.name}: label its floor or level. Browser GPS cannot distinguish rooms or floors; these areas remain inferred until independently verified.`,
      });
    if (taleVisibility === "PUBLIC" && region.privacyClassification === "PRIVATE_REAL_WORLD")
      findings.push({
        code: "LANDFALL_PUBLIC_PRIVATE_CONTEXT",
        severity: "blocker",
        targetId: region.id,
        message: `${region.name}: a private real-world layout cannot be offered as public geometry. Restrict the Chronicle or remove the private layout.`,
      });
    if (region.kind === "CORRIDOR" && region.geometry.type !== "CORRIDOR")
      findings.push({
        code: "LANDFALL_CONTEXT_CORRIDOR_GEOMETRY",
        severity: "warning",
        targetId: region.id,
        message: `${region.name}: draw a corridor centerline with a usable width to support continuity-aware guidance.`,
      });
  }
  for (const landmark of definition.context?.landmarks ?? []) {
    const waypoint = definition.waypoints.find((item) => item.id === landmark.waypointId);
    if (waypoint && !waypoint.sequence.optional && landmark.fallback.mode === "NONE")
      findings.push({
        code: "LANDFALL_LANDMARK_REQUIRED_FALLBACK",
        severity: "blocker",
        targetId: landmark.id,
        message: `${landmark.name}: a mandatory landmark needs a readable Player, Captain, or alternate waypoint fallback.`,
      });
    if (!landmark.referenceAssetIds.length)
      findings.push({
        code: "LANDFALL_LANDMARK_REFERENCES_MISSING",
        severity: "blocker",
        targetId: landmark.id,
        message: `${landmark.name}: choose at least one processed Chronicle image as a positive reference.`,
      });
    if (
      assets &&
      [...landmark.referenceAssetIds, ...landmark.negativeReferenceAssetIds].some((assetId) => {
        const asset = assets.find((item) => item.id === assetId);
        return (
          !asset ||
          !asset.mimeType.startsWith("image/") ||
          !asset.variants.some((variant) => variant.processingState === "READY")
        );
      })
    )
      findings.push({
        code: "LANDFALL_LANDMARK_REFERENCE_UNAVAILABLE",
        severity: "blocker",
        targetId: landmark.id,
        message: `${landmark.name}: every reference must be a processed image in this Chronicle's protected asset library.`,
      });
  }
  for (const map of definition.maps) {
    if (map.source.type === "BUILTIN_VECTOR" && map.attribution.length === 0)
      findings.push({
        code: "LANDFALL_MAP_PROVIDER_UNAVAILABLE",
        severity: "warning",
        message: `${map.name}: no production map data provider or attribution is configured. Coordinate and waypoint authoring remain available.`,
        targetId: map.id,
      });
    if (map.source.type === "BUILTIN_RASTER" && map.attribution.length === 0)
      findings.push({
        code: "LANDFALL_MAP_ATTRIBUTION_MISSING",
        severity: "warning",
        message: `${map.name}: restore visible OpenStreetMap attribution for the live tile map.`,
        targetId: map.id,
      });
  }
  return findings;
}
