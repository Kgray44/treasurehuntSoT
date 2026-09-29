import { ConstrainedSheet, type SheetContact } from "./cloth";
import { CUT, camera, composition, focusPose, wind } from "./program";
import { eyePosition, rotateEuler, type Point3 } from "./projection";

/** Alpha comes from the very canvas uploaded as the visible title texture.
 * Canvas rows are top-down; all material/glyph UVs here are bottom-up. */
export type GlyphMask = { width: number; height: number; alpha: Uint8Array };
export type SnagSpec = { viewport: { width: number; height: number }; aspect: number; glyph: GlyphMask };
export type SnagContact = { time: number; uv: [number, number]; velocity: Point3; point: Point3 };
export type SnagCache = {
  initialVelocity: Point3;
  contact: SnagContact | null;
  sheet: { samples: Float32Array; limitedSteps: number };
};
export const SNAG_PIN: [number, number] = [0.28, 0.75];
export const SNAG_BIRTH = CUT.catch - 0.9;
const THICKNESS = 0.45;
export function glyphAlpha(mask: GlyphMask, uv: readonly number[]) {
  const x = Math.floor(uv[0] * mask.width),
    y = Math.floor((1 - uv[1]) * mask.height);
  return x < 0 || y < 0 || x >= mask.width || y >= mask.height ? 0 : mask.alpha[y * mask.width + x];
}
export function findGlyphContact(mask: GlyphMask): [number, number] {
  let best = Infinity,
    result: [number, number] | null = null;
  // Two-pixel erosion excludes antialias fringes: contact must land on ink.
  for (let y = 2; y < mask.height - 2; y++)
    for (let x = 2; x < mask.width - 2; x++) {
      if ([-2, 0, 2].some((dy) => [-2, 0, 2].some((dx) => mask.alpha[(y + dy) * mask.width + x + dx] < 230))) continue;
      const uv: [number, number] = [(x + 0.5) / mask.width, 1 - (y + 0.5) / mask.height];
      const distance = (uv[0] - 0.59) ** 2 + (uv[1] - 0.43) ** 2;
      if (distance < best) {
        best = distance;
        result = uv;
      }
    }
  if (!result) throw new Error("Title has no opaque contact region");
  return result;
}

/** Direct, world-space constrained paper. Initial-condition shooting composes
 * the approach, then wind and the measured glyph collision own all motion.
 * Capture changes only the caught material point. Release removes that one
 * constraint; no position, orientation, velocity, or shape is reset. */
export class TitleSnag {
  readonly size: number;
  readonly sheet: ConstrainedSheet;
  readonly targetUV: [number, number];
  readonly initialVelocity: Point3;
  contact: SnagContact | null = null;
  private readonly origin: Point3;
  constructor(
    readonly spec: SnagSpec,
    cache?: SnagCache,
  ) {
    this.size = 450 * composition(spec.viewport.width, spec.viewport.height).hero;
    this.targetUV = findGlyphContact(spec.glyph);
    const eye = eyePosition(camera(SNAG_BIRTH));
    const target = this.glyphPoint(CUT.catch, this.targetUV);
    this.origin = [
      target[0] - 340 * composition(spec.viewport.width, spec.viewport.height).spread,
      target[1] + 270,
      eye[2] + 260,
    ];
    this.initialVelocity = cache?.initialVelocity ?? (target.map((v, i) => (v - this.origin[i]) / 0.9) as Point3);
    if (!cache) {
      for (let pass = 0; pass < 5; pass++) {
        const shot = this.makeSheet(false),
          frame = shot.at(CUT.catch),
          pin = shot.pins[0] * 3;
        for (let k = 0; k < 3; k++) this.initialVelocity[k] += (target[k] - frame.positions[pin + k]) / 0.9;
      }
    }
    this.sheet = this.makeSheet(true);
    if (cache) {
      this.contact = cache.contact;
      this.sheet.importCache(cache.sheet);
    }
  }
  glyphPoint(time: number, uv: readonly number[]): Point3 {
    const pose = focusPose(time, this.spec.viewport.width, this.spec.viewport.height);
    const local = rotateEuler(
      [(uv[0] - 0.5) * pose.size, ((uv[1] - 0.5) * pose.size * 620) / 1800, THICKNESS],
      pose.rotation,
    );
    return local.map((v, k) => v + pose.position[k]) as Point3;
  }
  private makeSheet(collide: boolean) {
    let sheet: ConstrainedSheet;
    sheet = new ConstrainedSheet(
      this.size,
      this.size * this.spec.aspect,
      "paper",
      [SNAG_PIN],
      (time) => ({ air: [0, 0, 0], holds: [0], worldAir: (point) => wind(time, point) }),
      SNAG_BIRTH,
      {
        initial: (rest) => ({
          position: rest.map(
            (v, k) =>
              v +
              this.origin[k] -
              (k === 0
                ? (SNAG_PIN[0] - 0.5) * this.size
                : k === 1
                  ? (SNAG_PIN[1] - 0.5) * this.size * this.spec.aspect
                  : 0),
          ) as Point3,
          velocity: [...this.initialVelocity],
        }),
        contacts: (time, predicted, previous) => {
          if (!collide) return [];
          const id = sheet.pins[0],
            at = id * 3;
          const pose = focusPose(time, this.spec.viewport.width, this.spec.viewport.height);
          const before = focusPose(time - 1 / 120, this.spec.viewport.width, this.spec.viewport.height);
          if (!this.contact && time < CUT.peel) {
            const z0 = previous[at + 2] - before.position[2] - THICKNESS;
            const z1 = predicted[at + 2] - pose.position[2] - THICKNESS;
            if (z0 >= 0 && z1 <= 0) {
              const fraction = z0 / Math.max(1e-9, z0 - z1);
              const hitTime = time - (1 - fraction) / 120;
              const hitPose = focusPose(hitTime, this.spec.viewport.width, this.spec.viewport.height);
              const point = [0, 1, 2].map(
                (k) => previous[at + k] + (predicted[at + k] - previous[at + k]) * fraction,
              ) as Point3;
              const uv: [number, number] = [
                0.5 + (point[0] - hitPose.position[0]) / hitPose.size,
                0.5 + (point[1] - hitPose.position[1]) / ((hitPose.size * 620) / 1800),
              ];
              if (glyphAlpha(this.spec.glyph, uv) >= 230)
                this.contact = {
                  time: hitTime,
                  uv,
                  point,
                  velocity: [0, 1, 2].map((k) => (predicted[at + k] - previous[at + k]) * 120) as Point3,
                };
            }
          }
          const result: SheetContact[] =
            this.contact && time < CUT.peel ? [{ vertex: id, point: this.glyphPoint(time, this.contact.uv) }] : [];
          for (let vertex = 0; vertex < predicted.length / 3; vertex++) {
            if (vertex === id && result.length) continue;
            const j = vertex * 3;
            if (previous[j + 2] < before.position[2] - 0.01 || predicted[j + 2] >= pose.position[2] + THICKNESS)
              continue;
            const uv = [
              0.5 + (predicted[j] - pose.position[0]) / pose.size,
              0.5 + (predicted[j + 1] - pose.position[1]) / ((pose.size * 620) / 1800),
            ];
            if (glyphAlpha(this.spec.glyph, uv) >= 230)
              result.push({
                vertex,
                point: [predicted[j], predicted[j + 1], pose.position[2] + THICKNESS],
                normal: [0, 0, 1],
              });
          }
          return result;
        },
      },
    );
    return sheet;
  }
  prepare(end = CUT.room) {
    this.sheet.at(end);
  }
  exportCache(): SnagCache {
    return { initialVelocity: this.initialVelocity, contact: this.contact, sheet: this.sheet.exportCache() };
  }
  inspect(time: number) {
    const frame = this.sheet.at(time),
      pin = this.sheet.pins[0] * 3;
    return {
      contact: this.contact,
      strain: this.sheet.strain(frame),
      pin: Array.from(frame.positions.subarray(pin, pin + 3)),
      velocity: Array.from(frame.velocities.subarray(pin, pin + 3)),
      held: !!this.contact && time >= this.contact.time && time < CUT.peel,
      point: this.contact ? this.glyphPoint(time, this.contact.uv) : null,
      nearestZ: Math.max(...frame.positions.filter((_, i) => i % 3 === 2)),
    };
  }
}
