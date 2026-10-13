import { Material, Mesh, MeshDepthMaterial, Object3D, RGBADepthPacking } from "three";

const originals = new WeakMap<Material, { opacity: number; transparent: boolean; depthWrite: boolean }>();
const shadows = new WeakMap<Mesh, { original: Material | undefined; owned: MeshDepthMaterial }>();

/** Multiply the authored material once; sampling must never compound alpha. */
export function applySpatialOpacity(root: Object3D, opacity?: number) {
  if (opacity !== undefined && (!Number.isFinite(opacity) || opacity < 0 || opacity > 1))
    throw new Error("PARALLAX_RENDER_OPACITY_INVALID");
  root.traverse((part) => {
    if (!(part instanceof Mesh)) return;
    for (const material of Array.isArray(part.material) ? part.material : [part.material]) {
      let base = originals.get(material);
      if (!base) {
        base = { opacity: material.opacity, transparent: material.transparent, depthWrite: material.depthWrite };
        originals.set(material, base);
      }
      const transparent = opacity !== undefined || base.transparent;
      if (material.transparent !== transparent) {
        material.transparent = transparent;
        material.needsUpdate = true;
      }
      material.opacity = base.opacity * (opacity ?? 1);
      material.depthWrite = opacity !== undefined ? false : base.depthWrite;
    }
    if (part.castShadow && !Array.isArray(part.material)) {
      let shadow = shadows.get(part);
      if (opacity !== undefined && !shadow) {
        shadow = {
          original: part.customDepthMaterial,
          owned: new MeshDepthMaterial({ depthPacking: RGBADepthPacking, alphaHash: true }),
        };
        shadows.set(part, shadow);
      }
      if (shadow) {
        shadow.owned.opacity = part.material.opacity;
        part.customDepthMaterial = opacity === undefined ? shadow.original : shadow.owned;
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
    if (part instanceof Mesh)
      for (const material of Array.isArray(part.material) ? part.material : [part.material])
        values.push(material.opacity);
  });
  return values;
}
