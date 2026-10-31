import { ArrivalPath, type ArrivalCache, type ArrivalSpec } from "./arrival";
import { ConstrainedSheet, type SheetMaterial } from "./cloth";
import { orient, type Quaternion } from "./dynamics";
import { wind } from "./program";
import type { Point3 } from "./projection";

export type ArrivalMaterialCache = { body: ArrivalCache; sheet: { samples: Float32Array; limitedSteps: number } };
/** Co-moving elastic material carried by the integrated anchor body. The body's
 * acceleration supplies the inertial load at capture; no timed displacement or
 * decorative catch oscillation is added. Supports share its compliant motion.
 * Shape-to-body feedback is a small-deformation approximation, stated explicitly. */
export class ArrivalMaterial {
  readonly body: ArrivalPath;
  readonly sheet: ConstrainedSheet;
  constructor(
    readonly spec: ArrivalSpec,
    cache?: ArrivalMaterialCache,
  ) {
    this.body = new ArrivalPath(spec, wind, cache?.body);
    const material: SheetMaterial = spec.material === "parchment" || spec.material === "label" ? "paper" : "card";
    this.sheet = new ConstrainedSheet(
      spec.width,
      spec.height,
      material,
      [
        [0.18, 0.18],
        [0.82, 0.18],
        [0.18, 0.82],
        [0.82, 0.82],
      ],
      (time) => {
        const body = this.body.at(time),
          previous = this.body.at(Math.max(spec.start, time - 1 / 240));
        const q: Quaternion = [-body.orientation[0], -body.orientation[1], -body.orientation[2], body.orientation[3]];
        const local = (p: Point3): Point3 => {
          const v = orient(p, q);
          return [v[0], -v[1], v[2]];
        };
        // Reflecting the material's top-down Y axis reverses axial-vector parity.
        const axial = (p: Point3): Point3 => {
          const v = orient(p, q);
          return [-v[0], v[1], -v[2]];
        };
        const flow = wind(time, body.position);
        const difference = (p: Point3): Point3 => {
          const offset = orient(p, body.orientation),
            other = wind(time, body.position.map((v, i) => v + offset[i]) as Point3);
          return local(other.map((v, i) => v - flow[i]) as Point3);
        };
        const held = body.holds.reduce((sum, value) => sum + value, 0) / 4;
        return {
          air: local(flow.map((v, i) => v - body.velocity[i]) as Point3),
          across: difference([spec.width, 0, 0]),
          along: difference([0, -spec.height, 0]),
          holds: body.holds,
          frameAcceleration: local(body.acceleration),
          angularVelocity: axial(body.angularVelocity),
          angularAcceleration: axial(
            body.angularVelocity.map((v, i) => (v - previous.angularVelocity[i]) * 240) as Point3,
          ),
          supportDamping: held * (spec.material === "parchment" ? 9 : spec.material === "chat" ? 14 : 11),
        };
      },
      spec.start,
    );
    if (cache) this.sheet.importCache(cache.sheet);
  }
  prepare(end: number) {
    this.sheet.at(end);
    this.body.at(end);
  }
  exportCache(): ArrivalMaterialCache {
    return { body: this.body.exportCache(), sheet: this.sheet.exportCache() };
  }
}
