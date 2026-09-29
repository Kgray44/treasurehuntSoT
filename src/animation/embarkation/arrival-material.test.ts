import { describe, expect, it } from "vitest";
import { ArrivalMaterial } from "./arrival-material";
import type { ArrivalMaterial as Material } from "./arrival";
import { sheetMaterials } from "./cloth";
import { orient } from "./dynamics";
import { cssToWorld, projectWorld, REST_CAMERA, type Point3 } from "./projection";

describe("incoming anchor inertia on constrained material", () => {
  it("prepares the narrow viewing pane's crew card without abandoning full arrival", () => {
    // Actual 319x766 owner viewing pane: the third support used to exhaust
    // the metric solve at 32.5667s and degrade the whole film to 1.8 seconds.
    const viewport = { width: 319, height: 766 },
      scale = 1100 / viewport.height;
    const material = new ArrivalMaterial({
      home: cssToWorld(164, 323.3999938964844 + 161 / 2, 0, viewport),
      width: 90 * scale,
      height: 161 * scale,
      start: 31.55,
      flight: 1.02,
      material: "card",
      index: 3,
    });
    for (let tick = 0; tick <= 254; tick++) {
      const time = Math.min(33.66, 31.55 + tick / 120),
        frame = material.sheet.at(time),
        body = material.body.at(time);
      expect(material.sheet.strain(frame).max).toBeLessThan(sheetMaterials.card.strainLimit);
      material.sheet.pins.forEach((pin, anchor) => {
        if (body.holds[anchor])
          for (let axis = 0; axis < 3; axis++)
            expect(frame.positions[pin * 3 + axis]).toBeCloseTo(
              material.sheet.rest[pin * 3 + axis] * material.spec.width,
              3,
            );
      });
    }
    expect(material.body.captures).toHaveLength(4);
    expect(material.sheet.limitedSteps).toBeGreaterThan(0);
  });
  it("keeps newly caught pins on their supports when strain backtracking becomes active", () => {
    // This real label geometry/viewport scale previously retained 15px error:
    // the limiter interpolated toward an unpinned pre-capture frame.
    const scale = 1100 / 844;
    const material = new ArrivalMaterial({
      home: [-350, 180, 0],
      width: 694.0875 * scale,
      height: 159.625 * scale,
      start: 30.9,
      flight: 1.02,
      material: "label",
      index: 0,
    });
    for (let tick = 0; tick <= 252; tick++) {
      const time = 30.9 + tick / 120,
        body = material.body.at(time),
        frame = material.sheet.at(time);
      expect(material.sheet.strain(frame).max).toBeLessThan(sheetMaterials.paper.strainLimit);
      material.sheet.pins.forEach((pin, anchor) => {
        if (body.holds[anchor])
          for (let axis = 0; axis < 3; axis++)
            expect(frame.positions[pin * 3 + axis]).toBeCloseTo(
              material.sheet.rest[pin * 3 + axis] * material.spec.width,
              3,
            );
      });
    }
    expect(material.sheet.limitedSteps).toBeGreaterThan(0);
    expect(material.body.captures).toHaveLength(4);
  });
  it("keeps strain bounded through capture and lands the actual mesh at canonical geometry", () => {
    const rows: Array<[number, number, number, number, Material, number]> = [
      [694, 160, 30.9, 33, "label", 0],
      [360, 815, 31.02, 33.65, "parchment", 1],
      [131, 172, 31.32, 33.5, "card", 2],
      [318, 172, 32.18, 34.1, "card", 6],
      [305, 302, 32.04, 34.2, "chat", 8],
      [533, 99, 32.78, 34.35, "label", 9],
    ];
    for (const [width, height, start, end, material, index] of rows) {
      const m = new ArrivalMaterial({
        home: [-350, 180, 0],
        width,
        height,
        start,
        flight: material === "parchment" || material === "chat" ? 1.19 : 1.02 + (index % 3) * 0.075,
        material,
        index,
      });
      for (let time = start; time <= end; time += 1 / 30) {
        expect(m.sheet.strain(m.sheet.at(time)).max, material).toBeLessThan(
          sheetMaterials[m.sheet.material].strainLimit,
        );
      }
      const body = m.body.at(end),
        sheet = m.sheet.at(end),
        viewport = { width: 1536, height: 1100 };
      let error = 0;
      for (let i = 0; i < sheet.positions.length; i += 3) {
        const local: Point3 = [sheet.positions[i], -sheet.positions[i + 1], sheet.positions[i + 2]],
          p = orient(local, body.orientation);
        const actual = projectWorld(p.map((v, j) => v + body.position[j]) as Point3, REST_CAMERA, viewport);
        const rest = projectWorld(
          [m.spec.home[0] + m.sheet.rest[i] * width, m.spec.home[1] - m.sheet.rest[i + 1] * width, 0],
          REST_CAMERA,
          viewport,
        );
        error = Math.max(error, Math.hypot(actual.x - rest.x, actual.y - rest.y));
      }
      expect(error, `${material}: final mesh pixel error`).toBeLessThan(0.2);
      expect(m.body.captures).toHaveLength(4);
    }
  });
  it("reproduces body and mesh after worker cache transfer and reverse seeking", () => {
    const spec = {
      home: [300, 150, 0] as Point3,
      width: 360,
      height: 710,
      start: 31.02,
      flight: 1.19,
      material: "parchment" as const,
      index: 1,
    };
    const first = new ArrivalMaterial(spec);
    first.prepare(33.65);
    const second = new ArrivalMaterial(spec, first.exportCache());
    for (const time of [32.45, 31.4, 33.65]) {
      expect(second.body.at(time)).toEqual(first.body.at(time));
      expect(second.sheet.at(time).positions).toEqual(first.sheet.at(time).positions);
    }
  });
});
