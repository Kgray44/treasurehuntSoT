import * as T from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import type { RoomGeometry } from "@/parallax/room-geometry";
import { trailElevation } from "@/parallax/terrain";

/** Closed terrain volume with a continuous level walking strip and rolling banks. */
export function trailTerrainGeometry(width: number, height: number, depth: number) {
  const nx = 16,
    nz = 48,
    count = (nx + 1) * (nz + 1),
    vertices: number[] = [],
    uv: number[] = [],
    indices: number[] = [];
  for (let layer = 0; layer < 2; layer++)
    for (let z = 0; z <= nz; z++)
      for (let x = 0; x <= nx; x++) {
        const px = (x / nx - 0.5) * width,
          pz = (z / nz - 0.5) * depth;
        vertices.push(px, layer === 0 ? height / 2 + trailElevation(px, pz, width, depth) : -height / 2, pz);
        uv.push(x / nx, z / nz);
      }
  for (let z = 0; z < nz; z++)
    for (let x = 0; x < nx; x++) {
      const a = z * (nx + 1) + x,
        b = a + 1,
        c = a + nx + 1,
        d = c + 1;
      indices.push(a, c, b, b, c, d, a + count, b + count, c + count, b + count, d + count, c + count);
    }
  const edge = (a: number, b: number) => indices.push(a, b, a + count, b, b + count, a + count);
  for (let x = 0; x < nx; x++) {
    edge(x, x + 1);
    edge(nz * (nx + 1) + x + 1, nz * (nx + 1) + x);
  }
  for (let z = 0; z < nz; z++) {
    edge((z + 1) * (nx + 1), z * (nx + 1));
    edge(z * (nx + 1) + nx, (z + 1) * (nx + 1) + nx);
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
type Family = "PLAIN" | "WOOD" | "FABRIC" | "GROUND" | "PATH";

/** Workstation-owned mesh/texture pools. Rebuilding a room reuses unit geometry;
 * shutdown disposes it once. No external texture/model dependencies.
 */
export function createRoomMeshLibrary() {
  const geometries = new Map<string, T.BufferGeometry>(),
    materials = new Map<string, T.MeshStandardMaterial>(),
    textures = new Map<Family, T.CanvasTexture>();
  const geometry = (shape: string) => {
    let found = geometries.get(shape);
    if (found) return found;
    found =
      shape === "ROUNDED_BOX"
        ? new RoundedBoxGeometry(1, 1, 1, 2, 0.055)
        : shape === "CYLINDER"
          ? new T.CylinderGeometry(0.5, 0.5, 1, 16)
          : shape === "CONE"
            ? new T.ConeGeometry(0.5, 1, 12)
            : shape === "ELLIPSOID"
              ? new T.SphereGeometry(0.5, 16, 12)
              : new T.BoxGeometry(1, 1, 1);
    found.userData.roomShared = true;
    geometries.set(shape, found);
    return found;
  };
  const texture = (family: Family) => {
    let found = textures.get(family);
    if (found) return found;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 128;
    const context = canvas.getContext("2d")!;
    const pixels = context.createImageData(128, 128);
    for (let y = 0; y < 128; y++)
      for (let x = 0; x < 128; x++) {
        const grain =
          family === "WOOD"
            ? Math.sin(y * 0.53 + Math.sin(x * 0.047) * 2) * 11
            : family === "FABRIC"
              ? x % 4 === 0 || y % 4 === 0
                ? -13
                : 5
              : Math.sin(x * 17.13 + y * 71.7) * Math.cos(x * 3.7 - y * 19.3) * 16;
        const value = Math.round(228 + grain),
          i = (y * 128 + x) * 4;
        pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = value;
        pixels.data[i + 3] = 255;
      }
    context.putImageData(pixels, 0, 0);
    found = new T.CanvasTexture(canvas);
    found.colorSpace = T.SRGBColorSpace;
    found.wrapS = found.wrapT = T.RepeatWrapping;
    found.repeat.set(family === "WOOD" ? 2 : 5, family === "WOOD" ? 5 : 5);
    textures.set(family, found);
    return found;
  };
  const material = (color: number, family: Family = "PLAIN") => {
    const key = `${color}:${family}`;
    let found = materials.get(key);
    if (found) return found;
    found = new T.MeshStandardMaterial({
      color,
      roughness: family === "FABRIC" ? 0.95 : family === "WOOD" ? 0.63 : 0.78,
      metalness: 0,
      ...(family === "PLAIN" ? {} : { map: texture(family) }),
    });
    found.userData.roomShared = true;
    materials.set(key, found);
    return found;
  };
  const mesh = (shape: string, size: number[], position: number[], color: number, family: Family = "PLAIN") => {
    const built = new T.Mesh(geometry(shape), material(color, family));
    built.scale.set(size[0], size[1], size[2]);
    built.position.set(position[0], position[1], position[2]);
    built.castShadow = built.receiveShadow = true;
    return built;
  };
  return {
    mesh,
    glass(size: number[], position: number[], color: number) {
      const key = `glass:${color}`;
      let glass = materials.get(key);
      if (!glass) {
        glass = new T.MeshStandardMaterial({
          color,
          roughness: 0.15,
          metalness: 0.05,
          transparent: true,
          opacity: 0.3,
          depthWrite: false,
        });
        glass.userData.roomShared = true;
        materials.set(key, glass);
      }
      const pane = new T.Mesh(geometry("BOX"), glass);
      pane.scale.set(size[0], size[1], size[2]);
      pane.position.set(position[0], position[1], position[2]);
      return pane;
    },
    build(group: T.Group, g: RoomGeometry, color: number) {
      const [w, h, d] = g.size;
      const family: Family =
        g.shape === "PATH"
          ? "PATH"
          : g.shape === "TERRAIN"
            ? "GROUND"
            : g.classification === "FLOOR"
              ? "WOOD"
              : ["SOFA", "CHAIR", "BED"].includes(g.classification ?? "") && g.surface !== null
                ? "FABRIC"
                : ["TABLE", "DESK", "CABINET", "WARDROBE", "SHELF", "DOOR"].includes(g.classification ?? "")
                  ? "WOOD"
                  : "PLAIN";
      if (g.shape === "TREE") {
        const r = Math.min(w, d);
        group.add(mesh("CYLINDER", [r * 0.2, h * 0.6, r * 0.2], [0, -h * 0.2, 0], 0x766047, "WOOD"));
        for (let i = 0; i < 3; i++)
          group.add(
            mesh(
              "CONE",
              [r * (1 - i * 0.16), h * 0.4, r * (1 - i * 0.16)],
              [0, -h / 2 + h * (0.48 + i * 0.15), 0],
              color,
            ),
          );
      } else if (g.shape === "TERRAIN") {
        const built = new T.Mesh(trailTerrainGeometry(w, h, d), material(color, family));
        built.receiveShadow = true;
        group.add(built);
      } else group.add(mesh(g.shape ?? "BOX", g.size, [0, 0, 0], color, family));
    },
    dispose() {
      for (const g of geometries.values()) g.dispose();
      for (const m of materials.values()) m.dispose();
      for (const t of textures.values()) t.dispose();
      geometries.clear();
      materials.clear();
      textures.clear();
    },
  };
}

/** Batch repeated furnishing solids across features. Keep exact instance-to-part
 * ownership for receipts; architectural cutaways remain ordinary separate groups.
 */
export function instanceRoomFurniture(world: T.Group) {
  const batches = new Map<
    string,
    { geometry: T.BufferGeometry; material: T.Material; items: { mesh: T.Mesh; root: T.Object3D; matrix: T.Matrix4 }[] }
  >();
  world.updateMatrixWorld(true);
  for (const root of world.children) {
    if (["FLOOR", "WALL", "CEILING", "DOOR", "WINDOW"].includes(root.userData.classification)) continue;
    for (const child of [...root.children]) {
      if (
        !(child instanceof T.Mesh) ||
        Array.isArray(child.material) ||
        !child.geometry.userData.roomShared ||
        !child.material.userData.roomShared
      )
        continue;
      const key = `${child.geometry.uuid}:${child.material.uuid}`;
      const batch: {
        geometry: T.BufferGeometry;
        material: T.Material;
        items: { mesh: T.Mesh; root: T.Object3D; matrix: T.Matrix4 }[];
      } = batches.get(key) ?? { geometry: child.geometry, material: child.material, items: [] };
      batch.items.push({ mesh: child, root, matrix: child.matrixWorld.clone() });
      batches.set(key, batch);
    }
  }
  for (const batch of batches.values()) {
    if (batch.items.length < 2) continue;
    const instances = new T.InstancedMesh(batch.geometry, batch.material, batch.items.length);
    instances.castShadow = instances.receiveShadow = true;
    instances.userData.roomInstances = batch.items.map((item, index) => {
      instances.setMatrixAt(index, item.matrix);
      item.root.remove(item.mesh);
      return { featureId: item.root.userData.featureId, partId: item.root.userData.roomPartId };
    });
    instances.instanceMatrix.needsUpdate = true;
    instances.computeBoundingBox();
    world.add(instances);
  }
}

/** Bounds of actual uploaded mesh instances, including cutaway-hidden architecture. */
export function renderedRoomBounds(world: T.Group) {
  world.updateMatrixWorld(true);
  const features = new Map<string, { bounds: T.Box3; partIds: Set<string> }>();
  const add = (id: string, partId: string, bounds: T.Box3) => {
    if (bounds.isEmpty()) return;
    const previous = features.get(id);
    if (previous) {
      previous.bounds.union(bounds);
      previous.partIds.add(partId);
    } else features.set(id, { bounds, partIds: new Set([partId]) });
  };
  for (const root of world.children) {
    if (root instanceof T.InstancedMesh && root.userData.roomInstances) {
      root.geometry.computeBoundingBox();
      const matrix = new T.Matrix4();
      root.userData.roomInstances.forEach((owner: { featureId: string; partId: string }, index: number) => {
        root.getMatrixAt(index, matrix);
        matrix.premultiply(root.matrixWorld);
        add(owner.featureId, owner.partId, root.geometry.boundingBox!.clone().applyMatrix4(matrix));
      });
    } else if (root.userData.featureId)
      add(root.userData.featureId, root.userData.roomPartId, new T.Box3().setFromObject(root));
  }
  return [...features].map(([id, { bounds, partIds }]) => ({
    id,
    partIds: [...partIds],
    min: bounds.min.toArray(),
    max: bounds.max.toArray(),
  }));
}
