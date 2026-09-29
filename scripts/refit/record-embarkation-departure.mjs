import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

const root = ".runtime/embarkation/audit-repair";
const sha = async (path) =>
  createHash("sha256")
    .update(await fs.readFile(path))
    .digest("hex");
const files = (await fs.readdir("src/animation/embarkation")).filter(
  (n) => /\.(ts|tsx|css)$/.test(n) && !n.includes(".test."),
);
const sourceSha256 = Object.fromEntries(
  await Promise.all(
    files.map(async (n) => {
      const path = `src/animation/embarkation/${n}`;
      return [path, await sha(path)];
    }),
  ),
);
const sealPath = `${root}/departure-world-source-20260929.json`;
try {
  const prior = JSON.parse(await fs.readFile(sealPath, "utf8"));
  if (JSON.stringify(prior.sourceSha256) !== JSON.stringify(sourceSha256))
    throw new Error("Runtime changed after this evidence seal; use a new record.");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
  await fs.writeFile(sealPath, JSON.stringify({ sourceSha256 }, null, 2) + "\n", { flag: "wx" });
}
const clips = [];
for (const kind of ["normal", "quarter"]) {
  const path = `${root}/embarkation-departure-world-${kind}-20260929.json`;
  const capture = JSON.parse(await fs.readFile(path, "utf8"));
  const player = path.replace(".json", ".html");
  execFileSync(process.execPath, ["scripts/refit/native-capture-player.mjs", path, player]);
  clips.push({
    path,
    player,
    sha256: await sha(path),
    frames: capture.frames.length,
    rate: capture.rate,
    start: capture.start.snapshot,
    end: capture.end.snapshot,
    viewport: capture.start.diagnostics.viewport,
    failure: capture.end.diagnostics.rendererFailure,
    frameP95: capture.end.diagnostics.frameP95,
    method:
      "Native CDP screencast, JPEG90, max1280x720, every second compositor frame; silent diagnostic with capture overhead.",
  });
}
const viewports = [];
for (const kind of ["portrait", "tablet", "ultrawide", "ultrawide-canvas"]) {
  const path = `${root}/embarkation-departure-${kind}-20260929.json`;
  const capture = JSON.parse(await fs.readFile(path, "utf8"));
  viewports.push({
    path,
    sha256: await sha(path),
    method: capture.method,
    viewport: capture.snapshots?.[0].viewport ?? capture.viewport,
    failure: capture.diagnostics?.rendererFailure ?? null,
    limitation: kind.startsWith("ultrawide")
      ? "Compositor screenshots repeat tiles in this IAB capture path; direct original WebGL canvas is correct. Not a passing ultrawide browser-compositor qualification."
      : "Selected native frames; not a physical-device or full lifecycle qualification.",
  });
}
const record = {
  classification: "engineering-evidence",
  status: "TARGETED REPAIR - broader audit remains IN_PROGRESS",
  recordedAt: new Date().toISOString(),
  baseHead: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  sourceSha256,
  productionBuildId: (await fs.readFile(".next-embarkation-production-audit/BUILD_ID", "utf8")).trim(),
  auditIds: ["EMB-AUD-01", "EMB-AUD-02", "EMB-AUD-19"],
  cause:
    "The former outgoing sheet lived in a rigid carrier. Its FlightPath began at nominal release with only camera velocity, ignoring the sheet's accumulated deformation velocity and starting 50ms before the final support disappeared.",
  repair: [
    "A single constrained world-space material now owns the full pressure/strain/release/flight interval. Failure removes each support without replacing vertex position or velocity. No release kick or transport floor exists.",
    "Material-point drag uses the same relative-airflow/projected-area response as FlightPath, with the existing page stock coefficients. Distributed pressure and support impulses produce turning and flutter; no separate prescribed rigid rotation is applied.",
    "Moving supports remain registered to the actual platform projection. Their known rigid transform supplies a metric-preserving reference only when the bounded constraint solver requires conservative advancement, repairing narrow-header preparation without relaxing strain limits.",
    "Prepared geometry transfers through the existing worker cache. Recession culls only after the nearest point reaches optical extinction. Focus-title diagnostics no longer build an unused page simulation on the main thread.",
    "Anchor-release sound placement now reads the same world-space support point. The earlier shared gust and staggered release schedule, 35.8s film, moon depth repair, and later cinematic beats are unchanged.",
  ],
  probe: {
    path: `${root}/departure-worldsheet-final-20260929.json`,
    sha256: await sha(`${root}/departure-worldsheet-final-20260929.json`),
    boundary: "Equation/mesh evidence, not perceptual acceptance.",
  },
  clips,
  viewports,
  validation: [
    "26 focused Embarkation files / 106 tests passed; includes actual crew-card rapid recession, heavy-button contrast, moving pins, bounded narrow-header strain, nonzero release momentum and transferred-cache equality.",
    "Production build and TypeScript passed; five existing Edge/NFT warnings remain unrelated to this repair.",
  ],
  limits: [
    "Hero-prop deformation/self-contact, dynamic landing retargeting, full audio/lifecycle/browser matrix and the remaining independent-audit findings are still open.",
    "This record does not relabel earlier sound recordings or production performance samples as measurements of the new source. Known fog high-percentile cost remains unresolved.",
    "Selected-frame inspection and retained playback are not owner acceptance. No merge or publication was performed.",
  ],
};
const filmPath = `${root}/embarkation-departure-production-film-20260929.json`;
const film = JSON.parse(await fs.readFile(filmPath, "utf8"));
const filmPlayer = filmPath.replace(".json", ".html");
execFileSync(process.execPath, ["scripts/refit/native-capture-player.mjs", filmPath, filmPlayer]);
record.productionReplay = {
  path: filmPath,
  player: filmPlayer,
  sha256: await sha(filmPath),
  buildId: film.buildId,
  viewport: film.viewport,
  frames: film.frames.length,
  recordedSeconds: film.frames.at(-1).metadata.timestamp - film.frames[0].metadata.timestamp,
  end: film.end,
  method: film.method,
  boundary:
    "Ordinary production replay reached live Muster with more than eight seconds of ambience. Silent recording and selected-frame inspection are not listening or complete perceptual acceptance.",
};
for (const [name, time] of [
  ["departure-opening-production-20260929", 6],
  ["departure-moon-production-20260929", 19.5],
]) {
  const start = film.frames[0].metadata.timestamp;
  const frame = film.frames.reduce((a, b) =>
    Math.abs(b.metadata.timestamp - start - time) < Math.abs(a.metadata.timestamp - start - time) ? b : a,
  );
  await fs.writeFile(`${root}/${name}.jpg`, Buffer.from(frame.data, "base64"));
}
await fs.writeFile(
  "Development_Docs/Projects/Voyagewright_Refit_V1/embarkation/audit-departure-momentum.json",
  JSON.stringify(record, null, 2) + "\n",
);
console.log(JSON.stringify({ clips: clips.length, viewports: viewports.length, build: record.productionBuildId }));
