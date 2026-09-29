import { anchorPoints, type Attachment } from "./adhesion";
import type { Point3 } from "./projection";
import { airResponseRate, type AerodynamicMaterial } from "./dynamics";

export type SheetMaterial = "cloth" | "paper" | "card" | "button";
/** Limits are set before screening: paper can bend but may not become rubber.
 * Compliance has normalized-sheet units; physical coordinates remain world
 * units at the boundary. Bending and metric constraints are independent.
 * XPBD multiplier update: Macklin et al. 2016, Eq.18 (NVIDIA research).
 * https://matthias-research.github.io/pages/publications/XPBD.pdf */
export const sheetMaterials = {
  cloth: { strainLimit: 0.045, bendCompliance: 0.00008, arealMass: 0.48, damping: 1.3 },
  paper: { strainLimit: 0.015, bendCompliance: 0.000003, arealMass: 0.8, damping: 2.4 },
  card: { strainLimit: 0.006, bendCompliance: 0.00000015, arealMass: 2.6, damping: 3.7 },
  button: { strainLimit: 0.001, bendCompliance: 0, arealMass: 7, damping: 5.5 },
} as const;
export type SheetLoad = {
  /** Air relative to the moving rigid carrier, in its local axes, world units/s. */
  air: Point3;
  /** Optional affine airflow differences across one complete sheet span. */
  across?: Point3;
  along?: Point3;
  holds: readonly number[];
  /** Co-moving carrier acceleration; deformation responds to capture inertia.
   * Angular quantities use the same local basis as positions (pseudovectors). */
  frameAcceleration?: Point3;
  angularVelocity?: Point3;
  angularAcceleration?: Point3;
  supportDamping?: number;
  /** Direct world-space sheets retain bulk momentum. Air is sampled at each
   * material point; no carrier or decorative post-solve displacement exists. */
  worldAir?: (point: Point3) => Point3;
  /** Optional calibrated stock response, shared with free-flight dynamics.
   * Applied to each world-space material point, including while supported. */
  aerodynamics?: AerodynamicMaterial;
};
export type SheetContact = { vertex: number; point: Point3; normal?: Point3 };
export type SheetBoundary = {
  initial: (rest: Point3, uv: ArrayLike<number>) => { position: Point3; velocity: Point3 };
  /** Predicted/previous positions are world units. Contacts alone arrest the
   * selected vertices; all other vertices keep their integrated momentum. */
  contacts: (time: number, predicted: Float64Array, previous: Float64Array) => SheetContact[];
  /** A known rigid support motion supplies a feasible metric-preserving
   * backtracking origin. This is used only if conservative advancement is
   * necessary; it does not replace the force-integrated proposal. */
  transportReference?: (time: number, previousTime: number, point: Point3) => Point3;
};
type Edge = { a: number; b: number; rest: number; lambda: number };
type Bend = { a: number; b: number; c: number; fraction: number; lambda: Point3 };
export type SheetFrame = { positions: Float32Array; velocities: Float32Array; time: number };
const DT = 1 / 120;

/** Small constrained sheet, fixed physical ticks and cached frames. No display
 * frame or global film duration changes its integration. Dimensions, material,
 * support pattern or load authority changes require a new instance. Grid lines
 * include every authored anchor, so pin positions are exact, not nearest-node
 * approximations. There is no procedural displacement after the constraint solve. */
export class ConstrainedSheet {
  readonly uv: Float32Array;
  readonly indices: Uint16Array;
  readonly rest: Float64Array;
  readonly pins: number[];
  readonly columns: number;
  readonly rows: number;
  private positions: Float64Array;
  private velocities: Float64Array;
  private previous: Float64Array;
  private weights: Float64Array;
  private acceleration: Float64Array;
  private proposal: Float64Array;
  private admissible: Float64Array;
  private edges: Edge[] = [];
  private bends: Bend[] = [];
  private twists: Array<{ ids: [number, number, number, number]; lambda: Point3 }> = [];
  private frames: Float32Array[] = [];
  private output: SheetFrame;
  private contactPositions: Float64Array;
  private contactPrevious: Float64Array;
  private tick = 0;
  limitedSteps = 0;
  constructor(
    readonly width: number,
    readonly height: number,
    readonly material: SheetMaterial,
    readonly attachment: Attachment | readonly [number, number][],
    readonly load: (time: number) => SheetLoad,
    readonly birth = 0,
    readonly boundary?: SheetBoundary,
  ) {
    if (!(width > 0 && height > 0)) throw new Error("Sheet dimensions must be positive");
    const anchors = typeof attachment === "string" ? anchorPoints(attachment) : attachment;
    const lines = (count: number, fixed: number[]) =>
      [
        ...new Set([
          ...Array.from({ length: count }, (_, i) => i / (count - 1)).filter(
            (v) => v === 0 || v === 1 || !fixed.some((a) => Math.abs(a - v) < 0.055),
          ),
          ...fixed,
        ]),
      ].sort((a, b) => a - b);
    // Replace nearby regular lines with authored support lines. Tiny sliver
    // cells would make the distance solve needlessly ill-conditioned.
    const us = lines(
      11,
      anchors.map((p) => p[0]),
    );
    const vs = lines(
      9,
      anchors.map((p) => p[1]),
    );
    this.columns = us.length;
    this.rows = vs.length;
    const count = us.length * vs.length;
    this.uv = new Float32Array(count * 2);
    this.rest = new Float64Array(count * 3);
    for (let y = 0; y < vs.length; y++)
      for (let x = 0; x < us.length; x++) {
        const i = y * us.length + x;
        this.uv.set([us[x], vs[y]], i * 2);
        this.rest.set([us[x] - 0.5, ((vs[y] - 0.5) * height) / width, 0], i * 3);
      }
    this.pins = anchors.map(([u, v]) => vs.indexOf(v) * us.length + us.indexOf(u));
    const triangles: number[] = [];
    const edge = (a: number, b: number): Edge => ({
      a,
      b,
      rest: Math.hypot(this.rest[a * 3] - this.rest[b * 3], this.rest[a * 3 + 1] - this.rest[b * 3 + 1], 0),
      lambda: 0,
    });
    const bend = (a: number, b: number, c: number): Bend => ({
      a,
      b,
      c,
      fraction: edge(a, b).rest / edge(a, c).rest,
      lambda: [0, 0, 0],
    });
    for (let y = 0; y < vs.length; y++)
      for (let x = 0; x < us.length; x++) {
        const i = y * us.length + x;
        if (x + 1 < us.length) this.edges.push(edge(i, i + 1));
        if (y + 1 < vs.length) this.edges.push(edge(i, i + us.length));
        if (x + 1 < us.length && y + 1 < vs.length) {
          const j = i + us.length;
          this.edges.push(edge(i, j + 1), edge(i + 1, j));
          triangles.push(i, i + 1, j, j, i + 1, j + 1);
          this.twists.push({ ids: [i, i + 1, j, j + 1], lambda: [0, 0, 0] });
        }
        if (x + 2 < us.length) this.bends.push(bend(i, i + 1, i + 2));
        if (y + 2 < vs.length) this.bends.push(bend(i, i + us.length, i + us.length * 2));
      }
    this.indices = new Uint16Array(triangles);
    this.positions = this.rest.slice();
    this.velocities = new Float64Array(count * 3);
    this.previous = new Float64Array(count * 3);
    this.acceleration = new Float64Array(count * 3);
    this.proposal = new Float64Array(count * 3);
    this.admissible = new Float64Array(count * 3);
    this.weights = new Float64Array(count).fill(1);
    this.output = { positions: new Float32Array(count * 3), velocities: new Float32Array(count * 3), time: birth };
    this.contactPositions = new Float64Array(count * 3);
    this.contactPrevious = new Float64Array(count * 3);
    if (boundary)
      for (let i = 0; i < count; i++) {
        const initial = boundary.initial(
          Array.from(this.rest.subarray(i * 3, i * 3 + 3), (v) => v * width) as Point3,
          this.uv.subarray(i * 2, i * 2 + 2),
        );
        for (let k = 0; k < 3; k++) {
          this.positions[i * 3 + k] = initial.position[k] / width;
          this.velocities[i * 3 + k] = initial.velocity[k] / width;
        }
      }
    this.save();
  }
  private save() {
    const frame = new Float32Array(this.positions.length * 2);
    frame.set(this.positions);
    frame.set(this.velocities, this.positions.length);
    this.frames.push(frame);
  }
  private constrain(edges: Edge[], compliance: number, reverse = false, p = this.positions) {
    const w = this.weights,
      alpha = compliance / (DT * DT);
    for (let n = 0; n < edges.length; n++) {
      const e = edges[reverse ? edges.length - n - 1 : n];
      const a = e.a * 3,
        b = e.b * 3,
        wa = w[e.a],
        wb = w[e.b];
      if (wa + wb === 0) continue;
      const dx = p[a] - p[b],
        dy = p[a + 1] - p[b + 1],
        dz = p[a + 2] - p[b + 2];
      const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (length < 1e-12) continue;
      const delta = (-(length - e.rest) - alpha * e.lambda) / (wa + wb + alpha);
      e.lambda += delta;
      const scale = delta / length;
      p[a] += wa * scale * dx;
      p[a + 1] += wa * scale * dy;
      p[a + 2] += wa * scale * dz;
      p[b] -= wb * scale * dx;
      p[b + 1] -= wb * scale * dy;
      p[b + 2] -= wb * scale * dz;
    }
  }
  private maximumStrain(p: Float32Array | Float64Array) {
    let max = 0;
    for (const e of this.edges) {
      const a = e.a * 3,
        b = e.b * 3;
      const dx = p[a] - p[b],
        dy = p[a + 1] - p[b + 1],
        dz = p[a + 2] - p[b + 2];
      max = Math.max(max, Math.abs(Math.sqrt(dx * dx + dy * dy + dz * dz) / e.rest - 1));
    }
    return max;
  }
  private bend(compliance: number, reverse: boolean) {
    const p = this.positions,
      w = this.weights,
      alpha = compliance / (DT * DT);
    for (let i = 0; i < this.bends.length; i++) {
      const e = this.bends[reverse ? this.bends.length - i - 1 : i],
        a = e.a * 3,
        b = e.b * 3,
        c = e.c * 3;
      const ca = -(1 - e.fraction),
        cc = -e.fraction;
      const weight = w[e.a] * ca * ca + w[e.b] + w[e.c] * cc * cc;
      if (weight === 0) continue;
      for (let k = 0; k < 3; k++) {
        const curvature = ca * p[a + k] + p[b + k] + cc * p[c + k];
        const delta = (-curvature - alpha * e.lambda[k]) / (weight + alpha);
        e.lambda[k] += delta;
        p[a + k] += w[e.a] * ca * delta;
        p[b + k] += w[e.b] * delta;
        p[c + k] += w[e.c] * cc * delta;
      }
    }
    // Mixed curvature: every rectangular rest cell is a parallelogram even
    // when anchor grid spacing is irregular. Three diagonal vertices need not
    // be collinear, so a zero-curvature diagonal triplet would bias rest shape.
    const coefficients = [1, -1, -1, 1];
    for (const e of this.twists) {
      const weight = e.ids.reduce((sum, id) => sum + w[id], 0);
      if (weight === 0) continue;
      for (let k = 0; k < 3; k++) {
        let curvature = 0;
        for (let j = 0; j < 4; j++) curvature += coefficients[j] * p[e.ids[j] * 3 + k];
        const delta = (-curvature - alpha * e.lambda[k]) / (weight + alpha);
        e.lambda[k] += delta;
        for (let j = 0; j < 4; j++) p[e.ids[j] * 3 + k] += w[e.ids[j]] * coefficients[j] * delta;
      }
    }
  }
  private step() {
    const time = this.birth + (this.tick + 1) * DT,
      load = this.load(time),
      config = sheetMaterials[this.material];
    const p = this.positions,
      v = this.velocities,
      n = this.weights.length;
    this.previous.set(p);
    this.weights.fill(1);
    let held = 0;
    for (let i = 0; i < this.pins.length; i++)
      if (load.holds[i] > 0) {
        const pin = this.pins[i];
        this.weights[pin] = 0;
        held++;
        for (let axis = 0; axis < 3; axis++) p[pin * 3 + axis] = this.rest[pin * 3 + axis];
      }
    const mean = [0, 0, 0];
    for (let i = 0; i < n; i++) {
      const x = i % this.columns,
        y = Math.floor(i / this.columns);
      const l = (x ? i - 1 : i) * 3,
        r = (x + 1 < this.columns ? i + 1 : i) * 3;
      const b = (y ? i - this.columns : i) * 3,
        t = (y + 1 < this.rows ? i + this.columns : i) * 3;
      const tx = p[r] - p[l],
        ty = p[r + 1] - p[l + 1],
        tz = p[r + 2] - p[l + 2];
      const sx = p[t] - p[b],
        sy = p[t + 1] - p[b + 1],
        sz = p[t + 2] - p[b + 2];
      const normal = [ty * sz - tz * sy, tz * sx - tx * sz, tx * sy - ty * sx];
      const length = Math.hypot(...normal) || 1;
      for (let k = 0; k < 3; k++) normal[k] /= length;
      const suppliedAir =
        load.worldAir?.([p[i * 3] * this.width, p[i * 3 + 1] * this.width, p[i * 3 + 2] * this.width]) ?? load.air;
      const air = suppliedAir.map(
        (a, k) =>
          a +
          (load.across?.[k] ?? 0) * (this.uv[i * 2] - 0.5) +
          (load.along?.[k] ?? 0) * (this.uv[i * 2 + 1] - 0.5) -
          v[i * 3 + k] * this.width,
      );
      const cross = (a: Point3, b: Point3): Point3 => [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
      ];
      const arm: Point3 = [p[i * 3] * this.width, p[i * 3 + 1] * this.width, p[i * 3 + 2] * this.width];
      const omega = load.angularVelocity ?? [0, 0, 0],
        spin = cross(omega, arm);
      for (let k = 0; k < 3; k++) air[k] -= spin[k];
      const euler = cross(load.angularAcceleration ?? [0, 0, 0], arm),
        centrifugal = cross(omega, spin);
      const coriolis = cross(omega, [v[i * 3] * this.width, v[i * 3 + 1] * this.width, v[i * 3 + 2] * this.width]);
      const normalSpeed = air[0] * normal[0] + air[1] * normal[1] + air[2] * normal[2];
      const pressure = (normalSpeed * Math.abs(normalSpeed)) / 36000000;
      const entrainment = load.aerodynamics
        ? -Math.expm1(-airResponseRate(air as Point3, normal as Point3, load.aerodynamics).rate * DT) / DT
        : undefined;
      for (let k = 0; k < 3; k++) {
        const inertia = ((load.frameAcceleration?.[k] ?? 0) + euler[k] + centrifugal[k] + 2 * coriolis[k]) / this.width;
        const tangential = load.worldAir
          ? (((air[k] - normalSpeed * normal[k]) * Math.hypot(...air)) / 36000000) * 0.08
          : 0;
        const value =
          (entrainment === undefined
            ? (1200 / (this.width * config.arealMass)) * (pressure * normal[k] + tangential)
            : (air[k] * entrainment) / this.width) - inertia;
        this.acceleration[i * 3 + k] = value;
        mean[k] += value / n;
      }
    }
    // Once no support remains, the FlightPath carries bulk acceleration. This
    // co-moving shape solver retains only differential load and bending.
    const decay = Math.exp(-((load.worldAir ? 0 : config.damping) + (load.supportDamping ?? 0)) * DT);
    for (let i = 0; i < n; i++)
      for (let k = 0; k < 3; k++) {
        const j = i * 3 + k;
        if (this.weights[i]) {
          v[j] = v[j] * decay + (this.acceleration[j] - (held || load.worldAir ? 0 : mean[k])) * DT;
          p[j] += v[j] * DT;
        } else v[j] = 0;
      }
    const contacts = this.boundary
      ? (() => {
          for (let j = 0; j < p.length; j++) {
            this.contactPositions[j] = p[j] * this.width;
            this.contactPrevious[j] = this.previous[j] * this.width;
          }
          return this.boundary.contacts(time, this.contactPositions, this.contactPrevious);
        })()
      : [];
    const targets = new Map<number, Point3>();
    for (const contact of contacts) {
      if (contact.normal) continue;
      this.weights[contact.vertex] = 0;
      targets.set(contact.vertex, contact.point);
      for (let axis = 0; axis < 3; axis++) p[contact.vertex * 3 + axis] = contact.point[axis] / this.width;
    }
    // Unilateral letter-face contacts constrain only the normal direction.
    // Paper remains free to slide across a stroke and off its alpha boundary.
    const planes = contacts.filter((contact) => contact.normal);
    const projectPlanes = (positions: Float64Array) => {
      for (const { vertex, point, normal } of planes) {
        const at = vertex * 3;
        const distance = normal!.reduce((sum, n, k) => sum + n * (positions[at + k] - point[k] / this.width), 0);
        // One caught point leaves rigid rotation as an exact metric null mode.
        // Use it to resolve a face contact before local distance projections;
        // otherwise thousands of edge sweeps can stall in a folded configuration.
        // This rotates existing geometry, never rebuilds it from a rest pose.
        if (distance < -1e-10 && targets.size === 1) {
          const anchor = [...targets.values()][0].map((v) => v / this.width);
          const planeDistance = normal!.reduce((sum, n, k) => sum + n * (anchor[k] - point[k] / this.width), 0);
          if (Math.abs(planeDistance) < 1e-8) {
            const arm = [0, 1, 2].map((k) => positions[at + k] - anchor[k]);
            const axial = arm.reduce((sum, v, k) => sum + v * normal![k], 0);
            const axis = [
              arm[1] * normal![2] - arm[2] * normal![1],
              arm[2] * normal![0] - arm[0] * normal![2],
              arm[0] * normal![1] - arm[1] * normal![0],
            ];
            const length = Math.hypot(...axis);
            if (length > 1e-9) {
              for (let k = 0; k < 3; k++) axis[k] /= length;
              const angle = Math.atan2(-axial, length),
                c = Math.cos(angle),
                s = Math.sin(angle);
              for (let j = 0; j < positions.length; j += 3) {
                const v = [0, 1, 2].map((k) => positions[j + k] - anchor[k]);
                const cross = [
                  axis[1] * v[2] - axis[2] * v[1],
                  axis[2] * v[0] - axis[0] * v[2],
                  axis[0] * v[1] - axis[1] * v[0],
                ];
                const dot = axis.reduce((sum, a, k) => sum + a * v[k], 0);
                for (let k = 0; k < 3; k++)
                  positions[j + k] = anchor[k] + v[k] * c + cross[k] * s + axis[k] * dot * (1 - c);
              }
              continue;
            }
          }
        }
        if (distance < 0) for (let k = 0; k < 3; k++) positions[at + k] -= normal![k] * distance;
      }
    };
    for (const e of this.edges) e.lambda = 0;
    for (const e of this.bends) e.lambda.fill(0);
    for (const e of this.twists) e.lambda.fill(0);
    for (let iteration = 0; iteration < 24; iteration++) {
      this.bend(config.bendCompliance, !!(iteration % 2));
      this.constrain(this.edges, 0, !!(iteration % 2));
      projectPlanes(p);
    }
    // Metric projection is independent of bending compliance. Convergence is
    // evaluated against the predeclared material limit, never hidden by a warp.
    for (let block = 0; block < 12 && this.maximumStrain(p) > config.strainLimit * 0.35; block++)
      for (let i = 0; i < 8; i++) {
        this.constrain(this.edges, 0, !!(i % 2));
        projectPlanes(p);
      }
    if (this.maximumStrain(p) > config.strainLimit * 0.8) {
      // Conservative advancement if the nonlinear solve has not converged
      // inside its bounded work budget. Restrict the step along its physical
      // velocity; never accept a stretched sheet and mask it with shading.
      this.proposal.set(p);
      this.admissible.set(this.previous);
      if (targets.size && this.boundary?.transportReference)
        for (let i = 0; i < n; i++) {
          const point = this.boundary.transportReference(
            time,
            time - DT,
            Array.from(this.previous.subarray(i * 3, i * 3 + 3), (value) => value * this.width) as Point3,
          );
          for (let k = 0; k < 3; k++) this.admissible[i * 3 + k] = point[k] / this.width;
        }
      // A newly acquired support changes the constraint manifold. The old
      // unpinned frame is not a feasible backtracking origin: interpolating
      // toward it releases the captured vertex again and can stall forever.
      // Project that reference onto the new fixed supports and metric first.
      for (let i = 0; i < n; i++)
        if (!this.weights[i])
          for (let axis = 0; axis < 3; axis++)
            this.admissible[i * 3 + axis] = targets.has(i)
              ? targets.get(i)![axis] / this.width
              : this.rest[i * 3 + axis];
      projectPlanes(this.admissible);
      // A newly caught, narrow card may need more than 512 local sweeps to
      // propagate its third support through the sheet. This work is cached in
      // the preparation worker; retain the physical limits instead of failing
      // the whole cinematic at a responsive layout's particular aspect ratio.
      for (let block = 0; block < 1024 && this.maximumStrain(this.admissible) > config.strainLimit * 0.35; block++)
        for (let sweep = 0; sweep < 8; sweep++) {
          this.constrain(this.edges, 0, !!(sweep % 2), this.admissible);
          projectPlanes(this.admissible);
        }
      if (this.maximumStrain(this.admissible) > config.strainLimit * 0.8)
        throw new Error(
          `New support metric projection did not converge at ${time}: strain ${this.maximumStrain(this.admissible)}, contacts ${contacts.length}`,
        );
      let low = 0,
        high = 1;
      for (let trial = 0; trial < 12; trial++) {
        const fraction = (low + high) / 2;
        for (let j = 0; j < p.length; j++)
          p[j] = this.admissible[j] + (this.proposal[j] - this.admissible[j]) * fraction;
        if (this.maximumStrain(p) < config.strainLimit * 0.8) low = fraction;
        else high = fraction;
      }
      for (let j = 0; j < p.length; j++) p[j] = this.admissible[j] + (this.proposal[j] - this.admissible[j]) * low;
      this.limitedSteps++;
    }
    for (let j = 0; j < p.length; j++)
      v[j] = this.weights[Math.floor(j / 3)] || targets.has(Math.floor(j / 3)) ? (p[j] - this.previous[j]) / DT : 0;
    this.tick++;
    this.save();
  }
  at(time: number): SheetFrame {
    const age = Math.max(0, time - this.birth);
    if (age > 36) throw new Error("Sheet query exceeds physical cache horizon");
    const frame = age / DT,
      a = Math.floor(frame + 1e-8),
      b = Math.ceil(frame - 1e-8),
      mix = frame - a;
    while (this.tick < b) this.step();
    const pa = this.frames[a],
      pb = this.frames[b],
      n = this.positions.length;
    for (let j = 0; j < n; j++) {
      this.output.positions[j] = (pa[j] * (1 - mix) + pb[j] * mix) * this.width;
      this.output.velocities[j] = (pa[j + n] * (1 - mix) + pb[j + n] * mix) * this.width;
    }
    this.output.time = time;
    return this.output;
  }
  strain(frame: SheetFrame) {
    const values = this.edges
      .map((e) => {
        const a = e.a * 3,
          b = e.b * 3,
          p = frame.positions;
        return Math.abs(Math.hypot(p[a] - p[b], p[a + 1] - p[b + 1], p[a + 2] - p[b + 2]) / (e.rest * this.width) - 1);
      })
      .sort((a, b) => a - b);
    return {
      max: values.at(-1)!,
      p95: values[Math.floor(values.length * 0.95)],
      median: values[Math.floor(values.length * 0.5)],
    };
  }
  get bytes() {
    return this.frames.reduce((n, f) => n + f.byteLength, 0);
  }
  get lastTime() {
    return this.birth + this.tick * DT;
  }
  exportCache() {
    const samples = new Float32Array(this.frames.length * this.positions.length * 2);
    this.frames.forEach((frame, i) => samples.set(frame, i * frame.length));
    return { samples, limitedSteps: this.limitedSteps };
  }
  importCache(cache: { samples: Float32Array; limitedSteps: number }) {
    const stride = this.positions.length * 2;
    if (cache.samples.length < stride || cache.samples.length % stride)
      throw new Error("Sheet cache topology mismatch");
    this.frames = Array.from({ length: cache.samples.length / stride }, (_, i) =>
      cache.samples.subarray(i * stride, (i + 1) * stride),
    );
    this.tick = this.frames.length - 1;
    this.positions.set(this.frames[this.tick].subarray(0, this.positions.length));
    this.velocities.set(this.frames[this.tick].subarray(this.positions.length));
    this.limitedSteps = cache.limitedSteps;
  }
}
