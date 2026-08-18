import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildAcceptedCapsule,
  buildPacket,
  buildProvisionalCapsule,
  buildWorkstreamSlice,
  createLogbook,
  readReuseDecision,
  recordExpansion,
  recordRead,
  recordSearch,
  searchReuseDecision,
  validateCapsule,
  validateDistilledReturn,
} from "../../scripts/agent-context/core.mjs";

const root = process.cwd();
const node = process.execPath;

function phase2Input() {
  return {
    project: "Project Trim",
    increment: "Phase 2",
    acceptedMainSha: "a".repeat(40),
    acceptedTreeSha: "b".repeat(40),
    sourceRecords: [{ path: "record.md", blobSha: "c".repeat(40) }],
  };
}

test("accepted capsules bind immutable protected-main identity while provisional capsules cannot claim it", () => {
  const accepted = buildAcceptedCapsule(phase2Input());
  const provisional = buildProvisionalCapsule({ project: "Project Trim", increment: "Phase 3", candidateSha: "d".repeat(40) });
  assert.equal(accepted.state, "ACCEPTED");
  assert.equal(accepted.integrity.acceptedIdentity.mainSha, "a".repeat(40));
  assert.equal(validateCapsule(accepted).valid, true);
  assert.equal(provisional.acceptedMainSha, null);
  assert.equal(validateCapsule(provisional).valid, true);
  assert.equal(
    buildAcceptedCapsule({ ...phase2Input(), closureDate: "2026-08-17" }).integrity.semanticDigest,
    buildAcceptedCapsule({ ...phase2Input(), closureDate: "2026-08-17" }).integrity.semanticDigest,
  );
});

test("phase 3 startup discovers the retained Phase 2 accepted capsule and seeds a privacy-safe logbook", () => {
  const packet = buildPacket(root, {
    id: "project-trim-phase3-test",
    project: "Project Trim",
    increment: "Phase 3 - Carry the Logbook",
    taskClass: "product-phase",
    paths: ["scripts/agent-context/logbook.mjs"],
    objective: "Continue from the accepted Project Trim Phase 2 plateau.",
  });
  assert.equal(packet.priorPlateau.status, "ACCEPTED_CAPSULE_BOUND");
  assert.equal(packet.priorPlateau.acceptedMainSha, "d3c06e076fda99f7c18baa28e66847f4e79697fa");
  assert.equal(packet.ledgerTemplate.schemaVersion, "1.0");
  assert.equal(packet.ledgerTemplate.packetDigest, packet.integrity.semanticDigest);
  assert.deepEqual(packet.ledgerTemplate.privacy.prohibited, ["secrets", "credentials", "private content", "raw prompts", "raw logs"]);
});

test("read and search ledgers reuse only unchanged complete, non-sensitive knowledge", () => {
  const logbook = createLogbook("phase3-ledger", "packet-digest");
  recordRead(logbook, {
    path: "authority.md",
    blobSha: "one",
    reason: "governing requirement",
    summary: "A bounded summary.",
    exactTextNeeded: false,
    coverage: "COMPLETE",
  });
  assert.equal(readReuseDecision(logbook, { path: "authority.md", blobSha: "one" }).reuse, true);
  assert.equal(readReuseDecision(logbook, { path: "authority.md", blobSha: "two" }).reason, "SOURCE_IDENTITY_CHANGED");
  assert.equal(readReuseDecision(logbook, { path: "authority.md", blobSha: "one", exactTextNeeded: true }).reason, "EXACT_TEXT_ESCALATION");
  assert.equal(readReuseDecision(logbook, { path: "authority.md", blobSha: "one", securityReverification: true }).reason, "SECURITY_REVERIFICATION");
  recordSearch(logbook, { intent: "owner of logbook", resultDigest: "owner-result", paths: ["scripts/agent-context/logbook.mjs"], resolvedOwners: ["project-trim"] });
  assert.equal(searchReuseDecision(logbook, { intent: "owner of logbook" }).reuse, true);
  assert.equal(searchReuseDecision(logbook, { intent: "owner of logbook", relevantOwnershipChange: true }).reuse, false);
});

test("partial knowledge and scope-changing expansion fail closed, while bounded expansion stays visible", () => {
  const logbook = createLogbook("phase3-expansion");
  recordRead(logbook, { path: "partial.md", blobSha: "one", reason: "partial review", summary: "Only section one.", coverage: "PARTIAL" });
  assert.equal(readReuseDecision(logbook, { path: "partial.md", blobSha: "one", requiredCoverage: "COMPLETE" }).reason, "PARTIAL_COVERAGE");
  assert.throws(
    () => recordExpansion(logbook, { reasonClass: "SOURCE", question: "Would this alter product scope?", scopeChanged: true }),
    /CONTEXT_EXPANSION_IS_NOT_SCOPE_EXPANSION/u,
  );
  const expansion = recordExpansion(logbook, { reasonClass: "HISTORY", question: "Which accepted identity precedes this work?", sourcesAdded: [".agents/handoffs/project-trim-phase-2.accepted.json"], resolution: "RESOLVED" });
  assert.equal(expansion.reasonClass, "HISTORY");
});

test("independent workstream slices and distilled returns keep parent authority and escalation explicit", () => {
  const slice = buildWorkstreamSlice({
    independent: true,
    parentTaskId: "phase3",
    workstreamId: "capsule-review",
    question: "Validate accepted capsule identity.",
    expectedOutcome: "Report identity validity.",
    ownedContracts: ["project-trim.minimum-sufficient-context"],
    authority: ["Project Trim v1.0-R1 Section 17"],
    sources: [".agents/handoffs/project-trim-phase-2.accepted.json"],
    tests: ["tests/agent-context/project-trim-phase3.test.mjs"],
    editingAuthority: "READ_ONLY",
  });
  assert.equal(slice.identity.workstreamId, "capsule-review");
  assert.throws(
    () => buildWorkstreamSlice({ independent: true, overlappingMutableFiles: ["shared.mjs"], mutableFiles: ["shared.mjs"], parentTaskId: "phase3", workstreamId: "unsafe", question: "x", expectedOutcome: "y" }),
    /DELEGATION_REJECTED/u,
  );
  assert.equal(validateDistilledReturn({ status: "COMPLETE", findings: [], filesTouched: [], contracts: [], evidence: [], sourceIdentities: [], expansions: [], blockers: [], parentAction: "None" }).valid, true);
  assert.equal(validateDistilledReturn({ status: "FAILED", findings: [], filesTouched: [], contracts: [], evidence: [], sourceIdentities: [], expansions: [], blockers: [], parentAction: "Escalate" }).valid, false);
});

test("capsule and ledger CLIs produce canonical, redacted task-local artifacts", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "project-trim-phase3-"));
  try {
    const input = path.join(directory, "capsule-input.json");
    const capsule = path.join(directory, "capsule.json");
    const ledger = path.join(directory, "ledger.json");
    writeFileSync(input, JSON.stringify(phase2Input()));
    execFileSync(node, [path.join(root, "scripts/agent-context/phase-capsule.mjs"), "--input", input, "--out", capsule]);
    execFileSync(node, [path.join(root, "scripts/agent-context/logbook-cli.mjs"), "--command", "init", "--ledger", ledger, "--task-id", "phase3-cli"]);
    execFileSync(node, [path.join(root, "scripts/agent-context/logbook-cli.mjs"), "--command", "record-read", "--ledger", ledger, "--entry", JSON.stringify({ path: "safe.md", blobSha: "identity", reason: "test", summary: "safe", privateToken: "ghp_abcdefghijklmnopqrstuvwxyz012345678901234567890" })]);
    assert.equal(JSON.parse(readFileSync(capsule, "utf8")).state, "ACCEPTED");
    assert.doesNotMatch(readFileSync(ledger, "utf8"), /ghp_/u);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
