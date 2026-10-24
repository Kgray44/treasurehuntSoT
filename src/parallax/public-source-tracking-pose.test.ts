import { expect, it } from "vitest";
import { Matrix4, Quaternion, Vector3 } from "three";
import {
  admitsPublicSourceFrame,
  browserCameraRotation,
  publicSourceCameraPose,
  publicSourceRotationInput,
} from "./public-source-tracking-pose";

it("keeps gravity up and the rear camera looking ahead for upright portrait and equivalent landscape devices", () => {
  const portrait = browserCameraRotation(0, 90, 0, 0);
  expect(new Vector3(0, 0, -1).applyQuaternion(portrait).distanceTo(new Vector3(0, 0, -1))).toBeLessThan(1e-10);
  expect(new Vector3(0, 1, 0).applyQuaternion(portrait).y).toBeCloseTo(1);
  expect(new Vector3(0, 0, -1).applyQuaternion(browserCameraRotation(0, 0, 0, 0)).y).toBeCloseTo(-1);
  // The top of the device points right; the display's compensation angle is 270 (-90) degrees.
  const rolled = browserCameraRotation(270, 0, 90, 270);
  expect(new Vector3(0, 1, 0).applyQuaternion(rolled).y).toBeCloseTo(1);
  expect(new Vector3(0, 0, -1).applyQuaternion(rolled).distanceTo(new Vector3(0, 0, -1))).toBeLessThan(1e-10);
});

it("recovers camera center and rotation from world-to-camera extrinsics across off-axis poses", () => {
  for (const angles of [
    [0, 90, 0, 0],
    [75, 55, 20, 0],
    [120, 30, -65, 90],
  ]) {
    const camera = browserCameraRotation(...(angles as [number, number, number, number]));
    const center = new Vector3(1.5, 0.8, -2.2),
      r = publicSourceRotationInput(camera);
    const t = [0, 1, 2].map((row) => -r[row * 3] * center.x - r[row * 3 + 1] * center.y - r[row * 3 + 2] * center.z);
    const pose = publicSourceCameraPose([...r, ...t]);
    expect(new Vector3(pose.position.x, pose.position.y, pose.position.z).distanceTo(center)).toBeLessThan(1e-10);
    expect(
      new Quaternion(pose.rotation.x, pose.rotation.y, pose.rotation.z, pose.rotation.w).angleTo(camera),
    ).toBeLessThan(1e-7);
    const worldPoint = new Vector3(0.2, 1, -4),
      local = worldPoint.clone().applyMatrix4(new Matrix4().makeRotationFromQuaternion(camera).invert());
    const cv = new Vector3(
      r[0] * worldPoint.x + r[1] * worldPoint.y + r[2] * worldPoint.z,
      r[3] * worldPoint.x + r[4] * worldPoint.y + r[5] * worldPoint.z,
      r[6] * worldPoint.x + r[7] * worldPoint.y + r[8] * worldPoint.z,
    );
    expect(cv.distanceTo(new Vector3(local.x, -local.y, -local.z))).toBeLessThan(1e-10);
  }
});

it("rejects malformed poses, rotation-only estimates, stale/slow frames and failed PnP", () => {
  expect(() => publicSourceCameraPose([1, 0, 0, 0, 1, 0, 0, 0, 2, 0, 0, 0])).toThrow(/ROTATION/);
  expect(() => publicSourceCameraPose([1, 0, 0, 0, 1, 0, 0, 0, 1, NaN, 0, 0])).toThrow(/NONFINITE/);
  expect(() => browserCameraRotation(NaN, 0, 0, 0)).toThrow(/ORIENTATION/);
  const valid = [40, 18, 1.5, 50, 20, 20, 0, 0, 0.03, 0.2, 1];
  expect(admitsPublicSourceFrame(valid)).toBe(true);
  for (const change of [
    [1, 0],
    [2, 7],
    [3, 401],
    [5, 3],
    [0, 4],
    [9, NaN],
  ]) {
    const stats = [...valid];
    stats[change[0]] = change[1];
    expect(admitsPublicSourceFrame(stats)).toBe(false);
  }
});
