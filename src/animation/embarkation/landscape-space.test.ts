import { describe, it, expect } from "vitest";
import { camera } from "./program";
import { HARBOR_ENVIRONMENT } from "./environment-set";
import { FOCAL, projectWorld, worldViewport, type CameraFrame } from "./projection";
import { landscapeFrame, landscapeSkyPoint, landscapeWaterPoint } from "./landscape-space";

const calibration = HARBOR_ENVIRONMENT.calibration;
const views = [
  { width: 390, height: 844 },
  { width: 800, height: 1100 },
  { width: 1280, height: 720 },
  { width: 2560, height: 1080 },
];
describe("Stage B fixed sky and planar sea", () => {
  it("registers sky and water to the same original pixel coordinates at the projector", () => {
    const reference: CameraFrame = { position: [0, 0, calibration.referenceCameraZ], roll: 0 };
    for (const view of views) {
      const frame = landscapeFrame(view, calibration),
        size = worldViewport(view);
      for (const uv of [
        [0.15, 0.03],
        [0.5, 0.15],
        [0.85, 0.3],
        [0.24, 0.68],
        [0.74, 0.93],
      ]) {
        const result =
          landscapeWaterPoint(reference, uv, view, calibration) ?? landscapeSkyPoint(reference, uv, view, calibration);
        expect(result.sourceUV[0]).toBeCloseTo(0.5 + ((uv[0] - 0.5) * size[0]) / frame.size[0], 10);
        expect(result.sourceUV[1]).toBeCloseTo(0.5 + ((uv[1] - 0.5) * size[1]) / frame.size[1], 10);
      }
    }
  });
  it("places every moving-camera water intersection on one stationary plane, with an exact far-shore join", () => {
    for (const view of views) {
      const frame = landscapeFrame(view, calibration);
      for (const time of [15.3, 16, 18, 20, 22, 24.65])
        for (const uv of [
          [0.05, 0.02],
          [0.5, 0.13],
          [0.95, 0.26],
        ]) {
          const hit = landscapeWaterPoint(camera(time), uv, view, calibration)!;
          const residual = hit.world[1] + frame.slope * (hit.world[2] - frame.eyeZ) + frame.eyeHeight;
          expect(Math.abs(residual)).toBeLessThan(1e-9);
          const projected = projectWorld(hit.world, camera(time), view);
          expect(projected.x).toBeCloseTo(uv[0] * view.width, 8);
          expect(projected.y).toBeCloseTo((1 - uv[1]) * view.height, 8);
        }
      const shoreY = ((frame.shoreUV - 0.5) * frame.size[1] * (frame.eyeZ - calibration.depths[0])) / FOCAL;
      expect(shoreY + frame.slope * (calibration.depths[0] - frame.eyeZ) + frame.eyeHeight).toBeCloseTo(0, 10);
    }
  });
  it("covers the entire visible camera path with supplied pixels rather than clamped border samples", () => {
    const bounds = calibration.backingBounds;
    for (const view of views)
      for (let t = 15.3; t <= 24.65; t += 0.125)
        for (let y = 0; y <= 8; y++)
          for (let x = 0; x <= 12; x++) {
            const point =
              landscapeWaterPoint(camera(t), [x / 12, y / 8], view, calibration) ??
              landscapeSkyPoint(camera(t), [x / 12, y / 8], view, calibration);
            expect(point.sourceUV[0]).toBeGreaterThan(bounds[0] + 0.01);
            expect(point.sourceUV[0]).toBeLessThan(bounds[2] - 0.01);
            expect(point.sourceUV[1]).toBeGreaterThan(bounds[1] + 0.01);
            expect(point.sourceUV[1]).toBeLessThan(bounds[3] - 0.01);
          }
  });
  it("registers the rigid land waterlines on the same sea surface across aspect ratios", () => {
    for (const view of views) {
      const frame = landscapeFrame(view, calibration);
      for (const [layer, row, overscan] of [
        [1, 590, 1],
        [2, 619, 1],
        [3, 723, 1.22],
      ]) {
        const z = calibration.depths[layer];
        const y = ((0.5 - row / 941) * frame.size[1] * (frame.eyeZ - z) * overscan) / FOCAL;
        expect(Math.abs(y + frame.slope * (z - frame.eyeZ) + frame.eyeHeight)).toBeLessThan(1e-9);
      }
    }
  });
  it("preserves straight water grid lines through translation and roll, unlike the old row-depth surface", () => {
    const view = views[2],
      reference: CameraFrame = { position: [0, 0, calibration.referenceCameraZ], roll: 0 };
    const render: CameraFrame = { position: [275, 95, -3600], roll: 0.013 };
    const world = [0.05, 0.11, 0.18, 0.25, 0.32].map(
      (v) => landscapeWaterPoint(reference, [0.37, v], view, calibration)!.world,
    );
    const projected = world.map((p) => projectWorld(p, render, view));
    const a = projected[0],
      b = projected.at(-1)!;
    for (const p of projected)
      expect(Math.abs((p.x - a.x) * (b.y - a.y) - (p.y - a.y) * (b.x - a.x))).toBeLessThan(1e-7);
    // The same water point has one source registration regardless of the render
    // camera; moving the camera changes its projected speed and scale only.
    expect(projectWorld(world[0], render, view).x).not.toBeCloseTo(projectWorld(world[0], reference, view).x, 0);
  });
});
