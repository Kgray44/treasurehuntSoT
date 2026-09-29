import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

const root = ".runtime/embarkation/audit-repair";
const sha = async (p) =>
  createHash("sha256")
    .update(await fs.readFile(p))
    .digest("hex");
const paths = (await fs.readdir("src/animation/embarkation"))
  .filter((n) => /\.(ts|tsx|css)$/.test(n))
  .map((n) => `src/animation/embarkation/${n}`);
paths.push("src/app/dev/embarkation/material/prop-diagnostic.tsx");
const sourceSha256 = Object.fromEntries(await Promise.all(paths.map(async (p) => [p, await sha(p)])));
const seal = `${root}/prop-material-source-20260929.json`;
let prior;
try {
  prior = JSON.parse(await fs.readFile(seal, "utf8"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
if (prior && JSON.stringify(prior.sourceSha256) !== JSON.stringify(sourceSha256))
  throw new Error("Runtime changed after native capture; retain the historical source seal.");
if (!prior) await fs.writeFile(seal, JSON.stringify({ sourceSha256 }, null, 2) + "\n");
const captures = [];
for (const rate of ["1x", "quarter"]) {
  const path = `${root}/embarkation-prop-material-${rate}-20260929.json`;
  const c = JSON.parse(await fs.readFile(path, "utf8")),
    player = path.replace(".json", ".html");
  execFileSync(process.execPath, ["scripts/refit/native-capture-player.mjs", path, player]);
  captures.push({
    path,
    player,
    sha256: await sha(path),
    frames: c.frames.length,
    method: c.method,
    from: c.from,
    rate: c.rate,
    audio: c.audio,
    start: c.start,
    end: c.end,
  });
}
const nativePath = `${root}/embarkation-prop-material-views-20260929.json`,
  native = JSON.parse(await fs.readFile(nativePath, "utf8"));
const assets = [
  "public/images/muster/parchment.png",
  ...["P1-map-fragment", "P2-compass", "P4-journal-page", "P7-sailcloth", "derived/scrap-2"].map(
    (n) => `public/images/embarkation/${n}.webp`,
  ),
];
const record = {
  classification: "engineering-evidence",
  status: "PARTIAL - full integrated qualification remains open",
  auditIds: ["EMB-AUD-16", "EMB-AUD-19"],
  recordedAt: new Date().toISOString(),
  baseHead: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  sourceState: "Uncommitted owned candidate; no owner acceptance or publication.",
  sourceSha256,
  assetSha256: Object.fromEntries(await Promise.all(assets.map(async (p) => [p, await sha(p)]))),
  repairs: [
    "Explicit per-asset reverse materials. Map, journal and scraps sample the unprinted center of the preserved Muster parchment; cloth adds filtered weave. Ink-only glyphs and typography remain exempt. There is no transmission of the front printing.",
    "Map and compass use prepared alpha-contour shells, including holes and torn margins, with separate faces and connecting edges. Thickness follows the deformed local normal. Other distant scraps retain economical sheets with cut-fiber rim shading.",
    "Directional face lighting replaces the absolute light/normal response; compass has a restrained brass reverse/specular response. Existing motion, seed and supplied front art are preserved.",
    "Native development diagnostic uses the production shaders, silhouette geometry and depth queue. It supports continuous rotation, neutral material and teal/warm backgrounds. No source art is edited.",
  ],
  native: {
    path: nativePath,
    sha256: await sha(nativePath),
    browser: native.browser,
    capturedAt: native.capturedAt,
    report: native.report,
    positiveControl: native.positive,
    gpuErrors: native.errors,
    unmodifiedViews: native.views.map((v, i) => ({
      asset: v.asset,
      angle: v.angle,
      background: v.background,
      path: `${root}/prop-native-view-${String(i).padStart(2, "0")}-20260929.png`,
    })),
  },
  captures,
  observations: [
    "Replacing all front RGB with bright magenta while preserving alpha changes 86,643-168,368 front pixels above 8 bytes, but zero reverse pixels for all five materials. Native reverse materials do not borrow the front printing.",
    "At exactly edge-on the map shell changes 595 pixels and compass shell 5,160 pixels relative to zero thickness in the 900x650 diagnostic. Ring apertures and torn outlines are preserved by the contour topology.",
    "Five assets sampled in 10-degree increments through a complete revolution without a WebGL error; selected front/reverse/edge views over teal and warm backgrounds saved unmodified.",
    "Current full-composite compass at7.84s and map at14.35s inspected. Two native silent captures retain normal and quarter speed; selected captured frames inspected. This is not a claim of uninterrupted audiovisual review.",
  ],
  checks: {
    focusedSuite: "24 files / 96 tests passed",
    typecheck: "passed before final diagnostic-only print-substitution extension",
  },
  limitations: [
    "Compass is shallow extruded artwork, not a fully modeled hinged instrument. Actual desktop seeded flight remained front-facing in the sampled path; full fresh viewport/quality screening remains required.",
    "Snag paper gets an unprinted reverse and fiber-edge response but still uses a zero-thickness constrained membrane. Hero-map bounded-strain work remains part of EMB-AUD-02.",
    "Selected storm frames still show heavy atmospheric occlusion and discrete near defocus; keep EMB-AUD-07/08 open.",
    "Recorded development cadence is roughly21-24FPS with capture and another diagnostic tab. No production performance qualification or attribution is claimed.",
    "Full film with event audio, material handoff, all viewport/fallback/input cases and draft-PR qualification remain incomplete.",
  ],
};
await fs.writeFile(
  "Development_Docs/Projects/Voyagewright_Refit_V1/embarkation/audit-prop-materials.json",
  JSON.stringify(record, null, 2) + "\n",
);
console.log("Recorded native prop-material proof and two source-bound silent captures.");
