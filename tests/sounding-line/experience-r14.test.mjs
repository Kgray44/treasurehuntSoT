// Inert source/contract fixtures. No live API, grant, setup, browser or product journey.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import * as r14 from "../../scripts/sounding-line/experience-r14.mjs";
import { CROSSDECK_R13, validateR13Registry } from "../../scripts/sounding-line/experience-r13.mjs";
import { R8_FORMAT } from "../../scripts/sounding-line/experience-r8-format.mjs";
import {
  exceptionBinding,
  exceptionStore,
  recordBinding,
  reserveExceptionStage,
  selectTrustedExceptions,
  trustedExceptions,
  validateExceptionRecord,
} from "../../scripts/sounding-line/experience-exception.mjs";
import { verificationObligationGroups } from "../../scripts/sounding-line/ordinary.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const installedRegistry = JSON.parse(
  readFileSync(path.join(repo, "testing/product-experience-exceptions.json"), "utf8"),
);
// Historical R14 assertions retain the exact accepted fourteen-row/seven-bridge prefix.
const registry = {
  ...installedRegistry,
  exceptions: installedRegistry.exceptions.slice(0, 14),
  reconciliations: installedRegistry.reconciliations.slice(0, 7),
};
const record = registry.exceptions.find((entry) => entry.id === r14.CROSSDECK_R14.id);
const oldRecord = registry.exceptions.find((entry) => entry.id === CROSSDECK_R13.id);
const oldBase = "24fb189a90435ccb6021b63fd6953603ae090bc0";
const oldCandidate = "7681d297f281ab03f30b4224b8288b7c942024c6";
const oldSource = "a63073cbf3850900c91a25979467bb68f3930812e23af3f6daab00b21ab5d17a";
const hash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const sha = (value) => createHash("sha1").update(JSON.stringify(value)).digest("hex");
const diagnosticOverlay = [
  ".agents/README.md",
  ".agents/crossdeck-ordinary6-historical-validation-diagnostic.md",
  ".agents/crossdeck-ordinary6-posttechnical-diagnostic.md",
  ".agents/crossdeck-ordinary6-source-diagnostic.md",
  ".agents/replay-admission-git-diagnostics.md",
  ".github/workflows/sounding-line-replay-admission-diagnostic.yml",
  ".github/workflows/sounding-line-replay-historical-validation-diagnostic.yml",
  ".github/workflows/sounding-line-replay-posttechnical-diagnostic.yml",
  "Development_Docs/INDEX.md",
  "Development_Docs/Programs/Other/Ledgerlight/Project_Ledgerlight_Documentation_Migration_Matrix.csv",
  "Development_Docs/Programs/Sounding_Line/Project_Sounding_Line_Ordinary6_Historical_Validation_Diagnostic_20261017.md",
  "Development_Docs/Programs/Sounding_Line/Project_Sounding_Line_Ordinary6_Posttechnical_Diagnostic_20261017.md",
  "Development_Docs/Programs/Sounding_Line/Project_Sounding_Line_Ordinary6_Source_Diagnostic_20261017.md",
  "Development_Docs/Programs/Sounding_Line/Project_Sounding_Line_Replay_Admission_Git_Diagnostics_20261017.md",
  "Development_Docs/document-index.json",
  "package.json",
  "scripts/sounding-line/experience-diagnosed-continuation.mjs",
  "scripts/sounding-line/experience-exception.mjs",
  "scripts/sounding-line/experience-r10.mjs",
  "scripts/sounding-line/experience-r11.mjs",
  "scripts/sounding-line/experience-r8-format.mjs",
  "scripts/sounding-line/experience-r9.mjs",
  "scripts/sounding-line/product-experience.mjs",
  "scripts/sounding-line/replay-admission-source-diagnostic.mjs",
  "scripts/sounding-line/replay-historical-validation-diagnostic.mjs",
  "scripts/sounding-line/replay-posttechnical-diagnostic.mjs",
  "scripts/sounding-line/replay-posttechnical-suite.mjs",
  "scripts/sounding-line/run-browser-suite.mjs",
  "scripts/sounding-line/source-diagnostics.mjs",
  "scripts/sounding-line/verification-diagnostics.mjs",
  "tests/sounding-line/browser-diagnostics.test.mjs",
  "tests/sounding-line/historical-validation-diagnostic.test.mjs",
  "tests/sounding-line/ordinary.test.mjs",
];

function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), "r14-contract-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (...args) =>
    execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  const write = (file, value) => {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), typeof value === "string" ? value : JSON.stringify(value));
  };
  git("init", "--quiet", "--initial-branch=main");
  git("config", "user.name", "Inert R14 contract");
  git("config", "user.email", "r14-contract@example.invalid");
  git("config", "core.autocrlf", "false");
  const commit = () => {
    git("add", "--all");
    git("commit", "--quiet", "--allow-empty", "-m", "Inert source fixture; not qualification");
    return git("rev-parse", "HEAD");
  };
  write("testing/product-experience-exceptions.json", registry);
  write("scripts/sounding-line/experience-r14.mjs", "// Source-presence marker, never executed by this fixture.\n");
  const baseSha = commit();
  write("fixture-publication.md", "Inert R14 contract source\n");
  const candidateSha = commit();
  const plan = {
    applicable: true,
    baseSha,
    candidateSha,
    sourceDigest: "d".repeat(64),
    contractDigest: R8_FORMAT.contractDigest,
    contextCount: 38,
    exception: recordBinding(record),
  };
  plan.exception.nonExecutingReconciliation = r14.pendingR14Reconciliation({ root, baseSha, plan, record });
  return { root, git, write, commit, plan, baseSha, candidateSha };
}

test("historical accepted R14 installation changed only the two fixed ordinary artifact members", () => {
  const file = ".github/workflows/sounding-line-ordinary.yml";
  const accepted = execFileSync("git", ["show", `ba27c3395da43c54c1f90d7f18e2ce07f7523fd4:${file}`], {
    cwd: repo,
    encoding: "utf8",
  });
  const previousPath = "          path: candidate/artifacts/sounding-line/ordinary-decision.json\n";
  const currentPaths =
    "          path: |\n" +
    "            candidate/artifacts/sounding-line/ordinary-decision.json\n" +
    "            candidate/artifacts/sounding-line/r14-observation.encrypted\n";
  assert.equal(accepted.split(previousPath).length, 2, "The exact historical upload path occurs once");
  const installedR14 = execFileSync("git", ["show", `fd30aa1412072e89d04f2bb68786d9c184f82dfc:${file}`], {
    cwd: repo,
    encoding: "utf8",
  });
  assert.equal(installedR14, accepted.replace(previousPath, currentPaths));
});

test("current ordinary qualification upload preserves the exact two R14 artifact members and metadata", () => {
  const workflow = readFileSync(path.join(repo, ".github/workflows/sounding-line-ordinary.yml"), "utf8");
  const ordinaryUploads = workflow
    .split(/\n      - /u)
    .filter((step) => /(?:^|\n) *uses: actions\/upload-artifact@/u.test(step))
    .filter((step) => /^ *name: sounding-line-ordinary-/mu.test(step));
  assert.equal(ordinaryUploads.length, 1, "only one upload uses the ordinary qualification artifact name");
  const ordinaryArtifacts = [
    ...workflow.matchAll(
      /      - uses: actions\/upload-artifact@v4\n        if: always\(\) && steps\.route\.outputs\.kind == 'ordinary'\n        with:\n          name: sounding-line-ordinary-\$\{\{ steps\.source\.outputs\.candidate \}\}\n          path: \|\n([\s\S]*?)          if-no-files-found: error(?:\n|$)/gu,
    ),
  ];
  assert.equal(ordinaryArtifacts.length, 1, "the ordinary qualification artifact occurs exactly once");
  assert.equal(
    ordinaryArtifacts[0][1],
    "            candidate/artifacts/sounding-line/ordinary-decision.json\n" +
      "            candidate/artifacts/sounding-line/r14-observation.encrypted\n",
  );
});

test("R14 preserves the literal thirteen-record/six-bridge prefix and grants only whole ordinary7", () => {
  r14.validateR14Record(record);
  r14.validateR14Registry(registry);
  assert.equal(registry.exceptions.length, 14);
  assert.equal(registry.reconciliations.length, 7);
  const prefix = {
    ...registry,
    exceptions: registry.exceptions.slice(0, 13),
    reconciliations: registry.reconciliations.slice(0, 6),
  };
  validateR13Registry(prefix);
  assert.equal(hash(prefix), r14.CROSSDECK_R14.oldRegistryDigest);
  assert.deepEqual(selectTrustedExceptions(registry.exceptions), [record]);
  assert.deepEqual(record.immutableHistory.slice(0, oldRecord.immutableHistory.length), oldRecord.immutableHistory);
  assert.equal(oldRecord.immutableHistory.length, 1307);
  assert(record.immutableHistory.length > oldRecord.immutableHistory.length);
  assert.equal(record.attemptHistory.priorOrdinaryDispatches, 6);
  assert.equal(record.attemptHistory.priorOrdinaryFailures, 6);
  assert.equal(record.attemptHistory.nextOrdinaryDispatchTotal, 7);
  assert.equal(record.expiresAt, oldRecord.expiresAt);
  assert.equal(record.expiresAt, "2026-10-22T23:59:59Z");
  assert.notEqual(record.custody.namespace, oldRecord.custody.namespace);
  for (const [key, value] of Object.entries(record.executionBudget))
    assert.equal(
      value,
      ["ordinaryInvocations", "ordinaryExperienceReplayPasses", "technicalE2EInvocations"].includes(key) ? 1 : 0,
      key,
    );
  assert.equal(r14.admitR14FocusedTechnical, undefined);
  assert.equal(r14.r14TechnicalReadiness, undefined);
  for (const change of [
    (value) => value.executionBudget.reruns++,
    (value) => value.executionBudget.refunds++,
    (value) => value.executionBudget.productRepairs++,
    (value) => value.immutableHistory.pop(),
    (value) => (value.immutableHistory[0].blob = "f".repeat(40)),
    (value) => value.attemptHistory.nextOrdinaryDispatchTotal++,
    (value) => (value.expiresAt = "2026-10-23T23:59:59Z"),
  ]) {
    const changed = structuredClone(record);
    change(changed);
    assert.throws(() => r14.validateR14Record(changed), /R14_/u);
  }
  const changedPrefix = structuredClone(registry);
  changedPrefix.exceptions[12].executionBudget.reruns++;
  assert.throws(() => r14.validateR14Registry(changedPrefix), /R14_/u);
  assert.throws(() => validateExceptionRecord(record, new Date(record.expiresAt)), /EXPIRED/u);
});

test("R14 literal bridge includes all33 diagnostic paths and rejects path/mode substitution", () => {
  const bridge = registry.reconciliations[6];
  r14.validateR14Bridge(bridge);
  const paths = bridge.overlay.map((entry) => entry.path);
  assert.equal(new Set(paths).size, paths.length);
  for (const file of diagnosticOverlay) assert(paths.includes(file), file);
  assert.equal(diagnosticOverlay.length, 33);
  for (const mutate of [
    (value) => value.overlay.pop(),
    (value) => (value.overlay[0].path = "src/unapproved-product-repair.ts"),
    (value) => (value.overlay[0].newMode = "120000"),
    (value) => (value.exceptionId = CROSSDECK_R13.id),
  ]) {
    const changed = structuredClone(bridge);
    mutate(changed);
    assert.throws(() => r14.validateR14Bridge(changed), /R14_/u);
  }
});

test("R14 overlay preserves the exact E product source and rejects unlisted authority or candidate changes", () => {
  const bridge = registry.reconciliations[6];
  const identity = (mode, blob) => (mode === null ? undefined : `${mode} blob ${blob}`);
  const originalBase = new Map(),
    acceptedBase = new Map();
  for (const entry of bridge.overlay) {
    if (entry.oldMode !== null) originalBase.set(entry.path, identity(entry.oldMode, entry.oldBlob));
    acceptedBase.set(entry.path, identity(entry.newMode, entry.newBlob));
  }
  const product = "src/app/reviewed-product.tsx",
    stable = `100644 blob ${"a".repeat(40)}`;
  const registryPath = "testing/product-experience-exceptions.json";
  originalBase.set(product, stable);
  acceptedBase.set(product, stable);
  originalBase.set(registryPath, `100644 blob ${"b".repeat(40)}`);
  acceptedBase.set(registryPath, `100644 blob ${"c".repeat(40)}`);
  const originalSource = new Map(originalBase),
    candidate = new Map(acceptedBase);
  const args = { bridge, originalBase, acceptedBase, originalSource, candidate };
  r14.validateR14Overlay(args);
  for (const mutate of [
    (value) => value.acceptedBase.set("scripts/unlisted-authority.mjs", stable),
    (value) => value.candidate.set(product, `100644 blob ${"d".repeat(40)}`),
    (value) => value.candidate.set("public/unreviewed-product.svg", stable),
    (value) => value.candidate.set(registryPath, `100644 blob ${"e".repeat(40)}`),
    (value) => value.acceptedBase.set(bridge.overlay[0].path, `120000 blob ${bridge.overlay[0].newBlob}`),
    (value) => value.candidate.delete(product),
  ]) {
    const changed = {
      bridge,
      ...Object.fromEntries(
        Object.entries(args)
          .filter(([key]) => key !== "bridge")
          .map(([key, value]) => [key, new Map(value)]),
      ),
    };
    mutate(changed);
    assert.throws(() => r14.validateR14Overlay(changed), /R14_/u);
  }
});

test("actual pending producer preserves original R13 context and projects to original R8 without relabeling", (t) => {
  const { plan } = fixture(t),
    before = structuredClone(plan);
  const binding = plan.exception.nonExecutingReconciliation;
  assert.equal(binding.originalBaseSha, oldBase);
  assert.equal(binding.originalSourceDigest, oldSource);
  assert.equal(binding.originalPublicationCandidateSha, oldCandidate);
  assert.equal(binding.historicalException.id, CROSSDECK_R13.id);
  assert.equal(binding.historicalException.recordDigest, CROSSDECK_R13.recordDigest);
  const historical = r14.r14HistoricalEvidencePlan(plan);
  assert.equal(historical.baseSha, R8_FORMAT.baseSha);
  assert.equal(historical.sourceDigest, R8_FORMAT.sourceDigest);
  assert.equal(historical.candidateSha, R8_FORMAT.publicationCandidateSha);
  assert.equal(historical.exception.id, "PE-X-CROSSDECK-FINAL-VERIFY-20261015-R8");
  assert.deepEqual(plan, before);
  for (const mutate of [
    (value) => (value.sourceDigest = "changed"),
    (value) => (value.exception.nonExecutingReconciliation.originalBaseSha = plan.baseSha),
    (value) => (value.exception.nonExecutingReconciliation.originalSourceDigest = plan.sourceDigest),
    (value) => (value.exception.nonExecutingReconciliation.historicalException.id = r14.CROSSDECK_R14.id),
  ]) {
    const changed = structuredClone(plan);
    mutate(changed);
    assert.throws(() => r14.r14HistoricalEvidencePlan(changed), /R14_/u);
  }
});

test("installed R14 source denies grant removal and retirement never restores R13", (t) => {
  const f = fixture(t);
  const removed = {
    ...registry,
    exceptions: registry.exceptions.slice(0, 13),
    reconciliations: registry.reconciliations.slice(0, 6),
  };
  f.write("testing/product-experience-exceptions.json", removed);
  assert.throws(() => trustedExceptions(f.root, f.commit()), /R14_/u);
  const retired = structuredClone(registry);
  retired.exceptions[13].status = "RETIRED";
  f.write("testing/product-experience-exceptions.json", retired);
  assert.deepEqual(trustedExceptions(f.root, f.commit()), []);
});

test("forbidden R14 stages fail before any inert reservation read or write", async (t) => {
  const { plan } = fixture(t);
  const operations = [],
    store = { read: (slot) => operations.push(["read", slot]), create: (slot) => operations.push(["create", slot]) };
  for (const mode of ["capture", "review", "verify", "local", "prepare", "release", "focused", "readiness"])
    await assert.rejects(() => reserveExceptionStage({ record, plan, mode, store }), /R14_MODE_FORBIDDEN/u);
  assert.deepEqual(operations, []);
});

function memoryRequest(f) {
  const baseTree = f.git("rev-parse", `${f.baseSha}^{tree}`);
  const initial = f
    .git("ls-tree", "-z", f.baseSha)
    .split("\0")
    .filter(Boolean)
    .map((entry) => {
      const [metadata, file] = entry.split("\t"),
        [mode, type, sha] = metadata.split(" ");
      return { path: file, mode, type, sha };
    });
  const commits = new Map([[f.baseSha, { tree: { sha: baseTree }, parents: [] }]]);
  const trees = new Map([[baseTree, { tree: initial, truncated: false }]]),
    blobs = new Map(),
    refs = new Map(),
    operations = [];
  const request = async (endpoint, method = "GET", body) => {
    operations.push({ endpoint, method });
    if (method === "GET") {
      if (endpoint.startsWith("git/ref/")) return refs.get(endpoint.slice(8)) ?? null;
      if (endpoint.startsWith("git/commits/")) return commits.get(endpoint.slice(12));
      if (endpoint.startsWith("git/trees/")) return trees.get(endpoint.slice(10));
      if (endpoint.startsWith("git/blobs/")) return blobs.get(endpoint.slice(10));
    }
    assert.equal(method, "POST");
    if (endpoint === "git/blobs") {
      const id = sha(body);
      blobs.set(id, { content: Buffer.from(body.content).toString("base64") });
      return { sha: id };
    }
    if (endpoint === "git/trees") {
      const id = sha(body);
      trees.set(id, { tree: [...trees.get(body.base_tree).tree, ...body.tree], truncated: false });
      return { sha: id };
    }
    if (endpoint === "git/commits") {
      const id = sha(body);
      commits.set(id, { tree: { sha: body.tree }, parents: body.parents.map((sha) => ({ sha })) });
      return { sha: id };
    }
    if (endpoint === "git/refs") {
      const key = body.ref.slice(5);
      assert(!refs.has(key));
      refs.set(key, { object: { type: "commit", sha: body.sha } });
      return {};
    }
    assert.fail(`Unexpected inert request: ${method} ${endpoint}`);
  };
  return { request, operations };
}

test("actual R14 store consumes one create-only qualify namespace in memory and never updates old grants", async (t) => {
  const f = fixture(t),
    remote = memoryRequest(f),
    store = exceptionStore({ record, request: remote.request });
  const payload = { binding: exceptionBinding(f.plan), candidateSha: f.candidateSha, run: { runId: 1, runAttempt: 1 } };
  const value = await store.create("qualify", payload);
  assert.equal(value.exceptionId, record.id);
  assert.equal((await store.read("qualify")).commitSha, value.commitSha);
  await assert.rejects(() => store.create("qualify", payload), /SLOT_CONSUMED/u);
  assert.deepEqual(
    remote.operations.filter((item) => item.method !== "GET").map((item) => item.endpoint),
    ["git/blobs", "git/trees", "git/commits", "git/refs"],
  );
  assert(
    remote.operations
      .filter((item) => item.endpoint.startsWith("git/ref/"))
      .every((item) => item.endpoint.includes(record.custody.namespace)),
  );
  assert(!remote.operations.some((item) => ["PATCH", "PUT", "DELETE"].includes(item.method)));
});

function decisionFixture(plan) {
  const run = { runId: 71 };
  const ordinary = {
    mode: "ordinary",
    baseSha: plan.baseSha,
    candidateSha: plan.candidateSha,
    selected: { unitTests: ["src/fixture.test.ts"], browserTests: record.requiredTechnicalBrowserTests },
    safetyPaths: ["prisma/seed.ts"],
    lintPaths: ["prisma/seed.ts"],
    databaseUrl: "file:./fixture.sqlite",
    migrationRequired: true,
    buildRequired: true,
    registrationValidationRequired: true,
    migrationScripts: [],
  };
  const groups = verificationObligationGroups(ordinary);
  const decision = {
    ...ordinary,
    decision: "PASS",
    productExperience: {
      ...plan,
      trustedAttestation: {
        status: "PASS",
        exception: plan.exception,
        currentBaseSha: plan.baseSha,
        currentSourceDigest: plan.sourceDigest,
        reviewedBaseSha: R8_FORMAT.baseSha,
        reviewedSourceDigest: R8_FORMAT.sourceDigest,
        captureArtifactId: R8_FORMAT.captureArtifact,
        reviewArtifactId: R8_FORMAT.reviewArtifact,
        exceptionCustody: { prepareReservation: R8_FORMAT.prepareCommit, reviewSeal: R8_FORMAT.reviewSeal },
        nonExecutingReconciliation: plan.exception.nonExecutingReconciliation,
      },
    },
    productExperienceDecision: {
      status: "PASS",
      sourceDigest: plan.sourceDigest,
      reviewedBaseSha: R8_FORMAT.baseSha,
      reviewedSourceDigest: R8_FORMAT.sourceDigest,
      nonExecutingReconciliation: plan.exception.nonExecutingReconciliation,
    },
    productExperienceReplay: { status: "PASS", sourceDigest: plan.sourceDigest },
    r14Observation: {
      version: 1,
      status: "COMPLETE",
      observationId: "CROSSDECK-R14-ORDINARY-OBSERVATION-20261017",
      exceptionId: r14.CROSSDECK_R14.id,
      repository: "Kgray44/treasurehuntSoT",
      baseSha: plan.baseSha,
      candidateSha: plan.candidateSha,
      sourceDigest: plan.sourceDigest,
      runId: run.runId,
      runAttempt: 1,
      job: "final-check",
      keyId: "f82684218e386d09e9120d0c7b54722e5833e5c18a3d7a8a73d94b9afead48bc",
      format: "VW-POSTTECHNICAL-EVIDENCE-1",
      ciphertextDigest: "f".repeat(64),
      ciphertextBytes: 100,
      memberCount: 2,
      rawBytes: 0,
      evidenceLoss: false,
      cleanup: true,
      sourceUnchanged: true,
      coverage: "SUPPORTED_REPLAY_ADMISSION_GIT_READS_AND_FINAL_PROPAGATED_ERROR",
      supportedGitReads: 257,
      observedGitThrows: 0,
      retainedGitThrows: 0,
    },
    timing: { commands: groups.map((group) => ({ obligationId: group.id, status: "PASS" })) },
    evidenceReconciliation: {
      requiredObligations: 8,
      obligations: groups.map((group) => ({ id: group.id, commands: group.commandLabels })),
      reconciliation: groups.map((group) => ({
        obligationId: group.id,
        receiptId: `receipt-${group.id}`,
        disposition: "FRESH",
        freshExecuted: true,
      })),
      finalization: {
        authority: "SOUNDING_LINE_EVIDENCE_FINALIZER",
        decision: "PASS",
        requiredObligations: 8,
        errors: [],
        remainder: [],
        closure: groups.map((group) => ({ obligationId: group.id, receiptId: `receipt-${group.id}`, satisfied: true })),
      },
    },
  };
  return { ordinary, groups, decision, run };
}

test("R14 final decision requires current38-context replay, fresh technical work and all eight obligations", async (t) => {
  const { plan } = fixture(t),
    args = decisionFixture(plan);
  assert.equal(args.groups.length, 8);
  assert.equal(args.ordinary.selected.browserTests.length, 6);
  await r14.validateR14FinalDecision({ plan, record, ...args });
  for (const mutate of [
    (value) => value.evidenceReconciliation.finalization.closure.pop(),
    (value) =>
      (value.evidenceReconciliation.reconciliation.find(
        (entry) => entry.obligationId === args.groups.find((group) => group.kind === "browser").id,
      ).freshExecuted = false),
    (value) => (value.evidenceReconciliation.finalization.decision = "FAIL"),
    (value) => (value.productExperienceReplay.status = "FAIL"),
    (value) => (value.productExperienceReplay.sourceDigest = oldSource),
    (value) => (value.productExperience.contextCount = 37),
    (value) => (value.productExperience.trustedAttestation.status = "FAIL"),
    (value) => value.selected.browserTests.pop(),
    (value) => delete value.r14Observation,
    (value) => value.r14Observation.runId++,
    (value) => (value.r14Observation.sourceDigest = oldSource),
    (value) => (value.r14Observation.evidenceLoss = true),
    (value) => (value.r14Observation.cleanup = false),
    (value) => (value.r14Observation.sourceUnchanged = false),
    (value) => (value.r14Observation.supportedGitReads = 0),
    (value) => (value.r14Observation.observedGitThrows = 1),
  ]) {
    const changed = structuredClone(args.decision);
    mutate(changed);
    await assert.rejects(async () =>
      r14.validateR14FinalDecision({
        plan,
        record,
        ordinary: args.ordinary,
        groups: args.groups,
        decision: changed,
        run: args.run,
      }),
    );
  }
  assert.throws(
    () => r14.validateR14FinalDecision({ plan, record, ...args, run: undefined }),
    /R14_OBSERVATION_INTEGRITY_REQUIRED/u,
  );
});
