import type { SpatialDraft } from "./authoring";
import { previewEntityTransform } from "./authoring";
import type { RoomFeature } from "./environment-contracts";
import { authoredPreviewEnvironment, resolveRoomFeature } from "./environment-authoring";
import { discoverRoomSurfaces, syntheticRoomGeometry } from "./room-geometry";
import { findSurfacePlacement, snapSpatialEntity } from "./surface-placement";

/** Resolve authored environmental semantics; the ordinary surface engine remains placement authority. */
export function placeOnRoomFeature(
  draft: SpatialDraft,
  entityId: string,
  target: {
    classification: RoomFeature["classification"];
    targetFeatureId: string | null;
    nearFeatureId: string | null;
  },
) {
  const room = draft.content.studio?.environment;
  if (!room) throw new Error("Add an editable room before targeting its features.");
  if (draft.content.adaptive)
    throw new Error(
      "Room-specific placement needs manual placement; automatic recipes remain available for other rooms.",
    );
  const resolution = resolveRoomFeature(room, target.classification, target.nearFeatureId);
  const explicit = target.targetFeatureId ? room.features.find((f) => f.id === target.targetFeatureId) : undefined;
  if (target.targetFeatureId && (!explicit || explicit.classification !== target.classification))
    throw new Error("The requested room feature is missing or has changed classification. Review the room features.");
  if (target.nearFeatureId && resolution.status === "MISSING")
    throw new Error("The nearby room feature is missing. Choose an existing feature.");
  if (target.nearFeatureId && explicit && resolution.status === "RESOLVED" && resolution.feature.id !== explicit.id)
    throw new Error(
      "The selected surface is not the closest matching feature to the requested landmark. Review the target.",
    );
  const feature = explicit ?? (resolution.status === "RESOLVED" ? resolution.feature : undefined);
  if (!feature)
    throw new Error(
      resolution.status === "AMBIGUOUS"
        ? `Which ${target.classification.toLowerCase()} should be used? ${resolution.candidates.map((f) => f.name).join(", ")}.`
        : `No ${target.classification.toLowerCase()} was found. Add or correct a room feature.`,
    );
  const environment = authoredPreviewEnvironment(draft.content, {
    id: room.id,
    name: room.name,
    width: room.width,
    depth: room.depth,
    horizontal: true,
    vertical: true,
    tracking: true,
    clutter: 0,
    light: "NORMAL",
  });
  const surfaces = discoverRoomSurfaces(syntheticRoomGeometry(environment), environment);
  const entity = draft.content.entities.find((e) => e.id === entityId);
  if (!entity) throw new Error("Choose an existing spatial object.");
  const surfaceIds = new Set(feature.parts.filter((p) => p.surface !== null).map((p) => p.id));
  const matches = surfaces.filter((c) => surfaceIds.has(c.id) && c.safe);
  const world = previewEntityTransform(draft.content, entityId, room.id, environment);
  for (const surface of matches) {
    const placed = findSurfacePlacement({ ...world, position: surface.position }, surface, entity.widthMeters);
    if (placed) return snapSpatialEntity(draft, entityId, placed, surface, room.id);
  }
  throw new Error(
    `${feature.name} has no clear support face large enough for this object. Choose another surface or reduce its size.`,
  );
}
