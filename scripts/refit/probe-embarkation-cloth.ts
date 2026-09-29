import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { ConstrainedSheet, sheetMaterials, type SheetMaterial } from "../../src/animation/embarkation/cloth";
import { attachments } from "../../src/animation/embarkation/adhesion";

// Standalone mechanism qualification. The actual cinematic renderer uses this
// solver; these deliberately specified loads are not filmed-shot evidence.
const sources = ["cloth.ts", "adhesion.ts", "page-material.ts", "projection.ts", "dynamics.ts", "program.ts"];
const identities = Object.fromEntries(
  sources.map((file) => [
    file,
    createHash("sha256")
      .update(readFileSync(`src/animation/embarkation/${file}`))
      .digest("hex"),
  ]),
);
const pulse = (t: number) => Math.min(1, t / 0.3) * (1 + 0.15 * Math.sin(t * 9));
const cases: Array<{
  material: SheetMaterial;
  attachment: string;
  aspect: number;
  limit: number;
  vertices: number;
  limitedSteps: number;
  samples: Array<{ time: number; max: number; p95: number; median: number; pinError: number }>;
}> = [];
for (const material of Object.keys(sheetMaterials) as SheetMaterial[])
  for (const attachment of attachments)
    for (const aspect of [0.5, 1, 2.5]) {
      const sheet = new ConstrainedSheet(600, 600 / aspect, material, attachment, (t) => ({
        air: [200 * pulse(t), -100, -7200 * pulse(t)],
        across: [90, 30, 800],
        holds: [1, 1, 1, 1],
      }));
      const samples = [0.15, 0.617, 1.4].map((time) => {
        const frame = sheet.at(time);
        const pinError = Math.max(
          ...sheet.pins.flatMap((pin) =>
            [0, 1, 2].map((k) => Math.abs(frame.positions[pin * 3 + k] - sheet.rest[pin * 3 + k] * sheet.width)),
          ),
        );
        return { time, ...sheet.strain(frame), pinError };
      });
      cases.push({
        material,
        attachment,
        aspect,
        limit: sheetMaterials[material].strainLimit,
        vertices: sheet.uv.length / 2,
        limitedSteps: sheet.limitedSteps,
        samples,
      });
    }
const report = {
  classification: "engineering-record",
  createdAt: new Date().toISOString(),
  kind: "actual-constrained-sheet-module-numerical-reproduction",
  identities,
  command: "npx tsx scripts/refit/probe-embarkation-cloth.ts",
  physicalStepSeconds: 1 / 120,
  loads:
    "Relative normal gust 7200*(min(1,t/.3))*(1+.15*sin(t*9)) world units/s; fixed supports; affine variation across width.",
  limits:
    "Strain and pin measurements certify these constructed cases only. Hero contact, self-contact, incoming live-DOM flex, captured-pixel parity and complete-film performance remain separate pending work.",
  passed: cases.every((c) => c.samples.every((s) => s.max < c.limit && s.pinError < 0.0001)),
  cases,
};
writeFileSync(
  process.argv[2] ?? "Development_Docs/Projects/Voyagewright_Refit_V1/embarkation/audit-cloth-metric.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    passed: report.passed,
    cases: cases.length,
    material: Object.fromEntries(
      Object.keys(sheetMaterials).map((m) => [
        m,
        Math.max(...cases.filter((c) => c.material === m).flatMap((c) => c.samples.map((s) => s.max))),
      ]),
    ),
  }),
);
if (!report.passed) process.exitCode = 1;
