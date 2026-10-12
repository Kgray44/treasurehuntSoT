import type { Point } from "./coordinates";
import type { HandObservation } from "./observation";
// SHA-256 of the declared synthetic fixture identity, not of live model weights.
const syntheticDigest = "7f15243cff2d3e03b9536043f3eaaa1a3e9f0ae23e2d1f7dbd46c32c6fc1f7ff";
export function syntheticObservation(point: Point, sequence: number, at: number, generation = 1): HandObservation {
  const landmarks = Array.from({ length: 21 }, () => ({ x: point.x, y: point.y, z: 0, valid: true }));
  landmarks[17] = { x: Math.min(0.99, point.x + 0.06), y: point.y, z: 0, valid: true };
  landmarks[6] = { x: point.x, y: point.y - 0.02, z: 0, valid: true };
  landmarks[7] = { x: point.x, y: point.y - 0.04, z: 0, valid: true };
  landmarks[8] = { x: point.x, y: point.y - 0.06, z: 0, valid: true };
  // A legible simulated skeleton; the calibration features at 5/6/7/8/17 stay unchanged.
  const folded: Record<number, [number, number]> = {
    0: [0.03, 0.075],
    1: [-0.01, 0.055],
    2: [-0.025, 0.035],
    3: [-0.045, 0.015],
    4: [-0.06, -0.005],
    9: [0.02, 0.008],
    10: [0.019, -0.009],
    11: [0.011, 0.012],
    12: [0.021, 0.023],
    13: [0.04, 0.011],
    14: [0.037, -0.005],
    15: [0.031, 0.015],
    16: [0.043, 0.027],
    18: [0.061, -0.014],
    19: [0.051, 0.008],
    20: [0.061, 0.019],
  };
  for (const [index, [x, y]] of Object.entries(folded))
    landmarks[Number(index)] = { x: point.x + x, y: point.y + y, z: 0, valid: true };
  return {
    observationVersion: 1,
    providerId: "watchglass.synthetic-hand",
    providerVersion: "1",
    modelId: "synthetic-index-axis",
    modelVersion: "1",
    modelDigest: syntheticDigest,
    providerGeneration: generation,
    observationId: `synthetic-${sequence}`,
    sequence,
    monotonicCaptureTime: at,
    monotonicInferenceTime: at,
    cameraLeaseId: "synthetic-no-camera",
    cameraFrameVersion: 1,
    frameWidth: 640,
    frameHeight: 480,
    orientation: 0,
    mirrorTransform: "NONE",
    evidenceTier: "D0",
    hands: [
      {
        trackId: "synthetic-1",
        trackGeneration: 1,
        handedness: "UNKNOWN",
        handednessConfidence: null,
        coordinateFrame: "CAMERA_IMAGE_NORMALIZED",
        landmarks,
        presenceScore: null,
        trackingScore: null,
        occluded: false,
        pose: "POINT_CANDIDATE",
        uncertainty: null,
      },
    ],
    quality: "USABLE",
    reason: "NONE",
  };
}
