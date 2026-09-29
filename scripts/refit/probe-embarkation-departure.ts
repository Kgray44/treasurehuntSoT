import { writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  departureSchedule,
  pageState,
  pageSheet,
  type PageSurface,
} from "../../src/animation/embarkation/page-material";
import { camera } from "../../src/animation/embarkation/program";
import { sheetMaterials } from "../../src/animation/embarkation/cloth";

const results = [];
for (const material of ["paper", "card", "cloth", "button"] as const) {
  const surface = {
    material,
    phase: 1.27,
    ...departureSchedule(material, 0),
    attachment: "multi" as const,
    rect: { x: 360, y: 220, width: 620, height: 360 } as DOMRect,
  };
  const sheet = pageSheet(surface, 1280, 720);
  const samples = [0, 0.05, 0.15, 0.3, 0.6, 1, 1.5, 2].map((age) => {
    const time = surface.release + age,
      state = pageState(surface, time, 1280, 720),
      frame = sheet.at(time);
    const depth = camera(time).position[2] - state.position[2];
    return {
      age,
      time,
      depth,
      velocity: state.velocity,
      scale: 1150 / (1150 + depth),
      anchors: state.anchors,
      strain: sheet.strain(frame),
      minimumZ: Math.min(...Array.from(frame.positions).filter((_, i) => i % 3 === 2)),
    };
  });
  const releaseTime = Math.max(...surface.anchors) + 0.05;
  const continuity = [-1 / 120, 0, 1 / 120].map((offset) => {
    const frame = sheet.at(releaseTime + offset);
    return { time: frame.time, positions: Array.from(frame.positions), velocities: Array.from(frame.velocities) };
  });
  results.push({ material, releaseTime, strainLimit: sheetMaterials[material].strainLimit, samples, continuity });
}
const sources = ["page-material.ts", "cloth.ts", "dynamics.ts", "program.ts", "renderer.ts"].map((file) => {
  const path = `src/animation/embarkation/${file}`;
  return { path, sha256: createHash("sha256").update(readFileSync(path)).digest("hex") };
});
const record = {
  kind: "world-sheet equation probe; not visual acceptance",
  capturedAt: new Date().toISOString(),
  sources,
  results,
};
if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(record, null, 2) + "\n");
console.log(
  JSON.stringify(
    results.map(({ material, samples }) => ({ material, atRelease: samples[1], afterSixTenths: samples[4] })),
    null,
    2,
  ),
);
