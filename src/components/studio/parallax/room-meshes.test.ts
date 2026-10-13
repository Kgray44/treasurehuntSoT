import { expect, it, vi } from "vitest";
import * as T from "three";
import { trailTerrainGeometry, createRoomMeshLibrary, instanceRoomFurniture, renderedRoomBounds } from "./room-meshes";
import { syntheticRoomGeometry } from "@/parallax/room-geometry";
import { reconstructRoomFromObservation } from "@/parallax/room-reconstruction";

it.each([
  [0, 2.4, 1.1, [1, 0, 0]],
  [90, 1.1, 2.4, [0, 0, -1]],
  [-90, 1.1, 2.4, [0, 0, 1]],
  [180, 2.4, 1.1, [-1, 0, 0]],
  [
    35,
    2.4 * Math.cos((35 * Math.PI) / 180) + 1.1 * Math.sin((35 * Math.PI) / 180),
    2.4 * Math.sin((35 * Math.PI) / 180) + 1.1 * Math.cos((35 * Math.PI) / 180),
    [Math.cos((35 * Math.PI) / 180), 0, -Math.sin((35 * Math.PI) / 180)],
  ],
])(
  "preserves observed table width/depth and %s-degree heading through actual mesh and instance bounds",
  (yaw, width, depth, direction) => {
    const context = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
      putImageData: () => {},
    } as unknown as CanvasRenderingContext2D);
    const library = createRoomMeshLibrary(),
      world = new T.Group();
    try {
      const proposal = reconstructRoomFromObservation({
        roomId: "axis-test",
        sourceMediaIds: ["synthetic-image"],
        observation: {
          status: "OBSERVED",
          explanation: "Synthetic elongated worktable",
          clarification: null,
          alignment: "INITIAL_ROOM",
          sharedFeatureId: null,
          roomDimensions: [8, 3, 8],
          dimensionBasis: "ESTIMATED",
          uncertainties: [],
          features: [
            {
              matchedFeatureId: null,
              name: "Worktable",
              classification: "TABLE",
              position: { x: 0.3, y: 0.45, z: -0.2 },
              dimensions: [2.4, 0.9, 1.1],
              yawDegrees: yaw as number,
              confidence: 0.8,
              basis: "DIRECTLY_OBSERVED",
              attachment: "FLOOR",
            },
          ],
        },
      });
      if (proposal.status !== "PROPOSED") throw new Error("Expected proposal");
      const table = proposal.room.features.find((feature) => feature.classification === "TABLE")!;
      expect(table.yawDegrees).toBe(yaw);
      expect(table.dimensions).toEqual([2.4, 0.9, 1.1]);
      for (const part of syntheticRoomGeometry({ ...proposal.room, horizontal: true, vertical: true }).filter(
        (part) => part.featureId === table.id,
      )) {
        const root = new T.Group();
        root.position.set(...part.position);
        root.quaternion.set(part.rotation!.x, part.rotation!.y, part.rotation!.z, part.rotation!.w);
        root.userData = { featureId: part.featureId, roomPartId: part.id, classification: part.classification };
        library.build(root, part, part.color!);
        world.add(root);
      }
      const top = world.children.find((part) => part.userData.roomPartId.endsWith(":top"))!;
      const actualDirection = new T.Vector3(1, 0, 0).applyQuaternion(top.quaternion).toArray();
      actualDirection.forEach((value, index) => expect(value).toBeCloseTo((direction as number[])[index], 6));
      for (const instanced of [false, true]) {
        if (instanced) instanceRoomFurniture(world);
        const bounds = renderedRoomBounds(world)[0];
        expect(bounds.max[0] - bounds.min[0]).toBeCloseTo(width as number, 5);
        expect(bounds.max[2] - bounds.min[2]).toBeCloseTo(depth as number, 5);
      }
    } finally {
      library.dispose();
      context.mockRestore();
    }
  },
);
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
