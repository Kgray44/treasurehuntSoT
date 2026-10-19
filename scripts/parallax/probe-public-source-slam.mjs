import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
const args = process.argv.slice(2);
const argument = (name) => {
  const index = args.indexOf(name);
  if (index < 0 || !args[index + 1]) throw new Error("Required argument: " + name);
  return args[index + 1];
};
const directory = path.resolve(argument("--dist"));
const outputRoot = path.resolve(argument("--output"));
const script = path.join(directory, "slam_wasm.js"),
  wasm = fs.readFileSync(path.join(directory, "slam_wasm.wasm"));
const exported = { exports: {} };
vm.runInNewContext(
  fs.readFileSync(script, "utf8"),
  {
    module: exported,
    exports: exported.exports,
    require: createRequire(script),
    process,
    console,
    performance,
    __dirname: directory,
    __filename: script,
    WebAssembly,
    Buffer,
    setTimeout,
    clearTimeout,
    TextDecoder,
    TextEncoder,
    URL,
  },
  { filename: script },
);
const width = 320,
  height = 240,
  focal = 0.8 * width;
let seed = 864;
const random = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
};
const points = Array.from({ length: 450 }, () => ({
  x: (random() - 0.5) * 6,
  y: (random() - 0.5) * 4,
  z: 2 + random() * 4,
  texture: Array.from({ length: 81 }, () => (random() > 0.5 ? 240 : 24)),
})).sort((a, b) => b.z - a.z);
const progress = (f) => Math.min(Math.max(0, f - 15) * 0.006, 0.45);
const scenarios = [
  { name: "lateral_hold", count: 120, pose: (f) => [progress(f), 0, 0, 0] },
  {
    name: "reverse_return",
    count: 180,
    pose: (f) => [f < 90 ? progress(f) : Math.max(0, 0.45 - (f - 90) * 0.006), 0, 0, 0],
  },
  { name: "forward_hold", count: 120, pose: (f) => [0, 0, progress(f), 0] },
  { name: "diagonal_hold", count: 120, pose: (f) => [progress(f), progress(f) * 0.3, progress(f) * 0.5, 0] },
  { name: "yaw_only", count: 120, pose: (f) => [0, 0, 0, progress(f) * 0.5] },
  { name: "lateral_yaw", count: 150, pose: (f) => [progress(f), 0, 0, progress(f) * 0.3] },
  { name: "blank_loss_recovery", count: 150, blank: (f) => f >= 95 && f < 110, pose: (f) => [progress(f), 0, 0, 0] },
  { name: "blank_only", count: 80, blank: () => true, pose: () => [0, 0, 0, 0] },
  { name: "planar_lateral", count: 120, planar: true, pose: (f) => [progress(f), 0, 0, 0] },
];
const world = (p) => [0, 1, 2].map((c) => -[0, 1, 2].reduce((s, r) => s + p[r * 3 + c] * p[9 + r], 0));
const summaries = [],
  sha = createHash("sha256").update(wasm).digest("hex"),
  output = path.join(outputRoot, `scenarios-${sha.slice(0, 8)}`);
fs.mkdirSync(output, { recursive: true });
for (const scenario of scenarios) {
  const api = await exported.exports({ wasmBinary: wasm, print() {}, printErr() {} });
  const framePointer = api._malloc(width * height * 4),
    posePointer = api._malloc(12 * 8),
    statsPointer = api._malloc(11 * 8),
    frames = [];
  for (let frame = 0; frame < scenario.count; frame++) {
    const [cx, cy, cz, yaw] = scenario.pose(frame),
      c = Math.cos(yaw),
      s = Math.sin(yaw);
    // World-to-camera rotation; the input has no true translation or depth.
    const rotation = [c, 0, -s, 0, 1, 0, s, 0, c];
    api.HEAPF64.set([...rotation, 0, 0, 0], posePointer / 8);
    const pixels = new Uint8Array(width * height * 4).fill(120);
    for (let i = 3; i < pixels.length; i += 4) pixels[i] = 255;
    const blank = scenario.blank?.(frame) ?? false;
    if (!blank)
      for (const point of points) {
        const z = scenario.planar ? 4 : point.z,
          half = 0.06;
        const projected = [];
        for (const dx of [-half, half])
          for (const dy of [-half, half]) {
            const x = point.x + dx - cx,
              y = point.y + dy - cy,
              d = z - cz,
              px = c * x - s * d,
              pz = s * x + c * d;
            if (pz > 0.1) projected.push([(focal * px) / pz + width / 2, (focal * y) / pz + height / 2]);
          }
        if (projected.length !== 4) continue;
        const left = Math.max(0, Math.ceil(Math.min(...projected.map((p) => p[0])))),
          right = Math.min(width - 1, Math.floor(Math.max(...projected.map((p) => p[0]))));
        const top = Math.max(0, Math.ceil(Math.min(...projected.map((p) => p[1])))),
          bottom = Math.min(height - 1, Math.floor(Math.max(...projected.map((p) => p[1]))));
        for (let y = top; y <= bottom; y++)
          for (let x = left; x <= right; x++) {
            // Ray/plane intersection keeps patches geometrically consistent during turns.
            const rx = (x - width / 2) / focal,
              ry = (y - height / 2) / focal,
              wx = c * rx + s,
              wz = -s * rx + c,
              lambda = (z - cz) / wz;
            if (lambda <= 0) continue;
            const u = cx + lambda * wx - point.x,
              v = cy + lambda * ry - point.y;
            if (Math.abs(u) > half || Math.abs(v) > half) continue;
            const tx = Math.min(8, Math.max(0, Math.floor(((u + half) * 9) / (2 * half)))),
              ty = Math.min(8, Math.max(0, Math.floor(((v + half) * 9) / (2 * half))));
            const i = (y * width + x) * 4;
            pixels[i] = pixels[i + 1] = pixels[i + 2] = point.texture[ty * 9 + tx];
          }
      }
    api.HEAPU8.set(pixels, framePointer);
    const result = api._processFrameWithPoseInput(framePointer, width, height, posePointer);
    api._getFrameStats(statsPointer);
    const stats = Array.from(api.HEAPF64.slice(statsPointer / 8, statsPointer / 8 + 11)),
      pose = Array.from(api.HEAPF64.slice(result / 8, result / 8 + 12));
    const orientationTrace = rotation.reduce((sum, v, i) => sum + v * pose[i], 0);
    frames.push({
      frame,
      truth: [cx, cy, cz],
      yaw,
      blank,
      pose,
      world: world(pose),
      pnpInliers: stats[1],
      reprojectionError: stats[2],
      processMs: stats[3],
      orientationErrorDegrees: (Math.acos(Math.min(1, Math.max(-1, (orientationTrace - 1) / 2))) * 180) / Math.PI,
      stats,
    });
  }
  const solved = frames.filter((f) => f.pnpInliers >= 8 && f.reprojectionError <= 6),
    dot = (a, b) => a.reduce((v, x, i) => v + x * b[i], 0);
  const denominator = solved.reduce((v, r) => v + dot(r.world, r.world), 0),
    scale = denominator ? solved.reduce((v, r) => v + dot(r.world, r.truth), 0) / denominator : null;
  const moving = frames.some((f) => Math.hypot(...f.truth) > 0);
  const rms =
    scale === null || !moving
      ? null
      : Math.sqrt(
          solved.reduce((v, r) => v + r.world.reduce((s, x, i) => s + (scale * x - r.truth[i]) ** 2, 0), 0) /
            solved.length,
        );
  const summary = {
    name: scenario.name,
    frames: frames.length,
    freshMappedPnP: solved.length,
    firstMappedFrame: solved[0]?.frame ?? null,
    relativeBestFitScale: scale,
    trajectoryRms: rms,
    maxRotationErrorDegrees: solved.length ? Math.max(...solved.map((r) => r.orientationErrorDegrees)) : null,
    medianProcessMs: frames.map((r) => r.processMs).sort((a, b) => a - b)[Math.floor(frames.length / 2)],
    blankAdmittedFrames: frames.filter((f) => f.blank && f.pnpInliers >= 8 && f.reprojectionError <= 6).length,
    recoveredAfterBlank: scenario.name === "blank_loss_recovery" ? solved.some((f) => f.frame >= 110) : null,
    lastWorld: frames.at(-1).world,
  };
  fs.writeFileSync(`${output}/${scenario.name}.json`, JSON.stringify({ summary, frames }, null, 2));
  summaries.push(summary);
  console.log(JSON.stringify(summary));
  api._free(framePointer);
  api._free(posePointer);
  api._free(statsPointer);
}
fs.writeFileSync(
  `${output}/summary.json`,
  JSON.stringify(
    {
      wasmSha256: sha,
      test: "SYNTHETIC_TEXTURED_PLANES_WITH_GROUND_TRUTH_ORIENTATION_INPUT",
      truthTranslationProvided: false,
      truthDepthProvided: false,
      physicalAcceptance: false,
      summaries,
    },
    null,
    2,
  ),
);
