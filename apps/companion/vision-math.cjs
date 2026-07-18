"use strict";

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function dot(left, right) {
  let sum = 0;
  for (let index = 0; index < Math.min(left.length, right.length); index += 1) sum += left[index] * right[index];
  return sum;
}

function magnitude(values) {
  return Math.sqrt(dot(values, values));
}

function normalize(values) {
  const length = magnitude(values);
  return length > 1e-12 ? values.map((value) => value / length) : values.map(() => 0);
}

function cosineSimilarity(left, right) {
  const denominator = magnitude(left) * magnitude(right);
  return denominator > 1e-12 ? clamp(dot(left, right) / denominator, -1, 1) : 0;
}

function solveLinearSystem(matrix, vector) {
  const size = vector.length;
  const rows = matrix.map((row, index) => [...row, vector[index]]);
  for (let column = 0; column < size; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < size; row += 1)
      if (Math.abs(rows[row][column]) > Math.abs(rows[pivot][column])) pivot = row;
    if (Math.abs(rows[pivot][column]) < 1e-10) return null;
    [rows[column], rows[pivot]] = [rows[pivot], rows[column]];
    const divisor = rows[column][column];
    for (let index = column; index <= size; index += 1) rows[column][index] /= divisor;
    for (let row = 0; row < size; row += 1) {
      if (row === column) continue;
      const factor = rows[row][column];
      for (let index = column; index <= size; index += 1) rows[row][index] -= factor * rows[column][index];
    }
  }
  return rows.map((row) => row[size]);
}

function leastSquares(rows, values, parameterCount) {
  const normal = Array.from({ length: parameterCount }, () => Array(parameterCount).fill(0));
  const right = Array(parameterCount).fill(0);
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    for (let left = 0; left < parameterCount; left += 1) {
      right[left] += row[left] * values[rowIndex];
      for (let column = 0; column < parameterCount; column += 1) normal[left][column] += row[left] * row[column];
    }
  }
  for (let index = 0; index < parameterCount; index += 1) normal[index][index] += 1e-9;
  return solveLinearSystem(normal, right);
}

function estimateHomography(matches) {
  if (!Array.isArray(matches) || matches.length < 4) return null;
  const rows = [];
  const values = [];
  for (const match of matches) {
    const x = match.query.x;
    const y = match.query.y;
    const u = match.reference.x;
    const v = match.reference.y;
    rows.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    values.push(u);
    rows.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    values.push(v);
  }
  const solution = leastSquares(rows, values, 8);
  if (!solution || solution.some((value) => !Number.isFinite(value))) return null;
  return [solution[0], solution[1], solution[2], solution[3], solution[4], solution[5], solution[6], solution[7], 1];
}

function projectHomography(matrix, point) {
  const denominator = matrix[6] * point.x + matrix[7] * point.y + matrix[8];
  if (Math.abs(denominator) < 1e-9) return null;
  return {
    x: (matrix[0] * point.x + matrix[1] * point.y + matrix[2]) / denominator,
    y: (matrix[3] * point.x + matrix[4] * point.y + matrix[5]) / denominator,
  };
}

function reprojectionError(matrix, match) {
  const projected = projectHomography(matrix, match.query);
  return projected
    ? Math.hypot(projected.x - match.reference.x, projected.y - match.reference.y)
    : Number.POSITIVE_INFINITY;
}

function deterministicSample(length, count, iteration) {
  const result = [];
  let state = ((iteration + 1) * 2654435761) >>> 0;
  while (result.length < count && result.length < length) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const candidate = state % length;
    if (!result.includes(candidate)) result.push(candidate);
  }
  return result;
}

function ransacHomography(matches, options = {}) {
  const thresholdPx = options.thresholdPx ?? 4;
  const iterations = Math.min(options.iterations ?? 96, Math.max(24, matches.length * 4));
  if (!Array.isArray(matches) || matches.length < 4)
    return { valid: false, matrix: null, inliers: [], inlierRatio: 0, meanError: null, reason: "TOO_FEW_MATCHES" };
  let best = null;
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const sample = deterministicSample(matches.length, 4, iteration).map((index) => matches[index]);
    const matrix = estimateHomography(sample);
    if (!matrix) continue;
    const inliers = matches.filter((match) => reprojectionError(matrix, match) <= thresholdPx);
    const error = inliers.length
      ? inliers.reduce((sum, match) => sum + reprojectionError(matrix, match), 0) / inliers.length
      : Number.POSITIVE_INFINITY;
    if (!best || inliers.length > best.inliers.length || (inliers.length === best.inliers.length && error < best.error))
      best = { matrix, inliers, error };
  }
  if (!best || best.inliers.length < 4)
    return { valid: false, matrix: null, inliers: [], inlierRatio: 0, meanError: null, reason: "NO_STABLE_MODEL" };
  const refined = estimateHomography(best.inliers) ?? best.matrix;
  const refinedInliers = matches.filter((match) => reprojectionError(refined, match) <= thresholdPx);
  const meanError =
    refinedInliers.reduce((sum, match) => sum + reprojectionError(refined, match), 0) / refinedInliers.length;
  const determinant = refined[0] * refined[4] - refined[1] * refined[3];
  const perspective = Math.hypot(refined[6], refined[7]);
  const valid =
    Number.isFinite(meanError) && Math.abs(determinant) > 0.02 && Math.abs(determinant) < 25 && perspective < 0.08;
  return {
    valid,
    matrix: refined,
    inliers: refinedInliers,
    inlierRatio: refinedInliers.length / matches.length,
    meanError,
    determinant,
    perspective,
    reason: valid ? null : "DEGENERATE_TRANSFORM",
  };
}

function polygonArea(points) {
  if (!points || points.length < 3) return 0;
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const next = points[(index + 1) % points.length];
    area += points[index].x * next.y - next.x * points[index].y;
  }
  return Math.abs(area) / 2;
}

function convexHull(points) {
  const sorted = [...points]
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
    .sort((left, right) => left.x - right.x || left.y - right.y);
  if (sorted.length <= 2) return sorted;
  const cross = (origin, left, right) =>
    (left.x - origin.x) * (right.y - origin.y) - (left.y - origin.y) * (right.x - origin.x);
  const lower = [];
  for (const point of sorted) {
    while (lower.length >= 2 && cross(lower.at(-2), lower.at(-1), point) <= 0) lower.pop();
    lower.push(point);
  }
  const upper = [];
  for (const point of sorted.reverse()) {
    while (upper.length >= 2 && cross(upper.at(-2), upper.at(-1), point) <= 0) upper.pop();
    upper.push(point);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

function spatialCoverage(points, width, height, gridSize = 4) {
  if (!points.length || width <= 0 || height <= 0) return { occupiedRatio: 0, hullRatio: 0, entropy: 0, cells: [] };
  const counts = new Map();
  for (const point of points) {
    const column = clamp(Math.floor((point.x / width) * gridSize), 0, gridSize - 1);
    const row = clamp(Math.floor((point.y / height) * gridSize), 0, gridSize - 1);
    const key = `${row}:${column}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let entropy = 0;
  for (const count of counts.values()) {
    const probability = count / points.length;
    entropy -= probability * Math.log2(probability);
  }
  const hullRatio = polygonArea(convexHull(points)) / Math.max(1, width * height);
  return {
    occupiedRatio: counts.size / (gridSize * gridSize),
    hullRatio,
    entropy: entropy / Math.log2(gridSize * gridSize),
    cells: [...counts.keys()].sort(),
  };
}

function pointInPolygon(point, polygon) {
  let inside = false;
  for (let left = 0, right = polygon.length - 1; left < polygon.length; right = left++) {
    const a = polygon[left];
    const b = polygon[right];
    const intersects =
      a.y > point.y !== b.y > point.y && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y || 1e-12) + a.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

function poseInsideRegion(pose, region) {
  const parameters = region?.parameters ?? region ?? {};
  const shape = String(region?.shapeType ?? parameters.shapeType ?? "BOX").toUpperCase();
  if (shape === "CIRCLE") {
    const centerX = Number(parameters.centerX ?? 0);
    const centerZ = Number(parameters.centerZ ?? 1);
    const radius = Number(parameters.radius ?? 1);
    return Math.hypot(pose.x - centerX, pose.z - centerZ) <= radius;
  }
  if (shape === "SPHERE") {
    const center = parameters.center ?? { x: 0, y: 0, z: 1 };
    const radius = Number(parameters.radius ?? parameters.maximumDistance ?? 1);
    return Math.hypot(pose.x - center.x, pose.y - center.y, pose.z - center.z) <= radius;
  }
  if (shape === "CYLINDER") {
    const center = parameters.center ?? { x: 0, y: 0, z: 1 };
    const radius = Number(parameters.radius ?? 1);
    const minimumY = Number(parameters.minimumY ?? -1);
    const maximumY = Number(parameters.maximumY ?? 1);
    return Math.hypot(pose.x - center.x, pose.z - center.z) <= radius && pose.y >= minimumY && pose.y <= maximumY;
  }
  if (["POLYGON", "POLYGONAL_PRISM"].includes(shape) && Array.isArray(parameters.points)) {
    return (
      pointInPolygon({ x: pose.x, y: pose.z }, parameters.points) &&
      pose.y >= Number(parameters.minimumY ?? -Infinity) &&
      pose.y <= Number(parameters.maximumY ?? Infinity)
    );
  }
  const minimum = parameters.minimum ?? parameters.min ?? { x: -1, y: -1, z: 0 };
  const maximum = parameters.maximum ?? parameters.max ?? { x: 1, y: 1, z: 3 };
  return (
    pose.x >= minimum.x &&
    pose.x <= maximum.x &&
    pose.y >= minimum.y &&
    pose.y <= maximum.y &&
    pose.z >= minimum.z &&
    pose.z <= maximum.z
  );
}

module.exports = {
  clamp,
  cosineSimilarity,
  convexHull,
  dot,
  estimateHomography,
  magnitude,
  normalize,
  pointInPolygon,
  polygonArea,
  poseInsideRegion,
  projectHomography,
  ransacHomography,
  reprojectionError,
  solveLinearSystem,
  spatialCoverage,
};
