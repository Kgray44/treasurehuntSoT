import { z } from "zod";
import { versionContentSchema, identityTransform, type Anchor, type SpatialEntity, type Transform } from "./contracts";
import { emptyStudioContent, type StudioContent } from "./studio-contracts";
import { composeTransform, inverseTransform } from "./transforms";
import { defaultRecipe, defaultDiscovery } from "./adaptive-contracts";
import { syntheticRoomGeometry, discoverRoomSurfaces } from "./room-geometry";
import type { RoomFeature } from "./environment-contracts";
import type { Candidate } from "./adaptive";
import { spatialPropStyle, spatialFootprintSide } from "./prop-style";
import { pruneEditingGroups } from "./editing-group-contracts";
import { sceneLibraryMetadataSchema } from "./library-lifecycle-contracts";
type PreviewRoom = {
  id: string;
  width: number;
  depth: number;
  horizontal: boolean;
  vertical: boolean;
  features?: RoomFeature[];
};
const defaultPreviewRoom: PreviewRoom = { id: "bedroom", width: 4, depth: 4, horizontal: true, vertical: true };

export const authoringModes = ["GUIDED", "DETAILED", "ENGINEERING"] as const;
export const previewModes = [
  "EDITOR",
  "PHONE",
  "LENS",
  "CREW",
  "LOW_CAPABILITY",
  "FALLBACK",
  "ACCESSIBILITY",
  "PERFORMANCE",
  "REMOTE",
] as const;
export const draftSchema = z.strictObject({
  library: sceneLibraryMetadataSchema.optional(),
  content: versionContentSchema,
  scope: z.enum(["CHRONICLE_ONLY", "MY_LIBRARY"]),
  chronicleId: z.string().min(1).max(128).nullable(),
  category: z.enum([
    "MOMENT",
    "ENTITY",
    "PLACEMENT_RECIPE",
    "INTERACTION_BEHAVIOR",
    "EFFECT",
    "DISCOVERY_PROFILE",
    "SCENE_TEMPLATE",
  ]),
  tags: z.array(z.string().trim().min(1).max(60)).max(16),
  collection: z.string().max(120),
  favorite: z.boolean(),
  lineage: z.strictObject({ definitionId: z.string(), versionId: z.string() }).nullable(),
});
export type SpatialDraft = z.infer<typeof draftSchema>;
export type DraftContent = SpatialDraft["content"];
export type Edit =
  | { type: "CREATE"; entity: SpatialEntity }
  | {
      type: "CONTENT";
      entityId: string;
      patch: Partial<
        Pick<SpatialEntity, "name" | "content" | "alternativeText" | "widthMeters" | "interactions" | "element">
      >;
    }
  | { type: "BEHAVIOR"; behavior: StudioContent["behaviors"][number] }
  | { type: "FALLBACK"; narrative: string }
  | { type: "TRANSFORM"; entityId: string; transform: Transform }
  | { type: "PARENT"; entityId: string; parentId: string | null }
  | { type: "DUPLICATE"; entityId: string; newId: string }
  | { type: "DELETE"; entityId: string }
  | { type: "LAYER"; entityId: string; patch: Partial<StudioContent["layers"][number]> }
  | { type: "REORDER"; entityId: string; offset: number }
  | { type: "PLACEMENT"; entityId: string; placement: "DESK" | "WALL" | "ENTRANCE" | "LOCAL" }
  | { type: "REPLACE"; draft: SpatialDraft };

export const presetNames = [
  "Desk Map",
  "Peeking Letter",
  "Hidden Wall Message",
  "Ghost Footprint Trail",
  "Floating Compass",
] as const;
export function createSpatialDraft(
  id: string,
  preset: string = "Desk Map",
  chronicleId: string | null = null,
): SpatialDraft {
  const wall = preset === "Hidden Wall Message";
  const trail = preset === "Ghost Footprint Trail";
  const anchorId = `${id}:anchor`;
  const entities: SpatialEntity[] = Array.from({ length: trail ? 5 : 1 }, (_, i) => ({
    id: `${id}:entity-${i}`,
    name: trail ? `Footprint ${i + 1}` : preset,
    kind: preset === "Floating Compass" || trail ? "MARKER" : wall ? "TEXT" : "PARCHMENT",
    ...(trail ? { footprintSide: i % 2 ? ("RIGHT" as const) : ("LEFT" as const) } : {}),
    anchorId,
    coordinateSpace: preset === "Floating Compass" || trail ? "LOCAL_SESSION" : "SURFACE_RELATIVE",
    transform: {
      ...identityTransform(),
      position: { x: trail ? (i % 2 ? 0.12 : -0.12) : 0, y: trail ? 0.02 : 0, z: trail && i > 0 ? -i * 0.4 : 0 },
      ...(trail ? { rotation: { x: -Math.SQRT1_2, y: 0, z: 0, w: Math.SQRT1_2 } } : {}),
    },
    widthMeters: trail ? 0.4 : preset === "Desk Map" ? 0.5 : 0.25,
    content:
      preset === "Desk Map"
        ? "Follow the compass rose to the northern harbor."
        : trail
          ? "A spectral footprint points ahead."
          : "The Captain left a clue for you.",
    alternativeText: trail
      ? `${i % 2 ? "Right" : "Left"} spectral boot print ${i + 1} of 5, pointing along the trail. Available to inspect in Guided View.`
      : `${preset}, available to inspect in Guided View.`,
    interactions: ["PICK", "INSPECT", "PLACE"],
    visibility: "RELEASED",
    sharingScope: "PERSONAL",
  }));
  const studio = emptyStudioContent();
  studio.layers = entities.map((e) => ({
    entityId: e.id,
    tags: [],
    visible: true,
    locked: false,
    selectable: true,
    audience: "BOTH",
  }));
  studio.provenance.origin = "PRESET";
  return draftSchema.parse({
    library: { type: trail ? "TEMPLATE" : "SCENE", description: "" },
    scope: chronicleId ? "CHRONICLE_ONLY" : "MY_LIBRARY",
    chronicleId,
    category: trail ? "SCENE_TEMPLATE" : "MOMENT",
    tags: [],
    collection: "",
    favorite: false,
    lineage: null,
    content: {
      id: `${id}:draft`,
      definitionId: id,
      semanticVersion: "1.0.0",
      schemaVersion: 1,
      title: preset,
      anchors: [
        {
          id: anchorId,
          frameId: `${id}:frame`,
          transform: {
            ...identityTransform(),
            position:
              preset === "Floating Compass" || trail
                ? { x: 0, y: trail ? 0 : 0.75, z: trail ? 0.8 : -1 }
                : { x: 0, y: 0, z: 0.01 },
          },
          ...(preset === "Floating Compass" || trail
            ? { kind: "LOCAL_WORLD" }
            : { kind: "SURFACE_RELATIVE", alignment: wall ? "VERTICAL" : "HORIZONTAL" }),
        },
      ],
      entities,
      studio,
      placementPolicy: "FIXED",
      privacyClass: "LOCAL_EPHEMERAL",
      fallback: {
        mode: "GUIDED",
        narrative: "Read and inspect the same clue here, without a camera or precision movement.",
        preservesMeaning: true,
      },
      accessibility: { seated: true, keyboard: true, reducedMotion: true, soundIndependent: true },
    },
  });
}

export function worldTransform(content: DraftContent, entityId: string): Transform {
  const entity = content.entities.find((e) => e.id === entityId);
  if (!entity) throw new Error("Choose an existing spatial entity.");
  return composeTransform(
    entity.parentEntityId
      ? worldTransform(content, entity.parentEntityId)
      : content.anchors.find((a) => a.id === entity.anchorId)!.transform,
    entity.transform,
  );
}

export function referenceSurfaceCandidate(
  anchor: Anchor,
  room: PreviewRoom = defaultPreviewRoom,
  surfaces?: readonly Candidate[],
) {
  if (anchor.kind !== "SURFACE_RELATIVE") return undefined;
  const planes = surfaces ?? discoverRoomSurfaces(syntheticRoomGeometry(room), { tracking: true, clutter: 0 });
  return anchor.alignment === "VERTICAL"
    ? planes.find((c) => c.id === "wall-window")
    : (planes.find((c) => c.id === "reference-desk") ??
        planes.find((c) => c.safe && ["TABLE", "DESK", "SHELF"].includes(c.surface)) ??
        planes.find((c) => c.surface === "FLOOR"));
}
/** Synthetic room frames are preview-only; surface offsets remain relative to the selected native surface. */
export function referenceSurfaceFrame(
  anchor: Anchor,
  room: PreviewRoom = defaultPreviewRoom,
  surfaces?: readonly Candidate[],
): Transform {
  if (anchor.kind !== "SURFACE_RELATIVE") return identityTransform();
  const chosen = referenceSurfaceCandidate(anchor, room, surfaces);
  return {
    ...identityTransform(),
    position: chosen?.position ?? { x: 0, y: 1.4, z: -room.depth / 2 + 0.06 },
    rotation:
      chosen?.rotation ??
      (anchor.alignment === "HORIZONTAL"
        ? { x: -Math.SQRT1_2, y: 0, z: 0, w: Math.SQRT1_2 }
        : identityTransform().rotation),
  };
}

export function previewReferenceFrame(
  content: DraftContent,
  anchor: Anchor,
  environmentId?: string,
  room: PreviewRoom = defaultPreviewRoom,
  surfaces?: readonly Candidate[],
  upright = false,
): Transform {
  const frame = content.studio?.surfacePreviewFrames?.find(
    (f) => f.anchorId === anchor.id && (!environmentId || f.environmentId === environmentId),
  );
  if (frame && room.features) {
    const surface = (
      surfaces ?? discoverRoomSurfaces(syntheticRoomGeometry(room), { tracking: true, clutter: 0 })
    ).find((c) => c.id === frame.surfaceId);
    if (surface?.rotation)
      return orientElementFrame({ position: surface.position, rotation: surface.rotation, scale: 1 }, anchor, upright);
  }
  return orientElementFrame(
    frame
      ? { position: frame.position, rotation: frame.rotation, scale: 1 }
      : referenceSurfaceFrame(anchor, room, surfaces),
    anchor,
    upright,
  );
}

/** Models/effects use Y-up; paper assets use a plane-local Z normal. Preserve the room frame and its yaw. */
function orientElementFrame(frame: Transform, anchor: Anchor, upright: boolean): Transform {
  const oriented =
    upright && anchor.kind === "SURFACE_RELATIVE" && anchor.alignment === "HORIZONTAL"
      ? composeTransform(frame, { ...identityTransform(), rotation: { x: Math.SQRT1_2, y: 0, z: 0, w: Math.SQRT1_2 } })
      : frame;
  if (oriented === frame) return frame;
  const q = oriented.rotation;
  const length = Math.hypot(q.x, q.y, q.z, q.w);
  return { ...oriented, rotation: { x: q.x / length, y: q.y / length, z: q.z / length, w: q.w / length } };
}
export function elementUsesUprightFrame(content: DraftContent, entityId: string): boolean {
  let entity = content.entities.find((e) => e.id === entityId);
  while (entity?.parentEntityId) entity = content.entities.find((e) => e.id === entity!.parentEntityId);
  return Boolean(entity?.element);
}

/** Resolve all entities using one existing surface collection and one traversal of each parent chain. */
export function previewEntityTransforms(
  content: DraftContent,
  environmentId?: string,
  room: PreviewRoom = defaultPreviewRoom,
  surfaces?: readonly Candidate[],
): Record<string, Transform> {
  const planes = surfaces ?? discoverRoomSurfaces(syntheticRoomGeometry(room), { tracking: true, clutter: 0 });
  const entities = new Map(content.entities.map((entity) => [entity.id, entity]));
  const anchors = new Map(content.anchors.map((anchor) => [anchor.id, anchor]));
  const localWorld = new Map<string, Transform>();
  const frames = new Map(
    content.anchors.map((anchor) => [anchor.id, previewReferenceFrame(content, anchor, environmentId, room, planes)]),
  );
  const resolve = (id: string): Transform => {
    const cached = localWorld.get(id);
    if (cached) return cached;
    const entity = entities.get(id)!;
    const pose = composeTransform(
      entity.parentEntityId ? resolve(entity.parentEntityId) : anchors.get(entity.anchorId)!.transform,
      entity.transform,
    );
    localWorld.set(id, pose);
    return pose;
  };
  return Object.fromEntries(
    content.entities.map((entity) => [
      entity.id,
      composeTransform(
        orientElementFrame(
          frames.get(entity.anchorId)!,
          anchors.get(entity.anchorId)!,
          elementUsesUprightFrame(content, entity.id),
        ),
        resolve(entity.id),
      ),
    ]),
  );
}

export function previewEntityTransform(
  content: DraftContent,
  entityId: string,
  environmentId?: string,
  room: PreviewRoom = defaultPreviewRoom,
): Transform {
  const entity = content.entities.find((e) => e.id === entityId);
  if (!entity) throw new Error("Choose an existing spatial entity.");
  const anchor = content.anchors.find((a) => a.id === entity.anchorId)!;
  return composeTransform(
    previewReferenceFrame(content, anchor, environmentId, room, undefined, elementUsesUprightFrame(content, entityId)),
    worldTransform(content, entityId),
  );
}

export function editSpatialDraft(input: SpatialDraft, edit: Edit): SpatialDraft {
  if (edit.type === "REPLACE") {
    const replacement = structuredClone(edit.draft);
    pruneEditingGroups(replacement.content);
    return draftSchema.parse(replacement);
  }
  const next = structuredClone(input);
  const studio = (next.content.studio ??= emptyStudioContent());
  if (edit.type === "CREATE") {
    if (next.content.entities.some((entity) => entity.id === edit.entity.id))
      throw new Error("Entity identity already exists.");
    const created = structuredClone(edit.entity);
    if (next.content.adaptive) {
      if (created.parentEntityId) throw new Error("Create a semantic root before grouping it.");
      const anchorId = `${created.id}:semantic`;
      if (next.content.anchors.some((anchor) => anchor.id === anchorId))
        throw new Error("Entity anchor identity already exists.");
      created.anchorId = anchorId;
      created.coordinateSpace = "LOCAL_SESSION";
      created.transform.position = { x: 0, y: 0, z: 0 };
      next.content.anchors.push({
        id: anchorId,
        kind: "LOCAL_WORLD",
        frameId: "semantic-local-frame",
        transform: identityTransform(),
      });
      const adaptive = next.content.adaptive;
      adaptive.recipes.push(defaultRecipe(created.id));
      adaptive.discovery.push(defaultDiscovery(created.id));
      if (adaptive.revealOrder.length) adaptive.revealOrder.push(created.id);
      adaptive.calibration.maturity = "SEMANTIC";
      delete adaptive.calibration.reviewReceiptId;
      if (next.content.placementPolicy === "CALIBRATED") next.content.placementPolicy = "ADAPTIVE_STICKY";
    }
    next.content.entities.push(created);
    studio.layers.push({
      entityId: edit.entity.id,
      tags: [],
      visible: true,
      locked: false,
      selectable: true,
      audience: "BOTH",
    });
    return draftSchema.parse(next);
  }
  if (edit.type === "FALLBACK") {
    next.content.fallback = { mode: "GUIDED", narrative: edit.narrative, preservesMeaning: true };
    return draftSchema.parse(next);
  }
  if (edit.type === "BEHAVIOR") {
    for (const id of [edit.behavior.targetEntityId, edit.behavior.sourceEntityId].filter(Boolean)) {
      if (studio.layers.some((layer) => layer.entityId === id && layer.locked))
        throw new Error("Unlock this entity before editing it.");
    }
    const index = studio.behaviors.findIndex((behavior) => behavior.id === edit.behavior.id);
    if (index < 0) studio.behaviors.push(structuredClone(edit.behavior));
    else studio.behaviors[index] = structuredClone(edit.behavior);
    return draftSchema.parse(next);
  }
  const entity = next.content.entities.find((e) => e.id === edit.entityId);
  if (!entity) throw new Error("Choose an existing spatial entity.");
  const layer = studio.layers.find((l) => l.entityId === entity.id);
  if (layer?.locked && edit.type !== "LAYER") throw new Error("Unlock this entity before editing it.");
  switch (edit.type) {
    case "CONTENT":
      if (edit.patch.name !== undefined && edit.patch.name !== entity.name)
        entity.propStyle ??= spatialPropStyle(entity);
      Object.assign(entity, edit.patch);
      break;
    case "TRANSFORM":
      entity.transform = edit.transform;
      break;
    case "LAYER": {
      const current = layer ?? {
        entityId: entity.id,
        tags: [],
        visible: true,
        locked: false,
        selectable: true,
        audience: "BOTH" as const,
      };
      Object.assign(current, edit.patch, { entityId: entity.id });
      if (!layer) studio.layers.push(current);
      break;
    }
    case "PARENT": {
      const world = worldTransform(next.content, entity.id);
      const parent = next.content.entities.find((e) => e.id === edit.parentId);
      if (edit.parentId && (!parent || parent.id === entity.id)) throw new Error("Choose a different parent.");
      if (parent && parent.anchorId !== entity.anchorId)
        throw new Error("Group entities in the same anchor frame. Duplicate an entity there to add a child.");
      let ancestor = parent;
      while (ancestor) {
        if (ancestor.id === entity.id) throw new Error("A group cannot contain itself.");
        ancestor = next.content.entities.find((e) => e.id === ancestor?.parentEntityId);
      }
      if (parent) {
        entity.parentEntityId = parent.id;
        entity.anchorId = parent.anchorId;
        entity.coordinateSpace = "ENTITY_RELATIVE";
      } else {
        delete entity.parentEntityId;
        entity.coordinateSpace = {
          LOCAL_WORLD: "LOCAL_SESSION",
          SURFACE_RELATIVE: "SURFACE_RELATIVE",
          FIXED_WORLDSPACE: "WORLDSPACE",
          DEVICE_RELATIVE: "DEVICE",
        }[next.content.anchors.find((a) => a.id === entity.anchorId)!.kind] as SpatialEntity["coordinateSpace"];
      }
      entity.transform = composeTransform(
        inverseTransform(
          parent
            ? worldTransform(next.content, parent.id)
            : next.content.anchors.find((a) => a.id === entity.anchorId)!.transform,
        ),
        world,
      );
      // Move the whole subtree into the parent's anchor frame.
      const reanchor = (id: string) => {
        for (const child of next.content.entities.filter((e) => e.parentEntityId === id)) {
          child.anchorId = entity.anchorId;
          reanchor(child.id);
        }
      };
      reanchor(entity.id);
      break;
    }
    case "DUPLICATE": {
      if (studio.libraryDefinition?.rootEntityId === entity.id)
        throw new Error(
          "Add this asset to a scene to duplicate and group it, then save the assembly as a new definition.",
        );
      const clone = structuredClone(entity);
      if (spatialPropStyle(entity) === "FOOTPRINT") clone.footprintSide = spatialFootprintSide(entity);
      clone.id = edit.newId;
      clone.name += " copy";
      clone.transform.position.x += 0.2;
      next.content.entities.push(clone);
      if (next.content.adaptive && !clone.parentEntityId) {
        const adaptive = next.content.adaptive;
        const recipe = adaptive.recipes.find((r) => r.entityId === entity.id)!;
        const discovery = adaptive.discovery.find((p) => p.entityId === entity.id)!;
        clone.anchorId = `${clone.id}:semantic`;
        clone.transform.position = { x: 0, y: 0, z: 0 };
        next.content.anchors.push({
          id: clone.anchorId,
          kind: "LOCAL_WORLD",
          frameId: "semantic-local-frame",
          transform: identityTransform(),
        });
        adaptive.recipes.push({ ...structuredClone(recipe), entityId: clone.id });
        adaptive.discovery.push({ ...structuredClone(discovery), entityId: clone.id });
        if (adaptive.revealOrder.length) adaptive.revealOrder.push(clone.id);
      }
      studio.layers.push({
        ...(layer ?? { tags: [], visible: true, locked: false, selectable: true, audience: "BOTH" }),
        entityId: clone.id,
        locked: false,
      });
      const origin = studio.assetInstances?.find((i) => i.entityIds.includes(entity.id));
      if (origin)
        studio.assetInstances!.push({ ...structuredClone(origin), id: crypto.randomUUID(), entityIds: [clone.id] });
      if (studio.animationTracks)
        studio.animationTracks.push(
          ...studio.animationTracks
            .filter((t) => t.entityId === entity.id)
            .map((t) => {
              const track = structuredClone(t);
              track.id = crypto.randomUUID();
              track.entityId = clone.id;
              for (const frame of track.keyframes) frame.id = crypto.randomUUID();
              return track;
            }),
        );
      break;
    }
    case "DELETE": {
      if (next.content.entities.some((e) => e.parentEntityId === entity.id))
        throw new Error("Ungroup the children before deleting their parent.");
      next.content.entities = next.content.entities.filter((e) => e.id !== entity.id);
      studio.layers = studio.layers.filter((l) => l.entityId !== entity.id);
      studio.behaviors = studio.behaviors.filter(
        (b) => b.targetEntityId !== entity.id && b.sourceEntityId !== entity.id,
      );
      studio.assets = studio.assets.filter((a) => a.entityId !== entity.id);
      if (studio.animationTracks)
        studio.animationTracks = studio.animationTracks.filter((t) => t.entityId !== entity.id);
      studio.visionReferences = studio.visionReferences.filter((a) => a.entityId !== entity.id);
      if (next.content.environmentPlacements)
        next.content.environmentPlacements = next.content.environmentPlacements.filter((p) => p.entityId !== entity.id);
      if (studio.assetInstances)
        studio.assetInstances = studio.assetInstances
          .map((i) => ({ ...i, entityIds: i.entityIds.filter((id) => id !== entity.id) }))
          .filter((i) => i.entityIds.length);
      if (studio.libraryDefinition?.rootEntityId === entity.id)
        throw new Error("Keep the asset root, or save the remaining objects as a new reusable asset.");
      if (next.content.adaptive) {
        const adaptive = next.content.adaptive;
        adaptive.recipes = adaptive.recipes.filter((r) => r.entityId !== entity.id);
        adaptive.discovery = adaptive.discovery.filter((p) => p.entityId !== entity.id);
        adaptive.relationships = adaptive.relationships.filter(
          (r) => r.entityId !== entity.id && r.otherEntityId !== entity.id,
        );
        adaptive.revealOrder = adaptive.revealOrder.filter((id) => id !== entity.id);
      }
      next.content.anchors = next.content.anchors.filter((a) => next.content.entities.some((e) => e.anchorId === a.id));
      break;
    }
    case "REORDER": {
      const index = next.content.entities.indexOf(entity);
      next.content.entities.splice(index, 1);
      next.content.entities.splice(Math.max(0, Math.min(next.content.entities.length, index + edit.offset)), 0, entity);
      break;
    }
    case "PLACEMENT": {
      const id = `${entity.id}:placement`;
      next.content.anchors = next.content.anchors.filter((a) => a.id !== id);
      next.content.anchors.push({
        id,
        frameId: `${id}:frame`,
        transform: {
          ...identityTransform(),
          position:
            edit.placement === "DESK" || edit.placement === "WALL"
              ? { x: 0, y: 0, z: 0.01 }
              : { x: edit.placement === "ENTRANCE" ? -1 : 0, y: 0, z: -1 },
        },
        ...(edit.placement === "DESK" || edit.placement === "WALL"
          ? { kind: "SURFACE_RELATIVE", alignment: edit.placement === "WALL" ? "VERTICAL" : "HORIZONTAL" }
          : { kind: "LOCAL_WORLD" }),
      });
      entity.anchorId = id;
      delete entity.parentEntityId;
      entity.coordinateSpace =
        edit.placement === "DESK" || edit.placement === "WALL" ? "SURFACE_RELATIVE" : "LOCAL_SESSION";
      entity.transform = identityTransform();
      const reanchor = (parent: string) => {
        for (const child of next.content.entities.filter((e) => e.parentEntityId === parent)) {
          child.anchorId = id;
          reanchor(child.id);
        }
      };
      reanchor(entity.id);
      next.content.anchors = next.content.anchors.filter((a) => next.content.entities.some((e) => e.anchorId === a.id));
      break;
    }
  }
  if (
    next.content.adaptive &&
    JSON.stringify(next.content.adaptive.recipes) !== JSON.stringify(input.content.adaptive?.recipes)
  ) {
    next.content.adaptive.calibration.maturity = "SEMANTIC";
    delete next.content.adaptive.calibration.reviewReceiptId;
    if (next.content.placementPolicy === "CALIBRATED") next.content.placementPolicy = "ADAPTIVE_STICKY";
  }
  if (studio.surfacePreviewFrames)
    studio.surfacePreviewFrames = studio.surfacePreviewFrames.filter(
      (f) =>
        next.content.anchors.some((a) => a.id === f.anchorId) &&
        !(edit.type === "PLACEMENT" && f.anchorId === entity.anchorId),
    );
  pruneEditingGroups(next.content);
  return draftSchema.parse(next);
}

export type History = { past: SpatialDraft[]; present: SpatialDraft; future: SpatialDraft[] };
export function changeHistory(history: History, edit: Edit): History {
  const next = editSpatialDraft(history.present, edit);
  if (JSON.stringify(next) === JSON.stringify(history.present)) return history;
  return { past: [...history.past.slice(-99), history.present], present: next, future: [] };
}
export function undo(history: History): History {
  const previous = history.past.at(-1);
  return previous
    ? { past: history.past.slice(0, -1), present: previous, future: [history.present, ...history.future] }
    : history;
}
export function redo(history: History): History {
  const next = history.future[0];
  return next ? { past: [...history.past, history.present], present: next, future: history.future.slice(1) } : history;
}
export function forkSpatialDraft(input: SpatialDraft, definitionId: string): SpatialDraft {
  const cloned = structuredClone(input);
  if (cloned.library) delete cloned.library.creation;
  return draftSchema.parse({
    ...cloned,
    scope: "CHRONICLE_ONLY",
    lineage: { definitionId: input.content.definitionId, versionId: input.content.id },
    content: { ...input.content, definitionId, id: `${definitionId}:draft`, semanticVersion: "1.0.0" },
  });
}
