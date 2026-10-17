// Inert synthetic accounting/publication fixtures. Never launch setup, native code, or a browser.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  READINESS_DEPENDENCIES,
  READINESS_POLICY,
  beginReadinessAttempt,
  completeReadinessAttempt,
  loadReadinessAttempt,
  publishReadinessEvidence,
  readReadinessProfileContext,
  readinessSuiteArguments,
  readinessDependencyManifest,
  requireLatestReadinessPASS,
  sealReadinessProfileContext,
  validateReadinessReceipt,
} from "../../scripts/sounding-line/experience-dependency-readiness.mjs";

const hash = (value) => createHash("sha256").update(value).digest("hex");
const write = (file, value) => {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, typeof value === "string" ? value : JSON.stringify(value, null, 2) + "\n");
};
const ambientKeys = [
  "PATH",
  "Path",
  "SystemRoot",
  "SYSTEMROOT",
  "WINDIR",
  "COMSPEC",
  "PATHEXT",
  "HOME",
  "USERPROFILE",
  "LOCALAPPDATA",
  "APPDATA",
  "TEMP",
  "TMP",
  "TMPDIR",
  "PLAYWRIGHT_BROWSERS_PATH",
];
function fixture(t) {
  const root = mkdtempSync(path.join(os.tmpdir(), "readiness-inert-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  git("init", "-q");
  git("config", "user.name", "Synthetic readiness");
  git("config", "user.email", "readiness@example.invalid");
  write(path.join(root, ".gitignore"), "artifacts/\nnode_modules/\n");
  write(path.join(root, "src/example.ts"), "export const synthetic = true;\n");
  write(path.join(root, "node_modules/inert-dependency.js"), "// synthetic bytes; never executed\n");
  git("add", ".");
  git("commit", "-qm", "synthetic source");
  const candidateSha = git("rev-parse", "HEAD");
  const record = { id: "PE-X-CROSSDECK-FINAL-VERIFY-20261015-R13" };
  const manifest = {
    candidateTree: git("rev-parse", "HEAD^{tree}"),
    sourceDigest: "a".repeat(64),
    contractDigest: "b".repeat(64),
    recordDigest: "c".repeat(64),
    sourceManifestSha256: "d".repeat(64),
  };
  const environment = Object.fromEntries(
    ambientKeys.filter((key) => typeof process.env[key] === "string").map((key) => [key, process.env[key]]),
  );
  return { root, git, record, manifest, environment, baseSha: candidateSha, candidateSha, stage: "original" };
}
function guardedEnvironment(f, attempt, profile = {}) {
  return {
    ...f.environment,
    ...profile,
    SOUNDING_LINE_READINESS_LEASE: attempt.binding.lease,
    SOUNDING_LINE_READINESS_MARKER: attempt.paths.marker,
  };
}
function profile(attempt) {
  return {
    SOUNDING_LINE_SUITE_PROFILE: "generic",
    FOREVER_VALIDATION_ISOLATION: "1",
    SOUNDING_LINE_TASK_OWNED_HTTP: "1",
    HOMEPORT_TRANSACTIONAL_EMAIL_PROVIDER: "SYNTHETIC_OUTBOX",
    HOMEPORT_SYNTHETIC_EMAIL_ADAPTER: "TASK_OWNED_TEST",
    DATABASE_URL: attempt.paths.databaseUrl,
    PHASE2_LEGACY_ACCESS_CODE: "synthetic-private-context-only",
  };
}
function syntheticPassingOutput(f, attempt, mutate = () => {}) {
  loadReadinessAttempt({
    root: f.root,
    stage: attempt.stage,
    attempt: attempt.attempt,
    environment: guardedEnvironment(f, attempt),
  });
  sealReadinessProfileContext({ attempt, profileEnvironment: profile(attempt) });
  const engines = ["node_modules/@prisma/engines", "node_modules/prisma"].flatMap((directory) =>
    READINESS_DEPENDENCIES.engines.map((engine) => ({
      name: engine.name,
      path: path.join(f.root, directory, engine.file),
      sha256: engine.sha256,
    })),
  );
  const native = {
    version: 1,
    classification: READINESS_POLICY.classification,
    status: "PASS",
    binding: attempt.binding,
    inventory: {
      lockBlob: READINESS_DEPENDENCIES.lockBlob,
      engineVersion: READINESS_DEPENDENCIES.engineVersion,
      platform: READINESS_DEPENDENCIES.platform,
      engines,
      cache: READINESS_DEPENDENCIES.engines.map((engine) => ({ name: engine.name, status: "ABSENT" })),
    },
    versions: engines.map((entry) => ({
      name: entry.name,
      path: entry.path,
      version: READINESS_DEPENDENCIES.engineVersion,
    })),
  };
  const browser = {
    version: 1,
    classification: READINESS_POLICY.classification,
    status: "PASS",
    binding: attempt.binding,
    probe: READINESS_POLICY.browserProbe,
    contexts: 0,
    pages: 0,
    captures: 0,
    cleanup: { status: "PASS", browserClosed: true },
    dependencies: {
      revision: READINESS_DEPENDENCIES.chromiumRevision,
      executables: ["chromium", "chromium-headless-shell"].map((name) => ({
        name,
        path: `/synthetic/${name}`,
        sha256: hash(name),
      })),
    },
  };
  const argumentsList = [
    ["node_modules/prisma/build/index.js", "generate", "--schema", READINESS_POLICY.schema],
    ["scripts/sounding-line/sqlite-bootstrap.mjs", "--database-url", attempt.paths.databaseUrl],
    ["node_modules/tsx/dist/cli.mjs", "prisma/seed.ts"],
    ["node_modules/tsx/dist/cli.mjs", "scripts/migrate-legacy-companion.ts"],
    ["scripts/sounding-line/prepare-validation-isolation.mjs"],
    ["node_modules/next/dist/bin/next", "build"],
  ];
  mutate({ native, browser });
  write(attempt.paths.nativeReceipt, native);
  write(attempt.paths.browserReceipt, browser);
  write(attempt.paths.setupReceipt, {
    version: 1,
    status: "PASS",
    steps: READINESS_POLICY.genericSetup.map((id, index) => ({
      id,
      status: "PASS",
      command: process.execPath,
      arguments: argumentsList[index],
      exitCode: 0,
    })),
  });
  write(attempt.paths.stdout, "synthetic setup stdout; no command executed\n");
  write(attempt.paths.stderr, "");
  return completeReadinessAttempt({
    attempt,
    status: "PASS",
    execution: { exitCode: 0, cancelled: false, cleanup: { status: "PASS" } },
    cleanup: { status: "PASS" },
  });
}

test("fixed readiness policy and suite arguments grant no product journey", () => {
  assert.equal(READINESS_POLICY.maximumAttemptsPerStage, 3);
  assert.equal(READINESS_POLICY.maximumAttemptsTotal, 6);
  assert.deepEqual(
    [READINESS_POLICY.productJourneys, READINESS_POLICY.productCaptures, READINESS_POLICY.providerCalls],
    [0, 0, 0],
  );
  assert.deepEqual(
    readinessSuiteArguments({
      root: "/synthetic",
      baseSha: "a".repeat(40),
      candidateSha: "b".repeat(40),
      stage: "original",
      databaseUrl: "file:/synthetic.db",
      attempt: 2,
    }),
    [
      "--profile",
      "generic",
      "--workspace",
      "/synthetic",
      "--candidate",
      "b".repeat(40),
      "--database-url",
      "file:/synthetic.db",
      "--r13-dependency-readiness",
      "original",
      "--r13-base",
      "a".repeat(40),
      "--r13-attempt",
      "2",
    ],
  );
});

test("dependency inventory binds nested regular file bytes without loading code", (t) => {
  const f = fixture(t);
  const initial = readinessDependencyManifest(f.root);
  assert.ok(initial.some((entry) => entry.path === "node_modules/inert-dependency.js" && entry.type === "file"));
  write(path.join(f.root, "node_modules/inert-dependency.js"), "// altered synthetic bytes\n");
  assert.notEqual(hash(JSON.stringify(initial)), hash(JSON.stringify(readinessDependencyManifest(f.root))));
});

test("immutable reservations cap three attempts per stage and six across shared worktrees", (t) => {
  const f = fixture(t);
  const other = path.join(f.root, "other-worktree");
  f.git("worktree", "add", "--detach", "-q", other, f.candidateSha);
  for (const stage of ["original", "corrected"])
    for (let number = 1; number <= 3; number++) {
      const attempt = beginReadinessAttempt({ ...f, stage, root: stage === "original" ? f.root : other });
      assert.equal(attempt.attempt, number);
      const reservation = readFileSync(attempt.paths.marker);
      completeReadinessAttempt({ attempt, status: "FAIL", error: Error("inert prerequisite failure") });
      assert.deepEqual(readFileSync(attempt.paths.marker), reservation);
      assert.throws(() => completeReadinessAttempt({ attempt, status: "FAIL" }), /EEXIST/u);
    }
  assert.throws(() => beginReadinessAttempt(f), /ATTEMPTS_EXHAUSTED/u);
  assert.throws(() => beginReadinessAttempt({ ...f, stage: "corrected", root: other }), /ATTEMPTS_EXHAUSTED/u);
});

test("a nonterminal reservation blocks further attempts and never creates a case marker", (t) => {
  const f = fixture(t);
  const attempt = beginReadinessAttempt(f);
  assert.throws(() => beginReadinessAttempt(f), /PRIOR_ATTEMPT_NONTERMINAL/u);
  assert.throws(() => requireLatestReadinessPASS(f), /HISTORY_NOT_TERMINAL/u);
  assert.equal(existsSync(path.join(path.dirname(attempt.paths.marker), "crossdeck-r13-focused-original.json")), false);
});

test("readiness cannot begin after its focused case slot is consumed", (t) => {
  const f = fixture(t);
  const common = f.git("rev-parse", "--path-format=absolute", "--git-common-dir");
  write(path.join(common, "sounding-line/crossdeck-r13-focused-original.json"), { status: "UNKNOWN" });
  assert.throws(() => beginReadinessAttempt(f), /CASE_ALREADY_CONSUMED/u);
});

test("child launch requires the parent lease and can only be claimed once", (t) => {
  const f = fixture(t);
  const attempt = beginReadinessAttempt(f);
  assert.throws(
    () => loadReadinessAttempt({ root: f.root, stage: f.stage, attempt: 1, environment: {} }),
    /ACTIVE_LEASE_REQUIRED/u,
  );
  assert.equal(existsSync(attempt.paths.launch), false);
  loadReadinessAttempt({ root: f.root, stage: f.stage, attempt: 1, environment: guardedEnvironment(f, attempt) });
  assert.throws(
    () =>
      loadReadinessAttempt({ root: f.root, stage: f.stage, attempt: 1, environment: guardedEnvironment(f, attempt) }),
    /EEXIST/u,
  );
});

test("sealed private context rejects ambient flags, wrong database and modified effective environment", (t) => {
  const f = fixture(t);
  const attempt = beginReadinessAttempt(f);
  assert.throws(
    () =>
      sealReadinessProfileContext({
        attempt,
        profileEnvironment: { ...profile(attempt), NODE_OPTIONS: "--import=forbidden" },
      }),
    /PROFILE_ENVIRONMENT_FORBIDDEN/u,
  );
  assert.throws(
    () =>
      sealReadinessProfileContext({
        attempt,
        profileEnvironment: { ...profile(attempt), DATABASE_URL: "file:/other.db" },
      }),
    /PROFILE_DATABASE_CHANGED/u,
  );
  sealReadinessProfileContext({ attempt, profileEnvironment: profile(attempt) });
  if (process.platform !== "win32") assert.equal(statSync(attempt.paths.privateContext).mode & 0o777, 0o600);
  assert.equal(readFileSync(attempt.paths.contextSeal, "utf8").includes("synthetic-private-context-only"), false);
  assert.equal(
    readReadinessProfileContext({ attempt, environment: guardedEnvironment(f, attempt, profile(attempt)) })
      .DATABASE_URL,
    attempt.paths.databaseUrl,
  );
  assert.throws(
    () =>
      readReadinessProfileContext({
        attempt,
        environment: { ...guardedEnvironment(f, attempt, profile(attempt)), GH_TOKEN: "forbidden" },
      }),
    /EFFECTIVE_ENVIRONMENT_CHANGED/u,
  );
  write(attempt.paths.privateContext, {
    version: 1,
    binding: attempt.binding,
    environment: { ...profile(attempt), DATABASE_URL: "file:/tampered.db" },
  });
  assert.throws(
    () => readReadinessProfileContext({ attempt, environment: guardedEnvironment(f, attempt, profile(attempt)) }),
    /PROFILE_CONTEXT_CHANGED/u,
  );
});

test("missing actual probe/setup outputs turn requested PASS into preserved UNKNOWN", (t) => {
  const f = fixture(t);
  const attempt = beginReadinessAttempt(f);
  const receipt = completeReadinessAttempt({
    attempt,
    status: "PASS",
    execution: { exitCode: 0, cancelled: false, cleanup: { status: "PASS" } },
    cleanup: { status: "PASS" },
  });
  assert.equal(receipt.status, "UNKNOWN");
  assert.ok(receipt.completionError);
  assert.equal(existsSync(attempt.paths.receipt), true);
  validateReadinessReceipt({ root: f.root, record: f.record, stage: f.stage, receipt });
});

test("broken dependency links and malformed probe JSON preserve terminal UNKNOWN and permit bounded repair", (t) => {
  const f = fixture(t);
  const attempt = beginReadinessAttempt(f);
  symlinkSync("./does-not-exist", path.join(f.root, "node_modules/broken-link"));
  write(attempt.paths.nativeReceipt, "{malformed probe");
  const receipt = completeReadinessAttempt({
    attempt,
    status: "PASS",
    execution: { exitCode: 0, cancelled: false, cleanup: { status: "PASS" } },
    cleanup: { status: "PASS" },
  });
  assert.equal(receipt.status, "UNKNOWN");
  assert.ok(receipt.outputErrors.some((entry) => entry.key === "dependencyManifest"));
  assert.ok(receipt.outputErrors.some((entry) => entry.key === "nativeReceipt"));
  assert.equal(existsSync(attempt.paths.receipt), true);
  validateReadinessReceipt({ root: f.root, record: f.record, stage: f.stage, receipt });
  rmSync(path.join(f.root, "node_modules/broken-link"));
  assert.equal(beginReadinessAttempt(f).attempt, 2);
});

test("PASS rejects duplicate engines, wrong native versions and nested probe binding drift", (t) => {
  for (const mutate of [
    ({ native }) => {
      native.inventory.engines[1] = { ...native.inventory.engines[0] };
    },
    ({ native }) => {
      native.versions[0].version = "wrong-commit";
    },
    ({ browser }) => {
      browser.binding = { ...browser.binding, sourceDigest: "0".repeat(64) };
    },
  ]) {
    const f = fixture(t),
      attempt = beginReadinessAttempt(f);
    const receipt = syntheticPassingOutput(f, attempt, mutate);
    assert.equal(receipt.status, "UNKNOWN");
    assert.ok(receipt.completionError || receipt.outputErrors.length);
  }
});

test("a later failed readiness invalidates an earlier PASS without falling back", (t) => {
  const f = fixture(t);
  const first = beginReadinessAttempt(f);
  assert.equal(syntheticPassingOutput(f, first).status, "PASS");
  const second = beginReadinessAttempt(f);
  completeReadinessAttempt({ attempt: second, status: "UNKNOWN", error: Error("inert later failure") });
  assert.throws(() => requireLatestReadinessPASS(f), /LATEST_PASS_REQUIRED/u);
  assert.throws(
    () => readReadinessProfileContext({ attempt: first, environment: f.environment, phase: "case" }),
    /LATEST_PASS_REQUIRED/u,
  );
});

test("published readiness verifies committed evidence without private files or installed dependencies", (t) => {
  const f = fixture(t);
  const failed = beginReadinessAttempt(f);
  completeReadinessAttempt({ attempt: failed, status: "FAIL", error: Error("inert initial failure") });
  const attempt = beginReadinessAttempt(f);
  const receipt = syntheticPassingOutput(f, attempt);
  assert.equal(receipt.status, "PASS");
  validateReadinessReceipt({ root: f.root, record: f.record, stage: f.stage, receipt });
  const publication = publishReadinessEvidence({
    attempt,
    publicationRoot:
      "Development_Docs/Projects/Project_Crossdeck/evidence/r13-verification-20261017/focused-technical/original",
  });
  assert.equal(publication.attempt, 2);
  assert.equal(publication.receiptSha256, hash(readFileSync(attempt.paths.receipt)));
  assert.equal(
    publication.files.some((entry) => entry.path.includes("private")),
    false,
  );
  assert.equal(
    publication.files.some((entry) =>
      readFileSync(path.join(f.root, entry.path), "utf8").includes("synthetic-private-context-only"),
    ),
    false,
  );
  validateReadinessReceipt({ root: f.root, record: f.record, stage: f.stage, receipt: publication });
  f.git("add", "Development_Docs");
  f.git("commit", "-qm", "inert readiness publication");
  const revision = f.git("rev-parse", "HEAD");
  rmSync(path.join(f.root, "artifacts"), { recursive: true, force: true });
  validateReadinessReceipt({ root: f.root, revision, record: f.record, stage: f.stage, receipt: publication });
  assert.throws(
    () =>
      validateReadinessReceipt({
        root: f.root,
        revision,
        record: f.record,
        stage: f.stage,
        receipt: { ...publication, receiptSha256: "0".repeat(64) },
      }),
    /PUBLICATION_TERMINAL_CHANGED/u,
  );
  assert.throws(
    () =>
      validateReadinessReceipt({
        root: f.root,
        revision,
        record: f.record,
        stage: f.stage,
        receipt: { ...publication, files: publication.files.slice(1) },
      }),
    /PUBLICATION_INVENTORY_CHANGED/u,
  );
});
