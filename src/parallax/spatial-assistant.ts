import { z } from "zod";
import { draftSchema, editSpatialDraft, type SpatialDraft } from "./authoring";
import { identityTransform, spatialId } from "./contracts";
import { validateSpatialAuthoring } from "./studio-validation";

const copy = (maximum: number) => z.string().trim().min(1).max(maximum);
const position = z.strictObject({
  x: z.number().min(-10).max(10),
  y: z.number().min(-3).max(3),
  z: z.number().min(-10).max(10),
});
const placement = z.enum(["DESK", "WALL", "ENTRANCE", "LOCAL"]);
const common = { id: spatialId, explanation: copy(400), dependsOn: z.array(spatialId).max(16) };
const interactions = z
  .array(z.enum(["PICK", "INSPECT", "PLACE"]))
  .min(1)
  .max(3);
export const assistantOperationSchema = z.discriminatedUnion("type", [
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
  summary: copy(600),
  clarification: copy(400).nullable(),
  operations: z.array(assistantOperationSchema).max(24),
  assumptions: z.array(copy(400)).max(8),
  unsupportedCapabilities: z.array(copy(400)).max(8),
  warnings: z.array(copy(400)).max(12),
  accessibilityNotes: z.array(copy(400)).max(8),
  creatorExplanation: copy(2000),
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
        next = editSpatialDraft(next, {
          type: "PLACEMENT",
          entityId: operation.entityId,
          placement: operation.placement,
        });
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
        next = editSpatialDraft(next, {
          type: "PLACEMENT",
          entityId: operation.entityId,
          placement: operation.placement,
        });
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

/** Omit secret answers, authored clue text, media, Chronicle content and imported metadata. */
export function prepareAssistantContext(draft: SpatialDraft, selectedEntityId: string | null) {
  const selected = draft.content.entities.find((entity) => entity.id === selectedEntityId);
  if (selectedEntityId && !selected) reject("ENTITY_MISSING", "Choose an existing object.");
  const entities = selected
    ? [selected, ...draft.content.entities.filter((entity) => entity.id !== selected.id).slice(0, 7)]
    : draft.content.entities.slice(0, 16);
  return {
    definitionId: draft.content.definitionId,
    selectedEntityId,
    totalEntities: draft.content.entities.length,
    entities: entities.map((entity) => ({
      id: entity.id,
      name: entity.name,
      kind: entity.kind,
      parentEntityId: entity.parentEntityId ?? null,
      position: entity.transform.position,
      scale: entity.transform.scale,
      widthMeters: entity.widthMeters,
      interactions: entity.interactions,
      locked: draft.content.studio?.layers.find((layer) => layer.entityId === entity.id)?.locked ?? false,
    })),
    supported: {
      entityKinds: ["PARCHMENT", "TEXT", "MARKER"],
      placements: ["DESK", "WALL", "ENTRANCE", "LOCAL"],
      triggers: ["SCENE_ENTER", "INSPECT", "PICK", "PLACE", "TIMER"],
      actions: ["SHOW", "HIDE", "HIGHLIGHT"],
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
