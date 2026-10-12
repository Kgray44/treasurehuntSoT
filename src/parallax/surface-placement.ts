import type { Candidate } from "./adaptive";
import { composeTransform, inverseTransform } from "./transforms";
import { identityTransform, type Transform } from "./contracts";
import { editSpatialDraft, previewEntityTransform, type SpatialDraft } from "./authoring";

/** Native placement must request the selected plane's alignment as well as its pose. */
export function snapSpatialEntity(
  input: SpatialDraft,
  entityId: string,
  world: Transform,
  surface: Candidate,
  environmentId = "bedroom",
): SpatialDraft {
  const next = editSpatialDraft(input, {
    type: "PLACEMENT",
    entityId,
    placement: surface.surface === "WALL" ? "WALL" : "DESK",
  });
  const entity = next.content.entities.find((e) => e.id === entityId)!;
  const studio = next.content.studio!;
  studio.surfacePreviewFrames = [
    ...(studio.surfacePreviewFrames ?? []).filter((f) => f.anchorId !== entity.anchorId),
    {
      anchorId: entity.anchorId,
      environmentId,
      surfaceId: surface.id,
      position: surface.position,
      rotation: surfaceRotation(surface.normal),
    },
  ];
  const parent = previewEntityTransform(next.content, entityId);
  return editSpatialDraft(next, {
    type: "TRANSFORM",
    entityId,
    transform: composeTransform(inverseTransform(parent), world),
  });
}

export function surfaceRotation(normal: Candidate["normal"]): Transform["rotation"] {
  const n = normal;
  const raw = n.z < -0.999999 ? { x: 0, y: 1, z: 0, w: 0 } : { x: -n.y, y: n.x, z: 0, w: 1 + n.z };
  const length = Math.hypot(raw.x, raw.y, raw.z, raw.w);
  return { x: raw.x / length, y: raw.y / length, z: raw.z / length, w: raw.w / length };
}

/** Snap only inside a real planar face, with a small separation to prevent z-fighting. */
export function placeOnSurface(
  world: Transform,
  c: Candidate,
  widthMeters: number,
  maximumDistance = Infinity,
): Transform | null {
  if (c.surface === "OPEN_SPACE" || c.surface === "DEVICE") return null;
  if (!c.safe || c.context.some((x) => ["WALKWAY", "STAIRS", "OBSTACLE", "PRIVATE_REGION"].includes(x))) return null;
  const frame = { position: c.position, rotation: surfaceRotation(c.normal), scale: 1 };
  const local = composeTransform(inverseTransform(frame), {
    ...identityTransform(),
    position: world.position,
  }).position;
  const halfWidth = (widthMeters * world.scale) / 2,
    halfHeight = halfWidth * 0.75;
  if (
    Math.abs(local.z) > maximumDistance ||
    Math.abs(local.x) + halfWidth > c.widthMeters / 2 ||
    Math.abs(local.y) + halfHeight > c.depthMeters / 2
  )
    return null;
  return {
    position: composeTransform(frame, { ...identityTransform(), position: { x: local.x, y: local.y, z: 0.01 } })
      .position,
    rotation: frame.rotation,
    scale: world.scale,
  };
}

export function snapToNearestSurface(world: Transform, surfaces: readonly Candidate[], widthMeters: number): Transform {
  if (!surfacePointIsClear(world.position, surfaces, widthMeters * world.scale)) return world;
  const matches = surfaces
    .map((c) => placeOnSurface(world, c, widthMeters, 0.18))
    .filter((t): t is Transform => t !== null);
  matches.sort(
    (a, b) =>
      Math.hypot(a.position.x - world.position.x, a.position.y - world.position.y, a.position.z - world.position.z) -
      Math.hypot(b.position.x - world.position.x, b.position.y - world.position.y, b.position.z - world.position.z),
  );
  return matches[0] ?? world;
}

export function surfacePointIsClear(
  point: Transform["position"],
  candidates: readonly Candidate[],
  width: number,
): boolean {
  return !candidates.some((c) => {
    if (c.safe && !c.context.some((x) => ["WALKWAY", "STAIRS", "OBSTACLE", "PRIVATE_REGION"].includes(x))) return false;
    const local = composeTransform(
      inverseTransform({ position: c.position, rotation: surfaceRotation(c.normal), scale: 1 }),
      { ...identityTransform(), position: point },
    ).position;
    return (
      Math.abs(local.z) < 0.2 &&
      Math.abs(local.x) < (c.widthMeters + width) / 2 &&
      Math.abs(local.y) < (c.depthMeters + width * 0.75) / 2
    );
  });
}
