import sharp from "sharp";
import { readFile, writeFile, copyFile } from "node:fs/promises";
import { createHash } from "node:crypto";

// These contours isolate the approved Chronicle painting, not generated scenery.
// Supporting fill is used exclusively behind occluders and outside its crop.
const root = ".runtime/embarkation/delta2";
const target = "public/images/embarkation/derived";
const source =
  ".runtime/muster/chronicle-assets/25423ce7-84c4-45e0-a60c-7bf463dddbd0/782a265b-7dff-485c-b9ef-d28d14fbeade.png";
const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const w = info.width,
  h = info.height;
const shapes = {
  islands: [
    [362, 590],
    [423, 567],
    [455, 549],
    [486, 564],
    [518, 536],
    [552, 542],
    [578, 517],
    [601, 483],
    [616, 475],
    [633, 503],
    [653, 491],
    [673, 450],
    [699, 408],
    [712, 406],
    [727, 444],
    [749, 397],
    [773, 386],
    [794, 369],
    [815, 373],
    [824, 330],
    [841, 282],
    [855, 326],
    [870, 304],
    [894, 229],
    [916, 185],
    [940, 166],
    [956, 164],
    [972, 195],
    [983, 228],
    [992, 285],
    [1012, 356],
    [1026, 419],
    [1052, 462],
    [1067, 371],
    [1081, 346],
    [1095, 358],
    [1106, 411],
    [1121, 414],
    [1136, 380],
    [1147, 392],
    [1161, 465],
    [1183, 428],
    [1204, 399],
    [1231, 413],
    [1241, 459],
    [1260, 461],
    [1289, 505],
    [1311, 552],
    [1350, 584],
  ],
  middle: [
    [52, 608],
    [78, 598],
    [97, 594],
    [125, 577],
    [137, 549],
    [155, 531],
    [174, 523],
    [180, 501],
    [191, 489],
    [202, 509],
    [209, 542],
    [220, 551],
    [227, 578],
    [265, 586],
    [291, 608],
    [213, 619],
    [100, 619],
  ],
  near: [
    [1057, 723],
    [1111, 678],
    [1125, 634],
    [1157, 599],
    [1176, 584],
    [1180, 550],
    [1194, 537],
    [1209, 552],
    [1216, 517],
    [1230, 498],
    [1247, 479],
    [1259, 493],
    [1264, 540],
    [1282, 502],
    [1291, 461],
    [1303, 448],
    [1310, 378],
    [1326, 314],
    [1345, 299],
    [1360, 306],
    [1371, 304],
    [1387, 334],
    [1402, 379],
    [1416, 427],
    [1432, 405],
    [1447, 369],
    [1461, 360],
    [1476, 357],
    [1492, 391],
    [1503, 403],
    [1514, 427],
    [1534, 429],
    [1556, 429],
    [1577, 393],
    [1594, 391],
    [1610, 414],
    [1638, 440],
    [1672, 457],
    [1672, 941],
    [1320, 941],
    [1430, 884],
    [1534, 811],
    [1496, 774],
    [1290, 755],
  ],
  rocks: [
    [104, 697],
    [126, 665],
    [140, 670],
    [157, 692],
    [188, 683],
    [235, 691],
    [282, 676],
    [306, 680],
    [331, 666],
    [357, 658],
    [366, 644],
    [387, 644],
    [401, 674],
    [423, 666],
    [439, 646],
    [453, 649],
    [470, 683],
    [500, 681],
    [514, 670],
    [536, 686],
    [551, 670],
    [566, 661],
    [593, 648],
    [609, 616],
    [629, 588],
    [644, 590],
    [654, 613],
    [676, 635],
    [698, 661],
    [731, 677],
    [779, 691],
    [657, 718],
    [449, 723],
    [263, 718],
  ],
};
function inside(x, y, points) {
  let yes = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i],
      b = points[j];
    if (a[1] > y !== b[1] > y && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) yes = !yes;
  }
  return yes;
}
const files = [];
for (const [name, points] of Object.entries(shapes)) {
  const alpha = Buffer.alloc(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (inside(x + 0.5, y + 0.5, points)) alpha[y * w + x] = 255;
  const feather = await sharp(alpha, { raw: { width: w, height: h, channels: 1 } })
    .blur(0.45)
    .greyscale()
    .raw()
    .toBuffer();
  const rgba = Buffer.from(data);
  for (let i = 0; i < w * h; i++) rgba[i * 4 + 3] = feather[i];
  const file = `stage-${name}.png`;
  await sharp(rgba, { raw: { width: w, height: h, channels: 4 } })
    .png()
    .toFile(`${target}/${file}`);
  files.push(file);
}
for (const [sourceName, name] of [
  ["stage-distant-backing-master.png", "stage-distant.webp"],
  ["stage-water-backing-master.png", "stage-water-backing.webp"],
  ["stage-overscan-master.png", "stage-overscan.webp"],
  ["exterior-overscan-master.png", "exterior-overscan.webp"],
]) {
  await sharp(`${root}/${sourceName}`).webp({ quality: 95 }).toFile(`${target}/${name}`);
  files.push(name);
}
await copyFile(source, `${root}/stage-approved-master.png`);
const derivatives = [];
for (const file of files) {
  const b = await readFile(`${target}/${file}`),
    m = await sharp(b).metadata();
  derivatives.push({
    file: `derived/${file}`,
    sha256: createHash("sha256").update(b).digest("hex"),
    width: m.width,
    height: m.height,
    bytes: b.length,
  });
}
await writeFile(
  `${root}/stage-provenance.json`,
  JSON.stringify(
    {
      source,
      sourceSha256: createHash("sha256")
        .update(await readFile(source))
        .digest("hex"),
      sourceClass: "MULTI_ELEMENT",
      method:
        "Original pixel contour cutouts; generated sky/water hidden backing and overscan. Fixed projection planes at four depths, no image bending.",
      shapes,
      derivatives,
    },
    null,
    2,
  ) + "\n",
);
console.log("Derived four registered source-pixel landscape layers and four supporting matte surfaces.");
