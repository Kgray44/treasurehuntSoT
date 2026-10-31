import { SurfaceDepth, SurfaceQueue } from "./depth-compositor";
import { PaintSurface } from "./paint-surface";
import { Atmosphere } from "./atmosphere";
import { FOCAL, REST_CAMERA, WORLD_HEIGHT, viewRay, worldViewport } from "./projection";

const WIDTH = 512,
  HEIGHT = 384;
const palette = [
  [218, 178, 110],
  [255, 204, 51],
  [77, 31, 10],
  [10, 140, 179],
];
function coverage(kind: number, x: number, y: number) {
  if (kind === 0) {
    const edge = 0.12 + (Math.floor(y * 8) % 2) * 0.03;
    return x > edge && x < 0.85 && y > 0.1 && y < 0.87 && !(x > 0.43 && x < 0.6 && y > 0.36 && y < 0.59)
      ? x < edge + 0.055
        ? 128 / 255
        : 1
      : 0;
  }
  if (kind === 1)
    return (y > 0.64 && y < 0.79 && x > 0.12 && x < 0.88) || (x > 0.45 && x < 0.56 && y > 0.16 && y < 0.79) ? 1 : 0;
  if (kind === 2) return x > 0.68 && x < 0.82 && y > 0.06 && y < 0.94 ? 1 : 0;
  return x > 0.23 && x < 0.73 && y > 0.23 && y < 0.63 ? (x < 0.5 ? 128 / 255 : 1) : 0;
}
function permutations(a: number[]): number[][] {
  return a.length ? a.flatMap((x, i) => permutations(a.filter((_, j) => i !== j)).map((rest) => [x, ...rest])) : [[]];
}
async function paint(gl: WebGL2RenderingContext, kind: number) {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d")!,
    pixels = ctx.createImageData(WIDTH, HEIGHT);
  for (let y = 0; y < HEIGHT; y++)
    for (let x = 0; x < WIDTH; x++) {
      const i = (y * WIDTH + x) * 4;
      pixels.data.set(
        kind < 0
          ? [0, 0, 0, 255]
          : [...palette[kind], Math.round(coverage(kind, (x + 0.5) / WIDTH, 1 - (y + 0.5) / HEIGHT) * 255)],
        i,
      );
    }
  ctx.putImageData(pixels, 0, 0);
  const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!))),
    url = URL.createObjectURL(blob),
    image = new Image();
  image.src = url;
  await image.decode();
  const surface = new PaintSurface(gl);
  surface.topology(new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), new Uint16Array([0, 1, 2, 2, 1, 3]));
  surface.updatePaint({
    image,
    width: WIDTH,
    height: HEIGHT,
    padding: 0,
    pixelRatio: 1,
    insets: { left: 0, right: 0, top: 0, bottom: 0 },
    dispose() {
      URL.revokeObjectURL(url);
    },
  });
  URL.revokeObjectURL(url);
  return surface;
}
function pointsAt(z: number) {
  const h = (WORLD_HEIGHT * (FOCAL - z)) / FOCAL / 2,
    w = (h * WIDTH) / HEIGHT;
  return new Float32Array([-w, -h, 0, w, -h, 0, -w, h, 0, w, h, 0]);
}
/** Browser-only qualification of the production shaders, not a JS rasterizer.
 * CPU over-compositing is only the independent expected-pixel oracle. */
export async function qualifyDepth(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext("webgl2", { alpha: true, depth: true, antialias: true, preserveDrawingBuffer: true })!;
  if (!gl) throw new Error("WebGL2 unavailable");
  const surfaces = await Promise.all([0, 1, 2, 3, -1].map((i) => paint(gl, i)));
  const depth = new SurfaceDepth(gl),
    weather = new Atmosphere(gl, 7, "CINEMATIC");
  weather.resize(WIDTH, HEIGHT);
  const samples = [
    [0.08, 0.5],
    [0.16, 0.45],
    [0.31, 0.49],
    [0.53, 0.47],
    [0.64, 0.48],
    [0.75, 0.49],
    [0.9, 0.5],
    [0.32, 0.7],
    [0.53, 0.7],
    [0.75, 0.7],
    [0.64, 0.3],
    [0.31, 0.3],
  ];
  const read = new Uint8Array(WIDTH * HEIGHT * 4);
  let checked = 0,
    maxError = 0;
  const failures: unknown[] = [];
  const clear = () => {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, WIDTH, HEIGHT);
    gl.depthMask(true);
    gl.colorMask(true, true, true, true);
    gl.clearColor(0, 0, 0, 1);
    gl.clearDepth(1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.BLEND);
  };
  const queue = (order: number[], zs: number[]) => {
    const q = new SurfaceQueue(gl);
    order.forEach((kind) =>
      q.add({
        z: zs[kind],
        draw: (pass) =>
          surfaces[kind].draw(
            pointsAt(zs[kind]),
            [0, 0, zs[kind]],
            [0, 0, 0, 1],
            REST_CAMERA,
            WIDTH,
            HEIGHT,
            undefined,
            pass,
          ),
      }),
    );
    q.flush();
  };
  try {
    for (const assignment of permutations([0, 1, 2, 3]))
      for (const reversed of [false, true]) {
        clear();
        const zs = assignment.map((n) => -400 - n * 450);
        queue(reversed ? [3, 2, 1, 0] : [0, 1, 2, 3], zs);
        gl.readPixels(0, 0, WIDTH, HEIGHT, gl.RGBA, gl.UNSIGNED_BYTE, read);
        for (const [u, v] of samples) {
          const x = Math.floor(u * WIDTH),
            y = Math.floor(v * HEIGHT),
            uv = [(x + 0.5) / WIDTH, (y + 0.5) / HEIGHT];
          let expected = [0, 0, 0];
          for (const kind of [0, 1, 2, 3].sort((a, b) => zs[a] - zs[b])) {
            const alpha = coverage(kind, ...(uv as [number, number]));
            expected = expected.map((c, i) => Math.round(c * (1 - alpha) + palette[kind][i] * alpha));
          }
          const actual = [...read.slice((y * WIDTH + x) * 4, (y * WIDTH + x) * 4 + 3)];
          const error = Math.max(...actual.map((c, i) => Math.abs(c - expected[i])));
          maxError = Math.max(maxError, error);
          checked++;
          if (error > 2 && failures.length < 12) failures.push({ assignment, reversed, uv, expected, actual, error });
        }
      }
    const slabResults = [];
    for (const distance of [350, 1200, 3000])
      for (const range of [
        [12, 2500, 0.35],
        [1600, 2400, 0.35],
      ]) {
        clear();
        const z = FOCAL - distance,
          q = new SurfaceQueue(gl);
        q.add({
          z,
          draw: (pass) =>
            surfaces[4].draw(pointsAt(z), [0, 0, z], [0, 0, 0, 1], REST_CAMERA, WIDTH, HEIGHT, undefined, pass),
        });
        q.flush();
        weather.mist(
          0,
          [],
          WIDTH,
          HEIGHT,
          depth.capture(() => q.holdout()),
          range as [number, number, number],
        );
        gl.readPixels(0, 0, WIDTH, HEIGHT, gl.RGBA, gl.UNSIGNED_BYTE, read);
        for (const [u, v] of [
          [0.5, 0.5],
          [0.08, 0.08],
          [0.92, 0.92],
        ]) {
          const x = Math.floor(u * WIDTH),
            y = Math.floor(v * HEIGHT),
            uv = [(x + 0.5) / WIDTH, (y + 0.5) / HEIGHT];
          const axial = Math.max(0, Math.min(distance, range[1]) - range[0]);
          const expected =
            255 *
            (1 -
              Math.exp(
                -axial *
                  Math.hypot(...viewRay(uv, worldViewport({ width: WIDTH, height: HEIGHT }), 0)) *
                  0.00105 *
                  range[2],
              ));
          const actual = read[(y * WIDTH + x) * 4],
            error = Math.abs(expected - actual);
          slabResults.push({ distance, range, uv, expected, actual, error });
        }
      }
    clear();
    queue([0, 1, 2, 3], [-600, -1050, -1500, -1950]);
    const gpuError = gl.getError(),
      debug = gl.getExtension("WEBGL_debug_renderer_info");
    return {
      coverage: { cases: 48, samples: checked, maxByteError: maxError, failures },
      fog: { samples: slabResults, maxByteError: Math.max(...slabResults.map((v) => v.error)) },
      gpuError,
      gpu: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      framebuffer: {
        width: WIDTH,
        height: HEIGHT,
        depthBits: gl.getParameter(gl.DEPTH_BITS),
        samples: gl.getParameter(gl.SAMPLES),
      },
      pass: !failures.length && slabResults.every((v) => v.error < 2) && gpuError === gl.NO_ERROR,
    };
  } finally {
    surfaces.forEach((s) => s.dispose());
    depth.dispose();
    weather.dispose();
  }
}
