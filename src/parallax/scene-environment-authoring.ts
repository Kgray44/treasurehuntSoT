import { createSpatialDraft, draftSchema, previewEntityTransform, type SpatialDraft } from "./authoring";
import type { CompatibleEnvironmentRecord } from "./environment-library-compatibility";
import type { EnvironmentReference } from "./environment-reference";
import type { RoomEnvironment } from "./environment-contracts";
import type { EnvironmentVersion as LegacyVersion } from "./legacy-scene-environment-contracts";
import { reviewEnvironmentImpact, type EnvironmentImpact } from "./legacy-scene-environment-impact";
import { invalidateAdaptiveCalibration } from "./adaptive-authoring";
import { validateSpatialAuthoring } from "./studio-validation";
import { syntheticRoomGeometry } from "./room-geometry";
import { boundRoomSurfaceIds } from "./parametric-room";

export type SceneEnvironmentVersion = LegacyVersion | { reference: EnvironmentReference; room: RoomEnvironment | null };
export const sceneEnvironmentId = (draft: SpatialDraft) =>
  draft.content.environment?.environmentId ?? draft.content.studio?.environmentBinding?.definitionId ?? null;
export const environmentVersionName = (version: SceneEnvironmentVersion) =>
  "content" in version ? version.content.name : (version.room?.name ?? version.reference.environmentId);
export function latestEnvironmentVersion(record: CompatibleEnvironmentRecord) {
  return record.versions.reduce<SceneEnvironmentVersion | null>(
    (best, version) => (!best || version.reference.revision > best.reference.revision ? version : best),
    null,
  );
}

/** Shared support comparison for the ordinary use transaction and its Manager preview.
 * Fixed numeric tuples preserve the existing geometry comparison without hashing in the browser.
 */
export function changedEnvironmentSupportIds(draft: SpatialDraft, room: RoomEnvironment) {
  const before = draft.content.studio?.environment;
  if (!before) return [];
  const old = syntheticRoomGeometry({ ...before, horizontal: true, vertical: true });
  const fresh = syntheticRoomGeometry({ ...room, horizontal: true, vertical: true });
  const comparable = (part: (typeof old)[number]) =>
    JSON.stringify([
      part.position,
      part.size,
      part.rotation ? [part.rotation.x, part.rotation.y, part.rotation.z, part.rotation.w] : null,
      part.face,
    ]);
  return boundRoomSurfaceIds(draft.content).filter((id) => {
    const a = old.find((part) => part.id === id),
      b = fresh.find((part) => part.id === id);
    return !a || !b || comparable(a) !== comparable(b);
  });
}
function withVersion(draft: SpatialDraft, version: SceneEnvironmentVersion) {
  const next = structuredClone(draft);
  next.content.environment = structuredClone(version.reference);
  if ("content" in version) {
    if (next.content.studio) {
      delete next.content.studio.environment;
      delete next.content.studio.environmentBinding;
    }
  } else {
    if (!version.room) throw new Error("This Environment version has no constructed room.");
    next.content.studio!.environment = structuredClone(version.room);
    // An immutable root pin is sufficient. A moving editor CAS source is not fabricated.
    delete next.content.studio!.environmentBinding;
  }
  invalidateAdaptiveCalibration(next);
  return next;
}
export function reviewSceneEnvironmentImpact(
  draft: SpatialDraft,
  target: SceneEnvironmentVersion,
  previous?: SceneEnvironmentVersion,
): EnvironmentImpact {
  if ("content" in target)
    return reviewEnvironmentImpact(draft, target, previous && "content" in previous ? previous : undefined);
  const room = target.room;
  if (!room)
    return {
      sceneId: draft.content.definitionId,
      fromRevision: draft.content.environment?.revision ?? null,
      toRevision: target.reference.revision,
      status: "INVALID",
      changes: [],
      findings: [{ message: "This version has no constructed room." }],
    };
  const findings: EnvironmentImpact["findings"] = [];
  const changes: string[] = [];
  for (const id of changedEnvironmentSupportIds(draft, room))
    findings.push({
      message:
        "Attached support " +
        id +
        " moved, changed or was removed. Move its assets to another support or detach them before updating.",
    });
  const features = new Set(
    room.features
      .filter((feature) => feature.classification !== "EXCLUSION_ZONE")
      .flatMap((feature) => [
        feature.id,
        ...feature.parts.filter((part) => part.surface !== null).map((part) => part.id),
      ]),
  );
  for (const placement of draft.content.environmentPlacements ?? [])
    if (!features.has(placement.featureId))
      findings.push({
        entityId: placement.entityId,
        message: "Referenced feature " + placement.featureId + " is missing or excluded.",
      });
  const next = withVersion(draft, target);
  for (const finding of validateSpatialAuthoring(next.content).filter((finding) => finding.severity === "ERROR"))
    findings.push({ entityId: finding.entityId, message: finding.message });
  if (!next.content.adaptive)
    for (const entity of next.content.entities) {
      const position = previewEntityTransform(next.content, entity.id, room.id, {
        ...room,
        horizontal: true,
        vertical: true,
      }).position;
      if (Math.abs(position.x) > room.width / 2 || Math.abs(position.z) > room.depth / 2)
        findings.push({ entityId: entity.id, message: entity.name + " lies outside the revised Environment." });
    }
  if (previous && !("content" in previous) && previous.room) {
    if (previous.room.width !== room.width || previous.room.depth !== room.depth)
      changes.push(
        "Room bounds changed from " +
          previous.room.width +
          " × " +
          previous.room.depth +
          " m to " +
          room.width +
          " × " +
          room.depth +
          " m.",
      );
    if (JSON.stringify(previous.room.features) !== JSON.stringify(room.features))
      changes.push("Shared architecture or furniture changed. Review the Scene in the canvas.");
    if (previous.room.light !== room.light)
      changes.push("Environment base lighting changed; Scene overrides stay independent.");
  }
  return {
    sceneId: draft.content.definitionId,
    fromRevision: draft.content.environment?.revision ?? null,
    toRevision: target.reference.revision,
    findings,
    changes,
    status: findings.length
      ? "INVALID"
      : draft.content.environment?.versionId === target.reference.versionId &&
          draft.content.environment.environmentId === target.reference.environmentId &&
          draft.content.environment.checksum === target.reference.checksum
        ? "CURRENT"
        : "REVIEW_REQUIRED",
  };
}
/** Ordinary draft replacement; the host uses canonical save/CAS and history. */
export function updateSceneEnvironmentVersion(draft: SpatialDraft, target: SceneEnvironmentVersion) {
  const impact = reviewSceneEnvironmentImpact(draft, target);
  if (impact.status === "INVALID") throw new Error(impact.findings.map((finding) => finding.message).join(" "));
  return draftSchema.parse(withVersion(draft, target));
}
export function createSceneFromEnvironment(
  id: string,
  title: string,
  version: SceneEnvironmentVersion,
  chronicleId: string | null = null,
  startingContent = "BASELINE",
) {
  const draft = createSpatialDraft(id, startingContent === "BASELINE" ? "Desk Map" : startingContent, chronicleId);
  draft.library = { type: "SCENE", description: "" };
  draft.content.title = title;
  draft.content.sceneDescription = "An independent Scene in this shared Environment.";
  if (startingContent === "BASELINE") {
    const description =
      "content" in version
        ? version.content.description
        : "An ordinary room in " + environmentVersionName(version) + ".";
    Object.assign(draft.content.entities[0], {
      name: "Room description",
      kind: "TEXT",
      content: description,
      alternativeText: description,
    });
  }
  if (startingContent === "Ghost Footprint Trail") {
    draft.content.anchors[0].transform.position.z = 0;
    const depth = "content" in version ? version.content.depth : (version.room?.depth ?? 2);
    const span = Math.min(1.6, depth * 0.8);
    for (const [index, entity] of draft.content.entities.entries())
      entity.transform.position.z = span / 2 - (index * span) / (draft.content.entities.length - 1);
  }
  return draftSchema.parse(withVersion(draft, version));
}
