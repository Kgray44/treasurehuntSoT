import type { Point } from "./coordinates";
import type { HandObservation } from "./observation";
// SHA-256 of the declared synthetic fixture identity, not of live model weights.
const syntheticDigest = "7f15243cff2d3e03b9536043f3eaaa1a3e9f0ae23e2d1f7dbd46c32c6fc1f7ff";
export function syntheticObservation(point: Point, sequence: number, at: number, generation = 1): HandObservation {
  const landmarks = Array.from({ length: 21 }, () => ({ x: point.x, y: point.y, z: 0, valid: true }));
  landmarks[17] = { x: Math.min(0.99, point.x + 0.06), y: point.y, z: 0, valid: true };
  landmarks[6] = { x: point.x, y: point.y - 0.02, z: 0, valid: true };
  landmarks[8] = { x: point.x, y: point.y - 0.06, z: 0, valid: true };
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
