import { describe, expect, it } from "vitest";
import { departureSchedule, pageState, pageSheet, type PageSurface } from "./page-material";
import { camera, gust } from "./program";
import { cssToWorld } from "./projection";
import { sheetMaterials } from "./cloth";
const surface = {
  material: "cloth",
  release: 6.5,
  phase: 1.27,
  anchors: [5.72, 6.07, 6.5, 6.3],
  attachment: "multi",
  rect: { x: 360, y: 220, width: 620, height: 360 } as DOMRect,
} satisfies Pick<PageSurface, "material" | "release" | "phase" | "anchors" | "rect" | "attachment">;
const stateSurfaces = Object.fromEntries(
  ["cloth", "paper", "card", "button"].map((material) => [
    material,
    { ...surface, material: material as PageSurface["material"] },
  ]),
);
const state = (time: number, material = surface.material as PageSurface["material"]) =>
  pageState(stateSurfaces[material], time, 1536, 1024);
describe("Departure material under rear-origin pressure", () => {
  it("breaks the page on the first gust while retaining a stronger crossing crest", () => {
    const schedules = ["paper", "card", "cloth", "button"].flatMap((material) =>
      Array.from({ length: 12 }, (_, index) => departureSchedule(material as PageSurface["material"], index)),
    );
    expect(Math.min(...schedules.map((s) => s.release))).toBeGreaterThan(3.5);
    expect(Math.max(...schedules.map((s) => s.release))).toBeLessThan(6.4);
    for (const s of schedules) expect(new Set(s.anchors).size).toBe(4);
    expect(gust(4)).toBeGreaterThan(0.7);
    expect(gust(12.15)).toBeGreaterThan(gust(6) * 1.35);
  });
  it("carries released cardstock rapidly into depth without giving buttons the same inertia", () => {
    const schedule = departureSchedule("card", 0);
    // Actual desktop crew-card dimensions: the broad-panel case below must
    // preserve its much larger angular inertia, rather than share this pose.
    const card = {
      ...surface,
      ...schedule,
      material: "card" as const,
      attachment: "center" as const,
      rect: { x: 254, y: 424, width: 119.4, height: 157 } as DOMRect,
    };
    const button = { ...card, material: "button" as const };
    const t = Math.max(...schedule.anchors) + 0.05 + 0.6;
    const light = pageState(card, t, 1280, 720),
      heavy = pageState(button, t, 1280, 720);
    const depth = camera(t).position[2] - light.position[2];
    expect(depth).toBeGreaterThan(800);
    expect(-light.velocity[2]).toBeGreaterThan(2800);
    expect(-light.velocity[2]).toBeGreaterThan(Math.hypot(light.velocity[0], light.velocity[1]) * 6);
    expect(-light.velocity[2]).toBeGreaterThan(-heavy.velocity[2] * 1.6);
    expect(1150 / (1150 + depth)).toBeLessThan(0.6);
  });
  it("registers moving supports while actual free material bows away with bounded strain", () => {
    for (const rect of [surface.rect, { x: 0, y: 0, width: 1259.2, height: 76 } as DOMRect]) {
      const s = { ...surface, rect },
        sheet = pageSheet(s, 1280, 720),
        time = 4.5;
      const frame = sheet.at(time),
        cam = camera(time);
      for (const pin of sheet.pins) {
        const u = sheet.uv[pin * 2],
          v = sheet.uv[pin * 2 + 1];
        const target = cssToWorld(
          rect.x + u * rect.width,
          rect.y + (1 - v) * rect.height,
          cam.position[2],
          { width: 1280, height: 720 },
          cam,
        );
        for (let k = 0; k < 3; k++) expect(frame.positions[pin * 3 + k]).toBeCloseTo(target[k], 3);
      }
      expect(Math.min(...Array.from(frame.positions).filter((_, i) => i % 3 === 2))).toBeLessThan(cam.position[2] - 10);
      expect(sheet.strain(frame).max).toBeLessThan(sheetMaterials.cloth.strainLimit);
    }
  });
  it("holds the page while pressure builds, then fails its attachments in sequence", () => {
    const anticipation = state(1.5),
      strain = state(4.5),
      lastAnchor = state(6.4),
      released = state(6.7);
    expect(anticipation.anchors).toEqual([1, 1, 1, 1]);
    expect(strain.pressure).toBeGreaterThan(anticipation.pressure * 3);
    expect(strain.supportPosition[2]).toBe(camera(4.5).position[2]);
    expect(strain.position[2]).toBeLessThan(strain.supportPosition[2]);
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
    expect(-paper.velocity[2]).toBeGreaterThan(-button.velocity[2] * 1.6);
  });
  it("keeps every point's position and momentum through final anchor failure and cache transfer", () => {
    const s = { ...surface },
      sheet = pageSheet(s, 1280, 720),
      release = Math.max(...s.anchors) + 0.05;
    const before = sheet.at(release - 1e-5);
    const positions = before.positions.slice(),
      velocities = before.velocities.slice();
    const after = sheet.at(release + 1e-5);
    let speed = 0;
    for (let i = 0; i < positions.length; i++) {
      expect(Math.abs(after.positions[i] - positions[i])).toBeLessThan(0.08);
      expect(Math.abs(after.velocities[i] - velocities[i])).toBeLessThan(2);
      speed += velocities[i] ** 2;
    }
    expect(Math.sqrt(speed / velocities.length)).toBeGreaterThan(100);
    const bytes = sheet.bytes;
    const copy = pageSheet({ ...s }, 1280, 720);
    copy.importCache(structuredClone(sheet.exportCache()));
    for (const t of [release, release - 0.5, 0, 3.308333333333333]) {
      expect(copy.at(t).positions).toEqual(sheet.at(t).positions);
      expect(copy.at(t).velocities).toEqual(sheet.at(t).velocities);
    }
    expect(copy.bytes).toBe(bytes);
  });
});
