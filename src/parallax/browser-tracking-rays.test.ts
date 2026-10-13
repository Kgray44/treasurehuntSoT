import { expect, it } from "vitest";
import { cameraTrackingRay, triangulateTrackingRays, type TrackingRay } from "./browser-tracking-rays";
import { identityTransform } from "./contracts";
import { tinyvioCameraPose } from "./tinyvio-browser-provider";

it("triangulates an observed corner from translated views without supplying its depth or scale", () => {
  const point = { x: 0.4, y: 0.2, z: -3 };
  const ray = (x: number): TrackingRay => {
    const delta = { x: point.x - x, y: point.y, z: point.z };
    const length = Math.hypot(delta.x, delta.y, delta.z);
    return {
      sessionId: "map-a",
      origin: { x, y: 0, z: 0 },
      direction: { x: delta.x / length, y: delta.y / length, z: delta.z / length },
    };
  };
  const result = triangulateTrackingRays(ray(-0.5), ray(0.7));
  for (const axis of ["x", "y", "z"] as const) expect(result[axis]).toBeCloseTo(point[axis], 8);
  expect(() => triangulateTrackingRays(ray(0), ray(0))).toThrow(/Move sideways/);
  expect(() => triangulateTrackingRays(ray(0), { ...ray(0.7), sessionId: "map-b" })).toThrow(/SESSION_CHANGED/);
  expect(() => triangulateTrackingRays(ray(-0.5), { ...ray(0.7), origin: { x: 0.7, y: 1, z: 0 } })).toThrow(
    /taps disagree/,
  );
  expect(() => triangulateTrackingRays(ray(-0.5), { ...ray(0.7), direction: { x: 3, y: 0, z: -1 } })).toThrow(
    /UNIT_RAYS/,
  );
});

it("unprojects normalized taps in the uncropped camera frame and rotates the ray into session space", () => {
  const ray = cameraTrackingRay({
    sessionId: "map",
    camera: { ...identityTransform(), position: { x: 1, y: 2, z: 3 } },
    x: 0.5,
    y: 0.5,
    width: 480,
    height: 640,
    focal: 452.48,
  });
  expect(ray.direction).toEqual({ x: 0, y: 0, z: -1 });
  expect(ray.origin).toEqual({ x: 1, y: 2, z: 3 });
  const turned = cameraTrackingRay({
    sessionId: "map",
    camera: { ...identityTransform(), rotation: { x: 0, y: Math.SQRT1_2, z: 0, w: Math.SQRT1_2 } },
    x: 0.5,
    y: 0.5,
    width: 480,
    height: 640,
    focal: 452.48,
  });
  expect(turned.direction.x).toBeCloseTo(-1, 8);
  expect(() =>
    cameraTrackingRay({
      sessionId: "map",
      camera: identityTransform(),
      x: 1.1,
      y: 0.5,
      width: 480,
      height: 640,
      focal: 452.48,
    }),
  ).toThrow(/RAY_INVALID/);
});

it("converts the engine's Z-up camera axes once and refuses malformed live poses", () => {
  const pose = tinyvioCameraPose([1, 2, 3], [0, 0, 0, 1]);
  expect(pose.position.x).toBe(1);
  expect(pose.position.y).toBeCloseTo(3, 8);
  expect(pose.position.z).toBeCloseTo(-2, 8);
  expect(pose.rotation.x).toBeCloseTo(Math.SQRT1_2, 8);
  expect(pose.rotation.w).toBeCloseTo(Math.SQRT1_2, 8);
  expect(() => tinyvioCameraPose([NaN, 0, 0], [0, 0, 0, 1])).toThrow(/NONFINITE/);
  expect(() => tinyvioCameraPose([0, 0, 0], [0, 0, 0, 2])).toThrow(/ROTATION/);
});
