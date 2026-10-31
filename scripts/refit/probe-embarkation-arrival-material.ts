import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { ArrivalMaterial } from "../../src/animation/embarkation/arrival-material";
import type { ArrivalMaterial as Material } from "../../src/animation/embarkation/arrival";
import { sheetMaterials } from "../../src/animation/embarkation/cloth";
import { orient } from "../../src/animation/embarkation/dynamics";
import { projectWorld, REST_CAMERA, type Point3 } from "../../src/animation/embarkation/projection";

// Authored desktop geometry plus CSS/world scale changes. This exercises the
// actual worker modules, not native pixel parity or responsive reflow itself.
const rows: Array<[number, number, number, number, Material, number]> = [
  [694.0875, 159.625, 30.9, 33, "label", 0],
  [360.175, 815, 31.02, 33.65, "parchment", 1],
  [130.8125, 171.6, 31.32, 33.5, "card", 2],
  [130.8125, 171.6, 32.01, 33.98, "card", 5],
  [318.175, 171.975, 32.18, 34.1, "card", 6],
  [318.175, 119.8, 32.52, 34.3, "card", 7],
  [305, 302, 32.04, 34.2, "chat", 8],
  [533.225, 99, 32.78, 34.35, "label", 9],
];
const cases = rows.flatMap(([width, height, start, end, material, index]) =>
  [1, 1100 / 720, 1100 / 844].map((scale) => {
    const motion = new ArrivalMaterial({
      home: [-350, 180, 0],
      width: width * scale,
      height: height * scale,
      start,
      flight: material === "parchment" || material === "chat" ? 1.19 : 1.02 + (index % 3) * 0.075,
      material,
      index,
    });
    const strains: number[] = [],
      bend: number[] = [];
    let pinError = 0;
    for (let tick = 0; tick <= Math.ceil((end - start) * 120); tick++) {
      const time = Math.min(end, start + tick / 120),
        frame = motion.sheet.at(time),
        body = motion.body.at(time);
      strains.push(motion.sheet.strain(frame).max);
      bend.push(Math.max(...frame.positions.filter((_, i) => i % 3 === 2).map(Math.abs)));
      motion.sheet.pins.forEach((pin, anchor) => {
        if (!body.holds[anchor]) return;
        for (let axis = 0; axis < 3; axis++)
          pinError = Math.max(
            pinError,
            Math.abs(frame.positions[pin * 3 + axis] - motion.sheet.rest[pin * 3 + axis] * motion.spec.width),
          );
      });
    }
    const final = motion.sheet.at(end),
      body = motion.body.at(end),
      viewport = { width: 1536, height: 1100 / scale };
    let finalPixelError = 0;
    for (let i = 0; i < final.positions.length; i += 3) {
      const local: Point3 = [final.positions[i], -final.positions[i + 1], final.positions[i + 2]],
        turned = orient(local, body.orientation);
      const actual = projectWorld(turned.map((v, j) => v + body.position[j]) as Point3, REST_CAMERA, viewport);
      const expected = projectWorld(
        [
          motion.spec.home[0] + motion.sheet.rest[i] * motion.spec.width,
          motion.spec.home[1] - motion.sheet.rest[i + 1] * motion.spec.width,
          0,
        ],
        REST_CAMERA,
        viewport,
      );
      finalPixelError = Math.max(finalPixelError, Math.hypot(actual.x - expected.x, actual.y - expected.y));
    }
    strains.sort((a, b) => a - b);
    return {
      material,
      index,
      width,
      height,
      scale,
      start,
      end,
      samples: strains.length,
      strain: {
        max: strains.at(-1)!,
        p95: strains[Math.floor(strains.length * 0.95)],
        limit: sheetMaterials[motion.sheet.material].strainLimit,
      },
      pinErrorWorld: pinError,
      peakBendWorld: Math.max(...bend),
      finalPixelError,
      allSupportsCaptured: body.holds.every(Boolean),
      firstCaptureSpeed: Math.hypot(...motion.body.captures[0].velocity),
      cacheBytes: motion.sheet.bytes,
    };
  }),
);
const files = [
  "arrival-material.ts",
  "arrival.ts",
  "cloth.ts",
  "dom.ts",
  "paint-mesh.ts",
  "paint-surface.ts",
  "live-paint.ts",
  "live-paint-binding.ts",
  "dom-paint.ts",
  "projection.ts",
  "dynamics.ts",
  "program.ts",
];
const report = {
  classification: "engineering-record",
  kind: "incoming-constrained-material-module",
  createdAt: new Date().toISOString(),
  command: "npx tsx scripts/refit/probe-embarkation-arrival-material.ts",
  physicalStepSeconds: 1 / 120,
  identities: Object.fromEntries(
    files.map((file) => [
      file,
      createHash("sha256")
        .update(readFileSync(`src/animation/embarkation/${file}`))
        .digest("hex"),
    ]),
  ),
  limits:
    "Numerical body/mesh/support evidence for stated static layout cases. Native painted-pixel parity, live responsive retargeting, self-contact and complete-film qualification remain separate.",
  passed: cases.every(
    (c) =>
      c.strain.max < c.strain.limit &&
      c.pinErrorWorld < 0.001 &&
      c.finalPixelError < 0.2 &&
      c.allSupportsCaptured &&
      c.firstCaptureSpeed > 500,
  ),
  cases,
};
writeFileSync(
  "Development_Docs/Projects/Voyagewright_Refit_V1/embarkation/audit-arrival-material.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    passed: report.passed,
    cases: cases.length,
    maxFinalPixelError: Math.max(...cases.map((c) => c.finalPixelError)),
    maxPinError: Math.max(...cases.map((c) => c.pinErrorWorld)),
    failures: cases.filter((c) => c.finalPixelError >= 0.2 || c.strain.max >= c.strain.limit),
  }),
);
if (!report.passed) process.exitCode = 1;
