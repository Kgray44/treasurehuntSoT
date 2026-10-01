import { projectLandfallMap, type LandfallMapScene } from "@/landfall/map-projection";
import type { PinnedLandfallDefinition } from "@/landfall/published";
import type { LandfallDefinition } from "@/landfall/schema";
import {
  projectLandfallJourney,
  type LandfallJourneyEvent,
  type LandfallContextSummary,
} from "@/landfall/journey-projection";

function presentationPayload(event: LandfallJourneyEvent): Record<string, unknown> {
  try {
    const value = typeof event.payload === "string" ? JSON.parse(event.payload) : event.payload;
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export type PlayerLandfallBootstrap = Readonly<{
  sessionId: string;
  publishedVersionId: string;
  currentSequence: number;
  worldspaceName: string;
  activeWaypointId: string | null;
  contextualArrivalWaypointId?: string;
  visitedIds: readonly string[];
  discoveredIds: readonly string[];
  journeyPath: readonly (ReturnType<typeof projectLandfallJourney>["journeyPath"][number] & { label: string })[];
  paused: boolean;
  replayOnly: boolean;
  offlineMap: "READY" | "PARTIAL" | "UNAVAILABLE";
  presentations: readonly Readonly<{
    eventId: string;
    sequence: number;
    createdAt: string;
    sceneName: "landfall-arrival" | "landfall-route" | "landfall-reveal";
    label: string;
  }>[];
  scene: LandfallMapScene;
  contextualSummary?: LandfallContextSummary | null;
  availableMaps?: readonly Readonly<{
    id: string;
    name: string;
    level?: string;
    scene: LandfallMapScene;
    offlineMap: "READY" | "PARTIAL" | "UNAVAILABLE";
  }>[];
  runtimeDefinition: Pick<LandfallDefinition, "worldspaces" | "waypoints" | "routes" | "transitions" | "context">;
}>;

/** The Player gets only the current published, released evaluation surface. */
export function projectPlayerLandfallBootstrap(
  pinned: PinnedLandfallDefinition,
  context: {
    chapterId: string | null;
    blockId: string | null;
    releasedAssets: readonly { id: string; url: string }[];
    events?: readonly LandfallJourneyEvent[];
    replayOnly?: boolean;
    observationWaypointId?: string | null;
  },
): PlayerLandfallBootstrap {
  const definition = pinned.definition;
  const journey = projectLandfallJourney(definition, context.events ?? [], context);
  const worldspace = definition.worldspaces.find((item) => item.id === journey.activeWorldspaceId)!;
  const objective = definition.waypoints.find((item) => item.id === journey.activeWaypointId);
  const map = definition.maps.find((item) => item.id === (objective?.mapId ?? worldspace.defaultMapDefinitionId));
  if (!map) throw new Error("LANDFALL_MAP_UNAVAILABLE");

  const waypoints = journey.availableWaypoints.filter((item) => item.mapId === map.id);
  const releasedWaypointIds = new Set(journey.availableWaypoints.map((item) => item.id));
  const regions = (definition.context?.regions ?? []).filter(
    (region) =>
      region.worldspaceId === worldspace.id &&
      region.privacyClassification !== "APPROXIMATE_REAL_WORLD" &&
      (!region.hiddenUntilRevealed ||
        definition.waypoints.some(
          (waypoint) =>
            waypoint.regionId === region.id &&
            (journey.revealedWaypointIds.includes(waypoint.id) || journey.visitedIds.includes(waypoint.id)),
        )),
  );
  const regionIds = new Set(regions.map((region) => region.id));
  const safeRegions = regions.map((region) => ({
    ...region,
    parentId: region.parentId && regionIds.has(region.parentId) ? region.parentId : undefined,
  }));
  const landmarks = (definition.context?.landmarks ?? [])
    .filter(
      (landmark) =>
        regionIds.has(landmark.regionId) &&
        releasedWaypointIds.has(landmark.waypointId) &&
        landmark.privacyClassification !== "APPROXIMATE_REAL_WORLD",
    )
    .map((landmark) => ({
      ...landmark,
      referenceAssetIds: landmark.referenceAssetIds.filter((id) =>
        context.releasedAssets.some((asset) => asset.id === id),
      ),
      negativeReferenceAssetIds: landmark.negativeReferenceAssetIds.filter((id) =>
        context.releasedAssets.some((asset) => asset.id === id),
      ),
    }));
  const safeWaypoint = (waypoint: LandfallDefinition["waypoints"][number]) => ({
    ...waypoint,
    regionId: waypoint.regionId && regionIds.has(waypoint.regionId) ? waypoint.regionId : undefined,
    landmarkId:
      waypoint.landmarkId && landmarks.some((landmark) => landmark.id === waypoint.landmarkId)
        ? waypoint.landmarkId
        : undefined,
  });
  const releasedIds = new Set(waypoints.map((item) => item.id));
  const routes =
    journey.activeRoute && journey.activeRoute.waypointIds.every((id) => releasedIds.has(id))
      ? [journey.activeRoute]
      : [];
  const imageAssetId = map.source.type === "ASSET_IMAGE" ? map.source.assetId : null;
  const asset = imageAssetId ? context.releasedAssets.find((item) => item.id === imageAssetId) : undefined;
  const scene = projectLandfallMap(
    definition,
    {
      audience: "PLAYER",
      activeWorldspaceId: worldspace.id,
      availableLocations: waypoints.map(({ id }) => ({ id })),
      activeRouteId: routes[0]?.id ?? null,
      availableOverlayIds: journey.revealedOverlayIds,
      activeWaypointId: journey.activeWaypointId,
      visitedIds: journey.visitedIds,
      revealedRouteIds: journey.revealedRouteIds,
      availableRegionIds: [...regionIds],
    },
    map.id,
  );
  const coordinateReference =
    worldspace.coordinateReference.type === "NORMALIZED_IMAGE_2D" && !asset
      ? { ...worldspace.coordinateReference, imageAssetId: "withheld" }
      : worldspace.coordinateReference;
  const releaseScene = (value: LandfallMapScene): LandfallMapScene => {
    const image = context.releasedAssets.find((item) => item.id === value.imageAssetId);
    return {
      ...value,
      ...(image ? { imageUrl: image.url } : {}),
      imageAssetId: image ? value.imageAssetId : undefined,
      overlays: value.overlays.flatMap((overlay) => {
        const released = context.releasedAssets.find((item) => item.id === overlay.assetId);
        return released ? [{ ...overlay, imageUrl: released.url }] : [];
      }),
    };
  };
  const availableMaps = definition.maps
    .filter(
      (candidate) =>
        candidate.worldspaceId === worldspace.id &&
        (candidate.id === map.id ||
          !candidate.source.type.startsWith("ASSET_") ||
          ("assetId" in candidate.source &&
            context.releasedAssets.some((item) => item.id === (candidate.source as { assetId: string }).assetId))) &&
        (candidate.id === map.id ||
          !definition.context?.regions.some((region) => region.mapId === candidate.id) ||
          safeRegions.some((region) => region.mapId === candidate.id)),
    )
    .map((candidate) => ({
      id: candidate.id,
      name: candidate.name,
      ...(candidate.level ? { level: candidate.level } : {}),
      scene: releaseScene(
        projectLandfallMap(
          definition,
          {
            audience: context.replayOnly ? "REPLAY" : "PLAYER",
            activeWorldspaceId: worldspace.id,
            availableLocations: journey.availableWaypoints
              .filter((item) => item.mapId === candidate.id)
              .map(({ id }) => ({ id })),
            activeRouteId: candidate.id === map.id ? (routes[0]?.id ?? null) : null,
            availableOverlayIds: journey.revealedOverlayIds,
            availableRegionIds: [...regionIds],
            activeWaypointId: journey.activeWaypointId,
            visitedIds: journey.visitedIds,
            revealedRouteIds: journey.revealedRouteIds,
          },
          candidate.id,
        ),
      ),
      offlineMap:
        candidate.source.type === "AUTHORED_VECTOR"
          ? ("READY" as const)
          : candidate.overlays?.some((overlay) => context.releasedAssets.some((item) => item.id === overlay.assetId)) ||
              (candidate.source.type === "ASSET_IMAGE" &&
                context.releasedAssets.some(
                  (item) => "assetId" in candidate.source && item.id === candidate.source.assetId,
                ))
            ? ("PARTIAL" as const)
            : ("UNAVAILABLE" as const),
    }));
  const contextualSummary =
    journey.contextualSummary && regionIds.has(journey.contextualSummary.regionId ?? "")
      ? journey.contextualSummary
      : null;
  const visibleRoutes = routes.flatMap((route) => {
    const visibility = route.presentation?.visibility ?? "FULL";
    if (visibility === "HIDDEN" && !journey.revealedRouteIds.includes(route.id)) return [];
    if (visibility === "FULL" || (visibility === "HIDDEN" && journey.revealedRouteIds.includes(route.id)))
      return [route];
    const activeIndex = route.waypointIds.indexOf(journey.activeWaypointId ?? "");
    const previousId = route.waypointIds
      .slice(0, Math.max(0, activeIndex))
      .reverse()
      .find((id) => journey.visitedIds.includes(id));
    const waypointIds = [previousId, journey.activeWaypointId].filter((id): id is string => Boolean(id));
    if (!waypointIds.length) return [];
    return [{ ...route, waypointIds, geometry: undefined }];
  });
  const presentationEvents = [...(context.events ?? [])].sort(
    (a, b) => a.sequence - b.sequence || a.id.localeCompare(b.id),
  );
  const presentations = presentationEvents
    .flatMap((event) => {
      const payload = presentationPayload(event);
      const waypoint = definition.waypoints.find((item) => item.id === payload.waypointId);
      const route = definition.routes.find((item) => item.id === payload.routeId);
      const sceneName: PlayerLandfallBootstrap["presentations"][number]["sceneName"] | null =
        event.eventType === "landfallWaypointConfirmed"
          ? "landfall-arrival"
          : ["landfallRouteRevealed", "landfallRouteSelected"].includes(event.eventType)
            ? "landfall-route"
            : ["landfallWaypointRevealed", "landfallOverlayRevealed"].includes(event.eventType)
              ? "landfall-reveal"
              : null;
      if (!sceneName) return [];
      if (
        event.eventType === "landfallRouteRevealed" &&
        presentationEvents.some(
          (later) =>
            later.sequence > event.sequence &&
            later.sequence <= event.sequence + 3 &&
            later.eventType === "landfallRouteSelected" &&
            presentationPayload(later).routeId === payload.routeId,
        )
      )
        return [];
      const label =
        sceneName === "landfall-arrival"
          ? `Arrival recorded: ${waypoint?.visibility.publicLabel ?? waypoint?.name ?? "waypoint"}`
          : sceneName === "landfall-route"
            ? `Route revealed: ${route?.name ?? "route"}`
            : event.eventType === "landfallOverlayRevealed"
              ? "Map overlay revealed"
              : `Location revealed: ${waypoint?.visibility.publicLabel ?? waypoint?.name ?? "waypoint"}`;
      return [
        {
          eventId: event.id,
          sequence: event.sequence,
          createdAt: event.createdAt ? new Date(event.createdAt).toISOString() : "",
          sceneName,
          label,
        },
      ];
    })
    .slice(-12);
  return {
    sessionId: pinned.sessionId,
    publishedVersionId: pinned.publishedVersionId,
    currentSequence: pinned.currentSequence,
    worldspaceName: worldspace.name,
    activeWaypointId:
      !context.replayOnly && waypoints.some((item) => item.id === journey.activeWaypointId)
        ? journey.activeWaypointId
        : null,
    ...(context.observationWaypointId === objective?.id &&
    objective?.evidenceProfile.precisionProfile === "EXACT_OBJECT"
      ? { contextualArrivalWaypointId: objective.id }
      : {}),
    visitedIds: journey.visitedIds,
    discoveredIds: journey.discoveredIds,
    journeyPath: journey.journeyPath.map((item) => ({
      ...item,
      contextualSummary:
        item.contextualSummary && regionIds.has(item.contextualSummary.regionId ?? "") ? item.contextualSummary : null,
      label:
        item.kind === "VISIT"
          ? (definition.waypoints.find((waypoint) => waypoint.id === item.targetId)?.visibility.publicLabel ??
            definition.waypoints.find((waypoint) => waypoint.id === item.targetId)?.name ??
            "Waypoint")
          : (definition.worldspaces.find((space) => space.id === item.targetId)?.name ?? "Worldspace"),
    })),
    paused: journey.paused,
    replayOnly: Boolean(context.replayOnly),
    offlineMap: map.overlays?.length
      ? "PARTIAL"
      : map.source.type === "AUTHORED_VECTOR"
        ? "READY"
        : map.source.type === "ASSET_IMAGE" && asset
          ? "PARTIAL"
          : "UNAVAILABLE",
    presentations,
    contextualSummary,
    availableMaps,
    scene: {
      ...scene,
      ...(asset ? { imageUrl: asset.url } : {}),
      imageAssetId: asset ? scene.imageAssetId : undefined,
      overlays: scene.overlays
        .filter((overlay) => context.releasedAssets.some((item) => item.id === overlay.assetId))
        .map((overlay) => ({
          ...overlay,
          imageUrl: context.releasedAssets.find((item) => item.id === overlay.assetId)!.url,
        })),
    },
    runtimeDefinition: {
      worldspaces: [{ ...worldspace, coordinateReference, mapDefinitionIds: availableMaps.map((item) => item.id) }],
      waypoints: waypoints.map(safeWaypoint),
      routes: visibleRoutes.map((route) => ({
        ...route,
        segmentRegionIds: route.segmentRegionIds?.every((id) => regionIds.has(id)) ? route.segmentRegionIds : undefined,
      })),
      transitions: [],
      ...(definition.context ? { context: { regions: safeRegions, landmarks } } : {}),
    },
  };
}
