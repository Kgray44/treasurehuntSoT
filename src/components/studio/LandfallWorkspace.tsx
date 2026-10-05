"use client";

import { landfallSourceCapabilities } from "@/landfall/source-capabilities";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { ZodError } from "zod";
import type { Asset, LibraryRecord } from "@/components/studio/studio-types";
import { LandfallFieldTestPanel } from "@/components/studio/LandfallFieldTestPanel";
import { LandfallContextEditor } from "@/components/studio/LandfallContextEditor";
import { LandfallProviderPanel } from "@/components/studio/LandfallProviderPanel";
import { LandfallOnlinePlacePanel } from "@/components/studio/LandfallOnlinePlacePanel";
import { LandfallInstallationPanel } from "@/components/studio/LandfallInstallationPanel";
import {
  addLandfallWorldspace,
  applyLandfallPreset,
  coordinateAt,
  createLandfallWaypoint,
  landfallAuthoringFindings,
} from "@/landfall/authoring";
import { validateLandfallDefinition } from "@/landfall/definition";
import { distance } from "@/landfall/geometry";
import { projectLandfallJourney, type LandfallJourneyEvent } from "@/landfall/journey-projection";
import { projectLandfallMap } from "@/landfall/map-projection";
import type { LandfallMapInteraction } from "@/landfall/map-renderer";
import type {
  LandfallDefinition,
  LandfallMapDefinition,
  LandfallRoute,
  LandfallTransition,
  LandfallWaypoint,
  LandfallWorldspace,
} from "@/landfall/schema";

const LandfallMapRenderer = dynamic(
  () => import("@/landfall/map-renderer").then((module) => module.LandfallMapRenderer),
  { ssr: false, loading: () => <p role="status">Opening the chart canvas…</p> },
);

type Tool = "INSPECT" | "PLACE" | "POLYGON" | "MULTIPOLYGON" | "ROUTE" | "GATE" | "CORRIDOR";
type Preview =
  | "CREATOR"
  | "PLAYER"
  | "CAPTAIN"
  | "REVEALED"
  | "COMPLETED"
  | "SKIPPED"
  | "REPLAY"
  | "NEARBY"
  | "FAILED"
  | "PUBLIC";
const id = () => crypto.randomUUID();

function drawnRouteLength(route: LandfallRoute | undefined, worldspace: LandfallWorldspace | undefined) {
  if (
    !route ||
    !worldspace ||
    !route.geometry ||
    (route.geometry.type !== "ROUTE_LINE" && route.geometry.type !== "CORRIDOR")
  )
    return null;
  const points = route.geometry.points;
  return points.slice(1).reduce((sum, point, index) => sum + distance(points[index], point, worldspace), 0);
}

function previewEvents(
  definition: LandfallDefinition,
  worldspaceId: string,
  selectedId: string | null,
  preview: Preview,
): LandfallJourneyEvent[] {
  const events: LandfallJourneyEvent[] = [];
  const start = definition.worldspaces[0]?.id;
  if (start && start !== worldspaceId) {
    const queue: Array<{ worldspaceId: string; path: LandfallTransition[] }> = [{ worldspaceId: start, path: [] }];
    const seen = new Set<string>();
    while (queue.length) {
      const next = queue.shift()!;
      if (next.worldspaceId === worldspaceId) {
        for (const transition of next.path)
          events.push({
            id: `preview-${transition.id}`,
            sequence: events.length + 1,
            eventType: "landfallWorldspaceEntered",
            payload: { worldspaceId: transition.toWorldspaceId },
          });
        break;
      }
      if (seen.has(next.worldspaceId)) continue;
      seen.add(next.worldspaceId);
      for (const transition of definition.transitions.filter((item) => item.fromWorldspaceId === next.worldspaceId))
        queue.push({ worldspaceId: transition.toWorldspaceId, path: [...next.path, transition] });
    }
  }
  if (!["REVEALED", "COMPLETED", "SKIPPED", "REPLAY"].includes(preview) || !selectedId) return events;
  const waypoint = definition.waypoints.find((item) => item.id === selectedId && item.worldspaceId === worldspaceId);
  const route = definition.routes.find((item) => item.id === selectedId && item.worldspaceId === worldspaceId);
  const add = (eventType: string, payload: Record<string, unknown>) =>
    events.push({
      id: `preview-${events.length + 1}`,
      sequence: events.length + 1,
      eventType,
      payload,
    });
  if (waypoint) add("landfallWaypointRevealed", { waypointId: waypoint.id });
  if (route) {
    add("landfallRouteRevealed", { routeId: route.id });
    add("landfallRouteSelected", { routeId: route.id });
    for (const id of route.waypointIds) add("landfallWaypointRevealed", { waypointId: id });
  }
  const targets = waypoint ? [waypoint.id] : (route?.waypointIds ?? []);
  if (preview === "COMPLETED" || preview === "REPLAY")
    for (const waypointId of targets) add("landfallWaypointConfirmed", { waypointId });
  if (preview === "SKIPPED") for (const waypointId of targets) add("landfallWaypointSkipped", { waypointId });
  return events;
}

export function LandfallWorkspace({
  taleId,
  draftId,
  sourceVersion,
  csrfToken,
  unsaved,
  definition,
  assets,
  locations,
  taleVisibility,
  chapterOptions,
  onChange,
}: {
  taleId: string;
  draftId: string;
  sourceVersion: number;
  csrfToken: string;
  unsaved: boolean;
  definition: LandfallDefinition | null;
  assets: Asset[];
  locations: LibraryRecord[];
  taleVisibility: string;
  chapterOptions: Array<{ id: string; title: string; blocks: Array<{ id: string; title: string }> }>;
  onChange: (definition: LandfallDefinition) => void;
}) {
  const [worldspaceId, setWorldspaceId] = useState<string | null>(null);
  const [mapId, setMapId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const [drawingRegionId, setDrawingRegionId] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>("INSPECT");
  const [preview, setPreview] = useState<Preview>("CREATOR");
  const [mobilePreview, setMobilePreview] = useState(false);
  const [pendingPoints, setPendingPoints] = useState<Array<[number, number]>>([]);
  const [error, setError] = useState("");
  const [newName, setNewName] = useState("");
  const [newKind, setNewKind] = useState<"PHYSICAL" | "VIRTUAL">("PHYSICAL");
  const [latitude, setLatitude] = useState(0);
  const [longitude, setLongitude] = useState(0);
  const [imageAssetId, setImageAssetId] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const [placeName, setPlaceName] = useState("");
  const [transitionDestination, setTransitionDestination] = useState("");
  const [transitionTrigger, setTransitionTrigger] = useState("");
  const [transitionTriggerType, setTransitionTriggerType] = useState<"CHAPTER" | "BLOCK">("CHAPTER");
  const [manualX, setManualX] = useState<number | null>(null);
  const [manualY, setManualY] = useState<number | null>(null);
  const [attributionLabel, setAttributionLabel] = useState("");
  const [attributionUrl, setAttributionUrl] = useState("");
  const [overlayAssetId, setOverlayAssetId] = useState("");
  const [overlayLabel, setOverlayLabel] = useState("");
  const [overlayUrl, setOverlayUrl] = useState("");
  const [overlayBounds, setOverlayBounds] = useState<{
    west: number;
    south: number;
    east: number;
    north: number;
  } | null>(null);

  const worldspace = definition?.worldspaces.find((item) => item.id === worldspaceId) ?? definition?.worldspaces[0];
  const map =
    definition?.maps.find((item) => item.id === mapId && item.worldspaceId === worldspace?.id) ??
    definition?.maps.find((item) => item.id === worldspace?.defaultMapDefinitionId);
  const waypoints = useMemo(
    () => definition?.waypoints.filter((item) => item.worldspaceId === worldspace?.id) ?? [],
    [definition, worldspace?.id],
  );
  const routes = useMemo(
    () => definition?.routes.filter((item) => item.worldspaceId === worldspace?.id) ?? [],
    [definition, worldspace?.id],
  );
  const selectedWaypoint = waypoints.find((item) => item.id === selectedId);
  const selectedRoute = routes.find((item) => item.id === selectedId);
  const routeLength = drawnRouteLength(selectedRoute, worldspace);
  const selectedMap = map?.id === selectedId ? map : null;
  const findings = definition ? landfallAuthoringFindings(definition, taleVisibility, assets) : [];
  const scene = useMemo(() => {
    if (!definition || !worldspace || !map || preview === "PUBLIC") return null;
    const journey = projectLandfallJourney(definition, previewEvents(definition, worldspace.id, selectedId, preview));
    const visibleWaypoints =
      preview === "CREATOR"
        ? waypoints
        : preview === "CAPTAIN"
          ? []
          : journey.availableWaypoints.filter((item) => item.worldspaceId === worldspace.id);
    const visibleIds = new Set(visibleWaypoints.map((item) => item.id));
    const visibleRoute =
      preview === "CREATOR"
        ? routes[0]
        : preview === "CAPTAIN"
          ? null
          : journey.activeRoute && journey.activeRoute.waypointIds.every((item) => visibleIds.has(item))
            ? journey.activeRoute
            : null;
    const projected = projectLandfallMap(
      definition,
      {
        audience:
          preview === "CREATOR"
            ? "CREATOR_TEST"
            : preview === "CAPTAIN"
              ? "CAPTAIN"
              : preview === "REPLAY"
                ? "REPLAY"
                : "PLAYER",
        activeWorldspaceId: worldspace.id,
        availableLocations: visibleWaypoints.map(({ id }) => ({ id })),
        activeRouteId: visibleRoute?.id ?? null,
        activeWaypointId: journey.activeWaypointId,
        visitedIds: journey.visitedIds,
        revealedRouteIds: journey.revealedRouteIds,
        availableOverlayIds:
          preview === "CREATOR"
            ? map.overlays?.map((item) => item.id)
            : preview === "CAPTAIN"
              ? []
              : journey.revealedOverlayIds,
      },
      map.id,
    );
    const assetId = map.source.type === "ASSET_IMAGE" ? map.source.assetId : null;
    const asset = assets.find((item) => item.id === assetId);
    const imageUrl = asset?.variants.find((item) => item.processingState === "READY")?.url;
    return {
      ...projected,
      ...(imageUrl ? { imageUrl } : {}),
      overlays: projected.overlays.map((overlay) => ({
        ...overlay,
        imageUrl: assets
          .find((asset) => asset.id === overlay.assetId)
          ?.variants.find((variant) => variant.processingState === "READY")?.url,
      })),
    };
  }, [definition, worldspace, map, preview, selectedId, waypoints, routes, assets]);

  function commit(next: LandfallDefinition): boolean {
    try {
      const validated = validateLandfallDefinition(next);
      onChange(validated);
      setError("");
      return true;
    } catch (cause) {
      const message =
        cause instanceof ZodError
          ? cause.issues[0]?.message
          : cause instanceof Error
            ? cause.message.replaceAll("_", " ").toLowerCase()
            : "The chart change could not be validated.";
      setError(message ?? "The chart change could not be validated.");
      return false;
    }
  }

  function createWorldspace() {
    if (!newName.trim()) return setError("Name the Worldspace before creating it.");
    const image = assets.find((item) => item.id === imageAssetId);
    try {
      const next = addLandfallWorldspace(definition, {
        taleId,
        name: newName.trim(),
        kind: newKind,
        latitude,
        longitude,
        ...(newKind === "VIRTUAL" && image
          ? { imageAssetId: image.id, imageWidth: image.width ?? 1000, imageHeight: image.height ?? 1000 }
          : {}),
      });
      if (commit(next)) {
        setWorldspaceId(next.worldspaces.at(-1)!.id);
        setMapId(next.maps.at(-1)!.id);
        setNewName("");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Worldspace could not be created.");
    }
  }

  function updateMap(patch: (map: LandfallMapDefinition) => LandfallMapDefinition) {
    if (!definition || !map) return;
    commit({ ...definition, maps: definition.maps.map((item) => (item.id === map.id ? patch(item) : item)) });
  }

  function updateWorldspace(patch: (space: NonNullable<typeof worldspace>) => NonNullable<typeof worldspace>) {
    if (!definition || !worldspace) return;
    commit({
      ...definition,
      worldspaces: definition.worldspaces.map((item) => (item.id === worldspace.id ? patch(item) : item)),
    });
  }

  function updateTransition(transitionId: string, patch: (item: LandfallTransition) => LandfallTransition) {
    if (!definition) return;
    commit({
      ...definition,
      transitions: definition.transitions.map((item) => (item.id === transitionId ? patch(item) : item)),
    });
  }

  function updateWaypoint(patch: (waypoint: LandfallWaypoint) => LandfallWaypoint) {
    if (!definition || !selectedWaypoint) return;
    const updated = patch(selectedWaypoint);
    commit({
      ...definition,
      waypoints: definition.waypoints.map((item) => (item.id === selectedWaypoint.id ? updated : item)),
      ...(definition.context
        ? {
            context: {
              ...definition.context,
              landmarks: definition.context.landmarks.map((item) =>
                item.waypointId === updated.id ? { ...item, fallback: updated.fallback } : item,
              ),
            },
          }
        : {}),
    });
  }

  function updateRoute(patch: (route: LandfallRoute) => LandfallRoute) {
    if (!definition || !selectedRoute) return;
    commit({
      ...definition,
      routes: definition.routes.map((item) => (item.id === selectedRoute.id ? patch(item) : item)),
    });
  }

  function place(x: number, y: number) {
    if (!worldspace || !map || !definition) return;
    if (["POLYGON", "MULTIPOLYGON", "ROUTE", "GATE", "CORRIDOR"].includes(tool)) {
      setPendingPoints((points) => [...points.slice(-1023), [x, y]]);
      return;
    }
    if (tool !== "PLACE") return;
    const next = createLandfallWaypoint(
      worldspace,
      map,
      coordinateAt(worldspace, x, y),
      placeName || `Location ${waypoints.length + 1}`,
    );
    if (commit({ ...definition, waypoints: [...definition.waypoints, next] })) {
      setSelectedId(next.id);
      setTool("INSPECT");
      setPlaceName("");
    }
  }

  function finishDrawing() {
    if (!definition || !worldspace || !map) return;
    const points = pendingPoints.map(([x, y]) => coordinateAt(worldspace, x, y));
    if (drawingRegionId && definition.context) {
      const geometry =
        tool === "POLYGON" && points.length >= 3
          ? { type: "POLYGON" as const, rings: [[...points, points[0]]] }
          : tool === "CORRIDOR" && points.length >= 2
            ? { type: "CORRIDOR" as const, points, width: worldspace.kind === "PHYSICAL" ? 3 : 10 }
            : tool === "GATE" && points.length === 2
              ? { type: "ENTRANCE_GATE" as const, start: points[0], end: points[1], direction: "EITHER" as const }
              : null;
      if (!geometry)
        return setError(
          "A boundary needs at least three points; a corridor needs two; an entrance or exit needs exactly two.",
        );
      if (
        commit({
          ...definition,
          context: {
            ...definition.context,
            regions: definition.context.regions.map((region) =>
              region.id === drawingRegionId ? { ...region, geometry } : region,
            ),
          },
        })
      ) {
        setPendingPoints([]);
        setDrawingRegionId(null);
        setTool("INSPECT");
      }
      return;
    }
    if ((tool === "POLYGON" || tool === "MULTIPOLYGON") && selectedWaypoint && points.length >= 3) {
      const ring = [...points, points[0]];
      if (
        commit({
          ...definition,
          waypoints: definition.waypoints.map((item) =>
            item.id === selectedWaypoint.id
              ? {
                  ...item,
                  geometry:
                    tool === "MULTIPOLYGON"
                      ? {
                          type: "MULTIPOLYGON",
                          polygons: [
                            ...(item.geometry.type === "POLYGON"
                              ? [item.geometry.rings]
                              : item.geometry.type === "MULTIPOLYGON"
                                ? item.geometry.polygons
                                : []),
                            [ring],
                          ],
                        }
                      : { type: "POLYGON", rings: [ring] },
                }
              : item,
          ),
        })
      )
        setPendingPoints([]);
    } else if (tool === "GATE" && selectedWaypoint && points.length === 2) {
      if (
        commit({
          ...definition,
          waypoints: definition.waypoints.map((item) =>
            item.id === selectedWaypoint.id
              ? {
                  ...item,
                  type: "PASS_THROUGH_GATE",
                  geometry: {
                    type: "ENTRANCE_GATE",
                    start: points[0],
                    end: points[1],
                    direction: "EITHER",
                  },
                }
              : item,
          ),
        })
      )
        setPendingPoints([]);
    } else if ((tool === "ROUTE" || tool === "CORRIDOR") && selectedRoute && points.length >= 2) {
      if (
        commit({
          ...definition,
          routes: definition.routes.map((item) =>
            item.id === selectedRoute.id
              ? {
                  ...item,
                  semantics: "NAVIGATIONAL",
                  segmentRegionIds: undefined,
                  geometry:
                    tool === "CORRIDOR"
                      ? { type: "CORRIDOR", points, width: worldspace.kind === "PHYSICAL" ? 30 : 10 }
                      : { type: "ROUTE_LINE", points },
                }
              : item,
          ),
        })
      )
        setPendingPoints([]);
    } else setError("Select a waypoint for a region or two-point gate, or a route for a path or corridor.");
  }

  const interaction: LandfallMapInteraction | undefined =
    preview === "CREATOR" && worldspace
      ? {
          onPlace: place,
          onSelect: (id) => {
            setSelectedId(id);
            if (definition?.context?.regions.some((item) => item.id === id)) setSelectedRegionId(id);
          },
          onMovePoint: (featureId, x, y) => {
            if (!definition) return;
            const waypoint = definition.waypoints.find((item) => item.id === featureId);
            if (!waypoint || !["POINT_RADIUS", "APPROXIMATE_REGION"].includes(waypoint.geometry.type)) return;
            const geometry =
              waypoint.geometry.type === "POINT_RADIUS"
                ? { ...waypoint.geometry, center: coordinateAt(worldspace, x, y) }
                : { ...waypoint.geometry, center: coordinateAt(worldspace, x, y) };
            commit({
              ...definition,
              waypoints: definition.waypoints.map((item) => (item.id === featureId ? { ...item, geometry } : item)),
            });
          },
        }
      : undefined;

  return (
    <section className="landfall-workspace" aria-label="Landfall authoring workspace">
      <header className="landfall-workspace-heading">
        <div>
          <p className="eyebrow">Living World Navigation</p>
          <h2>Landfall</h2>
          <p>Author real and virtual places in the Chronicle draft. Changes use Studio autosave, Undo, and Redo.</p>
        </div>
      </header>
      {error && (
        <p role="alert" className="editor-error">
          {error}
        </p>
      )}
      <div className="landfall-worldspace-create">
        <label>
          Worldspace name
          <input value={newName} onChange={(event) => setNewName(event.target.value)} />
        </label>
        <label>
          Realm
          <select value={newKind} onChange={(event) => setNewKind(event.target.value as typeof newKind)}>
            <option value="PHYSICAL">Real place</option>
            <option value="VIRTUAL">Virtual world</option>
          </select>
        </label>
        {newKind === "PHYSICAL" ? (
          <>
            <label>
              Starting latitude
              <input
                type="number"
                min="-90"
                max="90"
                step="any"
                value={latitude}
                onChange={(event) => setLatitude(Number(event.target.value))}
              />
            </label>
            <label>
              Starting longitude
              <input
                type="number"
                min="-180"
                max="180"
                step="any"
                value={longitude}
                onChange={(event) => setLongitude(Number(event.target.value))}
              />
            </label>
          </>
        ) : (
          <label>
            Map source
            <select value={imageAssetId} onChange={(event) => setImageAssetId(event.target.value)}>
              <option value="">Authored vector canvas</option>
              {assets
                .filter((asset) => asset.mimeType.startsWith("image/"))
                .map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.displayName}
                  </option>
                ))}
            </select>
          </label>
        )}
        <button type="button" className="brass-button" onClick={createWorldspace}>
          Add Worldspace
        </button>
      </div>
      {!definition || !worldspace || !map ? (
        <p role="status">Add a real place or virtual world to begin the Living Chart.</p>
      ) : (
        <>
          <div className="landfall-workspace-toolbar">
            <label>
              Worldspace
              <select
                value={worldspace.id}
                onChange={(event) => {
                  setWorldspaceId(event.target.value);
                  setMapId(null);
                  setSelectedId(null);
                  setManualX(null);
                  setManualY(null);
                }}
              >
                {definition.worldspaces.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} · {item.kind === "PHYSICAL" ? "real" : "virtual"}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Map
              <select
                value={map.id}
                onChange={(event) => {
                  setMapId(event.target.value);
                  setSelectedId(null);
                  setManualX(null);
                  setManualY(null);
                }}
              >
                {definition.maps
                  .filter((item) => item.worldspaceId === worldspace.id)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => {
                const copy = { ...map, id: id(), name: `${map.name} detail`, role: "DETAIL" as const };
                if (
                  commit({
                    ...definition,
                    maps: [...definition.maps, copy],
                    worldspaces: definition.worldspaces.map((item) =>
                      item.id === worldspace.id
                        ? { ...item, mapDefinitionIds: [...item.mapDefinitionIds, copy.id] }
                        : item,
                    ),
                  })
                )
                  setMapId(copy.id);
              }}
            >
              Add map
            </button>
            <label>
              Preview
              <select value={preview} onChange={(event) => setPreview(event.target.value as Preview)}>
                <option value="CREATOR">Creator full</option>
                <option value="PLAYER">Player initial</option>
                <option value="CAPTAIN">Captain safe</option>
                <option value="PUBLIC">Public safe</option>
                <option value="NEARBY">Nearby</option>
                <option value="REVEALED">Revealed</option>
                <option value="COMPLETED">Completed</option>
                <option value="SKIPPED">Skipped</option>
                <option value="FAILED">Failed reading</option>
                <option value="REPLAY">Replay</option>
              </select>
            </label>
            <label className="landfall-check">
              <input
                type="checkbox"
                checked={mobilePreview}
                onChange={(event) => setMobilePreview(event.target.checked)}
              />{" "}
              Phone preview
            </label>
          </div>
          <section className="landfall-worldspace-settings" aria-label="Worldspace settings">
            <LandfallProviderPanel definition={definition} worldspace={worldspace} onChange={commit} />
            <h3>{worldspace.name} settings</h3>
            <label>
              Name
              <input
                key={worldspace.id + worldspace.name}
                defaultValue={worldspace.name}
                onBlur={(event) =>
                  updateWorldspace((item) => ({ ...item, name: event.target.value.trim() || item.name }))
                }
              />
            </label>
            <label>
              Default map
              <select
                value={worldspace.defaultMapDefinitionId}
                onChange={(event) =>
                  updateWorldspace((item) => ({ ...item, defaultMapDefinitionId: event.target.value }))
                }
              >
                {definition.maps
                  .filter((item) => item.worldspaceId === worldspace.id)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Privacy classification
              <select
                value={worldspace.privacyPolicy.classification}
                onChange={(event) =>
                  updateWorldspace((item) => ({
                    ...item,
                    privacyPolicy: {
                      ...item.privacyPolicy,
                      classification: event.target.value as typeof item.privacyPolicy.classification,
                    },
                  }))
                }
              >
                {["FICTIONAL", "GENERIC", "PUBLIC_REAL_WORLD", "APPROXIMATE_REAL_WORLD", "PRIVATE_REAL_WORLD"].map(
                  (item) => (
                    <option key={item} value={item}>
                      {item.replaceAll("_", " ").toLowerCase()}
                    </option>
                  ),
                )}
              </select>
            </label>
            <p>
              Coordinates: {worldspace.coordinateReference.type}. Raw physical fixes are never retained by this
              Worldspace.
            </p>
          </section>
          <section className="landfall-transitions" aria-label="Worldspace transitions">
            <h3>Worldspace transitions</h3>
            <p>Enter a destination when its Chapter or Passage begins. The Voyage records the change canonically.</p>
            {definition.transitions
              .filter((item) => item.fromWorldspaceId === worldspace.id)
              .map((item) => (
                <div key={item.id} className="landfall-transition-row">
                  <span>
                    To {definition.worldspaces.find((space) => space.id === item.toWorldspaceId)?.name ?? "Unknown"} ·{" "}
                    {item.trigger.type.toLowerCase()} · {item.trigger.id}
                  </span>
                  <label>
                    Arrival location
                    <select
                      value={item.initialLocationId ?? ""}
                      onChange={(event) =>
                        updateTransition(item.id, (current) => ({
                          ...current,
                          initialLocationId: event.target.value || undefined,
                        }))
                      }
                    >
                      <option value="">No initial location</option>
                      {definition.waypoints
                        .filter((waypoint) => waypoint.worldspaceId === item.toWorldspaceId)
                        .map((waypoint) => (
                          <option key={waypoint.id} value={waypoint.id}>
                            {waypoint.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    Destination offline policy
                    <select
                      value={item.destinationOfflinePolicy}
                      onChange={(event) =>
                        updateTransition(item.id, (current) => ({
                          ...current,
                          destinationOfflinePolicy: event.target
                            .value as LandfallTransition["destinationOfflinePolicy"],
                        }))
                      }
                    >
                      <option value="REQUIRE_READY">Require ready</option>
                      <option value="WARN">Warn</option>
                      <option value="ONLINE_ONLY">Online only</option>
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      commit({
                        ...definition,
                        transitions: definition.transitions.filter((candidate) => candidate.id !== item.id),
                      })
                    }
                  >
                    Remove transition
                  </button>
                </div>
              ))}
            {definition.worldspaces.length > 1 && (
              <div className="landfall-transition-row">
                <label>
                  Destination
                  <select
                    value={transitionDestination}
                    onChange={(event) => setTransitionDestination(event.target.value)}
                  >
                    <option value="">Choose Worldspace</option>
                    {definition.worldspaces
                      .filter((item) => item.id !== worldspace.id)
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Trigger type
                  <select
                    value={transitionTriggerType}
                    onChange={(event) => {
                      setTransitionTriggerType(event.target.value as typeof transitionTriggerType);
                      setTransitionTrigger("");
                    }}
                  >
                    <option value="CHAPTER">Chapter begins</option>
                    <option value="BLOCK">Passage begins</option>
                  </select>
                </label>
                <label>
                  Trigger
                  <select value={transitionTrigger} onChange={(event) => setTransitionTrigger(event.target.value)}>
                    <option value="">Choose trigger</option>
                    {transitionTriggerType === "CHAPTER"
                      ? chapterOptions.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.title}
                          </option>
                        ))
                      : chapterOptions.flatMap((item) =>
                          item.blocks.map((block) => (
                            <option key={block.id} value={block.id}>
                              {item.title} · {block.title}
                            </option>
                          )),
                        )}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    if (!transitionDestination || !transitionTrigger) {
                      setError("Choose a destination and a Chapter or Passage trigger.");
                      return;
                    }
                    const transition: LandfallTransition = {
                      id: id(),
                      fromWorldspaceId: worldspace.id,
                      toWorldspaceId: transitionDestination,
                      trigger: { type: transitionTriggerType, id: transitionTrigger },
                      presentation: "DIRECT",
                      destinationOfflinePolicy: "WARN",
                    };
                    if (commit({ ...definition, transitions: [...definition.transitions, transition] })) {
                      setTransitionDestination("");
                      setTransitionTrigger("");
                    }
                  }}
                >
                  Add transition
                </button>
              </div>
            )}
          </section>
          <div className="landfall-editor-grid">
            <div className="landfall-map-column">
              <div className="landfall-tool-row" role="group" aria-label="Chart tools">
                {(["INSPECT", "PLACE", "POLYGON", "MULTIPOLYGON", "ROUTE", "CORRIDOR", "GATE"] as const).map((item) => (
                  <button
                    key={item}
                    type="button"
                    aria-pressed={tool === item}
                    onClick={() => {
                      setTool(item);
                      setDrawingRegionId(null);
                      setPendingPoints([]);
                    }}
                  >
                    {item === "PLACE"
                      ? "Place waypoint"
                      : item === "POLYGON"
                        ? "Draw region"
                        : item === "MULTIPOLYGON"
                          ? "Add region polygon"
                          : item === "ROUTE"
                            ? "Draw route"
                            : item === "CORRIDOR"
                              ? "Draw corridor"
                              : item === "GATE"
                                ? "Draw gate"
                                : "Inspect"}
                  </button>
                ))}
                {pendingPoints.length > 0 && (
                  <>
                    <span>{pendingPoints.length} points</span>
                    <button type="button" onClick={finishDrawing}>
                      Finish shape
                    </button>
                    <button type="button" onClick={() => setPendingPoints([])}>
                      Clear points
                    </button>
                  </>
                )}
              </div>
              <div className={mobilePreview ? "landfall-mobile-preview" : "landfall-map-canvas"}>
                {scene && <LandfallMapRenderer scene={scene} interaction={interaction} />}
                {preview === "PUBLIC" && (
                  <p role="status">
                    No public Landfall map is published in Phase 2. Private geometry remains unavailable here.
                  </p>
                )}
              </div>
              {preview !== "CREATOR" && (
                <p role="status">
                  {preview === "CAPTAIN"
                    ? "Captain preview shows no exact geometry without Player consent."
                    : preview === "NEARBY"
                      ? "Nearby is a local confidence state. It does not confirm arrival."
                      : preview === "FAILED"
                        ? "A failed reading keeps the released map visible; no visit is recorded."
                        : preview === "REPLAY"
                          ? "Replay is presentation only: no sensor or progress mutation."
                          : "Projection follows canonical Worldspace, reveal, and visit events."}
                </p>
              )}
              <p role="status" className="landfall-provider-status">
                {map.source.type === "BUILTIN_VECTOR"
                  ? "Map data provider unavailable. Place locations with coordinates or the canvas; live address and place lookup needs a configured server provider."
                  : map.source.type === "BUILTIN_RASTER"
                    ? "Live OpenStreetMap tiles need a connection and are not packaged for offline use. Online place lookup needs a separately configured service; coordinates and Chronicle locations remain available."
                    : map.source.type === "ASSET_IMAGE" && !scene?.imageUrl
                      ? "Map image is unavailable. Check the selected Chronicle asset and its processed variant."
                      : "The chart uses this Chronicle’s authored map source."}
              </p>
              <div className="landfall-manual-place">
                <label>
                  {worldspace.kind === "PHYSICAL" ? "Longitude" : "Map X"}
                  <input
                    type="number"
                    step="any"
                    value={
                      manualX ??
                      (map.camera.center.type === "WGS84" ? map.camera.center.longitude : map.camera.center.x)
                    }
                    onChange={(event) => setManualX(Number(event.target.value))}
                  />
                </label>
                <label>
                  {worldspace.kind === "PHYSICAL" ? "Latitude" : "Map Y"}
                  <input
                    type="number"
                    step="any"
                    value={
                      manualY ?? (map.camera.center.type === "WGS84" ? map.camera.center.latitude : map.camera.center.y)
                    }
                    onChange={(event) => setManualY(Number(event.target.value))}
                  />
                </label>
                {drawingRegionId && (
                  <button
                    type="button"
                    onClick={() => {
                      const center = map.camera.center;
                      place(
                        manualX ?? (center.type === "WGS84" ? center.longitude : center.x),
                        manualY ?? (center.type === "WGS84" ? center.latitude : center.y),
                      );
                    }}
                  >
                    Add region point at coordinates
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    const center = map.camera.center;
                    const x = manualX ?? (center.type === "WGS84" ? center.longitude : center.x);
                    const y = manualY ?? (center.type === "WGS84" ? center.latitude : center.y);
                    setTool("PLACE");
                    const next = createLandfallWaypoint(
                      worldspace,
                      map,
                      coordinateAt(worldspace, x, y),
                      placeName || `Location ${waypoints.length + 1}`,
                    );
                    if (commit({ ...definition, waypoints: [...definition.waypoints, next] })) {
                      setSelectedId(next.id);
                      setTool("INSPECT");
                      setPlaceName("");
                    }
                  }}
                >
                  Place at coordinates
                </button>
              </div>
              <label>
                Search existing Chronicle locations
                <input
                  value={locationQuery}
                  onChange={(event) => setLocationQuery(event.target.value)}
                  placeholder="Location name"
                />
              </label>
              <label>
                Use an existing location name for the next waypoint
                <select
                  onChange={(event) => {
                    const location = locations.find((item) => item.id === event.target.value);
                    if (location) {
                      setPlaceName(location.name);
                      setTool("PLACE");
                      setError(`${location.name} has no Landfall coordinate yet. Place its waypoint on the chart.`);
                    }
                  }}
                  defaultValue=""
                >
                  <option value="">Choose existing location</option>
                  {locations
                    .filter((item) => item.name.toLowerCase().includes(locationQuery.toLowerCase()))
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                </select>
              </label>
              <LandfallOnlinePlacePanel
                taleId={taleId}
                sourceVersion={sourceVersion}
                csrfToken={csrfToken}
                worldspace={worldspace}
                unsaved={unsaved}
                onSelectPlace={(place) => {
                  setManualX(place.point.longitude);
                  setManualY(place.point.latitude);
                  setPlaceName(place.label);
                  setError(
                    "Online coordinates selected. Review them, then choose Place at coordinates to add your waypoint.",
                  );
                }}
              />
              {placeName && <p>Next waypoint name: {placeName}</p>}
            </div>
            <aside className="landfall-inspector">
              <h3>Chart objects</h3>
              <div className="landfall-object-list">
                <button type="button" aria-pressed={selectedId === map.id} onClick={() => setSelectedId(map.id)}>
                  Map · {map.name}
                </button>
                {waypoints.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    aria-pressed={selectedId === item.id}
                    onClick={() => setSelectedId(item.id)}
                  >
                    {item.visibility.hiddenUntilRevealed ? "Hidden · " : ""}
                    {item.name}
                  </button>
                ))}
                {routes.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    aria-pressed={selectedId === item.id}
                    onClick={() => setSelectedId(item.id)}
                  >
                    Route · {item.name}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!waypoints.length) return setError("Place at least one waypoint before creating a route.");
                  const route: LandfallRoute = {
                    id: id(),
                    worldspaceId: worldspace.id,
                    name: `Route ${routes.length + 1}`,
                    model: "ORDERED",
                    semantics: "STORY_ORDER_ONLY",
                    waypointIds: [waypoints[0].id],
                    travelMode: "UNSPECIFIED",
                    offRouteTolerance: 0,
                    privacyClassification: worldspace.privacyPolicy.classification,
                  };
                  if (commit({ ...definition, routes: [...definition.routes, route] })) setSelectedId(route.id);
                }}
              >
                Add route
              </button>
              {selectedMap && (
                <div className="landfall-inspector-fields">
                  <h4>Map definition</h4>
                  <label>
                    Floor or level label
                    <input
                      key={map.id + "level" + (map.level ?? "")}
                      defaultValue={map.level ?? ""}
                      maxLength={80}
                      onBlur={(event) =>
                        updateMap((item) => ({ ...item, level: event.target.value.trim() || undefined }))
                      }
                    />
                  </label>
                  <label>
                    Name
                    <input
                      key={map.id + map.name}
                      defaultValue={map.name}
                      onBlur={(event) =>
                        updateMap((item) => ({ ...item, name: event.target.value.trim() || item.name }))
                      }
                    />
                  </label>
                  <label>
                    Role
                    <select
                      value={map.role}
                      onChange={(event) =>
                        updateMap((item) => ({ ...item, role: event.target.value as LandfallMapDefinition["role"] }))
                      }
                    >
                      {["PRIMARY", "DETAIL", "OVERVIEW", "FLOOR", "ILLUSTRATIVE"].map((item) => (
                        <option key={item} value={item}>
                          {item.toLowerCase()}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Camera {worldspace.kind === "PHYSICAL" ? "longitude" : "X"}
                    <input
                      type="number"
                      step="any"
                      key={map.id + "camera-x" + JSON.stringify(map.camera.center)}
                      defaultValue={
                        map.camera.center.type === "WGS84" ? map.camera.center.longitude : map.camera.center.x
                      }
                      onBlur={(event) =>
                        updateMap((item) => ({
                          ...item,
                          camera: {
                            ...item.camera,
                            center: coordinateAt(
                              worldspace,
                              Number(event.target.value),
                              item.camera.center.type === "WGS84" ? item.camera.center.latitude : item.camera.center.y,
                            ),
                          },
                        }))
                      }
                    />
                  </label>
                  <label>
                    Camera {worldspace.kind === "PHYSICAL" ? "latitude" : "Y"}
                    <input
                      type="number"
                      step="any"
                      key={map.id + "camera-y" + JSON.stringify(map.camera.center)}
                      defaultValue={
                        map.camera.center.type === "WGS84" ? map.camera.center.latitude : map.camera.center.y
                      }
                      onBlur={(event) =>
                        updateMap((item) => ({
                          ...item,
                          camera: {
                            ...item.camera,
                            center: coordinateAt(
                              worldspace,
                              item.camera.center.type === "WGS84" ? item.camera.center.longitude : item.camera.center.x,
                              Number(event.target.value),
                            ),
                          },
                        }))
                      }
                    />
                  </label>
                  <label>
                    Zoom
                    <input
                      type="number"
                      min="0"
                      max="24"
                      step="0.25"
                      value={map.camera.zoom}
                      onChange={(event) =>
                        updateMap((item) => ({ ...item, camera: { ...item.camera, zoom: Number(event.target.value) } }))
                      }
                    />
                  </label>
                  <label>
                    Bearing
                    <input
                      type="number"
                      min="-360"
                      max="360"
                      step="1"
                      value={map.camera.bearing}
                      onChange={(event) =>
                        updateMap((item) => ({
                          ...item,
                          camera: { ...item.camera, bearing: Number(event.target.value) },
                        }))
                      }
                    />
                  </label>
                  <label>
                    Camera policy
                    <select
                      value={map.camera.policy}
                      onChange={(event) =>
                        updateMap((item) => ({
                          ...item,
                          camera: {
                            ...item.camera,
                            policy: event.target.value as LandfallMapDefinition["camera"]["policy"],
                          },
                        }))
                      }
                    >
                      {["NORTH_UP", "HEADING_UP", "ROUTE_UP", "LOCKED", "USER_CONTROLLED"].map((item) => (
                        <option key={item} value={item}>
                          {item.replaceAll("_", " ").toLowerCase()}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Privacy
                    <select
                      value={map.privacyClassification}
                      onChange={(event) =>
                        updateMap((item) => ({
                          ...item,
                          privacyClassification: event.target.value as LandfallMapDefinition["privacyClassification"],
                        }))
                      }
                    >
                      {[
                        "FICTIONAL",
                        "GENERIC",
                        "PUBLIC_REAL_WORLD",
                        "APPROXIMATE_REAL_WORLD",
                        "PRIVATE_REAL_WORLD",
                      ].map((item) => (
                        <option key={item} value={item}>
                          {item.replaceAll("_", " ").toLowerCase()}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Theme
                    <select
                      value={map.style.preset}
                      onChange={(event) =>
                        updateMap((item) =>
                          applyLandfallPreset(item, event.target.value as LandfallMapDefinition["style"]["preset"]),
                        )
                      }
                    >
                      {[
                        "PARCHMENT_CHART",
                        "NIGHT_HARBOR",
                        "FIELD_JOURNAL",
                        "MUSEUM_BLUEPRINT",
                        "SURVEYOR",
                        "MINIMAL_LIGHT",
                        "MINIMAL_DARK",
                        "CUSTOM_CHRONICLE",
                      ].map((item) => (
                        <option key={item} value={item}>
                          {item.replaceAll("_", " ").toLowerCase()}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Foreground color
                    <input
                      type="color"
                      value={map.style.foreground}
                      onChange={(event) =>
                        updateMap((item) => ({
                          ...item,
                          style: { ...item.style, foreground: event.target.value, preset: "CUSTOM_CHRONICLE" },
                        }))
                      }
                    />
                  </label>
                  <label>
                    Background color
                    <input
                      type="color"
                      value={map.style.background}
                      onChange={(event) =>
                        updateMap((item) => ({
                          ...item,
                          style: { ...item.style, background: event.target.value, preset: "CUSTOM_CHRONICLE" },
                        }))
                      }
                    />
                  </label>
                  <label>
                    Offline policy
                    <select
                      value={map.offlinePolicy}
                      onChange={(event) =>
                        updateMap((item) => ({
                          ...item,
                          offlinePolicy: event.target.value as LandfallMapDefinition["offlinePolicy"],
                        }))
                      }
                    >
                      {["ONLINE", "OFFLINE_READY", "OFFLINE_PARTIAL", "OFFLINE_UNAVAILABLE"].map((item) => (
                        <option key={item}>{item}</option>
                      ))}
                    </select>
                  </label>
                  <p>
                    Reference: {worldspace.coordinateReference.type}. Provider credentials and external style URLs are
                    never authored here.
                  </p>
                  <fieldset>
                    <legend>Attribution</legend>
                    {map.attribution.map((item, index) => (
                      <p key={item.url}>
                        <a href={item.url} rel="noreferrer">
                          {item.label}
                        </a>{" "}
                        <button
                          type="button"
                          onClick={() =>
                            updateMap((current) => ({
                              ...current,
                              attribution: current.attribution.filter((_, position) => position !== index),
                            }))
                          }
                        >
                          Remove
                        </button>
                      </p>
                    ))}
                    <label>
                      Credit
                      <input value={attributionLabel} onChange={(event) => setAttributionLabel(event.target.value)} />
                    </label>
                    <label>
                      Credit URL
                      <input
                        type="url"
                        value={attributionUrl}
                        onChange={(event) => setAttributionUrl(event.target.value)}
                        placeholder="https://…"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          attributionLabel.trim() &&
                          attributionUrl.startsWith("https://") &&
                          commit({
                            ...definition,
                            maps: definition.maps.map((item) =>
                              item.id === map.id
                                ? {
                                    ...item,
                                    attribution: [
                                      ...item.attribution,
                                      { label: attributionLabel.trim(), url: attributionUrl },
                                    ],
                                  }
                                : item,
                            ),
                          })
                        ) {
                          setAttributionLabel("");
                          setAttributionUrl("");
                        } else setError("Add a credit and a secure HTTPS attribution URL.");
                      }}
                    >
                      Add attribution
                    </button>
                  </fieldset>
                  {worldspace.kind === "PHYSICAL" && map.renderer === "MAPLIBRE_STYLE" && (
                    <fieldset>
                      <legend>Georeferenced image overlays</legend>
                      <p>
                        Use an image already in this Chronicle. Enter WGS84 west, south, east, and north bounds to align
                        it. The image stays in the authorized media system.
                      </p>
                      {(map.overlays ?? []).map((overlay) => (
                        <div key={overlay.id} className="landfall-overlay-row">
                          <strong>
                            {assets.find((asset) => asset.id === overlay.assetId)?.displayName ?? "Unavailable image"}
                          </strong>
                          <label>
                            Opacity
                            <input
                              type="range"
                              min="0"
                              max="1"
                              step="0.05"
                              value={overlay.opacity}
                              onChange={(event) =>
                                updateMap((item) => ({
                                  ...item,
                                  overlays: item.overlays?.map((candidate) =>
                                    candidate.id === overlay.id
                                      ? { ...candidate, opacity: Number(event.target.value) }
                                      : candidate,
                                  ),
                                }))
                              }
                            />
                          </label>
                          <label className="landfall-check">
                            <input
                              type="checkbox"
                              checked={Boolean(overlay.hiddenUntilRevealed)}
                              onChange={(event) =>
                                updateMap((item) => ({
                                  ...item,
                                  overlays: item.overlays?.map((candidate) =>
                                    candidate.id === overlay.id
                                      ? { ...candidate, hiddenUntilRevealed: event.target.checked }
                                      : candidate,
                                  ),
                                }))
                              }
                            />
                            Hidden until a Location Reveal Passage
                          </label>
                          {(["west", "south", "east", "north"] as const).map((edge) => (
                            <label key={edge}>
                              {edge}
                              <input
                                type="number"
                                step="any"
                                key={`${overlay.id}-${edge}-${overlay.bounds[edge]}`}
                                defaultValue={overlay.bounds[edge]}
                                onBlur={(event) =>
                                  updateMap((item) => ({
                                    ...item,
                                    overlays: item.overlays?.map((candidate) =>
                                      candidate.id === overlay.id
                                        ? {
                                            ...candidate,
                                            bounds: { ...candidate.bounds, [edge]: Number(event.target.value) },
                                          }
                                        : candidate,
                                    ),
                                  }))
                                }
                              />
                            </label>
                          ))}
                          <a href={overlay.attributionUrl} rel="noreferrer">
                            {overlay.attributionLabel}
                          </a>
                          <button
                            type="button"
                            onClick={() =>
                              updateMap((item) => ({
                                ...item,
                                overlays: item.overlays?.filter((candidate) => candidate.id !== overlay.id),
                              }))
                            }
                          >
                            Remove overlay
                          </button>
                        </div>
                      ))}
                      <label>
                        Image
                        <select value={overlayAssetId} onChange={(event) => setOverlayAssetId(event.target.value)}>
                          <option value="">Choose Chronicle image</option>
                          {assets
                            .filter((asset) => asset.mimeType.startsWith("image/"))
                            .map((asset) => (
                              <option key={asset.id} value={asset.id}>
                                {asset.displayName}
                              </option>
                            ))}
                        </select>
                      </label>
                      {(["west", "south", "east", "north"] as const).map((edge) => (
                        <label key={edge}>
                          {edge}
                          <input
                            type="number"
                            step="any"
                            value={
                              overlayBounds?.[edge] ??
                              (map.camera.center.type === "WGS84"
                                ? edge === "west"
                                  ? map.camera.center.longitude - 0.01
                                  : edge === "east"
                                    ? map.camera.center.longitude + 0.01
                                    : edge === "south"
                                      ? map.camera.center.latitude - 0.01
                                      : map.camera.center.latitude + 0.01
                                : 0)
                            }
                            onChange={(event) =>
                              setOverlayBounds((current) => ({
                                west:
                                  current?.west ??
                                  (map.camera.center.type === "WGS84" ? map.camera.center.longitude - 0.01 : 0),
                                south:
                                  current?.south ??
                                  (map.camera.center.type === "WGS84" ? map.camera.center.latitude - 0.01 : 0),
                                east:
                                  current?.east ??
                                  (map.camera.center.type === "WGS84" ? map.camera.center.longitude + 0.01 : 0),
                                north:
                                  current?.north ??
                                  (map.camera.center.type === "WGS84" ? map.camera.center.latitude + 0.01 : 0),
                                [edge]: Number(event.target.value),
                              }))
                            }
                          />
                        </label>
                      ))}
                      <label>
                        Image credit
                        <input value={overlayLabel} onChange={(event) => setOverlayLabel(event.target.value)} />
                      </label>
                      <label>
                        Credit URL
                        <input
                          type="url"
                          value={overlayUrl}
                          onChange={(event) => setOverlayUrl(event.target.value)}
                          placeholder="https://…"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          if (!overlayAssetId || !overlayLabel.trim() || !overlayUrl.startsWith("https://")) {
                            setError("Choose an image and supply its credit with a secure HTTPS URL.");
                            return;
                          }
                          const center = map.camera.center;
                          const bounds = overlayBounds ?? {
                            west: center.type === "WGS84" ? center.longitude - 0.01 : 0,
                            south: center.type === "WGS84" ? center.latitude - 0.01 : 0,
                            east: center.type === "WGS84" ? center.longitude + 0.01 : 0,
                            north: center.type === "WGS84" ? center.latitude + 0.01 : 0,
                          };
                          if (
                            commit({
                              ...definition,
                              maps: definition.maps.map((item) =>
                                item.id === map.id
                                  ? {
                                      ...item,
                                      overlays: [
                                        ...(item.overlays ?? []),
                                        {
                                          id: id(),
                                          assetId: overlayAssetId,
                                          bounds,
                                          opacity: 0.8,
                                          attributionLabel: overlayLabel.trim(),
                                          attributionUrl: overlayUrl,
                                          privacyClassification: item.privacyClassification,
                                        },
                                      ],
                                    }
                                  : item,
                              ),
                            })
                          ) {
                            setOverlayAssetId("");
                            setOverlayLabel("");
                            setOverlayUrl("");
                            setOverlayBounds(null);
                          }
                        }}
                      >
                        Add image overlay
                      </button>
                    </fieldset>
                  )}
                </div>
              )}
              {selectedWaypoint && (
                <div className="landfall-inspector-fields">
                  <h4>Waypoint</h4>
                  {worldspace.kind === "PHYSICAL" && (
                    <LandfallInstallationPanel
                      taleId={taleId}
                      waypoint={selectedWaypoint}
                      csrfToken={csrfToken}
                      unsaved={unsaved}
                      onChange={(installations) =>
                        updateWaypoint((item) => ({
                          ...item,
                          installations: installations.length ? installations : undefined,
                        }))
                      }
                    />
                  )}
                  <label>
                    Name
                    <input
                      key={selectedWaypoint.id + selectedWaypoint.name}
                      defaultValue={selectedWaypoint.name}
                      onBlur={(event) =>
                        updateWaypoint((item) => ({ ...item, name: event.target.value.trim() || item.name }))
                      }
                    />
                  </label>
                  <label>
                    Player label
                    <input
                      key={selectedWaypoint.id + selectedWaypoint.visibility.publicLabel}
                      defaultValue={selectedWaypoint.visibility.publicLabel ?? ""}
                      onBlur={(event) =>
                        updateWaypoint((item) => ({
                          ...item,
                          visibility: { ...item.visibility, publicLabel: event.target.value.trim() || undefined },
                        }))
                      }
                    />
                  </label>
                  <label>
                    Description
                    <textarea
                      key={selectedWaypoint.id + selectedWaypoint.description}
                      defaultValue={selectedWaypoint.description ?? ""}
                      maxLength={1000}
                      onBlur={(event) =>
                        updateWaypoint((item) => ({ ...item, description: event.target.value.trim() || undefined }))
                      }
                    />
                  </label>
                  <label>
                    Marker icon
                    <select
                      value={selectedWaypoint.icon ?? "PIN"}
                      onChange={(event) =>
                        updateWaypoint((item) => ({ ...item, icon: event.target.value as LandfallWaypoint["icon"] }))
                      }
                    >
                      {["PIN", "FLAG", "STAR", "COMPASS", "DOOR", "CLUE"].map((icon) => (
                        <option key={icon}>{icon}</option>
                      ))}
                    </select>
                  </label>
                  <fieldset>
                    <legend>Player guidance</legend>
                    {(["clue", "nearbyClue", "wrongDirectionClue"] as const).map((key) => (
                      <label key={key}>
                        {key === "clue" ? "Text clue" : key === "nearbyClue" ? "Nearby clue" : "Wrong-direction clue"}
                        <textarea
                          key={`${selectedWaypoint.id}-${key}-${selectedWaypoint.guidance?.[key] ?? ""}`}
                          defaultValue={selectedWaypoint.guidance?.[key] ?? ""}
                          maxLength={500}
                          onBlur={(event) =>
                            updateWaypoint((item) => ({
                              ...item,
                              guidance: {
                                showDistance: item.guidance?.showDistance ?? false,
                                showBearing: item.guidance?.showBearing ?? false,
                                ...item.guidance,
                                [key]: event.target.value.trim() || undefined,
                              },
                            }))
                          }
                        />
                      </label>
                    ))}
                    {worldspace.kind === "PHYSICAL" &&
                      selectedWaypoint.geometry.type !== "APPROXIMATE_REGION" &&
                      (["showDistance", "showBearing"] as const).map((key) => (
                        <label key={key} className="landfall-check">
                          <input
                            type="checkbox"
                            checked={selectedWaypoint.guidance?.[key] ?? false}
                            onChange={(event) =>
                              updateWaypoint((item) => ({
                                ...item,
                                guidance: {
                                  ...item.guidance,
                                  showDistance: item.guidance?.showDistance ?? false,
                                  showBearing: item.guidance?.showBearing ?? false,
                                  [key]: event.target.checked,
                                },
                              }))
                            }
                          />
                          {key === "showDistance" ? "Show approximate distance" : "Show rough bearing"}
                        </label>
                      ))}
                  </fieldset>
                  <label>
                    Type
                    <select
                      value={selectedWaypoint.type}
                      onChange={(event) =>
                        updateWaypoint((item) => ({ ...item, type: event.target.value as LandfallWaypoint["type"] }))
                      }
                    >
                      {[
                        "ARRIVAL_POINT",
                        "SEARCH_REGION",
                        "DWELL_ZONE",
                        "SEQUENCE_WAYPOINT",
                        "OPTIONAL_DISCOVERY",
                        "HIDDEN_WAYPOINT",
                      ].map((item) => (
                        <option key={item}>{item}</option>
                      ))}
                    </select>
                  </label>
                  {(selectedWaypoint.geometry.type === "POINT_RADIUS" ||
                    selectedWaypoint.geometry.type === "APPROXIMATE_REGION") && (
                    <label>
                      Radius in {worldspace.kind === "PHYSICAL" ? "meters" : "map units"}
                      <input
                        type="number"
                        min="0.01"
                        step="any"
                        key={selectedWaypoint.id + selectedWaypoint.geometry.radius}
                        defaultValue={selectedWaypoint.geometry.radius}
                        onBlur={(event) =>
                          updateWaypoint((item) =>
                            item.geometry.type === "POINT_RADIUS" || item.geometry.type === "APPROXIMATE_REGION"
                              ? { ...item, geometry: { ...item.geometry, radius: Number(event.target.value) } }
                              : item,
                          )
                        }
                      />
                    </label>
                  )}
                  {selectedWaypoint.geometry.type === "POINT_RADIUS" && (
                    <button
                      type="button"
                      onClick={() =>
                        updateWaypoint((item) =>
                          item.geometry.type === "POINT_RADIUS"
                            ? {
                                ...item,
                                geometry: {
                                  type: "APPROXIMATE_REGION",
                                  center: item.geometry.center,
                                  radius: item.geometry.radius,
                                  publicRadius: item.geometry.radius * 2,
                                },
                              }
                            : item,
                        )
                      }
                    >
                      Hide exact center with approximate region
                    </button>
                  )}
                  {selectedWaypoint.geometry.type === "APPROXIMATE_REGION" && (
                    <>
                      <label>
                        Public radius
                        <input
                          type="number"
                          min="0.01"
                          step="any"
                          key={selectedWaypoint.id + selectedWaypoint.geometry.publicRadius}
                          defaultValue={selectedWaypoint.geometry.publicRadius}
                          onBlur={(event) =>
                            updateWaypoint((item) =>
                              item.geometry.type === "APPROXIMATE_REGION"
                                ? { ...item, geometry: { ...item.geometry, publicRadius: Number(event.target.value) } }
                                : item,
                            )
                          }
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          updateWaypoint((item) =>
                            item.geometry.type === "APPROXIMATE_REGION"
                              ? {
                                  ...item,
                                  geometry: {
                                    type: "POINT_RADIUS",
                                    center: item.geometry.center,
                                    radius: item.geometry.radius,
                                  },
                                }
                              : item,
                          )
                        }
                      >
                        Show point center
                      </button>
                    </>
                  )}
                  {(selectedWaypoint.geometry.type === "POINT_RADIUS" ||
                    selectedWaypoint.geometry.type === "APPROXIMATE_REGION") && (
                    <>
                      <label>
                        {worldspace.kind === "PHYSICAL" ? "Longitude" : "X"}
                        <input
                          type="number"
                          step="any"
                          key={`${selectedWaypoint.id}-x-${JSON.stringify(selectedWaypoint.geometry.center)}`}
                          defaultValue={
                            selectedWaypoint.geometry.center.type === "WGS84"
                              ? selectedWaypoint.geometry.center.longitude
                              : selectedWaypoint.geometry.center.x
                          }
                          onBlur={(event) =>
                            updateWaypoint((item) =>
                              item.geometry.type === "POINT_RADIUS" || item.geometry.type === "APPROXIMATE_REGION"
                                ? {
                                    ...item,
                                    geometry: {
                                      ...item.geometry,
                                      center: coordinateAt(
                                        worldspace,
                                        Number(event.target.value),
                                        item.geometry.center.type === "WGS84"
                                          ? item.geometry.center.latitude
                                          : item.geometry.center.y,
                                      ),
                                    },
                                  }
                                : item,
                            )
                          }
                        />
                      </label>
                      <label>
                        {worldspace.kind === "PHYSICAL" ? "Latitude" : "Y"}
                        <input
                          type="number"
                          step="any"
                          key={`${selectedWaypoint.id}-y-${JSON.stringify(selectedWaypoint.geometry.center)}`}
                          defaultValue={
                            selectedWaypoint.geometry.center.type === "WGS84"
                              ? selectedWaypoint.geometry.center.latitude
                              : selectedWaypoint.geometry.center.y
                          }
                          onBlur={(event) =>
                            updateWaypoint((item) =>
                              item.geometry.type === "POINT_RADIUS" || item.geometry.type === "APPROXIMATE_REGION"
                                ? {
                                    ...item,
                                    geometry: {
                                      ...item.geometry,
                                      center: coordinateAt(
                                        worldspace,
                                        item.geometry.center.type === "WGS84"
                                          ? item.geometry.center.longitude
                                          : item.geometry.center.x,
                                        Number(event.target.value),
                                      ),
                                    },
                                  }
                                : item,
                            )
                          }
                        />
                      </label>
                    </>
                  )}
                  {selectedWaypoint.geometry.type === "ENTRANCE_GATE" && (
                    <label>
                      Gate direction
                      <select
                        value={selectedWaypoint.geometry.direction}
                        onChange={(event) =>
                          updateWaypoint((item) =>
                            item.geometry.type === "ENTRANCE_GATE"
                              ? {
                                  ...item,
                                  geometry: {
                                    ...item.geometry,
                                    direction: event.target.value as typeof item.geometry.direction,
                                  },
                                }
                              : item,
                          )
                        }
                      >
                        <option value="EITHER">Either direction</option>
                        <option value="LEFT_TO_RIGHT">Left to right</option>
                        <option value="RIGHT_TO_LEFT">Right to left</option>
                      </select>
                    </label>
                  )}
                  <label>
                    Map
                    <select
                      value={selectedWaypoint.mapId}
                      onChange={(event) => updateWaypoint((item) => ({ ...item, mapId: event.target.value }))}
                    >
                      {definition.maps
                        .filter((item) => item.worldspaceId === worldspace.id)
                        .map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    Precision profile
                    <select
                      value={selectedWaypoint.evidenceProfile.precisionProfile}
                      onChange={(event) =>
                        updateWaypoint((item) => ({
                          ...item,
                          evidenceProfile: {
                            ...item.evidenceProfile,
                            precisionProfile: event.target
                              .value as LandfallWaypoint["evidenceProfile"]["precisionProfile"],
                          },
                        }))
                      }
                    >
                      {(worldspace.kind === "PHYSICAL"
                        ? ["BROAD_ARRIVAL", "OUTDOOR_WAYPOINT", "CLOSE_SEARCH", "INDOOR_REGION", "EXACT_OBJECT"]
                        : ["VIRTUAL_CONTEXT"]
                      ).map((item) => (
                        <option key={item} value={item}>
                          {item.replaceAll("_", " ").toLowerCase()}
                        </option>
                      ))}
                    </select>
                  </label>
                  <fieldset>
                    <legend>Accepted evidence sources</legend>
                    {worldspace.observationPolicy.allowedSources.map((source) => (
                      <label key={source} className="landfall-check">
                        <input
                          type="checkbox"
                          checked={selectedWaypoint.evidenceProfile.acceptedSources.includes(source)}
                          onChange={(event) =>
                            updateWaypoint((item) => ({
                              ...item,
                              evidenceProfile: {
                                ...item.evidenceProfile,
                                acceptedSources: event.target.checked
                                  ? [...item.evidenceProfile.acceptedSources, source]
                                  : item.evidenceProfile.acceptedSources.filter((candidate) => candidate !== source),
                              },
                            }))
                          }
                        />
                        {source.replaceAll("_", " ").toLowerCase()}
                      </label>
                    ))}
                  </fieldset>
                  <label>
                    Independent evidence sources
                    <select
                      value={selectedWaypoint.evidenceProfile.fusionPolicy?.minimumIndependentSources ?? 0}
                      onChange={(event) =>
                        updateWaypoint((item) => ({
                          ...item,
                          evidenceProfile: {
                            ...item.evidenceProfile,
                            fusionPolicy: Number(event.target.value)
                              ? { version: 1, minimumIndependentSources: Number(event.target.value) }
                              : undefined,
                          },
                        }))
                      }
                    >
                      <option value="0">Existing reading policy</option>
                      {[1, 2, 3, 4].map((count) => (
                        <option
                          key={count}
                          value={count}
                          disabled={
                            count >
                            new Set(
                              selectedWaypoint.evidenceProfile.acceptedSources.filter(
                                (source) => source !== "STORY_PROGRESSION",
                              ),
                            ).size
                          }
                        >
                          {count} independent {count === 1 ? "source" : "sources"}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p>
                    {landfallSourceCapabilities(definition, selectedWaypoint).description} Repeated readings and
                    contextual priors do not count as separate sources. Conflicting evidence remains uncertain; the
                    configured fallback remains available. Watchglass visual verification requires a separately
                    certified provider.
                  </p>
                  <label>
                    Required readings
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={selectedWaypoint.evidenceProfile.requiredSamples}
                      onChange={(event) =>
                        updateWaypoint((item) => ({
                          ...item,
                          evidenceProfile: { ...item.evidenceProfile, requiredSamples: Number(event.target.value) },
                        }))
                      }
                    />
                  </label>
                  <label>
                    Dwell seconds
                    <input
                      type="number"
                      min="0"
                      max="3600"
                      value={selectedWaypoint.evidenceProfile.dwellSeconds}
                      onChange={(event) =>
                        updateWaypoint((item) => ({
                          ...item,
                          evidenceProfile: { ...item.evidenceProfile, dwellSeconds: Number(event.target.value) },
                        }))
                      }
                    />
                  </label>
                  <label>
                    Maximum sample age, seconds
                    <input
                      type="number"
                      min="1"
                      max="3600"
                      value={selectedWaypoint.evidenceProfile.maximumAgeSeconds}
                      onChange={(event) =>
                        updateWaypoint((item) => ({
                          ...item,
                          evidenceProfile: { ...item.evidenceProfile, maximumAgeSeconds: Number(event.target.value) },
                        }))
                      }
                    />
                  </label>
                  <label>
                    Minimum corroboration
                    <input
                      type="number"
                      min="1"
                      max="4"
                      value={selectedWaypoint.evidenceProfile.minimumCorroboration}
                      onChange={(event) =>
                        updateWaypoint((item) => ({
                          ...item,
                          evidenceProfile: {
                            ...item.evidenceProfile,
                            minimumCorroboration: Number(event.target.value),
                          },
                        }))
                      }
                    />
                  </label>
                  <label>
                    Required outcome
                    <select
                      value={selectedWaypoint.completion.requiredOutcome}
                      onChange={(event) =>
                        updateWaypoint((item) => ({
                          ...item,
                          completion: {
                            ...item.completion,
                            requiredOutcome: event.target.value as LandfallWaypoint["completion"]["requiredOutcome"],
                          },
                        }))
                      }
                    >
                      <option value="NEARBY">Nearby</option>
                      <option value="LIKELY_INSIDE">Likely inside</option>
                      <option value="CONFIRMED">Confirmed</option>
                    </select>
                  </label>
                  <label>
                    Completion mode
                    <select
                      value={selectedWaypoint.completion.mode}
                      onChange={(event) =>
                        updateWaypoint((item) => ({
                          ...item,
                          completion: {
                            ...item.completion,
                            mode: event.target.value as LandfallWaypoint["completion"]["mode"],
                          },
                        }))
                      }
                    >
                      <option value="OBSERVED">Observed</option>
                      <option value="STORY_ORDER_ONLY">Story order only</option>
                    </select>
                  </label>
                  <label className="landfall-check">
                    <input
                      type="checkbox"
                      checked={selectedWaypoint.visibility.hiddenUntilRevealed}
                      onChange={(event) =>
                        updateWaypoint((item) => ({
                          ...item,
                          visibility: { ...item.visibility, hiddenUntilRevealed: event.target.checked },
                        }))
                      }
                    />{" "}
                    Hidden until reveal
                  </label>
                  <label className="landfall-check">
                    <input
                      type="checkbox"
                      checked={selectedWaypoint.sequence.optional}
                      onChange={(event) =>
                        updateWaypoint((item) => ({
                          ...item,
                          sequence: { ...item.sequence, optional: event.target.checked },
                        }))
                      }
                    />{" "}
                    Optional discovery
                  </label>
                  <fieldset>
                    <legend>Available after</legend>
                    {waypoints
                      .filter((item) => item.id !== selectedWaypoint.id)
                      .map((item) => (
                        <label key={item.id} className="landfall-check">
                          <input
                            type="checkbox"
                            checked={selectedWaypoint.sequence.afterWaypointIds.includes(item.id)}
                            onChange={(event) =>
                              updateWaypoint((current) => ({
                                ...current,
                                sequence: {
                                  ...current.sequence,
                                  afterWaypointIds: event.target.checked
                                    ? [...current.sequence.afterWaypointIds, item.id]
                                    : current.sequence.afterWaypointIds.filter((candidate) => candidate !== item.id),
                                },
                              }))
                            }
                          />
                          {item.name}
                        </label>
                      ))}
                  </fieldset>
                  <label>
                    Fallback
                    <select
                      value={selectedWaypoint.fallback.mode}
                      onChange={(event) => {
                        const mode = event.target.value as LandfallWaypoint["fallback"]["mode"];
                        const alternateWaypointId = waypoints.find((item) => item.id !== selectedWaypoint.id)?.id;
                        if (mode === "ALTERNATE_WAYPOINT" && !alternateWaypointId) {
                          setError("Add another waypoint before choosing an alternate fallback.");
                          return;
                        }
                        updateWaypoint((item) => ({
                          ...item,
                          fallback: mode === "ALTERNATE_WAYPOINT" ? { mode, alternateWaypointId } : { mode },
                        }));
                      }}
                    >
                      {["PLAYER", "CAPTAIN", "ALTERNATE_WAYPOINT", "NONE"].map((item) => (
                        <option key={item}>{item}</option>
                      ))}
                    </select>
                  </label>
                  {selectedWaypoint.fallback.mode === "ALTERNATE_WAYPOINT" && (
                    <label>
                      Alternate waypoint
                      <select
                        value={selectedWaypoint.fallback.alternateWaypointId ?? ""}
                        onChange={(event) =>
                          updateWaypoint((item) => ({
                            ...item,
                            fallback: { mode: "ALTERNATE_WAYPOINT", alternateWaypointId: event.target.value },
                          }))
                        }
                      >
                        <option value="">Choose location</option>
                        {waypoints
                          .filter((item) => item.id !== selectedWaypoint.id)
                          .map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                            </option>
                          ))}
                      </select>
                    </label>
                  )}
                  <label className="landfall-check">
                    <input
                      type="checkbox"
                      checked={selectedWaypoint.evidenceProfile.allowManualFallback}
                      onChange={(event) =>
                        updateWaypoint((item) => ({
                          ...item,
                          evidenceProfile: { ...item.evidenceProfile, allowManualFallback: event.target.checked },
                        }))
                      }
                    />{" "}
                    Allow Player manual fallback
                  </label>
                  <label className="landfall-check">
                    <input
                      type="checkbox"
                      checked={selectedWaypoint.evidenceProfile.allowCaptainOverride}
                      onChange={(event) =>
                        updateWaypoint((item) => ({
                          ...item,
                          evidenceProfile: { ...item.evidenceProfile, allowCaptainOverride: event.target.checked },
                        }))
                      }
                    />{" "}
                    Allow Captain arrival override
                  </label>
                  <label>
                    Privacy
                    <select
                      value={selectedWaypoint.privacyClassification}
                      onChange={(event) =>
                        updateWaypoint((item) => ({
                          ...item,
                          privacyClassification: event.target.value as LandfallWaypoint["privacyClassification"],
                        }))
                      }
                    >
                      {[
                        "FICTIONAL",
                        "GENERIC",
                        "PUBLIC_REAL_WORLD",
                        "APPROXIMATE_REAL_WORLD",
                        "PRIVATE_REAL_WORLD",
                      ].map((item) => (
                        <option key={item}>{item}</option>
                      ))}
                    </select>
                  </label>
                  {worldspace.kind === "PHYSICAL" && (
                    <label>
                      Required accuracy, meters
                      <input
                        type="number"
                        min="1"
                        step="any"
                        key={selectedWaypoint.id + selectedWaypoint.evidenceProfile.requiredAccuracyMeters}
                        defaultValue={selectedWaypoint.evidenceProfile.requiredAccuracyMeters ?? 50}
                        onBlur={(event) =>
                          updateWaypoint((item) => ({
                            ...item,
                            evidenceProfile: {
                              ...item.evidenceProfile,
                              requiredAccuracyMeters: Number(event.target.value),
                            },
                          }))
                        }
                      />
                    </label>
                  )}
                  {worldspace.kind === "PHYSICAL" && (
                    <>
                      <label>
                        Maximum travel speed, m/s
                        <input
                          type="number"
                          min="0.1"
                          max="100"
                          step="any"
                          key={selectedWaypoint.id + selectedWaypoint.evidenceProfile.maximumSpeedMetersPerSecond}
                          defaultValue={selectedWaypoint.evidenceProfile.maximumSpeedMetersPerSecond ?? 45}
                          onBlur={(event) =>
                            updateWaypoint((item) => ({
                              ...item,
                              evidenceProfile: {
                                ...item.evidenceProfile,
                                maximumSpeedMetersPerSecond: Number(event.target.value),
                              },
                            }))
                          }
                        />
                      </label>
                      <label>
                        Enter hysteresis, meters
                        <input
                          type="number"
                          min="0"
                          max="1000"
                          step="any"
                          key={selectedWaypoint.id + selectedWaypoint.evidenceProfile.enterHysteresis}
                          defaultValue={selectedWaypoint.evidenceProfile.enterHysteresis}
                          onBlur={(event) =>
                            updateWaypoint((item) => ({
                              ...item,
                              evidenceProfile: { ...item.evidenceProfile, enterHysteresis: Number(event.target.value) },
                            }))
                          }
                        />
                      </label>
                      <label>
                        Exit hysteresis, meters
                        <input
                          type="number"
                          min="0"
                          max="1000"
                          step="any"
                          key={selectedWaypoint.id + selectedWaypoint.evidenceProfile.exitHysteresis}
                          defaultValue={selectedWaypoint.evidenceProfile.exitHysteresis}
                          onBlur={(event) =>
                            updateWaypoint((item) => ({
                              ...item,
                              evidenceProfile: { ...item.evidenceProfile, exitHysteresis: Number(event.target.value) },
                            }))
                          }
                        />
                      </label>
                    </>
                  )}
                  <fieldset>
                    <legend>Safety notes</legend>
                    {(["daylightOnly", "weatherSensitive", "accessibilityLimited", "captainSupervised"] as const).map(
                      (key) => (
                        <label key={key} className="landfall-check">
                          <input
                            type="checkbox"
                            checked={selectedWaypoint.safety[key]}
                            onChange={(event) =>
                              updateWaypoint((item) => ({
                                ...item,
                                safety: { ...item.safety, [key]: event.target.checked },
                              }))
                            }
                          />
                          {key.replace(/([A-Z])/g, " $1").toLowerCase()}
                        </label>
                      ),
                    )}
                  </fieldset>
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        commit({
                          ...definition,
                          waypoints: definition.waypoints.filter((item) => item.id !== selectedWaypoint.id),
                          ...(definition.context
                            ? {
                                context: {
                                  ...definition.context,
                                  landmarks: definition.context.landmarks.filter(
                                    (item) => item.waypointId !== selectedWaypoint.id,
                                  ),
                                },
                              }
                            : {}),
                          routes: definition.routes
                            .map((item) => ({
                              ...item,
                              waypointIds: item.waypointIds.filter((waypointId) => waypointId !== selectedWaypoint.id),
                            }))
                            .filter((item) => item.waypointIds.length > 0),
                        })
                      )
                        setSelectedId(null);
                    }}
                  >
                    Delete waypoint
                  </button>
                </div>
              )}
              {selectedRoute && (
                <div className="landfall-inspector-fields">
                  <h4>Route</h4>
                  <label>
                    Name
                    <input
                      key={selectedRoute.id + selectedRoute.name}
                      defaultValue={selectedRoute.name}
                      onBlur={(event) =>
                        updateRoute((item) => ({ ...item, name: event.target.value.trim() || item.name }))
                      }
                    />
                  </label>
                  <label>
                    Model
                    <select
                      value={selectedRoute.model}
                      onChange={(event) =>
                        updateRoute((item) => ({ ...item, model: event.target.value as LandfallRoute["model"] }))
                      }
                    >
                      {[
                        "ORDERED",
                        "FLEXIBLE",
                        "BRANCHING",
                        "LOOP",
                        "GUIDED_CORRIDOR",
                        "HIDDEN",
                        "APPROXIMATE",
                        "CAPTAIN_DIRECTED",
                      ].map((item) => (
                        <option key={item}>{item}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Semantics
                    <select
                      value={selectedRoute.semantics}
                      onChange={(event) =>
                        updateRoute((item) => ({
                          ...item,
                          semantics: event.target.value as LandfallRoute["semantics"],
                        }))
                      }
                    >
                      {["NAVIGATIONAL", "ILLUSTRATIVE", "STORY_ORDER_ONLY"].map((item) => (
                        <option key={item}>{item}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Travel mode
                    <select
                      value={selectedRoute.travelMode}
                      onChange={(event) =>
                        updateRoute((item) => ({
                          ...item,
                          travelMode: event.target.value as LandfallRoute["travelMode"],
                        }))
                      }
                    >
                      {["WALKING", "CYCLING", "VEHICLE", "BOAT", "INDOOR", "MIXED", "UNSPECIFIED"].map((item) => (
                        <option key={item}>{item}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Off-route tolerance in {worldspace.kind === "PHYSICAL" ? "meters" : "map units"}
                    <input
                      type="number"
                      min="0"
                      max="10000"
                      step="any"
                      key={selectedRoute.id + selectedRoute.offRouteTolerance}
                      defaultValue={selectedRoute.offRouteTolerance}
                      onBlur={(event) =>
                        updateRoute((item) => ({ ...item, offRouteTolerance: Number(event.target.value) }))
                      }
                    />
                  </label>
                  <label>
                    Player route visibility
                    <select
                      value={selectedRoute.presentation?.visibility ?? "FULL"}
                      onChange={(event) =>
                        updateRoute((item) => ({
                          ...item,
                          presentation: {
                            visibility: event.target.value as NonNullable<LandfallRoute["presentation"]>["visibility"],
                            revealOnSelection: item.presentation?.revealOnSelection ?? true,
                            deviationResponse: item.presentation?.deviationResponse ?? "GUIDANCE",
                          },
                        }))
                      }
                    >
                      <option value="FULL">Full route</option>
                      <option value="NEXT_SEGMENT">Next segment</option>
                      <option value="ROUGH_BEARING">Rough bearing only</option>
                      <option value="HIDDEN">Hidden until revealed</option>
                    </select>
                  </label>
                  <label className="landfall-check">
                    <input
                      type="checkbox"
                      checked={selectedRoute.presentation?.revealOnSelection ?? true}
                      onChange={(event) =>
                        updateRoute((item) => ({
                          ...item,
                          presentation: {
                            visibility: item.presentation?.visibility ?? "FULL",
                            revealOnSelection: event.target.checked,
                            deviationResponse: item.presentation?.deviationResponse ?? "GUIDANCE",
                          },
                        }))
                      }
                    />
                    Reveal route when selected in a Chronicle
                  </label>
                  <label>
                    Off-route response
                    <select
                      value={selectedRoute.presentation?.deviationResponse ?? "GUIDANCE"}
                      onChange={(event) =>
                        updateRoute((item) => ({
                          ...item,
                          presentation: {
                            visibility: item.presentation?.visibility ?? "FULL",
                            revealOnSelection: item.presentation?.revealOnSelection ?? true,
                            deviationResponse: event.target.value as NonNullable<
                              LandfallRoute["presentation"]
                            >["deviationResponse"],
                          },
                        }))
                      }
                    >
                      <option value="GUIDANCE">Gentle guidance</option>
                      <option value="WARNING">Clear warning</option>
                      <option value="CAPTAIN_REVIEW">Captain review</option>
                      <option value="NONE">No response</option>
                    </select>
                  </label>
                  {selectedRoute.geometry?.type === "CORRIDOR" && (
                    <label>
                      Corridor width
                      <input
                        type="number"
                        min="0.01"
                        max="100000"
                        step="any"
                        key={selectedRoute.id + selectedRoute.geometry.width}
                        defaultValue={selectedRoute.geometry.width}
                        onBlur={(event) =>
                          updateRoute((item) =>
                            item.geometry?.type === "CORRIDOR"
                              ? { ...item, geometry: { ...item.geometry, width: Number(event.target.value) } }
                              : item,
                          )
                        }
                      />
                    </label>
                  )}
                  <label>
                    Privacy
                    <select
                      value={selectedRoute.privacyClassification}
                      onChange={(event) =>
                        updateRoute((item) => ({
                          ...item,
                          privacyClassification: event.target.value as LandfallRoute["privacyClassification"],
                        }))
                      }
                    >
                      {[
                        "FICTIONAL",
                        "GENERIC",
                        "PUBLIC_REAL_WORLD",
                        "APPROXIMATE_REAL_WORLD",
                        "PRIVATE_REAL_WORLD",
                      ].map((item) => (
                        <option key={item}>{item}</option>
                      ))}
                    </select>
                  </label>
                  {routeLength !== null && (
                    <p>
                      Drawn path: {Math.round(routeLength)} {worldspace.kind === "PHYSICAL" ? "meters" : "map units"}.
                      {worldspace.kind === "PHYSICAL" && selectedRoute.travelMode === "WALKING"
                        ? ` Walking estimate at 1.3 m/s: ${Math.max(1, Math.round(routeLength / 78))} minutes.`
                        : ""}
                    </p>
                  )}
                  <fieldset>
                    <legend>Route locations</legend>
                    {waypoints.map((item) => (
                      <label key={item.id} className="landfall-check">
                        <input
                          type="checkbox"
                          checked={selectedRoute.waypointIds.includes(item.id)}
                          onChange={(event) =>
                            updateRoute((route) => ({
                              ...route,
                              waypointIds: event.target.checked
                                ? [...route.waypointIds, item.id]
                                : route.waypointIds.filter((id) => id !== item.id),
                            }))
                          }
                        />
                        {item.name}
                      </label>
                    ))}
                  </fieldset>
                  <ol aria-label="Route order">
                    {selectedRoute.waypointIds.map((waypointId, index) => (
                      <li key={waypointId}>
                        {waypoints.find((item) => item.id === waypointId)?.name ?? waypointId}
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() =>
                            updateRoute((item) => {
                              const ids = [...item.waypointIds];
                              [ids[index - 1], ids[index]] = [ids[index], ids[index - 1]];
                              return { ...item, waypointIds: ids };
                            })
                          }
                        >
                          Earlier
                        </button>
                        <button
                          type="button"
                          disabled={index === selectedRoute.waypointIds.length - 1}
                          onClick={() =>
                            updateRoute((item) => {
                              const ids = [...item.waypointIds];
                              [ids[index + 1], ids[index]] = [ids[index], ids[index + 1]];
                              return { ...item, waypointIds: ids };
                            })
                          }
                        >
                          Later
                        </button>
                      </li>
                    ))}
                  </ol>
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        commit({
                          ...definition,
                          routes: definition.routes.filter((item) => item.id !== selectedRoute.id),
                        })
                      )
                        setSelectedId(null);
                    }}
                  >
                    Delete route
                  </button>
                </div>
              )}
              {!selectedMap && !selectedWaypoint && !selectedRoute && (
                <p>Select the map, a waypoint, or a route to inspect it. Use the drawing tools to place geometry.</p>
              )}
            </aside>
          </div>
          <LandfallContextEditor
            definition={definition}
            worldspace={worldspace}
            map={map}
            assets={assets}
            waypoint={selectedWaypoint}
            route={selectedRoute}
            selectedRegionId={selectedRegionId}
            onSelectRegion={setSelectedRegionId}
            onSelectMap={(id) => {
              setMapId(id);
              setSelectedId(id);
            }}
            onChange={commit}
            onDrawRegion={(id, shape) => {
              const region = definition.context?.regions.find((item) => item.id === id);
              if (region) setMapId(region.mapId);
              setSelectedRegionId(id);
              setDrawingRegionId(id);
              setTool(shape);
              setPendingPoints([]);
              document.querySelector(".landfall-tool-row")?.scrollIntoView({ block: "nearest", behavior: "instant" });
            }}
          />
          {findings.length > 0 && (
            <section aria-label="Landfall authoring findings" className="landfall-findings">
              <h3>Authoring findings</h3>
              <ul>
                {findings.map((item) => (
                  <li key={item.code + item.targetId}>
                    <strong>{item.severity === "blocker" ? "Publication blocker" : "Warning"}:</strong> {item.message}
                  </li>
                ))}
              </ul>
            </section>
          )}
          <LandfallFieldTestPanel
            taleId={taleId}
            draftId={draftId}
            sourceVersion={sourceVersion}
            csrfToken={csrfToken}
            unsaved={unsaved}
            definition={definition}
            worldspaceId={worldspace.id}
            mapId={map.id}
            waypointId={selectedWaypoint?.id ?? selectedRoute?.waypointIds[0] ?? null}
            routeId={selectedRoute?.id ?? null}
          />
        </>
      )}
    </section>
  );
}
