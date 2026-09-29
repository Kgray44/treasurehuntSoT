import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { ArrivalPath, type ArrivalMaterial } from "../../src/animation/embarkation/arrival";
import { orient } from "../../src/animation/embarkation/dynamics";
import { projectWorld, REST_CAMERA, type Point3 } from "../../src/animation/embarkation/projection";

const rows: Array<[number, number, number, number, ArrivalMaterial, number]> = [
  [694, 160, 30.9, 33, "label", 0],
  [360, 815, 31.02, 33.65, "parchment", 1],
  [131, 172, 31.32, 33.5, "card", 2],
  [131, 172, 32.01, 33.98, "card", 5],
  [318, 172, 32.18, 34.1, "card", 6],
  [318, 120, 32.52, 34.3, "card", 7],
  [305, 302, 32.04, 34.2, "chat", 8],
  [533, 99, 32.78, 34.35, "label", 9],
];
const cases = rows.flatMap(([w, h, start, end, material, index]) =>
  [1, 1100 / 720, 1100 / 844].map((scale) => {
    const path = new ArrivalPath({
      home: [-350, 180, 0],
      width: w * scale,
      height: h * scale,
      start,
      flight: material === "chat" || material === "parchment" ? 1.19 : 1.02 + (index % 3) * 0.075,
      material,
      index,
    });
    const final = path.at(end),
      viewport = { width: 1536, height: 1100 / scale };
    const cornerError = Math.max(
      ...[
        [-0.5, -0.5],
        [0.5, -0.5],
        [0.5, 0.5],
        [-0.5, 0.5],
      ].map(([x, y]) => {
        const local: Point3 = [x * w * scale, y * h * scale, 0],
          turned = orient(local, final.orientation);
        const actual = projectWorld(turned.map((v, i) => v + final.position[i]) as Point3, REST_CAMERA, viewport);
        const expected = projectWorld(local.map((v, i) => v + path.spec.home[i]) as Point3, REST_CAMERA, viewport);
        return Math.hypot(actual.x - expected.x, actual.y - expected.y);
      }),
    );
    return {
      material,
      index,
      scale,
      start,
      end,
      width: w,
      height: h,
      captures: path.captures.map((c) => ({ ...c, speed: Math.hypot(...c.velocity) })),
      finalSpeed: Math.hypot(...final.velocity),
      finalCornerErrorPx: cornerError,
      allSupportsCaptured: final.holds.every(Boolean),
    };
  }),
);
const files = ["arrival.ts", "dom.ts", "arrival-material.ts", "program.ts", "dynamics.ts", "projection.ts"];
const report = {
  classification: "engineering-record",
  kind: "actual-arrival-constraint-module",
  createdAt: new Date().toISOString(),
  identities: Object.fromEntries(
    files.map((f) => [
      f,
      createHash("sha256")
        .update(readFileSync(`src/animation/embarkation/${f}`))
        .digest("hex"),
    ]),
  ),
  command: "npx tsx scripts/refit/probe-embarkation-arrival.ts",
  physicalStepSeconds: 1 / 240,
  passed: cases.every((c) => c.allSupportsCaptured && c.finalCornerErrorPx < 0.1 && c.captures[0].speed > 500),
  limits:
    "Covers rigid-body force/capture equations with authored dimensions/windows. The incoming constrained sheet, live paint adapter, resize continuity and full rendered shot require separate evidence.",
  cases,
};
writeFileSync(
  "Development_Docs/Projects/Voyagewright_Refit_V1/embarkation/audit-arrival-capture.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    passed: report.passed,
    cases: cases.length,
    maxFinalCornerErrorPx: Math.max(...cases.map((c) => c.finalCornerErrorPx)),
    slowestInitialCapture: Math.min(...cases.map((c) => c.captures[0].speed)),
  }),
);
if (!report.passed) process.exitCode = 1;
