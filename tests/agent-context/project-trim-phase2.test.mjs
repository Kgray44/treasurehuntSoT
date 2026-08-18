import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { appendFileSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import {
  buildPacket,
  canonicalJson,
  inspectPacketStaleness,
  packetMarkdown,
  refreshPacketSlices,
  validatePacket,
} from "../../scripts/agent-context/core.mjs";

const root = process.cwd();
const node = process.execPath;
const commonInput = {
  id: "project-trim-phase2-test",
  project: "Project Trim",
  increment: "Phase 2",
  taskClass: "product-phase",
  executionProfile: "UNATTENDED_CONTINUATION",
  objective: "Build a source-bound context packet with truthful token-efficiency evidence.",
  nonGoals: ["Project Trim Phase 3"],
  completionContract: ["Sounding Line remains the only RELEASE_GO authority."],
  paths: ["scripts/agent-context/core.mjs"],
  schemaPointers: ["prisma/schema.prisma"],
  priorAcceptedStatusPath: "Development_Docs/Programs/Project_Trim/Project_Trim_Phase_1_Validation_Record.md",
};

let fixture;

function copy(relativePath) {
  const destination = path.join(fixture, relativePath);
  mkdirSync(path.dirname(destination), { recursive: true });
  cpSync(path.join(root, relativePath), destination);
}

function git(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function fixtureInput() {
  return { ...commonInput, deltaBaseSha: git(fixture, ["rev-parse", "origin/main"]) };
}

function withMutation(relativePath, assertion) {
  const absolute = path.join(fixture, relativePath);
  const original = readFileSync(absolute);
  try {
    appendFileSync(absolute, "\n");
    assertion();
  } finally {
    writeFileSync(absolute, original);
  }
}

before(() => {
  fixture = mkdtempSync(path.join(tmpdir(), "project-trim-phase2-"));
  for (const relativePath of [
    "AGENTS.md",
    ".agents/context-workflow.md",
    ".agents/testing-workflow.md",
    "agent-context-profiles.json",
    "scripts/agent-context/build-context.mjs",
    "scripts/agent-context/core.mjs",
    "scripts/agent-context/logbook.mjs",
    "scripts/agent-context/packet-v2.mjs",
    "scripts/agent-context/packet-v2.schema.json",
    "testing/ownership.json",
    "testing/contracts.json",
    "testing/impact-map.json",
    "testing/suites.json",
    "testing/resources.json",
    "testing/validation-debt.json",
    "testing/sounding-line-authority.json",
    "Development_Docs/document-index.json",
    "Development_Docs/Governing/Project_Trim_Codex_Context_and_Inference_Efficiency_Governing_Document_v1.0-R1.pdf",
    "Development_Docs/Programs/Project_Trim/Project_Trim_Phase_1_Validation_Record.md",
    "package.json",
    "package-lock.json",
    "prisma/schema.prisma",
  ])
    copy(relativePath);
  git(fixture, ["init", "-b", "main"]);
  git(fixture, ["config", "user.email", "project-trim@example.invalid"]);
  git(fixture, ["config", "user.name", "Project Trim Test"]);
  git(fixture, ["add", "."]);
  git(fixture, ["commit", "-m", "fixture"]);
  git(fixture, ["update-ref", "refs/remotes/origin/main", "HEAD"]);
});

after(() => rmSync(fixture, { recursive: true, force: true }));

test("packet v2 classifies the task, contains every production slice, and excludes unrelated project flood", () => {
  const packet = buildPacket(root, { ...commonInput, deltaBaseSha: "beaca908fec708d15bc7ae09947555c45aa841fc" });
  assert.equal(packet.schemaVersion, "2.0");
  assert.equal(packet.task.taskClass, "product-phase");
  assert.equal(validatePacket(packet).valid, true);
  for (const section of [
    "authority",
    "sourceSliceContract",
    "schemaSlice",
    "verificationSliceContract",
    "dependencySlice",
    "mainDelta",
    "integrity",
  ])
    assert.ok(packet[section], section);
  assert.ok(packet.authority.slices.some((entry) => entry.path.includes("Project_Trim_Codex")));
  assert.ok(packet.verificationSliceContract.suites.some((entry) => entry.id === "unit.agent-context"));
  assert.equal(
    packet.sourceSlice.some((entry) => /Tideglass|Harborlight/u.test(entry.path)),
    false,
  );
  assert.ok(packet.mainDelta.acceptedAssumptionIntersections.length === 0);
});

test("superseded authority is excluded and conflicting authority fails closed without hiding source identity", () => {
  const packet = buildPacket(root, {
    ...commonInput,
    authorityConflict: true,
    authorities: [
      { path: "Development_Docs/Programs/Project_Trim/Project_Trim_Phase_1_Validation_Record.md", superseded: true },
    ],
  });
  assert.equal(packet.staleness.state, "CONFLICTED");
  assert.equal(packet.confidenceLevel, "UNKNOWN");
  assert.ok(packet.authority.excluded.some((entry) => entry.reason === "SUPERSEDED_AUTHORITY_EXCLUDED"));
  assert.ok(packet.authority.conflicts.length > 0);
  assert.ok(packet.authority.slices.every((entry) => entry.sourceIdentity.sha256 || !entry.sourceIdentity.exists));
});

test("authority, source, schema, verification, and generator changes invalidate only bound slices", () => {
  const input = fixtureInput();
  const packet = buildPacket(fixture, input);
  assert.equal(inspectPacketStaleness(fixture, packet).state, "FRESH");

  withMutation(".agents/context-workflow.md", () => {
    const stale = inspectPacketStaleness(fixture, packet);
    assert.equal(stale.state, "PARTIALLY_STALE");
    assert.deepEqual(stale.affectedSlices, ["authority"]);
  });
  withMutation("scripts/agent-context/core.mjs", () => {
    const stale = inspectPacketStaleness(fixture, packet);
    assert.ok(stale.affectedSlices.includes("sourceSlice"));
    assert.equal(stale.affectedSlices.includes("authority"), false);
  });
  withMutation("prisma/schema.prisma", () => {
    const stale = inspectPacketStaleness(fixture, packet);
    assert.deepEqual(stale.affectedSlices, ["schemaSlice"]);
  });
  withMutation("testing/suites.json", () => {
    const stale = inspectPacketStaleness(fixture, packet);
    assert.ok(stale.affectedSlices.includes("verificationSlice"));
    assert.ok(stale.affectedSlices.includes("dependencySlice"));
    assert.equal(stale.affectedSlices.includes("sourceSlice"), false);
  });
  withMutation("scripts/agent-context/packet-v2.schema.json", () => {
    const stale = inspectPacketStaleness(fixture, packet);
    assert.deepEqual(stale.affectedSlices, ["generator"]);
    const rebuilt = refreshPacketSlices(fixture, packet, input, ["generator"]);
    assert.equal(inspectPacketStaleness(fixture, rebuilt).state, "FRESH");
    assert.notEqual(rebuilt.integrity.semanticDigest, packet.integrity.semanticDigest);
  });
});

test("unrelated local change does not invalidate packet slices", () => {
  const packet = buildPacket(fixture, fixtureInput());
  const unrelated = path.join(fixture, "unrelated.txt");
  try {
    writeFileSync(unrelated, "not bound to the packet\n");
    assert.equal(inspectPacketStaleness(fixture, packet).state, "FRESH");
  } finally {
    rmSync(unrelated, { force: true });
  }
});

test("targeted regeneration refreshes one stale slice and preserves unrelated source binding", () => {
  const input = fixtureInput();
  const packet = buildPacket(fixture, input);
  const originalSourceDigest = packet.integrity.sectionBindings.sourceSlice.contentDigest;
  withMutation(".agents/context-workflow.md", () => {
    const stale = inspectPacketStaleness(fixture, packet);
    assert.deepEqual(stale.affectedSlices, ["authority"]);
    const refreshed = refreshPacketSlices(fixture, packet, input, ["authority"]);
    assert.equal(inspectPacketStaleness(fixture, refreshed).state, "FRESH");
    assert.equal(refreshed.integrity.sectionBindings.sourceSlice.contentDigest, originalSourceDigest);
    assert.notEqual(refreshed.integrity.semanticDigest, packet.integrity.semanticDigest);
  });
});

test("known mapping is bounded, unknown mapping remains visible with a targeted expansion action", () => {
  const mapped = buildPacket(root, commonInput);
  assert.equal(mapped.sourceSliceContract.unmappedPaths.length, 0);
  const unknown = buildPacket(root, { ...commonInput, paths: ["src/unmapped-project-trim-phase2.ts"] });
  assert.equal(unknown.confidence, "PARTIAL_REQUIRES_EXPANSION");
  assert.deepEqual(unknown.sourceSliceContract.unmappedPaths, ["src/unmapped-project-trim-phase2.ts"]);
  const risk = unknown.knownRiskDetails.find((entry) => entry.code === "UNMAPPED_PATH");
  assert.match(risk.nextAction, /Search current ownership\/impact\/contracts/u);
  assert.equal(unknown.conservativeFallback, "UNKNOWN_MAPPING_REQUIRES_TARGETED_SEARCH_AND_EXPANSION");
});

test("JSON and Markdown share one packet truth and repeated material generation is deterministic", () => {
  const input = fixtureInput();
  const first = buildPacket(fixture, input);
  const second = buildPacket(fixture, input);
  assert.equal(first.integrity.semanticDigest, second.integrity.semanticDigest);
  assert.equal(
    canonicalJson({ ...first, observation: null, ledgerTemplate: null }),
    canonicalJson({ ...second, observation: null, ledgerTemplate: null }),
  );
  const markdown = packetMarkdown(first);
  assert.match(markdown, new RegExp(first.integrity.semanticDigest, "u"));
  assert.match(markdown, new RegExp(first.sourceIdentity.originMainSha, "u"));
  assert.match(markdown, /unit\.agent-context/u);
  assert.doesNotMatch(markdown, /undefined/u);
});

test("secret-like inputs are redacted while ordinary token-efficiency language remains", () => {
  const packet = buildPacket(root, {
    ...commonInput,
    password: "correct horse battery staple",
    integrationToken: "synthetic-token-value-for-redaction",
  });
  const serialized = JSON.stringify(packet);
  assert.doesNotMatch(serialized, /correct horse|synthetic-token-value/u);
  assert.match(serialized, /token-efficiency/u);
  assert.equal(validatePacket(packet).valid, true);
});

test("Project Trim output cannot alter product scope or Sounding Line RELEASE_GO authority", () => {
  const packet = buildPacket(root, commonInput);
  assert.equal(packet.verificationSliceContract.authority.releaseAuthority, "SOUNDING_LINE_ONLY");
  assert.match(packet.generator.integrity, /derived-nonauthoritative/u);
  assert.match(packet.completionContract.join(" "), /Sounding Line remains the only RELEASE_GO authority/u);
  assert.equal(packet.scope.nonGoals.includes("Project Trim Phase 3"), true);
});

test("the CLI emits schema-valid JSON and compact Markdown from the identical packet digest", () => {
  const inputPath = path.join(fixture, "phase2-input.json");
  const outputPath = path.join(fixture, ".agent-context");
  writeFileSync(inputPath, `${JSON.stringify(fixtureInput(), null, 2)}\n`);
  const result = JSON.parse(
    execFileSync(
      node,
      [path.join(root, "scripts/agent-context/build-context.mjs"), "--input", inputPath, "--out-dir", outputPath],
      {
        cwd: fixture,
        encoding: "utf8",
      },
    ),
  );
  const packet = JSON.parse(readFileSync(result.packet, "utf8"));
  const markdown = readFileSync(result.markdown, "utf8");
  assert.equal(validatePacket(packet).valid, true);
  assert.equal(result.semanticDigest, packet.integrity.semanticDigest);
  assert.match(markdown, new RegExp(packet.integrity.semanticDigest, "u"));
  assert.ok(Buffer.byteLength(markdown) < Buffer.byteLength(JSON.stringify(packet)));
});
