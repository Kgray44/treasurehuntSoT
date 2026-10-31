import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

const root = ".runtime/embarkation/audit-repair";
const sha = async path => createHash("sha256").update(await fs.readFile(path)).digest("hex");
const names = (await fs.readdir("src/animation/embarkation")).filter(n => /\.(ts|tsx|css)$/.test(n) && !n.includes(".test."));
const sourceSha256 = Object.fromEntries(await Promise.all(names.map(async n => {
  const path = `src/animation/embarkation/${n}`; return [path, await sha(path)];
})));
const seal = `${root}/color-source-20260929.json`;
try {
  const prior = JSON.parse(await fs.readFile(seal, "utf8"));
  if (JSON.stringify(prior.sourceSha256) !== JSON.stringify(sourceSha256)) throw new Error("Color evidence source changed; create a new capture and record.");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
  await fs.writeFile(seal, JSON.stringify({ sourceSha256 }, null, 2) + "\n", { flag: "wx" });
}
const nativePath = `${root}/embarkation-color-reference-20260929.json`;
const native = JSON.parse(await fs.readFile(nativePath, "utf8"));
if (!native.floating.passed || !native.fallback.passed) throw new Error("Native color references did not pass.");
const filmPath = `${root}/embarkation-color-film-20260929.json`;
const film = JSON.parse(await fs.readFile(filmPath, "utf8"));
const last = film.end.last;
if (last.rendererFailure || last.reason !== "completed") throw new Error(`Film did not arrive: ${last.reason}`);
const record = {
  classification: "engineering-evidence",
  status: "LINEAR COLOR REPAIR - broader optical and cinematic qualification remains IN_PROGRESS",
  auditIds: ["EMB-AUD-12", "EMB-AUD-06", "EMB-AUD-07", "EMB-AUD-14", "EMB-AUD-19"],
  recordedAt: new Date().toISOString(),
  baseHead: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  sourceSha256,
  productionBuildId: (await fs.readFile(".next-embarkation-production-audit/BUILD_ID", "utf8")).trim(),
  cause: "The shutter average alone decoded sRGB. Earlier illumination, mist/lens composites and alpha blending occurred in encoded bytes. Switching to float targets also exposed formerly clamped additive-alpha overflow and a default-framebuffer reset in the incoming adapter.",
  contract: {
    artwork: "Browser-normalized sRGB image input; SRGB8 decode before premultiplication; linear-premultiplied mip/filter storage. Masters unchanged.",
    masks: "RGBA8/R8 numeric data, no color conversion. Explicit aperture, reconciliation, backing, matte and living masks.",
    working: "Linear sRGB primaries, premultiplied coverage. RGBA16F scene, fog, lens and exposure targets; supported 4x MSAA on the measured GPU.",
    fallback: "SRGB8_ALPHA8 storage decodes and blends in linear light. It has bounded precision and clips radiance above one; the separate exposure fallback stores a decoded running mean in encoded RGBA8. Neither changes event timing or geometry.",
    lighting: "Authored palette/paint grades are explicit display-referred operations. Material illumination, atmospheric interpolation, scattering, lens composition and shutter integration operate in linear light. Additive RGB uses bounded over-coverage alpha.",
    css: "Canonical CSS paint and CSS blur retain their specified sRGB-domain blending/filtering inside an explicit display-referred group with shared depth, then return to linear light. Contiguous CSS surfaces share the conversion passes.",
    output: "One sRGB presentation transform for the displayed canvas; no automatic exposure, tone mapper or new room grade. The native background/DOM layering is retained.",
  },
  native: { path: nativePath, sha256: await sha(nativePath), result: native },
  film: {
    path: filmPath, player: filmPath.replace(".json", ".html"), sha256: await sha(filmPath),
    frames: film.frames.length, viewport: film.start.diagnostics.viewport,
    duration: film.frames.at(-1).metadata.timestamp - film.frames[0].metadata.timestamp,
    method: "Native CDP screencast, JPEG90, every second compositor frame, 1280x720 maximum; uninterrupted 1x silent playback plus more than eight seconds of ambience.",
    frameP50: last.frameP50, frameP95: last.frameP95, frameP99: last.frameP99, renderP95: last.renderP95,
    preloadMs: last.preloadMs, rendererFailure: last.rendererFailure, gpu: last.renderer.gpu,
    working: last.renderer.color,
  },
  validation: [
    "27 focused files / 108 tests passed. Production build and TypeScript passed; five existing Edge/NFT warnings remain.",
    "Native grayscale and accepted-room-art no-effect round trips have zero maximum byte error in both storage modes. Soft alpha edges, CSS alpha, additive light and 17 fog-gradient references have at most one byte error; no WebGL errors.",
    "Native selected frames inspected across pressure/release, crossing, landscape, fog, threshold, assembly and final room. Final DOM retains Kato as crew and Sera as Captain; no fixture data or permissions changed.",
  ],
  limitations: [
    "The float reference and forced sRGB fallback were exercised on Chromium/ANGLE/D3D11 with the RTX 5070 Laptop GPU, not independently on a device lacking float targets or every supported browser.",
    "Capture timing includes recording and development overhead; these frame distributions are not an isolated production GPU benchmark. Extra linear/MSAA/CSS targets increase memory and require the continuing performance qualification.",
    "Transparent-fragment fog ordering still exposes thin title-edge coverage differences. Broader depth/fog finishing, dynamic landing retargeting, current audiovisual review and the full browser/lifecycle matrix remain open. This is not a final owner-review acceptance claim.",
  ],
  references: [
    "https://registry.khronos.org/webgl/specs/latest/2.0/",
    "https://registry.khronos.org/webgl/extensions/EXT_color_buffer_float/",
    "https://www.w3.org/TR/filter-effects-1/",
  ],
};
const productionPath = `${root}/embarkation-color-production-film-20260929.json`;
try {
  const capture = JSON.parse(await fs.readFile(productionPath, "utf8"));
  record.productionFilm = { path: productionPath, sha256: await sha(productionPath), frames: capture.frames.length,
    duration: capture.frames.at(-1).metadata.timestamp - capture.frames[0].metadata.timestamp,
    start: capture.start, end: capture.end, method: capture.method };
} catch (error) { if (error.code !== "ENOENT") throw error; }
const destination = "Development_Docs/Projects/Voyagewright_Refit_V1/embarkation/audit-color-pipeline.json";
await fs.writeFile(destination, JSON.stringify(record, null, 2) + "\n");
console.log(JSON.stringify({ destination, frames: record.film.frames, native: { full: native.floating.passed, fallback: native.fallback.passed } }));
