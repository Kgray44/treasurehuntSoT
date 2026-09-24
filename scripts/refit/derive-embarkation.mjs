import sharp from "sharp";
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
const root = path.resolve("public/images/embarkation");
const masters = path.resolve(".runtime/embarkation/masters");
const manifestPath = "Development_Docs/Projects/Voyagewright_Refit_V1/embarkation/asset-manifest.json";
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
await mkdir(path.join(root, "derived"), { recursive: true });
// Each rectangle is an inspected useful element, never the entire source sheet.
const regions = {
  P8: [
    [0.012, 0.002, 0.33, 0.61],
    [0.35, 0.025, 0.635, 0.39],
    [0.35, 0.42, 0.39, 0.53],
    [0.75, 0.72, 0.235, 0.27],
  ],
  P9: [
    [0.292, 0.007, 0.264, 0.4],
    [0.535, 0.272, 0.425, 0.65],
  ],
  P12: [
    [0.422, 0.615, 0.101, 0.159],
    [0.535, 0.785, 0.072, 0.08],
    [0.249, 0.293, 0.162, 0.108],
  ],
  P10: [
    [0.296, 0.26, 0.06, 0.118],
    [0.133, 0.378, 0.05, 0.1],
    [0.614, 0.221, 0.034, 0.07],
    [0.772, 0.288, 0.029, 0.057],
  ],
  P11: [
    [0.02, 0.05, 0.5, 0.27],
    [0.3, 0.39, 0.53, 0.24],
    [0.56, 0.68, 0.41, 0.29],
  ],
  P13: [
    [0.025, 0.08, 0.83, 0.17],
    [0.29, 0.49, 0.61, 0.16],
    [0.1, 0.7, 0.64, 0.17],
  ],
  P14: [
    [0.7, 0.07, 0.15, 0.31],
    [0.08, 0.29, 0.12, 0.27],
    [0.53, 0.02, 0.12, 0.22],
    [0.3, 0.39, 0.13, 0.3],
  ],
  P15: [
    [0.046, 0.33, 0.04, 0.07],
    [0.36, 0.35, 0.04, 0.075],
    [0.7, 0.11, 0.07, 0.085],
    [0.82, 0.71, 0.07, 0.065],
  ],
};
const names = {
  P8: "scrap",
  P9: "ink",
  P12: "debris",
  P10: "particle",
  P11: "mist",
  P13: "light",
  P14: "spray",
  P15: "ember",
};
for (const row of manifest.assets) {
  const id = row.source.split("-")[0];
  const effect = ["P10", "P11", "P13", "P14", "P15"].includes(id);
  const multi = ["P8", "P9", "P12"].includes(id);
  row.sourceClass = effect ? "EFFECT_SOURCE" : multi ? "MULTI_ELEMENT" : row.production ? "OBJECT" : "REFERENCE_ONLY";
  row.usableRegions = [];
  row.derivativeFiles = [];
  row.blendMode = ["P10", "P13", "P15"].includes(id)
    ? "additive"
    : id === "P14"
      ? "soft-transmission"
      : "premultiplied-normal";
  row.depthBands = effect ? ["environment", "midground", "near-foreground"] : ["midground", "deep-background"];
  row.maximumDisplayPixels = effect
    ? id === "P11"
      ? 900
      : id === "P13"
        ? 500
        : id === "P14"
          ? 128
          : 32
    : id === "P1"
      ? 1600
      : 900;
  row.deformationAllowed = ["P1", "P4", "P7", "P8", "P11", "P14"].includes(id);
  row.lightingResponse = row.production;
  row.nearCameraAllowed = ["P1", "P5", "P6", "P7", "P8", "P14"].includes(id);
  row.emitterSystem = effect || id === "P12";
  row.alphaCleanup = row.treatment;
  if (/^stage-[AB]-/.test(row.source)) {
    row.alphaCleanup = "Opaque environment RGB; no alpha matte cleanup required.";
    row.deformationAllowed = true;
    row.depthBands = ["far-environment", "mid-environment", "projected-near-scenery"];
    row.maximumDisplayPixels = 4096;
    row.scaleLimitations = "Spatial depth projection only; never a near-camera flat poster.";
    row.usableRegions = [
      {
        name: "environment projection source",
        rect: { left: 0, top: 0, width: row.width, height: row.height },
        derivative: row.derivative,
      },
    ];
  }
  if (!regions[id]) {
    if (row.derivative) row.derivativeFiles.push(row.derivative);
    continue;
  }
  const { data, info } = await sharp(path.join(masters, row.source))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (const [index, r] of regions[id].entries()) {
    const rect = {
      left: Math.floor(r[0] * info.width),
      top: Math.floor(r[1] * info.height),
      width: Math.floor(r[2] * info.width),
      height: Math.floor(r[3] * info.height),
    };
    const pixels = await sharp(data, { raw: info }).extract(rect).raw().toBuffer();
    for (let y = 0; y < rect.height; y++)
      for (let x = 0; x < rect.width; x++) {
        const i = (y * rect.width + x) * 4;
        const lum = Math.max(pixels[i], pixels[i + 1], pixels[i + 2]) / 255;
        if (effect) {
          const u = (x / (rect.width - 1) - 0.5) * 2,
            v = (y / (rect.height - 1) - 0.5) * 2;
          const radius = Math.sqrt(u * u + v * v);
          const feather = Math.max(0, Math.min(1, (1 - radius) / 0.32));
          const floor = id === "P10" ? 0.22 : id === "P15" ? 0.12 : 0.055;
          const mask = Math.max(0, (lum - floor) / (1 - floor));
          pixels[i + 3] = Math.round(255 * mask * feather * feather * (3 - 2 * feather));
          for (let c = 0; c < 3; c++) pixels[i + c] = Math.min(255, Math.round(pixels[i + c] / Math.max(0.08, lum)));
        } else if (id === "P12") {
          const edge = Math.max(0, Math.min(1, x / 8, y / 8, (rect.width - x - 1) / 8, (rect.height - y - 1) / 8));
          pixels[i + 3] = Math.round(pixels[i + 3] * Math.max(0, Math.min(1, (lum - 0.12) / 0.25)) * edge);
        }
      }
    if (id === "P8") {
      // Keep the single physical scrap, removing disconnected offcuts belonging
      // to neighbouring atlas cells without trimming its torn soft perimeter.
      const labels = new Int32Array(rect.width * rect.height),
        sizes = [0];
      const queue = new Int32Array(labels.length);
      let label = 0;
      for (let start = 0; start < labels.length; start++) {
        if (labels[start] || pixels[start * 4 + 3] < 12) continue;
        label++;
        let head = 0,
          tail = 1;
        queue[0] = start;
        labels[start] = label;
        while (head < tail) {
          const current = queue[head++],
            x = current % rect.width;
          for (const next of [
            x > 0 ? current - 1 : -1,
            x < rect.width - 1 ? current + 1 : -1,
            current - rect.width,
            current + rect.width,
          ]) {
            if (next < 0 || next >= labels.length || labels[next] || pixels[next * 4 + 3] < 12) continue;
            labels[next] = label;
            queue[tail++] = next;
          }
        }
        sizes[label] = tail;
      }
      const keep = sizes.indexOf(Math.max(...sizes));
      for (let i = 0; i < labels.length; i++) if (labels[i] !== keep) pixels[i * 4 + 3] = 0;
    }
    let p = sharp(pixels, { raw: { width: rect.width, height: rect.height, channels: 4 } });
    if (!effect) p = p.trim({ threshold: 8 });
    const file = `derived/${names[id]}-${index}.webp`;
    const b = await p
      .resize({ width: id === "P11" ? 768 : effect ? 384 : 800, withoutEnlargement: true })
      .extend({ top: 2, bottom: 2, left: 2, right: 2, background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality: 94, alphaQuality: 100, effort: 4 })
      .toBuffer();
    await writeFile(path.join(root, file), b);
    const m = await sharp(b).metadata();
    row.usableRegions.push({
      name: `${names[id]}-${index}`,
      rect,
      derivative: file,
      width: m.width,
      height: m.height,
      bytes: b.length,
    });
    row.derivativeFiles.push(file);
  }
  // Only remove this task's exact obsolete generated sheet derivative, not sources.
  if (row.derivative) await rm(path.join(root, row.derivative), { force: true });
  delete row.derivative;
  row.alphaCleanup = effect
    ? "luminance unmatte, unassociated RGB, elliptical soft boundary; no sheet survives"
    : row.treatment;
}
const samples = [];
manifest.productionBytes = 0;
manifest.textureBytesRGBA = 0;
for (const row of manifest.assets) {
  row.productionBytes = 0;
  row.textureBytesRGBA = 0;
  row.derivatives = [];
  delete row.productionWidth;
  delete row.productionHeight;
  for (const file of row.derivativeFiles) {
    const bytes = await readFile(path.join(root, file));
    const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const effect = row.sourceClass === "EFFECT_SOURCE";
    let boundaryAlpha = 0;
    for (let x = 0; x < info.width; x++)
      boundaryAlpha = Math.max(boundaryAlpha, data[x * 4 + 3], data[((info.height - 1) * info.width + x) * 4 + 3]);
    for (let y = 0; y < info.height; y++)
      boundaryAlpha = Math.max(
        boundaryAlpha,
        data[y * info.width * 4 + 3],
        data[(y * info.width + info.width - 1) * 4 + 3],
      );
    if (effect && boundaryAlpha > 2) throw new Error(`Nontransparent effect boundary: ${file}`);
    row.derivatives.push({
      file,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      width: info.width,
      height: info.height,
      bytes: bytes.length,
      edgeAlphaMaximum: boundaryAlpha,
    });
    row.productionBytes += bytes.length;
    row.textureBytesRGBA += info.width * info.height * 4;
    if (row.source.startsWith("P")) samples.push({ file, bytes });
  }
  manifest.productionBytes += row.productionBytes;
  manifest.textureBytesRGBA += row.textureBytesRGBA;
  if (!row.production) row.omissionReason = "Composition/reference board; never a literal runtime layer.";
  if (row.source.startsWith("P3-") || row.source.startsWith("stage-B-"))
    row.runtimeUse =
      "Retained derivative for provenance; current program binds the actual published Chronicle cover instead.";
}
const composites = [];
for (const [index, sample] of samples.entries()) {
  const x = (index % 4) * 340,
    y = Math.floor(index / 4) * 205;
  for (const [side, color] of ["#082b30", "#ebce90"].entries()) {
    const thumbnail = await sharp(sample.bytes).resize({ width: 158, height: 167, fit: "inside" }).png().toBuffer();
    const m = await sharp(thumbnail).metadata();
    composites.push({
      input: Buffer.from(`<svg width="168" height="180"><rect width="168" height="180" fill="${color}"/></svg>`),
      left: x + side * 169,
      top: y + 23,
    });
    composites.push({
      input: thumbnail,
      left: x + side * 169 + Math.floor((168 - m.width) / 2),
      top: y + 23 + Math.floor((180 - m.height) / 2),
    });
  }
  composites.push({
    input: Buffer.from(
      `<svg width="338" height="22"><text x="5" y="16" font-family="Arial" font-size="12" fill="#eee">${sample.file}</text></svg>`,
    ),
    left: x,
    top: y,
  });
}
await sharp({
  create: { width: 1360, height: Math.ceil(samples.length / 4) * 205, channels: 3, background: "#142027" },
})
  .composite(composites)
  .png()
  .toFile(".runtime/embarkation/alpha-review.png");
manifest.alphaReview =
  "All transparent derivatives composited over dark teal and warm parchment; effect texture boundary alpha <= 2/255.";
await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
console.log("Classified every source; generated independent production pieces with provenance.");
