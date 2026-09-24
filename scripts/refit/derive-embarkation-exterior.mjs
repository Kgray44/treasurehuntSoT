import sharp from "sharp";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const original = "public/images/muster/lantern-room.png",
  generated = ".runtime/embarkation/masters/room-exterior-inpaint-delta1.png",
  mask = "public/images/embarkation/derived/room-aperture.png";
const a = await sharp(original).removeAlpha().raw().toBuffer(),
  b = await sharp(generated).removeAlpha().raw().toBuffer(),
  m0 = await sharp(mask).greyscale().raw().toBuffer();
// Original RGB is retained where the reconstructed exterior agrees. Reject
// structural/light-spill pixels: copying a keyed blue gap from a prop into an
// exterior backing would create a floating piece of that prop.
const safe = Buffer.from(m0);
const smooth = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
for (let i = 0; i < safe.length; i++) {
  const difference = Math.max(...[0, 1, 2].map((c) => Math.abs(a[i * 3 + c] - b[i * 3 + c])));
  safe[i] *= 1 - smooth(10, 34, difference);
}
const m = await sharp(safe, { raw: { width: 1536, height: 1024, channels: 1 } })
  .blur(7)
  .greyscale()
  .raw()
  .toBuffer();
for (let i = 0; i < m.length; i++) m[i] = Math.min(m[i], safe[i]);
const out = Buffer.alloc(a.length);
for (let i = 0; i < m.length; i++)
  for (let c = 0; c < 3; c++)
    out[i * 3 + c] = Math.round((a[i * 3 + c] * m[i]) / 255 + b[i * 3 + c] * (1 - m[i] / 255));
await sharp(out, { raw: { width: 1536, height: 1024, channels: 3 } })
  .png()
  .toFile("public/images/embarkation/derived/room-exterior-continuous.png");
const provenance = {
  source: original,
  sourceSha256: createHash("sha256")
    .update(await readFile(original))
    .digest("hex"),
  generatedBacking: generated,
  generatedSha256: createHash("sha256")
    .update(await readFile(generated))
    .digest("hex"),
  mask,
  method:
    "Original RGB is preserved where a keyed exterior region agrees with the reconstructed backing. A seven-pixel feather and bounded color-difference confidence reject room and light-spill contamination. No supplied master changed.",
  derivative: "public/images/embarkation/derived/room-exterior-continuous.png",
};
await writeFile(".runtime/embarkation/delta1/exterior-provenance.json", JSON.stringify(provenance, null, 2));
