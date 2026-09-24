import sharp from "sharp";
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

// Supplied lossless masters are never changed. Run after extracting the owner ZIP
// into this task's .runtime/embarkation/masters directory.
const source = path.resolve(".runtime/embarkation/masters");
const output = path.resolve("public/images/embarkation");
const evidence = path.resolve("Development_Docs/Projects/Voyagewright_Refit_V1/embarkation");
await mkdir(output, { recursive: true });
await mkdir(evidence, { recursive: true });
const rows = [];
for (const file of (await readdir(source)).sort()) {
  if (!file.endsWith(".png")) continue;
  const bytes = await readFile(path.join(source, file));
  const metadata = await sharp(bytes).metadata();
  const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let minimum = 255,
    maximum = 0,
    transparent = 0;
  for (let i = 3; i < data.length; i += 4) {
    minimum = Math.min(minimum, data[i]);
    maximum = Math.max(maximum, data[i]);
    if (!data[i]) transparent++;
  }
  const actor = /^P\d+-/.test(file);
  const plate = /^stage-[AB]-/.test(file);
  const effect = /^P(10|11|13|14|15)-/.test(file);
  const debris = file.startsWith("P12-");
  const row = {
    source: file,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    bytes: bytes.length,
    width: metadata.width,
    height: metadata.height,
    alphaRange: [minimum, maximum],
    transparentFraction: transparent / (info.width * info.height),
    production: actor || plate,
    treatment: effect
      ? "remove dark matte; unassociate radiance; feather texture boundary"
      : debris
        ? "dark-matte suppression; feather boundary"
        : actor
          ? "retain RGBA; trim transparent margin"
          : plate
            ? "opaque environment RGB; preserve painted edges for spatial projection"
            : "reference only",
  };
  if (actor || plate) {
    if (effect || debris) {
      for (let y = 0; y < info.height; y++)
        for (let x = 0; x < info.width; x++) {
          const i = (y * info.width + x) * 4;
          const radiance = Math.max(data[i], data[i + 1], data[i + 2]) / 255;
          const edge = Math.min(
            x / (info.width * 0.075),
            (info.width - x - 1) / (info.width * 0.075),
            y / (info.height * 0.1),
            (info.height - y - 1) / (info.height * 0.1),
            1,
          );
          const feather = Math.max(0, edge * edge * (3 - 2 * edge));
          const mask = effect
            ? Math.max(0, (radiance - 0.055) / 0.945)
            : Math.min(1, Math.max(0, (radiance - 0.07) / 0.18));
          data[i + 3] = Math.round(data[i + 3] * mask * feather);
          if (effect && mask > 0.001)
            for (let c = 0; c < 3; c++) data[i + c] = Math.min(255, Math.round(data[i + c] / Math.max(0.12, radiance)));
        }
    }
    let pipeline = sharp(data, { raw: info });
    // Explicit transparent margins only; never trim an environment plate.
    if (actor && !effect && !debris) pipeline = pipeline.trim({ threshold: 8 });
    const derivative = file.replace(".png", ".webp");
    const result = await pipeline
      .resize({ width: plate ? 1920 : 1400, withoutEnlargement: true })
      .webp({ quality: plate ? 88 : 92, alphaQuality: 100, effort: 6 })
      .toBuffer();
    await writeFile(path.join(output, derivative), result);
    const m = await sharp(result).metadata();
    Object.assign(row, {
      derivative,
      productionBytes: result.length,
      productionWidth: m.width,
      productionHeight: m.height,
      textureBytesRGBA: m.width * m.height * 4,
    });
  }
  rows.push(row);
}
await writeFile(
  path.join(evidence, "asset-manifest.json"),
  JSON.stringify(
    {
      sourceArchive: "assets-embarkation.zip",
      masters: ".runtime/embarkation/masters",
      premultipliedUpload: false,
      composite:
        "Straight RGBA textures; fragment shader premultiplies final radiance once; ONE / ONE_MINUS_SRC_ALPHA blending.",
      assets: rows,
      productionBytes: rows.reduce((n, r) => n + (r.productionBytes || 0), 0),
      textureBytesRGBA: rows.reduce((n, r) => n + (r.textureBytesRGBA || 0), 0),
    },
    null,
    2,
  ) + "\n",
);
console.log(
  JSON.stringify({
    masters: rows.length,
    production: rows.filter((r) => r.production).length,
    bytes: rows.reduce((n, r) => n + (r.productionBytes || 0), 0),
  }),
);
