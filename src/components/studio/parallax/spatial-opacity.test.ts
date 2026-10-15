import { describe, expect, it } from "vitest";
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Points, PointsMaterial, BufferGeometry } from "three";
import { applySpatialOpacity, disposeSpatialOpacity, spatialMaterialOpacities } from "./spatial-opacity";

describe("actual spatial material opacity", () => {
  it("combines element envelopes and opacity on meshes and particles without caching a faded baseline", () => {
    const group = new Group();
    const mesh = new Mesh(new BoxGeometry(), new MeshStandardMaterial({ opacity: 0.8, transparent: true }));
    const particles = new Points(new BufferGeometry(), new PointsMaterial({ opacity: 0.6, transparent: true }));
    group.add(mesh, particles);
    applySpatialOpacity(group, 0.5, 0.25);
    expect(spatialMaterialOpacities(group)).toEqual([0.1, 0.075]);
    applySpatialOpacity(group, 0.5, 0.5);
    expect(spatialMaterialOpacities(group)).toEqual([0.2, 0.15]);
    applySpatialOpacity(group);
    expect(spatialMaterialOpacities(group)).toEqual([0.8, 0.6]);
    mesh.geometry.dispose();
    mesh.material.dispose();
    particles.geometry.dispose();
    particles.material.dispose();
  });
  it("samples without compounding intrinsic translucency or rebuilding geometry and restores authoring", () => {
    const group = new Group();
    const material = new MeshStandardMaterial({ opacity: 0.8, transparent: true, depthWrite: false });
    const mesh = new Mesh(new BoxGeometry(), material);
    group.add(mesh);
    const geometry = mesh.geometry;
    applySpatialOpacity(group, 0.5);
    expect(spatialMaterialOpacities(group)).toEqual([0.4]);
    applySpatialOpacity(group, 0.25);
    expect(spatialMaterialOpacities(group)).toEqual([0.2]);
    applySpatialOpacity(group, 0);
    expect(spatialMaterialOpacities(group)).toEqual([0]);
    applySpatialOpacity(group);
    expect(material.opacity).toBe(0.8);
    expect(material.transparent).toBe(true);
    expect(material.depthWrite).toBe(false);
    expect(mesh.geometry).toBe(geometry);
    expect(mesh.visible).toBe(true);
    mesh.geometry.dispose();
    material.dispose();
  });
  it("restores opaque materials and rejects invalid alpha before any material mutation", () => {
    const material = new MeshStandardMaterial(),
      mesh = new Mesh(new BoxGeometry(), material);
    applySpatialOpacity(mesh, 0.5);
    for (const invalid of [-0.1, 1.1, NaN, Infinity])
      expect(() => applySpatialOpacity(mesh, invalid)).toThrow("PARALLAX_RENDER_OPACITY_INVALID");
    expect(material.opacity).toBe(0.5);
    applySpatialOpacity(mesh);
    expect(material.opacity).toBe(1);
    expect(material.transparent).toBe(false);
    expect(material.depthWrite).toBe(true);
    mesh.geometry.dispose();
    material.dispose();
  });
  it("fades the directional shadow with an owned depth material and restores/disposes it", () => {
    const mesh = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
    mesh.castShadow = true;
    applySpatialOpacity(mesh, 0.5);
    const depth = mesh.customDepthMaterial!;
    expect(depth.opacity).toBe(0.5);
    expect(depth.alphaHash).toBe(true);
    applySpatialOpacity(mesh, 0);
    expect(mesh.customDepthMaterial).toBe(depth);
    expect(depth.opacity).toBe(0);
    applySpatialOpacity(mesh);
    expect(mesh.customDepthMaterial).toBeUndefined();
    let disposed = false;
    depth.addEventListener("dispose", () => {
      disposed = true;
    });
    disposeSpatialOpacity(mesh);
    expect(disposed).toBe(true);
    mesh.geometry.dispose();
    mesh.material.dispose();
  });
});
