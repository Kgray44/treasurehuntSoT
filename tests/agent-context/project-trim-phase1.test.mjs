import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { addExpansion, buildPacket, createLedger, usageRecord } from "../../scripts/agent-context/core.mjs";

const root = process.cwd();
const mapped = {
  id: "repair",
  objective: "Fix bridgewatch regression",
  taskClass: "bug-repair",
  paths: ["scripts/sounding-line/status-projection.mjs"],
};

test("classification selects the requested profile and keeps focused repair bounded", () => {
  const packet = buildPacket(root, mapped);
  assert.equal(packet.task.taskClass, "bug-repair");
  assert.equal(
    buildPacket(root, { id: "auto", objective: "Fix a bounded regression", paths: mapped.paths }).task.taskClass,
    "bug-repair",
  );
  assert.ok(packet.generator.pointerCount >= 3 && packet.generator.pointerCount <= 6);
  assert.equal(packet.profile.pointerGuidance.maximum, 6);
});

test("bounded implementation composes existing ownership, contracts, suites, and source identity", () => {
  const packet = buildPacket(root, {
    ...mapped,
    taskClass: "product-phase",
    paths: ["scripts/sounding-line/status-projection.mjs", "scripts/sounding-line/authority.mjs"],
  });
  assert.ok(packet.generator.pointerCount >= 6 && packet.generator.pointerCount <= 12);
  assert.ok(packet.ownership.owners.length > 0);
  assert.ok(packet.ownership.contracts.length > 0);
  assert.ok(packet.verificationSlice.some((entry) => entry.id));
  assert.equal(packet.sourceIdentity.headSha.length, 40);
  assert.equal(packet.sourceIdentity.headTreeSha.length, 40);
});

test("profiles are heuristics and do not create competing canonical registries", () => {
  const profiles = JSON.parse(readFileSync("agent-context-profiles.json", "utf8"));
  assert.deepEqual(Object.keys(profiles.profiles).sort(), [
    "bug-repair",
    "documentation-only",
    "infrastructure",
    "integration",
    "product-phase",
    "release-closure",
    "security-sensitive",
  ]);
  assert.equal(profiles.ownership, undefined);
  assert.match(buildPacket(root, mapped).autonomousExpansionPolicy, /not scope expansion/i);
});

test("partial and unmapped mappings lower confidence and require conservative expansion", () => {
  const packet = buildPacket(root, { ...mapped, paths: ["src/not-mapped/project-trim.ts"] });
  assert.equal(packet.confidence, "PARTIAL_REQUIRES_EXPANSION");
  assert.equal(packet.conservativeFallback, "UNKNOWN_MAPPING_REQUIRES_TARGETED_SEARCH_AND_EXPANSION");
  assert.match(packet.knownRisks.join(" "), /UNMAPPED/);
});

test("authority conflict marks the packet stale for escalation", () => {
  assert.equal(buildPacket(root, { ...mapped, authorityConflict: true }).confidence, "STALE_REQUIRES_ESCALATION");
});

test("both execution profiles authorize targeted expansion while hard boundaries remain distinct", () => {
  for (const executionProfile of ["STANDARD_AUTONOMOUS", "UNATTENDED_CONTINUATION"]) {
    const packet = buildPacket(root, { ...mapped, executionProfile });
    assert.match(packet.autonomousExpansionPolicy, /AUTHORITY.*SECURITY/);
  }
  const workflow = readFileSync(".agents/context-workflow.md", "utf8");
  assert.match(workflow, /focused failure/i);
  assert.match(workflow, /destructive or irreversible/i);
});

test("ledger records expansion reason, identity, and repeat reads", () => {
  const packet = buildPacket(root, mapped);
  const ledger = createLedger(packet);
  addExpansion(
    ledger,
    { reasonClass: "SOURCE", reason: "inspect direct source", source: "AGENTS.md", result: "resolved" },
    root,
  );
  addExpansion(
    ledger,
    { reasonClass: "SOURCE", reason: "verify same source", source: "AGENTS.md", result: "confirmed" },
    root,
  );
  assert.equal(ledger.expansions.length, 2);
  assert.equal(ledger.reads[1].repeated, true);
  assert.ok(ledger.reads[0].blobSha);
});

test("exact accounting is retained and estimates are labeled, nonzero, and versioned", () => {
  const exact = usageRecord({ taskId: "x", exactTokens: 81156, durationMinutes: 4 });
  assert.equal(exact.state, "EXACT");
  assert.equal(exact.exactTokens, 81156);
  const estimated = usageRecord({
    taskId: "y",
    durationMinutes: 10,
    activityRegime: "MIXED_ENGINEERING",
    modifiers: ["focused"],
  });
  assert.equal(estimated.state, "CALIBRATED_ESTIMATE");
  assert.ok(estimated.pointEstimate > 0);
  assert.ok(estimated.lowEstimate < estimated.highEstimate);
  assert.ok(estimated.estimatorVersion);
  assert.equal(usageRecord({ accountingState: "RECONSTRUCTED", pointEstimate: 1200 }).state, "RECONSTRUCTED");
  assert.equal(usageRecord({ accountingState: "COARSE_ESTIMATE", pointEstimate: 1200 }).state, "COARSE_ESTIMATE");
});

test("insufficient accounting is unavailable, never zero, and packet data redacts secrets", () => {
  const unavailable = usageRecord({ taskId: "z" });
  assert.equal(unavailable.state, "UNAVAILABLE");
  assert.equal(unavailable.exactTokens, null);
  const packet = buildPacket(root, { ...mapped, apiToken: "do-not-retain" });
  assert.equal(packet.task.apiToken, undefined);
  assert.equal(JSON.stringify(packet).includes("do-not-retain"), false);
  assert.ok(existsSync("testing/sounding-line-authority.json"));
});

test("the Project Trim governing baseline is indexed as current and Sounding Line input remains unchanged", () => {
  const governing =
    "Development_Docs/Governing/Project_Trim_Codex_Context_and_Inference_Efficiency_Governing_Document_v1.0-R1.pdf";
  const digest = createHash("sha256").update(readFileSync(governing)).digest("hex").toUpperCase();
  assert.equal(digest, "8968C3FEE301F83B89A8F2AB0350FFE9B32089262AFC3CBB3EADC8D2CDD728A6");
  const index = JSON.parse(readFileSync("Development_Docs/document-index.json", "utf8"));
  assert.equal(index.records.find((entry) => entry.path === governing)?.status, "current");
  assert.equal(JSON.parse(readFileSync("testing/sounding-line-authority.json", "utf8")).authority, "SOUNDING_LINE");
});
