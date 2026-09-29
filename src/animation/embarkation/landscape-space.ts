import {
  FOCAL,
  WORLD_HEIGHT,
  eyePosition,
  viewRay,
  worldViewport,
  type CameraFrame,
  type Point3,
  type Viewport,
} from "./projection";
import type { LandscapeSet } from "./environment-set";

/** Stage B uses a fixed projector and stationary surfaces. Source UV is bottom
 * up. A level sea seen by the painting's pitched camera is a tilted plane in
 * film coordinates; its height never depends on the current render camera. */
export function landscapeFrame(viewport: Viewport, calibration: LandscapeSet["calibration"]) {
  const size = worldViewport(viewport);
  const aspect = calibration.width / calibration.height;
  if (size[0] / size[1] > aspect) size[1] = size[0] / aspect;
  else size[0] = size[1] * aspect;
  const eyeZ = calibration.referenceCameraZ + FOCAL;
  const { shoreUV } = calibration.water;
  const eyeHeight = (calibration.water.eyeHeight * size[1]) / WORLD_HEIGHT;
  const slope = ((shoreUV - 0.5) * size[1]) / FOCAL + eyeHeight / (eyeZ - calibration.depths[0]);
  return { size, eyeZ, eyeHeight, slope, shoreUV };
}

export function landscapeSource(world: Point3, viewport: Viewport, calibration: LandscapeSet["calibration"]) {
  const frame = landscapeFrame(viewport, calibration);
  const distance = frame.eyeZ - world[2];
  return [(world[0] * FOCAL) / distance / frame.size[0] + 0.5, (world[1] * FOCAL) / distance / frame.size[1] + 0.5] as [
    number,
    number,
  ];
}

export function landscapeWaterPoint(
  camera: CameraFrame,
  uv: readonly number[],
  viewport: Viewport,
  calibration: LandscapeSet["calibration"],
) {
  const frame = landscapeFrame(viewport, calibration),
    eye = eyePosition(camera);
  const ray = viewRay(uv, worldViewport(viewport), camera.roll);
  const denominator = ray[1] + frame.slope * ray[2];
  if (denominator >= -1e-8) return null;
  const distance = -(eye[1] + frame.slope * (eye[2] - frame.eyeZ) + frame.eyeHeight) / denominator;
  if (distance <= 0) return null;
  const world = eye.map((n, i) => n + ray[i] * distance) as Point3;
  if (world[2] < calibration.depths[0]) return null;
  return { world, sourceUV: landscapeSource(world, viewport, calibration), distance };
}

export function landscapeSkyPoint(
  camera: CameraFrame,
  uv: readonly number[],
  viewport: Viewport,
  calibration: LandscapeSet["calibration"],
) {
  const eye = eyePosition(camera),
    ray = viewRay(uv, worldViewport(viewport), camera.roll);
  const distance = eye[2] - calibration.depths[0];
  const world = eye.map((n, i) => n + ray[i] * distance) as Point3;
  return { world, sourceUV: landscapeSource(world, viewport, calibration), distance };
}
