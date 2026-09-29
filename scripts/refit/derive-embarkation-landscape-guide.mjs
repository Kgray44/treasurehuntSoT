import sharp from "sharp";
// Original RGB is retained losslessly beneath the supplied cutout's alpha.
// Its RGB hash is verified against the preserved approved master in evidence.
const [
  base = "public/images/embarkation/derived/stage-islands.png",
  output = ".runtime/embarkation/audit-repair/stage-b-fill-guide.png",
] = process.argv.slice(2);
const { data, info } = await sharp(base).removeAlpha().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const masks = await Promise.all(
  ["islands", "middle", "near", "rocks"].map(async (n) => {
    const { data } = await sharp(`public/images/embarkation/derived/stage-${n}.png`)
      .ensureAlpha()
      .extractChannel(3)
      .raw()
      .toBuffer({ resolveWithObject: true });
    return data;
  }),
);
const remove = Buffer.alloc(info.width * info.height);
for (let y = 0; y < info.height; y++)
  for (let x = 0; x < info.width; x++) {
    const i = y * info.width + x;
    remove[i] = Math.max(...masks.map((m) => m[i]));
    // Celestial disc/reflection are a separately registered renderer source.
    if ((x - 459) ** 2 + (y - 537) ** 2 < 32 ** 2 || (y > 585 && x > 411 && x < 504)) remove[i] = 255;
  }
const radius = 48,
  horizontal = Buffer.alloc(remove.length),
  expanded = Buffer.alloc(remove.length);
for (let y = 0; y < info.height; y++)
  for (let x = 0; x < info.width; x++) {
    let max = 0;
    for (let dx = -radius; dx <= radius; dx++)
      if (x + dx >= 0 && x + dx < info.width) max = Math.max(max, remove[y * info.width + x + dx]);
    horizontal[y * info.width + x] = max;
  }
for (let y = 0; y < info.height; y++)
  for (let x = 0; x < info.width; x++) {
    let max = 0;
    for (let dy = -radius; dy <= radius; dy++)
      if (y + dy >= 0 && y + dy < info.height) max = Math.max(max, horizontal[(y + dy) * info.width + x]);
    expanded[y * info.width + x] = max;
  }
for (let i = 0; i < remove.length; i++) data[i * 4 + 3] = 255 - expanded[i];
await sharp({ create: { width: 2848, height: 1328, channels: 4, background: "#00000000" } })
  .composite([
    {
      input: await sharp(data, { raw: { ...info, channels: 4 } })
        .png()
        .toBuffer(),
      left: 588,
      top: 48,
    },
  ])
  .png()
  .toFile(output);
