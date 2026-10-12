import type { Candidate } from "./adaptive";
export type RoomGeometry = {
  id: string;
  size: [number, number, number];
  position: [number, number, number];
  surface: Candidate["surface"];
  context: Candidate["context"];
  face: "TOP" | "FRONT" | "RIGHT";
};
/** Invented room geometry, shared by the renderer and surface discovery. */
export function syntheticRoomGeometry(room: {
  width: number;
  depth: number;
  horizontal: boolean;
  vertical: boolean;
}): RoomGeometry[] {
  const { width: w, depth: d } = room;
  const geometry: RoomGeometry[] = [
    {
      id: "floor-furniture",
      size: [w, 0.12, d],
      position: [0, -0.06, 0],
      surface: "FLOOR",
      context: ["FURNITURE"],
      face: "TOP",
    },
  ];
  if (room.vertical)
    geometry.push(
      {
        id: "wall-window",
        size: [w, 2.8, 0.12],
        position: [0, 1.4, -d / 2],
        surface: "WALL",
        context: ["WINDOW"],
        face: "FRONT",
      },
      {
        id: "wall-left",
        size: [0.12, 2.8, d],
        position: [-w / 2, 1.4, 0],
        surface: "WALL",
        context: [],
        face: "RIGHT",
      },
    );
  if (room.horizontal)
    geometry.push(
      {
        id: "reference-desk",
        size: [1.5, 0.06, 1],
        position: [0, 0.72, -d * 0.25],
        surface: "DESK",
        context: ["FURNITURE"],
        face: "TOP",
      },
      ...(
        [
          ["table-left", "TABLE", -w * 0.22, 0.75, -d * 0.2, ["FURNITURE"]],
          ["desk-right", "DESK", w * 0.22, 0.8, -d * 0.25, ["FURNITURE", "WINDOW"]],
          ["table-entry", "TABLE", w * 0.2, 0.7, d * 0.22, ["FURNITURE", "ENTRANCE"]],
          ["shelf-entry", "SHELF", -w * 0.22, 1.1, d * 0.22, ["FURNITURE", "ENTRANCE"]],
        ] as [string, Candidate["surface"], number, number, number, Candidate["context"]][]
      ).map(
        ([id, surface, x, y, z, context]): RoomGeometry => ({
          id,
          surface,
          context,
          size: [1.2, 0.05, 1.2],
          position: [x, y - 0.025, z],
          face: "TOP",
        }),
      ),
      {
        id: "sofa-seat",
        size: [1.8, 0.13, 0.65],
        position: [w / 2 - 1.25, 0.52, -d / 2 + 0.7],
        surface: "TABLE",
        context: ["FURNITURE", "OBSTACLE"],
        face: "TOP",
      },
    );
  return geometry.sort(
    (a, b) =>
      Number(a.surface === "FLOOR" || a.surface === "WALL") - Number(b.surface === "FLOOR" || b.surface === "WALL"),
  );
}
/** Derive whole planar faces from current geometry; no fixed placement patches. */
export function discoverRoomSurfaces(
  geometry: readonly RoomGeometry[],
  quality: { tracking: boolean; clutter: number },
): Candidate[] {
  return geometry.map((g) => {
    const [x, y, z] = g.position,
      [w, h, d] = g.size;
    const position =
      g.face === "TOP" ? { x, y: y + h / 2, z } : g.face === "FRONT" ? { x, y, z: z + d / 2 } : { x: x + w / 2, y, z };
    return {
      id: g.id,
      surface: g.surface,
      context: g.context,
      region: g.context.includes("ENTRANCE") ? "ENTRANCE_REGION" : "CURRENT_ROOM",
      position,
      normal:
        g.face === "TOP" ? { x: 0, y: 1, z: 0 } : g.face === "FRONT" ? { x: 0, y: 0, z: 1 } : { x: 1, y: 0, z: 0 },
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
