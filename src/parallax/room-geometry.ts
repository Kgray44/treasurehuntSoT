import type { Candidate } from "./adaptive";
import type { RoomEnvironment, RoomFeature } from "./environment-contracts";
import { identityTransform, type Transform } from "./contracts";
import { composeTransform, inverseTransform } from "./transforms";

export type RoomGeometry = {
  id: string;
  size: [number, number, number];
  position: [number, number, number];
  surface: Candidate["surface"] | null;
  context: Candidate["context"];
  face: "TOP" | "FRONT" | "RIGHT";
  color?: number;
  lightColor?: number;
  shape?: "TREE" | "WINDOW";
  featureId?: string;
  classification?: RoomFeature["classification"];
  rotation?: Transform["rotation"];
  /** Wall-local voids derived from coplanar semantic doors/windows, shared with placement. */
  openings?: PlanarRectangle[];
};

export type PlanarRectangle = { x: number; y: number; width: number; depth: number };

/** Partition a complete face around the union of voids, including openings at an edge. */
export function solidFaceRectangles(
  width: number,
  height: number,
  openings: readonly PlanarRectangle[],
): PlanarRectangle[] {
  let solids: PlanarRectangle[] = [{ x: 0, y: 0, width, depth: height }];
  for (const hole of openings) {
    solids = solids.flatMap((rect) => {
      const left = rect.x - rect.width / 2,
        right = rect.x + rect.width / 2;
      const bottom = rect.y - rect.depth / 2,
        top = rect.y + rect.depth / 2;
      const a = Math.max(left, hole.x - hole.width / 2),
        b = Math.min(right, hole.x + hole.width / 2);
      const c = Math.max(bottom, hole.y - hole.depth / 2),
        d = Math.min(top, hole.y + hole.depth / 2);
      if (b <= a || d <= c) return [rect];
      return [
        [left, a, bottom, top],
        [b, right, bottom, top],
        [a, b, bottom, c],
        [a, b, d, top],
      ]
        .filter(([x1, x2, y1, y2]) => x2 - x1 > 1e-8 && y2 - y1 > 1e-8)
        .map(([x1, x2, y1, y2]) => ({ x: (x1 + x2) / 2, y: (y1 + y2) / 2, width: x2 - x1, depth: y2 - y1 }));
    });
  }
  return solids;
}

function wallOpenings(wall: RoomGeometry, features: readonly RoomFeature[]): PlanarRectangle[] {
  const rotation = wall.rotation ?? identityTransform().rotation;
  const frame = { position: { x: wall.position[0], y: wall.position[1], z: wall.position[2] }, rotation, scale: 1 };
  return features
    .filter((feature) => feature.classification === "WINDOW" || feature.classification === "DOOR")
    .flatMap((feature) => {
      const angle = (feature.yawDegrees * Math.PI) / 360;
      const local = composeTransform(inverseTransform(frame), {
        position: feature.position,
        rotation: { x: 0, y: Math.sin(angle), z: 0, w: Math.cos(angle) },
        scale: 1,
      });
      // Only parallel, coplanar openings cut this wall. Nearby furniture never becomes a hole.
      if (
        Math.abs(2 * local.rotation.y * local.rotation.w) > 1e-5 ||
        Math.abs(local.position.z) > (wall.size[2] + feature.dimensions[2]) / 2 + 0.01
      )
        return [];
      const left = Math.max(-wall.size[0] / 2, local.position.x - feature.dimensions[0] / 2);
      const right = Math.min(wall.size[0] / 2, local.position.x + feature.dimensions[0] / 2);
      const bottom = Math.max(-wall.size[1] / 2, local.position.y - feature.dimensions[1] / 2);
      const top = Math.min(wall.size[1] / 2, local.position.y + feature.dimensions[1] / 2);
      return right > left && top > bottom
        ? [{ x: (left + right) / 2, y: (bottom + top) / 2, width: right - left, depth: top - bottom }]
        : [];
    });
}

/** Named invented environments. Rendering and discovery consume this same geometry. */
export function syntheticRoomGeometry(room: {
  id?: string;
  width: number;
  depth: number;
  horizontal: boolean;
  vertical: boolean;
  features?: RoomEnvironment["features"];
}): RoomGeometry[] {
  if (room.features) {
    const geometry: RoomGeometry[] = room.features.flatMap((feature) => {
      const angle = (feature.yawDegrees * Math.PI) / 360;
      const frame = {
        position: feature.position,
        rotation: { x: 0, y: Math.sin(angle), z: 0, w: Math.cos(angle) },
        scale: 1,
      };
      return feature.parts.map((part) => {
        const local = part.position.map((v, i) => v * feature.dimensions[i]);
        const position = composeTransform(frame, {
          ...identityTransform(),
          position: { x: local[0], y: local[1], z: local[2] },
        }).position;
        return {
          id: part.id,
          featureId: feature.id,
          classification: feature.classification,
          size: part.size.map((v, i) => v * feature.dimensions[i]) as RoomGeometry["size"],
          position: [position.x, position.y, position.z] as RoomGeometry["position"],
          rotation: frame.rotation,
          surface: part.surface,
          context: part.context,
          face: part.face,
          color: part.color,
          lightColor: part.color,
          ...(part.shape === "BOX" ? {} : { shape: part.shape }),
        };
      });
    });
    return geometry.map((part) =>
      part.classification === "WALL" && part.face === "FRONT"
        ? { ...part, openings: wallOpenings(part, room.features!) }
        : part,
    );
  }
  const { width: w, depth: d } = room;
  const kind = room.id ?? "bedroom";
  const outdoor = kind === "trail" || kind === "plaza";
  const geometry: RoomGeometry[] = [];
  let feature: { id: string; classification: RoomFeature["classification"] } | undefined;
  const grouped = (id: string, classification: RoomFeature["classification"], build: () => void) => {
    const previous = feature;
    feature = { id, classification };
    build();
    feature = previous;
  };
  const add = (
    id: string,
    size: RoomGeometry["size"],
    position: RoomGeometry["position"],
    color: number,
    surface: RoomGeometry["surface"] = null,
    context: Candidate["context"] = [],
    face: RoomGeometry["face"] = "TOP",
    shape?: RoomGeometry["shape"],
  ) => {
    geometry.push({
      id,
      size,
      position,
      color,
      lightColor: color,
      surface,
      context,
      face,
      ...(shape ? { shape } : {}),
      featureId: feature?.id ?? id,
      classification:
        feature?.classification ??
        (surface === "FLOOR"
          ? "FLOOR"
          : surface === "WALL"
            ? "WALL"
            : surface === "DESK"
              ? "DESK"
              : surface === "SHELF"
                ? "SHELF"
                : surface === "TABLE"
                  ? "TABLE"
                  : shape === "WINDOW"
                    ? "WINDOW"
                    : shape === "TREE"
                      ? "TREE"
                      : "OTHER"),
    });
  };
  const furniture = (
    id: string,
    size: RoomGeometry["size"],
    position: RoomGeometry["position"],
    color: number,
    surface: Candidate["surface"] = "TABLE",
    blocked = false,
  ) => add(id, size, position, color, surface, blocked ? ["FURNITURE", "OBSTACLE"] : ["FURNITURE"]);
  const table = (
    id: string,
    x: number,
    y: number,
    z: number,
    width = 1.2,
    depth = 0.7,
    surface: Candidate["surface"] = "TABLE",
  ) => {
    grouped(id, surface === "DESK" ? "DESK" : surface === "SHELF" ? "SHELF" : "TABLE", () => {
      furniture(id, [width, 0.06, depth], [x, y - 0.03, z], 0x92734f, surface);
      for (const dx of [-width * 0.4, width * 0.4])
        for (const dz of [-depth * 0.36, depth * 0.36])
          add(`${id}-leg-${dx}-${dz}`, [0.055, y - 0.06, 0.055], [x + dx, (y - 0.06) / 2, z + dz], 0x465366);
    });
  };
  const chair = (id: string, x: number, z: number, color = 0x536c8b) => {
    grouped(id, "CHAIR", () => {
      furniture(`${id}-seat`, [0.44, 0.08, 0.44], [x, 0.45, z], color, "TABLE", true);
      add(`${id}-back`, [0.44, 0.55, 0.07], [x, 0.74, z + 0.2], color);
      for (const dx of [-0.17, 0.17])
        for (const dz of [-0.17, 0.17])
          add(`${id}-leg-${dx}-${dz}`, [0.035, 0.41, 0.035], [x + dx, 0.205, z + dz], 0x3b4654);
    });
  };
  const bed = (id: string, x: number, z: number, width: number, length: number, color: number) => {
    grouped(id, "BED", () => {
      add(`${id}-base`, [width, 0.25, length], [x, 0.2, z], 0x77624f);
      furniture(id, [width, 0.18, length], [x, 0.42, z], color, "TABLE", true);
      add(`${id}-pillow`, [width * 0.7, 0.13, 0.4], [x, 0.57, z - length * 0.33], 0xe7e3d9);
      add(`${id}-headboard`, [width + 0.06, 0.9, 0.08], [x, 0.5, z - length / 2], 0x766253);
    });
  };
  const window = (x: number, y: number, z: number, width: number, height: number) =>
    add("window", [width, height, 0.04], [x, y, z], 0xaed4ec, null, [], "FRONT", "WINDOW");
  const tree = (id: string, x: number, z: number, height = 2.6) =>
    add(id, [0.9, height, 0.9], [x, height / 2, z], 0x406a45, null, [], "TOP", "TREE");
  add(
    "floor-furniture",
    [w, 0.12, d],
    [0, -0.06, 0],
    outdoor
      ? kind === "trail"
        ? 0x9b896b
        : 0xb6b9b6
      : kind === "gallery"
        ? 0xc8c6bf
        : kind === "office"
          ? 0x8896a4
          : 0xa2907b,
    "FLOOR",
    ["FURNITURE"],
  );
  if (room.vertical) {
    add(
      "wall-window",
      [w, 2.8, 0.12],
      [0, 1.4, -d / 2],
      kind === "gallery" ? 0xf0eee7 : kind === "classroom" ? 0xd2ded5 : 0xc1cbd7,
      "WALL",
      ["WINDOW"],
      "FRONT",
    );
    add("wall-left", [0.12, 2.8, d], [-w / 2, 1.4, 0], kind === "gallery" ? 0xe4e1d8 : 0xb0bdcc, "WALL", [], "RIGHT");
  }
  if (kind === "bedroom") {
    table("reference-desk", 0.25, 0.75, -d * 0.25, 1.3, 0.9, "DESK");
    table("table-left", -w * 0.34, 0.65, d * 0.33, 1.15, 1);
    bed("bed", -w * 0.3, -0.18, 1.3, 2.05, 0x7994b5);
    grouped("wardrobe", "WARDROBE", () => {
      furniture("wardrobe", [0.65, 1.9, 1], [w * 0.38, 0.95, -d * 0.25], 0x917f68, "SHELF", true);
      add("wardrobe-doors", [0.025, 1.65, 0.94], [w * 0.38 - 0.34, 0.94, -d * 0.25], 0xb4a087);
    });
    chair("desk-chair", 0.25, -d * 0.25 + 0.6);
    window(0, 1.85, -d / 2 + 0.1, 1.15, 1.25);
    add("bedside-lamp-base", [0.18, 0.32, 0.18], [-w * 0.34 - 0.48, 0.81, d * 0.33 - 0.38], 0xd3c08d);
  } else if (kind === "living-room") {
    grouped("sofa", "SOFA", () => {
      furniture("sofa-seat", [2.5, 0.18, 0.85], [-w * 0.22, 0.48, 0], 0x6b8498, "TABLE", true);
      add("sofa-back", [0.2, 0.9, 0.95], [-w * 0.22 - 1.15, 0.63, 0], 0x526e86);
      for (const z of [-0.55, 0.55]) add(`sofa-arm-${z}`, [2.5, 0.4, 0.15], [-w * 0.22, 0.62, z], 0x526e86);
    });
    table("table-left", 0.35, 0.45, 0.2, 1.35, 0.8);
    table("reference-desk", 0, 0.75, -d * 0.25, 1.8, 0.45, "SHELF");
    add("television", [1.4, 0.85, 0.08], [0, 1.25, -d / 2 + 0.17], 0x17263b);
    add("television-screen", [1.27, 0.7, 0.02], [0, 1.25, -d / 2 + 0.22], 0x557ea4);
    add("rug", [3.3, 0.012, 2.1], [-0.2, 0.015, 0.4], 0xb6a78c);
    chair("armchair", w * 0.32, d * 0.25, 0xac9a7d);
    window(-w * 0.3, 1.7, -d / 2 + 0.1, 1.2, 1.45);
    tree("houseplant", w * 0.38, -d * 0.38, 1.4);
  } else if (kind === "dorm") {
    bed("dorm-bed", -w * 0.28, 0.12, 0.9, 1.95, 0x77958b);
    table("reference-desk", w * 0.3, 0.75, -d * 0.32, 0.95, 0.85, "DESK");
    chair("study-chair", w * 0.25, -d * 0.32 + 0.6);
    furniture("shelf-entry", [0.6, 0.05, 0.28], [w * 0.25, 1.35, -d / 2 + 0.24], 0xa28b6a, "SHELF");
    for (let i = 0; i < 5; i++)
      add(
        `textbook-${i}`,
        [0.07, 0.24, 0.2],
        [w * 0.25 - 0.22 + i * 0.085, 1.49, -d / 2 + 0.24],
        [0x985c56, 0x5c7e9b, 0xd0b574][i % 3],
      );
    window(-0.45, 1.9, -d / 2 + 0.11, 0.65, 0.75);
    add("laundry-basket", [0.36, 0.45, 0.4], [w * 0.32, 0.23, d * 0.3], 0x95876e);
  } else if (kind === "office") {
    for (const x of [-w * 0.26, w * 0.26])
      for (const z of [-d * 0.26, d * 0.18]) {
        const id =
          x < 0 && z < 0 ? "reference-desk" : `workstation-${x < 0 ? "left" : "right"}-${z < 0 ? "back" : "front"}`;
        table(id, x, 0.75, z, 1.5, 0.9, "DESK");
        chair(`${id}-chair`, x, z + 0.67);
        add(`${id}-monitor`, [0.55, 0.38, 0.04], [x, 1.05, z - 0.36], 0x202e40);
        add(`${id}-screen`, [0.49, 0.31, 0.015], [x, 1.05, z - 0.33], 0x5a8bb2);
      }
    grouped("filing-cabinet", "CABINET", () =>
      furniture("filing-cabinet", [0.55, 1.25, 0.5], [0, 0.625, -d * 0.38], 0x8c9ca9, "SHELF", true),
    );
    window(0, 1.95, -d / 2 + 0.1, 1.4, 0.85);
  } else if (kind === "classroom") {
    table("reference-desk", -w * 0.25, 0.75, -d * 0.35, 1.5, 0.9, "DESK");
    add("whiteboard-frame", [w * 0.55, 1.15, 0.08], [0.2, 1.6, -d / 2 + 0.14], 0x768b8c);
    add("whiteboard", [w * 0.53, 1.02, 0.03], [0.2, 1.6, -d / 2 + 0.2], 0xeaf0df);
    for (let row = 0; row < 3; row++)
      for (let col = 0; col < 3; col++) {
        const x = (col - 1) * w * 0.23,
          z = -d * 0.12 + row * d * 0.24;
        const id = row === 0 && col === 0 ? "table-left" : `student-desk-${row}-${col}`;
        table(id, x, 0.7, z, 1.15, 0.6, "DESK");
        chair(`student-chair-${row}-${col}`, x, z + 0.55, 0x628c9b);
      }
    add("classroom-clock", [0.4, 0.4, 0.04], [-w * 0.4, 2.2, -d / 2 + 0.15], 0xe4cd8c);
  } else if (kind === "gallery") {
    for (let i = 0; i < 3; i++) {
      const x = (i - 1) * w * 0.27;
      add(`art-frame-${i}`, [1.35, 1.65, 0.08], [x, 1.55, -d / 2 + 0.17], 0x756557);
      add(`artwork-${i}`, [1.16, 1.46, 0.04], [x, 1.55, -d / 2 + 0.23], [0xa6675e, 0x638ca3, 0xbfa26c][i]);
      furniture(`display-plinth-${i}`, [0.75, 0.9, 0.75], [x, 0.45, -d * 0.12], 0xe3e0d8);
      add(`sculpture-${i}`, [0.25 + i * 0.08, 0.65, 0.25], [x, 1.22, -d * 0.12], 0x879b9a);
    }
    table("gallery-bench", 0, 0.48, d * 0.23, 2.1, 0.5, "SHELF");
  } else if (kind === "trail") {
    for (let i = 0; i < 7; i++) {
      tree(`trail-tree-left-${i}`, -w * 0.38, -d / 2 + 0.8 + i * 1.6, 2.4 + (i % 3) * 0.25);
      tree(`trail-tree-right-${i}`, w * 0.38, -d / 2 + 1.4 + i * 1.5, 2.7);
      add(`trail-stone-${i}`, [0.3, 0.16, 0.3], [-w * 0.28, 0.07, -d / 2 + 1 + i * 1.6], 0x858a7f);
    }
    add("trail-path", [w * 0.52, 0.009, d], [0, 0.004, 0], 0xbea989);
    add("trail-sign-post", [0.09, 1.15, 0.09], [w * 0.28, 0.575, d * 0.3], 0x796146);
    add("trail-sign", [0.6, 0.35, 0.06], [w * 0.28, 1.15, d * 0.3], 0xb59a70);
  } else if (kind === "plaza") {
    for (const x of [-w * 0.32, w * 0.32])
      for (const z of [-d * 0.3, d * 0.3]) {
        table(`plaza-bench-${x < 0 ? "left" : "right"}-${z < 0 ? "back" : "front"}`, x, 0.5, z, 1.9, 0.55, "SHELF");
        add(`bench-back-${x}-${z}`, [1.9, 0.5, 0.08], [x, 0.75, z - 0.3], 0x796d58);
        furniture(`planter-${x}-${z}`, [0.8, 0.6, 0.8], [x, 0.3, z + 1], 0xa39e91, "TABLE", true);
        tree(`plaza-tree-${x}-${z}`, x, z + 1, 2.6);
      }
    add("fountain-base", [2, 0.35, 2], [0, 0.175, 0], 0x929d9e);
    add("fountain-water", [1.7, 0.03, 1.7], [0, 0.36, 0], 0x7aa9be);
    add("fountain-center", [0.35, 1.15, 0.35], [0, 0.9, 0], 0xb7bdb9);
    for (const x of [-w * 0.44, w * 0.44]) add(`light-post-${x}`, [0.08, 2.4, 0.08], [x, 1.2, 0], 0x53616a);
  } else if (kind === "cluttered") {
    table("reference-desk", 0, 0.75, -d * 0.25, 0.85, 0.6, "DESK");
    for (let i = 0; i < 9; i++)
      furniture(
        `stacked-box-${i}`,
        [0.45, 0.25 + (i % 3) * 0.23, 0.4],
        [-w * 0.32 + (i % 3) * 0.62, (0.25 + (i % 3) * 0.23) / 2, -0.3 + Math.floor(i / 3) * 0.48],
        0x9e8260,
        "TABLE",
        true,
      );
    add("cluttered-rug", [1.25, 0.01, 1.3], [0, 0.012, 0.2], 0x80766d);
  }
  // Empty room intentionally has only its shell; no borrowed furniture or window.
  return geometry.sort(
    (a, b) =>
      Number(a.surface === "FLOOR" || a.surface === "WALL" || a.surface === null) -
      Number(b.surface === "FLOOR" || b.surface === "WALL" || b.surface === null),
  );
}

/** Derive complete planar support faces from actual model bounds. Decorative/curved forms are not fabricated planes. */
export function discoverRoomSurfaces(
  geometry: readonly RoomGeometry[],
  quality: { tracking: boolean; clutter: number },
): Candidate[] {
  return geometry
    .filter((g) => g.surface !== null)
    .map((g) => {
      const [x, y, z] = g.position,
        [w, h, d] = g.size;
      let position =
        g.face === "TOP"
          ? { x, y: y + h / 2, z }
          : g.face === "FRONT"
            ? { x, y, z: z + d / 2 }
            : { x: x + w / 2, y, z };
      let rotation: Transform["rotation"] | undefined;
      let normal =
        g.face === "TOP" ? { x: 0, y: 1, z: 0 } : g.face === "FRONT" ? { x: 0, y: 0, z: 1 } : { x: 1, y: 0, z: 0 };
      if (g.rotation) {
        const frame = { position: { x, y, z }, rotation: g.rotation, scale: 1 };
        position = composeTransform(frame, {
          ...identityTransform(),
          position: { x: position.x - x, y: position.y - y, z: position.z - z },
        }).position;
        normal = composeTransform(
          { ...frame, position: { x: 0, y: 0, z: 0 } },
          { ...identityTransform(), position: normal },
        ).position;
        const base =
          g.face === "TOP"
            ? { x: -Math.SQRT1_2, y: 0, z: 0, w: Math.SQRT1_2 }
            : g.face === "RIGHT"
              ? { x: 0, y: Math.SQRT1_2, z: 0, w: Math.SQRT1_2 }
              : identityTransform().rotation;
        rotation = composeTransform(frame, { ...identityTransform(), rotation: base }).rotation;
      }
      const rotatedExclusions = rotation
        ? geometry
            .filter((item) => item !== g && item.surface !== "FLOOR" && item.surface !== "WALL")
            .flatMap((item) => {
              const itemFrame = {
                position: { x: item.position[0], y: item.position[1], z: item.position[2] },
                rotation: item.rotation ?? identityTransform().rotation,
                scale: 1,
              };
              const inverse = inverseTransform({ position, rotation: rotation!, scale: 1 });
              const corners = [-1, 1].flatMap((dx) =>
                [-1, 1].flatMap((dy) =>
                  [-1, 1].map(
                    (dz) =>
                      composeTransform(
                        inverse,
                        composeTransform(itemFrame, {
                          ...identityTransform(),
                          position: {
                            x: (dx * item.size[0]) / 2,
                            y: (dy * item.size[1]) / 2,
                            z: (dz * item.size[2]) / 2,
                          },
                        }),
                      ).position,
                  ),
                ),
              );
              if (
                Math.min(...corners.map((p) => p.z)) >= (g.surface === "FLOOR" ? 1 : 0.18) ||
                Math.max(...corners.map((p) => p.z)) <= 0.01
              )
                return [];
              const minX = Math.min(...corners.map((p) => p.x)),
                maxX = Math.max(...corners.map((p) => p.x));
              const minY = Math.min(...corners.map((p) => p.y)),
                maxY = Math.max(...corners.map((p) => p.y));
              return [{ x: (minX + maxX) / 2, y: (minY + maxY) / 2, width: maxX - minX, depth: maxY - minY }];
            })
        : null;
      return {
        id: g.id,
        surface: g.surface!,
        context: g.context,
        region: g.context.includes("ENTRANCE") ? "ENTRANCE_REGION" : "CURRENT_ROOM",
        position,
        exclusions: [
          ...(g.openings ?? []),
          ...(rotatedExclusions ??
            geometry
              .filter((item) => {
                if (item === g || item.surface === "FLOOR" || item.surface === "WALL") return false;
                const axis = g.face === "TOP" ? 1 : g.face === "FRONT" ? 2 : 0;
                const plane = axis === 0 ? position.x : axis === 1 ? position.y : position.z;
                return (
                  item.position[axis] - item.size[axis] / 2 < plane + (g.surface === "FLOOR" ? 1 : 0.18) &&
                  item.position[axis] + item.size[axis] / 2 > plane + 0.01
                );
              })
              .map((item) =>
                g.face === "TOP"
                  ? { x: item.position[0] - x, y: z - item.position[2], width: item.size[0], depth: item.size[2] }
                  : g.face === "FRONT"
                    ? { x: item.position[0] - x, y: item.position[1] - y, width: item.size[0], depth: item.size[1] }
                    : { x: z - item.position[2], y: item.position[1] - y, width: item.size[2], depth: item.size[1] },
              )),
        ],
        normal,
        ...(rotation ? { rotation } : {}),
        widthMeters: g.face === "RIGHT" ? d : w,
        depthMeters: g.face === "TOP" ? d : h,
        clearanceMeters: quality.clutter > 0.8 ? 0.05 : 0.35,
        reachMeters: 1,
        visibility: 0.85,
        confidence: quality.tracking ? 0.95 : 0.45,
        seatedReachable: position.y <= 1.5,
        safe: !g.context.includes("OBSTACLE"),
        occluded: false,
      };
    });
}
