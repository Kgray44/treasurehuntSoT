import * as fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
const base = ".runtime/embarkation/audit-repair";
const sha = async (path) =>
  createHash("sha256")
    .update(await fs.readFile(path))
    .digest("hex");
const sourcePaths = (await fs.readdir("src/animation/embarkation"))
  .filter((name) => /\.tsx?$/.test(name))
  .map((name) => `src/animation/embarkation/${name}`);
sourcePaths.push("src/app/dev/embarkation/depth/depth-diagnostic.tsx");
const sourceSha256 = Object.fromEntries(await Promise.all(sourcePaths.map(async (path) => [path, await sha(path)])));
const qualificationPath = `${base}/exposure-qualification-current.json`;
const qualification = JSON.parse(await fs.readFile(qualificationPath, "utf8"));
const clips = await Promise.all(
  ["crossing-1x", "threshold-1x"].map(async (name) => {
    const path = `${base}/exposure-current-${name}.json`,
      player = `${base}/exposure-current-${name}.html`;
    const capture = JSON.parse(await fs.readFile(path, "utf8"));
    execFileSync(process.execPath, ["scripts/refit/native-capture-player.mjs", path, player]);
    return {
      path,
      player,
      sha256: await sha(path),
      frames: capture.frames.length,
      method: capture.method,
      viewport: capture.viewport,
      rate: capture.rate,
      audio: capture.audio,
      from: capture.filmStart,
      to: capture.endState.time,
      endSnapshot: capture.endState,
    };
  }),
);
const record = {
  classification: "engineering-evidence",
  status: "IN_PROGRESS - reference exposure qualified; performance and full film remain open",
  recordedAt: new Date().toISOString(),
  auditIds: ["EMB-AUD-05", "EMB-AUD-07", "EMB-AUD-08", "EMB-AUD-14", "EMB-AUD-19"],
  baseHead: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  sourceState: "Uncommitted owned candidate; no publication or owner acceptance",
  sourceSha256,
  mechanism: {
    exposure:
      "Actual geometry/alpha/depth at nine uniform time samples over an explicit 1/120-second shutter; paired thin-lens aperture samples and one focus authority. Five/three samples in Balanced/Performance preserve the physical interval.",
    coverage:
      "Samples include rotation, deformation, camera translation/roll, opaque holdouts, outgoing page, title, props, particles and incoming canonical-DOM paint. Center sample is presented last; canonical DOM styles are written once per displayed frame.",
    storage:
      "RGBA16F linear-premultiplied accumulation when supported; RGBA8 encoded weighted running-mean fallback. Exposure decodes/encodes displayed samples; this does not complete the broader linear lighting pipeline.",
    layering:
      "Full scene accumulated together before assembly; stable room and moving incoming surfaces accumulate separately during DOM-facing assembly. Full cross-group transparency/light transport remains incomplete.",
    focus:
      "Measured title depth while held, distant wonder focus, threshold lantern focus, then exact sharp resting plane. Old texture-space center smear and per-material depth blur removed.",
    optimization:
      "Exact planes use quads. Small distant props choose tessellation from projected curvature error estimate; near passes retain full mesh. Smooth depth-consistent fog may be reprojected only inside one exposure, with neighborhood contrast/depth rejection; no history survives into the next displayed frame. Inspector Full shutter reference disables these approximations.",
    preparation:
      "Exposure and both holdout targets allocated before playback. Framebuffer validation occurs only on allocation/resize. Actor birth-camera and exact-time shot values are cached; particles grouped once. Most exposure storage is released at ambient handoff.",
  },
  qualification: { path: qualificationPath, sha256: await sha(qualificationPath), ...qualification },
  clips,
  inspectionScope:
    "Selected captured frames and native mechanism/pixel checks; not a complete uninterrupted audiovisual acceptance screening.",
  historicalExperiments: [
    "The initial full-scene nine-sample reference measured development GPU median 81.28 ms / p95 141.49 ms during a partial 12.2-33.2s run. It is not a production profile.",
    "A permissive fog cache produced up to 74-byte edge errors and was rejected. A stricter cache measured <=3-byte maximum error across six sampled desktop frames before later pose/submission optimization.",
    "Native CPU sampling identified repeated framebuffer status checks, camera/pose recalculation and graphics synchronization. Earlier downloaded exposure clips predate the final source hashes here.",
  ],
  limits: [
    "Cinematic frame cost remains above the smooth playback target; no performance acceptance claim.",
    "Tessellation error is a curvature-based estimate, not a proven global bound; full viewport/near-angle motion screening remains required.",
    "Fog reuse freezes transported density for less than one shutter interval in eligible smooth regions. Native sampled comparisons do not establish all-frame or all-viewport equivalence.",
    "Nine shutter samples are finite quadrature; extreme near-lens velocity can expose sampling separation and needs motion screening.",
    "Actual shader color-space migration, soft cross-group ordering, alpha/additive volume transport, audio and the complete browser/input/viewport matrix remain open in the reconciliation ledger.",
  ],
};
await fs.writeFile(
  "Development_Docs/Projects/Voyagewright_Refit_V1/embarkation/audit-exposure.json",
  `${JSON.stringify(record, null, 2)}\n`,
);
console.log("Recorded native exposure evidence; no audit completion declared.");
