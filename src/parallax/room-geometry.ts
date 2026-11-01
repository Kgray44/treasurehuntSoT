import type { Candidate } from "./adaptive";
import { createPresetConstruction } from "./preset-construction";
import type { RoomEnvironment, RoomFeature } from "./environment-contracts";
import { identityTransform, type Transform } from "./contracts";
import { composeTransform, inverseTransform } from "./transforms";
import type { EnvironmentContent } from "./legacy-scene-environment-contracts";

export type RoomGeometry = {
  id: string;
  size: [number, number, number];
  position: [number, number, number];
  surface: Candidate["surface"] | null;
  context: Candidate["context"];
  face: "TOP" | "FRONT" | "RIGHT";
  color?: number;
  lightColor?: number;
  shape?: RoomFeature["parts"][number]["shape"];
  featureId?: string;
  classification?: RoomFeature["classification"];
  exclusionSurfaceId?: string;
  exclusionSourceFeatureId?: string;
  rotation?: Transform["rotation"];
  /** Wall-local voids derived from coplanar semantic doors/windows, shared with placement. */
  openings?: PlanarRectangle[];
};

export type PlanarRectangle = { x: number; y: number; width: number; depth: number };
/** Clearance for readable flat assets and practical access above a support. */
export const SUPPORT_CLEARANCE_METERS = 0.18;
function featureExclusions(
  rectangles: (PlanarRectangle & { featureId: string })[],
  merge = true,
): (PlanarRectangle & { featureId: string })[] {
  if (!merge) return rectangles;
  const groups = new Map<string, PlanarRectangle>();
  for (const rect of rectangles) {
    const previous = groups.get(rect.featureId);
    if (!previous) {
      groups.set(rect.featureId, { x: rect.x, y: rect.y, width: rect.width, depth: rect.depth });
      continue;
    }
    const left = Math.min(previous.x - previous.width / 2, rect.x - rect.width / 2),
      right = Math.max(previous.x + previous.width / 2, rect.x + rect.width / 2);
    const bottom = Math.min(previous.y - previous.depth / 2, rect.y - rect.depth / 2),
      top = Math.max(previous.y + previous.depth / 2, rect.y + rect.depth / 2);
    groups.set(rect.featureId, {
      x: (left + right) / 2,
      y: (bottom + top) / 2,
      width: right - left,
      depth: top - bottom,
    });
  }
  return [...groups.entries()].map(([featureId, rect]) => ({ ...rect, featureId }));
}

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
  fixtures?: EnvironmentContent["fixtures"];
}): RoomGeometry[] {
  if (room.fixtures)
    return room.fixtures.map<RoomGeometry>((fixture) => ({
      id: fixture.id,
      size: [fixture.size.x, fixture.size.y, fixture.size.z],
      position: [fixture.position.x, fixture.position.y, fixture.position.z],
      color: Number.parseInt(fixture.color.slice(1), 16),
      lightColor: Number.parseInt(fixture.color.slice(1), 16),
      surface: null,
      context: [],
      face: "TOP",
    }));
  {
    const features = room.features ?? createPresetConstruction(room).features;
    const geometry: RoomGeometry[] = features.flatMap((feature) => {
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
          ...(feature.exclusion?.surfaceId ? { exclusionSurfaceId: feature.exclusion.surfaceId } : {}),
          ...(feature.exclusion?.sourceFeatureId
            ? { exclusionSourceFeatureId: feature.exclusion.sourceFeatureId }
            : {}),
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
        ? { ...part, openings: wallOpenings(part, features) }
        : part,
    );
  }
}

/** Derive complete planar support faces from actual model bounds. Decorative/curved forms are not fabricated planes. */
export function discoverRoomSurfaces(
  geometry: readonly RoomGeometry[],
  quality: { tracking: boolean; clutter: number },
  options: { includeObstructionIdentity?: boolean } = {},
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
            .filter(
              (item) =>
                item !== g &&
                !item.exclusionSourceFeatureId &&
                item.surface !== "FLOOR" &&
                item.surface !== "WALL" &&
                (!item.exclusionSurfaceId || item.exclusionSurfaceId === g.id),
            )
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
                Math.min(...corners.map((p) => p.z)) >= SUPPORT_CLEARANCE_METERS ||
                (Math.max(...corners.map((p) => p.z)) <= 0.01 && item.shape !== "PATH")
              )
                return [];
              const minX = Math.min(...corners.map((p) => p.x)),
                maxX = Math.max(...corners.map((p) => p.x));
              const minY = Math.min(...corners.map((p) => p.y)),
                maxY = Math.max(...corners.map((p) => p.y));
              return [
                {
                  featureId: item.featureId ?? item.id,
                  x: (minX + maxX) / 2,
                  y: (minY + maxY) / 2,
                  width: maxX - minX,
                  depth: maxY - minY,
                },
              ];
            })
        : null;
      return {
        id: g.id,
        surface: g.surface!,
        context: g.context,
        region: g.context.includes("ENTRANCE") ? "ENTRANCE_REGION" : "CURRENT_ROOM",
        position,
        exclusions: [
          // The flat central strip belongs to the same whole terrain surface;
          // sloped banks are excluded until nonplanar attachment is supported.
          ...(g.shape === "TERRAIN"
            ? [-1, 1].map((side) => ({ x: side * (w / 4 + 0.275), y: 0, width: Math.max(0, w / 2 - 0.55), depth: d }))
            : []),
          ...(g.openings ?? []),
          ...featureExclusions(
            rotatedExclusions ??
              geometry
                .filter((item) => {
                  if (item === g || item.surface === "FLOOR" || item.surface === "WALL") return false;
                  if (item.exclusionSourceFeatureId) return false;
                  if (item.exclusionSurfaceId && item.exclusionSurfaceId !== g.id) return false;
                  const axis = g.face === "TOP" ? 1 : g.face === "FRONT" ? 2 : 0;
                  const plane = axis === 0 ? position.x : axis === 1 ? position.y : position.z;
                  return (
                    item.position[axis] - item.size[axis] / 2 < plane + SUPPORT_CLEARANCE_METERS &&
                    (item.position[axis] + item.size[axis] / 2 > plane + 0.01 || item.shape === "PATH")
                  );
                })
                .map((item) =>
                  g.face === "TOP"
                    ? {
                        featureId: item.featureId ?? item.id,
                        x: item.position[0] - x,
                        y: z - item.position[2],
                        width: item.size[0],
                        depth: item.size[2],
                      }
                    : g.face === "FRONT"
                      ? {
                          featureId: item.featureId ?? item.id,
                          x: item.position[0] - x,
                          y: item.position[1] - y,
                          width: item.size[0],
                          depth: item.size[1],
                        }
                      : {
                          featureId: item.featureId ?? item.id,
                          x: z - item.position[2],
                          y: item.position[1] - y,
                          width: item.size[2],
                          depth: item.size[1],
                        },
                ),
            g.surface !== "FLOOR",
          ).map(({ featureId, ...rectangle }) =>
            options.includeObstructionIdentity ? { ...rectangle, featureId } : rectangle,
          ),
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
