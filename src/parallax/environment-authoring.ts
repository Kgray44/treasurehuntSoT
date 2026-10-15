import {
  createSpatialDraft,
  draftSchema,
  forkSpatialDraft,
  previewEntityTransform,
  type SpatialDraft,
} from "./authoring";
import type { EnvironmentContent, EnvironmentVersion } from "./environment-contracts";
import { environmentContentSchema } from "./environment-contracts";
import { syntheticEnvironmentEvidence, invalidateAdaptiveCalibration } from "./adaptive-authoring";
import { simulationEnvironments, validateSpatialAuthoring } from "./studio-validation";
import { resolveAdaptiveScene } from "./adaptive";
import { emptyStudioContent } from "./studio-contracts";

export function environmentFromBaseline(
  id: string,
  baselineId = "bedroom",
  name = "New Environment",
): EnvironmentContent {
  const baseline = simulationEnvironments.find((e) => e.id === baselineId) ?? simulationEnvironments[0];
  const room = { ...baseline, id, name };
  return environmentContentSchema.parse({
    ...room,
    schemaVersion: 1,
    description: `Reusable ${baseline.name.toLowerCase()} structure. Scene objects and behaviors are authored separately.`,
    origin: "MANUAL",
    sourceLabel: `Built-in ${baseline.name} baseline`,
    evidence: syntheticEnvironmentEvidence(room),
    fixtures: [],
  });
}
export function createEnvironmentScene(
  id: string,
  title: string,
  environment: EnvironmentVersion,
  chronicleId: string | null = null,
): SpatialDraft {
  const draft = createSpatialDraft(id, "Desk Map", chronicleId);
  draft.content.title = title;
  draft.content.environment = structuredClone(environment.reference);
  draft.content.sceneDescription = "An independent scene in this shared Environment.";
  // Keep the supported canonical scene schema: an ordinary room description is
  // a real inspectable object, and does not invent unsupported empty releases.
  draft.content.entities[0].name = "Room description";
  draft.content.entities[0].kind = "TEXT";
  draft.content.entities[0].content = environment.content.description;
  draft.content.entities[0].alternativeText = environment.content.description;
  return draftSchema.parse(draft);
}
export function duplicateEnvironmentScene(draft: SpatialDraft, id: string, title: string): SpatialDraft {
  const next = forkSpatialDraft(draft, id);
  next.scope = draft.scope;
  next.content.title = title;
  return draftSchema.parse(next);
}
export type EnvironmentImpact = {
  sceneId: string;
  fromRevision: number | null;
  toRevision: number;
  status: "CURRENT" | "REVIEW_REQUIRED" | "INVALID";
  findings: { entityId?: string; message: string }[];
  changes: string[];
};
export function reviewEnvironmentImpact(
  draft: SpatialDraft,
  target: EnvironmentVersion,
  previous?: EnvironmentVersion,
): EnvironmentImpact {
  const findings: EnvironmentImpact["findings"] = [];
  const changes: string[] = [];
  if (previous && previous.reference.versionId !== target.reference.versionId) {
    if (previous.content.width !== target.content.width || previous.content.depth !== target.content.depth)
      changes.push(
        `Room bounds changed from ${previous.content.width} × ${previous.content.depth} m to ${target.content.width} × ${target.content.depth} m. Scene placements were checked against the new bounds.`,
      );
    if (JSON.stringify(previous.content.fixtures) !== JSON.stringify(target.content.fixtures))
      changes.push("Shared furniture or architecture changed. Review Scene clearances in the canvas.");
    if (previous.content.light !== target.content.light)
      changes.push("Environment base lighting changed; Scene presentation remains independent.");
    for (const placement of draft.content.environmentPlacements ?? []) {
      const before = previous.content.evidence.candidates.find((c) => c.id === placement.featureId);
      const after = target.content.evidence.candidates.find((c) => c.id === placement.featureId);
      if (before && after && JSON.stringify(before) !== JSON.stringify(after))
        changes.push(
          `Referenced feature ${placement.featureId} moved or changed. Review ${placement.entityId} before accepting this revision.`,
        );
    }
  }
  const features = new Map(target.content.evidence.candidates.map((c) => [c.id, c]));
  for (const placement of draft.content.environmentPlacements ?? []) {
    const feature = features.get(placement.featureId);
    if (!feature || !feature.safe || feature.occluded)
      findings.push({
        entityId: placement.entityId,
        message: `Referenced feature ${placement.featureId} is missing or unsafe. Choose another placement before updating.`,
      });
  }
  for (const entity of draft.content.entities) {
    if (draft.content.adaptive) continue;
    const position = previewEntityTransform(draft.content, entity.id).position;
    if (Math.abs(position.x) > target.content.width / 2 || Math.abs(position.z) > target.content.depth / 2)
      findings.push({ entityId: entity.id, message: `${entity.name} lies outside the revised Environment.` });
    const anchor = draft.content.anchors.find((a) => a.id === entity.anchorId);
    if (
      anchor?.kind === "SURFACE_RELATIVE" &&
      !(anchor.alignment === "HORIZONTAL" ? target.content.horizontal : target.content.vertical)
    )
      findings.push({
        entityId: entity.id,
        message: `${entity.name} needs a surface no longer offered by this Environment.`,
      });
  }
  if (draft.content.adaptive) {
    const resolution = resolveAdaptiveScene(
      draft.content,
      target.content.evidence,
      `environment-review-${target.reference.versionId}`,
    );
    if (resolution.status !== "RESOLVED")
      findings.push({
        message: "Semantic placement no longer resolves safely; review the Guided fallback or placement recipes.",
      });
  }
  for (const f of validateSpatialAuthoring(draft.content).filter((f) => f.severity === "ERROR"))
    findings.push({ entityId: f.entityId, message: f.message });
  return {
    sceneId: draft.content.definitionId,
    fromRevision: draft.content.environment?.revision ?? null,
    toRevision: target.reference.revision,
    status: findings.length
      ? "INVALID"
      : draft.content.environment?.checksum === target.reference.checksum &&
          draft.content.environment?.environmentId === target.reference.environmentId
        ? "CURRENT"
        : "REVIEW_REQUIRED",
    findings,
    changes,
  };
}
/** An ordinary undoable draft replacement. Never mutates another draft or release. */
export function updateSceneEnvironment(draft: SpatialDraft, target: EnvironmentVersion): SpatialDraft {
  const impact = reviewEnvironmentImpact(draft, target);
  if (impact.status === "INVALID") throw new Error(impact.findings.map((f) => f.message).join(" "));
  const next = structuredClone(draft);
  next.content.environment = structuredClone(target.reference);
  invalidateAdaptiveCalibration(next);
  return draftSchema.parse(next);
}
export function hauntedBedroomScenes(environment: EnvironmentVersion, identities: [string, string, string]) {
  const ordinary = createEnvironmentScene(identities[0], "Ordinary Room", environment);
  ordinary.content.sceneDescription = "The bedroom in daylight, with no supernatural behavior.";
  const haunting = createEnvironmentScene(identities[1], "The Haunting", environment);
  haunting.content.sceneDescription = "A spectral message appears after two seconds and glows on inspection.";
  const ghost = haunting.content.entities[0];
  ghost.name = "Spectral message";
  ghost.content = "Someone has been waiting in this room.";
  ghost.alternativeText = "A spectral message appears; inspect it to highlight the clue.";
  haunting.content.studio ??= emptyStudioContent();
  haunting.content.studio.layers[0].visible = false;
  haunting.content.studio.behaviors = [
    { id: `${identities[1]}:reveal`, trigger: "SCENE_ENTER", delayMs: 2000, targetEntityId: ghost.id, action: "SHOW" },
    {
      id: `${identities[1]}:glow`,
      trigger: "INSPECT",
      sourceEntityId: ghost.id,
      delayMs: 0,
      targetEntityId: ghost.id,
      action: "HIGHLIGHT",
    },
  ];
  const letter = createEnvironmentScene(identities[2], "The Hidden Letter", environment);
  letter.content.sceneDescription = "An independent letter holds the clue to the locked drawer.";
  letter.content.entities[0].name = "Letter beneath the window";
  letter.content.entities[0].kind = "PARCHMENT";
  letter.content.entities[0].content = "The key is hidden beneath the third floorboard.";
  return [ordinary, haunting, letter].map((d) => draftSchema.parse(d));
}
