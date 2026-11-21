import type { Candidate } from "./adaptive";
import { composeTransform, inverseTransform } from "./transforms";
import { identityTransform, type Transform } from "./contracts";

export function surfaceRotation(normal: Candidate["normal"]): Transform["rotation"] {
  const n = normal;
  const raw = n.z < -0.999999 ? { x: 0, y: 1, z: 0, w: 0 } : { x: -n.y, y: n.x, z: 0, w: 1 + n.z };
  const length = Math.hypot(raw.x, raw.y, raw.z, raw.w);
  return { x: raw.x / length, y: raw.y / length, z: raw.z / length, w: raw.w / length };
}
export function surfaceFrameRotation(surface: Candidate): Transform["rotation"] {
  return surface.rotation ?? surfaceRotation(surface.normal);
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
  const frame = { position: c.position, rotation: surfaceFrameRotation(c), scale: 1 };
  const local = composeTransform(inverseTransform(frame), {
    ...identityTransform(),
    position: world.position,
  }).position;
  const halfWidth = (widthMeters * world.scale) / 2,
    halfHeight = halfWidth * 0.75;
  if (
    Math.abs(local.z) > maximumDistance ||
    Math.abs(local.x) + halfWidth > c.widthMeters / 2 + 1e-6 ||
    Math.abs(local.y) + halfHeight > c.depthMeters / 2 + 1e-6 ||
    c.exclusions?.some(
      (r) => Math.abs(local.x - r.x) < r.width / 2 + halfWidth && Math.abs(local.y - r.y) < r.depth / 2 + halfHeight,
    )
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
  return resolveSurfaceSnap(world, surfaces, widthMeters)?.transform ?? world;
}

/** One query serves drag previews and release; retain a nearby valid target to avoid edge flicker. */
export function resolveSurfaceSnap(
  world: Transform,
  surfaces: readonly Candidate[],
  widthMeters: number,
  previousSurfaceId?: string,
): { candidate: Candidate; transform: Transform } | null {
  if (!surfacePointIsClear(world.position, surfaces, widthMeters * world.scale)) return null;
  const matches = surfaces
    .flatMap((candidate) => {
      const transform = placeOnSurface(world, candidate, widthMeters, 0.18);
      return transform
        ? [
            {
              candidate,
              transform,
              distance: Math.hypot(
                transform.position.x - world.position.x,
                transform.position.y - world.position.y,
                transform.position.z - world.position.z,
              ),
            },
          ]
        : [];
    })
    .sort((a, b) => a.distance - b.distance);
  const nearest = matches[0];
  if (!nearest) return null;
  const previous = matches.find((match) => match.candidate.id === previousSurfaceId);
  const chosen = previous && previous.distance <= nearest.distance + 0.025 ? previous : nearest;
  return { candidate: chosen.candidate, transform: chosen.transform };
}

export function surfacePointIsClear(
  point: Transform["position"],
  candidates: readonly Candidate[],
  width: number,
): boolean {
  return !candidates.some((c) => {
    if (c.safe && !c.context.some((x) => ["WALKWAY", "STAIRS", "OBSTACLE", "PRIVATE_REGION"].includes(x))) return false;
    const local = composeTransform(
      inverseTransform({ position: c.position, rotation: surfaceFrameRotation(c), scale: 1 }),
      { ...identityTransform(), position: point },
    ).position;
    return (
      Math.abs(local.z) < 0.2 &&
      Math.abs(local.x) < (c.widthMeters + width) / 2 &&
      Math.abs(local.y) < (c.depthMeters + width * 0.75) / 2
    );
  });
}

/** Keep the full plane, but choose a fitting point outside known furniture footprints. */
export function findSurfacePlacement(world: Transform, c: Candidate, width: number, search = true): Transform | null {
  const direct = placeOnSurface(world, c, width);
  if (direct || !search) return direct;
  const frame = { position: c.position, rotation: surfaceFrameRotation(c), scale: 1 };
  const points: Transform[] = [];
  const local = composeTransform(inverseTransform(frame), world).position;
  const halfWidth = (width * world.scale) / 2,
    halfHeight = halfWidth * 0.75;
  const limitX = c.widthMeters / 2 - halfWidth,
    limitY = c.depthMeters / 2 - halfHeight;
  if (limitX < 0 || limitY < 0) return null;
  const x = Math.max(-limitX, Math.min(limitX, local.x));
  const y = Math.max(-limitY, Math.min(limitY, local.y));
  const candidates: [number, number][] = [[x, y]];
  // Try exact obstruction edges before the coarse grid. A door or window
  // should move the note to the nearest clear wall, not to a distant grid cell.
  for (const r of c.exclusions ?? []) {
    const left = r.x - r.width / 2 - halfWidth - 0.005;
    const right = r.x + r.width / 2 + halfWidth + 0.005;
    const bottom = r.y - r.depth / 2 - halfHeight - 0.005;
    const top = r.y + r.depth / 2 + halfHeight + 0.005;
    candidates.push(
      [left, y],
      [right, y],
      [x, bottom],
      [x, top],
      [left, bottom],
      [left, top],
      [right, bottom],
      [right, top],
    );
  }
  for (const [x, y] of candidates) {
    const position = composeTransform(frame, { ...identityTransform(), position: { x, y, z: 0 } }).position;
    const fitted = placeOnSurface({ ...world, position }, c, width);
    if (fitted) points.push(fitted);
  }
  for (let x = -4; x <= 4; x++)
    for (let y = -4; y <= 4; y++) {
      const position = composeTransform(frame, {
        ...identityTransform(),
        position: { x: (x * c.widthMeters) / 10, y: (y * c.depthMeters) / 10, z: 0 },
      }).position;
      const fitted = placeOnSurface({ ...world, position }, c, width);
      if (fitted) points.push(fitted);
    }
  points.sort(
    (a, b) =>
      Math.hypot(a.position.x - world.position.x, a.position.y - world.position.y, a.position.z - world.position.z) -
      Math.hypot(b.position.x - world.position.x, b.position.y - world.position.y, b.position.z - world.position.z),
  );
  return points[0] ?? null;
}
