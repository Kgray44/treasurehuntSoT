import { describe, expect, it } from "vitest";
import {
  FlightPath,
  advanceBody,
  aerodynamicResponse,
  eulerFromOrientation,
  orient,
  orientationFromEuler,
  type BodyState,
  type BodyShape,
} from "./dynamics";
import { materials, wind } from "./program";
import { rotateEuler, type Point3 } from "./projection";
const initial = (): BodyState => ({
  position: [0, 0, 0],
  velocity: [0, 0, 0],
  orientation: [0, 0, 0, 1],
  angularVelocity: [0, 0, 0],
});
const shape: BodyShape = { material: materials.paper, pressureCenter: [0.1, 0.12, 0.02] };
describe("relative airflow and angular dynamics", () => {
  it("cannot accelerate resting matter in still air; gravity is independent", () => {
    const state = initial();
    for (let i = 0; i < 240; i++) advanceBody(state, [0, 0, 0], shape, 1 / 120);
    expect(state).toEqual(initial());
    const falling = initial();
    advanceBody(falling, [0, 0, 0], { ...shape, gravity: [0, -100, 0] }, 0.1);
    expect(falling.velocity).toEqual([0, -10, 0]);
  });
  it("responds to relative flow, including a following wind slower than the body", () => {
    const state = initial();
    state.velocity = [0, 0, -9000];
    const force = aerodynamicResponse(state, [0, 0, -4000], shape);
    expect(force.relative).toEqual([0, 0, 5000]);
    advanceBody(state, [0, 0, -4000], shape, 1 / 120);
    expect(state.velocity[2]).toBeGreaterThan(-9000);
    expect(state.velocity[2]).toBeLessThan(-4000);
    state.velocity = [30, -20, -4000];
    expect(aerodynamicResponse(state, [30, -20, -4000], shape).rate).toBe(0);
  });
  it("gives broadside paper greater pressure/drag than edge-on paper", () => {
    const broad = initial(),
      edge = initial();
    edge.orientation = orientationFromEuler([0, Math.PI / 2, 0]);
    const a = aerodynamicResponse(broad, [0, 0, -6000], shape),
      b = aerodynamicResponse(edge, [0, 0, -6000], shape);
    expect(a.rate).toBeGreaterThan(b.rate * 8);
    advanceBody(broad, [0, 0, -6000], shape, 1 / 120);
    advanceBody(edge, [0, 0, -6000], shape, 1 / 120);
    expect(-broad.velocity[2]).toBeGreaterThan(-edge.velocity[2] * 8);
  });
  it("integrates pressure torque through angular inertia, not through an age-based angle", () => {
    const light = initial(),
      heavy = initial();
    for (let i = 0; i < 12; i++) {
      advanceBody(light, [0, 0, -7000], shape, 1 / 120);
      advanceBody(heavy, [0, 0, -7000], { ...shape, material: { ...materials.paper, inertia: 6 } }, 1 / 120);
    }
    expect(Math.hypot(...light.angularVelocity)).toBeGreaterThan(Math.hypot(...heavy.angularVelocity) * 5);
    expect(Math.abs(eulerFromOrientation(light.orientation)[0])).toBeGreaterThan(0.001);
    expect(Math.hypot(...light.orientation)).toBeCloseTo(1, 12);
  });
  it("matches the geometry orientation convention", () => {
    const r: Point3 = [0.7, -0.9, 1.3],
      p: Point3 = [100, -70, 20];
    const a = orient(p, orientationFromEuler(r)),
      b = rotateEuler(p, r);
    a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 10));
    const back = rotateEuler(p, eulerFromOrientation(orientationFromEuler(r)));
    a.forEach((v, i) => expect(v).toBeCloseTo(back[i], 10));
  });
  it("has deterministic arbitrary seeking and continuous Hermite velocity", () => {
    const a = new FlightPath(9, initial(), shape, wind),
      b = new FlightPath(9, initial(), shape, wind);
    for (let t = 0; t < 2.5; t += 1 / 144) a.at(t);
    for (const t of [2.5, 0.07, 1.38, 2.3, 0.9]) expect(a.at(t)).toEqual(b.at(t));
    const t = 1.2,
      epsilon = 0.00001,
      now = a.at(t),
      before = a.at(t - epsilon),
      after = a.at(t + epsilon);
    for (let i = 0; i < 3; i++)
      expect((after.position[i] - before.position[i]) / (epsilon * 2)).toBeCloseTo(now.velocity[i], 1);
  });
  it("gives adjacent parcels coherent transport and separates outdoor flow from room shelter", () => {
    const near = initial(),
      neighbor = initial();
    near.position = [100, 50, -3000];
    neighbor.position = [101, 51, -3000];
    near.velocity = wind(12, near.position);
    neighbor.velocity = wind(12, neighbor.position);
    const a = new FlightPath(12, near, shape, wind).at(1),
      b = new FlightPath(12, neighbor, shape, wind).at(1);
    expect(Math.hypot(...a.velocity.map((v, i) => v - b.velocity[i]))).toBeLessThan(20);
    expect(Math.hypot(...wind(35, [0, 0, 0]))).toBe(0);
    expect(wind(35, [0, 0, -14000])[2]).toBeLessThan(-4000);
  });
  it("preserves physical state through worker cache transfer, reverse seeks and continued integration", () => {
    for (const spherical of [true, false]) {
      const source = new FlightPath(9, initial(), { ...shape, spherical }, wind);
      source.at(2);
      const restored = new FlightPath(9, initial(), { ...shape, spherical }, wind);
      restored.importCache(structuredClone(source.exportCache()));
      for (const t of [0, 1.733, 0.4, 2.1, 2.6]) expect(restored.at(t)).toEqual(source.at(t));
    }
  });
});
