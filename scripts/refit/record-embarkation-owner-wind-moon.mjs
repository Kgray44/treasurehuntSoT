import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

const root = ".runtime/embarkation/audit-repair";
const destination = "Development_Docs/Projects/Voyagewright_Refit_V1/embarkation/audit-owner-wind-moon.json";
const sha = async (path) =>
  createHash("sha256")
    .update(await fs.readFile(path))
    .digest("hex");
const read = async (name) => JSON.parse(await fs.readFile(`${root}/${name}`, "utf8"));
const sourcePaths = (await fs.readdir("src/animation/embarkation"))
  .filter((name) => /\.(ts|tsx|css)$/.test(name))
  .map((name) => `src/animation/embarkation/${name}`);
const sourceSha256 = Object.fromEntries(await Promise.all(sourcePaths.map(async (p) => [p, await sha(p)])));
const seal = `${root}/owner-wind-moon-source-20260929.json`;
try {
  const prior = JSON.parse(await fs.readFile(seal, "utf8"));
  if (JSON.stringify(prior.sourceSha256) !== JSON.stringify(sourceSha256))
    throw new Error("Runtime changed since capture. Preserve the record; capture a new revision.");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
  await fs.writeFile(seal, JSON.stringify({ sourceSha256 }, null, 2) + "\n");
}
const before = await read("embarkation-moon-flicker-before-20260929.json");
const after = await read("embarkation-moon-flicker-after-20260929.json");
const stats = (samples) => ({
  count: samples.length,
  minimumMeanLuminance: Math.min(...samples.map((v) => v.mean)),
  maximumMeanLuminance: Math.max(...samples.map((v) => v.mean)),
  maximumAdjacentDifference: Math.max(...samples.slice(1).map((v, i) => Math.abs(v.mean - samples[i].mean))),
  gpuErrors: samples.filter((v) => v.error !== 0).length,
});
const captures = [];
for (const name of ["opening-normal", "opening-quarter", "moon-full-scene"]) {
  const path = `${root}/embarkation-${name}-20260929.json`;
  const capture = JSON.parse(await fs.readFile(path, "utf8"));
  const player = path.replace(".json", ".html");
  execFileSync(process.execPath, ["scripts/refit/native-capture-player.mjs", path, player]);
  captures.push({
    path,
    player,
    sha256: await sha(path),
    frames: capture.frames.length,
    from: capture.from,
    rate: capture.rate,
    start: capture.start,
    end: capture.end,
    timestampSpanSeconds: capture.frames.at(-1).metadata.timestamp - capture.frames[0].metadata.timestamp,
  });
}
const record = {
  classification: "engineering-evidence",
  status: "TARGETED REPAIR VERIFIED - wider independent audit remains open",
  auditIds: ["EMB-AUD-01", "EMB-AUD-02", "EMB-AUD-09", "EMB-AUD-19"],
  recordedAt: new Date().toISOString(),
  baseHead: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  sourceState: "Uncommitted owned candidate; no publication or owner acceptance.",
  sourceSha256,
  ownerObservation: "Unobstructed moon flicker and slow, weak wind carrying the opening page away.",
  repairs: [
    "The moon raster and ray-intersected sky share a plane. Four 24-bit depth units of decal bias prevent raster rounding from alternately rejecting the emissive disc. Nearer geometry still occludes it; position, artwork, size, glow and authored time remain unchanged.",
    "A first gust rises from 2.6s, crests near 4.35s and leaves by 7.8s. It uses the common rear-origin wind field, so cloth loading, released pieces, spray, atmosphere and audio receive the same physical event. The stronger late crossing crest is preserved.",
    "Paper, cards, broad cloth and buttons release at staggered 3.75-6.31s times instead of the former 5.65-9.16s window. Each keeps four staggered supports. Thin interface stock uses lower mass and higher air coupling than heavy scenic props, with heavier buttons retaining inertia. No velocity floor or imposed release kick was added.",
    "The full cut remains 35.8s. Later crossing, destination, threshold, incoming assembly and stillness timings are unchanged. Scrubber markers now expose the earlier gust and release.",
  ],
  moon: {
    method:
      "121 native 9x9 WebGL readPixels samples at the projected moon center from 19-21s in 1/60s increments; landscape isolation removes weather and prop occlusion.",
    before: stats(before.samples),
    after: stats(after.samples),
    artifacts: await Promise.all(
      ["embarkation-moon-flicker-before-20260929.json", "embarkation-moon-flicker-after-20260929.json"].map(
        async (name) => ({ path: `${root}/${name}`, sha256: await sha(`${root}/${name}`) }),
      ),
    ),
  },
  departureEquationProbe: {
    path: `${root}/departure-response-20260929.json`,
    sha256: await sha(`${root}/departure-response-20260929.json`),
    boundary: "Constructed material response under actual dynamics; not perceptual acceptance.",
    result: await read("departure-response-20260929.json"),
  },
  captures,
  validation: [
    "26 Embarkation test files / 105 tests passed, including material response and earlier staggered failure regression checks.",
  ],
  observations: [
    "Native normal-speed opening completed 0-10.2s. Quarter-speed recording covers 3.5-7.0s; selected frames show corner flex, staggered support loss and faster depth recession. The full scene was also captured from 18-22.3s after the moon repair.",
    "Owner port3138 was explicitly reloaded and reached JOIN THE ADVENTURE with the new 3.3/5.2/7.2 scrubber markers; task-owned port3148 supplies the retained measurements.",
  ],
  limitations: [
    "The existing source-revision audio recording predates this departure retiming; its 91-cue execution proof must not be relabeled as a recording of these revised events. Runtime cues consume current support times; current audiovisual screening remains required.",
    "Released-sheet momentum transfer, full responsive/lifecycle qualification and the other independent-audit findings remain open. Recorded motion and selected-frame self-review are not owner acceptance.",
    "The production fog passage still has a measured GPU cost regression. This record does not claim finished performance or readiness for final owner acceptance.",
  ],
};
await fs.writeFile(destination, JSON.stringify(record, null, 2) + "\n");
console.log(
  JSON.stringify({ destination, before: record.moon.before, after: record.moon.after, captures: captures.length }),
);
