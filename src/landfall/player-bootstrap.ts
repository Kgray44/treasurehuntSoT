import { projectLandfallMap, type LandfallMapScene } from "@/landfall/map-projection";
import type { PinnedLandfallDefinition } from "@/landfall/published";
import type { LandfallDefinition } from "@/landfall/schema";

export type PlayerLandfallBootstrap = Readonly<{
  sessionId: string;
  publishedVersionId: string;
  currentSequence: number;
  worldspaceName: string;
  activeWaypointId: string | null;
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
  },
): PlayerLandfallBootstrap {
  const definition = pinned.definition;
  let worldspace = definition.worldspaces[0];
  // Phase 1 has no separate canonical Landfall transition event. A currently
  // entered Chronicle chapter/block may select its authored destination.
  const entered = definition.transitions.find(
    (item) =>
      item.fromWorldspaceId === worldspace.id &&
      ((item.trigger.type === "CHAPTER" && item.trigger.id === context.chapterId) ||
        (item.trigger.type === "BLOCK" && item.trigger.id === context.blockId)),
  );
  if (entered) worldspace = definition.worldspaces.find((item) => item.id === entered.toWorldspaceId) ?? worldspace;
  const map = definition.maps.find((item) => item.id === worldspace.defaultMapDefinitionId);
  if (!map) throw new Error("LANDFALL_MAP_UNAVAILABLE");

  // Until One Voyage emits canonical Landfall receipts, prerequisite-gated and
  // hidden waypoints have not been released. Never ship their geometry.
  const waypoints = definition.waypoints.filter(
    (item) =>
      item.worldspaceId === worldspace.id &&
      item.mapId === map.id &&
      !item.visibility.hiddenUntilRevealed &&
      item.sequence.afterWaypointIds.length === 0 &&
      (!item.expiresAt || Date.parse(item.expiresAt) > Date.now()),
  );
  const releasedIds = new Set(waypoints.map((item) => item.id));
  const routes = definition.routes.filter(
    (item) =>
      item.worldspaceId === worldspace.id &&
      item.model !== "HIDDEN" &&
      item.waypointIds.every((id) => releasedIds.has(id)),
  );
  const imageAssetId = map.source.type === "ASSET_IMAGE" ? map.source.assetId : null;
  const asset = imageAssetId ? context.releasedAssets.find((item) => item.id === imageAssetId) : undefined;
  const scene = projectLandfallMap(definition, {
    audience: "PLAYER",
    activeWorldspaceId: worldspace.id,
    availableLocations: waypoints.map(({ id }) => ({ id })),
    activeRouteId: routes[0]?.id ?? null,
  });
  const coordinateReference =
    worldspace.coordinateReference.type === "NORMALIZED_IMAGE_2D" && !asset
      ? { ...worldspace.coordinateReference, imageAssetId: "withheld" }
      : worldspace.coordinateReference;
  return {
    sessionId: pinned.sessionId,
    publishedVersionId: pinned.publishedVersionId,
    currentSequence: pinned.currentSequence,
    worldspaceName: worldspace.name,
    activeWaypointId: waypoints.find((item) => !item.sequence.optional)?.id ?? waypoints[0]?.id ?? null,
    scene: {
      ...scene,
      ...(asset ? { imageUrl: asset.url } : {}),
      imageAssetId: asset ? scene.imageAssetId : undefined,
    },
    runtimeDefinition: {
      worldspaces: [{ ...worldspace, coordinateReference, mapDefinitionIds: [map.id] }],
      waypoints,
      routes,
      transitions: [],
    },
  };
}
