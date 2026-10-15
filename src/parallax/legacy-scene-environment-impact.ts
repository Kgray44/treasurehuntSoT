// SC-01 schema-one impact rules retained without converting legacy fixtures into rich rooms.
import { previewEntityTransform, type SpatialDraft } from "./authoring";
import type { EnvironmentVersion } from "./legacy-scene-environment-contracts";
import { resolveAdaptiveScene } from "./adaptive";
import { validateSpatialAuthoring } from "./studio-validation";

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
