import fs from "node:fs/promises";
import { createHash } from "node:crypto";

const root = ".runtime/embarkation/audit-repair";
const read = async (name) => JSON.parse(await fs.readFile(`${root}/${name}`, "utf8"));
const artifact = async (name) => ({
  path: `${root}/${name}`,
  sha256: createHash("sha256")
    .update(await fs.readFile(`${root}/${name}`))
    .digest("hex"),
});
const quantiles = (values) => {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  const at = (p) => sorted[Math.floor((sorted.length - 1) * p)] ?? null;
  return { count: sorted.length, p50: at(0.5), p95: at(0.95), p99: at(0.99), max: sorted.at(-1) ?? null };
};
const bands = [
  ["pressure", 0, 3.3],
  ["departure", 3.3, 10],
  ["crossing", 10, 16],
  ["wonder", 16, 22],
  ["fog", 22, 27],
  ["threshold", 27, 31],
  ["assembly", 31, 34.7],
  ["stillness", 34.7, 35.81],
];
const summarize = (run) => {
  const state = run.state;
  const film = state.frames.filter((f) => f.kind === "film" && Number.isFinite(f.time));
  const frames = film.map((f, i) => ({ ...f, interval: i ? f.at - film[i - 1].at : NaN }));
  const samples = (items) => ({
    frames: items.length,
    cpuMs: quantiles(items.map((f) => f.cpuMs)),
    gpuMs: quantiles(items.map((f) => f.gpuMs)),
    intervalMs: quantiles(items.map((f) => f.interval)),
    draws: quantiles(items.map((f) => f.draws)),
    vertices: quantiles(items.map((f) => f.vertices)),
  });
  return {
    userAgent: run.userAgent,
    viewport: [state.width, state.height, state.dpr],
    contexts: state.contexts,
    bands: Object.fromEntries(
      bands.map(([name, start, end]) => [name, samples(frames.filter((f) => f.time >= start && f.time < end))]),
    ),
    ambient: samples(state.frames.filter((f) => f.kind === "ambient")),
    canvasCopySubmissionMs: quantiles(state.copies.map((v) => v.ms)),
    longTasks: state.longTasks,
    errors: state.errors,
    visibility: state.visibility,
    workers: run.workers.map((w) => ({
      kind: w.posts[0]?.keys,
      elapsedMs: w.messages[0] ? w.messages[0].at - w.created : null,
      caches: w.messages[0]?.caches,
      error: w.error ?? w.messages[0]?.error ?? null,
    })),
  };
};
const beforeName = "embarkation-production-no-capture-20260929.json";
const afterName = "embarkation-production-fog-work-20260929.json";
const before = await read(beforeName),
  after = await read(afterName);
const cadence = await read("embarkation-production-cadence-20260929.json");
const movie = await read("embarkation-production-native-film-20260929.json");
const cadenceBands = (state) =>
  Object.fromEntries(
    bands.map(([name, start, end]) => [
      name,
      quantiles(state.frames.filter((f) => f.elapsed >= start && f.elapsed < end).map((f) => f.delta)),
    ]),
  );
const record = {
  classification: "engineering-evidence",
  status: "PARTIAL - measured fog recovery; production frame budget remains open",
  recordedAt: new Date().toISOString(),
  auditIds: ["EMB-AUD-07", "EMB-AUD-08", "EMB-AUD-14", "EMB-AUD-19"],
  sourceState: "Two separately sealed uncommitted production builds. No publication or owner acceptance.",
  before: {
    source: await read("production-source-parallel-20260929.json"),
    artifact: await artifact(beforeName),
    summary: summarize(before),
  },
  after: {
    source: await read("production-source-fog-work-20260929.json"),
    artifact: await artifact(afterName),
    summary: summarize(after),
  },
  repairs: [
    "Run independent actor-motion and title-contact preparation concurrently. Preserve all four responsive contact families and every physical cache. The prior serial chain reached the 45s watchdog; fresh parallel production preparation completes, without raising the timeout.",
    "Skip only Gaussian bank tails beyond four normalized radii (including the bounded z warp), with total discarded density below 9e-11. Share the identical base noise evaluation. Keep all 36 CINEMATIC integration steps and nine geometry/lens samples.",
    "Omit the exactly zero-intensity storm calculation after its authored departure, and omit lighting of exactly zero-opacity ray steps. Neither changes the density field, lighting law or camera motion.",
    "Preserve the first lens sample's owned DEPTH_COMPONENT24 attachment for fog reuse. The former stored texture reference was overwritten by later samples. Copy between matching owned depth formats; retain conservative discontinuity checks and the full reference path.",
  ],
  nativeComparison: {
    artifact: await artifact("embarkation-fog-work-native-20260929.json"),
    data: await read("embarkation-fog-work-native-20260929.json"),
  },
  pixelArtifact: await artifact("embarkation-fog-work-pixels-20260929.json"),
  fullReference: {
    artifact: await artifact("embarkation-fog-work-reference-20260929.json"),
    data: await read("embarkation-fog-work-reference-20260929.json"),
  },
  preparationBaseline: await artifact("embarkation-production-preparation-baseline-20260929.json"),
  countersOff: {
    artifact: await artifact("embarkation-production-cadence-20260929.json"),
    method:
      "Detailed WebGL/worker wrappers removed. Only an independent RAF cadence observer and long-task observer remain. Elapsed bands start at arming immediately before the ordinary Join click, not an internal film-time readout.",
    bands: cadenceBands(cadence.state),
    longTasks: cadence.state.longTasks,
    finished: cadence.finished,
    visibility: cadence.state.visibility,
  },
  nativeMovie: {
    artifact: await artifact("embarkation-production-native-film-20260929.json"),
    player: `${root}/embarkation-production-native-film-20260929.html`,
    frames: movie.frames.length,
    timestampSpanSeconds: movie.frames.at(-1).metadata.timestamp - movie.frames[0].metadata.timestamp,
    method:
      "CINEMATIC ordinary production Replay at 1x, audio off, CDP native JPEG frames at every second presented frame; no detailed WebGL counters. Actual recorded cadence is retained.",
    finished: movie.end.finished,
    bands: cadenceBands(movie.end.cadence),
    observations:
      "Complete native film and more than eight seconds of ambient room retained. Selected departure, moon and settled-room frames visually inspected; uninterrupted human perceptual acceptance remains separate.",
  },
  limits: [
    "CPU figures include JavaScript instrumentation overhead; drawImage timing is CPU submission cost, not an isolated GPU-copy measurement. No screen recorder ran during these full-film timing captures.",
    "These are two successive builds on one Chromium/RTX5070 Laptop configuration, not a universal performance claim. The after build also includes the separately measured owner wind/moon repair. Later fog timings are unchanged by that earlier wind envelope.",
    "The native same-time pixel comparison isolates the fog edits across a shader reload. Three viewport reference comparisons exercise actual renderer resize, not complete fresh-entry responsive qualification.",
    "Warm state and system load affect worker/preparation durations. Removing the serial dependency is causal; the entire observed wall-time difference must not be attributed to concurrency alone.",
    "Recorder/counters-off cadence is measured separately. CPU/compositor trace, complete memory/lifecycle qualification and the remaining independent-audit repairs are still required. High-percentile fog cost remains over budget; this is not a ready owner-acceptance candidate.",
  ],
};
const destination = "Development_Docs/Projects/Voyagewright_Refit_V1/embarkation/audit-production-performance.json";
await fs.writeFile(destination, JSON.stringify(record, null, 2) + "\n");
console.log(
  JSON.stringify({ destination, beforeFog: record.before.summary.bands.fog, afterFog: record.after.summary.bands.fog }),
);
