import type { RoomEnvironment } from "./environment-contracts";
import type { RoomGeometry } from "./room-geometry";
import { trailElevation } from "./terrain";

export type ConstructionFinding = {
  code: string;
  severity: "ERROR" | "WARNING";
  featureIds: string[];
  partIds: string[];
  message: string;
};
type Box = { part: RoomGeometry; yaw: number; minY: number; maxY: number; corners: { x: number; z: number }[] };
const shell = new Set(["FLOOR", "WALL", "CEILING"]);
const openings = new Set(["DOOR", "WINDOW"]);
const epsilon = 0.015;
// Deliberately broad review envelopes, not adult ergonomic or physical calibration rules.
// Miniatures and unusual furnishings remain editable; confirmation never suppresses a warning.
const furnishingHeights: Partial<Record<NonNullable<RoomGeometry["classification"]>, [number, number]>> = {
  DESK: [0.1, 3],
  TABLE: [0.1, 3],
  CHAIR: [0.15, 3],
  SOFA: [0.15, 3],
  BED: [0.1, 3],
  WARDROBE: [0.25, 5],
};
function boxOf(part: RoomGeometry): Box {
  const q = part.rotation ?? { x: 0, y: 0, z: 0, w: 1 };
  const yaw = 2 * Math.atan2(q.y, q.w),
    c = Math.cos(yaw),
    s = Math.sin(yaw);
  return {
    part,
    yaw,
    minY: part.position[1] - part.size[1] / 2,
    maxY: part.position[1] + part.size[1] / 2,
    corners: [-1, 1].flatMap((x) =>
      [-1, 1].map((z) => ({
        x: part.position[0] + (c * x * part.size[0]) / 2 + (s * z * part.size[2]) / 2,
        z: part.position[2] - (s * x * part.size[0]) / 2 + (c * z * part.size[2]) / 2,
      })),
    ),
  };
}
function horizontalOverlap(a: Box, b: Box, tolerance = epsilon) {
  for (const angle of [a.yaw, a.yaw + Math.PI / 2, b.yaw, b.yaw + Math.PI / 2]) {
    const project = (box: Box) => box.corners.map((p) => p.x * Math.cos(angle) + p.z * Math.sin(angle));
    const av = project(a),
      bv = project(b);
    if (Math.min(Math.max(...av), Math.max(...bv)) - Math.max(Math.min(...av), Math.min(...bv)) <= tolerance)
      return false;
  }
  return true;
}

/** Conservative solids for the renderer's trunk and elevated crown, rather than
 * pretending that a tree's entire semantic bounding box is a ground-level block.
 * Cone envelopes may over-report; no finding is suppressed by provenance.
 */
function collisionBoxes(part: RoomGeometry): Box[] {
  if (part.shape !== "TREE") return [boxOf(part)];
  const radius = Math.min(part.size[0], part.size[2]);
  const h = part.size[1],
    bottom = part.position[1] - h / 2;
  return [
    boxOf({
      ...part,
      size: [radius * 0.2, h * 0.6, radius * 0.2],
      position: [part.position[0], bottom + h * 0.3, part.position[2]],
    }),
    ...[0, 1, 2].map((i) =>
      boxOf({
        ...part,
        size: [radius * (1 - i * 0.16), h * 0.4, radius * (1 - i * 0.16)],
        position: [part.position[0], bottom + h * (0.48 + i * 0.15), part.position[2]],
      }),
    ),
  ];
}

/** Independent inspection of realized construction, not a generator completion receipt.
 * Uses world-space solids, topology, support and pairwise SAT tests. Provenance
 * confidence never upgrades or suppresses a geometric finding. View cutaways
 * are excluded: pass the complete construction, before display-only clipping.
 */
export function verifyConstructedEnvironment(
  room: RoomEnvironment,
  geometry: readonly RoomGeometry[],
  options: { outdoor?: boolean } = {},
) {
  const outdoor = options.outdoor ?? room.construction?.kind === "OUTDOOR";
  const findings: ConstructionFinding[] = [];
  const add = (
    code: string,
    message: string,
    parts: readonly RoomGeometry[],
    severity: ConstructionFinding["severity"] = "ERROR",
    featureIds?: string[],
  ) => {
    findings.push({
      code,
      severity,
      message,
      featureIds: featureIds ?? [...new Set(parts.map((part) => part.featureId ?? part.id))],
      partIds: parts.map((part) => part.id),
    });
  };
  const ids = new Set(geometry.map((part) => part.id));
  const expectedIds = new Set(room.features.flatMap((feature) => feature.parts.map((part) => part.id)));
  for (const part of geometry) {
    if (!expectedIds.has(part.id))
      add("UNEXPECTED_CONSTRUCTION_PART", "A constructed part is absent from the editable specification.", [part]);
    if (part.size.some((v) => !Number.isFinite(v) || v <= 0) || part.position.some((v) => !Number.isFinite(v)))
      add("INVALID_SOLID", "Constructed dimensions and coordinates must be finite positive metre values.", [part]);
    const q = part.rotation;
    if (q && (!Object.values(q).every(Number.isFinite) || Math.abs(Math.hypot(q.x, q.y, q.z, q.w) - 1) > 1e-5))
      add("INVALID_CONSTRUCTION_ROTATION", "Constructed rotation must be a finite unit quaternion.", [part]);
    else if (q && (Math.abs(q.x) > 1e-5 || Math.abs(q.z) > 1e-5))
      add(
        "UNSUPPORTED_CONSTRUCTION_TILT",
        "These construction checks support upright, yaw-rotated parts. Correct this tilt before trusting support or overlap checks.",
        [part],
      );
  }
  for (const feature of room.features) {
    const missing = feature.parts.filter((part) => !ids.has(part.id));
    if (missing.length)
      add("MISSING_CONSTRUCTION_PART", `${feature.name} is missing ${missing.length} constructed parts.`, [], "ERROR", [
        feature.id,
      ]);
    if (missing.length) findings[findings.length - 1].partIds = missing.map((part) => part.id);
  }
  if (geometry.length > 512) add("CONSTRUCTION_BUDGET", "The construction exceeds 512 parts.", []);
  const physicalGeometry = geometry.filter((part) => part.classification !== "EXCLUSION_ZONE");
  const boxes = physicalGeometry.map(boxOf);
  const floors = boxes.filter((box) => box.part.classification === "FLOOR" && box.part.surface === "FLOOR");
  if (floors.length !== 1)
    add(
      "WHOLE_FLOOR_CONTINUITY",
      "Provide one continuous whole-floor support face.",
      floors.map((box) => box.part),
    );
  for (const floor of floors) {
    const xs = floor.corners.map((p) => p.x),
      zs = floor.corners.map((p) => p.z);
    if (
      Math.abs(floor.maxY) > epsilon ||
      Math.min(...xs) > -room.width / 2 + epsilon ||
      Math.max(...xs) < room.width / 2 - epsilon ||
      Math.min(...zs) > -room.depth / 2 + epsilon ||
      Math.max(...zs) < room.depth / 2 - epsilon
    )
      add("FLOOR_EXTENT", "The floor must meet ground height and cover the declared room footprint.", [floor.part]);
  }
  const walls = boxes.filter((box) => box.part.classification === "WALL" && box.part.surface === "WALL");
  const boundaries = new Set<string>();
  for (const wall of walls) {
    const thinX = wall.part.size[0] < wall.part.size[2];
    const angle = wall.yaw + (thinX ? Math.PI / 2 : 0);
    const axisX = Math.abs(Math.sin(angle)) > 0.99,
      axisZ = Math.abs(Math.cos(angle)) > 0.99;
    const plane = axisX ? wall.part.position[0] : wall.part.position[2];
    const edge = (axisX ? room.width : room.depth) / 2;
    const span = wall.corners.map((p) => (axisX ? p.z : p.x));
    const expectedSpan = (axisX ? room.depth : room.width) / 2;
    if (
      !(axisX || axisZ) ||
      Math.abs(Math.abs(plane) - edge) > epsilon ||
      Math.abs(wall.minY) > epsilon ||
      Math.abs(wall.maxY - room.height) > epsilon ||
      Math.min(...span) > -expectedSpan + epsilon ||
      Math.max(...span) < expectedSpan - epsilon
    )
      add("WALL_TOPOLOGY", "The boundary wall must meet the floor, ceiling and adjacent room boundaries.", [wall.part]);
    else boundaries.add(`${axisX ? "X" : "Z"}:${Math.sign(plane)}`);
    const width = wall.part.size[0],
      height = wall.part.size[1];
    for (const opening of wall.part.openings ?? [])
      if (
        opening.width <= 0 ||
        opening.depth <= 0 ||
        Math.abs(opening.x) + opening.width / 2 > width / 2 + epsilon ||
        Math.abs(opening.y) + opening.depth / 2 > height / 2 + epsilon
      )
        add("OPENING_OUTSIDE_WALL", "A wall opening extends outside its constructed wall face.", [wall.part]);
  }
  if (!outdoor && boundaries.size !== 4)
    add(
      "INCOMPLETE_ROOM_SHELL",
      `The complete room needs four joined boundaries; ${boundaries.size} are present.`,
      walls.map((box) => box.part),
    );
  const ceilings = boxes.filter((box) => box.part.classification === "CEILING");
  for (const ceiling of ceilings) {
    const xs = ceiling.corners.map((point) => point.x),
      zs = ceiling.corners.map((point) => point.z);
    if (
      Math.abs(ceiling.minY - room.height) > epsilon ||
      Math.min(...xs) > -room.width / 2 + epsilon ||
      Math.max(...xs) < room.width / 2 - epsilon ||
      Math.min(...zs) > -room.depth / 2 + epsilon ||
      Math.max(...zs) < room.depth / 2 - epsilon
    )
      add("CEILING_EXTENT", "The ceiling must cover the declared room at its full height.", [ceiling.part]);
  }
  if (!outdoor && !ceilings.some((box) => Math.abs(box.minY - room.height) <= epsilon))
    add(
      "MISSING_CEILING",
      "The complete room needs a ceiling at its declared height; cutaway viewing may hide it afterward.",
      ceilings.map((box) => box.part),
    );

  for (const feature of room.features.filter((feature) => !shell.has(feature.classification))) {
    const parts = boxes.filter((box) => box.part.featureId === feature.id);
    if (!parts.length) continue;
    const heightRange = furnishingHeights[feature.classification];
    const builtHeight = Math.max(...parts.map((box) => box.maxY)) - Math.min(...parts.map((box) => box.minY));
    if (heightRange && (builtHeight < heightRange[0] || builtHeight > heightRange[1]))
      add(
        "UNUSUAL_FURNISHING_SCALE",
        `${feature.name} is ${builtHeight.toFixed(3)} m tall, outside the broad ${heightRange[0]}–${heightRange[1]} m review range for a ${feature.classification.toLowerCase()}. Check units or confirm the intended size; this is not a measured calibration.`,
        parts.map((box) => box.part),
        "WARNING",
      );
    if (openings.has(feature.classification)) {
      const angle = (feature.yawDegrees * Math.PI) / 180;
      const attached = walls.some((wall) => {
        const thinX = wall.part.size[0] < wall.part.size[2];
        const wallNormal = wall.yaw + (thinX ? Math.PI / 2 : 0);
        const normalDistance = Math.abs(
          (feature.position.x - wall.part.position[0]) * Math.sin(wallNormal) +
            (feature.position.z - wall.part.position[2]) * Math.cos(wallNormal),
        );
        const tangentDistance =
          (feature.position.x - wall.part.position[0]) * Math.cos(wallNormal) -
          (feature.position.z - wall.part.position[2]) * Math.sin(wallNormal);
        const localY = feature.position.y - wall.part.position[1];
        const holeCoversOpening = (wall.part.openings ?? []).some(
          (hole) =>
            Math.abs(hole.x - tangentDistance) + feature.dimensions[0] / 2 <= hole.width / 2 + epsilon &&
            Math.abs(hole.y - localY) + feature.dimensions[1] / 2 <= hole.depth / 2 + epsilon,
        );
        return (
          Math.abs(Math.sin(angle - wallNormal)) < 1e-5 &&
          normalDistance <= epsilon &&
          feature.position.y - feature.dimensions[1] / 2 >= -epsilon &&
          feature.position.y + feature.dimensions[1] / 2 <= room.height + epsilon &&
          holeCoversOpening
        );
      });
      if (!attached)
        add(
          "OPENING_ATTACHMENT",
          `${feature.name} needs a coplanar boundary wall with a matching constructed aperture.`,
          parts.map((box) => box.part),
        );
      continue;
    }
    if (
      parts.some(
        (box) =>
          box.minY < (outdoor ? -0.16 : 0) - epsilon ||
          box.maxY > room.height + epsilon ||
          box.corners.some((p) => Math.abs(p.x) > room.width / 2 + epsilon || Math.abs(p.z) > room.depth / 2 + epsilon),
      )
    )
      add(
        "FURNISHING_CONTAINMENT",
        `${feature.name} extends outside the declared environment.`,
        parts.map((box) => box.part),
      );
    const lowest = Math.min(...parts.map((box) => box.minY));
    const relationship = room.construction?.relationships.find((relation) => relation.featureId === feature.id);
    const mounting =
      relationship?.type === "MOUNTED_ON"
        ? boxes.filter((box) => box.part.featureId === relationship.targetFeatureId)
        : [];
    const mounted = mounting.some((wall) => {
      if (wall.part.classification === "CEILING")
        return parts.some((box) => Math.abs(box.maxY - wall.minY) <= epsilon && horizontalOverlap(box, wall, 0));
      if (wall.part.classification !== "WALL") {
        // A declared layered display can contact a thin mounted panel. Its ancestry must reach a wall.
        let parentId = wall.part.featureId;
        const seen = new Set<string>();
        while (parentId && !seen.has(parentId)) {
          seen.add(parentId);
          const parent = room.features.find((part) => part.id === parentId);
          if (!parent) return false;
          if (parent.classification === "WALL") break;
          if (parent.dimensions[2] > 0.25) return false;
          const mount = room.construction?.relationships.find((relation) => relation.featureId === parentId);
          if (mount?.type !== "MOUNTED_ON") return false;
          parentId = mount.targetFeatureId;
        }
        if (!parentId || room.features.find((part) => part.id === parentId)?.classification !== "WALL") return false;
      }
      const normal = wall.yaw + (wall.part.size[0] < wall.part.size[2] ? Math.PI / 2 : 0);
      const thickness = Math.min(wall.part.size[0], wall.part.size[2]);
      return parts.some((box) => {
        if (wall.part.classification !== "WALL") {
          const tangent = (p: { x: number; z: number }) => p.x * Math.cos(normal) - p.z * Math.sin(normal);
          const a = box.corners.map(tangent),
            b = wall.corners.map(tangent);
          if (
            Math.min(Math.max(...a), Math.max(...b)) - Math.max(Math.min(...a), Math.min(...b)) <= epsilon ||
            Math.min(box.maxY, wall.maxY) - Math.max(box.minY, wall.minY) <= epsilon
          )
            return false;
        }
        const distances = box.corners.map(
          (p) => (p.x - wall.part.position[0]) * Math.sin(normal) + (p.z - wall.part.position[2]) * Math.cos(normal),
        );
        return (
          Math.abs(Math.min(...distances) - thickness / 2) <= epsilon &&
          (wall.part.classification !== "WALL" || (box.minY >= wall.minY - epsilon && box.maxY <= wall.maxY + epsilon))
        );
      });
    });
    const supported =
      mounted ||
      parts
        .filter((box) => Math.abs(box.minY - lowest) <= epsilon)
        .some((part) =>
          boxes.some(
            (support) =>
              support.part.featureId !== feature.id &&
              (!relationship ||
                relationship.type !== "SUPPORTED_BY" ||
                support.part.featureId === relationship.targetFeatureId) &&
              support.part.surface !== null &&
              support.part.face === "TOP" &&
              Math.abs(
                (support.part.shape === "TERRAIN"
                  ? trailElevation(part.part.position[0], part.part.position[2], room.width, room.depth)
                  : support.maxY) - part.minY,
              ) <= epsilon &&
              horizontalOverlap(part, support, 0),
          ),
        );
    if (!supported)
      add(
        "UNSUPPORTED_FEATURE",
        `${feature.name} has no ground or modeled support contact. Review ground height or its attachment.`,
        parts.map((box) => box.part),
      );
  }
  const furniture = physicalGeometry
    .flatMap(collisionBoxes)
    .filter(
      (box) => !shell.has(box.part.classification ?? "OTHER") && !openings.has(box.part.classification ?? "OTHER"),
    );
  const reported = new Set<string>();
  for (let i = 0; i < furniture.length; i++)
    for (let j = i + 1; j < furniture.length; j++) {
      const a = furniture[i],
        b = furniture[j];
      if (a.part.featureId === b.part.featureId) continue;
      const pair = [a.part.featureId ?? a.part.id, b.part.featureId ?? b.part.id].sort().join("|");
      if (
        reported.has(pair) ||
        Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY) <= epsilon ||
        !horizontalOverlap(a, b)
      )
        continue;
      reported.add(pair);
      add(
        "FEATURE_INTERPENETRATION",
        "Constructed solids from these features interpenetrate; touching supports are allowed.",
        [a.part, b.part],
      );
    }
  for (const box of boxes.filter((box) => box.part.surface !== null)) {
    const wall = box.part.surface === "WALL";
    if ((wall && box.part.face === "TOP") || (!wall && box.part.face !== "TOP"))
      add(
        "ATTACHMENT_SURFACE_ORIENTATION",
        "The semantic attachment surface does not match its constructed face orientation.",
        [box.part],
      );
    if (wall && box.part.classification === "WALL" && !outdoor && box.part.face !== "TOP") {
      const angle = box.yaw + (box.part.face === "RIGHT" ? Math.PI / 2 : 0);
      // The room origin is its interior centre. The declared usable wall face must face it.
      const towardInterior = -box.part.position[0] * Math.sin(angle) - box.part.position[2] * Math.cos(angle);
      if (towardInterior <= epsilon)
        add(
          "OUTWARD_WALL_SURFACE",
          "The usable wall face points outside this room. Rotate the wall so its attachment face points into the room.",
          [box.part],
        );
    }
  }
  for (const relation of room.construction?.relationships ?? []) {
    if (
      relation.featureId === relation.targetFeatureId ||
      !room.features.some((f) => f.id === relation.targetFeatureId) ||
      !room.features.some((f) => f.id === relation.featureId)
    )
      add("INVALID_RELATIONSHIP", "A construction relationship needs two distinct existing features.", [], "ERROR", [
        relation.featureId,
        relation.targetFeatureId,
      ]);
  }
  const occupied = furniture.filter((box) => box.maxY > 0.08 && box.minY < 1.8);
  const clearAt = (x: number, z: number, radius: number) =>
    !occupied.some((box) => {
      const c = Math.cos(box.yaw),
        s = Math.sin(box.yaw),
        dx = x - box.part.position[0],
        dz = z - box.part.position[2];
      return (
        Math.abs(c * dx - s * dz) < box.part.size[0] / 2 + radius &&
        Math.abs(s * dx + c * dz) < box.part.size[2] / 2 + radius
      );
    });
  const navigation = room.construction?.navigation;
  if (navigation) {
    const pathParts = boxes.filter((box) => box.part.shape === "PATH");
    let broken = false;
    for (let i = 1; i < navigation.points.length; i++) {
      const a = navigation.points[i - 1],
        b = navigation.points[i],
        length = Math.hypot(b.x - a.x, b.z - a.z);
      if (length < 0.01 || Math.abs(a.y - b.y) > 0.1) broken = true;
      for (let step = 0; step <= Math.ceil(length / 0.15); step++) {
        const t = step / Math.max(1, Math.ceil(length / 0.15)),
          x = a.x + (b.x - a.x) * t,
          z = a.z + (b.z - a.z) * t;
        if (
          !clearAt(x, z, navigation.widthMeters / 2) ||
          !pathParts.some(
            (box) =>
              Math.abs(x - box.part.position[0]) <= box.part.size[0] / 2 - navigation.widthMeters / 2 + epsilon &&
              Math.abs(z - box.part.position[2]) <= box.part.size[2] / 2 + epsilon &&
              Math.abs(box.maxY - a.y) < 0.03,
          )
        )
          broken = true;
      }
    }
    if (broken)
      add(
        "NAVIGATION_CONTINUITY",
        "The declared walking corridor is interrupted, obstructed or unsupported by continuous path construction.",
        pathParts.map((box) => box.part),
      );
  }
  let usable = false;
  for (let x = -room.width / 2 + 0.25; x <= room.width / 2 - 0.25 && !usable; x += Math.max(0.15, room.width / 80))
    for (let z = -room.depth / 2 + 0.25; z <= room.depth / 2 - 0.25 && !usable; z += Math.max(0.15, room.depth / 80))
      usable = clearAt(x, z, 0.25);
  if (!usable)
    add(
      "NO_USABLE_FLOOR_AREA",
      "No clear half-metre working area was found. Review furniture crowding.",
      floors.map((box) => box.part),
      "WARNING",
    );
  return {
    status: findings.some((finding) => finding.severity === "ERROR")
      ? ("NEEDS_CORRECTION" as const)
      : ("CHECKS_PASSED" as const),
    findings,
    inspectedParts: geometry.length,
    inspectedFeatures: room.features.length,
    physicalCalibration: false as const,
    coverage: "PART_SOLIDS_TOPOLOGY_SUPPORT_APERTURES_RELATIONSHIPS_NAVIGATION" as const,
    limitations: [
      "Part-solid bounds do not certify triangle-mesh collisions or physical accessibility.",
      "Furnishing scale ranges are broad review hints, not measured or ergonomic certification.",
      "Visual quality and rendered resource costs require browser review.",
    ],
  };
}
