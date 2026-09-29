import { describe, expect, it } from "vitest";
import {
  FOCAL,
  WORLD_HEIGHT,
  REST_CAMERA,
  cssToWorld,
  cssProjection,
  eyePosition,
  inverseProjection,
  multiplyProjection,
  opticalSegmentLength,
  planeProjection,
  projectWorld,
  rotateEuler,
  transformPoint,
  viewRay,
  worldViewport,
  sphereInView,
  type CameraFrame,
  type Point3,
} from "./projection";

const sizes = [
  { width: 390, height: 844 },
  { width: 1024, height: 768 },
  { width: 1536, height: 1024 },
  { width: 3440, height: 1440 },
];
const cameras: CameraFrame[] = [REST_CAMERA, { position: [180, -70, -2900], roll: 0.17 }];
describe("shared world / CSS / ray lens", () => {
  it("conservatively retains spheres with any visible point, including near-plane and rolled views", () => {
    for (const viewport of sizes)
      for (const camera of cameras) {
        for (const distance of [1, 40, 500, 4000])
          for (const radius of [5, 70, 800]) {
            const center = cssToWorld(
              viewport.width * 1.05,
              viewport.height * 0.4,
              eyePosition(camera)[2] - distance,
              viewport,
              camera,
            );
            for (let i = 0; i < 50; i++) {
              const angle = i * 2.399963229728653;
              const offset: Point3 = [
                Math.cos(angle) * radius * 0.8,
                Math.sin(angle) * radius * 0.8,
                Math.sin(angle * 2) * radius * 0.5,
              ];
              const point = center.map((n, axis) => n + offset[axis]) as Point3;
              const p = projectWorld(point, camera, viewport);
              if (p.visible && p.x >= 0 && p.x <= viewport.width && p.y >= 0 && p.y <= viewport.height)
                expect(sphereInView(center, radius, camera, viewport)).toBe(true);
            }
          }
      }
    expect(sphereInView([50000, 0, 0], 50, REST_CAMERA, { width: 1600, height: 900 })).toBe(false);
    expect(sphereInView([0, 0, 1500], 50, REST_CAMERA, { width: 1600, height: 900 })).toBe(false);
  });
  it("has an explicit image plane, eye and near convention", () => {
    const view = { width: 1600, height: 1100 };
    expect(eyePosition(REST_CAMERA)).toEqual([0, 0, 1150]);
    expect(projectWorld([100, 50, 0], REST_CAMERA, view)).toMatchObject({
      x: 900,
      y: 500,
      distance: 1150,
      visible: true,
    });
    expect(projectWorld([100, 50, -1150], REST_CAMERA, view)).toMatchObject({ x: 850, y: 525, distance: 2300 });
    expect(projectWorld([0, 0, 1147], REST_CAMERA, view).visible).toBe(false);
  });
  it("inverts projection at multiple depths with translated and rolled cameras", () => {
    for (const viewport of sizes)
      for (const camera of cameras)
        for (const distance of [40, 300, 1150, 6000, 18000]) {
          for (const [u, v] of [
            [0.08, 0.12],
            [0.5, 0.5],
            [0.88, 0.91],
          ]) {
            const p = cssToWorld(
              u * viewport.width,
              v * viewport.height,
              eyePosition(camera)[2] - distance,
              viewport,
              camera,
            );
            const screen = projectWorld(p, camera, viewport);
            expect(screen.x).toBeCloseTo(u * viewport.width, 8);
            expect(screen.y).toBeCloseTo(v * viewport.height, 8);
            expect(screen.distance).toBeCloseTo(distance, 8);
          }
        }
  });
  it("projects every CSS plane corner like its world geometry, including orientation", () => {
    for (const viewport of sizes)
      for (const camera of cameras)
        for (const depth of [-4000, -200, 300]) {
          const center = [viewport.width * 0.7, viewport.height * 0.65];
          const position: Point3 = [100, -80, camera.position[2] + depth],
            rotation: Point3 = [0.3, -0.45, 0.2];
          const matrix = planeProjection(center, position, rotation, camera, viewport);
          for (const [x, y] of [
            [0, 0],
            [-70, -40],
            [70, 40],
            [-70, 40],
            [70, -40],
          ]) {
            const delta = rotateEuler(
              [(x * WORLD_HEIGHT) / viewport.height, (-y * WORLD_HEIGHT) / viewport.height, 0],
              rotation,
            );
            const screen = projectWorld(position.map((p, i) => p + delta[i]) as Point3, camera, viewport);
            const css = transformPoint(matrix, center[0] + x, center[1] + y);
            expect(css.x).toBeCloseTo(screen.x, 8);
            expect(css.y).toBeCloseTo(screen.y, 8);
          }
        }
  });
  it("cancels nested parent projection instead of applying camera perspective twice", () => {
    const viewport = sizes[2],
      center = [500, 350];
    const parent = planeProjection(center, [50, 80, 500], [0.2, 0.3, -0.1], cameras[1], viewport);
    const child = planeProjection([570, 390], [300, 150, -200], [0.1, -0.2, 0.05], cameras[1], viewport);
    const relative = multiplyProjection(inverseProjection(parent), child);
    const composed = multiplyProjection(parent, relative);
    for (const [x, y] of [
      [570, 390],
      [600, 440],
      [520, 360],
    ]) {
      const expected = transformPoint(child, x, y),
        actual = transformPoint(composed, x, y);
      expect(actual.x).toBeCloseTo(expected.x, 7);
      expect(actual.y).toBeCloseTo(expected.y, 7);
    }
  });
  it("emits the CSS column-major matrix without changing the projection origin", () => {
    const viewport = sizes[0],
      left = 40,
      top = 80;
    const h = planeProjection([120, 170], [100, 40, -900], [0.2, -0.3, 0.1], cameras[1], viewport);
    const m = cssProjection(h, left, top).slice(9, -1).split(",").map(Number);
    for (const [x, y] of [
      [0, 0],
      [160, 0],
      [160, 180],
      [0, 180],
    ]) {
      const w = m[3] * x + m[7] * y + m[15];
      const actual = { x: left + (m[0] * x + m[4] * y + m[12]) / w, y: top + (m[1] * x + m[5] * y + m[13]) / w };
      const expected = transformPoint(h, left + x, top + y);
      expect(actual.x).toBeCloseTo(expected.x, 8);
      expect(actual.y).toBeCloseTo(expected.y, 8);
    }
  });
  it("integrates physical optical length, including off-axis distance and roll", () => {
    for (const viewport of sizes)
      for (const roll of [0, 0.4]) {
        const size = worldViewport(viewport),
          axial = 1000;
        const center = viewRay([0.5, 0.5], size, roll),
          corner = viewRay([1, 1], size, roll);
        expect(opticalSegmentLength(axial, center)).toBe(axial);
        const expected = Math.sqrt(
          axial ** 2 + ((axial * size[0]) / (2 * FOCAL)) ** 2 + ((axial * size[1]) / (2 * FOCAL)) ** 2,
        );
        expect(opticalSegmentLength(axial, corner)).toBeCloseTo(expected, 8);
        // Homogeneous sigma=0.001: corner extinction is stronger than center.
        expect(Math.exp(-0.001 * opticalSegmentLength(axial, corner))).toBeLessThan(Math.exp(-1));
      }
  });
});
