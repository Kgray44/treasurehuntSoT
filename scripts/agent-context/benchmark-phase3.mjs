import { performance } from "node:perf_hooks";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { buildPacket, canonicalJson, createLogbook, readReuseDecision, recordRead } from "./core.mjs";

const root = process.cwd();
const outputPath = process.argv.includes("--out") ? process.argv[process.argv.indexOf("--out") + 1] : null;
const bytes = (value) => Buffer.byteLength(value, "utf8");
const median = (values) => [...values].sort((left, right) => left - right)[Math.floor(values.length / 2)];
const timed = (input) => {
  buildPacket(root, input);
  const samples = [];
  let packet;
  for (let index = 0; index < 3; index += 1) {
    const started = performance.now();
    packet = buildPacket(root, input);
    samples.push(performance.now() - started);
  }
  return { packet, warmMedianMs: Math.round(median(samples) * 100) / 100 };
};
const common = {
  project: "Project Trim",
  taskClass: "product-phase",
  executionProfile: "STANDARD_AUTONOMOUS",
  objective: "Measure bounded Project Trim context startup and reuse behavior.",
  paths: ["scripts/agent-context/logbook.mjs", "tests/agent-context/project-trim-phase3.test.mjs"],
};
const phase2 = timed({
  ...common,
  id: "project-trim-phase2-baseline",
  increment: "Phase 2",
  priorAcceptedStatusPath: "Development_Docs/Programs/Project_Trim/Project_Trim_Phase_1_Validation_Record.md",
});
const phase3 = timed({ ...common, id: "project-trim-phase3-logbook", increment: "Phase 3 - Carry the Logbook" });
const logbook = createLogbook("project-trim-phase3-benchmark", phase3.packet.integrity.semanticDigest);
recordRead(logbook, {
  path: "stable-authority.md",
  blobSha: "benchmark-stable-identity",
  reason: "benchmark reuse decision",
  summary: "A stable bounded authority summary.",
  coverage: "COMPLETE",
});
const reusable = readReuseDecision(logbook, { path: "stable-authority.md", blobSha: "benchmark-stable-identity" });
const invalidated = readReuseDecision(logbook, { path: "stable-authority.md", blobSha: "benchmark-new-identity" });
const output = {
  schemaVersion: "1.0",
  program: "PROJECT_TRIM_PHASE_3",
  benchmark: "CARRY_THE_LOGBOOK_STARTUP_AND_REUSE",
  method: {
    runner: "scripts/agent-context/benchmark-phase3.mjs",
    comparison: "Phase 2 packet startup with an ordinary prior-status pointer versus Phase 3 packet startup with its retained accepted capsule, plus deterministic read-reuse decisions.",
    evidence: {
      packetBytes: "EXACT_UTF8_BYTES",
      sourcePointers: "EXACT_PACKET_FIELDS",
      warmGenerationMedianMs: "EXACT_PROCESS_TIMER",
      readReuse: "DETERMINISTIC_UNIT_OPERATION",
      totalTaskTokenSavings: "UNAVAILABLE_WITHOUT_COMPARABLE_END_TO_END_TASK_REPLAY",
    },
  },
  phase2Baseline: {
    semanticDigest: phase2.packet.integrity.semanticDigest,
    priorPlateauStatus: phase2.packet.priorPlateau.status,
    packetBytes: bytes(canonicalJson(phase2.packet)),
    sourcePointers: phase2.packet.generator.actualPointerCount,
    warmGenerationMedianMs: phase2.warmMedianMs,
  },
  phase3: {
    semanticDigest: phase3.packet.integrity.semanticDigest,
    priorPlateauStatus: phase3.packet.priorPlateau.status,
    acceptedMainSha: phase3.packet.priorPlateau.acceptedMainSha,
    packetBytes: bytes(canonicalJson(phase3.packet)),
    sourcePointers: phase3.packet.generator.actualPointerCount,
    warmGenerationMedianMs: phase3.warmMedianMs,
    reuse: { unchanged: reusable.reason, changedIdentity: invalidated.reason },
  },
  limitations: [
    "This is a startup and deterministic-reuse benchmark, not an end-to-end task-token benchmark.",
    "Warm timings exclude initial source snapshot time and agent reading or reasoning time.",
    "No whole-project search avoidance or total task-token savings is claimed without comparable live task replays.",
  ],
};
if (outputPath) {
  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
}
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
