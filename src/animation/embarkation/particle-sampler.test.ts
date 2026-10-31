import { expect, it } from "vitest";
import { buildActors, camera, composition, materialPath, poseAt } from "./program";
import { ParticleSampler, particleFrame } from "./particle-sampler";
import { FOCAL, rotateRoll } from "./projection";

it("preserves aerodynamic position, perspective, opacity and droplet direction without full-pose allocation", () => {
  const actors = buildActors(2595989206)
    .filter((a) => a.layer === "particles" || a.layer === "spray")
    .filter((a, i) => i % 233 === 0 || a.id === "ember-0");
  const output = new Float32Array(8),
    translated = new Float64Array(6);
  for (const actor of actors) {
    const sampler = new ParticleSampler(actor);
    for (const time of [actor.birth - 0.001, actor.birth + 0.017, 12.15, 18.71, 26.91, 31]) {
      if (time >= actor.birth && time < 31) {
        const path = materialPath(actor),
          motion = path.at(time - actor.birth);
        path.writeTranslation(time - actor.birth, translated);
        expect([...translated]).toEqual([...motion.position, ...motion.velocity]);
      }
      for (const [width, height] of [
        [390, 844],
        [1280, 720],
        [2560, 1080],
      ]) {
        const frame = particleFrame(time, width, height),
          pose = poseAt(actor, time, width, height);
        const d = FOCAL + camera(time).position[2] - pose.position[2];
        const visible = time >= actor.birth && time < 31 && pose.alpha >= 0.001 && d >= -pose.size && d <= 26000;
        expect(sampler.write(frame, output, 0)).toBe(visible);
        if (!visible) continue;
        const velocity = actor.layer === "spray" ? pose.velocity! : [0, 0, 0];
        const spread = composition(width, height).spread;
        const drift = rotateRoll([velocity[0] * spread, velocity[1], velocity[2]], -camera(time).roll);
        const expected = new Float32Array([...pose.position, pose.size, drift[0], drift[1], pose.alpha, actor.phase]);
        expect(output).toEqual(expected);
      }
    }
  }
});
