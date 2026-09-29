import { type Point3 } from "./projection";

/** Aerodynamic coefficients use normalized art mass/area/inertia. Linear
 * positions/velocities are world units and units/second; rotation is radians.
 * REFERENCE_AIR_SPEED is a coefficient calibration, never a target speed. */
const REFERENCE_AIR_SPEED = 6000;
export type AirField = (time: number, position: Point3) => Point3;
export type AerodynamicMaterial = { mass: number; area: number; drag: number; inertia: number; coupling: number };
export type Quaternion = [number, number, number, number];
export type BodyState = { position: Point3; velocity: Point3; orientation: Quaternion; angularVelocity: Point3 };
export type BodyShape = {
  material: AerodynamicMaterial;
  pressureCenter: Point3;
  spherical?: boolean;
  gravity?: Point3;
};
/** The same orientation-dependent relative-flow law drives rigid bodies and
 * material points. The area/mass ratio is unchanged by subdividing a sheet. */
export function airResponseRate(relative: Point3, normal: Point3, material: AerodynamicMaterial, spherical = false) {
  const speed = Math.hypot(...relative);
  const incidence = Math.abs(relative.reduce((sum, value, i) => sum + value * normal[i], 0)) / Math.max(speed, 1e-12);
  const projectedArea = spherical ? 1 : 0.08 + 0.92 * incidence;
  return {
    speed,
    projectedArea,
    rate:
      ((material.area * material.drag * material.coupling) / material.mass) *
      (speed / REFERENCE_AIR_SPEED) *
      projectedArea,
  };
}
const dot = (a: Point3, b: Point3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Point3, b: Point3): Point3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

export function orientationFromEuler(r: Point3): Quaternion {
  const [sx, sy, sz] = r.map((v) => Math.sin(v / 2)),
    [cx, cy, cz] = r.map((v) => Math.cos(v / 2));
  return [
    sx * cy * cz - cx * sy * sz,
    cx * sy * cz + sx * cy * sz,
    cx * cy * sz - sx * sy * cz,
    cx * cy * cz + sx * sy * sz,
  ];
}
export function orient(p: Point3, q: Quaternion): Point3 {
  const t = cross([q[0], q[1], q[2]], p).map((v) => 2 * v) as Point3;
  const c = cross([q[0], q[1], q[2]], t);
  return p.map((v, i) => v + q[3] * t[i] + c[i]) as Point3;
}
export function eulerFromOrientation(q: Quaternion): Point3 {
  const [x, y, z, w] = q;
  return [
    Math.atan2(2 * (w * x + y * z), 1 - 2 * (x * x + y * y)),
    Math.asin(Math.max(-1, Math.min(1, 2 * (w * y - z * x)))),
    Math.atan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z)),
  ];
}
export function aerodynamicResponse(state: BodyState, air: Point3, shape: BodyShape) {
  const relative = air.map((v, i) => v - state.velocity[i]) as Point3;
  const normal = orient([0, 0, 1], state.orientation);
  const { speed, rate, projectedArea } = airResponseRate(relative, normal, shape.material, shape.spherical);
  const direction = relative.map((v) => v / Math.max(speed, 1e-12)) as Point3;
  const pressure = (speed * speed) / (REFERENCE_AIR_SPEED * REFERENCE_AIR_SPEED);
  const m = shape.material;
  const lever = orient(shape.pressureCenter, state.orientation);
  const torque = cross(lever, direction).map((v) => v * pressure * m.area * m.drag * m.coupling * 24) as Point3;
  // Pressure alignment and off-center pressure both act through angular inertia.
  const alignment = cross(normal, direction),
    face = dot(normal, direction);
  for (let i = 0; i < 3; i++) torque[i] += alignment[i] * face * pressure * m.area * 0.7;
  return { relative, speed, rate, projectedArea, torque };
}

export function advanceBody(state: BodyState, air: Point3, shape: BodyShape, dt: number) {
  const force = aerodynamicResponse(state, air, shape);
  // Exact local relaxation is stable even for low-mass aerosol droplets. It
  // has no forward floor: u=v produces zero acceleration in every direction.
  const entrainment = 1 - Math.exp(-force.rate * dt);
  for (let i = 0; i < 3; i++) {
    const before = state.velocity[i];
    state.velocity[i] += force.relative[i] * entrainment + (shape.gravity?.[i] ?? 0) * dt;
    state.position[i] += (before + state.velocity[i]) * 0.5 * dt;
  }
  if (shape.spherical) return;
  const damping = Math.exp(-(0.18 + (force.speed / REFERENCE_AIR_SPEED) * 0.65) * dt);
  for (let i = 0; i < 3; i++)
    state.angularVelocity[i] = (state.angularVelocity[i] + (force.torque[i] / shape.material.inertia) * dt) * damping;
  const [wx, wy, wz] = state.angularVelocity,
    [x, y, z, w] = state.orientation;
  const q: Quaternion = [
    x + dt * 0.5 * (wx * w + wy * z - wz * y),
    y + dt * 0.5 * (-wx * z + wy * w + wz * x),
    z + dt * 0.5 * (wx * y - wy * x + wz * w),
    w - dt * 0.5 * (wx * x + wy * y + wz * z),
  ];
  const norm = Math.hypot(...q);
  for (let i = 0; i < 4; i++) state.orientation[i] = q[i] / norm;
}

/** Fixed 120 Hz integration / 30 Hz Hermite cache, extended only as queried.
 * Queries never integrate fractional steps. Reverse seeks read the same path.
 * Actor identity owns a cache; changes to dimensions/initial conditions must
 * replace it. Spherical aerosol uses six stored channels and skips torque.
 * All active intervals lie inside this 36-second physical horizon, independent
 * of DURATION or display/inspection cadence. */
export class FlightPath {
  static readonly dt = 1 / 120;
  static readonly sampleDt = 1 / 30;
  private stride: number;
  private samples: Float64Array;
  private count = 1;
  private current: BodyState;
  constructor(
    readonly birth: number,
    initial: BodyState,
    readonly shape: BodyShape,
    readonly field: AirField,
  ) {
    this.stride = shape.spherical ? 6 : 13;
    this.samples = new Float64Array(64 * this.stride);
    this.current = {
      position: [...initial.position],
      velocity: [...initial.velocity],
      orientation: [...initial.orientation],
      angularVelocity: [...initial.angularVelocity],
    };
    this.write(0);
  }
  private write(frame: number) {
    const offset = frame * this.stride;
    if (offset + this.stride > this.samples.length) {
      const next = new Float64Array(this.samples.length * 2);
      next.set(this.samples);
      this.samples = next;
    }
    this.samples.set(this.current.position, offset);
    this.samples.set(this.current.velocity, offset + 3);
    if (!this.shape.spherical) {
      this.samples.set(this.current.orientation, offset + 6);
      this.samples.set(this.current.angularVelocity, offset + 10);
    }
  }
  at(age: number): BodyState {
    if (age > 36) throw new Error("Flight query exceeds physical cache horizon");
    const frame = Math.max(0, age) / FlightPath.sampleDt,
      lower = Math.floor(frame),
      upper = Math.ceil(frame);
    while (this.count <= upper) {
      for (let sub = 0; sub < 4; sub++) {
        const time = this.birth + (this.count - 1) * FlightPath.sampleDt + sub * FlightPath.dt;
        advanceBody(this.current, this.field(time, this.current.position), this.shape, FlightPath.dt);
      }
      this.write(this.count++);
    }
    const a = lower * this.stride,
      b = upper * this.stride,
      u = frame - lower,
      dt = FlightPath.sampleDt;
    const u2 = u * u,
      u3 = u2 * u;
    const h0 = 2 * u3 - 3 * u2 + 1,
      h1 = (u3 - 2 * u2 + u) * dt,
      h2 = -2 * u3 + 3 * u2,
      h3 = (u3 - u2) * dt;
    const d0 = (6 * u2 - 6 * u) / dt,
      d1 = 3 * u2 - 4 * u + 1,
      d2 = (-6 * u2 + 6 * u) / dt,
      d3 = 3 * u2 - 2 * u;
    const position: Point3 = [0, 0, 0],
      velocity: Point3 = [0, 0, 0];
    for (let i = 0; i < 3; i++) {
      if (a === b) {
        position[i] = this.samples[a + i];
        velocity[i] = this.samples[a + i + 3];
        continue;
      }
      const p = this.samples[a + i],
        q = this.samples[b + i],
        v = this.samples[a + i + 3],
        w = this.samples[b + i + 3];
      position[i] = h0 * p + h1 * v + h2 * q + h3 * w;
      velocity[i] = d0 * p + d1 * v + d2 * q + d3 * w;
    }
    const orientation: Quaternion = [0, 0, 0, 1],
      angularVelocity: Point3 = [0, 0, 0];
    if (!this.shape.spherical) {
      let sign = 0;
      for (let i = 0; i < 4; i++) sign += this.samples[a + 6 + i] * this.samples[b + 6 + i];
      for (let i = 0; i < 4; i++)
        orientation[i] = this.samples[a + 6 + i] * (1 - u) + this.samples[b + 6 + i] * u * (sign < 0 ? -1 : 1);
      const norm = Math.hypot(...orientation);
      for (let i = 0; i < 4; i++) orientation[i] /= norm;
      for (let i = 0; i < 3; i++)
        angularVelocity[i] = this.samples[a + 10 + i] * (1 - u) + this.samples[b + 10 + i] * u;
    }
    return { position, velocity, orientation, angularVelocity };
  }
  /** Translation-only presentation query. Small billboard particles never use
   * orientation, and thousands of them should not allocate a full BodyState
   * for every shutter sample. These are the same cached Hermite segments. */
  writeTranslation(age: number, output: Float64Array) {
    if (age > 36) throw new Error("Flight query exceeds physical cache horizon");
    const frame = Math.max(0, age) / FlightPath.sampleDt;
    const lower = Math.floor(frame),
      upper = Math.ceil(frame);
    // Preparation normally owns integration. Retain arbitrary-seek correctness
    // when this entry point is used without prewarming or an imported cache.
    if (this.count <= upper) this.at(age);
    const a = lower * this.stride,
      b = upper * this.stride,
      u = frame - lower;
    const dt = FlightPath.sampleDt,
      u2 = u * u,
      u3 = u2 * u;
    const h0 = 2 * u3 - 3 * u2 + 1,
      h1 = (u3 - 2 * u2 + u) * dt;
    const h2 = -2 * u3 + 3 * u2,
      h3 = (u3 - u2) * dt;
    const d0 = (6 * u2 - 6 * u) / dt,
      d1 = 3 * u2 - 4 * u + 1;
    const d2 = (-6 * u2 + 6 * u) / dt,
      d3 = 3 * u2 - 2 * u;
    for (let i = 0; i < 3; i++) {
      const p = this.samples[a + i],
        v = this.samples[a + i + 3];
      if (a === b) {
        output[i] = p;
        output[i + 3] = v;
        continue;
      }
      const q = this.samples[b + i],
        w = this.samples[b + i + 3];
      output[i] = h0 * p + h1 * v + h2 * q + h3 * w;
      output[i + 3] = d0 * p + d1 * v + d2 * q + d3 * w;
    }
  }
  get bytes() {
    return this.samples.byteLength;
  }
  exportCache() {
    return this.samples.slice(0, this.count * this.stride);
  }
  importCache(samples: Float64Array) {
    if (samples.length % this.stride || samples.length < this.stride) throw new Error("Flight cache topology mismatch");
    this.samples = samples;
    this.count = samples.length / this.stride;
    const offset = (this.count - 1) * this.stride;
    this.current.position = Array.from(samples.subarray(offset, offset + 3)) as Point3;
    this.current.velocity = Array.from(samples.subarray(offset + 3, offset + 6)) as Point3;
    if (!this.shape.spherical) {
      this.current.orientation = Array.from(samples.subarray(offset + 6, offset + 10)) as Quaternion;
      this.current.angularVelocity = Array.from(samples.subarray(offset + 10, offset + 13)) as Point3;
    }
  }
}
