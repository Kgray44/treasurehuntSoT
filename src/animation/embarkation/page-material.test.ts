import { describe, expect, it } from "vitest";
import { pageState, type PageSurface } from "./page-material";
import { camera } from "./program";
import { anchorPoints, membrane } from "./adhesion";
const surface = {
  material: "cloth",
  release: 6.5,
  phase: 1.27,
  anchors: [5.72, 6.07, 6.5, 6.3],
  rect: { x: 360, y: 220, width: 620, height: 360 } as DOMRect,
} satisfies Pick<PageSurface, "material" | "release" | "phase" | "anchors" | "rect">;
const state = (time: number, material = surface.material as PageSurface["material"]) =>
  pageState({ ...surface, material }, time, 1536, 1024);
describe("Departure material under rear-origin pressure", () => {
  it("keeps the held region on its support while free edges are pulled into depth", () => {
    const points = anchorPoints("center");
    const held = membrane(0.5, 0.5, 6, 0, 1, [1, 1, 1, 1], points);
    const free = membrane(0.95, 0.08, 6, 0, 1, [1, 1, 1, 1], points);
    expect(held.z).toBeCloseTo(0, 12);
    expect(free.z).toBeLessThan(-0.5);
    expect(membrane(0.5, 0.5, 6, 0, 1, [0, 0, 0, 0], points).z).toBeLessThan(-0.1);
    expect(membrane(0.95, 0.08, 24, 0, 0, [1, 1, 1, 1], points).z).toBeCloseTo(0, 12);
  });
  it("holds the page while pressure builds, then fails its attachments in sequence", () => {
    const anticipation = state(1.5),
      strain = state(4.5),
      lastAnchor = state(6.4),
      released = state(6.7);
    expect(anticipation.anchors).toEqual([1, 1, 1, 1]);
    expect(strain.pressure).toBeGreaterThan(anticipation.pressure * 3);
    expect(strain.position[2]).toBe(camera(4.5).position[2]);
    expect(lastAnchor.anchors.filter((a) => a > 0.1)).toHaveLength(1);
    expect(released.anchors).toEqual([0, 0, 0, 0]);
    expect(released.position[2]).toBeLessThan(camera(surface.release).position[2]);
  });
  it("accelerates rapidly into depth and preserves material-specific inertia", () => {
    const start = state(6.5),
      early = state(6.6),
      later = state(7);
    expect((early.position[2] - later.position[2]) / 0.4).toBeGreaterThan(
      ((start.position[2] - early.position[2]) / 0.1) * 2,
    );
    const paper = state(7.4, "paper"),
      button = state(7.4, "button");
    expect(paper.pressure).toBeGreaterThan(button.pressure * 4);
    expect(Math.abs(paper.rotation[1])).toBeGreaterThan(Math.abs(button.rotation[1]) * 2.5);
  });
});
