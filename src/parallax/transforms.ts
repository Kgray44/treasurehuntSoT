import { resolvedTransformSchema, type Transform } from "./contracts";

/** SI meters, right-handed +Y up; the viewer looks toward -Z. */
export function composeTransform(parent: Transform, child: Transform): Transform {
  resolvedTransformSchema.parse(parent);
  resolvedTransformSchema.parse(child);
  const p = parent.rotation,
    c = child.rotation,
    v = child.position;
  const tx = 2 * (p.y * v.z - p.z * v.y),
    ty = 2 * (p.z * v.x - p.x * v.z),
    tz = 2 * (p.x * v.y - p.y * v.x);
  const position = {
    x: parent.position.x + parent.scale * (v.x + p.w * tx + p.y * tz - p.z * ty),
    y: parent.position.y + parent.scale * (v.y + p.w * ty + p.z * tx - p.x * tz),
    z: parent.position.z + parent.scale * (v.z + p.w * tz + p.x * ty - p.y * tx),
  };
  const rotation = {
    x: p.w * c.x + p.x * c.w + p.y * c.z - p.z * c.y,
    y: p.w * c.y - p.x * c.z + p.y * c.w + p.z * c.x,
    z: p.w * c.z + p.x * c.y - p.y * c.x + p.z * c.w,
    w: p.w * c.w - p.x * c.x - p.y * c.y - p.z * c.z,
  };
  return resolvedTransformSchema.parse({ position, rotation, scale: parent.scale * child.scale });
}
export function inverseTransform(t: Transform): Transform {
  resolvedTransformSchema.parse(t);
  const q = { x: -t.rotation.x, y: -t.rotation.y, z: -t.rotation.z, w: t.rotation.w };
  return composeTransform(
    { position: { x: 0, y: 0, z: 0 }, rotation: q, scale: 1 / t.scale },
    {
      position: { x: -t.position.x, y: -t.position.y, z: -t.position.z },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      scale: 1,
    },
  );
}
