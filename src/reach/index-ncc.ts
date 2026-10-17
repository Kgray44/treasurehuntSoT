/** Exact gray-pixel NCC search. The caller owns captured-frame immutability. */
export type NccFrame = { data: Uint8Array; width: number; height: number; capture?: number };
export type NccPoint = { x: number; y: number };
export type NccTemplate = { values: Float32Array; mean: number; deviation: number; radius: number };
export type NccMatch = { point: NccPoint; correlation: number; separation: number };
type Region = {
  data: Uint8Array | null;
  capture: number | undefined;
  frameWidth: number;
  frameHeight: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  stride: number;
  sums: Float64Array;
  squares: Float64Array;
  usedAt: number;
};
export type NccScratch = {
  minimumTexture: number;
  peakExclusionRadius: number;
  regions: [Region, Region];
  clock: number;
};
export function createNccScratch(
  policy: { minimumTexture: number; peakExclusionRadius: number } = {
    minimumTexture: 6,
    peakExclusionRadius: 3,
  },
): NccScratch {
  const region = (): Region => ({
    data: null,
    capture: undefined,
    frameWidth: 0,
    frameHeight: 0,
    minX: 0,
    minY: 0,
    maxX: -1,
    maxY: -1,
    stride: 0,
    sums: new Float64Array(0),
    squares: new Float64Array(0),
    usedAt: 0,
  });
  return { ...policy, regions: [region(), region()], clock: 0 };
}
function moments(
  frame: NccFrame,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
  scratch: NccScratch,
): Region | null {
  minX = Math.max(0, minX);
  minY = Math.max(0, minY);
  maxX = Math.min(frame.width - 1, maxX);
  maxY = Math.min(frame.height - 1, maxY);
  if (minX > maxX || minY > maxY) return null;
  const cached = Number.isFinite(frame.capture)
    ? scratch.regions.find(
        (region) =>
          region.data === frame.data &&
          region.capture === frame.capture &&
          region.frameWidth === frame.width &&
          region.frameHeight === frame.height &&
          region.minX === minX &&
          region.minY === minY &&
          region.maxX === maxX &&
          region.maxY === maxY,
      )
    : undefined;
  if (cached) {
    cached.usedAt = ++scratch.clock;
    return cached;
  }
  const region = scratch.regions[0].usedAt <= scratch.regions[1].usedAt ? scratch.regions[0] : scratch.regions[1];
  const width = maxX - minX + 1,
    height = maxY - minY + 1,
    stride = width + 1,
    cells = stride * (height + 1);
  if (region.sums.length < cells) {
    region.sums = new Float64Array(cells);
    region.squares = new Float64Array(cells);
  }
  region.sums.fill(0, 0, stride);
  region.squares.fill(0, 0, stride);
  for (let y = 0; y < height; ++y) {
    let sum = 0,
      squared = 0;
    const row = (y + 1) * stride,
      previous = row - stride;
    region.sums[row] = 0;
    region.squares[row] = 0;
    let source = (minY + y) * frame.width + minX;
    for (let x = 1; x <= width; ++x) {
      const value = frame.data[source++];
      sum += value;
      squared += value * value;
      region.sums[row + x] = region.sums[previous + x] + sum;
      region.squares[row + x] = region.squares[previous + x] + squared;
    }
  }
  Object.assign(region, {
    data: frame.data,
    capture: frame.capture,
    frameWidth: frame.width,
    frameHeight: frame.height,
    minX,
    minY,
    maxX,
    maxY,
    stride,
    usedAt: ++scratch.clock,
  });
  return region;
}
/**
 * Scores every candidate in both squares and retains the original row-major
 * tie order. Integral moments are exact integer sums for the bounded UInt8
 * image; dot-product additions and final NCC arithmetic retain their order.
 * Two region slots share current-frame moments across interleaved forward and
 * reverse searches. A finite capture epoch is required for cache reuse.
 */
export function searchNcc(
  frame: NccFrame,
  template: NccTemplate,
  around: NccPoint,
  radius: number,
  scores: Float64Array,
  previous?: NccPoint,
  scratch: NccScratch = createNccScratch(),
): NccMatch | null {
  if (
    !Number.isInteger(frame.width) ||
    !Number.isInteger(frame.height) ||
    frame.width < 1 ||
    frame.height < 1 ||
    frame.width > 640 ||
    frame.height > 640 ||
    frame.data.length !== frame.width * frame.height ||
    !Number.isInteger(radius) ||
    radius < 0 ||
    radius > 24 ||
    !Number.isInteger(template.radius) ||
    template.radius < 0 ||
    template.radius > 7 ||
    template.values.length !== (2 * template.radius + 1) ** 2 ||
    ![around.x, around.y, previous?.x ?? around.x, previous?.y ?? around.y].every(Number.isFinite)
  )
    throw new Error("NCC_SEARCH_INPUT_INVALID");
  const cx = Math.round(around.x),
    cy = Math.round(around.y),
    px = Math.round(previous?.x ?? around.x),
    py = Math.round(previous?.y ?? around.y),
    minX = Math.min(cx, px) - radius,
    maxX = Math.max(cx, px) + radius,
    minY = Math.min(cy, py) - radius,
    maxY = Math.max(cy, py) + radius,
    width = maxX - minX + 1,
    height = maxY - minY + 1;
  if (width * height > scores.length) throw new Error("NCC_SCORE_CAPACITY_EXCEEDED");
  if (Math.abs(cx - px) > 16 || Math.abs(cy - py) > 16) throw new Error("NCC_SEARCH_WINDOW_UNBOUNDED");
  const r = template.radius,
    diameter = 2 * r + 1,
    size = template.values.length,
    templateVariance = template.deviation ** 2,
    minimumVariance = size * scratch.minimumTexture ** 2,
    region = moments(frame, minX - r, minY - r, maxX + r, maxY + r, scratch);
  let best = -1,
    point: NccPoint | null = null,
    slot = 0;
  for (let y = minY; y <= maxY; ++y)
    for (let x = minX; x <= maxX; ++x) {
      let score = -1;
      const inside =
        (Math.abs(x - cx) <= radius && Math.abs(y - cy) <= radius) ||
        (Math.abs(x - px) <= radius && Math.abs(y - py) <= radius);
      if (inside && region && x - r >= 1 && y - r >= 1 && x + r < frame.width - 1 && y + r < frame.height - 1) {
        const left = x - r - region.minX,
          top = y - r - region.minY,
          right = left + diameter,
          bottom = top + diameter,
          a = top * region.stride + left,
          b = top * region.stride + right,
          c = bottom * region.stride + left,
          d = bottom * region.stride + right,
          sum = region.sums[d] - region.sums[b] - region.sums[c] + region.sums[a],
          squared = region.squares[d] - region.squares[b] - region.squares[c] + region.squares[a],
          variance = squared - (sum * sum) / size;
        // This is the same texture rejection as the scalar correlation, before
        // its costly dot product. It cannot hide a previously eligible rival.
        if (variance >= minimumVariance) {
          let product = 0,
            i = 0;
          for (let dy = -r; dy <= r; ++dy) {
            let source = (y + dy) * frame.width + x - r;
            for (let dx = 0; dx < diameter; ++dx) product += frame.data[source++] * template.values[i++];
          }
          score = (product - sum * template.mean) / Math.sqrt(variance * size * templateVariance);
        }
      }
      scores[slot++] = score;
      if (score > best) {
        best = score;
        point = { x, y };
      }
    }
  if (!point) return null;
  let second = -1;
  const exclusionSquared = scratch.peakExclusionRadius ** 2;
  for (let i = 0; i < width * height; ++i) {
    const dx = minX + (i % width) - point.x,
      dy = minY + Math.floor(i / width) - point.y;
    if (dx * dx + dy * dy > exclusionSquared) second = Math.max(second, scores[i]);
  }
  return { point, correlation: best, separation: best - second };
}
