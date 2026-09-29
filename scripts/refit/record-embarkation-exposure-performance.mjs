import * as fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
const base = ".runtime/embarkation/audit-repair";
const sha = async path => createHash("sha256").update(await fs.readFile(path)).digest("hex");
const sourcePaths = (await fs.readdir("src/animation/embarkation"))
  .filter(name => /\.tsx?$/.test(name)).map(name => `src/animation/embarkation/${name}`);
const sourceSha256 = Object.fromEntries(await Promise.all(sourcePaths.map(async path => [path, await sha(path)])));
const qualificationPath = `${base}/exposure-performance-qualification-20260925.json`;
const qualification = JSON.parse(await fs.readFile(qualificationPath, "utf8"));
const path = `${base}/exposure-optimized-full-1x-20260925.json`;
const player = `${base}/exposure-optimized-full-1x-20260925.html`;
const capture = JSON.parse(await fs.readFile(path, "utf8"));
execFileSync(process.execPath, ["scripts/refit/native-capture-player.mjs", path, player]);
const percentile = (values, fraction) => [...values].sort((a,b)=>a-b)[Math.floor(values.length*fraction)];
const record = {
  classification: "engineering-evidence",
  status: "IN_PROGRESS - measured recovery; optical and full qualification limits remain",
  recordedAt: new Date().toISOString(),
  auditIds: ["EMB-AUD-07", "EMB-AUD-08", "EMB-AUD-14", "EMB-AUD-19"],
  baseHead: execFileSync("git", ["rev-parse", "HEAD"], {encoding:"utf8"}).trim(),
  sourceState: "Uncommitted owned candidate; no owner acceptance or publication",
  sourceSha256,
  mechanism: [
    "Nine geometry/time/aperture samples retained across the same 1/120-second shutter; no reduction in particle counts or authored motion.",
    "Pack per-object material parameters into one upload; camera and light uniforms persist on each program across draw groups.",
    "Compile the same environment equations with immutable scene-class constants, letting the driver eliminate unrelated living-room branches from the storm and landscape shaders. The inspector reference retains the unspecialized shader.",
    "Particle presentation reads identical cached Hermite translation and velocity without allocating full BodyState, unused Euler rotations or material bending. The reference retains full poseAt sampling.",
    "Earlier projected tessellation selection, conservative frustum culling and strictly shutter-local fog reuse remain enabled and are included in reference comparisons.",
  ],
  evidence: {path: qualificationPath, sha256: await sha(qualificationPath), method: qualification.method},
  comparisons: qualification.comparisons,
  playback: Object.fromEntries(Object.entries(qualification.playback).map(([name,data]) => [name,{
    snapshot:data.snapshot, failure:data.failure,
    gpu:{count:data.gpu.length,p50Ms:percentile(data.gpu,.5),p95Ms:percentile(data.gpu,.95)},
  }])),
  capture: {path,player,sha256:await sha(path),frames:capture.frames.length,method:capture.method,
    viewport:capture.viewport,rate:capture.rate,audio:capture.audio,endState:capture.endState,
    timestampSpanSeconds:capture.frames.at(-1).metadata.timestamp-capture.frames[0].metadata.timestamp},
  observations: qualification.findings,
  limits: [
    "Development build on native RTX 5070 Laptop / Chromium 153; these measurements are not production or thermal qualification.",
    "Separate seven-second runs and rolling FPS windows are diagnostic comparisons, not a controlled benchmark or a full-cut frame budget.",
    "Pixel comparisons cover eight timestamps at desktop, portrait and ultrawide dimensions. Mean differences include all RGBA channels. They do not qualify every moving frame or canonical DOM parity.",
    "Normal-speed silent native capture includes ambient continuation. Only selected frames were visually inspected; audio was not recorded or heard.",
    "A nine-point aperture approximation exposes visible repeated highlights when the threshold focus erroneously approaches a behind-eye landmark. Fix the focal target and re-screen; this record does not claim final optics acceptance.",
  ],
};
await fs.writeFile("Development_Docs/Projects/Voyagewright_Refit_V1/embarkation/audit-exposure-performance.json",`${JSON.stringify(record,null,2)}\n`);
console.log("Recorded shader/particle optimization proof and unresolved screening findings.");
