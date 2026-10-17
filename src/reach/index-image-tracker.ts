import type { Point } from "./coordinates";

/** Canonical descriptor identity, not model weights or an accuracy certificate. */
export const indexImageAlgorithmDescriptor = {
  algorithm: "BOUNDED_PHOTOMETRIC_NCC_V1",
  policy: {
    radius: 7,
    minimumRadius: 4,
    search: 24,
    peakExclusionRadius: 3,
    minimumCorrelation: 0.75,
    minimumSeparation: 0.035,
    minimumTexture: 6,
    minimumStructure: 0.008,
    reverseSearch: 4,
    maximumForwardBackward: 2,
    maximumRecoveryMs: 1200,
    maximumCaptureAgeMs: 150,
    modelAgreementRadius: 8,
    predictionLimit: 16,
    maximumMotionStep: 32,
    maximumVelocity: 240,
    minimumGridDimension: 20,
    maximumGridDimension: 640,
    maximumAnalysisDimension: 320,
  },
  searchDomain: "PREVIOUS_AND_PREDICTED_SQUARE_UNION",
  templateUpdate: "LAST_ACCEPTED_IMAGE_PATCH",
  modelContrary: "LATCH_UNTIL_COHERENT_POINT_OR_NEW_HINT",
  manualAnchor: "NEW_GENERATION",
  grayscale: [77, 150, 29, 8],
} as const;
export const indexImageAlgorithm = {
  providerId: "watchglass.index-image",
  providerVersion: "1",
  algorithm: "BOUNDED_PHOTOMETRIC_NCC_V1",
  algorithmDigest: "b5584b7fb99b6f2f7977d82081e4530c7a7bef836d3c1d24e2629438d9e546de",
} as const;
export type IndexImageBinding = {
  providerGeneration: number;
  cameraLeaseId: string;
  cameraFrameVersion: number;
  frameWidth: number;
  frameHeight: number;
  mirrorTransform: "NONE" | "PREVIEW_X";
};
export type IndexImageObservation = IndexImageBinding & {
  observationVersion: 1;
  providerId: typeof indexImageAlgorithm.providerId;
  providerVersion: typeof indexImageAlgorithm.providerVersion;
  algorithmDigest: string;
  orientation: 0;
  sequence: number;
  monotonicCaptureTime: number;
  monotonicInferenceTime: number;
  trackId: string | null;
  trackGeneration: number;
  point: Point | null;
  state: "UNSEEDED" | "TRACKING" | "UNCERTAIN" | "LOST";
  modelAgreement: "AGREE" | "DISAGREE" | "UNAVAILABLE";
  anchorSource: "MODEL_INDEX" | "MANUAL_HINT" | null;
  quality: {
    correlation: number | null;
    separation: number | null;
    texture: number | null;
    forwardBackwardErrorPixels: number | null;
  };
  uncertaintyRadiusPixels: number | null;
  reason: string;
};
/** Pixels remain in process memory and are never included in observations. */
export type IndexGrayFrame = {
  data: Uint8Array;
  width: number;
  height: number;
  capture: number;
  received: number;
};
export type IndexModelAnchor = {
  point: Point;
  pointing: boolean;
  contrary: boolean;
};
type Patch = { values: Float32Array; mean: number; deviation: number; structure: number; radius: number };
type Match = { point: Point; correlation: number; separation: number };
const policy = indexImageAlgorithmDescriptor.policy;
let nextAnchor = 0;
const boundedPoint = (p: Point) =>
  Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1;
function patch(frame: IndexGrayFrame, center: Point, radius: number): Patch | null {
  const x = Math.round(center.x),
    y = Math.round(center.y);
  if (x - radius < 1 || y - radius < 1 || x + radius >= frame.width - 1 || y + radius >= frame.height - 1) return null;
  const size = (2 * radius + 1) ** 2,
    values = new Float32Array(size);
  let sum = 0,
    squared = 0,
    xx = 0,
    yy = 0,
    xy = 0,
    i = 0;
  for (let dy = -radius; dy <= radius; ++dy)
    for (let dx = -radius; dx <= radius; ++dx) {
      const index = (y + dy) * frame.width + x + dx,
        value = frame.data[index];
      values[i++] = value;
      sum += value;
      squared += value * value;
      const gx = (frame.data[index + 1] - frame.data[index - 1]) / 2;
      const gy = (frame.data[index + frame.width] - frame.data[index - frame.width]) / 2;
      xx += gx * gx;
      yy += gy * gy;
      xy += gx * gy;
    }
  const mean = sum / size,
    deviation = Math.sqrt(Math.max(0, squared / size - mean * mean));
  const total = xx + yy;
  const smallEigen = (total - Math.sqrt((xx - yy) ** 2 + 4 * xy * xy)) / 2;
  return { values, mean, deviation, structure: smallEigen / Math.max(1e-9, total), radius };
}
function correlation(frame: IndexGrayFrame, x: number, y: number, template: Patch) {
  const r = template.radius;
  if (x - r < 1 || y - r < 1 || x + r >= frame.width - 1 || y + r >= frame.height - 1) return -1;
  let sum = 0,
    squared = 0,
    product = 0,
    i = 0;
  for (let dy = -r; dy <= r; ++dy)
    for (let dx = -r; dx <= r; ++dx) {
      const value = frame.data[(y + dy) * frame.width + x + dx];
      sum += value;
      squared += value * value;
      product += value * template.values[i++];
    }
  const size = template.values.length,
    variance = squared - (sum * sum) / size;
  if (variance < size * policy.minimumTexture ** 2) return -1;
  return (product - sum * template.mean) / Math.sqrt(variance * size * template.deviation ** 2);
}
function search(
  frame: IndexGrayFrame,
  template: Patch,
  around: Point,
  radius: number,
  scores: Float64Array,
  previous?: Point,
): Match | null {
  let best = -1,
    point: Point | null = null;
  const cx = Math.round(around.x),
    cy = Math.round(around.y),
    px = Math.round(previous?.x ?? around.x),
    py = Math.round(previous?.y ?? around.y);
  const minX = Math.min(cx, px) - radius,
    maxX = Math.max(cx, px) + radius,
    minY = Math.min(cy, py) - radius,
    maxY = Math.max(cy, py) + radius,
    width = maxX - minX + 1,
    height = maxY - minY + 1;
  let slot = 0;
  // Reversal can contradict velocity prediction. Search both bounded squares,
  // and compare every peak across their union before accepting either one.
  for (let y = minY; y <= maxY; ++y)
    for (let x = minX; x <= maxX; ++x) {
      const inside =
        (Math.abs(x - cx) <= radius && Math.abs(y - cy) <= radius) ||
        (Math.abs(x - px) <= radius && Math.abs(y - py) <= radius);
      const score = inside ? correlation(frame, x, y, template) : -1;
      scores[slot++] = score;
      if (score > best) {
        best = score;
        point = { x, y };
      }
    }
  if (!point) return null;
  let second = -1;
  for (let i = 0; i < width * height; ++i) {
    const x = minX + (i % width),
      y = minY + Math.floor(i / width);
    if (Math.hypot(x - point.x, y - point.y) > policy.peakExclusionRadius) second = Math.max(second, scores[i]);
  }
  return { point, correlation: best, separation: best - second };
}
/**
 * A local appearance tracker for one explicitly anchored fingertip. It cannot
 * recognize a finger from an arbitrary image, infer hidden joints, or certify
 * pointing intent. Ambiguous appearance produces no actionable point.
 */
export class IndexImageTracker {
  private sequence = 0;
  private lastCapture = -Infinity;
  private acceptedAt = -Infinity;
  private previous: IndexGrayFrame | null = null;
  private template: Patch | null = null;
  private point: Point | null = null;
  private velocity: Point = { x: 0, y: 0 };
  private trackId: string | null = null;
  private trackGeneration = 0;
  private anchorSource: IndexImageObservation["anchorSource"] = null;
  private vetoed = false;
  private failures = 0;
  private grid: { width: number; height: number } | null = null;
  private readonly searchScores = new Float64Array((policy.search * 2 + 1 + policy.predictionLimit) ** 2);
  private readonly reverseScores = new Float64Array((policy.reverseSearch * 2 + 1) ** 2);
  constructor(readonly binding: IndexImageBinding) {}
  reset() {
    this.previous = null;
    this.template = null;
    this.point = null;
    this.velocity = { x: 0, y: 0 };
    this.acceptedAt = -Infinity;
    this.trackId = null;
    this.trackGeneration = 0;
    this.anchorSource = null;
    this.vetoed = false;
    this.failures = 0;
    this.grid = null;
    // A reset cannot make an old camera frame new.
  }
  update(frame: IndexGrayFrame, model?: IndexModelAnchor | null, manualHint?: Point | null): IndexImageObservation {
    if (
      !Number.isInteger(frame.width) ||
      !Number.isInteger(frame.height) ||
      frame.width < policy.minimumGridDimension ||
      frame.height < policy.minimumGridDimension ||
      frame.width > policy.maximumGridDimension ||
      frame.height > policy.maximumGridDimension ||
      frame.data.length !== frame.width * frame.height ||
      ![frame.capture, frame.received].every(Number.isFinite) ||
      frame.capture <= this.lastCapture ||
      frame.received < frame.capture ||
      frame.received - frame.capture > policy.maximumCaptureAgeMs
    )
      throw new Error("INDEX_IMAGE_FRAME_INVALID_OR_STALE");
    this.lastCapture = frame.capture;
    const expired = this.anchorSource !== null && frame.capture - this.acceptedAt > policy.maximumRecoveryMs;
    if (expired) this.reset();
    const scale = this.binding.frameWidth / frame.width;
    const quality: IndexImageObservation["quality"] = {
      correlation: null,
      separation: null,
      texture: null,
      forwardBackwardErrorPixels: null,
    };
    let modelAgreement: IndexImageObservation["modelAgreement"] = "UNAVAILABLE";
    const result = (
      state: IndexImageObservation["state"],
      reason: string,
      uncertainty: number | null = null,
    ): IndexImageObservation => ({
      observationVersion: 1,
      ...this.binding,
      providerId: indexImageAlgorithm.providerId,
      providerVersion: indexImageAlgorithm.providerVersion,
      algorithmDigest: indexImageAlgorithm.algorithmDigest,
      orientation: 0,
      sequence: this.sequence++,
      monotonicCaptureTime: frame.capture,
      monotonicInferenceTime: frame.received,
      trackId: this.trackId,
      trackGeneration: this.trackGeneration,
      point:
        state === "TRACKING" && this.point
          ? { x: this.point.x / (frame.width - 1), y: this.point.y / (frame.height - 1) }
          : null,
      state,
      modelAgreement,
      anchorSource: this.anchorSource,
      quality: { ...quality },
      uncertaintyRadiusPixels: uncertainty,
      reason,
    });
    if (this.grid && (this.grid.width !== frame.width || this.grid.height !== frame.height)) {
      this.previous = null;
      this.template = null;
      this.point = null;
      return result("LOST", "FRAME_GRID_CHANGED");
    }
    this.grid ??= { width: frame.width, height: frame.height };
    if (model && !boundedPoint(model.point)) model = null;
    const modelPoint = model ? { x: model.point.x * (frame.width - 1), y: model.point.y * (frame.height - 1) } : null;
    if (manualHint) {
      this.reset();
      this.grid = { width: frame.width, height: frame.height };
    }
    const anchor = manualHint ?? (!this.anchorSource && model?.pointing ? model.point : null);
    if (anchor) {
      if (!boundedPoint(anchor)) return result("UNSEEDED", "HINT_OUTSIDE_IMAGE");
      const center = { x: anchor.x * (frame.width - 1), y: anchor.y * (frame.height - 1) };
      const radius = Math.min(
        policy.radius,
        Math.floor(Math.min(center.x - 1, center.y - 1, frame.width - 2 - center.x, frame.height - 2 - center.y)),
      );
      const initial = radius >= policy.minimumRadius ? patch(frame, center, radius) : null;
      quality.texture = initial?.deviation ?? null;
      if (!initial || initial.deviation < policy.minimumTexture || initial.structure < policy.minimumStructure)
        return result(this.anchorSource ? "UNCERTAIN" : "UNSEEDED", "ANCHOR_TEXTURE_OR_EDGE_UNSUITABLE");
      // A seed must also be locally distinguishable, not one repeated tile.
      const distinct = search(frame, initial, center, policy.search, this.searchScores);
      quality.correlation = distinct?.correlation ?? null;
      quality.separation = distinct?.separation ?? null;
      if (!distinct || distinct.separation < policy.minimumSeparation)
        return result(this.anchorSource ? "UNCERTAIN" : "UNSEEDED", "ANCHOR_APPEARANCE_AMBIGUOUS");
      this.point = center;
      this.template = initial;
      this.previous = { ...frame, data: frame.data.slice() };
      this.acceptedAt = frame.capture;
      this.velocity = { x: 0, y: 0 };
      this.failures = 0;
      this.trackGeneration = ++nextAnchor;
      this.trackId = `index-image-${this.trackGeneration}`;
      this.anchorSource = manualHint ? "MANUAL_HINT" : "MODEL_INDEX";
      this.vetoed = false;
      modelAgreement =
        modelPoint && Math.hypot(center.x - modelPoint.x, center.y - modelPoint.y) <= policy.modelAgreementRadius
          ? "AGREE"
          : modelPoint
            ? "DISAGREE"
            : "UNAVAILABLE";
      if (modelAgreement === "AGREE" && model?.contrary) this.vetoed = true;
      return result(
        this.vetoed ? "UNCERTAIN" : "TRACKING",
        this.vetoed ? "COHERENT_MODEL_CONTRARY" : "ANCHOR_ACQUIRED",
        2 * scale,
      );
    }
    if (!this.point || !this.template || !this.previous)
      return result(
        this.anchorSource || expired ? "LOST" : "UNSEEDED",
        expired ? "IMAGE_CONTINUITY_EXPIRED" : this.anchorSource ? "REANCHOR_REQUIRED" : "SHOW_INDEX_OR_SELECT_TIP",
      );
    const gap = frame.capture - this.acceptedAt;
    const prediction = { x: (this.velocity.x * gap) / 1000, y: (this.velocity.y * gap) / 1000 };
    const predictedDistance = Math.hypot(prediction.x, prediction.y);
    const predictionCap = predictedDistance > policy.predictionLimit ? policy.predictionLimit / predictedDistance : 1;
    const predicted = {
      x: this.point.x + prediction.x * predictionCap,
      y: this.point.y + prediction.y * predictionCap,
    };
    const found = search(frame, this.template, predicted, policy.search, this.searchScores, this.point);
    quality.correlation = found?.correlation ?? null;
    quality.separation = found?.separation ?? null;
    const reject = (reason: string) => {
      ++this.failures;
      return result(this.failures >= 2 ? "LOST" : "UNCERTAIN", reason);
    };
    if (!found || found.correlation < policy.minimumCorrelation) return reject("APPEARANCE_MISMATCH");
    if (found.separation < policy.minimumSeparation) return reject("APPEARANCE_AMBIGUOUS");
    if (Math.hypot(found.point.x - this.point.x, found.point.y - this.point.y) > policy.maximumMotionStep)
      return reject("IMAGE_MOTION_TOO_LARGE");
    const current = patch(frame, found.point, this.template.radius);
    quality.texture = current?.deviation ?? null;
    if (!current || current.deviation < policy.minimumTexture || current.structure < policy.minimumStructure)
      return reject("IMAGE_TEXTURE_UNSUITABLE");
    const reverse = search(this.previous, current, this.point, policy.reverseSearch, this.reverseScores);
    const backward = reverse ? Math.hypot(reverse.point.x - this.point.x, reverse.point.y - this.point.y) : Infinity;
    quality.forwardBackwardErrorPixels = Number.isFinite(backward) ? backward * scale : null;
    if (!reverse || reverse.correlation < policy.minimumCorrelation || backward > policy.maximumForwardBackward)
      return reject("FORWARD_BACKWARD_DISAGREEMENT");
    modelAgreement = modelPoint
      ? Math.hypot(found.point.x - modelPoint.x, found.point.y - modelPoint.y) <= policy.modelAgreementRadius
        ? "AGREE"
        : "DISAGREE"
      : "UNAVAILABLE";
    if (modelAgreement === "AGREE") {
      if (model?.contrary) this.vetoed = true;
      else if (model?.pointing) this.vetoed = false;
    }
    // Appearance supplies the point. A disagreeing model never moves it or
    // replaces the patch; a later explicit seed creates a different binding.
    const dt = gap / 1000;
    const vx = (found.point.x - this.point.x) / dt,
      vy = (found.point.y - this.point.y) / dt;
    const speed = Math.hypot(vx, vy),
      cap = speed > policy.maximumVelocity ? policy.maximumVelocity / speed : 1;
    this.velocity = { x: vx * cap, y: vy * cap };
    this.point = found.point;
    this.template = current;
    this.previous = { ...frame, data: frame.data.slice() };
    this.acceptedAt = frame.capture;
    this.failures = 0;
    const uncertainty =
      Math.max(1.5, (1 - found.correlation) * 10 + backward * 1.5 + (found.separation < 0.08 ? 2 : 0)) * scale;
    return result(
      this.vetoed ? "UNCERTAIN" : "TRACKING",
      this.vetoed
        ? "COHERENT_MODEL_CONTRARY"
        : modelAgreement === "DISAGREE"
          ? "MODEL_DISAGREES_IMAGE_RETAINED"
          : "IMAGE_MATCH",
      uncertainty,
    );
  }
}
