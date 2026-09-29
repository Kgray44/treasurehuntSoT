import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

const root = ".runtime/embarkation/audit-repair";
const destination = "Development_Docs/Projects/Voyagewright_Refit_V1/embarkation/audit-room-continuity.json";
const sha = async (path) =>
  createHash("sha256")
    .update(await fs.readFile(path))
    .digest("hex");
const sourcePaths = (await fs.readdir("src/animation/embarkation"))
  .filter((name) => /\.(ts|tsx|css)$/.test(name))
  .map((name) => `src/animation/embarkation/${name}`);
const sourceSha256 = Object.fromEntries(await Promise.all(sourcePaths.map(async (p) => [p, await sha(p)])));
// A later invocation may refresh players, but must never relabel old frames as
// evidence of a new runtime. The source seal is created beside the recordings.
const seal = `${root}/room-final-source-20260929.json`;
let prior;
try {
  prior = JSON.parse(await fs.readFile(seal, "utf8"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
if (prior && JSON.stringify(prior.sourceSha256) !== JSON.stringify(sourceSha256))
  throw new Error("Runtime changed since capture: preserve this evidence and record a new source revision.");
if (!prior) await fs.writeFile(seal, JSON.stringify({ sourceSha256 }, null, 2) + "\n");

const captures = [];
for (const name of ["half", "quarter", "full-1x"]) {
  const path = `${root}/embarkation-room-final-${name}-20260929.json`;
  const capture = JSON.parse(await fs.readFile(path, "utf8"));
  const player = path.replace(".json", ".html");
  execFileSync(process.execPath, ["scripts/refit/native-capture-player.mjs", path, player]);
  captures.push({
    path,
    player,
    sha256: await sha(path),
    frames: capture.frames.length,
    method: capture.method,
    from: capture.from,
    rate: capture.rate,
    audio: capture.audio,
    start: capture.start,
    end: capture.end,
    timestampSpanSeconds: capture.frames.at(-1).metadata.timestamp - capture.frames[0].metadata.timestamp,
  });
}
const nativePath = `${root}/embarkation-room-final-qualification-20260929.json`;
const native = JSON.parse(await fs.readFile(nativePath, "utf8"));
const assets = [
  "public/images/muster/lantern-room.png",
  "public/images/embarkation/derived/room-overscan.webp",
  "public/images/embarkation/derived/room-reconciliation-mask.png",
];
const record = {
  classification: "engineering-evidence",
  status: "PARTIAL - broader audit remains open",
  auditIds: ["EMB-AUD-06", "EMB-AUD-07", "EMB-AUD-09", "EMB-AUD-10", "EMB-AUD-11", "EMB-AUD-19"],
  recordedAt: new Date().toISOString(),
  baseHead: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  sourceState: "Uncommitted owned candidate. No publication or owner acceptance.",
  sourceSha256,
  assetSha256: Object.fromEntries(await Promise.all(assets.map(async (p) => [p, await sha(p)]))),
  repairs: [
    "Focus follows the visible opening while the threshold lamp lies behind the eye. Stop down continuously over 29.3-31s before the spatial scene becomes the canonical room projection; retain temporal exposure on incoming material.",
    "Reuse the preserved clean ceiling/wall continuation and its measured source registration. The prior 56px upper margin exhausted at the 1280x720 crop (V=1.08444 required versus 1.06707 supported); the clean backing has 125px above the source.",
    "Place the nearest room lantern at Z=490 in front of the ceiling's Z<=480. Its former Z=-1782 hid its upper housing until the room flattened. The accepted source painting and final geometry stay unchanged.",
    "Preserve ceiling continuation beneath the restoring application shell until 32.3s; no black header-sized cut at 31s. Preserve the separated lantern's material ownership across that mask.",
    "Apply late aperture reconciliation on the existing water, sky and pier geometry. Their opaque depths blocked the previous far-plane correction. The original data mask still confines the residual to the opening; there is no new whole-frame environment dissolve.",
    "Register the moon quad diameter to the 24px painted source disc through the actual room crop. Transfer disc ownership to the matching sky material at convergence rather than doubling the disc.",
  ],
  native: { path: nativePath, sha256: await sha(nativePath), boundary: native.boundary, coverage: native.coverage },
  captures,
  observations: [
    "Native threshold frames at 27, 27.8, 28.6, 29.4, 30.2 and 30.9 exposed the focus/ceiling defects; current corrected frames and selected moving-capture frames were inspected again.",
    "Current full recording completed the 35.8s program and continued to roughly 45s of native timestamps, retaining more than eight seconds of living room ambience.",
    "No out-of-range magenta coverage pixels in fifteen environment-only samples across 390x844, 1024x768 and 2560x1080 at DPR1.25. These are renderer resize samples, not complete fresh responsive-entry qualification.",
    "Frozen environment boundary differs by approximately 0.09 mean RGBA byte; residual high differences are localized at alpha-matte contours. This is not a claim of exact pixel equality or canonical-DOM handoff qualification.",
  ],
  limitations: [
    ...native.limits,
    "Earlier storm/fog concealment, moon bearing/reflection continuity, hero material backfaces, global linear lighting, event audio, responsive live DOM and production profiling still require repair/qualification.",
    "The nine-sample aperture remains a bounded approximation. These captures are Chromium154 on the RTX5070 Laptop, development mode, not universal hardware or browser acceptance.",
    "No data, role, readiness or owner-fixture mutation was used to improve the screening.",
  ],
};
await fs.writeFile(destination, JSON.stringify(record, null, 2) + "\n");
console.log(`Recorded ${captures.length} source-bound captures and native room continuity checks.`);
