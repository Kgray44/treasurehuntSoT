import { performance } from "node:perf_hooks";
import { buildPacket, buildPacketLegacy, packetMarkdown, packetMarkdownLegacy } from "./core.mjs";

const root = process.cwd();
const gitBase = process.argv.includes("--base") ? process.argv[process.argv.indexOf("--base") + 1] : null;
const common = {
  project: "Project Trim benchmark",
  executionProfile: "STANDARD_AUTONOMOUS",
  nonGoals: ["No product changes; benchmark context startup only."],
  completionContract: ["Compare packet startup structure without claiming total task-token savings."],
  deltaBaseSha: gitBase,
};

const fixtures = [
  {
    ...common,
    id: "phase2-benchmark-focused-repair",
    objective: "Fix the Project Trim packet Markdown regression.",
    taskClass: "bug-repair",
    paths: ["scripts/agent-context/packet-v2.mjs", "tests/agent-context/project-trim-phase2.test.mjs"],
  },
  {
    ...common,
    id: "phase2-benchmark-product",
    objective: "Implement a bounded product source and schema change.",
    taskClass: "product-phase",
    paths: ["src/helm/operations.ts", "src/helm/operations.test.ts"],
    schemaPointers: ["prisma/schema.prisma"],
  },
  {
    ...common,
    id: "phase2-benchmark-infrastructure",
    objective: "Update one Sounding Line workflow integration seam.",
    taskClass: "infrastructure",
    paths: [".github/workflows/sounding-line-authoritative.yml", "scripts/sounding-line/planner.mjs"],
  },
  {
    ...common,
    id: "phase2-benchmark-closure",
    objective: "Close one accepted Project Trim increment with current evidence.",
    taskClass: "release-closure",
    paths: ["Development_Docs/Programs/Project_Trim/Project_Trim_Phase_1_Validation_Record.md"],
    priorAcceptedStatusPath: "Development_Docs/Programs/Project_Trim/Project_Trim_Phase_1_Validation_Record.md",
  },
];

const bytes = (value) => Buffer.byteLength(value, "utf8");
const coarseTokens = (value) => Math.ceil(bytes(value) / 4);
const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

function timed(builder, input) {
  builder(root, input);
  const samples = [];
  let packet;
  for (let index = 0; index < 3; index += 1) {
    const started = performance.now();
    packet = builder(root, input);
    samples.push(performance.now() - started);
  }
  return { packet, medianMs: Math.round(median(samples) * 100) / 100 };
}

function legacyDiscoveryGaps(packet) {
  return [
    packet.authority?.some((entry) => entry.sections?.length) ? null : "authority section resolution",
    packet.sourceSlice?.some((entry) => entry.mappingProvenance?.length) ? null : "source mapping provenance",
    Array.isArray(packet.mainDelta?.changedPaths) ? null : "accepted mainline changed-path classification",
    packet.dependencySlice ? null : "dependency closure",
    packet.staleness?.state ? null : "slice staleness verification",
  ].filter(Boolean);
}

const results = fixtures.map((input) => {
  const legacy = timed(buildPacketLegacy, input);
  const phase2 = timed(buildPacket, input);
  const legacyJson = `${JSON.stringify(legacy.packet, null, 2)}\n`;
  const legacyMarkdown = packetMarkdownLegacy(legacy.packet);
  const phase2Json = `${JSON.stringify(phase2.packet, null, 2)}\n`;
  const phase2Markdown = packetMarkdown(phase2.packet);
  const legacyGaps = legacyDiscoveryGaps(legacy.packet);
  const phase2Expansions = phase2.packet.knownRiskDetails.filter((entry) =>
    ["UNMAPPED_PATH", "AUTHORITY_CONFLICT", "UNMAPPED_MAINLINE_DELTA"].includes(entry.code),
  );
  return {
    id: input.id,
    taskClass: input.taskClass,
    legacy: {
      schemaVersion: legacy.packet.schemaVersion,
      jsonBytes: bytes(legacyJson),
      markdownBytes: bytes(legacyMarkdown),
      markdownTokenEstimate: coarseTokens(legacyMarkdown),
      initialSourcePointers: legacy.packet.sourceSlice.length,
      authorityPointers: legacy.packet.authority.length,
      authoritySections: legacy.packet.authority.reduce((count, entry) => count + (entry.sections?.length ?? 0), 0),
      preImplementationDiscoveryGaps: legacyGaps,
      preImplementationDiscoveryCount: legacyGaps.length,
      warmGenerationMedianMs: legacy.medianMs,
      confidence: legacy.packet.confidence,
    },
    phase2: {
      schemaVersion: phase2.packet.schemaVersion,
      jsonBytes: bytes(phase2Json),
      markdownBytes: bytes(phase2Markdown),
      markdownTokenEstimate: coarseTokens(phase2Markdown),
      initialSourcePointers: phase2.packet.sourceSlice.length,
      authorityPointers: phase2.packet.authority.slices.length,
      authoritySections: phase2.packet.authority.slices.reduce((count, entry) => count + entry.sections.length, 0),
      requiredTargetedExpansions: phase2Expansions.map((entry) => entry.code),
      requiredTargetedExpansionCount: phase2Expansions.length,
      warmGenerationMedianMs: phase2.medianMs,
      confidence: phase2.packet.confidenceLevel,
      semanticDigest: phase2.packet.integrity.semanticDigest,
    },
    comparison: {
      structuralDiscoveryReduction: legacyGaps.length - phase2Expansions.length,
      structuralDiscoveryReductionQuality: "DIRECT_PROXY",
      initialReadPointerDelta: phase2.packet.sourceSlice.length - legacy.packet.sourceSlice.length,
      wholeProjectSearchesAvoided: "UNAVAILABLE",
      totalTaskTokenSavings: "UNAVAILABLE",
    },
  };
});

const output = {
  schemaVersion: "1.0",
  program: "PROJECT_TRIM_PHASE_2",
  benchmark: "PACK_THE_CHART_STARTUP",
  sourceIdentity: results[0]?.phase2.semanticDigest ?? null,
  evidence: {
    bytes: "EXACT",
    filePointers: "EXACT",
    authoritySections: "EXACT",
    warmGenerationTime: "EXACT_PROCESS_TIMER",
    markdownTokens: "COARSE_ESTIMATE_BYTES_DIVIDED_BY_FOUR",
    structuralDiscoveryReduction: "DIRECT_PROXY_FROM_MISSING_OR_PRESENT_PACKET_CONTRACTS",
    wholeProjectSearchesAvoided: "UNAVAILABLE_WITHOUT_COMPARABLE_LIVE_TASK_REPLAY",
    totalTaskTokenSavings: "UNAVAILABLE_WITHOUT_COMPARABLE_END_TO_END_TASKS",
  },
  limitations: [
    "This is a startup-structure benchmark, not an end-to-end task-token benchmark.",
    "Markdown token counts are coarse byte-based estimates, not official OpenAI token accounting.",
    "Structural discovery reduction counts explicit missing packet closures; it does not claim every gap would require a whole-repository search.",
    "Warm generator time excludes the first Git/source snapshot and agent reading/reasoning time.",
  ],
  results,
};

console.log(JSON.stringify(output, null, 2));
