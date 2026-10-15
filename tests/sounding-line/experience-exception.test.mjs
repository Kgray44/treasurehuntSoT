import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  bindExperienceException,
  campaignRelated,
  claimExceptionPhase,
  exceptionBinding,
  exceptionStore,
  requireExceptionPhase,
  requireSuccessfulReservation,
  sealedReviewIdentity,
  validateExceptionEvidence,
  validateExceptionRecord,
  validateExceptionExecutionPlan,
  requireFirstCampaignRun,
  reserveExceptionStage,
  validateLiveContext,
  verifyExceptionAttestation,
} from "../../scripts/sounding-line/experience-exception.mjs";
import { planProductExperience } from "../../scripts/sounding-line/product-experience.mjs";
import {
  captureProductExperience,
  runTrustedExperienceReplay,
} from "../../scripts/sounding-line/experience-browser.mjs";
import { exceptionCommandRunner, run as runVerificationCommand } from "../../scripts/sounding-line/ordinary.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const template = JSON.parse(readFileSync(path.join(repo, "testing/product-experience-exceptions.json"), "utf8"))
  .exceptions[0];
const hash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const now = new Date("2026-10-15T14:00:00Z");
function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), "experience-exception-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (...args) =>
    execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  const write = (file, value) => {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), typeof value === "string" ? value : JSON.stringify(value));
  };
  const commit = () => {
    git("add", ".");
    git("commit", "-qm", "fixture");
    return git("rev-parse", "HEAD");
  };
  git("init", "-q");
  git("config", "user.name", "Fixture");
  git("config", "user.email", "fixture@example.invalid");
  for (const file of [
    "src/product.ts",
    "public/icon.txt",
    "prisma/schema.prisma",
    "scripts/sounding-line/browser-authority.mjs",
    "tests/e2e/crossdeck.spec.ts",
  ])
    write(file, "historical");
  write("package.json", { scripts: { "test:sounding-line": "old" }, dependencies: { safe: "1" } });
  for (const file of ["package-lock.json", "next.config.ts", "tsconfig.json", "playwright.config.ts"])
    write(file, "{}");
  write("testing/contracts.json", { contracts: [] });
  const historical = commit();
  write("src/product.ts", "frozen product");
  write("tests/e2e/crossdeck.spec.ts", "frozen E2E");
  const historyPath = template.immutableHistory[0].path;
  write(historyPath, { attempts: 11, reviews: 2 });
  const frozen = commit();
  const record = structuredClone(template);
  record.frozenReferenceSha = frozen;
  record.frozenHistoricalBaseSha = historical;
  record.frozenTrees = Object.fromEntries(
    ["src", "public", "prisma"].map((file) => [file, git("rev-parse", `${frozen}:${file}`)]),
  );
  record.frozenBlobs = Object.fromEntries(
    ["package.json", "package-lock.json", "next.config.ts", "tsconfig.json", "playwright.config.ts"].map((file) => [
      file,
      git("rev-parse", `${frozen}:${file}`),
    ]),
  );
  record.immutableHistory = [{ path: historyPath, blob: git("rev-parse", `${frozen}:${historyPath}`) }];
  record.protectedBaseRuntimeOverrides = [
    {
      path: "tests/e2e/crossdeck.spec.ts",
      mode: "100644",
      blob: git("rev-parse", `${frozen}:tests/e2e/crossdeck.spec.ts`),
    },
  ];
  git("checkout", "-qb", "protected", historical);
  write("scripts/sounding-line/browser-authority.mjs", "accepted lifecycle");
  write("tests/accepted-infrastructure.test.mjs", "accepted tests");
  write("package.json", { scripts: { "test:sounding-line": "accepted" }, dependencies: { safe: "1" } });
  write("testing/product-experience-exceptions.json", { version: 1, exceptions: [record] });
  const baseSha = commit();
  git("merge", "--no-edit", frozen);
  const candidateSha = git("rev-parse", "HEAD");
  const contracts = record.contractIds.map((id, index) => ({
    id,
    experience: {
      devices: ["DESKTOP", "MOBILE"],
      journeys: Array.from({ length: index === 6 ? 4 : 2 }, (_, j) => ({ id: String(j), roles: ["PLAYER"] })),
    },
  }));
  const plan = {
    applicable: true,
    baseSha,
    candidateSha,
    sourceDigest: "b".repeat(64),
    contractDigest: record.contractDigest,
    contractIds: record.contractIds,
    contracts,
  };
  plan.exception = bindExperienceException({ root, baseSha, candidateSha, plan, now });
  return { root, git, write, commit, record, plan, baseSha, candidateSha, frozen, now };
}
function apiFixture(record, plan) {
  const refs = new Map(),
    blobs = new Map(),
    trees = new Map(),
    commits = new Map(),
    runs = new Map();
  const operations = [];
  let loseNextRefResponse = false,
    failBeforeRef = false;
  const baseTree = "f".repeat(40);
  trees.set(baseTree, {
    tree: [
      { path: ".github", mode: "040000", type: "tree", sha: "e".repeat(40) },
      { path: "src", mode: "040000", type: "tree", sha: "d".repeat(40) },
    ],
  });
  commits.set(plan.baseSha, { tree: { sha: baseTree }, parents: [] });
  const request = async (endpoint, method = "GET", body) => {
    operations.push({ endpoint, method });
    if (method === "POST") {
      const sha = hash(body).slice(0, 40);
      if (endpoint === "git/blobs") {
        if (failBeforeRef) {
          failBeforeRef = false;
          throw Error("Failure before ref creation");
        }
        blobs.set(sha, { content: Buffer.from(body.content).toString("base64") });
        return { sha };
      }
      if (endpoint === "git/trees") {
        trees.set(sha, { tree: [...structuredClone(trees.get(body.base_tree)?.tree ?? []), ...body.tree] });
        return { sha };
      }
      if (endpoint === "git/commits") {
        commits.set(sha, { tree: { sha: body.tree }, parents: body.parents.map((value) => ({ sha: value })) });
        return { sha };
      }
      if (endpoint === "git/refs") {
        if (refs.has(body.ref)) throw Error("PRODUCT_EXPERIENCE_EXCEPTION_SLOT_CONSUMED");
        refs.set(body.ref, { object: { type: "commit", sha: body.sha } });
        if (loseNextRefResponse) {
          loseNextRefResponse = false;
          throw Error("Unknown network outcome");
        }
        return refs.get(body.ref);
      }
    }
    if (endpoint.startsWith("git/ref/")) return refs.get(`refs/${endpoint.slice(8)}`) ?? null;
    if (endpoint.startsWith("git/blobs/")) return blobs.get(endpoint.slice(10));
    if (endpoint.startsWith("git/trees/")) return trees.get(endpoint.slice(10));
    if (endpoint.startsWith("git/commits/")) return commits.get(endpoint.slice(12));
    if (endpoint.endsWith("/jobs?per_page=100"))
      return {
        total_count: 4,
        jobs: Array.from({ length: 4 }, () => ({ status: "completed", conclusion: "skipped" })),
      };
    if (endpoint.startsWith("actions/runs/")) return runs.get(Number(endpoint.slice(13))) ?? null;
    if (endpoint.startsWith("actions/workflows/5/runs?"))
      return { total_count: runs.size, workflow_runs: [...runs.values()] };
    if (endpoint === `pulls/${record.pullRequest}`)
      return {
        state: "open",
        base: { ref: "main" },
        head: { sha: plan.candidateSha, ref: "candidate", repo: { full_name: record.repository } },
      };
    if (endpoint === "actions/workflows/5") return { path: ".github/workflows/sounding-line-ordinary.yml" };
    throw Error(`Unexpected API ${method} ${endpoint}`);
  };
  refs.set("refs/heads/main", { object: { sha: plan.baseSha } });
  return {
    request,
    store: exceptionStore({ record, request }),
    refs,
    runs,
    operations,
    trees,
    commits,
    failBeforeRef: () => {
      failBeforeRef = true;
    },
    loseResponse: () => {
      loseNextRefResponse = true;
    },
  };
}
function runIdentity(plan, id = 10, event = "workflow_dispatch", mode = "capture") {
  return {
    runId: id,
    runAttempt: 1,
    actor: "Kgray44",
    workflowPath: ".github/workflows/sounding-line-ordinary.yml",
    event,
    headSha: event === "workflow_dispatch" ? plan.baseSha : plan.candidateSha,
    headBranch: event === "workflow_dispatch" ? "main" : "candidate",
    createdAt: "2026-10-15T14:00:00Z",
    workflowId: 5,
    displayTitle: `Sounding Line finite 1 ${mode} 721 ${plan.candidateSha} active`,
  };
}
function remoteRun(identity, status = "in_progress", conclusion = null) {
  return {
    id: identity.runId,
    run_attempt: 1,
    event: identity.event,
    head_sha: identity.headSha,
    head_branch: identity.headBranch,
    head_repository: { full_name: template.repository },
    actor: { login: "Kgray44" },
    triggering_actor: { login: "Kgray44" },
    workflow_id: 5,
    status,
    conclusion,
    created_at: identity.createdAt,
    display_title: identity.displayTitle,
    path: identity.workflowPath,
  };
}
function environment(plan) {
  return {
    GITHUB_ACTIONS: "true",
    GITHUB_REPOSITORY: template.repository,
    GITHUB_REF: "refs/heads/main",
    GITHUB_SHA: plan.baseSha,
    GITHUB_RUN_ATTEMPT: "1",
    GITHUB_ACTOR: "Kgray44",
    GITHUB_TRIGGERING_ACTOR: "Kgray44",
    GITHUB_WORKFLOW_REF: `${template.repository}/.github/workflows/sounding-line-ordinary.yml@refs/heads/main`,
    GITHUB_RUN_ID: "10",
  };
}
test("frozen product and tests combine only with exact accepted lifecycle runtime", (t) => {
  const f = fixture(t);
  assert.equal(f.plan.exception.priorRepairRecaptureAttempts, 11);
  assert.equal(f.plan.exception.independentReviewOrdinal, 3);
  f.write("scripts/sounding-line/browser-authority.mjs", "historical");
  const changed = f.commit();
  assert.throws(
    () => bindExperienceException({ ...f, candidateSha: changed, plan: f.plan, now }),
    /RUNTIME_BINDING_CHANGED/u,
  );
});
for (const [name, file, value, code] of [
  ["product repair", "src/product.ts", "repair", "FROZEN_PRODUCT_CHANGED"],
  ["dependency change", "package-lock.json", "changed", "FROZEN_CONFIGURATION_CHANGED"],
  [
    "package script not enumerated",
    "package.json",
    { scripts: { "test:sounding-line": "accepted", capture: "changed" }, dependencies: { safe: "1" } },
    "FROZEN_PACKAGE_CHANGED",
  ],
  ["new runtime file", "scripts/new-runtime.mjs", "extra", "RUNTIME_BINDING_CHANGED"],
  ["changed frozen E2E", "tests/e2e/crossdeck.spec.ts", "weakened", "RUNTIME_BINDING_CHANGED"],
  ["rewritten eleven history", template.immutableHistory[0].path, { attempts: 3 }, "HISTORY_CHANGED"],
])
  test(`exception rejects ${name}`, (t) => {
    const f = fixture(t);
    f.write(file, value);
    const candidateSha = f.commit();
    assert.throws(() => bindExperienceException({ ...f, candidateSha, plan: f.plan, now }), new RegExp(code, "u"));
  });
test("deleted and renamed accepted runtime paths are rejected", (t) => {
  const f = fixture(t);
  f.git("mv", "scripts/sounding-line/browser-authority.mjs", "scripts/renamed.mjs");
  const candidateSha = f.commit();
  assert.throws(() => bindExperienceException({ ...f, candidateSha, plan: f.plan, now }), /RUNTIME_BINDING_CHANGED/u);
});
test("records-only candidate and missing exception fields cannot evade campaign admission", (t) => {
  const f = fixture(t);
  assert.equal(campaignRelated({ ...f, record: f.record }), true);
  assert.throws(
    () => planProductExperience({ ...f, changedPaths: ["Development_Docs/record.md"] }),
    /PLAN_SCOPE_CHANGED/u,
  );
  assert.throws(() => validateExceptionEvidence(f.plan, { reviews: [{ iterations: 3 }] }), /EVIDENCE_BINDING_MISSING/u);
  assert.throws(
    () =>
      validateExceptionEvidence(f.plan, {
        exception: f.plan.exception,
        reviews: [{ iterations: 3, independentReviewOrdinal: 3 }],
      }),
    /HISTORY_OR_REVIEW_ORDINAL_CHANGED/u,
  );
});
test("candidate cannot activate its own registry on an older protected base", (t) => {
  const f = fixture(t);
  assert.throws(
    () => bindExperienceException({ ...f, baseSha: f.record.frozenHistoricalBaseSha, plan: f.plan, now }),
    /APPROVAL_MISSING_OR_INACTIVE/u,
  );
});
test("expiry and record enlargement fail closed", () => {
  assert.throws(() => validateExceptionRecord(template, new Date(template.expiresAt)), /EXPIRED/u);
  for (const mutation of [
    (r) => (r.priorRepairRecaptureAttempts = 3),
    (r) => (r.remainingIndependentReviewOrdinal = 4),
    (r) => (r.executionBudget.preparationPasses = 2),
    (r) => delete r.ownerApproval,
  ]) {
    const r = structuredClone(template);
    mutation(r);
    assert.throws(() => validateExceptionRecord(r, now), /RECORD_INVALID/u);
  }
});
test("atomic campaign-global reservation admits one concurrent winner and has no refund", async (t) => {
  const f = fixture(t),
    api = apiFixture(f.record, f.plan),
    value = { binding: exceptionBinding(f.plan), run: runIdentity(f.plan), candidateSha: f.candidateSha };
  const results = await Promise.allSettled([
    api.store.create("prepare", value),
    api.store.create("prepare", { ...value, candidateSha: "e".repeat(40) }),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(results.filter((r) => r.status === "rejected").length, 1);
  await assert.rejects(() => api.store.create("prepare", value), /SLOT_CONSUMED/u);
  assert.equal(
    api.operations.some((op) => !["GET", "POST"].includes(op.method)),
    false,
  );
});
test("unknown reservation publication outcome stays consumed", async (t) => {
  const f = fixture(t),
    api = apiFixture(f.record, f.plan);
  api.loseResponse();
  const value = { binding: exceptionBinding(f.plan), run: runIdentity(f.plan) };
  await assert.rejects(() => api.store.create("prepare", value), /Unknown network outcome/u);
  await assert.rejects(() => api.store.create("prepare", value), /SLOT_CONSUMED/u);
});
for (const conclusion of ["failure", "cancelled", null])
  test(`${conclusion ?? "unfinished"} capture cannot establish provenance or refund`, async (t) => {
    const f = fixture(t),
      api = apiFixture(f.record, f.plan),
      run = runIdentity(f.plan);
    await api.store.create("prepare", { binding: exceptionBinding(f.plan), run });
    api.runs.set(run.runId, remoteRun(run, conclusion ? "completed" : "in_progress", conclusion));
    await assert.rejects(
      () => requireSuccessfulReservation({ store: api.store, slot: "prepare", plan: f.plan, request: api.request }),
      /RESERVED_RUN_NOT_SUCCESSFUL/u,
    );
    await assert.rejects(
      () => api.store.create("prepare", { binding: exceptionBinding(f.plan), run }),
      /SLOT_CONSUMED/u,
    );
  });
test("live context binds both real workflow event forms and rejects stale main, head, actor and rerun", async (t) => {
  const f = fixture(t),
    api = apiFixture(f.record, f.plan),
    env = environment(f.plan);
  for (const event of ["workflow_dispatch", "pull_request_target"]) {
    api.runs.set(10, remoteRun(runIdentity(f.plan, 10, event)));
    assert.equal(
      (await validateLiveContext({ record: f.record, plan: f.plan, request: api.request, environment: env, now }))
        .event,
      event,
    );
  }
  for (const mutation of [
    (e) => (e.GITHUB_RUN_ATTEMPT = "2"),
    (e) => (e.GITHUB_ACTOR = "other"),
    (e) => (e.GITHUB_TRIGGERING_ACTOR = "other"),
    (e) => (e.GITHUB_SHA = "f".repeat(40)),
    (e) => (e.GITHUB_WORKFLOW_REF = "candidate/workflow"),
  ]) {
    const changed = { ...env };
    mutation(changed);
    await assert.rejects(
      () => validateLiveContext({ record: f.record, plan: f.plan, request: api.request, environment: changed, now }),
      /PROTECTED_EXECUTOR_REQUIRED/u,
    );
  }
  api.refs.set("refs/heads/main", { object: { sha: "f".repeat(40) } });
  await assert.rejects(
    () => validateLiveContext({ record: f.record, plan: f.plan, request: api.request, environment: env, now }),
    /LIVE_SOURCE_OR_EXECUTOR_CHANGED/u,
  );
});
test("a reservation cannot be read as permission for repeated launches or a changed phase", (t) => {
  const f = fixture(t),
    value = claimExceptionPhase({ root: f.root, phase: "experience", plan: f.plan, runId: 10 });
  assert.equal(
    requireExceptionPhase({
      root: f.root,
      phase: "experience",
      plan: f.plan,
      environment: { GITHUB_RUN_ID: "10", SOUNDING_LINE_EXCEPTION_LEASE: value.lease },
    }).ownerPid,
    process.pid,
  );
  assert.throws(
    () => claimExceptionPhase({ root: f.root, phase: "experience", plan: f.plan, runId: 11 }),
    /EXECUTION_PHASE_ALREADY_CONSUMED/u,
  );
  assert.throws(
    () =>
      requireExceptionPhase({
        root: f.root,
        phase: "experience",
        plan: f.plan,
        environment: { GITHUB_RUN_ID: "10", SOUNDING_LINE_EXCEPTION_LEASE: "candidate-claim" },
      }),
    /EXECUTION_PHASE_BINDING_MISMATCH/u,
  );
  assert.throws(
    () => requireExceptionPhase({ root: f.root, phase: "technical", plan: f.plan }),
    /EXECUTION_PHASE_NOT_RESERVED/u,
  );
});
test("sealed exact review binds successful original capture and cannot substitute another reviewer", async (t) => {
  const f = fixture(t),
    api = apiFixture(f.record, f.plan),
    binding = exceptionBinding(f.plan),
    captureRun = runIdentity(f.plan),
    reviewRun = runIdentity(f.plan, 11);
  api.runs.set(10, remoteRun(captureRun, "completed", "success"));
  api.runs.set(11, remoteRun(reviewRun, "completed", "success"));
  const prepare = await api.store.create("prepare", { binding, run: captureRun });
  const capture = {
    exception: f.plan.exception,
    exceptionPreparationReservation: prepare.commitSha,
    trustedArtifact: { id: 100, digest: "sha256:" + "e".repeat(64), runId: 10, runAttempt: 1 },
  };
  const evidence = {
    captureArtifactId: 100,
    artifacts: [{ id: "actual" }],
    journeys: [{ id: "journey" }],
    reviews: [{ reviewerContext: "independent", iterations: 11, independentReviewOrdinal: 3 }],
  };
  await api.store.create("capture", { binding, run: captureRun, provenance: capture.trustedArtifact });
  const seal = await api.store.create("review3", {
    binding,
    run: reviewRun,
    reviewIdentity: sealedReviewIdentity(f.plan, evidence),
  });
  const review = {
    exception: f.plan.exception,
    exceptionPreparationReservation: prepare.commitSha,
    exceptionReviewSeal: seal.commitSha,
  };
  assert.equal(
    (
      await verifyExceptionAttestation({
        root: f.root,
        plan: f.plan,
        evidence,
        capture,
        review,
        request: api.request,
        now,
      })
    ).reviewSeal,
    seal.commitSha,
  );
  evidence.reviews[0].reviewerContext = "replacement";
  await assert.rejects(
    () =>
      verifyExceptionAttestation({ root: f.root, plan: f.plan, evidence, capture, review, request: api.request, now }),
    /SEALED_EVIDENCE_MISMATCH/u,
  );
});
test("new blocking finding is terminal even when labeled resolved", () => {
  const plan = { exception: { id: template.id } };
  const evidence = {
    exception: plan.exception,
    reviews: [
      {
        iterations: 11,
        independentReviewOrdinal: 3,
        findings: [{ classification: "MAJOR_EXPERIENCE_DEFECT", disposition: "RESOLVED" }],
      },
    ],
  };
  assert.throws(() => validateExceptionEvidence(plan, evidence), /NEW_BLOCKING_FINDING/u);
});
test("a supplied replay plan cannot remove journeys while retaining claimed digest strings", () => {
  const actual = {
    baseSha: "a".repeat(40),
    candidateSha: "b".repeat(40),
    sourceDigest: "c".repeat(64),
    contractDigest: "d".repeat(64),
    contractIds: ["bound"],
    contracts: [{ id: "bound", experience: { journeys: [{ id: "must-run" }] } }],
    exception: { id: template.id },
  };
  const supplied = structuredClone(actual);
  supplied.contracts[0].experience.journeys = [];
  assert.throws(() => validateExceptionExecutionPlan(supplied, actual), /EXECUTION_PLAN_CHANGED/u);
  assert.doesNotThrow(() =>
    validateExceptionExecutionPlan(
      { ...actual, outputDirectory: "artifacts/isolated", fixtureProfile: "generic" },
      actual,
    ),
  );
});
test("direct capture and replay plans cannot grant browser execution", async (t) => {
  const f = fixture(t),
    plan = { ...f.plan };
  delete plan.exception;
  await assert.rejects(
    () =>
      captureProductExperience({
        root: f.root,
        plan,
        baseURL: "http://127.0.0.1:1",
        outputDirectory: "artifacts/unauthorized",
      }),
    /EXCEPTION_(?:PLAN_SCOPE_CHANGED|EXPIRED)/u,
  );
  await assert.rejects(
    () => runTrustedExperienceReplay({ root: f.root, plan, environment: {} }),
    /EXCEPTION_(?:PLAN_SCOPE_CHANGED|EXPIRED)/u,
  );
  assert.equal(existsSync(path.join(f.root, "artifacts/unauthorized")), false);
  const planPath = path.join(f.root, "plan.json");
  writeFileSync(planPath, JSON.stringify(plan));
  for (const flag of ["--replay", "--run-server"]) {
    const result = spawnSync(
      process.execPath,
      [path.join(repo, "scripts/sounding-line/experience-browser.mjs"), "--workspace", f.root, flag, planPath],
      { encoding: "utf8", timeout: 30000 },
    );
    assert.equal(result.error, undefined);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /EXCEPTION_(?:PLAN_SCOPE_CHANGED|EXPIRED)/u);
  }
  const suite = spawnSync(
    process.execPath,
    [
      path.join(repo, "scripts/sounding-line/run-browser-suite.mjs"),
      "--workspace",
      f.root,
      "--candidate",
      f.candidateSha,
      "--profile",
      "generic",
      "--database-url",
      "file:isolated.db",
      "--",
      "tests/e2e/crossdeck.spec.ts",
    ],
    { encoding: "utf8", timeout: 30000, env: { ...process.env, SOUNDING_LINE_BASE_SHA: f.baseSha } },
  );
  assert.notEqual(suite.status, 0);
  assert.match(suite.stderr, /EXCEPTION_(?:PLAN_SCOPE_CHANGED|EXPIRED)/u);
});
test("historical/equal bases and missing or retired grants cannot erase the campaign", async (t) => {
  const f = fixture(t);
  for (const baseSha of [f.candidateSha, f.record.frozenHistoricalBaseSha]) {
    const plan = { ...f.plan, baseSha };
    delete plan.exception;
    await assert.rejects(
      () =>
        captureProductExperience({
          root: f.root,
          plan,
          baseURL: "http://127.0.0.1:1",
          outputDirectory: "artifacts/extra",
        }),
      /EXCEPTION_(?:INSTALLED_PROTECTED_BASE_REQUIRED|APPROVAL_MISSING_OR_INACTIVE|EXPIRED)/u,
    );
    const suite = spawnSync(
      process.execPath,
      [
        path.join(repo, "scripts/sounding-line/run-browser-suite.mjs"),
        "--workspace",
        f.root,
        "--candidate",
        f.candidateSha,
        "--profile",
        "generic",
        "--database-url",
        "file:isolated.db",
        "--",
        "tests/e2e/crossdeck.spec.ts",
      ],
      { encoding: "utf8", timeout: 20000, env: { ...process.env, SOUNDING_LINE_BASE_SHA: baseSha } },
    );
    assert.notEqual(suite.status, 0);
    assert.match(
      suite.stderr,
      /EXCEPTION_(?:INSTALLED_PROTECTED_BASE_REQUIRED|APPROVAL_MISSING_OR_INACTIVE|PLAN_SCOPE_CHANGED|EXPIRED)/u,
    );
  }
  f.git("checkout", "-qb", "retired", f.baseSha);
  for (const exceptions of [[{ ...f.record, status: "RETIRED" }], []]) {
    f.write("testing/product-experience-exceptions.json", { version: 1, exceptions });
    const baseSha = f.commit();
    assert.throws(() => bindExperienceException({ ...f, baseSha, plan: f.plan, now }), /APPROVAL_MISSING_OR_INACTIVE/u);
  }
  assert.equal(existsSync(path.join(f.root, "artifacts/extra")), false);
});
test("one review3 is exactly the seven contracts and one reviewer context", () => {
  const plan = { contractIds: template.contractIds, exception: { id: template.id } };
  const evidence = {
    exception: plan.exception,
    reviews: template.contractIds.map((contractId) => ({
      contractId,
      reviewerContext: "one-independent-context",
      iterations: 11,
      independentReviewOrdinal: 3,
      findings: [],
    })),
  };
  assert.doesNotThrow(() => validateExceptionEvidence(plan, evidence));
  evidence.reviews.push({ ...evidence.reviews[0] });
  assert.throws(() => validateExceptionEvidence(plan, evidence), /ONE_REVIEW3_SCOPE_REQUIRED/u);
  evidence.reviews.pop();
  evidence.reviews[0].reviewerContext = "second-reviewer";
  assert.throws(() => validateExceptionEvidence(plan, evidence), /ONE_REVIEW3_SCOPE_REQUIRED/u);
});

test("copied product trees and refit identities cannot evade direct execution guards", async (t) => {
  const f = fixture(t);
  f.git("checkout", "-qb", "copied", f.baseSha);
  f.git("checkout", f.frozen, "--", "src", "tests/e2e");
  let candidateSha = f.commit();
  assert.notEqual(spawnSync("git", ["merge-base", "--is-ancestor", f.frozen, candidateSha], { cwd: f.root }).status, 0);
  assert.equal(existsSync(path.join(f.root, f.record.immutableHistory[0].path)), false);
  for (const expected of [/HISTORY_CHANGED/u, /FROZEN_PRODUCT_CHANGED/u]) {
    const plan = { ...f.plan, candidateSha };
    delete plan.exception;
    await assert.rejects(
      () =>
        captureProductExperience({
          root: f.root,
          plan,
          baseURL: "http://127.0.0.1:1",
          outputDirectory: "artifacts/forbidden",
        }),
      expected,
    );
    const suite = spawnSync(
      process.execPath,
      [
        path.join(repo, "scripts/sounding-line/run-browser-suite.mjs"),
        "--workspace",
        f.root,
        "--candidate",
        candidateSha,
        "--profile",
        "generic",
        "--database-url",
        "file:isolated.db",
        "--",
        "tests/e2e/crossdeck.spec.ts",
      ],
      { encoding: "utf8", timeout: 20000, env: { ...process.env, SOUNDING_LINE_BASE_SHA: f.baseSha } },
    );
    assert.notEqual(suite.status, 0);
    assert.match(suite.stderr, expected);
    if (expected.source.includes("HISTORY_CHANGED")) {
      f.write("src/product.ts", "copied and changed");
      f.write("testing/contracts.json", { contracts: [{ id: "crossdeck.refit.companion" }] });
      candidateSha = f.commit();
    }
  }
  assert.equal(existsSync(path.join(f.root, "artifacts/forbidden")), false);
});

test("failed work in any earlier campaign stage stops a new stage before custody writes", async (t) => {
  const f = fixture(t);
  for (const priorMode of ["ordinary", "review"])
    for (const conclusion of ["failure", "cancelled"]) {
      const api = apiFixture(f.record, f.plan),
        current = runIdentity(f.plan, 20),
        prior = runIdentity(f.plan, 10, "workflow_dispatch", priorMode);
      api.runs.set(20, remoteRun(current));
      api.runs.set(10, remoteRun(prior, "completed", conclusion));
      await assert.rejects(
        () =>
          reserveExceptionStage({
            root: f.root,
            record: f.record,
            plan: f.plan,
            mode: "capture",
            run: current,
            store: api.store,
            request: api.request,
          }),
        /EARLIER_CAMPAIGN_FAILURE/u,
      );
      assert.equal(
        api.operations.some(({ method }) => method === "POST"),
        false,
      );
    }
  const api = apiFixture(f.record, f.plan),
    current = runIdentity(f.plan, 30, "workflow_dispatch", "ordinary");
  api.runs.set(30, remoteRun(current));
  api.runs.set(10, remoteRun(runIdentity(f.plan, 10), "completed", "success"));
  api.runs.set(20, remoteRun(runIdentity(f.plan, 20, "workflow_dispatch", "review"), "completed", "success"));
  await requireFirstCampaignRun({
    root: f.root,
    record: f.record,
    plan: f.plan,
    mode: "ordinary",
    run: current,
    request: api.request,
  });
});

test("malformed finite campaign names fail closed instead of disappearing from history", async (t) => {
  const f = fixture(t),
    api = apiFixture(f.record, f.plan),
    current = runIdentity(f.plan, 20),
    prior = runIdentity(f.plan, 10);
  prior.displayTitle = prior.displayTitle.replace(" 721 ", " 721 extra ");
  api.runs.set(20, remoteRun(current));
  api.runs.set(10, remoteRun(prior, "completed", "failure"));
  await assert.rejects(
    () =>
      reserveExceptionStage({
        root: f.root,
        record: f.record,
        plan: f.plan,
        mode: "capture",
        run: current,
        store: api.store,
        request: api.request,
      }),
    /HISTORY_NAME_UNVERIFIABLE/u,
  );
  assert.equal(
    api.operations.some(({ method }) => method === "POST"),
    false,
  );
});
test("custody commit retains every protected-base root including workflows", async (t) => {
  const f = fixture(t),
    api = apiFixture(f.record, f.plan);
  const stored = await api.store.create("prepare", { binding: exceptionBinding(f.plan), run: runIdentity(f.plan) });
  const tree = api.trees.get(api.commits.get(stored.commitSha).tree.sha).tree;
  assert.equal(tree.length, 3);
  assert.equal(tree.find((entry) => entry.path === ".github").sha, "e".repeat(40));
  assert.equal((await api.store.read("prepare")).commitSha, stored.commitSha);
  tree.find((entry) => entry.path === ".github").sha = "c".repeat(40);
  await assert.rejects(() => api.store.read("prepare"), /CUSTODY_BASE_TREE_CHANGED/u);
});
test("failed cancelled queued and malformed prior attempts consume across candidate heads without a ref", async (t) => {
  const f = fixture(t);
  for (const mode of ["capture", "ordinary"])
    for (const state of ["failure", "cancelled", "queued", "in_progress"]) {
      const api = apiFixture(f.record, f.plan),
        current = runIdentity(f.plan, 20, "workflow_dispatch", mode),
        prior = runIdentity({ ...f.plan, candidateSha: "e".repeat(40) }, 10, "workflow_dispatch", mode);
      api.runs.set(20, remoteRun(current));
      api.runs.set(
        10,
        remoteRun(
          prior,
          ["failure", "cancelled"].includes(state) ? "completed" : state,
          ["failure", "cancelled"].includes(state) ? state : null,
        ),
      );
      await assert.rejects(
        () =>
          requireFirstCampaignRun({
            root: f.root,
            record: f.record,
            plan: f.plan,
            mode,
            run: current,
            request: api.request,
          }),
        /EARLIER_ATTEMPT_CONSUMED/u,
      );
      assert.equal(await api.store.read("prepare"), null);
    }
  const api = apiFixture(f.record, f.plan),
    current = runIdentity(f.plan, 20),
    prior = runIdentity(f.plan, 10);
  prior.displayTitle = prior.displayTitle.replace(" 721 ", " unbound ");
  api.runs.set(20, remoteRun(current));
  api.runs.set(10, remoteRun(prior, "completed", "failure"));
  await assert.rejects(
    () =>
      requireFirstCampaignRun({
        root: f.root,
        record: f.record,
        plan: f.plan,
        mode: "capture",
        run: current,
        request: api.request,
      }),
    /EARLIER_ATTEMPT_CONSUMED/u,
  );
  api.runs.get(10).actor.login = "unknown";
  await assert.rejects(
    () =>
      requireFirstCampaignRun({
        root: f.root,
        record: f.record,
        plan: f.plan,
        mode: "capture",
        run: current,
        request: api.request,
      }),
    /HISTORY_ATTEMPT_INVALID_OR_AMBIGUOUS/u,
  );
});
test("history rejects truncation or missing current run and excludes only proved skipped draft", async (t) => {
  const f = fixture(t),
    api = apiFixture(f.record, f.plan),
    current = runIdentity(f.plan, 20, "workflow_dispatch", "ordinary"),
    prior = runIdentity(f.plan, 10, "pull_request_target", "ordinary");
  prior.displayTitle = prior.displayTitle.replace(/active$/u, "draft");
  api.runs.set(20, remoteRun(current));
  api.runs.set(10, remoteRun(prior, "completed", "skipped"));
  await requireFirstCampaignRun({
    root: f.root,
    record: f.record,
    plan: f.plan,
    mode: "ordinary",
    run: current,
    request: api.request,
  });
  for (const data of [
    { total_count: 1001, workflow_runs: [] },
    { total_count: 0, workflow_runs: [] },
  ]) {
    await assert.rejects(
      () =>
        requireFirstCampaignRun({
          root: f.root,
          record: f.record,
          plan: f.plan,
          mode: "ordinary",
          run: current,
          request: async () => data,
        }),
      /HISTORY_INCOMPLETE/u,
    );
  }
});
test("a failure before any ref creation cannot receive a new dispatch allowance", async (t) => {
  const f = fixture(t),
    api = apiFixture(f.record, f.plan),
    first = runIdentity(f.plan);
  api.runs.set(10, remoteRun(first));
  api.failBeforeRef();
  await assert.rejects(
    () =>
      reserveExceptionStage({
        root: f.root,
        record: f.record,
        plan: f.plan,
        mode: "capture",
        run: first,
        store: api.store,
        request: api.request,
      }),
    /Failure before ref creation/u,
  );
  assert.equal(await api.store.read("prepare"), null);
  api.runs.set(10, remoteRun(first, "completed", "cancelled"));
  const second = runIdentity({ ...f.plan, candidateSha: "e".repeat(40) }, 20);
  api.runs.set(20, remoteRun(second));
  await assert.rejects(
    () =>
      reserveExceptionStage({
        root: f.root,
        record: f.record,
        plan: { ...f.plan, candidateSha: "e".repeat(40) },
        mode: "capture",
        run: second,
        store: api.store,
        request: api.request,
      }),
    /EARLIER_ATTEMPT_CONSUMED/u,
  );
});
test("trusted parent passes an authenticated one-use lease to a token-free real child", async (t) => {
  const f = fixture(t),
    api = apiFixture(f.record, f.plan),
    env = environment(f.plan),
    identity = runIdentity(f.plan);
  api.runs.set(10, remoteRun(identity));
  f.write("plan.json", f.plan);
  f.write(
    "scripts/sounding-line/run-browser-suite.mjs",
    `import assert from 'node:assert/strict';import fs from 'node:fs';import {requireExceptionPhase} from ${JSON.stringify(pathToFileURL(path.join(repo, "scripts/sounding-line/experience-exception.mjs")).href)};assert.equal(process.env.GH_TOKEN,undefined);assert.equal(process.env.GITHUB_TOKEN,undefined);const plan=JSON.parse(fs.readFileSync('plan.json','utf8'));requireExceptionPhase({root:process.cwd(),phase:'technical',plan});fs.writeFileSync('token-free-proof.json',JSON.stringify({tokenFree:true}));`,
  );
  const before = { GH_TOKEN: process.env.GH_TOKEN, GITHUB_TOKEN: process.env.GITHUB_TOKEN };
  process.env.GH_TOKEN = "synthetic";
  process.env.GITHUB_TOKEN = "synthetic";
  try {
    const execute = exceptionCommandRunner(f.plan, runVerificationCommand, async () => {
      assert.equal(process.env.GH_TOKEN, "synthetic");
      await validateLiveContext({ record: f.record, plan: f.plan, request: api.request, environment: env, now });
      return claimExceptionPhase({ root: f.root, phase: "technical", plan: f.plan, runId: 10 });
    });
    await execute(f.root, process.execPath, ["scripts/sounding-line/run-browser-suite.mjs"], {
      env: { GITHUB_RUN_ID: "10" },
    });
    assert.deepEqual(JSON.parse(readFileSync(path.join(f.root, "token-free-proof.json"), "utf8")), { tokenFree: true });
    await assert.rejects(
      () =>
        execute(f.root, process.execPath, ["scripts/sounding-line/run-browser-suite.mjs"], {
          env: { GITHUB_RUN_ID: "10" },
        }),
      /EXECUTION_PHASE_ALREADY_CONSUMED/u,
    );
  } finally {
    for (const [key, value] of Object.entries(before)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
