import { Material, Mesh, Points, MeshDepthMaterial, Object3D, RGBADepthPacking } from "three";

const originals = new WeakMap<Material, { opacity: number; transparent: boolean; depthWrite: boolean }>();
const shadows = new WeakMap<Mesh, { original: Material | undefined; owned: MeshDepthMaterial }>();

/** Multiply the authored material once; sampling must never compound alpha. */
export function applySpatialOpacity(root: Object3D, opacity?: number, envelope = 1) {
  if (opacity !== undefined && (!Number.isFinite(opacity) || opacity < 0 || opacity > 1))
    throw new Error("PARALLAX_RENDER_OPACITY_INVALID");
  if (!Number.isFinite(envelope) || envelope < 0 || envelope > 1) throw new Error("PARALLAX_RENDER_OPACITY_INVALID");
  const animated = opacity !== undefined || envelope !== 1;
  root.traverse((part) => {
    if (!(part instanceof Mesh || part instanceof Points)) return;
    for (const material of Array.isArray(part.material) ? part.material : [part.material]) {
      let base = originals.get(material);
      if (!base) {
        base = { opacity: material.opacity, transparent: material.transparent, depthWrite: material.depthWrite };
        originals.set(material, base);
      }
      const transparent = animated || base.transparent;
      if (material.transparent !== transparent) {
        material.transparent = transparent;
        material.needsUpdate = true;
      }
      material.opacity = base.opacity * (opacity ?? 1) * envelope;
      material.depthWrite = animated ? false : base.depthWrite;
    }
    if (part instanceof Mesh && part.castShadow && !Array.isArray(part.material)) {
      let shadow = shadows.get(part);
      if (animated && !shadow) {
        shadow = {
          original: part.customDepthMaterial,
          owned: new MeshDepthMaterial({ depthPacking: RGBADepthPacking, alphaHash: true }),
        };
        shadows.set(part, shadow);
      }
      if (shadow) {
        shadow.owned.opacity = part.material.opacity;
        part.customDepthMaterial = animated ? shadow.owned : shadow.original;
      }
    }
  });
}

export function disposeSpatialOpacity(root: Object3D) {
  root.traverse((part) => {
    if (!(part instanceof Mesh)) return;
    const shadow = shadows.get(part);
    if (shadow) {
      part.customDepthMaterial = shadow.original;
      shadow.owned.dispose();
      shadows.delete(part);
    }
  });
}

/** Actual mesh material values, independent of the animation's numeric sample. */
export function spatialMaterialOpacities(root: Object3D) {
  const values: number[] = [];
  root.traverse((part) => {
    if (part instanceof Mesh || part instanceof Points)
      for (const material of Array.isArray(part.material) ? part.material : [part.material])
        values.push(material.opacity);
  });
  return values;
}
