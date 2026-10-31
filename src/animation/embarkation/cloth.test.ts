import { describe, expect, it } from "vitest";
import { ConstrainedSheet, sheetMaterials, type SheetMaterial } from "./cloth";
import { attachments } from "./adhesion";

const pulse = (t: number) => Math.min(1, t / 0.3) * (1 + 0.15 * Math.sin(t * 9));
describe("constrained material metric and support registration", () => {
  it("preserves free world-space momentum when paper and air move together", () => {
    const velocity: [number, number, number] = [100, -50, -800];
    const sheet = new ConstrainedSheet(
      450,
      300,
      "paper",
      [[0.28, 0.75]],
      () => ({
        air: velocity,
        worldAir: () => velocity,
        holds: [0],
        aerodynamics: { mass: 0.65, area: 1.3, drag: 1.15, inertia: 0.6, coupling: 1 },
      }),
      0,
      {
        initial: (rest) => ({ position: rest, velocity }),
        contacts: () => [],
      },
    );
    const frame = sheet.at(1);
    for (let i = 0; i < frame.positions.length; i++) {
      expect(frame.positions[i]).toBeCloseTo(sheet.rest[i] * sheet.width + velocity[i % 3], 3);
      expect(frame.velocities[i]).toBeCloseTo(velocity[i % 3], 3);
    }
  });
  it("reads transferred physical frames without integrating or changing fractional seeks", () => {
    const make = () =>
      new ConstrainedSheet(600, 350, "paper", "center", (t) => ({
        air: [0, 0, -6000 * pulse(t)],
        holds: [1, 1, 1, 1],
      }));
    const source = make();
    source.at(0.8);
    const target = make();
    target.importCache(structuredClone(source.exportCache()));
    for (const time of [0.77, 0.117, 0.8, 0.0, 0.393]) {
      expect(target.at(time).positions).toEqual(source.at(time).positions);
      expect(target.at(time).velocities).toEqual(source.at(time).velocities);
    }
    expect(target.bytes).toBe(source.bytes);
  });
  it("bounds strain before release across aspect ratios, materials and all authored support patterns", () => {
    for (const material of Object.keys(sheetMaterials) as SheetMaterial[])
      for (const attachment of attachments)
        for (const aspect of [0.5, 1, 2.5]) {
          const sheet = new ConstrainedSheet(600, 600 / aspect, material, attachment, (t) => ({
            air: [200 * pulse(t), -100, -7200 * pulse(t)],
            across: [90, 30, 800],
            holds: [1, 1, 1, 1],
          }));
          for (const t of [0.15, 0.61, 1.4]) {
            const f = sheet.at(t);
            expect(sheet.strain(f).max, `${material}/${attachment}/${aspect} at ${t}`).toBeLessThan(
              sheetMaterials[material].strainLimit,
            );
            for (const pin of sheet.pins)
              for (let k = 0; k < 3; k++)
                expect(f.positions[pin * 3 + k]).toBeCloseTo(sheet.rest[pin * 3 + k] * sheet.width, 4);
          }
        }
  }, 60000);
  it("bends cloth more freely than card and button under the same pressure", () => {
    const bend = (material: SheetMaterial) => {
      const s = new ConstrainedSheet(600, 350, material, "edge", (t) => ({
        air: [0, 0, -6000 * pulse(t)],
        holds: [1, 1, 1, 1],
      }));
      const f = s.at(0.7);
      return Math.max(
        ...Array.from(f.positions)
          .filter((_, i) => i % 3 === 2)
          .map(Math.abs),
      );
    };
    const cloth = bend("cloth"),
      paper = bend("paper"),
      card = bend("card"),
      button = bend("button");
    expect(cloth).toBeGreaterThan(paper);
    expect(paper).toBeGreaterThan(card * 1.3);
    expect(card).toBeGreaterThan(button * 1.3);
  }, 20000);
  it("has no still-air motion and uses deterministic physical ticks for reverse and fractional seeks", () => {
    const resting = new ConstrainedSheet(500, 500, "paper", "multi", () => ({ air: [0, 0, 0], holds: [1, 1, 1, 1] }));
    expect(resting.at(0.5).velocities.every((v) => Math.abs(v) < 1e-9)).toBe(true);
    const make = () =>
      new ConstrainedSheet(500, 300, "paper", "center", (t) => ({
        air: [0, 0, -6000 * pulse(t)],
        holds: [1, +(t < 0.4), +(t < 0.55), +(t < 0.65)],
      }));
    const a = make(),
      b = make();
    for (let t = 0; t < 0.8; t += 1 / 37) a.at(t);
    const expected = b.at(0.734).positions.slice();
    a.at(0.8);
    a.at(0.1);
    expect(a.at(0.734).positions).toEqual(expected);
    expect(a.strain(a.at(0.734)).max).toBeLessThan(sheetMaterials.paper.strainLimit);
  }, 20000);
});
