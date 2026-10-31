import sharp from "sharp";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
// Hand-authored matte regions and material depths, calibrated to the unchanged
// approved 1536x1024 painting. Masks are geometry data, not generated art.
const source = ".runtime/embarkation/masters/Voyagewright_Waiting_Room_Background.png";
const input = await readFile(source),
  dir = "public/images/embarkation/derived";
const { data, info } = await sharp(input).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const width = info.width,
  height = info.height;
const channels = [Buffer.alloc(width * height * 3), Buffer.alloc(width * height * 3), Buffer.alloc(width * height * 3)];
const aperture = Buffer.alloc(width * height);
const backingAperture = Buffer.alloc(width * height);
const smooth = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const inside = (x, y, poly) => {
  let yes = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i],
      b = poly[j];
    if (a[1] > y != b[1] > y && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) yes = !yes;
  }
  return yes;
};
const along = (x, y, line, radius) =>
  line.slice(1).some((b, i) => {
    const a = line[i],
      dx = b[0] - a[0],
      dy = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(x - a[0] - dx * t, y - a[1] - dy * t) < radius;
  });
const ropes = [
  {
    path: [
      [416, 261],
      [450, 279],
      [482, 284],
      [514, 278],
      [540, 252],
      [554, 211],
      [574, 148],
      [578, 119],
    ],
    r: 10,
  },
  {
    path: [
      [414, 288],
      [458, 305],
      [493, 309],
      [526, 303],
      [547, 285],
      [559, 262],
      [562, 205],
    ],
    r: 6,
  },
  {
    path: [
      [557, 275],
      [559, 292],
      [564, 293],
      [562, 239],
    ],
    r: 5,
  },
  {
    path: [
      [1088, 59],
      [1104, 115],
      [1115, 129],
      [1136, 137],
      [1158, 130],
      [1170, 111],
      [1187, 72],
    ],
    r: 10,
  },
  {
    path: [
      [1192, 85],
      [1176, 135],
      [1187, 164],
      [1210, 181],
      [1247, 189],
      [1274, 182],
      [1307, 159],
      [1345, 124],
      [1360, 94],
    ],
    r: 12,
  },
  {
    path: [
      [1310, 167],
      [1323, 205],
      [1340, 219],
      [1349, 184],
      [1340, 150],
    ],
    r: 9,
  },
];
const windows = [
  [
    [253, 153],
    [621, 129],
    [629, 496],
    [253, 484],
  ],
  [
    [704, 116],
    [846, 106],
    [848, 498],
    [704, 489],
  ],
  [
    [879, 105],
    [1234, 85],
    [1289, 496],
    [879, 496],
  ],
  [
    [1285, 91],
    [1384, 55],
    [1401, 477],
    [1337, 499],
  ],
  [
    [0, 48],
    [174, 42],
    [174, 148],
    [0, 122],
  ],
];
const table = [
  [250, 863],
  [300, 821],
  [422, 756],
  [571, 733],
  [690, 727],
  [773, 727],
  [946, 753],
  [1243, 813],
  [1536, 855],
  [1536, 1024],
  [249, 1024],
];
const mug = [
  [778, 628],
  [790, 623],
  [816, 619],
  [853, 619],
  [882, 623],
  [897, 628],
  [901, 635],
  [898, 645],
  [902, 641],
  [916, 641],
  [928, 650],
  [939, 672],
  [944, 697],
  [942, 723],
  [932, 746],
  [918, 755],
  [906, 756],
  [904, 767],
  [910, 778],
  [908, 786],
  [884, 796],
  [798, 797],
  [774, 787],
  [768, 774],
  [775, 750],
];
const candle = [
  [960, 753],
  [977, 740],
  [988, 743],
  [989, 700],
  [991, 675],
  [1007, 665],
  [1018, 673],
  [1020, 642],
  [1028, 615],
  [1036, 642],
  [1038, 673],
  [1052, 670],
  [1064, 678],
  [1070, 749],
  [1088, 753],
  [1096, 770],
  [1086, 801],
  [970, 804],
];
const chair = [
  [
    [1060, 604],
    [1081, 598],
    [1092, 610],
    [1080, 773],
    [1056, 768],
  ],
  [
    [1087, 612],
    [1125, 601],
    [1175, 594],
    [1244, 610],
    [1314, 637],
    [1316, 693],
    [1089, 656],
  ],
  [
    [1310, 637],
    [1329, 643],
    [1328, 668],
    [1288, 813],
    [1268, 807],
  ],
  [
    [1126, 663],
    [1141, 665],
    [1118, 784],
    [1102, 781],
  ],
  [
    [1189, 680],
    [1204, 684],
    [1173, 798],
    [1158, 794],
  ],
];
const couch = [
  [0, 478],
  [230, 484],
  [283, 476],
  [310, 498],
  [419, 500],
  [476, 514],
  [662, 523],
  [716, 510],
  [754, 520],
  [781, 566],
  [773, 716],
  [709, 742],
  [380, 826],
  [253, 857],
  [244, 927],
  [0, 956],
];
const right = [
  [1536, 0],
  [1358, 0],
  [1358, 433],
  [1311, 475],
  [1273, 465],
  [1234, 515],
  [1254, 555],
  [1224, 578],
  [1225, 612],
  [1322, 634],
  [1304, 789],
  [1536, 850],
];
const ceiling = [
  [0, 0],
  [1536, 0],
  [1536, 56],
  [1357, 77],
  [1333, 85],
  [1236, 87],
  [882, 110],
  [847, 113],
  [704, 121],
  [623, 133],
  [422, 151],
  [258, 158],
  [148, 145],
  [0, 126],
];
const left = [
  [0, 116],
  [151, 140],
  [177, 0],
  [255, 0],
  [258, 454],
  [250, 492],
  [0, 478],
];
const plants = [
    [257, 248],
    [335, 239],
    [408, 274],
    [451, 319],
    [426, 390],
    [550, 411],
    [595, 445],
    [616, 507],
    [515, 518],
    [391, 501],
    [301, 490],
    [280, 419],
  ],
  mid = [
    [711, 362],
    [749, 344],
    [785, 353],
    [827, 378],
    [840, 429],
    [823, 463],
    [825, 521],
    [790, 547],
    [712, 516],
  ];
const seat = [
  [772, 529],
  [795, 535],
  [815, 554],
  [875, 559],
  [898, 568],
  [949, 561],
  [956, 582],
  [947, 641],
  [921, 654],
  [867, 638],
  [815, 641],
  [796, 617],
];
const stool = [
  [
    [944, 509],
    [962, 503],
    [1017, 504],
    [1033, 515],
    [1026, 526],
    [956, 527],
  ],
  [
    [957, 523],
    [974, 526],
    [967, 595],
    [955, 617],
    [947, 614],
  ],
  [
    [1010, 525],
    [1025, 523],
    [1032, 606],
    [1022, 611],
    [1010, 590],
  ],
  [
    [960, 572],
    [1021, 573],
    [1022, 584],
    [958, 583],
  ],
];

for (let y = 0; y < height; y++)
  for (let x = 0; x < width; x++) {
    const i = y * width + x,
      r = data[i * 3],
      g = data[i * 3 + 1],
      b = data[i * 3 + 2];
    // Aperture is the entire outside, not a chroma-keyed image of the outside.
    // Keep only known room silhouettes within it; distant lights/rocks/water
    // highlights belong to the exterior and must not float on the window plane.
    let hole = windows.some((p) => inside(x, y, p)) ? 1 : 0;
    backingAperture[i] = hole * 255;
    if (hole) {
      const warm = smooth(0, 12, r - b) * smooth(-6, 8, g - b);
      const green = smooth(1, 12, g - b) * (1 - smooth(5, 20, b - r));
      const rail =
        (y >= 397 && y <= 416) ||
        (y >= 439 && y <= 454) ||
        ([
          [592, 611],
          [814, 841],
          [973, 998],
          [1104, 1128],
          [1222, 1249],
        ].some(([a, b]) => x >= a && x <= b) &&
          y >= 395);
      const foliage = inside(x, y, plants) || inside(x, y, mid);
      const rope = y < 322 && ropes.some(({ path, r }) => along(x, y, path, r));
      const lamps = [
        [279, 323, 151, 235],
        [491, 544, 295, 388],
        [710, 771, 89, 204],
        [1049, 1133, 103, 217],
      ];
      const lamp = lamps.some(([l, r, t, b]) => x >= l && x <= r && y >= t && y <= b);
      const telescope = inside(x, y, [
        [706, 218],
        [802, 201],
        [816, 200],
        [824, 217],
        [821, 234],
        [716, 258],
        [719, 281],
        [709, 331],
        [701, 330],
      ]);
      if (rope) hole *= 1 - warm;
      // Neutral white flame cores belong to the lantern, while the blue gaps
      // outside its iron silhouette remain a real hole.
      if (lamp) {
        hole *= 1 - Math.max(warm, smooth(135, 220, Math.min(r, g, b)));
      }
      if (x < 180 && y < 150) hole *= 1 - Math.max(warm, smooth(150, 220, Math.min(r, g, b)));
      if (rail) hole *= smooth(2, 14, b - r);
      if (foliage) hole *= 1 - Math.max(green, warm);
      // Cabinets and the shelf are interior, including the neutral dark wood.
      // Restrict this to their silhouettes, excluding distant pier lights.
      if (x < 625 && y > 365) hole *= smooth(0, 12, b - r);
      if (x > 704 && x < 838 && y > 404) hole *= smooth(0, 12, b - r);
      if (telescope) hole = 0;
      // Keep warm structural pixels on their room surface, even where a hand
      // contour includes blue gaps. The actual exterior moon remains outside.
      const moon = (x - 1167) ** 2 + (y - 240) ** 2 < 38 ** 2;
      if (y < 295 && !moon) hole *= 1 - smooth(4, 16, r - b);
      if ((rope || lamp || foliage) && r + g + b < 75) hole = 0;
      if (rail) hole *= 1 - smooth(-4, 9, r - b);
      // Hard structural silhouettes retain even blue-lit iron/wood. Chroma
      // alone leaks these pixels into the exterior and creates floating props.
      if (y < 164 - x * 0.058) hole = 0;
      if (rail) hole = 0;
      if ((x >= 590 && x <= 613 && y >= 332) || (x >= 812 && x <= 840 && y >= 351)) hole = 0;
      if (x >= 708 && x <= 743 && y >= 249 && y <= 390) hole = 0;
      const ironLamps = [
        [
          [282, 158],
          [291, 145],
          [302, 144],
          [318, 168],
          [326, 179],
          [320, 226],
          [309, 236],
          [294, 238],
          [279, 229],
          [280, 177],
        ],
        [
          [491, 328],
          [500, 314],
          [510, 301],
          [525, 303],
          [528, 314],
          [541, 329],
          [538, 375],
          [533, 385],
          [501, 388],
          [493, 377],
        ],
        [
          [712, 123],
          [724, 105],
          [732, 93],
          [744, 94],
          [750, 110],
          [769, 124],
          [763, 189],
          [759, 202],
          [718, 203],
          [712, 190],
        ],
        [
          [1057, 139],
          [1068, 119],
          [1082, 105],
          [1093, 107],
          [1109, 126],
          [1128, 138],
          [1125, 155],
          [1118, 197],
          [1112, 214],
          [1073, 215],
          [1065, 199],
        ],
      ];
      if (ironLamps.some((p) => inside(x, y, p)))
        hole = Math.min(hole, smooth(3, 17, b - r) * smooth(44, 80, Math.max(r, g, b)));
      // Solid cabinet and sign silhouettes can be cool-lit as well as warm.
      // They must not become blue holes in the room during parallax.
      if (x > 1350 && y > 172) hole = 0;
      if (x >= 253 && x <= 416 && y >= 374) hole = 0;
      if (x >= 383 && x <= 428 && y >= 130) hole = 0;
      if (x >= 846 && x <= 882 && y >= 104) hole = 0;
    }
    aperture[i] = Math.round(hole * 255);
    let layer = 0;
    if (inside(x, y, plants) || inside(x, y, mid) || inside(x, y, seat) || stool.some((p) => inside(x, y, p)))
      layer = 4;
    if (
      inside(x, y, left) ||
      inside(x, y, [
        [622, 67],
        [704, 64],
        [712, 521],
        [630, 519],
      ])
    )
      layer = 2;
    if (inside(x, y, right)) layer = 3;
    if (inside(x, y, ceiling)) layer = 1;
    if (inside(x, y, couch)) layer = 5;
    if (inside(x, y, table) || inside(x, y, mug) || inside(x, y, candle) || chair.some((p) => inside(x, y, p)))
      layer = 6;
    if (
      inside(x, y, [
        [903, 655],
        [915, 655],
        [925, 675],
        [930, 697],
        [926, 719],
        [917, 738],
        [906, 743],
        [900, 734],
        [900, 673],
      ])
    )
      layer = 0;
    // The closest approved lantern is separated from its ceiling. Its chain
    // remains on the overhead layer; the landmark passes near the virtual eye.
    if (
      inside(x, y, [
        [352, 0],
        [458, 0],
        [466, 138],
        [440, 159],
        [375, 158],
        [344, 138],
      ])
    )
      layer = 7;
    channels[Math.floor(layer / 3)][i * 3 + (layer % 3)] = 255;
  }
for (let i = 0; i < 3; i++)
  await sharp(channels[i], { raw: { width, height, channels: 3 } })
    .png()
    .toFile(`${dir}/room-mattes-${i}.png`);
await sharp(backingAperture, { raw: { width, height, channels: 1 } })
  .png()
  .toFile(`${dir}/room-backing-aperture.png`);
await sharp(aperture, { raw: { width, height, channels: 1 } })
  .png()
  .toFile(`${dir}/room-aperture.png`);
await sharp(".runtime/embarkation/room-midground-backing.png")
  .resize(width, height)
  .webp({ quality: 98 })
  .toFile(`${dir}/room-hidden-backing.webp`);
await sharp(".runtime/embarkation/room-overscan-clean.png").webp({ quality: 95 }).toFile(`${dir}/room-overscan.webp`);
// Review over contrasting backgrounds; the hole is physically absent.
const alpha = Buffer.alloc(width * height);
for (let i = 0; i < alpha.length; i++) alpha[i] = 255 - aperture[i];
const review = Buffer.alloc(width * height * 4);
for (let i = 0; i < width * height; i++) {
  review[i * 4] = data[i * 3];
  review[i * 4 + 1] = data[i * 3 + 1];
  review[i * 4 + 2] = data[i * 3 + 2];
  review[i * 4 + 3] = alpha[i];
}
await sharp(review, { raw: { width, height, channels: 4 } })
  .png()
  .toFile(".runtime/embarkation/room-aperture-review.png");
const manifestPath = "Development_Docs/Projects/Voyagewright_Refit_V1/embarkation/asset-manifest.json";
const manifest = JSON.parse(await readFile(manifestPath, "utf8")),
  row = manifest.assets.find((a) => a.source === "Voyagewright_Waiting_Room_Background.png");
Object.assign(row, {
  sourceClass: "MULTI_ELEMENT",
  production: true,
  usableRegions: [
    "window frame and balcony rail",
    "ceiling and overhead beams",
    "left timber wall and sign",
    "right timber/candle structure",
    "plants and midground furniture",
    "couch and cushions",
    "foreground table, chair, candles and objects",
    "nearest hanging lantern",
    "keyed exterior aperture",
  ].map((element) => ({
    element,
    region: "hand-authored polygons in scripts/refit/derive-embarkation-environment.mjs",
  })),
  derivativeFiles: [
    ...new Set([
      ...(row.derivativeFiles ?? []),
      "derived/room-overscan.webp",
      "derived/room-mattes-0.png",
      "derived/room-mattes-1.png",
      "derived/room-mattes-2.png",
      "derived/room-aperture.png",
      "derived/room-backing-aperture.png",
      "derived/room-hidden-backing.webp",
    ]),
  ],
  alphaCleanup:
    "Window blue key constrained by hand-drawn aperture contours; ropes, wood, lanterns and vegetation retained. Original RGB remains authoritative. Packed one-hot region masks contain no painted rectangles.",
  blendMode: "normal premultiplied alpha; spatial masked projection",
  depthBands: ["balcony frame", "ceiling / walls", "mid furniture", "foreground couch / table", "near hanging lantern"],
  deformationAllowed: false,
  lightingResponse: true,
  nearCameraAllowed: true,
  maximumDisplayPixels: 3072,
  scaleLimitations:
    "Original full-resolution painting projected through fixed 2.5D surfaces. Generated overscan continues the ceiling and outer walls beyond the original bounds. Reconstructed backing fills disoccluded furniture areas. At the final camera, the original painting remains authoritative.",
  emitterSystem: false,
  omissionReason: null,
  hiddenAreaBacking: {
    tool: "built-in image_gen",
    sourceSha256: createHash("sha256").update(input).digest("hex"),
    generation: "exec-96b5ea36-d288-4a84-8b0f-d415a995e540",
    purpose:
      "remove nearest couch/table and reconstruct complete midground furniture and floor behind them; preserve original architecture",
    promptFile: "Development_Docs/Projects/Voyagewright_Refit_V1/embarkation/room-midground-prompt.txt",
    runtimeFile: "derived/room-hidden-backing.webp",
  },
  overscan: {
    tool: "built-in image_gen",
    generations: ["exec-c5b88b35-d1c1-46af-9b07-daadf685cadf", "exec-f65d6f20-d0e2-459d-b82c-3d084a3917fc"],
    purpose:
      "continue only hidden ceiling/wall edges, removing the closest lantern from the extension so its separated layer is not duplicated",
    promptFiles: ["room-overscan-prompt.txt", "room-overscan-clean-prompt.txt"],
    sourceRegistration: { scale: 0.807, x: 175, y: 125, width: 1586, height: 992 },
    runtimeFile: "derived/room-overscan.webp",
  },
});
row.derivatives = [];
for (const file of row.derivativeFiles) {
  const bytes = await readFile(`public/images/embarkation/${file}`),
    m = await sharp(bytes).metadata();
  row.derivatives.push({
    file,
    bytes: bytes.length,
    width: m.width,
    height: m.height,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  });
}
row.productionBytes = row.derivatives.reduce((n, d) => n + d.bytes, 0);
row.textureBytesRGBA = row.derivatives.reduce((n, d) => n + d.width * d.height * 4, 0);
row.runtimeImage = "/images/muster/lantern-room.png (unchanged approved original)";
row.alphaRange = [0, 255];
manifest.productionBytes = manifest.assets.reduce((n, a) => n + (a.productionBytes ?? 0), 0);
manifest.textureBytesRGBA = manifest.assets.reduce((n, a) => n + (a.textureBytesRGBA ?? 0), 0);
await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
console.log("Derived eight spatial room mattes, exterior aperture, and hidden floor/wall backing.");
