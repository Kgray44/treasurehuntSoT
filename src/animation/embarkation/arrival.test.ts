import { describe, expect, it } from "vitest";
import { ArrivalPath, type ArrivalMaterial } from "./arrival";
import { eulerFromOrientation } from "./dynamics";

describe("momentum captured by compliant room supports", () => {
  it("settles within the actual staggered landing windows including the late wide quote", () => {
    const rows: Array<[number, number, number, number, ArrivalMaterial, number]> = [
      [694, 160, 30.9, 33, "label", 0],
      [360, 815, 31.02, 33.65, "parchment", 1],
      [131, 172, 31.32, 33.5, "card", 2],
      [131, 172, 32.01, 33.98, "card", 5],
      [318, 172, 32.18, 34.1, "card", 6],
      [318, 120, 32.52, 34.3, "card", 7],
      [305, 302, 32.04, 34.2, "chat", 8],
      [533, 99, 32.78, 34.35, "label", 9],
    ];
    for (const [w, h, start, end, material, index] of rows)
      for (const scale of [1, 1100 / 720, 1100 / 844]) {
        const path = new ArrivalPath({
          home: [-350, 180, 0],
          width: w * scale,
          height: h * scale,
          start,
          flight: material === "chat" || material === "parchment" ? 1.19 : 1.02 + (index % 3) * 0.075,
          material,
          index,
        });
        const state = path.at(end);
        expect(state.holds, `${material} ${index}`).toEqual([1, 1, 1, 1]);
        expect(Math.hypot(...state.position.map((v, i) => v - path.spec.home[i])), `${material} ${index}`).toBeLessThan(
          0.08 * scale,
        );
        // Geometric corner error, including residual rotation, bounds the actual
        // projected handoff better than checking only the center translation.
        const angles = eulerFromOrientation(state.orientation);
        expect((Math.hypot(...angles) * Math.hypot(w, h)) / 2, `${material} ${index}`).toBeLessThan(0.08);
      }
  });
  it("captures nonzero momentum and converges without easing its free flight to rest", () => {
    for (const material of ["parchment", "card", "chat", "label"] as ArrivalMaterial[]) {
      const path = new ArrivalPath({
        home: [330, 70, 0],
        width: 350,
        height: material === "parchment" ? 700 : 230,
        start: 31,
        flight: 1.1,
        material,
        index: 2,
      });
      const final = path.at(34.3);
      expect(final.holds, material).toEqual([1, 1, 1, 1]);
      expect(Math.hypot(...path.captures[0].velocity), material).toBeGreaterThan(500);
      expect(Math.hypot(...final.position.map((v, i) => v - path.spec.home[i])), material).toBeLessThan(0.05);
      expect(Math.hypot(...eulerFromOrientation(final.orientation)), material).toBeLessThan(0.001);
      expect(Math.hypot(...final.velocity), material).toBeLessThan(0.1);
    }
  });
  it("dissipates kinetic plus stored support energy after capture when airflow is disabled", () => {
    const path = new ArrivalPath(
      { home: [200, 0, 0], width: 380, height: 250, start: 31, flight: 1.1, material: "card", index: 1 },
      () => [0, 0, 0],
    );
    path.at(34);
    const lastContact = Math.max(...path.captures.map((c) => c.time));
    const energy = (t: number) => {
      const e = path.energy(path.at(t));
      return e.kinetic + e.potential;
    };
    expect(energy(lastContact + 0.6)).toBeLessThan(energy(lastContact + 0.2) * 0.04);
    expect(energy(lastContact + 1)).toBeLessThan(energy(lastContact + 0.6) * 0.04);
  });
  it("preserves event times and state across reverse and fractional seeks", () => {
    const spec = {
      home: [330, 70, 0] as [number, number, number],
      width: 350,
      height: 230,
      start: 31,
      flight: 1.1,
      material: "card" as const,
      index: 2,
    };
    const a = new ArrivalPath(spec),
      b = new ArrivalPath(spec);
    for (let t = 31; t < 34.3; t += 1 / 37) a.at(t);
    for (const t of [33.47, 31.1, 32.193, 34.3]) expect(a.at(t)).toEqual(b.at(t));
    expect(a.captures).toEqual(b.captures);
  });
});
