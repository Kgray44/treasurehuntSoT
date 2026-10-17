import type { HandObservation } from "./hand-observation";
import { cosine, subtract, vectorLength, type GeometryFrame } from "./hand-geometry";

type Hand = HandObservation["hands"][number];
export const indexLandmarks = [5, 6, 7, 8] as const;

/**
 * Geometry of the observed index chain only. Image z remains monocular inferred
 * depth. No wrist, palm span, hidden joint, or other finger supplies this basis.
 */
export function indexGeometry(hand: Hand, frame?: GeometryFrame) {
  const aspect = frame ? frame.frameHeight / frame.frameWidth : 1;
  if (!Number.isFinite(aspect) || aspect <= 0) throw new Error("HAND_GEOMETRY_FRAME_INVALID");
  const complete = indexLandmarks.every((index) => {
    const point = hand.landmarks[index];
    return (
      point?.valid &&
      [point.x, point.y, point.z].every(Number.isFinite) &&
      point.x >= 0 &&
      point.x <= 1 &&
      point.y >= 0 &&
      point.y <= 1
    );
  });
  const points = indexLandmarks.map((index) => {
    const point = hand.landmarks[index];
    return complete ? { x: point.x, y: point.y * aspect, z: point.z } : { x: 0, y: 0, z: 0 };
  });
  const [a, b, c, d] = points;
  const vectors = [subtract(b, a), subtract(c, b), subtract(d, c)];
  const lengths = vectors.map(vectorLength);
  const chain = lengths.reduce((sum, length) => sum + length, 0);
  const axis = subtract(d, a);
  const reach = vectorLength(axis);
  const ratios =
    lengths[1] >= lengths[0] * 0.22 &&
    lengths[1] <= lengths[0] * 1.4 &&
    lengths[2] >= lengths[0] * 0.18 &&
    lengths[2] <= lengths[0] * 1.2;
  const indexTracked = complete && lengths.every((length) => length > 1e-5) && ratios;
  const anatomical = indexTracked && chain >= 0.012 && chain <= 1.2 && lengths.every((length) => length >= 0.001);
  const straightness = reach / Math.max(1e-9, chain);
  const pipAlignment = cosine(vectors[0], vectors[1]);
  const dipAlignment = cosine(vectors[1], vectors[2]);
  return {
    aspect,
    complete,
    indexTracked,
    indexFramed: complete,
    geometry: anatomical,
    anatomical,
    extended: anatomical && straightness >= 0.78 && pipAlignment >= 0.2 && dipAlignment >= 0,
    marginal: anatomical && straightness >= 0.7 && pipAlignment >= -0.1 && dipAlignment >= -0.1,
    axis,
    reach,
    chain,
    lengths,
    straightness,
    pipAlignment,
    dipAlignment,
    depthDominant: complete && Math.abs(axis.z) > Math.hypot(axis.x, axis.y),
    tip: complete ? hand.landmarks[8] : null,
    base: complete ? hand.landmarks[5] : null,
  };
}
