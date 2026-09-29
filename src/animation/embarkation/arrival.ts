import { advanceBody, FlightPath, orient, orientationFromEuler, type BodyState, type BodyShape } from "./dynamics";
import { camera, materials, wind } from "./program";
import { eyePosition, type Point3 } from "./projection";

export type ArrivalMaterial = "parchment" | "card" | "chat" | "label";
const response = {
  parchment: { mass: 6.5, frequency: 19, damping: 0.93, rotation: 0.19 },
  card: { mass: 1.6, frequency: 25, damping: 0.91, rotation: 0.29 },
  chat: { mass: 8, frequency: 22, damping: 0.98, rotation: 0.13 },
  label: { mass: 0.7, frequency: 34, damping: 0.99, rotation: 0.32 },
} as const;
export type ArrivalSpec = {
  home: Point3;
  width: number;
  height: number;
  start: number;
  flight: number;
  material: ArrivalMaterial;
  index: number;
};
export type ArrivalFrame = BodyState & { holds: number[]; firstContact: number | null; acceleration: Point3 };
export type ArrivalCache = {
  frames: ArrivalFrame[];
  captures: Array<{ time: number; anchor: number; velocity: Point3; displacement: number }>;
};
const copy = (s: BodyState): BodyState => ({
  position: [...s.position],
  velocity: [...s.velocity],
  orientation: [...s.orientation],
  angularVelocity: [...s.angularVelocity],
});
const cross = (a: Point3, b: Point3): Point3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

/** A free integrated body enters a finite support region with momentum. Only
 * captured supports exert spring forces. No positional ease or post-catch sine
 * participates in the stop. Shooting below chooses initial velocity for the
 * authored composition; it applies no hidden force during the flight. */
export class ArrivalPath {
  static readonly dt = 1 / 240;
  readonly supports: Point3[];
  readonly targets: Point3[];
  readonly shape: BodyShape;
  readonly captures: Array<{ time: number; anchor: number; velocity: Point3; displacement: number }> = [];
  private frames: ArrivalFrame[] = [];
  private state: BodyState;
  private holds = [0, 0, 0, 0];
  private inertia: Point3;
  private firstContact: number | null = null;
  constructor(
    readonly spec: ArrivalSpec,
    readonly field = wind,
    cache?: ArrivalCache,
  ) {
    const m = response[spec.material],
      sign = spec.index % 2 ? 1 : -1;
    // A very wide label approaches its two support rails more face-on. This
    // authors an initial attitude that can physically reach both rails; a
    // narrow capture region must not magically latch a distant free corner.
    const approachAngle = m.rotation * Math.min(1, spec.height / spec.width);
    this.supports = [
      [-0.32, 0.32],
      [0.32, 0.32],
      [-0.32, -0.32],
      [0.32, -0.32],
    ].map(([x, y]) => [x * spec.width, y * spec.height, 0]);
    this.targets = this.supports.map((p) => p.map((v, i) => v + spec.home[i]) as Point3);
    this.inertia = [
      (m.mass * spec.height ** 2) / 12,
      (m.mass * spec.width ** 2) / 12,
      (m.mass * (spec.width ** 2 + spec.height ** 2)) / 12,
    ];
    this.shape = {
      material: {
        ...(spec.material === "label" || spec.material === "parchment" ? materials.paper : materials.card),
        mass: m.mass,
        area: Math.max(0.3, (spec.width * spec.height) / 100000),
        inertia: m.mass,
      },
      pressureCenter: [0.08 * sign, 0.06, 0],
    };
    if (cache) {
      if (!cache.frames.length) throw new Error("Empty arrival cache");
      this.frames = cache.frames;
      const last = cache.frames.at(-1)!;
      this.state = copy(last);
      this.holds = [...last.holds];
      this.firstContact = last.firstContact;
      this.captures.push(...cache.captures);
      return;
    }
    const eye = eyePosition(camera(spec.start));
    const position: Point3 = [
      spec.home[0] + sign * (240 + spec.width * 0.25),
      spec.home[1] + ((spec.index % 3) - 1) * 170,
      eye[2] + 250,
    ];
    const initial: BodyState = {
      position,
      velocity: spec.home.map((v, i) => (v - position[i]) / spec.flight) as Point3,
      orientation: orientationFromEuler([
        approachAngle * 0.6 * sign,
        approachAngle * sign,
        -approachAngle * 0.2 * sign,
      ]),
      angularVelocity: [0, 0, 0],
    };
    // Numerical initial-condition shooting with the same aerodynamic equation
    // used during playback. A broadside high-drag board otherwise stops short.
    for (let pass = 0; pass < 10; pass++) {
      const end = new FlightPath(spec.start, initial, this.shape, field).at(spec.flight);
      for (let i = 0; i < 3; i++) initial.velocity[i] += ((spec.home[i] - end.position[i]) * 1.2) / spec.flight;
    }
    this.state = copy(initial);
    this.frames.push({ ...copy(initial), holds: [...this.holds], firstContact: null, acceleration: [0, 0, 0] });
  }
  private step() {
    const dt = ArrivalPath.dt,
      spec = this.spec,
      time = spec.start + (this.frames.length - 1) * dt,
      config = response[spec.material];
    const state = this.state,
      before = [...state.velocity] as Point3;
    const force: Point3 = [0, 0, 0],
      torque: Point3 = [0, 0, 0];
    const radius = Math.max(22, Math.min(spec.width, spec.height) * 0.19);
    const k = (config.mass * config.frequency ** 2) / 4,
      c = (2 * config.mass * config.frequency * config.damping) / 4;
    for (let i = 0; i < 4; i++) {
      const arm = orient(this.supports[i], state.orientation);
      const delta = arm.map((v, j) => v + state.position[j] - this.targets[i][j]) as Point3;
      const spin = cross(state.angularVelocity, arm),
        pointVelocity = state.velocity.map((v, j) => v + spin[j]) as Point3;
      const distance = Math.hypot(...delta),
        closing = delta.reduce((s, v, j) => s + v * pointVelocity[j], 0) < 0;
      if (!this.holds[i] && distance <= radius && closing) {
        this.holds[i] = 1;
        this.firstContact ??= time;
        this.captures.push({ time, anchor: i, velocity: [...pointVelocity], displacement: distance });
      }
      if (!this.holds[i]) continue;
      const f = delta.map((v, j) => -k * v - c * pointVelocity[j]) as Point3,
        moment = cross(arm, f);
      for (let j = 0; j < 3; j++) {
        force[j] += f[j];
        torque[j] += moment[j];
      }
    }
    for (let j = 0; j < 3; j++) {
      state.velocity[j] += (force[j] / config.mass) * dt;
      state.angularVelocity[j] += (torque[j] / Math.max(1, this.inertia[j])) * dt;
    }
    advanceBody(state, this.field(time, state.position), this.shape, dt);
    this.frames.push({
      ...copy(state),
      holds: [...this.holds],
      firstContact: this.firstContact,
      acceleration: state.velocity.map((v, j) => (v - before[j]) / dt) as Point3,
    });
  }
  at(time: number): ArrivalFrame {
    const age = Math.max(0, time - this.spec.start);
    if (age > 8) throw new Error("Arrival query exceeds local capture horizon");
    const frame = age / ArrivalPath.dt,
      a = Math.floor(frame + 1e-8),
      b = Math.ceil(frame - 1e-8),
      u = frame - a;
    while (this.frames.length <= b) this.step();
    const p = this.frames[a],
      q = this.frames[b],
      mix = (x: number[], y: number[]) => x.map((v, i) => v + (y[i] - v) * u);
    const orientation = mix(p.orientation, q.orientation) as BodyState["orientation"],
      norm = Math.hypot(...orientation);
    for (let i = 0; i < 4; i++) orientation[i] /= norm;
    return {
      position: mix(p.position, q.position) as Point3,
      velocity: mix(p.velocity, q.velocity) as Point3,
      angularVelocity: mix(p.angularVelocity, q.angularVelocity) as Point3,
      orientation,
      acceleration: mix(p.acceleration, q.acceleration) as Point3,
      holds: [...p.holds],
      firstContact: p.firstContact,
    };
  }
  exportCache(): ArrivalCache {
    return { frames: this.frames, captures: this.captures };
  }
  energy(frame: ArrivalFrame) {
    const config = response[this.spec.material];
    let potential = 0;
    for (let i = 0; i < 4; i++)
      if (frame.holds[i]) {
        const arm = orient(this.supports[i], frame.orientation);
        potential +=
          ((config.mass * config.frequency ** 2) / 8) *
          arm.reduce((sum, v, j) => sum + (v + frame.position[j] - this.targets[i][j]) ** 2, 0);
      }
    return {
      kinetic:
        0.5 * config.mass * frame.velocity.reduce((s, v) => s + v * v, 0) +
        0.5 * frame.angularVelocity.reduce((s, v, i) => s + v * v * this.inertia[i], 0),
      potential,
    };
  }
}
