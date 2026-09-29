import { camera } from "../../src/animation/embarkation/program";
import { HARBOR_ENVIRONMENT } from "../../src/animation/embarkation/environment-set";
import { landscapeWaterPoint, landscapeSkyPoint } from "../../src/animation/embarkation/landscape-space";

const result = [];
for (const [width, height] of [
  [390, 844],
  [800, 1100],
  [1280, 720],
  [2560, 1080],
]) {
  const bounds = { water: [Infinity, Infinity, -Infinity, -Infinity], sky: [Infinity, Infinity, -Infinity, -Infinity] };
  for (let time = 15.3; time <= 24.65; time += 0.05) {
    for (let y = 0; y <= 16; y++)
      for (let x = 0; x <= 24; x++) {
        for (const [kind, method] of [
          ["water", landscapeWaterPoint],
          ["sky", landscapeSkyPoint],
        ] as const) {
          const point = method(camera(time), [x / 24, y / 16], { width, height }, HARBOR_ENVIRONMENT.calibration);
          if (!point) continue;
          if (
            kind === "sky" &&
            landscapeWaterPoint(camera(time), [x / 24, y / 16], { width, height }, HARBOR_ENVIRONMENT.calibration)
          )
            continue;
          const [u, v] = point.sourceUV,
            b = bounds[kind];
          b[0] = Math.min(b[0], u);
          b[1] = Math.min(b[1], v);
          b[2] = Math.max(b[2], u);
          b[3] = Math.max(b[3], v);
        }
      }
  }
  result.push({ width, height, bounds });
}
console.log(JSON.stringify(result, null, 2));
