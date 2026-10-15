import type { Candidate } from "./adaptive";
import { physicalAssets, type ModelId } from "./asset-catalog";
import { previewEntityTransforms, type SpatialDraft } from "./authoring";
import { identityTransform, type Transform } from "./contracts";
import type { PreviewEnvironment } from "./environment-authoring";
import { discoverRoomSurfaces, SUPPORT_CLEARANCE_METERS, syntheticRoomGeometry } from "./room-geometry";
import { findSurfacePlacement, surfaceFrameRotation } from "./surface-placement";
import { simulationEnvironments } from "./studio-validation";
import { composeTransform, inverseTransform } from "./transforms";

type Point = Transform["position"];
type Rectangle = NonNullable<Candidate["exclusions"]>[number];
type Volume = { id: string; points: Point[] };
export type PhysicalInsertionPlan =
  | { status: "PLACED"; surfaceId: string; transform: Transform }
  | {
      status: "NO_FIT";
      reason: "ROOM_REQUIRED" | "ADAPTIVE" | "OPEN_ARTICULATION" | "NO_CLEAR_SUPPORT";
      message: string;
    };

const gap = 0.02;
const lift = 0.01;
const blockedContexts = new Set(["WALKWAY", "STAIRS", "OBSTACLE", "PRIVATE_REGION"]);

function corners(dimensions: readonly number[], world: Transform, bottomPivot: boolean): Point[] {
  return [-1, 1].flatMap((x) =>
    [-1, 1].flatMap((y) =>
      [-1, 1].map(
        (z) =>
          composeTransform(world, {
            ...identityTransform(),
            position: {
              x: (x * dimensions[0]) / 2,
              y: bottomPivot ? ((y + 1) * dimensions[1]) / 2 : (y * dimensions[1]) / 2,
              z: (z * dimensions[2]) / 2,
            },
          }).position,
      ),
    ),
  );
}

function projectedObstructions(volumes: readonly Volume[], frame: Transform, height: number): Rectangle[] {
  const inverse = inverseTransform(frame);
  return volumes.flatMap((volume) => {
    const points = volume.points.map(
      (position) => composeTransform(inverse, { ...identityTransform(), position }).position,
    );
    const zs = points.map((p) => p.z);
    if (Math.max(...zs) <= lift - 1e-6 || Math.min(...zs) >= height + lift) return [];
    const xs = points.map((p) => p.x),
      ys = points.map((p) => p.y);
    const width = Math.max(...xs) - Math.min(...xs),
      depth = Math.max(...ys) - Math.min(...ys);
    return width > 1e-8 && depth > 1e-8
      ? [{ x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2, width, depth }]
      : [];
  });
}

/** Adapt an exact rectangular footprint to the canonical solver's 4:3 plane footprint.
 * Only private plane coordinates are rescaled; real candidates and room geometry stay unchanged.
 */
function fitRectangle(surface: Candidate, preferred: Point, width: number, depth: number, exclusions: Rectangle[]) {
  const frame = { position: surface.position, rotation: surfaceFrameRotation(surface), scale: 1 };
  const local = composeTransform(inverseTransform(frame), { ...identityTransform(), position: preferred }).position;
  const paddedWidth = width + gap * 2,
    yScale = (paddedWidth * 0.75) / (depth + gap * 2);
  const virtual: Candidate = {
    ...surface,
    position: { x: 0, y: 0, z: 0 },
    normal: { x: 0, y: 0, z: 1 },
    rotation: identityTransform().rotation,
    depthMeters: surface.depthMeters * yScale,
    exclusions: exclusions.map((r) => ({ ...r, y: r.y * yScale, depth: r.depth * yScale })),
  };
  const fit = findSurfacePlacement(
    { ...identityTransform(), position: { x: local.x, y: local.y * yScale, z: 0 } },
    virtual,
    paddedWidth,
  );
  return fit
    ? {
        frame,
        center: { x: fit.position.x, y: fit.position.y / yScale, z: 0 },
      }
    : null;
}

/** Pure initial-placement plan; callers own insertion/history and visible no-fit recovery.
 * Uses the exact selected preview and canonical discovered supports, never a generic fallback room.
 * Solid authored entities are conservatively occupied even when temporarily hidden.
 * Preferred position is the support-face footprint center; output uses the model's bottom pivot.
 */
export function planPhysicalAssetInsertion(input: {
  draft: SpatialDraft;
  modelId: ModelId;
  environment: PreviewEnvironment;
  preferredPosition?: Point;
}): PhysicalInsertionPlan {
  const { draft, modelId, environment } = input;
  if (draft.content.adaptive)
    return {
      status: "NO_FIT",
      reason: "ADAPTIVE",
      message: "Use the existing semantic placement recipe in this adaptive Scene.",
    };
  if (
    !Number.isFinite(environment.width) ||
    !Number.isFinite(environment.depth) ||
    environment.width <= 0 ||
    environment.depth <= 0 ||
    (!environment.features && !simulationEnvironments.some((p) => p.id === environment.id))
  )
    return {
      status: "NO_FIT",
      reason: "ROOM_REQUIRED",
      message: "Choose a known preview Environment or supply its authored room geometry before placing this model.",
    };

  const model = physicalAssets.find((a) => a.id === modelId);
  if (!model) throw new Error("Unknown physical asset.");
  if (
    draft.content.entities.some(
      (entity) => entity.element?.kind === "PHYSICAL_ASSET" && entity.element.articulation > 0,
    )
  )
    return {
      status: "NO_FIT",
      reason: "OPEN_ARTICULATION",
      message:
        "Close articulated models before automatic insertion, or use reviewed manual placement. Open-state collision bounds are not qualified by this planner.",
    };
  const geometry = syntheticRoomGeometry(environment);
  const roomVolumes = geometry.map((part) => ({
    id: part.id,
    points: corners(
      part.size,
      {
        position: { x: part.position[0], y: part.position[1], z: part.position[2] },
        rotation: part.rotation ?? identityTransform().rotation,
        scale: 1,
      },
      false,
    ),
  }));
  const poses = previewEntityTransforms(draft.content, environment.id, environment);
  const occupied: Volume[] = draft.content.entities.flatMap((entity) => {
    const element = entity.element;
    const asset = element?.kind === "PHYSICAL_ASSET" ? physicalAssets.find((a) => a.id === element.modelId) : undefined;
    if (entity.element && !asset) return [];
    return [
      {
        id: entity.id,
        points: corners(
          asset
            ? asset.dimensions.map((dimension) => dimension * (entity.widthMeters / asset.dimensions[0]))
            : [entity.widthMeters, entity.widthMeters * 0.75, 0.01],
          poses[entity.id],
          Boolean(asset),
        ),
      },
    ];
  });
  const wall = model.support === "WALL";
  const allowed: Candidate["surface"][] = wall ? ["WALL"] : model.support === "FLOOR" ? ["FLOOR"] : ["TABLE", "DESK"];
  const preferred = input.preferredPosition ?? { x: 0, y: wall ? 1.2 : 0, z: environment.depth / 4 };
  const placements: { surfaceId: string; transform: Transform; distance: number }[] = [];
  for (const surface of discoverRoomSurfaces(geometry, environment)) {
    if (
      !allowed.includes(surface.surface) ||
      !surface.safe ||
      surface.occluded ||
      surface.clearanceMeters < SUPPORT_CLEARANCE_METERS ||
      surface.context.some((c) => blockedContexts.has(c)) ||
      (wall ? Math.abs(surface.normal.y) > 1e-6 : surface.normal.y < 1 - 1e-6)
    )
      continue;
    const frame = { position: surface.position, rotation: surfaceFrameRotation(surface), scale: 1 };
    const volumes: Volume[] = [...roomVolumes.filter((part) => part.id !== surface.id), ...occupied];
    const exclusions = [
      ...(surface.exclusions ?? []),
      ...projectedObstructions(volumes, frame, wall ? model.dimensions[2] : model.dimensions[1]),
    ];
    const fit = fitRectangle(
      surface,
      preferred,
      model.dimensions[0],
      wall ? model.dimensions[1] : model.dimensions[2],
      exclusions,
    );
    if (!fit) continue;
    const transform = composeTransform(fit.frame, {
      position: {
        x: fit.center.x,
        y: fit.center.y - (wall ? model.dimensions[1] / 2 : 0),
        z: lift + (wall ? model.dimensions[2] / 2 : 0),
      },
      rotation: wall ? identityTransform().rotation : { x: Math.SQRT1_2, y: 0, z: 0, w: Math.SQRT1_2 },
      scale: 1,
    });
    if (
      corners(model.dimensions, transform, true).some(
        (p) => Math.abs(p.x) > environment.width / 2 - gap + 1e-6 || Math.abs(p.z) > environment.depth / 2 - gap + 1e-6,
      )
    )
      continue;
    placements.push({
      surfaceId: surface.id,
      transform,
      distance: Math.hypot(
        transform.position.x - preferred.x,
        transform.position.y - preferred.y,
        transform.position.z - preferred.z,
      ),
    });
  }
  placements.sort((a, b) => a.distance - b.distance || a.surfaceId.localeCompare(b.surfaceId));
  const best = placements[0];
  return best
    ? { status: "PLACED", surfaceId: best.surfaceId, transform: best.transform }
    : {
        status: "NO_FIT",
        reason: "NO_CLEAR_SUPPORT",
        message: `No clear ${model.support.toLowerCase()} support fits ${model.name} in ${environment.name}. No item was inserted. Choose another Environment, make space, or use reviewed manual placement.`,
      };
}
