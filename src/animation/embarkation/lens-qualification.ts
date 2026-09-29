import { Atmosphere } from "./atmosphere";
import { LENS_IMPACTS, LENS_LIFETIME } from "./lens-water";

/** Actual optical pixels against a textured surface. A nonzero material mask
 * alone is not proof that the trailing film refracts anything. */
export function qualifyLens(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext("webgl2", { alpha: true, preserveDrawingBuffer: true })!;
  if (!gl) throw new Error("WebGL2 unavailable");
  const width = canvas.width,
    height = canvas.height;
  const weather = new Atmosphere(gl, 7, "CINEMATIC");
  weather.resize(width, height);
  const baseline = new Uint8Array(width * height * 4),
    pixels = new Uint8Array(baseline.length);
  const paint = () => {
    gl.disable(gl.BLEND);
    gl.enable(gl.SCISSOR_TEST);
    for (let y = 0; y < height; y += 8)
      for (let x = 0; x < width; x += 8) {
        gl.scissor(x, y, 8, 8);
        const stripe = ((x / 8 + y / 8) % 2) * 0.55;
        gl.clearColor(0.12 + stripe, 0.2 + stripe * 0.7, 0.27 + stripe * 0.5, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
      }
    gl.disable(gl.SCISSOR_TEST);
  };
  paint();
  gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, baseline);
  const samples = [
    { label: "impact", time: 6.1 },
    { label: "held", time: 6.6 },
    { label: "merging", time: 7.02 },
    { label: "runoff-and-trail", time: 7.85 },
    { label: "late-drain", time: 19 },
    { label: "before-cleanup", time: LENS_IMPACTS.at(-1)!.time + LENS_LIFETIME - 0.00001 },
    { label: "after-cleanup", time: LENS_IMPACTS.at(-1)!.time + LENS_LIFETIME + 0.00001 },
  ].map(({ label, time }) => {
    paint();
    weather.captureScenery(time);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    weather.lensAt(time);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    let changed = 0,
      maximumDifference = 0,
      trailChanged = 0,
      trailMaximumDifference = 0;
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const offset = (y * width + x) * 4,
          alpha = pixels[offset + 3] / 255;
        let difference = 0;
        for (let c = 0; c < 3; c++)
          difference = Math.max(
            difference,
            Math.abs(pixels[offset + c] + baseline[offset + c] * (1 - alpha) - baseline[offset + c]),
          );
        if (difference > 1) changed++;
        maximumDifference = Math.max(maximumDifference, difference);
        // This band is above the coalesced bead at 7.85s, below its original
        // impact, and far from every other bead: only deposited film is present.
        if (
          label === "runoff-and-trail" &&
          x / width > 0.831 &&
          x / width < 0.846 &&
          y / height > 0.57 &&
          y / height < 0.605
        ) {
          if (difference > 1) trailChanged++;
          trailMaximumDifference = Math.max(trailMaximumDifference, difference);
        }
      }
    return { label, time, changed, maximumDifference, trailChanged, trailMaximumDifference };
  });
  const gpuError = gl.getError();
  weather.dispose();
  return {
    viewport: { width, height },
    samples,
    gpuError,
    pass:
      gpuError === 0 &&
      samples[0].changed > 0 &&
      samples[3].trailChanged > 0 &&
      samples[5].changed === 0 &&
      samples[6].changed === 0,
  };
}
