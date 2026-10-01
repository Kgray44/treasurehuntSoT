import type { LandfallCoordinate, LandfallGeometry, LandfallWorldspace } from "@/landfall/schema";

const EARTH_RADIUS_METERS = 6_371_008.8;
const rad = (degrees: number) => (degrees * Math.PI) / 180;
const degrees = (radians: number) => (radians * 180) / Math.PI;

export class LandfallGeometryError extends Error {
  constructor(public readonly code: "REFERENCE_MISMATCH" | "OUT_OF_BOUNDS" | "INVALID_GEOMETRY" | "TRANSFORM_FAILED") {
    super(code);
  }
}

export function assertCoordinateInWorldspace(coordinate: LandfallCoordinate, worldspace: LandfallWorldspace): void {
  const reference = worldspace.coordinateReference;
  if (
    coordinate.worldspaceId !== worldspace.id ||
    coordinate.referenceId !== reference.id ||
    coordinate.referenceVersion !== reference.version ||
    coordinate.type !== reference.type
  )
    throw new LandfallGeometryError("REFERENCE_MISMATCH");
  if (coordinate.type === "WGS84") return;
  if (reference.type === "WGS84") throw new LandfallGeometryError("REFERENCE_MISMATCH");
  if (
    coordinate.x < reference.bounds.minX ||
    coordinate.x > reference.bounds.maxX ||
    coordinate.y < reference.bounds.minY ||
    coordinate.y > reference.bounds.maxY
  )
    throw new LandfallGeometryError("OUT_OF_BOUNDS");
}

export function toWgs84(
  coordinate: LandfallCoordinate,
  worldspace: LandfallWorldspace,
): { latitude: number; longitude: number; uncertaintyMeters: number } {
  assertCoordinateInWorldspace(coordinate, worldspace);
  if (coordinate.type === "WGS84")
    return { latitude: coordinate.latitude, longitude: coordinate.longitude, uncertaintyMeters: 0 };
  if (coordinate.type !== "CUSTOM_GEOREFERENCED" || worldspace.coordinateReference.type !== "CUSTOM_GEOREFERENCED")
    throw new LandfallGeometryError("TRANSFORM_FAILED");
  const { a, b, c, d, e, f, maxResidual } = worldspace.coordinateReference.toWgs84;
  const longitude = a * coordinate.x + b * coordinate.y + e;
  const latitude = c * coordinate.x + d * coordinate.y + f;
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  )
    throw new LandfallGeometryError("TRANSFORM_FAILED");
  return { latitude, longitude, uncertaintyMeters: maxResidual };
}

export function physicalDistanceMeters(
  a: LandfallCoordinate,
  b: LandfallCoordinate,
  worldspace: LandfallWorldspace,
): number {
  if (worldspace.kind !== "PHYSICAL") throw new LandfallGeometryError("REFERENCE_MISMATCH");
  const left = toWgs84(a, worldspace);
  const right = toWgs84(b, worldspace);
  const dLat = rad(right.latitude - left.latitude);
  const dLon = rad(((right.longitude - left.longitude + 540) % 360) - 180);
  const hav =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(left.latitude)) * Math.cos(rad(right.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(hav)));
}

export function bearingDegrees(a: LandfallCoordinate, b: LandfallCoordinate, worldspace: LandfallWorldspace): number {
  const left = toWgs84(a, worldspace);
  const right = toWgs84(b, worldspace);
  const dLon = rad(right.longitude - left.longitude);
  const y = Math.sin(dLon) * Math.cos(rad(right.latitude));
  const x =
    Math.cos(rad(left.latitude)) * Math.sin(rad(right.latitude)) -
    Math.sin(rad(left.latitude)) * Math.cos(rad(right.latitude)) * Math.cos(dLon);
  return (degrees(Math.atan2(y, x)) + 360) % 360;
}

export function distance(a: LandfallCoordinate, b: LandfallCoordinate, worldspace: LandfallWorldspace): number {
  assertCoordinateInWorldspace(a, worldspace);
  assertCoordinateInWorldspace(b, worldspace);
  if (worldspace.kind === "PHYSICAL") return physicalDistanceMeters(a, b, worldspace);
  if (a.type === "WGS84" || b.type === "WGS84") throw new LandfallGeometryError("REFERENCE_MISMATCH");
  return Math.hypot(a.x - b.x, a.y - b.y);
}

type XY = { x: number; y: number };
function localPoint(coordinate: LandfallCoordinate, worldspace: LandfallWorldspace, origin?: LandfallCoordinate): XY {
  assertCoordinateInWorldspace(coordinate, worldspace);
  if (worldspace.kind === "VIRTUAL") {
    if (coordinate.type === "WGS84") throw new LandfallGeometryError("REFERENCE_MISMATCH");
    return { x: coordinate.x, y: coordinate.y };
  }
  const point = toWgs84(coordinate, worldspace);
  const anchor = origin ? toWgs84(origin, worldspace) : { latitude: 0, longitude: 0 };
  const deltaLongitude = ((point.longitude - anchor.longitude + 540) % 360) - 180;
  return {
    x: EARTH_RADIUS_METERS * rad(deltaLongitude) * Math.cos(rad(anchor.latitude)),
    y: EARTH_RADIUS_METERS * rad(point.latitude - anchor.latitude),
  };
}

function segmentDistance(point: XY, a: XY, b: XY): { distance: number; fraction: number } {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const denominator = dx * dx + dy * dy;
  if (denominator <= 1e-20) return { distance: Math.hypot(point.x - a.x, point.y - a.y), fraction: 0 };
  const fraction = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / denominator));
  return { distance: Math.hypot(point.x - (a.x + fraction * dx), point.y - (a.y + fraction * dy)), fraction };
}

function pointInRing(point: XY, ring: XY[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i],
      b = ring[j];
    if (segmentDistance(point, a, b).distance < 1e-8) return true;
    if (a.y > point.y !== b.y > point.y && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x)
      inside = !inside;
  }
  return inside;
}

function polygonMatch(
  point: LandfallCoordinate,
  rings: LandfallCoordinate[][],
  worldspace: LandfallWorldspace,
): { inside: boolean; boundaryDistance: number } {
  const projectedPoint = localPoint(point, worldspace, point);
  const projectedRings = rings.map((ring) => ring.map((coordinate) => localPoint(coordinate, worldspace, point)));
  const inside =
    pointInRing(projectedPoint, projectedRings[0]) &&
    !projectedRings.slice(1).some((ring) => pointInRing(projectedPoint, ring));
  const boundaryDistance = Math.min(
    ...projectedRings.flatMap((ring) =>
      ring.slice(1).map((end, i) => segmentDistance(projectedPoint, ring[i], end).distance),
    ),
  );
  return { inside, boundaryDistance };
}

export function geometryMatch(
  point: LandfallCoordinate,
  geometry: LandfallGeometry,
  worldspace: LandfallWorldspace,
): { inside: boolean; boundaryDistance: number } {
  assertCoordinateInWorldspace(point, worldspace);
  if (geometry.type === "POINT_RADIUS" || geometry.type === "APPROXIMATE_REGION") {
    const gap = geometry.radius - distance(point, geometry.center, worldspace);
    return { inside: gap >= 0, boundaryDistance: Math.abs(gap) };
  }
  if (geometry.type === "POLYGON") return polygonMatch(point, geometry.rings, worldspace);
  if (geometry.type === "MULTIPOLYGON") {
    const matches = geometry.polygons.map((rings) => polygonMatch(point, rings, worldspace));
    return {
      inside: matches.some((match) => match.inside),
      boundaryDistance: Math.min(...matches.map((match) => match.boundaryDistance)),
    };
  }
  if (geometry.type === "CORRIDOR" || geometry.type === "ROUTE_LINE") {
    const progress = routeProgress(point, geometry.points, worldspace);
    const radius = geometry.type === "CORRIDOR" ? geometry.width / 2 : 0;
    return {
      inside: progress.offRouteDistance <= radius,
      boundaryDistance: Math.abs(progress.offRouteDistance - radius),
    };
  }
  throw new LandfallGeometryError("INVALID_GEOMETRY");
}

export function routeProgress(
  point: LandfallCoordinate,
  points: LandfallCoordinate[],
  worldspace: LandfallWorldspace,
): { fraction: number; distanceAlong: number; totalDistance: number; offRouteDistance: number } {
  if (points.length < 2 || points.length > 1024) throw new LandfallGeometryError("INVALID_GEOMETRY");
  const projectedPoint = localPoint(point, worldspace, point);
  const projected = points.map((coordinate) => localPoint(coordinate, worldspace, point));
  let totalDistance = 0,
    bestDistance = Infinity,
    bestAlong = 0;
  for (let i = 1; i < projected.length; i++) {
    const length = distance(points[i - 1], points[i], worldspace);
    const match = segmentDistance(projectedPoint, projected[i - 1], projected[i]);
    if (match.distance < bestDistance) {
      bestDistance = match.distance;
      bestAlong = totalDistance + match.fraction * length;
    }
    totalDistance += length;
  }
  return {
    fraction: totalDistance ? bestAlong / totalDistance : 0,
    distanceAlong: bestAlong,
    totalDistance,
    offRouteDistance: bestDistance,
  };
}

/** All segments are retained so a contextual matcher can reason about crossings and continuity. */
export function routeSegmentMatches(
  point: LandfallCoordinate,
  points: LandfallCoordinate[],
  worldspace: LandfallWorldspace,
): {
  segmentIndex: number;
  fraction: number;
  distance: number;
  distanceAlong: number;
  length: number;
  bearing: number;
}[] {
  if (points.length < 2 || points.length > 1024) throw new LandfallGeometryError("INVALID_GEOMETRY");
  const projectedPoint = localPoint(point, worldspace, point);
  const projected = points.map((coordinate) => localPoint(coordinate, worldspace, point));
  let along = 0;
  return points.slice(1).map((end, index) => {
    const length = distance(points[index], end, worldspace);
    const match = segmentDistance(projectedPoint, projected[index], projected[index + 1]);
    const result = {
      segmentIndex: index,
      fraction: match.fraction,
      distance: match.distance,
      distanceAlong: along + match.fraction * length,
      length,
      bearing:
        (degrees(Math.atan2(projected[index + 1].x - projected[index].x, projected[index + 1].y - projected[index].y)) +
          360) %
        360,
    };
    along += length;
    return result;
  });
}

function orientation(a: XY, b: XY, c: XY): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}
export function crossesGate(
  previous: LandfallCoordinate,
  current: LandfallCoordinate,
  gate: Extract<LandfallGeometry, { type: "ENTRANCE_GATE" }>,
  worldspace: LandfallWorldspace,
): boolean {
  const origin = gate.start;
  const a = localPoint(gate.start, worldspace, origin),
    b = localPoint(gate.end, worldspace, origin);
  const p = localPoint(previous, worldspace, origin),
    q = localPoint(current, worldspace, origin);
  const before = orientation(a, b, p),
    after = orientation(a, b, q);
  if (Math.abs(before) < 1e-8 || Math.abs(after) < 1e-8 || before * after >= 0) return false;
  if (gate.direction === "LEFT_TO_RIGHT" && !(before > 0 && after < 0)) return false;
  if (gate.direction === "RIGHT_TO_LEFT" && !(before < 0 && after > 0)) return false;
  return orientation(p, q, a) * orientation(p, q, b) <= 0;
}

export function validateGeometry(geometry: LandfallGeometry, worldspace: LandfallWorldspace): void {
  const ringValid = (ring: LandfallCoordinate[]) => {
    ring.forEach((coordinate) => assertCoordinateInWorldspace(coordinate, worldspace));
    if (ring.length < 4 || JSON.stringify(ring[0]) !== JSON.stringify(ring[ring.length - 1]))
      throw new LandfallGeometryError("INVALID_GEOMETRY");
    const projected = ring.map((coordinate) => localPoint(coordinate, worldspace, ring[0]));
    let area = 0;
    for (let i = 1; i < projected.length; i++) area += orientation({ x: 0, y: 0 }, projected[i - 1], projected[i]);
    if (Math.abs(area) < 1e-8) throw new LandfallGeometryError("INVALID_GEOMETRY");
    for (let i = 1; i < projected.length; i++)
      for (let j = i + 2; j < projected.length; j++) {
        if (i === 1 && j === projected.length - 1) continue;
        const a = projected[i - 1],
          b = projected[i],
          c = projected[j - 1],
          d = projected[j];
        if (orientation(a, b, c) * orientation(a, b, d) < 0 && orientation(c, d, a) * orientation(c, d, b) < 0)
          throw new LandfallGeometryError("INVALID_GEOMETRY");
      }
  };
  switch (geometry.type) {
    case "POINT_RADIUS":
      assertCoordinateInWorldspace(geometry.center, worldspace);
      break;
    case "APPROXIMATE_REGION":
      assertCoordinateInWorldspace(geometry.center, worldspace);
      if (geometry.publicRadius < geometry.radius) throw new LandfallGeometryError("INVALID_GEOMETRY");
      break;
    case "POLYGON":
      geometry.rings.forEach(ringValid);
      break;
    case "MULTIPOLYGON":
      geometry.polygons.forEach((polygon) => polygon.forEach(ringValid));
      break;
    case "ROUTE_LINE":
    case "CORRIDOR":
      geometry.points.forEach((coordinate) => assertCoordinateInWorldspace(coordinate, worldspace));
      if (
        !geometry.points.slice(1).some((coordinate, i) => distance(geometry.points[i], coordinate, worldspace) > 1e-8)
      )
        throw new LandfallGeometryError("INVALID_GEOMETRY");
      break;
    case "ENTRANCE_GATE":
      assertCoordinateInWorldspace(geometry.start, worldspace);
      assertCoordinateInWorldspace(geometry.end, worldspace);
      if (distance(geometry.start, geometry.end, worldspace) < 1e-8)
        throw new LandfallGeometryError("INVALID_GEOMETRY");
      break;
  }
}
