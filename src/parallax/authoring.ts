import { z } from "zod";
import { versionContentSchema, identityTransform, type Anchor, type SpatialEntity, type Transform } from "./contracts";
import { emptyStudioContent, type StudioContent } from "./studio-contracts";
import { composeTransform, inverseTransform } from "./transforms";

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
    anchorId,
    coordinateSpace: preset === "Floating Compass" || trail ? "LOCAL_SESSION" : "SURFACE_RELATIVE",
    transform: {
      ...identityTransform(),
      position: { x: trail ? (i % 2 ? 0.12 : -0.12) : 0, y: trail ? 0.02 : 0, z: trail && i > 0 ? -i * 0.4 : 0 },
    },
    widthMeters: trail ? 0.16 : preset === "Desk Map" ? 0.5 : 0.25,
    content:
      preset === "Desk Map"
        ? "Follow the compass rose to the northern harbor."
        : trail
          ? "A spectral footprint points ahead."
          : "The Captain left a clue for you.",
    alternativeText: `${preset}, available to inspect in Guided View.`,
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
              preset === "Floating Compass" || trail ? { x: 0, y: trail ? 0 : 0.75, z: -1 } : { x: 0, y: 0, z: 0.01 },
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

/** Synthetic room frames are preview-only; surface offsets remain relative to the selected native surface. */
export function referenceSurfaceFrame(anchor: Anchor): Transform {
  if (anchor.kind !== "SURFACE_RELATIVE") return identityTransform();
  return {
    ...identityTransform(),
    position: { x: 0, y: anchor.alignment === "HORIZONTAL" ? 0.75 : 1.4, z: -1 },
    rotation:
      anchor.alignment === "HORIZONTAL"
        ? { x: -Math.SQRT1_2, y: 0, z: 0, w: Math.SQRT1_2 }
        : identityTransform().rotation,
  };
}

export function previewEntityTransform(content: DraftContent, entityId: string): Transform {
  const entity = content.entities.find((e) => e.id === entityId);
  if (!entity) throw new Error("Choose an existing spatial entity.");
  const anchor = content.anchors.find((a) => a.id === entity.anchorId)!;
  return composeTransform(referenceSurfaceFrame(anchor), worldTransform(content, entityId));
}

export function editSpatialDraft(input: SpatialDraft, edit: Edit): SpatialDraft {
  if (edit.type === "REPLACE") return draftSchema.parse(structuredClone(edit.draft));
  const next = structuredClone(input);
  const entity = next.content.entities.find((e) => e.id === edit.entityId);
  if (!entity) throw new Error("Choose an existing spatial entity.");
  const studio = (next.content.studio ??= emptyStudioContent());
  const layer = studio.layers.find((l) => l.entityId === entity.id);
  if (layer?.locked && edit.type !== "LAYER") throw new Error("Unlock this entity before editing it.");
  switch (edit.type) {
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
      const clone = structuredClone(entity);
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
      studio.visionReferences = studio.visionReferences.filter((a) => a.entityId !== entity.id);
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
  return draftSchema.parse({
    ...structuredClone(input),
    scope: "CHRONICLE_ONLY",
    lineage: { definitionId: input.content.definitionId, versionId: input.content.id },
    content: { ...input.content, definitionId, id: `${definitionId}:draft`, semanticVersion: "1.0.0" },
  });
}
