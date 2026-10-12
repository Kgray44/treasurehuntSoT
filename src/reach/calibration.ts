import type { Point } from "./coordinates";
import { usableHand, type HandObservation } from "./observation";
import { pointingFeatures } from "./coordinates";
export const calibrationLayout = {
  version: 1,
  training: [0.1, 0.5, 0.9].flatMap((y) => [0.1, 0.5, 0.9].map((x) => ({ x, y }))),
  validation: [
    { x: 0.25, y: 0.25 },
    { x: 0.75, y: 0.25 },
    { x: 0.25, y: 0.75 },
    { x: 0.75, y: 0.75 },
    { x: 0.5, y: 0.3 },
  ],
};
export const relativeLayout = {
  version: 1,
  training: [
    { x: 0.5, y: 0.5 },
    { x: 0.1, y: 0.5 },
    { x: 0.9, y: 0.5 },
    { x: 0.5, y: 0.1 },
    { x: 0.5, y: 0.9 },
  ],
  instructions: [
    "Rest your hand comfortably in the center.",
    "Move your hand comfortably to your left.",
    "Move your hand comfortably to your right.",
    "Move your hand comfortably upward.",
    "Move your hand comfortably downward.",
  ],
};
export type CalibrationBinding = {
  providerId: string;
  modelDigest: string;
  providerGeneration: number;
  cameraLeaseId: string;
  cameraFrameVersion: number;
  viewportEpoch: number;
  viewportWidth: number;
  viewportHeight: number;
  mirror: boolean;
  orientation: number;
  trackId: string;
  trackGeneration: number;
  evidenceTier: HandObservation["evidenceTier"];
};
export type CalibrationSample = { target: Point; features: number[]; at: number };
export type Calibration = {
  version: 1;
  id: string;
  mapping: "INDEX_AXIS_RIDGE_V1" | "RELATIVE_DISPLACEMENT_V1";
  binding: CalibrationBinding;
  createdAt: number;
  expiresAt: number;
  coefficients: number[][];
  featureBounds: { min: number; max: number }[];
  trainingResiduals: number[];
  trainingJitterP95?: number;
  validationJitterP95?: number;
  validationErrors: number[];
  validationEdgeErrors: number[];
  validationP95: number | null;
  status: "VALIDATION_REQUIRED" | "FAILED" | "VALIDATED";
  uncertaintyRadius: number | null;
  supportedRegion: { min: number; max: number };
};
export function percentile(values: number[], fraction: number) {
  if (!values.length) return null;
  return [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.ceil(fraction * values.length) - 1)];
}
function solve(matrix: number[][], b: number[]) {
  const rows = matrix.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < b.length; col++) {
    let pivot = col;
    for (let i = col + 1; i < b.length; i++) if (Math.abs(rows[i][col]) > Math.abs(rows[pivot][col])) pivot = i;
    [rows[col], rows[pivot]] = [rows[pivot], rows[col]];
    if (Math.abs(rows[col][col]) < 1e-10) throw new Error("CALIBRATION_DEGENERATE");
    const divisor = rows[col][col];
    rows[col] = rows[col].map((v) => v / divisor);
    for (let i = 0; i < b.length; i++)
      if (i !== col) {
        const factor = rows[i][col];
        rows[i] = rows[i].map((v, j) => v - factor * rows[col][j]);
      }
  }
  return rows.map((row) => row[b.length]);
}
function predict(c: Calibration, features: number[]): Point {
  return {
    x: c.coefficients[0].reduce((s, v, i) => s + v * features[i], 0),
    y: c.coefficients[1].reduce((s, v, i) => s + v * features[i], 0),
  };
}
function diagonalError(c: Calibration, p: Point, target: Point) {
  return (
    Math.hypot((p.x - target.x) * c.binding.viewportWidth, (p.y - target.y) * c.binding.viewportHeight) /
    Math.hypot(c.binding.viewportWidth, c.binding.viewportHeight)
  );
}
function validSample(sample: CalibrationSample) {
  return (
    sample.features.length === 5 &&
    [...sample.features, sample.target.x, sample.target.y, sample.at].every(Number.isFinite) &&
    sample.features[0] === 1
  );
}
export function stableSamples(samples: CalibrationSample[]) {
  if (
    samples.length < 15 ||
    samples.some((s) => !validSample(s)) ||
    samples.at(-1)!.at - samples[0].at < 600 ||
    samples.some((s, i) => i > 0 && (s.at <= samples[i - 1].at || s.at - samples[i - 1].at > 300))
  )
    return false;
  return samples[0].features.every(
    (_, j) =>
      Math.max(...samples.map((s) => s.features[j])) - Math.min(...samples.map((s) => s.features[j])) <=
      (j < 3 ? 0.02 : 0.08),
  );
}
export function stableMovementSamples(samples: CalibrationSample[]) {
  return (
    stableSamples(samples.map((s) => ({ ...s, features: [s.features[0], s.features[1], s.features[2], 0, 0] }))) &&
    samples.every(validSample)
  );
}
export function fitCalibration(groups: CalibrationSample[][], binding: CalibrationBinding, now: number): Calibration {
  if (
    !Number.isFinite(now) ||
    !Number.isFinite(binding.viewportWidth) ||
    !Number.isFinite(binding.viewportHeight) ||
    binding.viewportWidth <= 0 ||
    binding.viewportHeight <= 0 ||
    groups.length !== 9 ||
    groups.some(
      (g, i) =>
        !stableSamples(g) ||
        g.some((s) => s.target.x !== calibrationLayout.training[i].x || s.target.y !== calibrationLayout.training[i].y),
    )
  )
    throw new Error("CALIBRATION_TRAINING_INCOMPLETE");
  const samples = groups.flat();
  if (
    [1, 2].some(
      (i) => Math.max(...samples.map((s) => s.features[i])) - Math.min(...samples.map((s) => s.features[i])) < 0.05,
    )
  )
    throw new Error("CALIBRATION_INSUFFICIENT_COVERAGE");
  const matrix = Array.from({ length: 5 }, (_, i) =>
    Array.from(
      { length: 5 },
      (_, j) => samples.reduce((sum, s) => sum + s.features[i] * s.features[j], 0) + (i === j && i > 0 ? 0.001 : 0),
    ),
  );
  const coefficients = ["x", "y"].map((axis) =>
    solve(
      matrix,
      Array.from({ length: 5 }, (_, i) =>
        samples.reduce((sum, s) => sum + s.features[i] * s.target[axis as "x" | "y"], 0),
      ),
    ),
  );
  const c: Calibration = {
    version: 1,
    id: crypto.randomUUID(),
    mapping: "INDEX_AXIS_RIDGE_V1",
    binding: structuredClone(binding),
    createdAt: now,
    expiresAt: now + 30 * 60 * 1000,
    coefficients,
    featureBounds: Array.from({ length: 5 }, (_, i) => ({
      min: Math.min(...samples.map((s) => s.features[i])),
      max: Math.max(...samples.map((s) => s.features[i])),
    })),
    trainingResiduals: [],
    validationErrors: [],
    validationEdgeErrors: [],
    validationP95: null,
    status: "VALIDATION_REQUIRED",
    uncertaintyRadius: null,
    supportedRegion: { min: 0.1, max: 0.9 },
  };
  c.trainingResiduals = samples.map((s) => {
    const p = predict(c, s.features);
    return diagonalError(c, p, s.target);
  });
  c.trainingJitterP95 = sampleJitter(c, groups);
  return c;
}
function sampleJitter(c: Calibration, groups: CalibrationSample[][]) {
  return percentile(
    groups.flatMap((group) => {
      const points = group.map((s) => predict(c, s.features));
      const center = {
        x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
        y: points.reduce((sum, p) => sum + p.y, 0) / points.length,
      };
      return points.map((p) => diagonalError(c, p, center));
    }),
    0.95,
  )!;
}
/** Movement from a comfortable reference controls a cursor. This is never a display ray or absolute pointing proof. */
export function fitRelativeCalibration(
  groups: CalibrationSample[][],
  binding: CalibrationBinding,
  now: number,
): Calibration {
  if (
    !Number.isFinite(now) ||
    !Number.isFinite(binding.viewportWidth) ||
    !Number.isFinite(binding.viewportHeight) ||
    binding.viewportWidth <= 0 ||
    binding.viewportHeight <= 0 ||
    groups.length !== 5 ||
    groups.some(
      (g, i) =>
        !stableMovementSamples(g) ||
        g.some((s) => s.target.x !== relativeLayout.training[i].x || s.target.y !== relativeLayout.training[i].y),
    )
  )
    throw new Error("RELATIVE_SETUP_INCOMPLETE");
  const mean = (group: CalibrationSample[], i: number) =>
    group.reduce((sum, s) => sum + s.features[i], 0) / group.length;
  const centerX = mean(groups[0], 1),
    centerY = mean(groups[0], 2);
  const horizontalSpan = mean(groups[2], 1) - mean(groups[1], 1);
  const verticalSpan = mean(groups[4], 2) - mean(groups[3], 2);
  if (
    Math.abs(horizontalSpan) < 0.08 ||
    verticalSpan < 0.08 ||
    (centerX - mean(groups[1], 1)) / horizontalSpan < 0.15 ||
    (mean(groups[2], 1) - centerX) / horizontalSpan < 0.15 ||
    centerY - mean(groups[3], 2) < 0.015 ||
    mean(groups[4], 2) - centerY < 0.015
  )
    throw new Error("RELATIVE_MOVEMENT_TOO_SMALL");
  const gainX = (relativeLayout.training[2].x - relativeLayout.training[1].x) / horizontalSpan,
    gainY = (relativeLayout.training[4].y - relativeLayout.training[3].y) / verticalSpan;
  const samples = groups.flat();
  const c: Calibration = {
    version: 1,
    id: crypto.randomUUID(),
    mapping: "RELATIVE_DISPLACEMENT_V1",
    binding: structuredClone(binding),
    createdAt: now,
    expiresAt: now + 30 * 60 * 1000,
    coefficients: [
      [0.5 - centerX * gainX, gainX, 0, 0, 0],
      [0.5 - centerY * gainY, 0, gainY, 0, 0],
    ],
    featureBounds: Array.from({ length: 5 }, (_, i) => ({
      min: Math.min(...samples.map((s) => s.features[i])),
      max: Math.max(...samples.map((s) => s.features[i])),
    })),
    trainingResiduals: [],
    validationErrors: [],
    validationEdgeErrors: [],
    validationP95: null,
    status: "VALIDATION_REQUIRED",
    uncertaintyRadius: null,
    supportedRegion: { min: 0.1, max: 0.9 },
  };
  c.trainingResiduals = samples.map((s) => diagonalError(c, predict(c, s.features), s.target));
  c.trainingJitterP95 = sampleJitter(c, groups);
  return c;
}
export function validateCalibration(c: Calibration, groups: CalibrationSample[][]): Calibration {
  if (
    groups.length !== 5 ||
    groups.some((g) => !(c.mapping === "RELATIVE_DISPLACEMENT_V1" ? stableMovementSamples(g) : stableSamples(g)))
  )
    throw new Error("CALIBRATION_VALIDATION_INCOMPLETE");
  const seen = new Set<string>();
  for (const g of groups) {
    const t = g[0].target;
    const id = `${t.x}:${t.y}`;
    if (
      seen.has(id) ||
      !calibrationLayout.validation.some((p) => p.x === t.x && p.y === t.y) ||
      g.some((s) => s.target.x !== t.x || s.target.y !== t.y)
    )
      throw new Error("CALIBRATION_VALIDATION_LEAKAGE");
    seen.add(id);
  }
  const errors = groups.flatMap((g) =>
    g.map((s) => {
      const p = predict(c, s.features);
      return diagonalError(c, p, s.target);
    }),
  );
  const edgeErrors = groups
    .filter((g) => g[0].target.x !== 0.5)
    .flatMap((g) =>
      g.map((s) => {
        const p = predict(c, s.features);
        return diagonalError(c, p, s.target);
      }),
    );
  const p95 = percentile(errors, 0.95)!;
  return {
    ...c,
    validationErrors: errors,
    validationEdgeErrors: edgeErrors,
    validationP95: p95,
    validationJitterP95: sampleJitter(c, groups),
    status: p95 <= 0.03 ? "VALIDATED" : "FAILED",
    // Empirical held-out radius in CSS pixels; this is not a model confidence interval.
    uncertaintyRadius: p95 * Math.hypot(c.binding.viewportWidth, c.binding.viewportHeight),
  };
}
export function calibratedPoint(
  c: Calibration,
  features: number[],
  binding: CalibrationBinding,
  now: number,
): Point | null {
  if (
    !Number.isFinite(now) ||
    now < c.createdAt ||
    c.status !== "VALIDATED" ||
    now >= c.expiresAt ||
    Object.entries(c.binding).some(([k, v]) => binding[k as keyof CalibrationBinding] !== v) ||
    features.length !== 5 ||
    features.some(
      (v, i) =>
        !Number.isFinite(v) ||
        ((c.mapping !== "RELATIVE_DISPLACEMENT_V1" || i < 3) &&
          (v < c.featureBounds[i].min - 0.02 || v > c.featureBounds[i].max + 0.02)),
    )
  )
    return null;
  const p = predict(c, features);
  return p.x >= c.supportedRegion.min &&
    p.x <= c.supportedRegion.max &&
    p.y >= c.supportedRegion.min &&
    p.y <= c.supportedRegion.max
    ? p
    : null;
}
/** Absolute estimates stay local to the calibrated laboratory plane. No action or target semantics. */
export function estimatedPoint(c: Calibration, observation: HandObservation, binding: CalibrationBinding, now: number) {
  const hand = usableHand(observation, binding.trackId);
  const ageMs = now - observation.monotonicCaptureTime;
  if (
    !hand ||
    ageMs < 0 ||
    ageMs > 150 ||
    observation.providerId !== binding.providerId ||
    observation.modelDigest !== binding.modelDigest ||
    observation.providerGeneration !== binding.providerGeneration ||
    observation.cameraLeaseId !== binding.cameraLeaseId ||
    observation.cameraFrameVersion !== binding.cameraFrameVersion ||
    observation.orientation !== binding.orientation ||
    (observation.mirrorTransform === "PREVIEW_X") !== binding.mirror ||
    hand.trackId !== binding.trackId ||
    hand.trackGeneration !== binding.trackGeneration ||
    observation.evidenceTier !== binding.evidenceTier
  )
    return null;
  const point = calibratedPoint(c, pointingFeatures(hand), binding, now);
  return point
    ? {
        ...point,
        coordinateFrame: "CALIBRATED_PLANE_NORMALIZED" as const,
        mode: c.mapping === "RELATIVE_DISPLACEMENT_V1" ? ("RELATIVE_CONTROL" as const) : ("ABSOLUTE_ESTIMATE" as const),
        observationId: observation.observationId,
        calibrationId: c.id,
        viewportEpoch: binding.viewportEpoch,
        providerGeneration: binding.providerGeneration,
        cameraFrameVersion: binding.cameraFrameVersion,
        monotonicCaptureTime: observation.monotonicCaptureTime,
        sampleAgeMs: ageMs,
        empiricalUncertaintyRadiusCssPx: c.uncertaintyRadius,
        confidence: "EMPIRICAL_HELD_OUT_ONLY" as const,
        evidenceTier: observation.evidenceTier,
        actionable: false as const,
      }
    : null;
}
