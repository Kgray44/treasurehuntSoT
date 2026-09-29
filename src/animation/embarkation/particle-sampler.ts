import { camera, composition, CUT, materialPath, atmosphericDepth, stormEnergy, type Actor } from "./program";
import { FOCAL } from "./projection";

export function particleFrame(time: number, width: number, height: number) {
  const eye = camera(time);
  return {
    time,
    spread: composition(width, height).spread,
    z: eye.position[2],
    storm: stormEnergy(time),
    c: Math.cos(eye.roll),
    s: Math.sin(eye.roll),
  };
}

/** Billboard presentation of the shared aerodynamic cache. It omits unused
 * Euler/bending data, not physics. Cache identity is tied to the actor array;
 * the array is replaced when seed/material preparation changes. */
export class ParticleSampler {
  private path;
  private origin;
  private motion = new Float64Array(6);
  constructor(readonly actor: Actor) {
    if (actor.hero || (actor.layer !== "particles" && actor.layer !== "spray"))
      throw new Error("Particle sampler requires an unsteered billboard");
    this.path = materialPath(actor);
    this.origin = camera(actor.birth).position;
  }
  write(frame: ReturnType<typeof particleFrame>, output: Float32Array, offset: number) {
    const a = this.actor,
      age = frame.time - a.birth;
    if (age < 0 || frame.time >= CUT.room) return false;
    const p = this.motion;
    this.path.writeTranslation(age, p);
    const distance = frame.z - p[2],
      d = FOCAL + distance;
    if (d < -a.size || d > 26000 || this.origin[2] - p[2] > 48000) return false;
    let alpha = a.layer === "spray" ? frame.storm : 1;
    if (a.id.startsWith("particle-")) alpha *= 0.28 + 0.72 * frame.storm;
    if (a.layer === "particles") alpha *= 0.48 + 0.24 * Math.sin(age * 3 + a.phase) ** 2;
    alpha *= atmosphericDepth(distance);
    if (alpha < 0.001) return false;
    output[offset] = this.origin[0] + (p[0] - this.origin[0]) * frame.spread;
    output[offset + 1] = p[1];
    output[offset + 2] = p[2];
    output[offset + 3] = a.size;
    output[offset + 4] = a.layer === "spray" ? frame.c * p[3] * frame.spread + frame.s * p[4] : 0;
    output[offset + 5] = a.layer === "spray" ? -frame.s * p[3] * frame.spread + frame.c * p[4] : 0;
    output[offset + 6] = alpha;
    output[offset + 7] = a.phase;
    return true;
  }
}
