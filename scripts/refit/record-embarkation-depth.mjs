import fs from "node:fs/promises";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

// Summarize existing native captures; never manufacture browser observations.
const base = ".runtime/embarkation/audit-repair";
const destination = "Development_Docs/Projects/Voyagewright_Refit_V1/embarkation";
const sha = async (path) =>
  crypto
    .createHash("sha256")
    .update(await fs.readFile(path))
    .digest("hex");
const sourcePaths = (await fs.readdir("src/animation/embarkation"))
  .filter((name) => /\.(ts|tsx|css)$/.test(name))
  .map((name) => `src/animation/embarkation/${name}`);
const sourceSha256 = Object.fromEntries(await Promise.all(sourcePaths.map(async (path) => [path, await sha(path)])));
const clips = await Promise.all(
  ["crossing-1x", "lens-1x", "lens-quarter", "threshold-1x", "threshold-half", "threshold-quarter"].map(
    async (name) => {
      const path = `${base}/optical-${name}.json`,
        capture = JSON.parse(await fs.readFile(path, "utf8"));
      const player = `${base}/optical-${name}.html`;
      execFileSync(process.execPath, ["scripts/refit/native-capture-player.mjs", path, player]);
      return {
        path,
        player,
        sha256: await sha(path),
        rate: capture.rate,
        layer: capture.layer || "full compositor",
        frames: capture.frames.length,
        filmStart: capture.filmStart,
        filmEnd: capture.endState.time,
        wallSeconds: capture.frames.at(-1).metadata.timestamp - capture.frames[0].metadata.timestamp,
        endSnapshot: capture.endState,
      };
    },
  ),
);
const nativePath = `${base}/optical-qualification-current.json`;
const native = JSON.parse(await fs.readFile(nativePath, "utf8"));
const record = {
  classification: "engineering-evidence",
  status: "PARTIAL - full audit repair remains in progress",
  recordedAt: new Date().toISOString(),
  auditIds: ["EMB-AUD-06", "EMB-AUD-08", "EMB-AUD-10", "EMB-AUD-13", "EMB-AUD-14", "EMB-AUD-19"],
  branch: execFileSync("git", ["branch", "--show-current"], { encoding: "utf8" }).trim(),
  baseHead: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  sourceState: "Uncommitted existing candidate. No new commit, push, merge, deployment or owner acceptance.",
  sourceSha256,
  depth: {
    mechanism:
      "Shared opaque-core depth across environment, title, outgoing page, props and incoming canonical-DOM paint. Alpha below 0.995 does not create a holdout; zero-alpha/torn holes never occlude. Color uses preserved alpha and back-to-front center-Z ordering within each queue.",
    fog: "The same surface commands populate an owned DEPTH_COMPONENT24 target. Fog integrates physical ray length to the nearest opaque fragment; bilateral upsampling respects depth differences.",
    platformFinding:
      "A native default-MSAA-depth blit returned INVALID_OPERATION 1282. Replaying identical opaque holdouts into an owned depth-only attachment succeeded; runtime has no depth blit or CPU readback.",
    exceptions: [
      "The painted cloud background is non-solid; its extinction belongs to the volume.",
      "The final flat room projection is a CSS background, not literal Z=0 opaque geometry. Canonical UI must remain above it.",
    ],
    artisticDensity:
      "A broad world-space clear core preserves readable title contact while dense advected storm material surrounds it. It is not a screen-space glyph mask.",
    limitations: [
      "Environment and moving-surface color queues remain separated by the DOM-facing background copy. Cross-group soft coverage ordering is incomplete.",
      "Center-Z ordering is approximate for intersecting transparent surfaces. Partial-alpha and additive fragments still lack independent volume integration to their own depth.",
      "Light-path attenuation, full color pipeline and production cost qualification remain open.",
    ],
  },
  threshold: {
    reproduction:
      "Shared per-fragment depth exposed an infinite sea cutting across room flooring and a rigid pier registered at an unrelated depth; the earlier painter order had hidden both errors.",
    repair:
      "Clip the exterior sea at the physical opening Z=-2722.5. Derive rigid-pier depth from the same sea plane and its source alpha waterline row 452, across room crops.",
    observation:
      "Inspected native rendered 29.5s and 30.2s frames and selected frames of recorded 1x/0.5x/0.25x entry. Water remains outside and pier foot meets the sea. These are actual moving-app captures, not a claim of uninterrupted perceptual screening.",
    remaining:
      "Full supported viewport path, hidden backing, late exterior restoration/moon-size continuity and final DOM handoff remain unqualified.",
  },
  lensWater: {
    correctedDiagnosis:
      "The bottom-center wedge at approximately19s is visible with paper/title/props disabled in lens isolation. Earlier ledger attribution to paper over water was incorrect.",
    repair:
      "Replace indefinite bulb stretching and a trail reusing a zero bulb normal with compact area-preserving beads, independently approaching/coalescing beads, and locally draining film with its own height/normal/refraction. The optical displacement uses viewport-normalized slopes.",
    model:
      "Bounded deterministic thin-film approximation with authored impact times; not a general fluid solver. Coalescence preserves the analytic center of mass. Event IDs are exposed, but actor-hit and sound bindings are not yet completed.",
    observations:
      "The former wedge is absent in the current19s native frame. The textured optical probe records a visible trailing-film pixel difference and no pixels changed before/after cleanup at20.32s.",
    remaining:
      "Tie selected actual spray contacts and foley to the shared impact events; broaden final-compositor and viewport screening before closing EMB-AUD-13.",
  },
  native: { path: nativePath, sha256: await sha(nativePath), depth: native.qualification, lens: native.lens },
  browser: {
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36",
    origin: "http://127.0.0.1:3148",
    quality: "CINEMATIC",
    viewport: { width: 1280, height: 720, dpr: 1.25 },
    method: "Native Chromium Page.startScreencast JPEG90, every second frame; original timestamps retained",
    audio: false,
    clips,
    scope:
      "Selected recorded frames inspected. No claim of hearing audio, uninterrupted full35.8s screening, mobile/browser qualification, or owner acceptance.",
  },
  validation: {
    focused: "84 tests in20files passed: npx vitest run src/animation/embarkation",
    typecheck: "npx tsc --noEmit passed after regenerating malformed task-owned Next.js dev type cache",
    performance:
      "Current five-second full-compositor crossing and six-second threshold clips report approximately60Hz and16.8ms p95. Development capture only, not production-shaped profiling. Earlier uneven-frame capture remains historical contrary evidence, with cause not attributed.",
  },
  historical: [
    "Previously saved embarkation-depth-threshold-1x.json precedes the water/pier correction and records that defect.",
    "embarkation-lens-repair-half.json precedes the final trail-width and resolution-normalization change. It is not same-source proof.",
    "Older title and landscape captures retain their own exact source records; they are not automatically current full-film qualification.",
  ],
  documentationReview:
    "Product/status/reference guides and changelog reviewed. Partial corrections do not change completed feature catalog capabilities.",
};
await fs.writeFile(`${destination}/audit-depth-and-optics.json`, JSON.stringify(record, null, 2) + "\n");
const ledgerPath = `${destination}/audit-reconciliation.json`,
  ledger = JSON.parse(await fs.readFile(ledgerPath, "utf8"));
for (const id of record.auditIds) {
  const entry = ledger.entries.find((e) => e.id === id);
  entry.repairStatus = "IN_PROGRESS";
  entry.proof = [
    ...new Set([
      ...entry.proof,
      "audit-depth-and-optics.json: native depth/fog/optical probes, source-bound clips, threshold water/pier repair and remaining limits",
    ]),
  ];
  if (id === "EMB-AUD-06")
    Object.assign(entry, {
      source:
        "depth-compositor.ts; renderer.ts; paint-surface.ts; environment.ts; atmosphere.ts; depth-qualification.ts",
      remaining:
        "Shared opaque cores and surface-limited fog now have native pixel proof. Cross-group soft ordering, intersecting transparent geometry, translucent/additive fog transport and final-room geometric holdouts remain open. The19s wedge was lens water, not paper; see EMB-AUD-13.",
    });
  if (id === "EMB-AUD-08")
    entry.remaining =
      "Native homogeneous slabs pass within0.426byte. Transparent-fragment integration, light-path transport, hidden-edit contrast and production cost remain open.";
  if (id === "EMB-AUD-10")
    entry.remaining =
      "Stage C sea is bounded at the opening; pier depth is calibrated to the same water surface. Desktop threshold captures retained. Full viewport/browser paths, late moon/exterior restoration and production qualification remain required.";
  if (id === "EMB-AUD-13")
    Object.assign(entry, {
      source: "lens-water.ts; lens-qualification.ts; atmosphere.ts",
      reproduction:
        "Native lens-only19s rendering reproduced the apparent paper wedge. Old runoff stretched without bound; trailing film reused a zero bulb normal and produced no meaningful refraction.",
      remaining:
        "Compact beads, coalescence and draining/refracting trails have focused/native proof. Actual spray-hit and sound event bindings, viewport matrix and full uninterrupted screening remain required.",
    });
}
await fs.writeFile(ledgerPath, JSON.stringify(ledger, null, 2) + "\n");
console.log(
  JSON.stringify({
    record: `${destination}/audit-depth-and-optics.json`,
    clips: clips.length,
    depthPass: native.qualification.pass,
    lensPass: native.lens.pass,
  }),
);
