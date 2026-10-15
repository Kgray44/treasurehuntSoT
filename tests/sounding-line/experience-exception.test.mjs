import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  CROSSDECK_R2,
  CROSSDECK_R3,
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
  selectTrustedExceptions,
  recordBinding,
  validateSuccessorPredecessor,
} from "../../scripts/sounding-line/experience-exception.mjs";
import {
  validateR3Contracts,
  validateR3LocalReceipt,
  r3LocalPlan,
} from "../../scripts/sounding-line/experience-r3.mjs";
import { planProductExperience } from "../../scripts/sounding-line/product-experience.mjs";
import {
  captureProductExperience,
  runTrustedExperienceReplay,
} from "../../scripts/sounding-line/experience-browser.mjs";
import { exceptionCommandRunner, run as runVerificationCommand } from "../../scripts/sounding-line/ordinary.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const template = JSON.parse(readFileSync(path.join(repo, "testing/product-experience-exceptions.json"), "utf8"))
  .exceptions[0];
const successorTemplate = JSON.parse(
  readFileSync(path.join(repo, "testing/product-experience-exceptions.json"), "utf8"),
).exceptions.find((record) => record.id === CROSSDECK_R2.id);
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
    workflow_id: identity.workflowId,
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

async function successorApiFixture(t) {
  const f = fixture(t),
    record = structuredClone(successorTemplate);
  const plan = { ...f.plan, exception: recordBinding(record) };
  const api = apiFixture(record, plan),
    p = record.predecessor;
  const originalRun = {
    ...runIdentity({ baseSha: p.baseSha, candidateSha: p.candidateSha }, p.runId),
    createdAt: p.createdAt,
    workflowId: p.workflowId,
  };
  api.commits.set(p.baseSha, structuredClone(api.commits.get(plan.baseSha)));
  const originalStore = exceptionStore({ record: template, request: api.request });
  const stored = await originalStore.create("prepare", {
    binding: {
      exception: recordBinding(template),
      baseSha: p.baseSha,
      sourceDigest: p.sourceDigest,
      contractDigest: p.contractDigest,
    },
    run: originalRun,
    candidateSha: p.candidateSha,
    independentReviewsCompleted: 2,
    reservedIndependentReviewOrdinal: 3,
  });
  api.commits.set(p.prepareCommit, structuredClone(api.commits.get(stored.commitSha)));
  api.refs.set(`refs/tags/${p.namespace}/prepare`, { object: { type: "commit", sha: p.prepareCommit } });
  api.commits.set(p.candidateSha, { tree: { sha: p.candidateTree }, parents: [] });
  api.runs.set(p.runId, remoteRun(originalRun, "completed", "failure"));
  const current = { ...runIdentity(plan, 38790000001), createdAt: "2026-10-15T17:00:00Z", workflowId: p.workflowId };
  api.runs.set(current.runId, remoteRun(current));
  const artifacts = new Map(
    p.artifacts.map((a) => [
      a.id,
      { id: a.id, digest: a.digest, size_in_bytes: a.size, workflow_run: { id: p.runId, head_sha: p.baseSha } },
    ]),
  );
  const historyQueries = [];
  const request = async (endpoint, method = "GET", body) => {
    if (endpoint.startsWith("actions/artifacts/")) return artifacts.get(Number(endpoint.slice(18))) ?? null;
    if (endpoint.startsWith(`actions/workflows/${p.workflowId}/runs?`)) {
      historyQueries.push(endpoint);
      return api.request(endpoint.replace(`/${p.workflowId}/runs?`, "/5/runs?"), method, body);
    }
    return api.request(endpoint, method, body);
  };
  const store = exceptionStore({ record, request });
  api.operations.length = 0;
  return {
    ...f,
    ...api,
    record,
    plan,
    current,
    artifacts,
    request,
    store,
    originalStore,
    historyQueries,
    now: new Date("2026-10-15T17:00:00Z"),
  };
}

test("R2 historical fixture clock stays deterministic while expired admission remains blocked", async (t) => {
  const f = await successorApiFixture(t);
  const expired = new Date("2026-10-23T00:00:00Z");
  await assert.rejects(
    () => validateSuccessorPredecessor({ record: f.record, request: f.request, now: expired }),
    /EXPIRED/u,
  );
  await assert.rejects(
    () =>
      validateLiveContext({
        record: f.record,
        plan: f.plan,
        request: f.request,
        now: expired,
        environment: { ...environment(f.plan), SOUNDING_LINE_NOW: "2026-10-15T17:00:00Z" },
      }),
    /EXPIRED/u,
  );
  await validateSuccessorPredecessor({ record: f.record, request: f.request, now: f.now });
  await requireFirstCampaignRun({
    now: f.now,
    root: f.root,
    record: f.record,
    plan: f.plan,
    mode: "capture",
    run: f.current,
    request: f.request,
  });
});

test("R2 permits one authenticated review submission and cannot republish a successful seal through another run", async (t) => {
  const f = await successorApiFixture(t);
  await reserveExceptionStage({
    root: f.root,
    record: f.record,
    plan: f.plan,
    mode: "capture",
    run: f.current,
    store: f.store,
    request: f.request,
    now: f.now,
  });
  f.runs.set(f.current.runId, remoteRun(f.current, "completed", "success"));
  const submitted = {
    ...f.current,
    runId: f.current.runId + 1,
    createdAt: "2026-10-15T17:01:00Z",
    displayTitle: f.current.displayTitle.replace(" capture ", " review "),
  };
  f.runs.set(submitted.runId, remoteRun(submitted));
  await reserveExceptionStage({
    root: f.root,
    record: f.record,
    plan: f.plan,
    mode: "review",
    run: submitted,
    store: f.store,
    request: f.request,
    now: f.now,
  });
  await f.store.create("review3", { binding: exceptionBinding(f.plan), run: submitted });
  f.runs.set(submitted.runId, remoteRun(submitted, "completed", "success"));
  const duplicate = { ...submitted, runId: submitted.runId + 1, createdAt: "2026-10-15T17:02:00Z" };
  f.runs.set(duplicate.runId, remoteRun(duplicate));
  f.operations.length = 0;
  await assert.rejects(
    () =>
      reserveExceptionStage({
        root: f.root,
        record: f.record,
        plan: f.plan,
        mode: "review",
        run: duplicate,
        store: f.store,
        request: f.request,
        now: f.now,
      }),
    /REVIEW_SUBMISSION_ALREADY_CONSUMED/u,
  );
  assert.equal(
    f.operations.some((o) => o.method === "POST"),
    false,
  );
});

test("R2 preserves original record and binds exact delegated approval and honest history", () => {
  assert.equal(hash(template), CROSSDECK_R2.predecessor.recordDigest);
  validateExceptionRecord(successorTemplate, new Date("2026-10-15T17:00:00Z"));
  const binding = recordBinding(successorTemplate);
  assert.equal(binding.priorRepairRecaptureAttempts, 11);
  assert.equal(binding.independentReviewOrdinal, 3);
  assert.equal(binding.attemptHistory.totalPriorExecutedAttempts, 12);
  assert.equal(binding.attemptHistory.nextPreparationAttemptTotal, 13);
  assert.equal(binding.predecessor.prepareCommit, "2706b52f12fc167434b03ff8e6fb7d3198db8d62");
  assert.equal(successorTemplate.ownerApproval.humanMessageId, "Sentinel_ae98f58b5fc88191b9132a017d43518c");
  for (const mutate of [
    (r) => (r.ownerApproval.humanMessageId = "invented"),
    (r) => (r.ownerApproval.sourceThreadId = "wrong"),
    (r) => (r.ownerApproval.approvedAtUtcMinute = "2026-10-15T17:00Z"),
    (r) => (r.ownerApproval.answer = "NO"),
    (r) => (r.predecessor.campaignEpoch = r.ownerApproval.approvedAtUtcMinute),
    (r) => r.predecessor.runId++,
    (r) => (r.predecessor.artifacts[0].digest = "wrong"),
    (r) => (r.attemptHistory.totalPriorExecutedAttempts = 11),
    (r) => (r.executionBudget.preparationPasses = 2),
    (r) => (r.custody.namespace += "-escape"),
  ]) {
    const record = structuredClone(successorTemplate);
    mutate(record);
    assert.throws(() => validateExceptionRecord(record), /RECORD_INVALID/u);
  }
});

test("R2 selection retains predecessor unchanged and retirement cannot revive consumed grant", () => {
  const records = [structuredClone(template), structuredClone(successorTemplate)];
  assert.deepEqual(selectTrustedExceptions(records), [records[1]]);
  for (const mutate of [
    (r) => (r.affectedRoutes[0] = "/different"),
    (r) => r.requiredTechnicalBrowserTests.pop(),
    (r) => r.protectedBaseRuntimeOverrides.pop(),
    (r) => (r.custody.noUpdateDeleteRefund = false),
    (r) => (r.frozenTrees.src = "a".repeat(40)),
  ]) {
    const changed = structuredClone(successorTemplate);
    mutate(changed);
    assert.throws(() => selectTrustedExceptions([template, changed]), /PREDECESSOR_SCOPE_CHANGED/u);
  }
  records[1].status = "RETIRED";
  assert.deepEqual(selectTrustedExceptions(records), []);
  records[1].status = "ACTIVE";
  assert.throws(() => validateExceptionRecord(records[1], new Date(records[1].expiresAt)), /EXPIRED/u);
  records[0].reason += "changed";
  assert.throws(() => selectTrustedExceptions(records), /PREDECESSOR_REGISTRY_CHANGED/u);
  assert.throws(() => selectTrustedExceptions([successorTemplate]), /PREDECESSOR_REGISTRY_CHANGED/u);
  assert.throws(
    () => selectTrustedExceptions([template, successorTemplate, successorTemplate]),
    /PREDECESSOR_REGISTRY_CHANGED/u,
  );
});

test("R2 admits one new preparation while retaining old consumed ref and original history epoch", async (t) => {
  const f = await successorApiFixture(t),
    p = f.record.predecessor;
  await reserveExceptionStage({
    now: f.now,
    root: f.root,
    record: f.record,
    plan: f.plan,
    mode: "capture",
    run: f.current,
    store: f.store,
    request: f.request,
  });
  assert.equal((await f.originalStore.read("prepare")).commitSha, p.prepareCommit);
  const reserved = await f.store.read("prepare");
  assert.equal(reserved.exceptionId, CROSSDECK_R2.id);
  assert.equal(reserved.binding.exception.attemptHistory.totalPriorExecutedAttempts, 12);
  assert.equal(reserved.attemptHistory.status, "NEXT_PREPARATION_RESERVED_NOT_EXECUTED");
  assert(f.historyQueries[0].includes(encodeURIComponent("2026-10-15T13:54:00.000Z")));
  assert(
    f.operations
      .filter((o) => o.method === "POST")
      .every((o) => ["git/blobs", "git/trees", "git/commits", "git/refs"].includes(o.endpoint)),
  );
  await assert.rejects(
    () => f.store.create("prepare", { binding: exceptionBinding(f.plan), run: f.current }),
    /SLOT_CONSUMED/u,
  );
  const phase = claimExceptionPhase({
    root: f.root,
    phase: "experience",
    plan: f.plan,
    runId: f.current.runId,
    executionHistory: { ...f.record.attemptHistory, stage: "prepare", executedAttemptsIncludingThisPreparation: 13 },
  });
  assert.equal(phase.executionHistory.executedAttemptsIncludingThisPreparation, 13);
});

test("R2 rejects any changed predecessor consumption, source, run or artifact before custody writes", async (t) => {
  for (const mutation of [
    (f) => f.refs.delete(`refs/tags/${f.record.predecessor.namespace}/prepare`),
    (f) => (f.runs.get(f.record.predecessor.runId).conclusion = "success"),
    (f) => (f.runs.get(f.record.predecessor.runId).run_attempt = 2),
    (f) => (f.runs.get(f.record.predecessor.runId).head_sha = "e".repeat(40)),
    (f) => (f.commits.get(f.record.predecessor.candidateSha).tree.sha = "e".repeat(40)),
    (f) => (f.artifacts.get(f.record.predecessor.artifacts[0].id).digest = "wrong"),
    (f) => f.artifacts.delete(f.record.predecessor.artifacts[1].id),
    (f) =>
      f.refs.set(
        `refs/tags/${f.record.predecessor.namespace}/review3`,
        f.refs.get(`refs/tags/${f.record.predecessor.namespace}/prepare`),
      ),
  ]) {
    const f = await successorApiFixture(t);
    mutation(f);
    await assert.rejects(
      () =>
        reserveExceptionStage({
          now: f.now,
          root: f.root,
          record: f.record,
          plan: f.plan,
          mode: "capture",
          run: f.current,
          store: f.store,
          request: f.request,
        }),
      /PREDECESSOR_/u,
    );
    assert.equal(
      f.operations.some((o) => o.method === "POST"),
      false,
    );
    assert.equal(await f.store.read("prepare"), null);
  }
});

test("R2 complete history cannot omit or rewrite the authorized predecessor", async (t) => {
  const f = await successorApiFixture(t);
  for (const rewrite of [
    (runs) => runs.filter((r) => r.id !== f.record.predecessor.runId),
    (runs) => runs.map((r) => (r.id === f.record.predecessor.runId ? { ...r, conclusion: "success" } : r)),
  ]) {
    const request = async (endpoint, method, body) => {
      const data = await f.request(endpoint, method, body);
      if (!endpoint.includes("/runs?")) return data;
      const workflow_runs = rewrite(data.workflow_runs);
      return { total_count: workflow_runs.length, workflow_runs };
    };
    await assert.rejects(
      () =>
        requireFirstCampaignRun({
          now: f.now,
          root: f.root,
          record: f.record,
          plan: f.plan,
          mode: "capture",
          run: f.current,
          request,
        }),
      /PREDECESSOR_HISTORY_(?:MISSING|CHANGED)/u,
    );
  }
  assert.equal(
    f.operations.some((o) => o.method === "POST"),
    false,
  );
});

test("R2 recognizes only exact predecessor; other failures before new approval still stop", async (t) => {
  for (const date of ["2026-10-15T16:00:00Z", "2026-10-15T16:55:00Z"]) {
    const f = await successorApiFixture(t);
    const extra = { ...f.current, runId: f.current.runId - 1, createdAt: date };
    f.runs.set(extra.runId, remoteRun(extra, "completed", "failure"));
    await assert.rejects(
      () =>
        reserveExceptionStage({
          now: f.now,
          root: f.root,
          record: f.record,
          plan: f.plan,
          mode: "capture",
          run: f.current,
          store: f.store,
          request: f.request,
        }),
      /EARLIER_ATTEMPT_CONSUMED/u,
    );
    assert.equal(
      f.operations.some((o) => o.method === "POST"),
      false,
    );
  }
});

test("R2 new failed preparation remains consumed and original failure cannot supply successful evidence", async (t) => {
  const f = await successorApiFixture(t);
  await validateSuccessorPredecessor({ record: f.record, request: f.request, now: f.now });
  await reserveExceptionStage({
    now: f.now,
    root: f.root,
    record: f.record,
    plan: f.plan,
    mode: "capture",
    run: f.current,
    store: f.store,
    request: f.request,
  });
  f.runs.set(f.current.runId, remoteRun(f.current, "completed", "failure"));
  await assert.rejects(
    () => requireSuccessfulReservation({ store: f.store, slot: "prepare", plan: f.plan, request: f.request }),
    /RESERVED_RUN_NOT_SUCCESSFUL/u,
  );
  await assert.rejects(
    () => requireSuccessfulReservation({ store: f.originalStore, slot: "prepare", plan: f.plan, request: f.request }),
    /RESERVATION_BINDING_MISSING/u,
  );
  const next = { ...f.current, runId: f.current.runId + 1, createdAt: "2026-10-15T17:01:00Z" };
  f.runs.set(next.runId, remoteRun(next));
  f.operations.length = 0;
  await assert.rejects(
    () =>
      reserveExceptionStage({
        now: f.now,
        root: f.root,
        record: f.record,
        plan: f.plan,
        mode: "capture",
        run: next,
        store: f.store,
        request: f.request,
      }),
    /EARLIER_ATTEMPT_CONSUMED/u,
  );
  assert.equal(
    f.operations.some((o) => o.method === "POST"),
    false,
  );
  assert.equal((await f.originalStore.read("prepare")).commitSha, f.record.predecessor.prepareCommit);
});

const r3Template = JSON.parse(
  readFileSync(path.join(repo, "testing/product-experience-exceptions.json"), "utf8"),
).exceptions.find((r) => r.id === CROSSDECK_R3.id);
test("R3 preserves both predecessor objects and selects only the exact new approval", () => {
  const records = [template, successorTemplate, structuredClone(r3Template)];
  validateExceptionRecord(records[2], new Date("2026-10-15T19:00:00Z"));
  assert.deepEqual(selectTrustedExceptions(records), [records[2]]);
  assert.equal(hash(template), CROSSDECK_R2.predecessor.recordDigest);
  assert.equal(hash(successorTemplate), CROSSDECK_R3.predecessorDigest);
  const binding = recordBinding(records[2]);
  assert.equal(binding.independentReviewOrdinal, 4);
  assert.equal(binding.attemptHistory.totalPriorExecutedAttempts, 13);
  assert.equal(binding.attemptHistory.nextPreparationAttemptTotal, 14);
  for (const mutate of [
    (r) => r.executionBudget.reruns++,
    (r) => r.executionBudget.productRepairs++,
    (r) => r.executionBudget.targetedLocalProofInvocations++,
    (r) => r.repairScope.productPaths.push("src/unrelated.ts"),
    (r) => r.affectedRoutes.pop(),
    (r) => r.requiredTechnicalBrowserTests.pop(),
    (r) => (r.blockedReview3.sha256 = "0".repeat(64)),
    (r) => (r.ownerApproval.humanMessageId = "invented"),
    (r) => (r.predecessor.conclusion = "failure"),
    (r) => r.originalPredecessor.runId++,
    (r) => r.attemptHistory.totalPriorExecutedAttempts--,
  ]) {
    const changed = structuredClone(r3Template);
    mutate(changed);
    assert.throws(() => selectTrustedExceptions([template, successorTemplate, changed]), /R3_RECORD_CHANGED/u);
  }
  records[2].status = "RETIRED";
  assert.deepEqual(selectTrustedExceptions(records), []);
  assert.throws(() => selectTrustedExceptions([template, r3Template]), /R3_PREDECESSOR_REGISTRY_CHANGED/u);
});

function r3ContractFixture() {
  const original = {
    contracts: [
      {
        id: CROSSDECK_R3.contractId,
        experience: {
          journeys: [{ id: CROSSDECK_R3.journeyId, steps: [{ action: "assert", name: "Journal tools" }] }],
        },
      },
      { id: "other", experience: { immutable: true } },
    ],
    policy: { required: true },
  };
  const proposed = structuredClone(original);
  proposed.contracts[0].experience.journeys[0].steps.push({
    action: "assert",
    role: "button",
    name: "Continue Voyage",
    unobscured: true,
  });
  proposed.contracts[0].experience.localContinuationProof = {
    steps: [
      { action: "click", role: "button", name: "Continue Voyage" },
      {
        action: "assert",
        kind: "outcome",
        role: "main",
        name: "",
        path: CROSSDECK_R3.route,
        state: "RETURNED",
        text: "Voyage complete",
        meaning: "The same Voyage continues after primary activation.",
      },
    ],
  };
  return { original, proposed };
}
test("R3 contract extension cannot change an old step, other field, object or obligation", () => {
  const { original, proposed } = r3ContractFixture();
  validateR3Contracts(original, proposed);
  for (const mutate of [
    (r) => (r.policy.required = false),
    (r) => r.contracts.pop(),
    (r) => (r.contracts[0].experience.devices = ["DESKTOP"]),
    (r) => (r.contracts[0].experience.journeys[0].steps[0].name = "Different"),
    (r) => delete r.contracts[0].experience.journeys[0].steps[1].unobscured,
    (r) => (r.contracts[0].experience.localContinuationProof.steps[0].name = "Dismiss"),
    (r) => (r.contracts[0].experience.localContinuationProof.steps[1].path = "/other-voyage"),
    (r) => r.contracts[0].experience.journeys[0].steps.push({ action: "click", name: "Extra" }),
  ]) {
    const changed = structuredClone(proposed);
    mutate(changed);
    assert.throws(
      () => validateR3Contracts(original, changed),
      /R3_(CONTRACT_SCOPE_CHANGED|CONTINUATION_PROOF_REQUIRED)/u,
    );
  }
});
test("R3 rejects old review3 and any blocking finding while requiring one complete review4", () => {
  const plan = { contractIds: r3Template.contractIds, exception: recordBinding(r3Template) };
  const evidence = {
    exception: plan.exception,
    reviews: plan.contractIds.map((contractId) => ({
      contractId,
      reviewerContext: "independent-r3",
      iterations: 11,
      independentReviewOrdinal: 4,
      findings: [],
    })),
  };
  validateExceptionEvidence(plan, evidence);
  evidence.reviews[0].independentReviewOrdinal = 3;
  assert.throws(() => validateExceptionEvidence(plan, evidence), /HISTORY_OR_REVIEW_ORDINAL_CHANGED/u);
  evidence.reviews[0].independentReviewOrdinal = 4;
  evidence.reviews[0].findings.push({
    id: "R3-HOMEPORT-MOBILE-P01",
    classification: "INTERACTION_DEFECT",
    disposition: "UNRESOLVED_BLOCKER",
  });
  assert.throws(() => validateExceptionEvidence(plan, evidence), /NEW_BLOCKING_FINDING/u);
});

test("R3 activation belongs only to separately scoped local contexts and never mutates the full matrix plan", () => {
  const { proposed } = r3ContractFixture();
  const full = { contracts: proposed.contracts, contractIds: [CROSSDECK_R3.contractId, "other"] };
  const snapshot = structuredClone(full);
  const normal = r3LocalPlan(full, "NORMAL"),
    reduced = r3LocalPlan(full, "REDUCED");
  assert.deepEqual(full, snapshot);
  for (const [plan, mode] of [
    [normal, "NORMAL"],
    [reduced, "REDUCED"],
  ]) {
    assert.equal(plan.localProofMotionMode, mode);
    assert.equal(plan.contracts.length, 1);
    assert.equal(
      plan.contracts[0].experience.journeys[0].steps.length,
      full.contracts[0].experience.journeys[0].steps.length + 2,
    );
    assert.equal(plan.contracts[0].experience.journeys[0].steps.at(-1).text, "Voyage complete");
  }
  assert.notEqual(normal.outputDirectory, reduced.outputDirectory);
  assert.notEqual(normal.contracts[0], reduced.contracts[0]);
});

test("R3 local receipt requires both actual contexts, unobscured activation and all media types", () => {
  const { proposed } = r3ContractFixture();
  const plan = {
    baseSha: "a".repeat(40),
    sourceDigest: "b".repeat(64),
    contractDigest: "c".repeat(64),
    exception: recordBinding(r3Template),
    contracts: proposed.contracts,
  };
  const receipt = {
    classification: "OPERATOR_LOCAL_ONE_USE_NOT_AUTHENTICATED_CUSTODY",
    status: "PASS",
    exceptionId: CROSSDECK_R3.id,
    recordDigest: plan.exception.recordDigest,
    baseSha: plan.baseSha,
    sourceDigest: plan.sourceDigest,
    contractDigest: plan.contractDigest,
    boundedRepairEvents: 1,
    localProofInvocations: 1,
    childReplayInvocations: 2,
    fullPreparations: 0,
    independentReviews: 0,
    contexts: ["MOBILE/PLAYER/NORMAL", "MOBILE/PLAYER/REDUCED"],
    declaredCanonicalFixtureIds: CROSSDECK_R3.fixtureIds,
    isolatedFixtures: [
      { profile: "generic", motionMode: "NORMAL", databaseSha256: "a".repeat(64) },
      { profile: "generic", motionMode: "REDUCED", databaseSha256: "b".repeat(64) },
    ],
    artifacts: [],
    journeys: [],
  };
  for (const motionMode of ["NORMAL", "REDUCED"]) {
    receipt.journeys.push({
      id: CROSSDECK_R3.journeyId,
      contractId: CROSSDECK_R3.contractId,
      motionMode,
      device: "MOBILE",
      role: "PLAYER",
      status: "PASS",
      visibleActions: 3,
      returnPathVerified: true,
      accessibility: { keyboard: true, focus: true, motionPreferenceVerified: true, overflow: false },
      unobscuredActions: [{ role: "button", name: "Continue Voyage", viewportHitTest: true, trialClick: true }],
      observations: [
        {
          role: "main",
          name: "",
          text: "Voyage complete",
          meaning: proposed.contracts[0].experience.localContinuationProof.steps.at(-1).meaning,
        },
      ],
    });
    for (const type of ["screenshot", "recording", "trace"])
      receipt.artifacts.push({
        type,
        motionMode,
        contractId: CROSSDECK_R3.contractId,
        device: "MOBILE",
        role: "PLAYER",
        sha256: "e".repeat(64),
      });
  }
  validateR3LocalReceipt(receipt, plan);
  for (const mutate of [
    (r) => r.journeys.pop(),
    (r) => (r.status = "STARTED"),
    (r) => (r.sourceDigest = "changed"),
    (r) => r.artifacts.pop(),
    (r) => r.localProofInvocations++,
    (r) => (r.journeys[1].unobscuredActions = []),
    (r) => (r.journeys[0].observations = []),
    (r) => (r.journeys[1].accessibility.overflow = true),
    (r) => (r.isolatedFixtures[1].databaseSha256 = r.isolatedFixtures[0].databaseSha256),
  ]) {
    const changed = structuredClone(receipt);
    mutate(changed);
    assert.throws(() => validateR3LocalReceipt(changed, plan), /LOCAL_PROOF_MISSING_OR_CHANGED/u);
  }
});

async function r3ApiFixture(t) {
  const f = await successorApiFixture(t),
    p = CROSSDECK_R3.predecessor;
  f.commits.set(p.baseSha, structuredClone(f.commits.get(f.plan.baseSha)));
  const secondRun = {
    ...runIdentity({ baseSha: p.baseSha, candidateSha: p.candidateSha }, p.runId),
    createdAt: p.createdAt,
    workflowId: p.workflowId,
  };
  const secondStore = exceptionStore({ record: successorTemplate, request: f.request });
  const stored = await secondStore.create("prepare", {
    binding: {
      exception: recordBinding(successorTemplate),
      baseSha: p.baseSha,
      sourceDigest: p.sourceDigest,
      contractDigest: p.contractDigest,
    },
    run: secondRun,
    candidateSha: p.candidateSha,
    independentReviewsCompleted: 2,
    reservedIndependentReviewOrdinal: 3,
  });
  f.commits.set(p.prepareCommit, structuredClone(f.commits.get(stored.commitSha)));
  f.refs.set(`refs/tags/${p.namespace}/prepare`, { object: { type: "commit", sha: p.prepareCommit } });
  f.commits.set(p.candidateSha, { tree: { sha: p.candidateTree } });
  f.runs.set(p.runId, remoteRun(secondRun, "completed", "success"));
  for (const a of p.artifacts)
    f.artifacts.set(a.id, {
      id: a.id,
      digest: a.digest,
      size_in_bytes: a.size,
      workflow_run: { id: p.runId, head_sha: p.baseSha },
    });
  const reviewBytes = readFileSync(
    path.join(
      repo,
      "Development_Docs/Programs/Sounding_Line/evidence/crossdeck-r3-owner-decision-proposal-20261015/review3/reviews.original.raw.txt",
    ),
  );
  const request = async (endpoint, method, body) => {
    if (endpoint === `git/commits/${CROSSDECK_R3.evidenceCommit}`) return { tree: { sha: "review-tree" } };
    if (endpoint === "git/trees/review-tree?recursive=1")
      return {
        truncated: false,
        tree: [{ path: CROSSDECK_R3.reviewPath, type: "blob", mode: "100644", sha: "review-blob" }],
      };
    if (endpoint === "git/blobs/review-blob") return { content: reviewBytes.toString("base64") };
    return f.request(endpoint, method, body);
  };
  const plan = { ...f.plan, exception: recordBinding(r3Template) };
  f.current.createdAt = "2026-10-15T19:00:00Z";
  f.runs.set(f.current.runId, remoteRun(f.current));
  f.operations.length = 0;
  return {
    ...f,
    plan,
    record: r3Template,
    request,
    secondStore,
    store: exceptionStore({ record: r3Template, request }),
    now: new Date("2026-10-15T19:00:00Z"),
  };
}
test("R3 requires both exact historical preparations and preserves the original campaign epoch", async (t) => {
  const f = await r3ApiFixture(t);
  const historical = await validateSuccessorPredecessor(f);
  assert.deepEqual(
    historical.map((r) => r.id),
    [CROSSDECK_R2.predecessor.runId, CROSSDECK_R3.predecessor.runId],
  );
  await requireFirstCampaignRun({ ...f, mode: "capture", run: f.current });
  assert(f.historyQueries.at(-1).includes(encodeURIComponent("2026-10-15T13:54:00.000Z")));
  assert.equal(await f.secondStore.read("qualify"), null);
  assert.equal(
    f.operations.some((o) => o.method === "POST"),
    false,
  );
  for (const mutate of [
    () => (f.runs.get(CROSSDECK_R3.predecessor.runId).conclusion = "failure"),
    () => (f.artifacts.get(CROSSDECK_R3.predecessor.artifacts[0].id).digest = "changed"),
    () => f.refs.delete(`refs/tags/${CROSSDECK_R3.predecessor.namespace}/prepare`),
  ]) {
    // Apply each mutation to the same validated fixture, restoring before next.
    const runs = structuredClone(f.runs),
      artifacts = structuredClone(f.artifacts),
      refs = structuredClone(f.refs);
    mutate();
    await assert.rejects(() => validateSuccessorPredecessor(f), /PREDECESSOR_/u);
    f.runs.clear();
    for (const [k, v] of runs) f.runs.set(k, v);
    f.artifacts.clear();
    for (const [k, v] of artifacts) f.artifacts.set(k, v);
    f.refs.clear();
    for (const [k, v] of refs) f.refs.set(k, v);
    assert.equal(
      f.operations.some((o) => o.method === "POST"),
      false,
    );
  }
  const request = async (endpoint, method, body) =>
    endpoint === "git/blobs/review-blob"
      ? { content: Buffer.from("altered blocked review").toString("base64") }
      : f.request(endpoint, method, body);
  await assert.rejects(() => validateSuccessorPredecessor({ ...f, request }), /R3_BLOCKED_REVIEW_CHANGED/u);
});
test("R3 recognizes only named predecessor preparations; a third attempt cannot disappear", async (t) => {
  const f = await r3ApiFixture(t);
  const extra = { ...f.current, runId: f.current.runId - 2, createdAt: "2026-10-15T18:30:00Z" };
  f.runs.set(extra.runId, remoteRun(extra, "completed", "failure"));
  await assert.rejects(
    () => requireFirstCampaignRun({ ...f, mode: "capture", run: f.current }),
    /EARLIER_ATTEMPT_CONSUMED/u,
  );
  assert.equal(
    f.operations.some((o) => o.method === "POST"),
    false,
  );
});
test("R3 seals review4 only once without writing a review3 seal or using R2 ordinary", async (t) => {
  const f = await r3ApiFixture(t);
  await f.store.create("prepare", {
    binding: exceptionBinding(f.plan),
    run: f.current,
    candidateSha: f.plan.candidateSha,
  });
  f.runs.set(f.current.runId, remoteRun(f.current, "completed", "success"));
  const run = {
    ...f.current,
    runId: f.current.runId + 1,
    createdAt: "2026-10-15T19:01:00Z",
    displayTitle: f.current.displayTitle.replace(" capture ", " review "),
  };
  f.runs.set(run.runId, remoteRun(run));
  await reserveExceptionStage({ ...f, mode: "review", run });
  await f.store.create("review4", { binding: exceptionBinding(f.plan), run });
  f.runs.set(run.runId, remoteRun(run, "completed", "success"));
  await assert.rejects(
    () => reserveExceptionStage({ ...f, mode: "review", run: { ...run, runId: run.runId + 1 } }),
    /REVIEW_SUBMISSION_ALREADY_CONSUMED/u,
  );
  assert.equal(await f.store.read("review3"), null);
  assert.equal(await f.secondStore.read("qualify"), null);
});

test("R3 Git admission permits only the bounded repair and freezes every other runtime entry", (t) => {
  const directory = path.join(repo, "artifacts");
  mkdirSync(directory, { recursive: true });
  const root = mkdtempSync(path.join(directory, "r3-admission-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const run = (args, input) =>
    execFileSync("git", args, { cwd: root, input, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
  run(["init", "-q"]);
  run(["config", "user.name", "R3 Fixture"]);
  run(["config", "user.email", "fixture@example.invalid"]);
  const common = execFileSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], {
    cwd: repo,
    encoding: "utf8",
  }).trim();
  writeFileSync(
    path.join(root, ".git/objects/info/alternates"),
    path.join(common, "objects").replaceAll("\\", "/") + "\n",
  );
  const put = (file, bytes, mode = "100644") => {
    const blob = run(["hash-object", "-w", "--stdin"], bytes);
    run(["update-index", "--add", "--cacheinfo", `${mode},${blob},${file}`]);
  };
  const commit = (parent) => run(["commit-tree", run(["write-tree"]), "-p", parent, "-m", "isolated R3 fixture"]);
  const baseInput = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo, encoding: "utf8" }).trim();
  run(["read-tree", baseInput]);
  put(
    "testing/product-experience-exceptions.json",
    readFileSync(path.join(repo, "testing/product-experience-exceptions.json")),
  );
  const baseSha = commit(baseInput);
  const original = JSON.parse(run(["show", `${CROSSDECK_R3.blockedCandidate}:testing/contracts.json`]));
  const contracts = structuredClone(original);
  const target = contracts.contracts.find((c) => c.id === CROSSDECK_R3.contractId);
  target.experience.journeys[0].steps.push(
    ...r3ContractFixture().proposed.contracts[0].experience.journeys[0].steps.slice(1),
  );
  target.experience.localContinuationProof =
    r3ContractFixture().proposed.contracts[0].experience.localContinuationProof;
  const overlay = run(["ls-tree", "-r", CROSSDECK_R3.blockedCandidate, "--", "src", "public", "prisma"]);
  run(["update-index", "--index-info"], overlay + "\n");
  for (const entry of r3Template.protectedBaseRuntimeOverrides)
    run(["update-index", "--add", "--cacheinfo", `${entry.mode},${entry.blob},${entry.path}`]);
  for (const entry of r3Template.immutableHistory)
    run(["update-index", "--add", "--cacheinfo", `100644,${entry.blob},${entry.path}`]);
  put("testing/contracts.json", JSON.stringify(contracts));
  const product = CROSSDECK_R3.productPaths[0];
  const originalBytes = run(["show", `${CROSSDECK_R3.blockedCandidate}:${product}`]);
  put(product, originalBytes + "\n// bounded fixture change\n");
  const candidateSha = commit(baseSha);
  const selected = JSON.parse(
    readFileSync(
      path.join(
        repo,
        "Development_Docs/Programs/Sounding_Line/evidence/crossdeck-r3-owner-decision-proposal-20261015/scope-binding.json",
      ),
    ),
  ).contractObjects;
  const plan = {
    applicable: true,
    contractIds: r3Template.contractIds,
    contracts: selected,
    contractDigest: "a".repeat(64),
  };
  const bind = (candidate) =>
    bindExperienceException({
      root,
      baseSha,
      candidateSha: candidate,
      plan,
      prNumber: 721,
      now: new Date("2026-10-15T19:00:00Z"),
    });
  assert.equal(bind(candidateSha).independentReviewOrdinal, 4);
  run(["read-tree", candidateSha]);
  put("src/app/layout.tsx", "unrelated product change");
  assert.throws(() => bind(commit(baseSha)), /RUNTIME_BINDING_CHANGED/u);
  run(["read-tree", candidateSha]);
  put(product, originalBytes, "100755");
  assert.throws(() => bind(commit(baseSha)), /REPAIR_PATH_TYPE_CHANGED/u);
  run(["read-tree", candidateSha]);
  const narrowed = structuredClone(contracts);
  narrowed.contracts.find((c) => c.id !== CROSSDECK_R3.contractId).name += "hidden change";
  put("testing/contracts.json", JSON.stringify(narrowed));
  assert.throws(() => bind(commit(baseSha)), /CONTRACT_SCOPE_CHANGED/u);
});
