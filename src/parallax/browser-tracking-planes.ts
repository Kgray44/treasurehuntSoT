import { Matrix4, Quaternion, Ray, Vector3 } from "three";
import { resolvedTransformSchema } from "./contracts";
import { trackingRaySchema, type TrackingRay } from "./browser-tracking-rays";
import type { BrowserTrackingPlane } from "./browser-world-tracking";

/** Bounded detected horizontal planes only; never intersect an invented infinite floor. */
export function intersectTrackingPlanes(raw: TrackingRay, planes: readonly BrowserTrackingPlane[]) {
  const ray = trackingRaySchema.parse(raw);
  let nearest: { planeId: string; distance: number; transform: BrowserTrackingPlane["transform"] } | null = null;
  for (const plane of planes) {
    if (
      plane.evidence !== "DETECTED" ||
      plane.alignment !== "HORIZONTAL" ||
      ![plane.width, plane.depth].every(Number.isFinite) ||
      plane.width <= 0 ||
      plane.depth <= 0
    )
      continue;
    const parsed = resolvedTransformSchema.safeParse(plane.transform);
    if (!parsed.success || parsed.data.scale !== 1) continue;
    const { position: p, rotation: q } = parsed.data;
    const rotation = new Quaternion(q.x, q.y, q.z, q.w);
    if (Math.abs(rotation.lengthSq() - 1) > 0.02) continue;
    const matrix = new Matrix4().compose(new Vector3(p.x, p.y, p.z), rotation, new Vector3(1, 1, 1));
    const local = new Ray(
      new Vector3(ray.origin.x, ray.origin.y, ray.origin.z),
      new Vector3(ray.direction.x, ray.direction.y, ray.direction.z),
    ).applyMatrix4(matrix.clone().invert());
    if (Math.abs(local.direction.y) < 1e-6) continue;
    const distance = -local.origin.y / local.direction.y;
    if (distance <= 0 || (nearest && distance >= nearest.distance)) continue;
    const hit = local.at(distance, new Vector3());
    if (Math.abs(hit.x) > plane.width / 2 || Math.abs(hit.z) > plane.depth / 2) continue;
    hit.applyMatrix4(matrix);
    nearest = {
      planeId: plane.id,
      distance,
      transform: { ...parsed.data, position: { x: hit.x, y: hit.y, z: hit.z } },
    };
  }
  return nearest;
}
