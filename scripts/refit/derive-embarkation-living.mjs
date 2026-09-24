import sharp from "sharp";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const source = ".runtime/embarkation/masters/Voyagewright_Waiting_Room_Background.png";
const { data, info } = await sharp(source).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const w = info.width,
  h = info.height,
  masks = Buffer.alloc(w * h * 3);
const clamp = (x) => Math.max(0, Math.min(1, x));
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const lamps = [
  [348, 0, 466, 157],
  [277, 151, 327, 234],
  [706, 91, 772, 204],
  [1046, 105, 1133, 218],
  [488, 297, 546, 390],
];
const flames = [
  [1028, 674, 12, 61],
  [109, 471, 6, 34],
  [135, 477, 5, 28],
  [1297, 546, 6, 30],
  [1320, 526, 7, 37],
  [1340, 509, 7, 44],
  [501, 427, 4, 20],
  [686, 423, 5, 29],
  [404, 94, 7, 31],
  [301, 210, 4, 21],
  [735, 165, 5, 25],
  [1090, 178, 5, 25],
  [518, 364, 4, 23],
];
const hole = await sharp("public/images/embarkation/derived/room-aperture.png").removeAlpha().raw().toBuffer();
for (let y = 0; y < h; y++)
  for (let x = 0; x < w; x++) {
    const i = y * w + x,
      r = data[i * 3],
      g = data[i * 3 + 1],
      b = data[i * 3 + 2];
    for (const [j, [l, t, rr, bb]] of lamps.entries()) {
      if (x < l || x > rr || y < t || y > bb) continue;
      const u = (x - l) / (rr - l),
        v = (y - t) / (bb - t);
      const half = v < 0.12 ? 0.37 : v < 0.25 ? 0.44 : v < 0.77 ? 0.33 : 0.48;
      const contour = 1 - smooth(half - 0.018, half + 0.018, Math.abs(u - 0.5));
      const material = j === 0 ? 1 : smooth(-4, 9, r - b);
      masks[i * 3] = Math.round(Math.max(masks[i * 3] / 255, contour * material) * 255);
    }
    for (const [cx, cy, rx, hh] of flames) {
      const q = (cy - y) / hh;
      if (q < -0.03 || q > 1.12) continue;
      const limit = rx * (0.72 + 0.36 * Math.sin(q * Math.PI));
      const edge = 1 - smooth(limit, limit + 2, Math.abs(x - cx));
      const white = smooth(144, 219, r) * smooth(95, 190, g);
      masks[i * 3 + 1] = Math.round(Math.max(masks[i * 3 + 1] / 255, edge * white) * 255);
    }
    // Warm distant lamps already painted into the water share the same
    // displacement. Restrict their shimmer to the open band below the shore;
    // dim timber/pier structure is excluded by the luminance threshold.
    const reflectedWarm =
      smooth(115, 185, r) * smooth(85, 155, g) * smooth(8, 35, r - b) * smooth(330, 340, y) * (1 - smooth(373, 388, y));
    const water =
      ((smooth(316, 331, y) * (1 - smooth(480, 499, y)) * hole[i * 3]) / 255) *
      Math.max(smooth(7, 24, b - r) * smooth(40, 78, b), reflectedWarm);
    masks[i * 3 + 2] = Math.round(water * 255);
  }
const dir = "public/images/embarkation/derived";
await sharp(masks, { raw: { width: w, height: h, channels: 3 } })
  .png()
  .toFile(`${dir}/room-living-masks.png`);
await sharp(".runtime/embarkation/room-live-backing.png")
  .resize(w, h)
  .webp({ quality: 95 })
  .toFile(`${dir}/room-live-backing.webp`);
const path = "Development_Docs/Projects/Voyagewright_Refit_V1/embarkation/asset-manifest.json";
const manifest = JSON.parse(await readFile(path, "utf8")),
  row = manifest.assets.find((a) => a.source === "Voyagewright_Waiting_Room_Background.png");
for (const file of ["derived/room-living-masks.png", "derived/room-live-backing.webp"]) {
  if (!row.derivativeFiles.includes(file)) row.derivativeFiles.push(file);
  const bytes = await readFile(`public/images/embarkation/${file}`);
  row.derivatives = row.derivatives.filter((d) => d.file !== file);
  row.derivatives.push({
    file,
    bytes: bytes.length,
    width: w,
    height: h,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  });
}
row.livingEnvironment = {
  flames: flames.length,
  hangingLanterns: lamps.length,
  water: "masked original exterior water and painted reflections",
  cleanBacking:
    "built-in image_gen exec-aaa28147-1099-4f83-93ff-56f67a9cb420, used only under original moving flame/lantern silhouettes",
  promptFile: "Development_Docs/Projects/Voyagewright_Refit_V1/embarkation/room-live-backing-prompt.txt",
  reducedMotion:
    "no spatial water displacement; restrained reflection shimmer; lantern sway and flame deformation substantially suppressed",
  clock: "continuous film time plus ambient elapsed time; camera remains [0,0,0]",
};
row.productionBytes = row.derivatives.reduce((n, d) => n + d.bytes, 0);
row.textureBytesRGBA = row.derivatives.reduce((n, d) => n + d.width * d.height * 4, 0);
manifest.productionBytes = manifest.assets.reduce((n, a) => n + (a.productionBytes ?? 0), 0);
manifest.textureBytesRGBA = manifest.assets.reduce((n, a) => n + (a.textureBytesRGBA ?? 0), 0);
await writeFile(path, JSON.stringify(manifest, null, 2) + "\n");
console.log("Living materials: 13 wick-pinned flames, 5 suspended lanterns, quiet harbor water/reflections.");
