import { expect, it } from "vitest";
import * as T from "three";
import { trailTerrainGeometry, createRoomMeshLibrary, instanceRoomFurniture, renderedRoomBounds } from "./room-meshes";
it("constructs a closed finite terrain volume with rolling banks and a level continuous path strip", () => {
  const geometry = trailTerrainGeometry(3, 0.16, 12),
    edges = new Map<string, number>(),
    indices = geometry.index!.array;
  for (let i = 0; i < indices.length; i += 3)
    for (const [a, b] of [
      [indices[i], indices[i + 1]],
      [indices[i + 1], indices[i + 2]],
      [indices[i + 2], indices[i]],
    ]) {
      const key = [a, b].sort((a, b) => a - b).join(":");
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
  expect([...edges.values()].every((count) => count === 2)).toBe(true);
  expect(indices.length / 3).toBeLessThan(3500);
  const positions = geometry.getAttribute("position"),
    normals = geometry.getAttribute("normal");
  expect([...normals.array].every(Number.isFinite)).toBe(true);
  const topCount = positions.count / 2;
  let slopes = 0;
  for (let i = 0; i < topCount; i++)
    if (Math.abs(positions.getX(i)) < 0.55) expect(positions.getY(i)).toBeCloseTo(0.08);
    else if (positions.getY(i) < 0.07) slopes++;
  expect(slopes).toBeGreaterThan(100);
  geometry.dispose();
});
it("instances repeated meshes without losing exact feature bounds or architectural cutaway ownership", () => {
  const library = createRoomMeshLibrary(),
    world = new T.Group();
  for (let i = 0; i < 4; i++) {
    const root = new T.Group();
    root.position.set(i, 0.5, 0);
    root.userData = { featureId: `chair-${i}`, roomPartId: `chair-${i}-seat`, classification: "CHAIR" };
    root.add(library.mesh("BOX", [0.4, 0.1, 0.4], [0, 0, 0], 0x888888));
    world.add(root);
  }
  const wall = new T.Group();
  wall.userData = { featureId: "wall", roomPartId: "wall-body", classification: "WALL" };
  wall.add(library.mesh("BOX", [4, 2.8, 0.16], [0, 1.4, -2], 0x888888));
  world.add(wall);
  const before = renderedRoomBounds(world);
  instanceRoomFurniture(world);
  expect(world.children.filter((o) => o instanceof T.InstancedMesh)).toHaveLength(1);
  expect(wall.children).toHaveLength(1);
  for (const receipt of renderedRoomBounds(world)) {
    const original = before.find((value) => value.id === receipt.id)!;
    expect(receipt.partIds).toEqual(original.partIds);
    receipt.min.forEach((value, axis) => expect(value).toBeCloseTo(original.min[axis], 6));
    receipt.max.forEach((value, axis) => expect(value).toBeCloseTo(original.max[axis], 6));
  }
  const batch = world.children.find((o) => o instanceof T.InstancedMesh) as T.InstancedMesh;
  expect(batch.count).toBe(4);
  batch.dispose();
  library.dispose();
});
