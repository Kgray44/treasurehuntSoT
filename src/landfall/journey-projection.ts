import type { LandfallDefinition, LandfallRoute, LandfallWaypoint } from "@/landfall/schema";

export type LandfallJourneyEvent = Readonly<{
  id: string;
  sequence: number;
  eventType: string;
  payload: string | Record<string, unknown>;
  createdAt?: Date | string;
}>;

export type LandfallJourneyProjection = Readonly<{
  activeWorldspaceId: string;
  visitedIds: readonly string[];
  skippedIds: readonly string[];
  discoveredIds: readonly string[];
  revealedWaypointIds: readonly string[];
  revealedRouteIds: readonly string[];
  revealedOverlayIds: readonly string[];
  selectedRouteId: string | null;
  selectedWaypointId: string | null;
  paused: boolean;
  journeyPath: readonly Readonly<{
    id: string;
    worldspaceId: string;
    kind: "VISIT" | "TRANSITION";
    targetId: string;
    confirmedAt: string | null;
  }>[];
  availableWaypoints: readonly LandfallWaypoint[];
  activeWaypointId: string | null;
  activeRoute: LandfallRoute | null;
}>;

function payloadOf(event: LandfallJourneyEvent): Record<string, unknown> {
  try {
    const parsed = typeof event.payload === "string" ? JSON.parse(event.payload) : event.payload;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/** Canonical Tale Session events, never raw coordinates, determine Player-visible journey state. */
export function projectLandfallJourney(
  definition: LandfallDefinition,
  events: readonly LandfallJourneyEvent[],
  current?: { chapterId?: string | null; blockId?: string | null; now?: number },
): LandfallJourneyProjection {
  const worlds = new Map(definition.worldspaces.map((item) => [item.id, item]));
  const waypoints = new Map(definition.waypoints.map((item) => [item.id, item]));
  const routes = new Map(definition.routes.map((item) => [item.id, item]));
  let activeWorldspaceId = definition.worldspaces[0]?.id;
  if (!activeWorldspaceId) throw new Error("LANDFALL_WORLDSPACE_UNAVAILABLE");
  const visited = new Set<string>();
  const skipped = new Set<string>();
  const discovered = new Set<string>();
  const revealedWaypoints = new Set<string>();
  const revealedRoutes = new Set<string>();
  const revealedOverlays = new Set<string>();
  const path: Array<LandfallJourneyProjection["journeyPath"][number]> = [];
  let selectedRouteId: string | null = null;
  let selectedWaypointId: string | null = null;
  let paused = false;
  let explicitTransition = false;
  for (const event of [...events].sort((a, b) => a.sequence - b.sequence || a.id.localeCompare(b.id))) {
    const payload = payloadOf(event);
    const waypointId = typeof payload.waypointId === "string" ? payload.waypointId : null;
    const routeId = typeof payload.routeId === "string" ? payload.routeId : null;
    const destinationId = typeof payload.worldspaceId === "string" ? payload.worldspaceId : null;
    switch (event.eventType) {
      case "landfallWaypointConfirmed":
        if (!waypointId || !waypoints.has(waypointId) || visited.has(waypointId)) break;
        visited.add(waypointId);
        discovered.add(waypointId);
        path.push({
          id: event.id,
          worldspaceId: waypoints.get(waypointId)!.worldspaceId,
          kind: "VISIT",
          targetId: waypointId,
          confirmedAt: event.createdAt ? new Date(event.createdAt).toISOString() : null,
        });
        break;
      case "landfallWaypointSkipped":
        if (waypointId && waypoints.has(waypointId)) skipped.add(waypointId);
        break;
      case "landfallWaypointRevealed":
        if (waypointId && waypoints.has(waypointId)) {
          revealedWaypoints.add(waypointId);
          discovered.add(waypointId);
        }
        break;
      case "landfallRouteRevealed":
        if (routeId && routes.has(routeId)) revealedRoutes.add(routeId);
        break;
      case "landfallOverlayRevealed": {
        const overlayId = typeof payload.overlayId === "string" ? payload.overlayId : null;
        if (overlayId && definition.maps.some((map) => map.overlays?.some((overlay) => overlay.id === overlayId)))
          revealedOverlays.add(overlayId);
        break;
      }
      case "landfallRouteSelected":
        if (routeId && routes.has(routeId)) selectedRouteId = routeId;
        break;
      case "landfallWaypointSelected":
        if (waypointId && waypoints.has(waypointId)) selectedWaypointId = waypointId;
        break;
      case "landfallWorldspaceEntered":
        if (
          destinationId &&
          worlds.has(destinationId) &&
          definition.transitions.some(
            (transition) =>
              transition.toWorldspaceId === destinationId && transition.fromWorldspaceId === activeWorldspaceId,
          )
        ) {
          activeWorldspaceId = destinationId;
          selectedRouteId = null;
          selectedWaypointId = null;
          explicitTransition = true;
          path.push({
            id: event.id,
            worldspaceId: destinationId,
            kind: "TRANSITION",
            targetId: destinationId,
            confirmedAt: event.createdAt ? new Date(event.createdAt).toISOString() : null,
          });
        }
        break;
      case "landfallProgressPaused":
        paused = true;
        break;
      case "landfallProgressResumed":
        paused = false;
        break;
    }
  }
  // Phase 1 published Chronicles could select a destination on entry before
  // Phase 2 durable spatial events existed. Retain that one-step compatibility.
  if (!explicitTransition && current) {
    const entered = definition.transitions.find(
      (transition) =>
        transition.fromWorldspaceId === activeWorldspaceId &&
        ((transition.trigger.type === "CHAPTER" && transition.trigger.id === current.chapterId) ||
          (transition.trigger.type === "BLOCK" && transition.trigger.id === current.blockId)),
    );
    if (entered) activeWorldspaceId = entered.toWorldspaceId;
  }
  const availableWaypoints = definition.waypoints.filter(
    (waypoint) =>
      waypoint.worldspaceId === activeWorldspaceId &&
      (!waypoint.expiresAt || Date.parse(waypoint.expiresAt) > (current?.now ?? Date.now())) &&
      (!waypoint.visibility.hiddenUntilRevealed || revealedWaypoints.has(waypoint.id) || visited.has(waypoint.id)) &&
      waypoint.sequence.afterWaypointIds.every((id) => visited.has(id) || skipped.has(id)),
  );
  const currentWaypoints = availableWaypoints.filter((item) => !visited.has(item.id) && !skipped.has(item.id));
  const activeWaypointId =
    currentWaypoints.find((item) => item.id === selectedWaypointId)?.id ??
    currentWaypoints.find((item) => !item.sequence.optional)?.id ??
    currentWaypoints[0]?.id ??
    null;
  const availableIds = new Set(availableWaypoints.map((item) => item.id));
  const eligibleRoutes = definition.routes.filter(
    (route) =>
      route.worldspaceId === activeWorldspaceId &&
      (route.model !== "HIDDEN" || revealedRoutes.has(route.id)) &&
      route.waypointIds.every((id) => availableIds.has(id)),
  );
  const activeRoute = eligibleRoutes.find((route) => route.id === selectedRouteId) ?? eligibleRoutes[0] ?? null;
  return {
    activeWorldspaceId,
    visitedIds: [...visited],
    skippedIds: [...skipped],
    discoveredIds: [...discovered],
    revealedWaypointIds: [...revealedWaypoints],
    revealedRouteIds: [...revealedRoutes],
    revealedOverlayIds: [...revealedOverlays],
    selectedRouteId,
    selectedWaypointId,
    paused,
    journeyPath: path,
    availableWaypoints,
    activeWaypointId,
    activeRoute,
  };
}
