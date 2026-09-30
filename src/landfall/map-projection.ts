import { toWgs84 } from "@/landfall/geometry";
import type {
  LandfallCoordinate,
  LandfallDefinition,
  LandfallGeometry,
  LandfallMapDefinition,
  LandfallWorldspace,
} from "@/landfall/schema";
import type { LandfallConfidence } from "@/landfall/runtime";

export type LandfallMapFeature = Readonly<{
  id: string;
  label: string;
  kind: "POINT" | "POLYGON" | "LINE" | "GATE";
  coordinates: readonly (readonly [number, number])[];
  polygons?: readonly (readonly (readonly [number, number])[])[][];
  hiddenCenter?: boolean;
}>;
export type LandfallMapScene = Readonly<{
  mapId: string;
  worldspaceId: string;
  worldspaceKind: LandfallWorldspace["kind"];
  renderer: LandfallMapDefinition["renderer"];
  background: string;
  foreground: string;
  camera: Readonly<{ center: readonly [number, number]; zoom: number; bearing: number }>;
  attribution: readonly { label: string; url: string }[];
  imageAssetId?: string;
  imageUrl?: string;
  bounds?: Readonly<{ minX: number; minY: number; maxX: number; maxY: number }>;
  features: readonly LandfallMapFeature[];
  /** Ephemeral Player-only presentation state; never part of the pinned definition. */
  currentPosition?: LandfallCurrentPosition | null;
}>;

function pair(coordinate: LandfallCoordinate, worldspace: LandfallWorldspace): readonly [number, number] {
  if (worldspace.kind === "PHYSICAL") {
    const value = toWgs84(coordinate, worldspace);
    return [value.longitude, value.latitude];
  }
  if (coordinate.type === "WGS84" || coordinate.worldspaceId !== worldspace.id)
    throw new Error("LANDFALL_MAP_REFERENCE_MISMATCH");
  return [coordinate.x, coordinate.y];
}

function feature(id: string, label: string, geometry: LandfallGeometry, worldspace: LandfallWorldspace): LandfallMapFeature {
  switch (geometry.type) {
    case "POINT_RADIUS":
      return { id, label, kind: "POINT", coordinates: [pair(geometry.center, worldspace)] };
    case "APPROXIMATE_REGION":
      return { id, label, kind: "POINT", coordinates: [], hiddenCenter: true };
    case "POLYGON":
      return {
        id,
        label,
        kind: "POLYGON",
        coordinates: geometry.rings[0].map((item) => pair(item, worldspace)),
        polygons: [geometry.rings.map((ring) => ring.map((item) => pair(item, worldspace)))],
      };
    case "MULTIPOLYGON":
      return {
        id,
        label,
        kind: "POLYGON",
        coordinates: geometry.polygons[0][0].map((item) => pair(item, worldspace)),
        polygons: geometry.polygons.map((polygon) => polygon.map((ring) => ring.map((item) => pair(item, worldspace)))),
      };
    case "ROUTE_LINE":
    case "CORRIDOR":
      return { id, label, kind: "LINE", coordinates: geometry.points.map((item) => pair(item, worldspace)) };
    case "ENTRANCE_GATE":
      return { id, label, kind: "GATE", coordinates: [pair(geometry.start, worldspace), pair(geometry.end, worldspace)] };
  }
}

/** Receives a role-filtered Chart projection. Hidden/private IDs absent there cannot become map features. */
export function projectLandfallMap(
  definition: LandfallDefinition,
  chart: {
    audience?: "PLAYER" | "CAPTAIN" | "CREATOR_TEST" | "REPLAY" | "PUBLIC";
    activeWorldspaceId: string;
    availableLocations: readonly { id: string }[];
    activeRouteId: string | null;
  },
  mapId?: string,
): LandfallMapScene {
  if (chart.audience === "PUBLIC") throw new Error("LANDFALL_PUBLIC_MAP_NOT_AVAILABLE_PHASE_1");
  const worldspace = definition.worldspaces.find((item) => item.id === chart.activeWorldspaceId);
  if (!worldspace) throw new Error("LANDFALL_WORLDSPACE_UNAVAILABLE");
  const map = definition.maps.find(
    (item) => item.id === (mapId ?? worldspace.defaultMapDefinitionId) && item.worldspaceId === worldspace.id,
  );
  if (!map) throw new Error("LANDFALL_MAP_UNAVAILABLE");
  const visibleIds = new Set(chart.availableLocations.map((item) => item.id));
  const features = definition.waypoints
    .filter((item) => item.worldspaceId === worldspace.id && visibleIds.has(item.id))
    .map((item) => feature(item.id, item.visibility.publicLabel ?? item.name, item.geometry, worldspace));
  const route = definition.routes.find(
    (item) => item.id === chart.activeRouteId && item.worldspaceId === worldspace.id,
  );
  if (route?.geometry) features.push(feature(route.id, route.name, route.geometry, worldspace));
  return {
    mapId: map.id,
    worldspaceId: worldspace.id,
    worldspaceKind: worldspace.kind,
    renderer: map.renderer,
    background: map.style.background,
    foreground: map.style.foreground,
    camera: { center: pair(map.camera.center, worldspace), zoom: map.camera.zoom, bearing: map.camera.bearing },
    attribution: map.attribution,
    ...(worldspace.coordinateReference.type !== "WGS84" ? { bounds: worldspace.coordinateReference.bounds } : {}),
    ...(map.source.type === "ASSET_IMAGE" ? { imageAssetId: map.source.assetId } : {}),
    features,
  };
}

export type LandfallCurrentPosition = Readonly<{
  coordinates: readonly [number, number];
  accuracyMeters: number;
  confidence: LandfallConfidence;
  observedAt: number;
}>;

export function mapLibreFeatures(scene: LandfallMapScene, position = scene.currentPosition): GeoJSON.FeatureCollection {
  if (scene.worldspaceKind !== "PHYSICAL") throw new Error("LANDFALL_MAPLIBRE_REQUIRES_PHYSICAL_WORLDSPACE");
  return {
    type: "FeatureCollection" as const,
    features: [
      ...scene.features
      .filter((feature) => !feature.hiddenCenter)
      .map(
        (feature): GeoJSON.Feature => ({
          type: "Feature" as const,
          properties: { id: feature.id, kind: feature.kind },
          geometry:
            feature.kind === "POINT"
              ? { type: "Point" as const, coordinates: [...feature.coordinates[0]] }
              : feature.kind === "POLYGON" && feature.polygons && feature.polygons.length > 1
                ? {
                    type: "MultiPolygon" as const,
                    coordinates: feature.polygons.map((polygon) =>
                      polygon.map((ring) => ring.map((position) => [...position])),
                    ),
                  }
                : feature.kind === "POLYGON"
                  ? {
                      type: "Polygon" as const,
                      coordinates: (feature.polygons?.[0] ?? [feature.coordinates]).map((ring) =>
                        ring.map((position) => [...position]),
                      ),
                    }
                  : { type: "LineString" as const, coordinates: feature.coordinates.map((position) => [...position]) },
        }),
      ),
      ...(position ? [{
        type: "Feature" as const,
        properties: { id: "current-position", kind: "CURRENT_POSITION", accuracyMeters: position.accuracyMeters, confidence: position.confidence },
        geometry: { type: "Point" as const, coordinates: [...position.coordinates] },
      }] : []),
    ],
  };
}
