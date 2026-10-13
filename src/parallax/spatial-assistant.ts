import { z } from "zod";
import { draftSchema, editSpatialDraft, type SpatialDraft } from "./authoring";
import { identityTransform, spatialId } from "./contracts";
import { validateSpatialAuthoring } from "./studio-validation";
import { updateAdaptiveContent } from "./adaptive-authoring";
import { roomFeatureClasses } from "./environment-contracts";
import { placeOnRoomFeature } from "./room-placement";
import { editingGroupMemberSchema } from "./editing-group-contracts";
import { saveEditingGroup, ungroupEditingGroup, transformEditingSelection } from "./editing-groups";

const copy = (maximum: number) => z.string().trim().min(1).max(maximum);
const explanation = (maximum: number) =>
  copy(maximum).refine((value) => /\p{L}/u.test(value), "Use readable explanatory text.");
const position = z.strictObject({
  x: z.number().min(-10).max(10),
  y: z.number().min(-3).max(3),
  z: z.number().min(-10).max(10),
});
const placement = z.enum(["DESK", "WALL", "ENTRANCE", "LOCAL"]);
const common = { id: spatialId, explanation: explanation(400), dependsOn: z.array(spatialId).max(16) };
const interactions = z
  .array(z.enum(["PICK", "INSPECT", "PLACE"]))
  .min(1)
  .max(3);
export const assistantOperationSchema = z.discriminatedUnion("type", [
  z.strictObject({
    ...common,
    type: z.literal("GROUP_CREATE"),
    groupId: spatialId,
    name: copy(160),
    members: z.array(editingGroupMemberSchema).min(2).max(288),
  }),
  z.strictObject({
    ...common,
    type: z.literal("GROUP_MEMBERS"),
    groupId: spatialId,
    members: z.array(editingGroupMemberSchema).min(1).max(288),
  }),
  z.strictObject({ ...common, type: z.literal("GROUP_RENAME"), groupId: spatialId, name: copy(160) }),
  z.strictObject({ ...common, type: z.literal("GROUP_UNGROUP"), groupId: spatialId }),
  z.strictObject({
    ...common,
    type: z.literal("GROUP_TRANSFORM"),
    groupId: spatialId,
    translation: position,
    yawDegrees: z.number().finite().min(-180).max(180),
    scale: z.number().finite().min(0.01).max(10),
  }),
  z.strictObject({
    ...common,
    type: z.literal("CREATE"),
    entityId: spatialId,
    name: copy(160),
    kind: z.enum(["PARCHMENT", "TEXT", "MARKER"]),
    content: copy(2000),
    alternativeText: copy(2000),
    widthMeters: z.number().min(0.02).max(5),
    placement,
    position,
    scale: z.number().min(0.01).max(10),
  }),
  z.strictObject({
    ...common,
    type: z.literal("CONTENT"),
    entityId: spatialId,
    name: copy(160).nullable(),
    content: copy(2000).nullable(),
    alternativeText: copy(2000).nullable(),
    widthMeters: z.number().min(0.02).max(5).nullable(),
    interactions: interactions.nullable(),
  }),
  z.strictObject({
    ...common,
    type: z.literal("TRANSFORM"),
    entityId: spatialId,
    position,
    scale: z.number().min(0.01).max(10),
  }),
  z.strictObject({ ...common, type: z.literal("PLACEMENT"), entityId: spatialId, placement }),
  z.strictObject({
    ...common,
    type: z.literal("ROOM_PLACEMENT"),
    entityId: spatialId,
    classification: z.enum(roomFeatureClasses),
    targetFeatureId: spatialId.nullable(),
    nearFeatureId: spatialId.nullable(),
  }),
  z.strictObject({
    ...common,
    type: z.literal("SEMANTIC_PLACEMENT"),
    entityId: spatialId,
    surface: z.enum(["FLOOR", "TABLE", "DESK", "SHELF", "WALL", "OPEN_SPACE"]),
    context: z.enum(["FURNITURE", "ENTRANCE", "WINDOW"]).nullable(),
    relativePlacement: z.enum(["CENTER", "EDGE", "LEFT", "RIGHT", "NEAR"]),
    concealment: z.enum(["NONE", "PARTIAL"]).nullable(),
  }),
  z.strictObject({ ...common, type: z.literal("VISIBILITY"), entityId: spatialId, visible: z.boolean() }),
  z.strictObject({
    ...common,
    type: z.literal("BEHAVIOR"),
    behaviorId: spatialId,
    trigger: z.enum(["SCENE_ENTER", "INSPECT", "PICK", "PLACE", "TIMER"]),
    sourceEntityId: spatialId.nullable(),
    targetEntityId: spatialId,
    delayMs: z.number().int().min(0).max(60000),
    action: z.enum(["SHOW", "HIDE", "HIGHLIGHT"]),
  }),
  z.strictObject({ ...common, type: z.literal("FALLBACK"), narrative: copy(4000) }),
]);
export const assistantInterpretationSchema = z.strictObject({
  intentType: z.enum(["CREATE", "EDIT", "INTERACTION", "ACCESSIBILITY", "CRITIQUE", "CLARIFICATION", "UNSUPPORTED"]),
  summary: explanation(600),
  clarification: explanation(400).nullable(),
  operations: z.array(assistantOperationSchema).max(24),
  assumptions: z.array(copy(400)).max(8),
  unsupportedCapabilities: z.array(copy(400)).max(8),
  warnings: z.array(copy(400)).max(12),
  accessibilityNotes: z.array(copy(400)).max(8),
  creatorExplanation: explanation(2000),
});
export const assistantProposalSchema = assistantInterpretationSchema.extend({
  schemaVersion: z.literal(1),
  requestId: spatialId,
  definitionId: spatialId,
  sceneRevision: z.number().int().min(0),
  editorGeneration: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  sceneDigest: z.string().regex(/^[a-f0-9]{64}$/),
});
export type AssistantInterpretation = z.infer<typeof assistantInterpretationSchema>;
export type AssistantProposal = z.infer<typeof assistantProposalSchema>;
export type AssistantOperation = z.infer<typeof assistantOperationSchema>;
export class SpatialAssistantError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
  ) {
    super(message);
  }
}
const reject = (code: string, message: string): never => {
  throw new SpatialAssistantError(code, message);
};

/** Same parsed property order in browser and server; binds all authored state, including metadata. */
export async function assistantSceneDigest(draft: SpatialDraft) {
  const bytes = new TextEncoder().encode(JSON.stringify(draftSchema.parse(draft)));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function orderedOperations(proposal: AssistantInterpretation, selectedIds?: readonly string[]) {
  const operations = proposal.operations;
  const byId = new Map(operations.map((operation) => [operation.id, operation]));
  if (byId.size !== operations.length) reject("DUPLICATE_OPERATION", "Proposal operation identities must be unique.");
  const selected = new Set(selectedIds ?? operations.map((operation) => operation.id));
  if (selected.size !== (selectedIds?.length ?? operations.length) || [...selected].some((id) => !byId.has(id)))
    reject("INVALID_SELECTION", "Choose valid proposal changes.");
  const result: AssistantOperation[] = [],
    visiting = new Set<string>(),
    visited = new Set<string>();
  const visit = (id: string) => {
    if (visited.has(id)) return;
    if (visiting.has(id)) reject("DEPENDENCY_CYCLE", "Proposal changes have circular dependencies.");
    const operation = byId.get(id);
    if (!operation) reject("DEPENDENCY_MISSING", "A required proposal change is missing.");
    visiting.add(id);
    for (const dependency of operation!.dependsOn) {
      if (!selected.has(dependency))
        reject("DEPENDENCY_SELECTION", "Select every required related change or apply the complete proposal.");
      visit(dependency);
    }
    visiting.delete(id);
    visited.add(id);
    result.push(operation!);
  };
  [...selected].forEach(visit);
  return result;
}

/** Edit the canonical recipe without converting or regrouping the rest of the scene. */
function semanticPlacement(
  input: SpatialDraft,
  operation: Extract<AssistantOperation, { type: "SEMANTIC_PLACEMENT" }>,
) {
  if (!input.content.adaptive)
    reject(
      "ADAPTIVE_SETUP_REQUIRED",
      "Enable adaptive placement with the guided controls before requesting semantic recipe changes.",
    );
  const next = structuredClone(input);
  const adaptive = next.content.adaptive!;
  const recipe = adaptive.recipes.find((entry) => entry.entityId === operation.entityId);
  if (!recipe) reject("SEMANTIC_ROOT_REQUIRED", "Choose the group's root object to change adaptive placement.");
  if (
    recipe!.forbiddenSurfaces.includes(operation.surface) ||
    (operation.context && recipe!.forbiddenContext.includes(operation.context))
  )
    reject("PLACEMENT_CONSTRAINT", "The proposed placement conflicts with the object's existing safety constraints.");
  const changedSurface = !recipe!.preferredSurfaces.includes(operation.surface);
  recipe!.preferredSurfaces = [operation.surface];
  recipe!.alternateSurfaces = recipe!.alternateSurfaces.filter((surface) => surface !== operation.surface);
  recipe!.relativePlacement = operation.relativePlacement;
  if (operation.context) {
    recipe!.preferredContext = [operation.context];
    recipe!.searchRegion = operation.context === "ENTRANCE" ? "ENTRANCE_REGION" : "CURRENT_ROOM";
  }
  if (operation.concealment !== null) recipe!.concealment = operation.concealment;
  if (changedSurface) {
    const heights =
      operation.surface === "FLOOR"
        ? [0, 0.3, 0]
        : operation.surface === "WALL"
          ? [0.4, 1.8, 1.2]
          : operation.surface === "SHELF"
            ? [0.4, 1.5, 1.1]
            : [0.4, 1.2, 0.75];
    [recipe!.minimumHeightMeters, recipe!.maximumHeightMeters, recipe!.preferredHeightMeters] = heights;
    recipe!.orientation =
      operation.surface === "WALL" ? "UPRIGHT" : operation.surface === "OPEN_SPACE" ? "PLAYER_FACING" : "SURFACE";
  }
  return updateAdaptiveContent(input, adaptive);
}

function assistantPlacement(input: SpatialDraft, entityId: string, value: "DESK" | "WALL" | "ENTRANCE" | "LOCAL") {
  if (!input.content.adaptive) {
    const original = input.content.entities.find((entity) => entity.id === entityId)?.transform;
    const placed = editSpatialDraft(input, { type: "PLACEMENT", entityId, placement: value });
    const entity = placed.content.entities.find((entry) => entry.id === entityId);
    // Placement changes the anchor and local offset, not the requested object's
    // size/orientation. Keep canonical manual placement behavior unchanged.
    if (!original || !entity) return placed;
    return editSpatialDraft(placed, {
      type: "TRANSFORM",
      entityId,
      transform: { ...entity.transform, rotation: original.rotation, scale: original.scale },
    });
  }
  const recipe = input.content.adaptive.recipes.find((entry) => entry.entityId === entityId);
  return semanticPlacement(input, {
    id: "placement",
    type: "SEMANTIC_PLACEMENT",
    entityId,
    dependsOn: [],
    explanation: "Reviewed placement",
    surface:
      value === "ENTRANCE"
        ? recipe?.preferredSurfaces[0] === "DEVICE"
          ? "TABLE"
          : (recipe?.preferredSurfaces[0] ?? "TABLE")
        : value === "LOCAL"
          ? "OPEN_SPACE"
          : value,
    context: value === "ENTRANCE" ? "ENTRANCE" : null,
    relativePlacement: recipe?.relativePlacement ?? "CENTER",
    concealment: null,
  });
}

/** Pure canonical edit materialization; rejects the entire reviewed bundle on any failure. */
export function materializeAssistantInterpretation(input: SpatialDraft, raw: unknown, selectedIds?: readonly string[]) {
  const proposal = assistantInterpretationSchema.parse(raw);
  if (
    (proposal.clarification || ["CLARIFICATION", "UNSUPPORTED", "CRITIQUE"].includes(proposal.intentType)) &&
    proposal.operations.length
  )
    reject("ADVISORY_MUTATION", "Clarification, unsupported requests and critique cannot silently edit the scene.");
  let next = draftSchema.parse(input);
  for (const operation of orderedOperations(proposal, selectedIds)) {
    if ("entityId" in operation && operation.type !== "CREATE") {
      if (!next.content.entities.some((entity) => entity.id === operation.entityId))
        reject("ENTITY_MISSING", "The proposed object is unavailable.");
      if (next.content.studio?.layers.some((layer) => layer.entityId === operation.entityId && layer.locked))
        reject("ENTITY_LOCKED", "Unlock the affected object before requesting edits.");
    }
    switch (operation.type) {
      case "GROUP_CREATE":
      case "GROUP_MEMBERS":
      case "GROUP_RENAME":
      case "GROUP_UNGROUP":
      case "GROUP_TRANSFORM": {
        const group = next.content.studio?.editingGroups?.find((group) => group.id === operation.groupId);
        if (!group && operation.type !== "GROUP_CREATE") reject("GROUP_MISSING", "Choose an existing saved group.");
        try {
          if (operation.type === "GROUP_CREATE")
            next = saveEditingGroup(
              next,
              { id: operation.groupId, name: operation.name, members: operation.members },
              true,
            );
          else if (operation.type === "GROUP_MEMBERS")
            next = saveEditingGroup(next, { ...group!, members: operation.members });
          else if (operation.type === "GROUP_RENAME")
            next = saveEditingGroup(next, { ...group!, name: operation.name });
          else if (operation.type === "GROUP_UNGROUP") next = ungroupEditingGroup(next, operation.groupId);
          else {
            const angle = (operation.yawDegrees * Math.PI) / 360;
            next = transformEditingSelection(next, group!.members, {
              position: operation.translation,
              rotation: { x: 0, y: Math.sin(angle), z: 0, w: Math.cos(angle) },
              scale: operation.scale,
            });
          }
        } catch (cause) {
          reject("GROUP_EDIT_REJECTED", cause instanceof Error ? cause.message : "Review this group and its members.");
        }
        break;
      }
      case "CREATE": {
        const anchor = next.content.anchors[0];
        if (!anchor) reject("ANCHOR_MISSING", "The scene needs an existing anchor.");
        next = editSpatialDraft(next, {
          type: "CREATE",
          entity: {
            id: operation.entityId,
            name: operation.name,
            kind: operation.kind,
            anchorId: anchor.id,
            coordinateSpace: {
              LOCAL_WORLD: "LOCAL_SESSION",
              SURFACE_RELATIVE: "SURFACE_RELATIVE",
              FIXED_WORLDSPACE: "WORLDSPACE",
              DEVICE_RELATIVE: "DEVICE",
            }[anchor.kind] as "LOCAL_SESSION",
            transform: identityTransform(),
            widthMeters: operation.widthMeters,
            content: operation.content,
            alternativeText: operation.alternativeText,
            interactions: ["PICK", "INSPECT", "PLACE"],
            visibility: "RELEASED",
            sharingScope: "PERSONAL",
          },
        });
        next = assistantPlacement(next, operation.entityId, operation.placement);
        next = editSpatialDraft(next, {
          type: "TRANSFORM",
          entityId: operation.entityId,
          transform: { ...identityTransform(), position: operation.position, scale: operation.scale },
        });
        break;
      }
      case "CONTENT": {
        const patch = Object.fromEntries(
          Object.entries(operation).filter(
            ([key, value]) =>
              ["name", "content", "alternativeText", "widthMeters", "interactions"].includes(key) && value !== null,
          ),
        );
        if (!Object.keys(patch).length) reject("EMPTY_OPERATION", "The proposed edit has no changes.");
        next = editSpatialDraft(next, { type: "CONTENT", entityId: operation.entityId, patch });
        break;
      }
      case "PLACEMENT":
        next = assistantPlacement(next, operation.entityId, operation.placement);
        break;
      case "SEMANTIC_PLACEMENT":
        next = semanticPlacement(next, operation);
        break;
      case "ROOM_PLACEMENT":
        try {
          next = placeOnRoomFeature(next, operation.entityId, operation);
        } catch (cause) {
          reject("ROOM_TARGET_UNRESOLVED", cause instanceof Error ? cause.message : "Review the room target.");
        }
        break;
      case "TRANSFORM": {
        const transform = next.content.entities.find((entity) => entity.id === operation.entityId)!.transform;
        next = editSpatialDraft(next, {
          type: "TRANSFORM",
          entityId: operation.entityId,
          transform: { ...transform, position: operation.position, scale: operation.scale },
        });
        break;
      }
      case "VISIBILITY":
        next = editSpatialDraft(next, {
          type: "LAYER",
          entityId: operation.entityId,
          patch: { visible: operation.visible },
        });
        break;
      case "BEHAVIOR":
        next = editSpatialDraft(next, {
          type: "BEHAVIOR",
          behavior: {
            id: operation.behaviorId,
            trigger: operation.trigger,
            ...(operation.sourceEntityId ? { sourceEntityId: operation.sourceEntityId } : {}),
            targetEntityId: operation.targetEntityId,
            delayMs: operation.delayMs,
            action: operation.action,
          },
        });
        break;
      case "FALLBACK":
        next = editSpatialDraft(next, { type: "FALLBACK", narrative: operation.narrative });
        break;
    }
  }
  if (proposal.operations.length && (selectedIds?.length ?? proposal.operations.length))
    next.content.studio!.provenance = {
      origin: "AI_ASSISTED",
      generator: "Parallax Spatial Assistant v1",
      license: "Creator reviewed configuration",
    };
  next = draftSchema.parse(next);
  const errors = validateSpatialAuthoring(next.content).filter((finding) => finding.severity === "ERROR");
  if (errors.length) reject("SPATIAL_VALIDATION", errors.map((finding) => finding.message).join(" "));
  return next;
}

export async function materializeAssistantProposal(
  draft: SpatialDraft,
  revision: number,
  raw: unknown,
  selectedIds?: readonly string[],
  editorGeneration?: number,
) {
  const proposal = assistantProposalSchema.parse(raw);
  if (editorGeneration !== undefined && proposal.editorGeneration !== editorGeneration)
    reject("STALE_SCENE", "Your scene has changed. Regenerate this proposal to preserve your newer work.");
  if (
    proposal.definitionId !== draft.content.definitionId ||
    proposal.sceneRevision !== revision ||
    proposal.sceneDigest !== (await assistantSceneDigest(draft))
  )
    reject("STALE_SCENE", "Your scene has changed. Regenerate this proposal to preserve your newer work.");
  return materializeAssistantInterpretation(draft, assistantInterpretationSchema.strip().parse(proposal), selectedIds);
}

function assistantRecipeContext(draft: SpatialDraft, entityId: string) {
  const recipe = draft.content.adaptive?.recipes.find((entry) => entry.entityId === entityId);
  if (!recipe) return null;
  // Only editable intent and the constraints the model must preserve; discovery
  // text, calibration receipts and full scene recipes stay in canonical storage.
  return {
    preferredSurfaces: recipe.preferredSurfaces,
    forbiddenSurfaces: recipe.forbiddenSurfaces,
    preferredContext: recipe.preferredContext,
    forbiddenContext: recipe.forbiddenContext,
    relativePlacement: recipe.relativePlacement,
    concealment: recipe.concealment,
    seatedRequired: recipe.seatedRequired,
    maximumReachMeters: recipe.maximumReachMeters,
    minimumVisibility: recipe.minimumVisibility,
  };
}

/** Omit secret answers, authored clue text, media, Chronicle content and imported metadata. */
export function prepareAssistantContext(
  draft: SpatialDraft,
  selectedEntityId: string | null,
  selectedGroupId?: string | null,
) {
  const selected = draft.content.entities.find((entity) => entity.id === selectedEntityId);
  if (selectedEntityId && !selected) reject("ENTITY_MISSING", "Choose an existing object.");
  if (selectedGroupId && !draft.content.studio?.editingGroups?.some((group) => group.id === selectedGroupId))
    reject("GROUP_MISSING", "Choose an existing group.");
  const entities = selected
    ? [selected, ...draft.content.entities.filter((entity) => entity.id !== selected.id).slice(0, 3)]
    : draft.content.entities.slice(0, 4);
  const semanticRecipes: NonNullable<ReturnType<typeof assistantRecipeContext>>[] = [];
  const projectedEntities = entities.map((entity) => {
    const recipe = assistantRecipeContext(draft, entity.id);
    let semanticPlacement: number | null = null;
    if (recipe) {
      const existing = semanticRecipes.findIndex((entry) => JSON.stringify(entry) === JSON.stringify(recipe));
      semanticPlacement = existing < 0 ? semanticRecipes.push(recipe) - 1 : existing;
    }
    return {
      id: entity.id,
      name: entity.name,
      kind: entity.kind,
      parentEntityId: entity.parentEntityId ?? null,
      position: entity.transform.position,
      scale: entity.transform.scale,
      widthMeters: entity.widthMeters,
      interactions: entity.interactions,
      locked: draft.content.studio?.layers.find((layer) => layer.entityId === entity.id)?.locked ?? false,
      semanticPlacement,
    };
  });
  return {
    definitionId: draft.content.definitionId,
    selectedEntityId,
    selectedGroupId: selectedGroupId ?? null,
    groups: draft.content.studio?.editingGroups ?? [],
    assetIndex: draft.content.entities.map((entity) => ({
      id: entity.id,
      name: entity.name,
      locked: draft.content.studio?.layers.some((layer) => layer.entityId === entity.id && layer.locked) ?? false,
    })),
    roomFeatureIndex:
      draft.content.studio?.environment?.features.map((feature) => ({
        id: feature.id,
        name: feature.name,
        classification: feature.classification,
      })) ?? [],
    totalEntities: draft.content.entities.length,
    placementPolicy: draft.content.placementPolicy,
    positionsAreAnchorLocal: true,
    entities: projectedEntities,
    semanticRecipes,
    ...(draft.content.studio?.environment
      ? {
          room: {
            id: draft.content.studio.environment.id,
            totalFeatures: draft.content.studio.environment.features.length,
            features: draft.content.studio.environment.features
              .filter((f) => !["OTHER", "FLOOR", "WALL", "CEILING", "TREE"].includes(f.classification))
              .sort(
                (a, b) =>
                  Number(!["DESK", "TABLE", "WINDOW", "DOOR"].includes(a.classification)) -
                  Number(!["DESK", "TABLE", "WINDOW", "DOOR"].includes(b.classification)),
              )
              .slice(0, 8)
              .map((f) => ({
                id: f.id,
                name: f.name,
                classification: f.classification,
                position: f.position,
                basis: f.provenance.basis,
                confidence: f.provenance.confidence,
              })),
          },
        }
      : {}),
    supported: {
      // The strict response schema already supplies the supported enum values.
      // Keep scene context for saved state and limits, rather than repeating them.
      materials: false,
      physicalGlow: false,
      arbitraryMedia: false,
      progression: false,
    },
    findings: validateSpatialAuthoring(draft.content).map((finding) => ({
      code: finding.code,
      severity: finding.severity,
      entityId: finding.entityId ?? null,
    })),
  };
}
