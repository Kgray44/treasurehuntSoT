import { projectLandfallMap, type LandfallMapScene } from "@/landfall/map-projection";
import type { PinnedLandfallDefinition } from "@/landfall/published";
import type { LandfallDefinition } from "@/landfall/schema";
import { projectLandfallJourney, type LandfallJourneyEvent } from "@/landfall/journey-projection";

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
  runtimeDefinition: Pick<LandfallDefinition, "worldspaces" | "waypoints" | "routes" | "transitions">;
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
  },
): PlayerLandfallBootstrap {
  const definition = pinned.definition;
  const journey = projectLandfallJourney(definition, context.events ?? [], context);
  const worldspace = definition.worldspaces.find((item) => item.id === journey.activeWorldspaceId)!;
  const objective = definition.waypoints.find((item) => item.id === journey.activeWaypointId);
  const map = definition.maps.find((item) => item.id === (objective?.mapId ?? worldspace.defaultMapDefinitionId));
  if (!map) throw new Error("LANDFALL_MAP_UNAVAILABLE");

  const waypoints = journey.availableWaypoints.filter((item) => item.mapId === map.id);
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
    },
    map.id,
  );
  const coordinateReference =
    worldspace.coordinateReference.type === "NORMALIZED_IMAGE_2D" && !asset
      ? { ...worldspace.coordinateReference, imageAssetId: "withheld" }
      : worldspace.coordinateReference;
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
    visitedIds: journey.visitedIds,
    discoveredIds: journey.discoveredIds,
    journeyPath: journey.journeyPath.map((item) => ({
      ...item,
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
      worldspaces: [{ ...worldspace, coordinateReference, mapDefinitionIds: [map.id] }],
      waypoints,
      routes: visibleRoutes,
      transitions: [],
    },
  };
}
