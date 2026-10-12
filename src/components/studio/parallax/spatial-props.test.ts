import { describe, it, expect } from "vitest";
import * as T from "three";
import { paperSheetGeometry, compassProp } from "./spatial-props";

describe("authored spatial prop geometry", () => {
  it.each([false, true])("keeps paper closed, supported and bounded (folded %s)", (folded) => {
    const geometry = paperSheetGeometry(0.3, folded);
    const bounds = geometry.boundingBox!;
    expect(bounds.min.z).toBeGreaterThanOrEqual(0);
    expect(bounds.max.z).toBeGreaterThan(0.0008);
    expect(bounds.max.z).toBeLessThan(0.025);
    expect(bounds.max.x - bounds.min.x).toBeCloseTo(0.3);
    expect(bounds.max.y - bounds.min.y).toBeCloseTo(0.225);
    expect(geometry.index!.count / 3).toBeLessThan(200);
    const edges = new Map<string, number>();
    const index = geometry.index!;
    for (let i = 0; i < index.count; i += 3) {
      const triangle = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
      for (let edge = 0; edge < 3; edge++) {
        const key = [triangle[edge], triangle[(edge + 1) % 3]].sort((a, b) => a - b).join(":");
        edges.set(key, (edges.get(key) ?? 0) + 1);
      }
    }
    // Every shared edge has two incident faces: no open single-sided rim.
    expect([...edges.values()].every((count) => count === 2)).toBe(true);
    expect([...geometry.attributes.normal.array].every(Number.isFinite)).toBe(true);
    geometry.dispose();
  });

  it("keeps a volumetric compass above its support, with distinct dial/needle materials and a bounded budget", () => {
    const prop = compassProp(0.25, new T.Texture());
    const bounds = new T.Box3().setFromObject(prop);
    expect(bounds.min.z).toBeGreaterThanOrEqual(-1e-8);
    expect(bounds.max.z).toBeLessThan(0.25 * 0.11);
    expect(bounds.max.x - bounds.min.x).toBeLessThanOrEqual(0.25);
    const meshes = prop.children as T.Mesh[];
    expect(meshes).toHaveLength(6);
    const triangles = meshes.reduce(
      (sum, mesh) => sum + (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3,
      0,
    );
    expect(triangles).toBeLessThan(2000);
    expect(meshes.some((mesh) => (mesh.material as T.MeshStandardMaterial).metalness > 0.8)).toBe(true);
    expect(meshes.filter((mesh) => mesh.material instanceof T.MeshStandardMaterial && mesh.material.map)).toHaveLength(
      1,
    );
    for (const mesh of meshes) {
      mesh.geometry.dispose();
      (mesh.material as T.Material).dispose();
    }
  });
});
