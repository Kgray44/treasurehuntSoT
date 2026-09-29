import { describe, expect, it } from "vitest";
import { exposureSamples, EXPOSURE_SECONDS, focusDistance, lensProject } from "./exposure";
import { CUT, camera, focusPose, type Tier } from "./program";
import { FOCAL, REST_CAMERA, WORLD_HEIGHT, projectWorld, rotateRoll, type Point3 } from "./projection";
import { EXTERIOR } from "./scene-space";

describe("photographic exposure", () => {
  it("integrates one fixed shutter with zero temporal/lens bias and restores the central instant", () => {
    expect(EXPOSURE_SECONDS).toBeCloseTo(1 / 120, 12);
    for (const tier of ["CINEMATIC", "BALANCED", "PERFORMANCE"] as Tier[]) {
      const samples = exposureSamples(12.2, tier, 1536, 1024);
      expect(samples.reduce((s, p) => s + p.weight, 0)).toBeCloseTo(1, 12);
      expect(samples.reduce((s, p) => s + p.weight * p.time, 0)).toBeCloseTo(12.2, 12);
      for (const axis of [0, 1]) expect(samples.reduce((s, p) => s + p.aperture[axis], 0)).toBeCloseTo(0, 12);
      expect(samples.at(-1)!.time).toBe(12.2);
      expect(samples.at(-1)!.aperture).toEqual([0, 0]);
      expect(samples.every((s) => Math.abs(s.time - 12.2) < EXPOSURE_SECONDS / 2)).toBe(true);
      // The same seek produces exactly the same exposure regardless of which
      // other times were inspected in between; no previous-frame dependence.
      exposureSamples(32, tier, 390, 844);
      expect(exposureSamples(12.2, tier, 1536, 1024)).toEqual(samples);
    }
  });
  it("keeps held title on the common focal plane, including measured source geometry", () => {
    const rect = { x: 200, y: 120, width: 700, height: 92 };
    for (const t of [0.7, 2, 4, 8, 11.5, 13]) {
      const pose = focusPose(t, 1600, 900, rect),
        cam = camera(t);
      const focus = focusDistance(t, 1600, 900, rect);
      const centered = projectWorld(pose.position, cam, { width: 1600, height: 900 });
      for (const aperture of [
        [3, -2],
        [-3, 2],
      ] as [number, number][]) {
        const p = lensProject(pose.position, cam, 1600, 900, { aperture, focus });
        expect(p.x).toBeCloseTo(centered.x, 7);
        expect(p.y).toBeCloseTo(centered.y, 7);
      }
    }
    expect(exposureSamples(CUT.settled, "CINEMATIC", 1600, 900).every((s) => s.aperture.every((a) => a === 0))).toBe(
      true,
    );
  });
  it("projects aperture rays consistently through rolled/translated cameras and multiple pixel scales", () => {
    const cam = { position: [120, -65, -2000] as Point3, roll: 0.23 },
      focus = 2300;
    const lens = { aperture: [4, -2] as [number, number], focus };
    for (const [width, height] of [
      [390, 844],
      [1600, 900],
      [3440, 1440],
    ])
      for (const distance of [60, 800, 2300, 12500]) {
        const viewport = [(WORLD_HEIGHT * width) / height, WORLD_HEIGHT];
        const uv = [0.71, 0.28];
        const localRay = [
          ((uv[0] - 0.5) * viewport[0]) / FOCAL - lens.aperture[0] / focus,
          ((uv[1] - 0.5) * viewport[1]) / FOCAL - lens.aperture[1] / focus,
          -1,
        ] as Point3;
        const ray = rotateRoll(localRay, cam.roll),
          aperture = rotateRoll([...lens.aperture, 0], cam.roll);
        const point = cam.position.map((v, i) => v + (i === 2 ? FOCAL : 0) + aperture[i] + ray[i] * distance) as Point3;
        const p = lensProject(point, cam, width, height, lens);
        expect(p.x).toBeCloseTo(uv[0] * width, 7);
        expect(p.y).toBeCloseTo((1 - uv[1]) * height, 7);
      }
    const near = lensProject([0, 0, 1000], REST_CAMERA, 1600, 900, lens);
    const far = lensProject([0, 0, -9000], REST_CAMERA, 1600, 900, lens);
    expect(Math.abs(near.x - 800)).toBeGreaterThan(Math.abs(far.x - 800));
  });
  it("focuses the visible room opening while the near lantern is still behind the eye", () => {
    const time = 28.6,
      cam = camera(time);
    expect(cam.position[2] + FOCAL + 1200).toBeLessThan(0);
    expect(focusDistance(time, 1280, 720)).toBeGreaterThan(FOCAL);
    for (const t of [28.65, 28.9, 29.2]) {
      const view = camera(t),
        focus = focusDistance(t, 1280, 720);
      const opening: Point3 = [view.position[0], view.position[1], EXTERIOR.openingZ];
      const a = lensProject(opening, view, 1280, 720, { aperture: [0, 0], focus });
      const b = lensProject(opening, view, 1280, 720, { aperture: [4, -3], focus });
      expect(a.x).toBeCloseTo(b.x, 8);
      expect(a.y).toBeCloseTo(b.y, 8);
    }
    expect(focusDistance(CUT.room, 1280, 720)).toBe(FOCAL);
  });
  it("converges the optical image continuously before replacing the spatial room", () => {
    const points: Point3[] = [
      [200, 80, -12500],
      [-380, 260, 490],
      [400, -240, 690],
    ];
    const spread = (time: number) => {
      const view = camera(time),
        samples = exposureSamples(time, "CINEMATIC", 1280, 720);
      return Math.max(
        ...points.map((point) => {
          const center = lensProject(point, view, 1280, 720, { aperture: [0, 0], focus: samples[0].focus });
          return Math.max(
            ...samples.map((sample) => {
              const p = lensProject(point, view, 1280, 720, sample);
              return Math.hypot(p.x - center.x, p.y - center.y);
            }),
          );
        }),
      );
    };
    expect(spread(30.5)).toBeGreaterThan(spread(30.9));
    expect(spread(30.99)).toBeLessThan(0.002);
    expect(spread(CUT.room)).toBe(0);
    // Stopping the aperture does not remove moving-silhouette exposure.
    const incoming = exposureSamples(32.5, "CINEMATIC", 1280, 720);
    expect(incoming.length).toBe(9);
    expect(new Set(incoming.map((s) => s.time)).size).toBe(9);
  });
});
