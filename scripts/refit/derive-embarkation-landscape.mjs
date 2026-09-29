import sharp from "sharp";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

// Source/master files are immutable. The guide contains original pixels with
// explicit holes for disocclusion; generated fill is used only behind those
// holes and outside the measured frustum crop. No mirror/edge-repeat extension.
const [
  generated,
  guide,
  output = ".runtime/embarkation/audit-repair/stage-b-spatial-backing.png",
  recordPath = "Development_Docs/Projects/Voyagewright_Refit_V1/embarkation/audit-landscape-derivation.json",
] = process.argv.slice(2);
if (!generated || !guide) throw new Error("Expected generated fill, preserved-pixel guide, output path");
const generatedBytes = await readFile(generated),
  guideBytes = await readFile(guide);
const hash = (b) => createHash("sha256").update(b).digest("hex");
const width = 2848,
  height = 1293;
// The generator returned the requested aspect but shifted the horizon 35 px
// after resolution normalization. One registered translation corrects it;
// there is no per-row image warp. The unused bottom margin is discarded.
const fill = await sharp(generatedBytes)
  .resize(2848, 1328, { fit: "fill" })
  .extract({ left: 0, top: 35, width, height })
  .raw()
  .toBuffer();
const { data: protectedPixels } = await sharp(guideBytes)
  .extract({ left: 0, top: 0, width, height })
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const alpha = Buffer.alloc(width * height),
  delta = new Float32Array(width * height * 3);
for (let i = 0; i < alpha.length; i++) {
  // Reflections/foam from the removed land are not valid disocclusion backing.
  // Source land remains on the four original cutouts, never this water surface.
  alpha[i] = i / width < 48 + 580 ? protectedPixels[i * 4 + 3] : 0;
  for (let k = 0; k < 3; k++) delta[i * 3 + k] = ((protectedPixels[i * 4 + k] - fill[i * 3 + k]) * alpha[i]) / 255;
}
const feather = await sharp(alpha, { raw: { width, height, channels: 1 } })
  .blur(36)
  .greyscale()
  .raw()
  .toBuffer();
function diffuse(input, channels, radius = 80) {
  let a = Float32Array.from(input),
    b = new Float32Array(a.length);
  for (let pass = 0; pass < 3; pass++)
    for (const vertical of [false, true]) {
      const major = vertical ? width : height,
        minor = vertical ? height : width,
        stride = vertical ? width * channels : channels;
      for (let row = 0; row < major; row++)
        for (let k = 0; k < channels; k++) {
          const start = vertical ? row * channels + k : row * width * channels + k;
          let sum = 0;
          for (let j = 0; j <= radius; j++) sum += a[start + j * stride];
          for (let j = 0; j < minor; j++) {
            b[start + j * stride] = sum / (Math.min(minor - 1, j + radius) - Math.max(0, j - radius) + 1);
            if (j - radius >= 0) sum -= a[start + (j - radius) * stride];
            if (j + radius + 1 < minor) sum += a[start + (j + radius + 1) * stride];
          }
        }
      [a, b] = [b, a];
    }
  return a;
}
const smoothWeight = diffuse(
  Float32Array.from(alpha, (n) => n / 255),
  1,
);
const smoothDelta = diffuse(delta, 3);
const rgba = Buffer.alloc(width * height * 4);
let exactProtected = 0;
for (let i = 0; i < alpha.length; i++) {
  const a = alpha[i] > 0 ? Math.max(0, (feather[i] / 255 - 0.5) * 2) : 0;
  for (let k = 0; k < 3; k++) {
    const correction = smoothWeight[i] > 0.001 ? smoothDelta[i * 3 + k] / smoothWeight[i] : 0;
    const support = Math.min(1, Math.max(0, (smoothWeight[i] - 0.001) / 0.08));
    const matched = Math.max(0, Math.min(255, fill[i * 3 + k] + correction * support));
    rgba[i * 4 + k] = Math.round(protectedPixels[i * 4 + k] * a + matched * (1 - a));
  }
  rgba[i * 4 + 3] = 255;
  if (a === 1) exactProtected++;
}
await sharp(rgba, { raw: { width, height, channels: 4 } })
  .png()
  .toFile(output);
const final = await readFile(output);
const record = {
  classification: "engineering-evidence",
  status: "DERIVED_NOT_SCREENED",
  sourceGuideSha256: hash(guideBytes),
  generatedMasterSha256: hash(generatedBytes),
  derivativeSha256: hash(final),
  width,
  height,
  originalRect: { left: 588, top: 48, width: 1672, height: 941 },
  exactProtectedPixels: exactProtected,
  featherPixels: 36,
  colourMatchRadius: 80,
  masterRegistration: { normalizedSize: [2848, 1328], translationY: -35 },
  bounds: [-588 / 1672, -304 / 941, 1 + 588 / 1672, 1 + 48 / 941],
  limitations: [
    "Supporting fill is generated, not recovered source pixels.",
    "Moon/reflection integration is a separate open audit item.",
  ],
  generation: {
    tool: "built-in imagegen",
    purpose: "Fill source-registered guide holes and measured borders with matching sky and water; no new scenery.",
  },
};
await writeFile(recordPath, JSON.stringify(record, null, 2) + "\n");
console.log(JSON.stringify(record));
