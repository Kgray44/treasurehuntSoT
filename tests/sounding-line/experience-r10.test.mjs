import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  CROSSDECK_R10,
  R10_OVERLAY_PATHS,
  validateR10Record,
  validateR10Bridge,
  validateR10Registry,
  r10HistoricalEvidencePlan,
  validateR10Overlay,
  validateR10HistoricalCustody,
  validateR10FinalDecision,
} from "../../scripts/sounding-line/experience-r10.mjs";
import { R8_FORMAT, r8FormatEvidencePlan } from "../../scripts/sounding-line/experience-r8-format.mjs";
import {
  selectTrustedExceptions,
  validateExceptionRecord,
  recordBinding,
  exceptionBinding,
  exceptionStore,
  reserveExceptionStage,
  sealExceptionQualification,
} from "../../scripts/sounding-line/experience-exception.mjs";
import { verificationObligationGroups } from "../../scripts/sounding-line/ordinary.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const registry = JSON.parse(readFileSync(path.join(repo, "testing/product-experience-exceptions.json"), "utf8"));
const record = registry.exceptions.find((entry) => entry.id === CROSSDECK_R10.id);
const snapshot = JSON.parse(
  readFileSync(
    path.join(
      repo,
      "Development_Docs/Programs/Sounding_Line/evidence/crossdeck-r9-ordinary-only-20261016/r8-custody-read-only.original.raw.txt",
    ),
    "utf8",
  ),
);
const consumed = JSON.parse(
  readFileSync(
    path.join(
      repo,
      "Development_Docs/Programs/Sounding_Line/evidence/crossdeck-r10-ordinary-only-20261016/r9-consumed-frozen-publication.derived.json",
    ),
    "utf8",
  ),
);
const hash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
function planFixture() {
  const bridge = {
    version: 1,
    id: CROSSDECK_R10.bridgeId,
    status: "ACTIVE",
    exceptionId: CROSSDECK_R10.id,
    recordDigest: CROSSDECK_R10.recordDigest,
    overlay: R10_OVERLAY_PATHS.map((file) => ({
      path: file,
      oldMode: null,
      oldBlob: null,
      newMode: "100644",
      newBlob: "b".repeat(40),
    })),
  };
  const historicalException = structuredClone(snapshot.custody.qualify.binding.exception);
  delete historicalException.nonExecutingReconciliation;
  const plan = {
    applicable: true,
    baseSha: "a".repeat(40),
    candidateSha: "c".repeat(40),
    sourceDigest: "d".repeat(64),
    contractDigest: R8_FORMAT.contractDigest,
    contextCount: 38,
    exception: recordBinding(record),
  };
  plan.exception.nonExecutingReconciliation = {
    version: 1,
    id: bridge.id,
    recordDigest: hash(bridge),
    originalBaseSha: R8_FORMAT.baseSha,
    originalSourceDigest: R8_FORMAT.sourceDigest,
    originalPublicationCandidateSha: R8_FORMAT.publicationCandidateSha,
    currentBaseSha: plan.baseSha,
    currentSourceDigest: plan.sourceDigest,
    overlay: bridge.overlay,
    historicalException,
  };
  return { plan, bridge };
}
function decisionFixture(plan) {
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
  assert.equal(groups.length, 8);
  const decision = {
    ...ordinary,
    decision: "PASS",
    candidateTree: "e".repeat(40),
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
    timing: { commands: groups.map((group) => ({ obligationId: group.id, status: "PASS" })) },
    evidenceReconciliation: {
      requiredObligations: groups.length,
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
        requiredObligations: groups.length,
        errors: [],
        remainder: [],
        closure: groups.map((group) => ({ obligationId: group.id, receiptId: `receipt-${group.id}`, satisfied: true })),
      },
    },
  };
  return { ordinary, decision, groups };
}

test("R10 retains all predecessors, failed ordinary3, original expiry and zero extra execution budgets", () => {
  validateR10Record(record);
  assert.deepEqual(selectTrustedExceptions(registry.exceptions), [record]);
  assert.equal(record.immutableHistory.length, 1230);
  assert.equal(record.attemptHistory.nextOrdinaryDispatchTotal, 4);
  assert.equal(record.attemptHistory.priorOrdinaryFailures, 3);
  assert.equal(record.predecessor.qualifyCommit, consumed.custody.qualify.commitSha);
  const payload = { ...consumed.custody.qualify };
  delete payload.commitSha;
  assert.equal(hash(payload), record.predecessor.qualifyPayloadDigest);
  assert.equal(consumed.custody.qualified, null);
  assert.equal(record.expiresAt, "2026-10-22T23:59:59Z");
  assert.equal(record.attemptHistory.priorPairedLocalCaseAccounting.r6.pairedCaseExecutions, null);
  for (const [key, value] of Object.entries(record.executionBudget))
    assert.equal(
      value,
      ["ordinaryInvocations", "ordinaryExperienceReplayPasses", "technicalE2EInvocations"].includes(key) ? 1 : 0,
      key,
    );
  for (const change of [
    (r) => r.executionBudget.preparationPasses++,
    (r) => r.executionBudget.newIndependentReviews++,
    (r) => r.executionBudget.authenticatedReviewSubmissions++,
    (r) => r.executionBudget.targetedLocalProofInvocations++,
    (r) => r.executionBudget.reruns++,
    (r) => r.executionBudget.refunds++,
    (r) => r.immutableHistory.pop(),
    (r) => (r.expiresAt = "2026-10-23T23:59:59Z"),
    (r) => (r.predecessor.qualifyPayloadDigest = "changed"),
  ]) {
    const changed = structuredClone(record);
    change(changed);
    assert.throws(() => validateR10Record(changed), /R10_RECORD_CHANGED/u);
  }
  const retired = structuredClone(registry.exceptions);
  retired.at(-1).status = "RETIRED";
  assert.deepEqual(selectTrustedExceptions(retired), []);
  retired[0].priorRepairRecaptureAttempts = 0;
  assert.throws(() => selectTrustedExceptions(retired), /REGISTRY_CHANGED|SCOPE_CHANGED|RECORD_CHANGED/u);
  assert.throws(() => validateExceptionRecord(record, new Date(record.expiresAt)), /EXPIRED/u);
});

test("R10 historical projection retains the original R8 tuple and leaves the current plan untouched", () => {
  const { plan, bridge } = planFixture();
  const original = structuredClone(plan);
  validateR10Bridge(bridge);
  const historical = r8FormatEvidencePlan(plan);
  assert.equal(historical.baseSha, R8_FORMAT.baseSha);
  assert.equal(historical.candidateSha, R8_FORMAT.publicationCandidateSha);
  assert.equal(historical.sourceDigest, R8_FORMAT.sourceDigest);
  assert.equal(historical.exception.id, record.historicalEvidence.exceptionId);
  assert.deepEqual(plan, original);
  for (const change of [
    (p) => (p.sourceDigest = "changed"),
    (p) => (p.baseSha = "f".repeat(40)),
    (p) => (p.exception.recordDigest = "changed"),
    (p) => (p.exception.nonExecutingReconciliation.historicalException.version = 9),
    (p) => p.exception.nonExecutingReconciliation.overlay.pop(),
  ]) {
    const changed = structuredClone(plan);
    change(changed);
    assert.throws(() => r10HistoricalEvidencePlan(changed), /R10_/u);
  }
});

test("R10 exact overlay preserves preexisting consumer config and rejects runtime, mode and scope substitution", () => {
  const { bridge } = planFixture();
  const originalBase = new Map();
  const acceptedBase = new Map(bridge.overlay.map((e) => [e.path, `100644 blob ${e.newBlob}`]));
  acceptedBase.set("testing/product-experience-exceptions.json", "100644 blob registry");
  const originalSource = new Map([
    [".gitattributes", "100644 blob consumer-preexisting"],
    ["src/fixture.ts", "100644 blob product"],
  ]);
  const candidate = new Map([...acceptedBase, ...originalSource]);
  const args = { bridge, originalBase, acceptedBase, originalSource, candidate };
  validateR10Overlay(args);
  for (const [file, metadata] of [
    ["src/fixture.ts", "100644 blob changed"],
    [".gitattributes", "100644 blob accepted-base-version"],
    ["scripts/unapproved.mjs", "100644 blob unapproved"],
    [R10_OVERLAY_PATHS[0], "120000 blob symlink"],
  ]) {
    const changed = new Map(candidate);
    changed.set(file, metadata);
    assert.throws(() => validateR10Overlay({ ...args, candidate: changed }), /R10_/u);
  }
  const changedBase = new Map(acceptedBase);
  changedBase.set("Development_Docs/unlisted.md", "100644 blob unrelated");
  assert.throws(() => validateR10Overlay({ ...args, acceptedBase: changedBase }), /R10_BASE_SCOPE_CHANGED/u);
});

test("R10 capture, review, verify and local modes reject before any custody read or write", async () => {
  const { plan } = planFixture();
  const operations = [];
  const store = {
    read: (slot) => {
      operations.push(["read", slot]);
    },
    create: (slot) => {
      operations.push(["create", slot]);
    },
  };
  for (const mode of ["capture", "review", "verify", "local", "prepare"])
    await assert.rejects(() => reserveExceptionStage({ record, plan, mode, store }), /R10_MODE_FORBIDDEN/u);
  for (const exception of [undefined, { id: record.predecessor.id }])
    await assert.rejects(
      () => reserveExceptionStage({ record, plan: { ...plan, exception }, mode: "capture", store }),
      /R9_STAGE_RECORD_PLAN_CHANGED/u,
    );
  await assert.rejects(
    () => reserveExceptionStage({ record: registry.exceptions[0], plan, mode: "ordinary", store }),
    /R9_STAGE_RECORD_PLAN_CHANGED/u,
  );
  assert.deepEqual(operations, []);
});

test("R10 historical custody uses only the four original seals and exact successful runs/artifacts", async () => {
  const { plan } = planFixture();
  const slots = [];
  const values = structuredClone(snapshot);
  const store = {
    read: async (slot) => {
      slots.push(slot);
      return values.custody[slot];
    },
  };
  const request = async (route) => values.resources[route];
  assert.equal((await validateR10HistoricalCustody({ plan, store, request })).length, 2);
  assert.deepEqual(slots, ["prepare", "capture", "review7", "review-submit"]);
  for (const slot of [...slots]) {
    const saved = values.custody[slot];
    values.custody[slot] = null;
    await assert.rejects(
      () => validateR10HistoricalCustody({ plan, store, request }),
      /R9_HISTORICAL_CUSTODY_CHANGED/u,
    );
    values.custody[slot] = saved;
  }
  values.resources[`actions/runs/${R8_FORMAT.reviewRun}`].conclusion = "cancelled";
  await assert.rejects(() => validateR10HistoricalCustody({ plan, store, request }), /R9_HISTORICAL_RUN_CHANGED/u);
});

test("R10 final consistency requires all eight canonical groups, fresh technical proof and current/historical attestation", () => {
  const { plan } = planFixture();
  const f = decisionFixture(plan);
  validateR10FinalDecision({ plan, record, ...f });
  const browser = f.groups.find((group) =>
    group.commands.some(([, args]) => args[0] === "scripts/sounding-line/run-browser-suite.mjs"),
  ).id;
  for (const change of [
    (d) => (d.productExperience.sourceDigest = R8_FORMAT.sourceDigest),
    (d) => (d.productExperience.trustedAttestation.currentBaseSha = R8_FORMAT.baseSha),
    (d) => (d.productExperience.trustedAttestation.exceptionCustody.reviewSeal = "changed"),
    (d) => (d.productExperienceDecision.reviewedSourceDigest = plan.sourceDigest),
    (d) => d.evidenceReconciliation.obligations.pop(),
    (d) => (d.evidenceReconciliation.obligations[1] = d.evidenceReconciliation.obligations[0]),
    (d) => d.evidenceReconciliation.obligations[0].commands.push("unverified"),
    (d) => (d.evidenceReconciliation.reconciliation[1] = d.evidenceReconciliation.reconciliation[0]),
    (d) => (d.evidenceReconciliation.finalization.closure[0].satisfied = false),
    (d) => (d.evidenceReconciliation.finalization.closure[0].receiptId = ""),
    (d) => d.evidenceReconciliation.finalization.errors.push("missing"),
    (d) => (d.evidenceReconciliation.finalization.remainder = ["missing"]),
    (d) => (d.evidenceReconciliation.finalization.authority = "parallel-engine"),
    (d) => (d.evidenceReconciliation.reconciliation.find((e) => e.obligationId === browser).freshExecuted = false),
    (d) => (d.timing.commands.find((e) => e.obligationId === browser).status = "REUSED"),
  ]) {
    const changed = structuredClone(f.decision);
    change(changed);
    assert.throws(() => validateR10FinalDecision({ ...f, plan, record, decision: changed }), /R(?:9|10)_/u);
  }
});

function storeFixture(plan) {
  const refs = new Map(),
    commits = new Map(),
    trees = new Map(),
    blobs = new Map(),
    operations = [];
  const baseTree = "f".repeat(40);
  trees.set(baseTree, { tree: [{ path: "src", mode: "040000", type: "tree", sha: "e".repeat(40) }] });
  commits.set(plan.baseSha, { tree: { sha: baseTree }, parents: [] });
  const request = async (route, method = "GET", body) => {
    operations.push({ route, method });
    if (method === "POST") {
      const sha = hash(body).slice(0, 40);
      if (route === "git/blobs") blobs.set(sha, { content: Buffer.from(body.content).toString("base64") });
      else if (route === "git/trees") trees.set(sha, { tree: [...trees.get(body.base_tree).tree, ...body.tree] });
      else if (route === "git/commits")
        commits.set(sha, { tree: { sha: body.tree }, parents: body.parents.map((value) => ({ sha: value })) });
      else if (route === "git/refs") {
        if (refs.has(body.ref)) throw Error("SLOT_CONSUMED");
        refs.set(body.ref, { object: { type: "commit", sha: body.sha } });
      } else throw Error("Unexpected write");
      return { sha };
    }
    if (route.startsWith("git/ref/")) return refs.get("refs/" + route.slice(8)) ?? null;
    if (route.startsWith("git/commits/")) return commits.get(route.slice(12));
    if (route.startsWith("git/trees/")) return trees.get(route.slice(10));
    if (route.startsWith("git/blobs/")) return blobs.get(route.slice(10));
    throw Error("Unexpected read " + route);
  };
  return { operations, request, store: exceptionStore({ record, request }) };
}
test("R10 exact campaign sealing uses current qualify only, binds full reservation/run and writes qualified once", async (t) => {
  const root = mkdtempSync(path.join(tmpdir(), "r10-sealing-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (...args) =>
    execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  git("init", "-q");
  git("config", "user.name", "Fixture");
  git("config", "user.email", "fixture@example.invalid");
  writeFileSync(path.join(root, "fixture.txt"), "synthetic\n");
  git("add", ".");
  git("commit", "-qm", "fixture");
  const { plan } = planFixture();
  plan.candidateSha = git("rev-parse", "HEAD");
  const { ordinary, decision } = decisionFixture(plan);
  decision.candidateTree = git("rev-parse", "HEAD^{tree}");
  const run = {
    runId: 40000000000,
    runAttempt: 1,
    actor: "Kgray44",
    event: "pull_request_target",
    headSha: plan.candidateSha,
    headBranch: "candidate",
    workflowId: 341545080,
    workflowPath: ".github/workflows/sounding-line-ordinary.yml",
    createdAt: "2026-10-16T18:00:00Z",
  };
  const api = storeFixture(plan);
  const args = { root, record, plan, ordinary, decision, run, store: api.store };
  // An old qualification is present; the current store must not fall back to it.
  const oldRecord = registry.exceptions.find((r) => r.id === record.predecessor.id);
  const oldStore = exceptionStore({ record: oldRecord, request: api.request });
  await oldStore.create("qualify", {
    binding: exceptionBinding(plan),
    run,
    candidateSha: plan.candidateSha,
    candidateTree: decision.candidateTree,
  });
  api.operations.length = 0;
  await assert.rejects(() => sealExceptionQualification(args), /FINAL_DECISION_MISMATCH/u);
  assert(api.operations.every((op) => op.method === "GET"));
  const reservation = {
    binding: exceptionBinding(plan),
    run,
    candidateSha: plan.candidateSha,
    candidateTree: decision.candidateTree,
  };
  await api.store.create("qualify", reservation);
  for (const change of [(p) => (p.sourceDigest = "changed"), (p) => (p.baseSha = "b".repeat(40))]) {
    const changed = structuredClone(plan);
    change(changed);
    await assert.rejects(() => sealExceptionQualification({ ...args, plan: changed }), /FINAL_DECISION_MISMATCH/u);
  }
  await assert.rejects(
    () => sealExceptionQualification({ ...args, run: { ...run, actor: "other" } }),
    /FINAL_DECISION_MISMATCH/u,
  );
  for (const conclusion of ["failure", "cancelled", "ambiguous"]) {
    await assert.rejects(
      () => reserveExceptionStage({ ...args, mode: "ordinary", run: { ...run, conclusion } }),
      /QUALIFICATION_ALREADY_CONSUMED/u,
    );
  }
  await sealExceptionQualification(args);
  const qualified = await api.store.read("qualified");
  assert.deepEqual(qualified.binding, exceptionBinding(plan));
  assert.deepEqual(qualified.run, run);
  assert.equal((await oldStore.read("qualify")).candidateSha, plan.candidateSha);
  await assert.rejects(() => sealExceptionQualification(args), /SLOT_CONSUMED/u);
  const refWrites = api.operations.filter((op) => op.method === "POST" && op.route === "git/refs");
  assert.equal(refWrites.length, 2); // current qualify and qualified only
});

test("R10 preserves the complete accepted workflow and finite deadlines", () => {
  const file = ".github/workflows/sounding-line-ordinary.yml";
  const accepted = execFileSync("git", ["show", `2e2efa5b8b02e9e5dd0bb0b15d9b23c2f694d7ed:${file}`], {
    cwd: repo,
    encoding: "utf8",
  });
  assert.equal(readFileSync(path.join(repo, file), "utf8"), accepted);
});

test("R10 registry appends one grant and one bridge without changing the original nine rows or two reconciliations", () => {
  // During preparation the bridge is installed only after runtime blobs freeze.
  const { bridge } = planFixture();
  const value = structuredClone(registry);
  value.reconciliations = [...value.reconciliations.slice(0, 2), bridge];
  validateR10Registry(value);
  value.exceptions[0].status = "RETIRED";
  assert.throws(() => validateR10Registry(value), /R10_PREDECESSOR_REGISTRY_CHANGED/u);
});
