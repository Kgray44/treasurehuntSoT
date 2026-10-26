import { Euler, Matrix4, Quaternion, Vector3 } from "three";
import type { Transform } from "./contracts";

/** W3C Z-X'-Y'' device angles converted to the gravity-up Three.js rear-camera frame.
 * Orientation supplies rotation only; it can never admit a world position by itself.
 * https://www.w3.org/TR/orientation-event/#deviceorientation
 */
export function browserCameraRotation(alpha: number, beta: number, gamma: number, screenAngle: number) {
  if (![alpha, beta, gamma, screenAngle].every(Number.isFinite))
    throw new Error("PARALLAX_TRACKING_INVALID_ORIENTATION");
  const rad = Math.PI / 180;
  return new Quaternion()
    .setFromEuler(new Euler(beta * rad, alpha * rad, -gamma * rad, "YXZ"))
    .multiply(new Quaternion(-Math.SQRT1_2, 0, 0, Math.SQRT1_2))
    .multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), -screenAngle * rad))
    .normalize();
}

/** Row-major OpenCV camera-from-world rotation; the world stays +Y up.
 * Camera CV axes are +X right, +Y down, +Z forward, unlike the Three.js camera.
 */
export function publicSourceRotationInput(camera: Quaternion) {
  if (!camera.toArray().every(Number.isFinite) || Math.abs(camera.lengthSq() - 1) > 0.02)
    throw new Error("PARALLAX_TRACKING_INVALID_ROTATION");
  const matrix = new Matrix4().makeRotationFromQuaternion(camera).transpose().elements;
  return [matrix[0], matrix[4], matrix[8], -matrix[1], -matrix[5], -matrix[9], -matrix[2], -matrix[6], -matrix[10]];
}

/** Convert world-to-camera extrinsics, never mistake the translation column for camera position. */
export function publicSourceCameraPose(extrinsics: readonly number[]): Transform {
  if (extrinsics.length < 12 || !extrinsics.slice(0, 12).every(Number.isFinite))
    throw new Error("PARALLAX_TRACKING_NONFINITE_POSE");
  const [a, b, c, d, e, f, g, h, i, tx, ty, tz] = extrinsics;
  const rows = [
    [a, b, c],
    [d, e, f],
    [g, h, i],
  ];
  const dot = (u: number[], v: number[]) => u.reduce((sum, n, index) => sum + n * v[index], 0);
  const determinant = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
  if (
    Math.abs(determinant - 1) > 0.02 ||
    rows.some((row, n) => rows.some((other, m) => Math.abs(dot(row, other) - (n === m ? 1 : 0)) > 0.02))
  )
    throw new Error("PARALLAX_TRACKING_INVALID_ROTATION");
  const worldFromCamera = new Matrix4().set(a, -d, -g, 0, b, -e, -h, 0, c, -f, -i, 0, 0, 0, 0, 1);
  const q = new Quaternion().setFromRotationMatrix(worldFromCamera).normalize();
  return {
    position: { x: -(a * tx + d * ty + g * tz), y: -(b * tx + e * ty + h * tz), z: -(c * tx + f * ty + i * tz) },
    rotation: { x: q.x, y: q.y, z: q.z, w: q.w },
    scale: 1,
  };
}

/** Fresh mapped PnP is mandatory. Heuristic translation, sensor rotation, and stale poses are not world tracking. */
export function admitsPublicSourceFrame(stats: readonly number[]) {
  return (
    stats.length >= 11 &&
    stats.every(Number.isFinite) &&
    stats[0] >= 8 &&
    stats[1] >= 8 &&
    stats[2] >= 0 &&
    stats[2] <= 6 &&
    stats[3] >= 0 &&
    stats[3] <= 400 &&
    stats[5] >= stats[1]
  );
}
