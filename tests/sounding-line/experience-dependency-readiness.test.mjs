// Inert synthetic accounting/publication fixtures. Never launch setup, native code, or a browser.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  lstatSync,
  readlinkSync,
  realpathSync,
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
  isPreservedCollectorFailure,
  osReleaseMetadata,
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
  for (const [field, value] of [
    ["baseSha", "f".repeat(40)],
    ["sourceManifestSha256", "0".repeat(64)],
    ["manifestSha256", "0".repeat(64)],
  ])
    assert.throws(
      () =>
        validateReadinessReceipt({
          root: f.root,
          revision,
          record: f.record,
          stage: f.stage,
          receipt: { ...publication, binding: { ...publication.binding, [field]: value } },
        }),
      /PUBLICATION_SOURCE_CHANGED/u,
    );
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

// Exact immutable failed-attempt bytes. These are historical evidence, never an execution fixture.
const collectorFailureBytes = {
  markerBytes: Buffer.from(
    "ewogICJ2ZXJzaW9uIjogMSwKICAiY2xhc3NpZmljYXRpb24iOiAiRklOSVRFX0lORlJBU1RSVUNUVVJFX1JFQURJTkVTU19OT19QUk9EVUNUX0pPVVJORVlTIiwKICAic3RhdHVzIjogIlJFU0VSVkVEIiwKICAicG9saWN5RGlnZXN0IjogImMzZWNhMjM4NTY1ZDcxMGNkMjM5MjgxOGEwNDA5YjJhYjdhZTk5OGUyOGQzMjJjNjAwNTAwZDE4YTA0Y2Y5ZDIiLAogICJyb290IjogIi93b3Jrc3BhY2UvY3Jvc3NkZWNrLXIxMy1vcmlnaW5hbC1wcm9vZiIsCiAgInN0YWdlIjogIm9yaWdpbmFsIiwKICAiYXR0ZW1wdCI6IDEsCiAgIm93bmVyUGlkIjogMTQ4NzUyLAogICJzdGFydGVkQXQiOiAiMjAyNi0xMC0xN1QwMzo0MToyNS42MzdaIiwKICAiZGF0YWJhc2VVcmwiOiAiZmlsZTovd29ya3NwYWNlL2Nyb3NzZGVjay1yMTMtb3JpZ2luYWwtcHJvb2YvYXJ0aWZhY3RzL3NvdW5kaW5nLWxpbmUvZ2VuZXJpYy01MzYwMWU5ZTM4NmIvdmFsaWRhdGlvbi1pc29sYXRlZC0yMDI2MTAxNy0wMzQxMjU2MzctNjU4NGFmNzc2OWQ3NDQwMjk2Y2Q0M2ZkNzQxYTUxZmIuZGIiLAogICJiaW5kaW5nIjogewogICAgInZlcnNpb24iOiAxLAogICAgImV4Y2VwdGlvbklkIjogIlBFLVgtQ1JPU1NERUNLLUZJTkFMLVZFUklGWS0yMDI2MTAxNS1SMTMiLAogICAgInJlY29yZERpZ2VzdCI6ICJhNjY4OWViYWI0OTBlZDgxZjMxM2NmNGJjNWUyZTU5NzE4MWMwMTJhZDQzNjQ1MTIwNjk4YjJmYWVmMDk3MzU5IiwKICAgICJiYXNlU2hhIjogIjk4NmFhMDAwMjcxMWE0M2I0MjU2MDBmMDM4MDNmYWUzZDViOTkwNmYiLAogICAgImNhbmRpZGF0ZVNoYSI6ICI1MzYwMWU5ZTM4NmJiNGYxMDYyNzE5YmVmYzc3Yjc3NzhiOWU0NDMwIiwKICAgICJjYW5kaWRhdGVUcmVlIjogIjg1ZTlhY2NjMWQyNzNkMGY2NDkxMTkzODBkNzc1ZGY0MWU2ZGNmMGEiLAogICAgInNvdXJjZURpZ2VzdCI6ICIzZTY5YzIzMDY0NDI3NThlZGNhNDE3ZmRiNDc4ZjFhNjFlMDA5ZjFjYmM4MmQ1ODRiY2FkNmU3NjAyNTdkZjBmIiwKICAgICJjb250cmFjdERpZ2VzdCI6ICIzM2I3NjIxMjY5ZmExODQxN2MyMDcxM2NjYzE4NTc4Mzg2MWVmMDQzZTM4YTUyN2Y3MjdkZjdlMTA0N2M3Mjc0IiwKICAgICJzb3VyY2VNYW5pZmVzdFNoYTI1NiI6ICJmNGExZmViYTZiMjQyMjM4NTJiYTY5ODM3ZGI5N2U4ZGU1YjVkZDVmNDVjMTYyMDVhY2Q2ZTYyN2ZiZjkzMGE5IiwKICAgICJlbnZpcm9ubWVudERpZ2VzdCI6ICJmMmM1M2E3ZTY3ZWM1ZDEyNzM5M2NlZWQ0ODc1MTBlZGFiMmEzYTIyNWIxYmY4M2RjZGRkNzRlZTI0ZjU4YTljIiwKICAgICJzdGFnZSI6ICJvcmlnaW5hbCIsCiAgICAibWFuaWZlc3RTaGEyNTYiOiAiY2E0NDE0ODc3ZjM3YjUwMGFkZmJlNTIxYTczN2Q5YWI1ZWVlOTJlMWI2NjIyMjBlYzM4N2IwOGQ0OWNiMzZmYyIsCiAgICAiYXR0ZW1wdCI6IDEsCiAgICAibGVhc2UiOiAiODcwODYzNjUtNGMwMy00YTZkLWE4YmItOTg3ODYwYzNkZmUwIgogIH0KfQo=",
    "base64",
  ),
  launchBytes: Buffer.from(
    "ewogICJ2ZXJzaW9uIjogMSwKICAiY2xhc3NpZmljYXRpb24iOiAiRklOSVRFX0lORlJBU1RSVUNUVVJFX1JFQURJTkVTU19OT19QUk9EVUNUX0pPVVJORVlTIiwKICAiYmluZGluZyI6IHsKICAgICJ2ZXJzaW9uIjogMSwKICAgICJleGNlcHRpb25JZCI6ICJQRS1YLUNST1NTREVDSy1GSU5BTC1WRVJJRlktMjAyNjEwMTUtUjEzIiwKICAgICJyZWNvcmREaWdlc3QiOiAiYTY2ODllYmFiNDkwZWQ4MWYzMTNjZjRiYzVlMmU1OTcxODFjMDEyYWQ0MzY0NTEyMDY5OGIyZmFlZjA5NzM1OSIsCiAgICAiYmFzZVNoYSI6ICI5ODZhYTAwMDI3MTFhNDNiNDI1NjAwZjAzODAzZmFlM2Q1Yjk5MDZmIiwKICAgICJjYW5kaWRhdGVTaGEiOiAiNTM2MDFlOWUzODZiYjRmMTA2MjcxOWJlZmM3N2I3Nzc4YjllNDQzMCIsCiAgICAiY2FuZGlkYXRlVHJlZSI6ICI4NWU5YWNjYzFkMjczZDBmNjQ5MTE5MzgwZDc3NWRmNDFlNmRjZjBhIiwKICAgICJzb3VyY2VEaWdlc3QiOiAiM2U2OWMyMzA2NDQyNzU4ZWRjYTQxN2ZkYjQ3OGYxYTYxZTAwOWYxY2JjODJkNTg0YmNhZDZlNzYwMjU3ZGYwZiIsCiAgICAiY29udHJhY3REaWdlc3QiOiAiMzNiNzYyMTI2OWZhMTg0MTdjMjA3MTNjY2MxODU3ODM4NjFlZjA0M2UzOGE1MjdmNzI3ZGY3ZTEwNDdjNzI3NCIsCiAgICAic291cmNlTWFuaWZlc3RTaGEyNTYiOiAiZjRhMWZlYmE2YjI0MjIzODUyYmE2OTgzN2RiOTdlOGRlNWI1ZGQ1ZjQ1YzE2MjA1YWNkNmU2MjdmYmY5MzBhOSIsCiAgICAiZW52aXJvbm1lbnREaWdlc3QiOiAiZjJjNTNhN2U2N2VjNWQxMjczOTNjZWVkNDg3NTEwZWRhYjJhM2EyMjViMWJmODNkY2RkZDc0ZWUyNGY1OGE5YyIsCiAgICAic3RhZ2UiOiAib3JpZ2luYWwiLAogICAgIm1hbmlmZXN0U2hhMjU2IjogImNhNDQxNDg3N2YzN2I1MDBhZGZiZTUyMWE3MzdkOWFiNWVlZTkyZTFiNjYyMjIwZWMzODdiMDhkNDljYjM2ZmMiLAogICAgImF0dGVtcHQiOiAxLAogICAgImxlYXNlIjogIjg3MDg2MzY1LTRjMDMtNGE2ZC1hOGJiLTk4Nzg2MGMzZGZlMCIKICB9LAogICJvd25lclBpZCI6IDE0OTU0MywKICAicGFyZW50UGlkIjogMTQ4NzUyLAogICJsYXVuY2hlZEF0IjogIjIwMjYtMTAtMTdUMDM6NDE6MjUuODE4WiIKfQo=",
    "base64",
  ),
  receiptBytes: Buffer.from(
    "ewogICJ2ZXJzaW9uIjogMSwKICAiY2xhc3NpZmljYXRpb24iOiAiRklOSVRFX0lORlJBU1RSVUNUVVJFX1JFQURJTkVTU19OT19QUk9EVUNUX0pPVVJORVlTIiwKICAicG9saWN5RGlnZXN0IjogImMzZWNhMjM4NTY1ZDcxMGNkMjM5MjgxOGEwNDA5YjJhYjdhZTk5OGUyOGQzMjJjNjAwNTAwZDE4YTA0Y2Y5ZDIiLAogICJzdGF0dXMiOiAiVU5LTk9XTiIsCiAgImJpbmRpbmciOiB7CiAgICAidmVyc2lvbiI6IDEsCiAgICAiZXhjZXB0aW9uSWQiOiAiUEUtWC1DUk9TU0RFQ0stRklOQUwtVkVSSUZZLTIwMjYxMDE1LVIxMyIsCiAgICAicmVjb3JkRGlnZXN0IjogImE2Njg5ZWJhYjQ5MGVkODFmMzEzY2Y0YmM1ZTJlNTk3MTgxYzAxMmFkNDM2NDUxMjA2OThiMmZhZWYwOTczNTkiLAogICAgImJhc2VTaGEiOiAiOTg2YWEwMDAyNzExYTQzYjQyNTYwMGYwMzgwM2ZhZTNkNWI5OTA2ZiIsCiAgICAiY2FuZGlkYXRlU2hhIjogIjUzNjAxZTllMzg2YmI0ZjEwNjI3MTliZWZjNzdiNzc3OGI5ZTQ0MzAiLAogICAgImNhbmRpZGF0ZVRyZWUiOiAiODVlOWFjY2MxZDI3M2QwZjY0OTExOTM4MGQ3NzVkZjQxZTZkY2YwYSIsCiAgICAic291cmNlRGlnZXN0IjogIjNlNjljMjMwNjQ0Mjc1OGVkY2E0MTdmZGI0NzhmMWE2MWUwMDlmMWNiYzgyZDU4NGJjYWQ2ZTc2MDI1N2RmMGYiLAogICAgImNvbnRyYWN0RGlnZXN0IjogIjMzYjc2MjEyNjlmYTE4NDE3YzIwNzEzY2NjMTg1NzgzODYxZWYwNDNlMzhhNTI3ZjcyN2RmN2UxMDQ3YzcyNzQiLAogICAgInNvdXJjZU1hbmlmZXN0U2hhMjU2IjogImY0YTFmZWJhNmIyNDIyMzg1MmJhNjk4MzdkYjk3ZThkZTViNWRkNWY0NWMxNjIwNWFjZDZlNjI3ZmJmOTMwYTkiLAogICAgImVudmlyb25tZW50RGlnZXN0IjogImYyYzUzYTdlNjdlYzVkMTI3MzkzY2VlZDQ4NzUxMGVkYWIyYTNhMjI1YjFiZjgzZGNkZGQ3NGVlMjRmNThhOWMiLAogICAgInN0YWdlIjogIm9yaWdpbmFsIiwKICAgICJtYW5pZmVzdFNoYTI1NiI6ICJjYTQ0MTQ4NzdmMzdiNTAwYWRmYmU1MjFhNzM3ZDlhYjVlZWU5MmUxYjY2MjIyMGVjMzg3YjA4ZDQ5Y2IzNmZjIiwKICAgICJhdHRlbXB0IjogMSwKICAgICJsZWFzZSI6ICI4NzA4NjM2NS00YzAzLTRhNmQtYThiYi05ODc4NjBjM2RmZTAiCiAgfSwKICAic3RhcnRlZEF0IjogIjIwMjYtMTAtMTdUMDM6NDE6MjUuNjM3WiIsCiAgImNvbXBsZXRlZEF0IjogIjIwMjYtMTAtMTdUMDM6NDQ6MDYuNzc3WiIsCiAgInByb2R1Y3RKb3VybmV5cyI6IDAsCiAgInByb2R1Y3RDYXB0dXJlcyI6IDAsCiAgInByb3ZpZGVyQ2FsbHMiOiAwLAogICJuYXRpdmUiOiB7CiAgICAidmVyc2lvbiI6IDEsCiAgICAiYmluZGluZyI6IHsKICAgICAgInZlcnNpb24iOiAxLAogICAgICAiZXhjZXB0aW9uSWQiOiAiUEUtWC1DUk9TU0RFQ0stRklOQUwtVkVSSUZZLTIwMjYxMDE1LVIxMyIsCiAgICAgICJyZWNvcmREaWdlc3QiOiAiYTY2ODllYmFiNDkwZWQ4MWYzMTNjZjRiYzVlMmU1OTcxODFjMDEyYWQ0MzY0NTEyMDY5OGIyZmFlZjA5NzM1OSIsCiAgICAgICJiYXNlU2hhIjogIjk4NmFhMDAwMjcxMWE0M2I0MjU2MDBmMDM4MDNmYWUzZDViOTkwNmYiLAogICAgICAiY2FuZGlkYXRlU2hhIjogIjUzNjAxZTllMzg2YmI0ZjEwNjI3MTliZWZjNzdiNzc3OGI5ZTQ0MzAiLAogICAgICAiY2FuZGlkYXRlVHJlZSI6ICI4NWU5YWNjYzFkMjczZDBmNjQ5MTE5MzgwZDc3NWRmNDFlNmRjZjBhIiwKICAgICAgInNvdXJjZURpZ2VzdCI6ICIzZTY5YzIzMDY0NDI3NThlZGNhNDE3ZmRiNDc4ZjFhNjFlMDA5ZjFjYmM4MmQ1ODRiY2FkNmU3NjAyNTdkZjBmIiwKICAgICAgImNvbnRyYWN0RGlnZXN0IjogIjMzYjc2MjEyNjlmYTE4NDE3YzIwNzEzY2NjMTg1NzgzODYxZWYwNDNlMzhhNTI3ZjcyN2RmN2UxMDQ3YzcyNzQiLAogICAgICAic291cmNlTWFuaWZlc3RTaGEyNTYiOiAiZjRhMWZlYmE2YjI0MjIzODUyYmE2OTgzN2RiOTdlOGRlNWI1ZGQ1ZjQ1YzE2MjA1YWNkNmU2MjdmYmY5MzBhOSIsCiAgICAgICJlbnZpcm9ubWVudERpZ2VzdCI6ICJmMmM1M2E3ZTY3ZWM1ZDEyNzM5M2NlZWQ0ODc1MTBlZGFiMmEzYTIyNWIxYmY4M2RjZGRkNzRlZTI0ZjU4YTljIiwKICAgICAgInN0YWdlIjogIm9yaWdpbmFsIiwKICAgICAgIm1hbmlmZXN0U2hhMjU2IjogImNhNDQxNDg3N2YzN2I1MDBhZGZiZTUyMWE3MzdkOWFiNWVlZTkyZTFiNjYyMjIwZWMzODdiMDhkNDljYjM2ZmMiLAogICAgICAiYXR0ZW1wdCI6IDEsCiAgICAgICJsZWFzZSI6ICI4NzA4NjM2NS00YzAzLTRhNmQtYThiYi05ODc4NjBjM2RmZTAiCiAgICB9LAogICAgImNsYXNzaWZpY2F0aW9uIjogIkZJTklURV9JTkZSQVNUUlVDVFVSRV9SRUFESU5FU1NfTk9fUFJPRFVDVF9KT1VSTkVZUyIsCiAgICAic3RhdHVzIjogIlBBU1MiLAogICAgInN0YXJ0ZWRBdCI6ICIyMDI2LTEwLTE3VDAzOjQxOjI3LjE2MloiLAogICAgImludmVudG9yeSI6IHsKICAgICAgInBhY2thZ2VzIjogWwogICAgICAgIHsKICAgICAgICAgICJuYW1lIjogInByaXNtYSIsCiAgICAgICAgICAidmVyc2lvbiI6ICI2LjE5LjMiLAogICAgICAgICAgInBhdGgiOiAiL3dvcmtzcGFjZS9jcm9zc2RlY2stcjEzLW9yaWdpbmFsLXByb29mL25vZGVfbW9kdWxlcy9wcmlzbWEvcGFja2FnZS5qc29uIiwKICAgICAgICAgICJzaGEyNTYiOiAiNjQwYzQwNTE2ZmFhMGMzMzM5OTVkMGUyMmNmOWUwOTgxNWMzZDdmODBlZjcxYWM3OTMyODNkMmM5Y2FjNDFiZSIKICAgICAgICB9LAogICAgICAgIHsKICAgICAgICAgICJuYW1lIjogIkBwcmlzbWEvY2xpZW50IiwKICAgICAgICAgICJ2ZXJzaW9uIjogIjYuMTkuMyIsCiAgICAgICAgICAicGF0aCI6ICIvd29ya3NwYWNlL2Nyb3NzZGVjay1yMTMtb3JpZ2luYWwtcHJvb2Yvbm9kZV9tb2R1bGVzL0BwcmlzbWEvY2xpZW50L3BhY2thZ2UuanNvbiIsCiAgICAgICAgICAic2hhMjU2IjogIjIxOWU1MDdkOTY3MWY0ZDhiY2Y2MTYxMjc0MjAxMDE1YmQ5N2FhYWZmNzZlYjQ2NGI4ZGU3YWI2MjRmMWJlYmEiCiAgICAgICAgfSwKICAgICAgICB7CiAgICAgICAgICAibmFtZSI6ICJAcHJpc21hL2VuZ2luZXMiLAogICAgICAgICAgInZlcnNpb24iOiAiNi4xOS4zIiwKICAgICAgICAgICJwYXRoIjogIi93b3Jrc3BhY2UvY3Jvc3NkZWNrLXIxMy1vcmlnaW5hbC1wcm9vZi9ub2RlX21vZHVsZXMvQHByaXNtYS9lbmdpbmVzL3BhY2thZ2UuanNvbiIsCiAgICAgICAgICAic2hhMjU2IjogIjlhMzdkNmU3NWZiNjNjMGY1Y2Y5M2NiMjM4MDU0NDA1NjY4YTVlZjI0YTdmYjc3MDg2OTEyOWMxODU0ZWNjNTciCiAgICAgICAgfSwKICAgICAgICB7CiAgICAgICAgICAibmFtZSI6ICJAcHJpc21hL2VuZ2luZXMtdmVyc2lvbiIsCiAgICAgICAgICAicGF0aCI6ICIvd29ya3NwYWNlL2Nyb3NzZGVjay1yMTMtb3JpZ2luYWwtcHJvb2Yvbm9kZV9tb2R1bGVzL0BwcmlzbWEvZW5naW5lcy12ZXJzaW9uL3BhY2thZ2UuanNvbiIsCiAgICAgICAgICAic2hhMjU2IjogIjlmMzY3YzZhYjdhZjU4OWYwMjhlZTAwZWVmYWExNGU1YmE5N2MwYjZlNzA0ZTU2ODI0MTM1OThkYmJkZjQ0NzgiCiAgICAgICAgfQogICAgICBdLAogICAgICAiZW5naW5lcyI6IFsKICAgICAgICB7CiAgICAgICAgICAibmFtZSI6ICJsaWJxdWVyeS1lbmdpbmUiLAogICAgICAgICAgInBhdGgiOiAiL3dvcmtzcGFjZS9jcm9zc2RlY2stcjEzLW9yaWdpbmFsLXByb29mL25vZGVfbW9kdWxlcy9AcHJpc21hL2VuZ2luZXMvbGlicXVlcnlfZW5naW5lLWRlYmlhbi1vcGVuc3NsLTMuMC54LnNvLm5vZGUiLAogICAgICAgICAgInNoYTI1NiI6ICJhMjkyNGVhYjFjNzhhMGE3YmI2N2VkYWM1NzM4OTM5ZmExMDU4OWVmMDczYWY1NTQyZjUzODEyYTIyZTRhN2Q4IgogICAgICAgIH0sCiAgICAgICAgewogICAgICAgICAgIm5hbWUiOiAic2NoZW1hLWVuZ2luZSIsCiAgICAgICAgICAicGF0aCI6ICIvd29ya3NwYWNlL2Nyb3NzZGVjay1yMTMtb3JpZ2luYWwtcHJvb2Yvbm9kZV9tb2R1bGVzL0BwcmlzbWEvZW5naW5lcy9zY2hlbWEtZW5naW5lLWRlYmlhbi1vcGVuc3NsLTMuMC54IiwKICAgICAgICAgICJzaGEyNTYiOiAiNWQ0MmIxODE2MzFmZDIwYmIwZWNjNWFiY2RiYTcyNTc1ZTdmNDY3YTBkNTJmNGQ1ZWYxZmYyOGYwYzc0ZTZlOSIKICAgICAgICB9LAogICAgICAgIHsKICAgICAgICAgICJuYW1lIjogImxpYnF1ZXJ5LWVuZ2luZSIsCiAgICAgICAgICAicGF0aCI6ICIvd29ya3NwYWNlL2Nyb3NzZGVjay1yMTMtb3JpZ2luYWwtcHJvb2Yvbm9kZV9tb2R1bGVzL3ByaXNtYS9saWJxdWVyeV9lbmdpbmUtZGViaWFuLW9wZW5zc2wtMy4wLnguc28ubm9kZSIsCiAgICAgICAgICAic2hhMjU2IjogImEyOTI0ZWFiMWM3OGEwYTdiYjY3ZWRhYzU3Mzg5MzlmYTEwNTg5ZWYwNzNhZjU1NDJmNTM4MTJhMjJlNGE3ZDgiCiAgICAgICAgfSwKICAgICAgICB7CiAgICAgICAgICAibmFtZSI6ICJzY2hlbWEtZW5naW5lIiwKICAgICAgICAgICJwYXRoIjogIi93b3Jrc3BhY2UvY3Jvc3NkZWNrLXIxMy1vcmlnaW5hbC1wcm9vZi9ub2RlX21vZHVsZXMvcHJpc21hL3NjaGVtYS1lbmdpbmUtZGViaWFuLW9wZW5zc2wtMy4wLngiLAogICAgICAgICAgInNoYTI1NiI6ICI1ZDQyYjE4MTYzMWZkMjBiYjBlY2M1YWJjZGJhNzI1NzVlN2Y0NjdhMGQ1MmY0ZDVlZjFmZjI4ZjBjNzRlNmU5IgogICAgICAgIH0KICAgICAgXSwKICAgICAgImNhY2hlIjogWwogICAgICAgIHsKICAgICAgICAgICJuYW1lIjogImxpYnF1ZXJ5LWVuZ2luZSIsCiAgICAgICAgICAicGF0aCI6ICIvaG9tZS9hZ2VudC8uY2FjaGUvcHJpc21hL21hc3Rlci9jMjk5MGRjYTU5MWNiYTc2NmUzYjdlZjVkOWU4YTg0Nzk2ZTQ3YWI3L2RlYmlhbi1vcGVuc3NsLTMuMC54L2xpYnF1ZXJ5LWVuZ2luZSIsCiAgICAgICAgICAic3RhdHVzIjogIkFCU0VOVCIKICAgICAgICB9LAogICAgICAgIHsKICAgICAgICAgICJuYW1lIjogInNjaGVtYS1lbmdpbmUiLAogICAgICAgICAgInBhdGgiOiAiL2hvbWUvYWdlbnQvLmNhY2hlL3ByaXNtYS9tYXN0ZXIvYzI5OTBkY2E1OTFjYmE3NjZlM2I3ZWY1ZDllOGE4NDc5NmU0N2FiNy9kZWJpYW4tb3BlbnNzbC0zLjAueC9zY2hlbWEtZW5naW5lIiwKICAgICAgICAgICJzdGF0dXMiOiAiQUJTRU5UIgogICAgICAgIH0KICAgICAgXSwKICAgICAgImxvY2tCbG9iIjogImZjYTg0ZDNhYjY4ZmY3N2MwMTM1NTRlNWViOTUzMWNiM2Y3YjExYzIiLAogICAgICAiZW5naW5lVmVyc2lvbiI6ICJjMjk5MGRjYTU5MWNiYTc2NmUzYjdlZjVkOWU4YTg0Nzk2ZTQ3YWI3IiwKICAgICAgInBsYXRmb3JtIjogImRlYmlhbi1vcGVuc3NsLTMuMC54IgogICAgfSwKICAgICJ2ZXJzaW9ucyI6IFsKICAgICAgewogICAgICAgICJuYW1lIjogImxpYnF1ZXJ5LWVuZ2luZSIsCiAgICAgICAgInBhdGgiOiAiL3dvcmtzcGFjZS9jcm9zc2RlY2stcjEzLW9yaWdpbmFsLXByb29mL25vZGVfbW9kdWxlcy9AcHJpc21hL2VuZ2luZXMvbGlicXVlcnlfZW5naW5lLWRlYmlhbi1vcGVuc3NsLTMuMC54LnNvLm5vZGUiLAogICAgICAgICJ2ZXJzaW9uIjogImMyOTkwZGNhNTkxY2JhNzY2ZTNiN2VmNWQ5ZThhODQ3OTZlNDdhYjciLAogICAgICAgICJjb21tYW5kIjogIi9vcHQvY29kZXgvcnVudGltZXMvY29kZXgtcHJpbWFyeS1ydW50aW1lL2RlcGVuZGVuY2llcy9ub2RlL2Jpbi9ub2RlIiwKICAgICAgICAiYXJndW1lbnRzIjogWwogICAgICAgICAgIi1lIiwKICAgICAgICAgICJjb25zdCBlbmdpbmUgPSByZXF1aXJlKHByb2Nlc3MuYXJndlsxXSk7IHByb2Nlc3Muc3Rkb3V0LndyaXRlKEpTT04uc3RyaW5naWZ5KHtjb21taXQ6IGVuZ2luZS52ZXJzaW9uKCkuY29tbWl0fSkgKyBcIlxcblwiKTsiLAogICAgICAgICAgIi93b3Jrc3BhY2UvY3Jvc3NkZWNrLXIxMy1vcmlnaW5hbC1wcm9vZi9ub2RlX21vZHVsZXMvQHByaXNtYS9lbmdpbmVzL2xpYnF1ZXJ5X2VuZ2luZS1kZWJpYW4tb3BlbnNzbC0zLjAueC5zby5ub2RlIgogICAgICAgIF0sCiAgICAgICAgInN0ZG91dCI6ICJ7XCJjb21taXRcIjpcImMyOTkwZGNhNTkxY2JhNzY2ZTNiN2VmNWQ5ZThhODQ3OTZlNDdhYjdcIn0iCiAgICAgIH0sCiAgICAgIHsKICAgICAgICAibmFtZSI6ICJzY2hlbWEtZW5naW5lIiwKICAgICAgICAicGF0aCI6ICIvd29ya3NwYWNlL2Nyb3NzZGVjay1yMTMtb3JpZ2luYWwtcHJvb2Yvbm9kZV9tb2R1bGVzL0BwcmlzbWEvZW5naW5lcy9zY2hlbWEtZW5naW5lLWRlYmlhbi1vcGVuc3NsLTMuMC54IiwKICAgICAgICAidmVyc2lvbiI6ICJzY2hlbWEtZW5naW5lLWNsaSBjMjk5MGRjYTU5MWNiYTc2NmUzYjdlZjVkOWU4YTg0Nzk2ZTQ3YWI3IiwKICAgICAgICAiY29tbWFuZCI6ICIvd29ya3NwYWNlL2Nyb3NzZGVjay1yMTMtb3JpZ2luYWwtcHJvb2Yvbm9kZV9tb2R1bGVzL0BwcmlzbWEvZW5naW5lcy9zY2hlbWEtZW5naW5lLWRlYmlhbi1vcGVuc3NsLTMuMC54IiwKICAgICAgICAiYXJndW1lbnRzIjogWwogICAgICAgICAgIi0tdmVyc2lvbiIKICAgICAgICBdLAogICAgICAgICJzdGRvdXQiOiAic2NoZW1hLWVuZ2luZS1jbGkgYzI5OTBkY2E1OTFjYmE3NjZlM2I3ZWY1ZDllOGE4NDc5NmU0N2FiNyIKICAgICAgfSwKICAgICAgewogICAgICAgICJuYW1lIjogImxpYnF1ZXJ5LWVuZ2luZSIsCiAgICAgICAgInBhdGgiOiAiL3dvcmtzcGFjZS9jcm9zc2RlY2stcjEzLW9yaWdpbmFsLXByb29mL25vZGVfbW9kdWxlcy9wcmlzbWEvbGlicXVlcnlfZW5naW5lLWRlYmlhbi1vcGVuc3NsLTMuMC54LnNvLm5vZGUiLAogICAgICAgICJ2ZXJzaW9uIjogImMyOTkwZGNhNTkxY2JhNzY2ZTNiN2VmNWQ5ZThhODQ3OTZlNDdhYjciLAogICAgICAgICJjb21tYW5kIjogIi9vcHQvY29kZXgvcnVudGltZXMvY29kZXgtcHJpbWFyeS1ydW50aW1lL2RlcGVuZGVuY2llcy9ub2RlL2Jpbi9ub2RlIiwKICAgICAgICAiYXJndW1lbnRzIjogWwogICAgICAgICAgIi1lIiwKICAgICAgICAgICJjb25zdCBlbmdpbmUgPSByZXF1aXJlKHByb2Nlc3MuYXJndlsxXSk7IHByb2Nlc3Muc3Rkb3V0LndyaXRlKEpTT04uc3RyaW5naWZ5KHtjb21taXQ6IGVuZ2luZS52ZXJzaW9uKCkuY29tbWl0fSkgKyBcIlxcblwiKTsiLAogICAgICAgICAgIi93b3Jrc3BhY2UvY3Jvc3NkZWNrLXIxMy1vcmlnaW5hbC1wcm9vZi9ub2RlX21vZHVsZXMvcHJpc21hL2xpYnF1ZXJ5X2VuZ2luZS1kZWJpYW4tb3BlbnNzbC0zLjAueC5zby5ub2RlIgogICAgICAgIF0sCiAgICAgICAgInN0ZG91dCI6ICJ7XCJjb21taXRcIjpcImMyOTkwZGNhNTkxY2JhNzY2ZTNiN2VmNWQ5ZThhODQ3OTZlNDdhYjdcIn0iCiAgICAgIH0sCiAgICAgIHsKICAgICAgICAibmFtZSI6ICJzY2hlbWEtZW5naW5lIiwKICAgICAgICAicGF0aCI6ICIvd29ya3NwYWNlL2Nyb3NzZGVjay1yMTMtb3JpZ2luYWwtcHJvb2Yvbm9kZV9tb2R1bGVzL3ByaXNtYS9zY2hlbWEtZW5naW5lLWRlYmlhbi1vcGVuc3NsLTMuMC54IiwKICAgICAgICAidmVyc2lvbiI6ICJzY2hlbWEtZW5naW5lLWNsaSBjMjk5MGRjYTU5MWNiYTc2NmUzYjdlZjVkOWU4YTg0Nzk2ZTQ3YWI3IiwKICAgICAgICAiY29tbWFuZCI6ICIvd29ya3NwYWNlL2Nyb3NzZGVjay1yMTMtb3JpZ2luYWwtcHJvb2Yvbm9kZV9tb2R1bGVzL3ByaXNtYS9zY2hlbWEtZW5naW5lLWRlYmlhbi1vcGVuc3NsLTMuMC54IiwKICAgICAgICAiYXJndW1lbnRzIjogWwogICAgICAgICAgIi0tdmVyc2lvbiIKICAgICAgICBdLAogICAgICAgICJzdGRvdXQiOiAic2NoZW1hLWVuZ2luZS1jbGkgYzI5OTBkY2E1OTFjYmE3NjZlM2I3ZWY1ZDllOGE4NDc5NmU0N2FiNyIKICAgICAgfQogICAgXSwKICAgICJjb21wbGV0ZWRBdCI6ICIyMDI2LTEwLTE3VDAzOjQxOjI3Ljc0N1oiCiAgfSwKICAiYnJvd3NlciI6IHsKICAgICJ2ZXJzaW9uIjogMSwKICAgICJiaW5kaW5nIjogewogICAgICAidmVyc2lvbiI6IDEsCiAgICAgICJleGNlcHRpb25JZCI6ICJQRS1YLUNST1NTREVDSy1GSU5BTC1WRVJJRlktMjAyNjEwMTUtUjEzIiwKICAgICAgInJlY29yZERpZ2VzdCI6ICJhNjY4OWViYWI0OTBlZDgxZjMxM2NmNGJjNWUyZTU5NzE4MWMwMTJhZDQzNjQ1MTIwNjk4YjJmYWVmMDk3MzU5IiwKICAgICAgImJhc2VTaGEiOiAiOTg2YWEwMDAyNzExYTQzYjQyNTYwMGYwMzgwM2ZhZTNkNWI5OTA2ZiIsCiAgICAgICJjYW5kaWRhdGVTaGEiOiAiNTM2MDFlOWUzODZiYjRmMTA2MjcxOWJlZmM3N2I3Nzc4YjllNDQzMCIsCiAgICAgICJjYW5kaWRhdGVUcmVlIjogIjg1ZTlhY2NjMWQyNzNkMGY2NDkxMTkzODBkNzc1ZGY0MWU2ZGNmMGEiLAogICAgICAic291cmNlRGlnZXN0IjogIjNlNjljMjMwNjQ0Mjc1OGVkY2E0MTdmZGI0NzhmMWE2MWUwMDlmMWNiYzgyZDU4NGJjYWQ2ZTc2MDI1N2RmMGYiLAogICAgICAiY29udHJhY3REaWdlc3QiOiAiMzNiNzYyMTI2OWZhMTg0MTdjMjA3MTNjY2MxODU3ODM4NjFlZjA0M2UzOGE1MjdmNzI3ZGY3ZTEwNDdjNzI3NCIsCiAgICAgICJzb3VyY2VNYW5pZmVzdFNoYTI1NiI6ICJmNGExZmViYTZiMjQyMjM4NTJiYTY5ODM3ZGI5N2U4ZGU1YjVkZDVmNDVjMTYyMDVhY2Q2ZTYyN2ZiZjkzMGE5IiwKICAgICAgImVudmlyb25tZW50RGlnZXN0IjogImYyYzUzYTdlNjdlYzVkMTI3MzkzY2VlZDQ4NzUxMGVkYWIyYTNhMjI1YjFiZjgzZGNkZGQ3NGVlMjRmNThhOWMiLAogICAgICAic3RhZ2UiOiAib3JpZ2luYWwiLAogICAgICAibWFuaWZlc3RTaGEyNTYiOiAiY2E0NDE0ODc3ZjM3YjUwMGFkZmJlNTIxYTczN2Q5YWI1ZWVlOTJlMWI2NjIyMjBlYzM4N2IwOGQ0OWNiMzZmYyIsCiAgICAgICJhdHRlbXB0IjogMSwKICAgICAgImxlYXNlIjogIjg3MDg2MzY1LTRjMDMtNGE2ZC1hOGJiLTk4Nzg2MGMzZGZlMCIKICAgIH0sCiAgICAiY2xhc3NpZmljYXRpb24iOiAiRklOSVRFX0lORlJBU1RSVUNUVVJFX1JFQURJTkVTU19OT19QUk9EVUNUX0pPVVJORVlTIiwKICAgICJzdGF0dXMiOiAiRkFJTCIsCiAgICAicHJvYmUiOiAiQ0hST01JVU1fTEFVTkNIX0NMT1NFX1dJVEhPVVRfUEFHRSIsCiAgICAiY29udGV4dHMiOiAwLAogICAgInBhZ2VzIjogMCwKICAgICJjYXB0dXJlcyI6IDAsCiAgICAic3RhcnRlZEF0IjogIjIwMjYtMTAtMTdUMDM6NDQ6MDIuNTcxWiIsCiAgICAiZXJyb3IiOiB7CiAgICAgICJuYW1lIjogIkVycm9yIiwKICAgICAgIm1lc3NhZ2UiOiAiUFJPRFVDVF9FWFBFUklFTkNFX0RFUEVOREVOQ1lfUkVBRElORVNTX1JFR1VMQVJfRklMRV9SRVFVSVJFRCIsCiAgICAgICJzdGFjayI6ICJFcnJvcjogUFJPRFVDVF9FWFBFUklFTkNFX0RFUEVOREVOQ1lfUkVBRElORVNTX1JFR1VMQVJfRklMRV9SRVFVSVJFRFxuICAgIGF0IGZhaWwgKGZpbGU6Ly8vd29ya3NwYWNlL2Nyb3NzZGVjay1jbG91ZC1pbnRlZ3JhdGlvbi9zY3JpcHRzL3NvdW5kaW5nLWxpbmUvZXhwZXJpZW5jZS1kZXBlbmRlbmN5LXJlYWRpbmVzcy5tanM6NjY6OSlcbiAgICBhdCBieXRlcyAoZmlsZTovLy93b3Jrc3BhY2UvY3Jvc3NkZWNrLWNsb3VkLWludGVncmF0aW9uL3NjcmlwdHMvc291bmRpbmctbGluZS9leHBlcmllbmNlLWRlcGVuZGVuY3ktcmVhZGluZXNzLm1qczoxMDA6MzQpXG4gICAgYXQgcHVibGljRmlsZSAoZmlsZTovLy93b3Jrc3BhY2UvY3Jvc3NkZWNrLWNsb3VkLWludGVncmF0aW9uL3NjcmlwdHMvc291bmRpbmctbGluZS9leHBlcmllbmNlLWRlcGVuZGVuY3ktcmVhZGluZXNzLm1qczo0NDI6MzcpXG4gICAgYXQgc3lzdGVtTGlicmFyeU1ldGFkYXRhIChmaWxlOi8vL3dvcmtzcGFjZS9jcm9zc2RlY2stY2xvdWQtaW50ZWdyYXRpb24vc2NyaXB0cy9zb3VuZGluZy1saW5lL2V4cGVyaWVuY2UtZGVwZW5kZW5jeS1yZWFkaW5lc3MubWpzOjU5MTo0OClcbiAgICBhdCBydW5Ccm93c2VyRGVwZW5kZW5jeVByb2JlIChmaWxlOi8vL3dvcmtzcGFjZS9jcm9zc2RlY2stY2xvdWQtaW50ZWdyYXRpb24vc2NyaXB0cy9zb3VuZGluZy1saW5lL2V4cGVyaWVuY2UtZGVwZW5kZW5jeS1yZWFkaW5lc3MubWpzOjY5NjoxNSlcbiAgICBhdCBmaWxlOi8vL3dvcmtzcGFjZS9jcm9zc2RlY2stY2xvdWQtaW50ZWdyYXRpb24vc2NyaXB0cy9zb3VuZGluZy1saW5lL3J1bi1icm93c2VyLXN1aXRlLm1qczoxMzQ6MTEiCiAgICB9LAogICAgImNvbXBsZXRlZEF0IjogIjIwMjYtMTAtMTdUMDM6NDQ6MDQuOTg3WiIKICB9LAogICJzZXR1cCI6IFsKICAgIHsKICAgICAgImlkIjogInByaXNtYS1nZW5lcmF0ZSIsCiAgICAgICJzdGF0dXMiOiAiUEFTUyIsCiAgICAgICJjb21tYW5kIjogIi9vcHQvY29kZXgvcnVudGltZXMvY29kZXgtcHJpbWFyeS1ydW50aW1lL2RlcGVuZGVuY2llcy9ub2RlL2Jpbi9ub2RlIiwKICAgICAgImFyZ3VtZW50cyI6IFsKICAgICAgICAibm9kZV9tb2R1bGVzL3ByaXNtYS9idWlsZC9pbmRleC5qcyIsCiAgICAgICAgImdlbmVyYXRlIiwKICAgICAgICAiLS1zY2hlbWEiLAogICAgICAgICJwcmlzbWEvc2NoZW1hLnNxbGl0ZS5wcmlzbWEiCiAgICAgIF0sCiAgICAgICJleGl0Q29kZSI6IDAsCiAgICAgICJlcnJvciI6IG51bGwKICAgIH0sCiAgICB7CiAgICAgICJpZCI6ICJzcWxpdGUtYm9vdHN0cmFwIiwKICAgICAgInN0YXR1cyI6ICJQQVNTIiwKICAgICAgImNvbW1hbmQiOiAiL29wdC9jb2RleC9ydW50aW1lcy9jb2RleC1wcmltYXJ5LXJ1bnRpbWUvZGVwZW5kZW5jaWVzL25vZGUvYmluL25vZGUiLAogICAgICAiYXJndW1lbnRzIjogWwogICAgICAgICJzY3JpcHRzL3NvdW5kaW5nLWxpbmUvc3FsaXRlLWJvb3RzdHJhcC5tanMiLAogICAgICAgICItLWRhdGFiYXNlLXVybCIsCiAgICAgICAgImZpbGU6L3dvcmtzcGFjZS9jcm9zc2RlY2stcjEzLW9yaWdpbmFsLXByb29mL2FydGlmYWN0cy9zb3VuZGluZy1saW5lL2dlbmVyaWMtNTM2MDFlOWUzODZiL3ZhbGlkYXRpb24taXNvbGF0ZWQtMjAyNjEwMTctMDM0MTI1NjM3LTY1ODRhZjc3NjlkNzQ0MDI5NmNkNDNmZDc0MWE1MWZiLmRiIgogICAgICBdLAogICAgICAiZXhpdENvZGUiOiAwLAogICAgICAiZXJyb3IiOiBudWxsCiAgICB9LAogICAgewogICAgICAiaWQiOiAic2VlZCIsCiAgICAgICJzdGF0dXMiOiAiUEFTUyIsCiAgICAgICJjb21tYW5kIjogIi9vcHQvY29kZXgvcnVudGltZXMvY29kZXgtcHJpbWFyeS1ydW50aW1lL2RlcGVuZGVuY2llcy9ub2RlL2Jpbi9ub2RlIiwKICAgICAgImFyZ3VtZW50cyI6IFsKICAgICAgICAibm9kZV9tb2R1bGVzL3RzeC9kaXN0L2NsaS5tanMiLAogICAgICAgICJwcmlzbWEvc2VlZC50cyIKICAgICAgXSwKICAgICAgImV4aXRDb2RlIjogMCwKICAgICAgImVycm9yIjogbnVsbAogICAgfSwKICAgIHsKICAgICAgImlkIjogIm1pZ3JhdGUtbGVnYWN5LWNvbXBhbmlvbiIsCiAgICAgICJzdGF0dXMiOiAiUEFTUyIsCiAgICAgICJjb21tYW5kIjogIi9vcHQvY29kZXgvcnVudGltZXMvY29kZXgtcHJpbWFyeS1ydW50aW1lL2RlcGVuZGVuY2llcy9ub2RlL2Jpbi9ub2RlIiwKICAgICAgImFyZ3VtZW50cyI6IFsKICAgICAgICAibm9kZV9tb2R1bGVzL3RzeC9kaXN0L2NsaS5tanMiLAogICAgICAgICJzY3JpcHRzL21pZ3JhdGUtbGVnYWN5LWNvbXBhbmlvbi50cyIKICAgICAgXSwKICAgICAgImV4aXRDb2RlIjogMCwKICAgICAgImVycm9yIjogbnVsbAogICAgfSwKICAgIHsKICAgICAgImlkIjogInByZXBhcmUtdmFsaWRhdGlvbi1pc29sYXRpb24iLAogICAgICAic3RhdHVzIjogIlBBU1MiLAogICAgICAiY29tbWFuZCI6ICIvb3B0L2NvZGV4L3J1bnRpbWVzL2NvZGV4LXByaW1hcnktcnVudGltZS9kZXBlbmRlbmNpZXMvbm9kZS9iaW4vbm9kZSIsCiAgICAgICJhcmd1bWVudHMiOiBbCiAgICAgICAgInNjcmlwdHMvc291bmRpbmctbGluZS9wcmVwYXJlLXZhbGlkYXRpb24taXNvbGF0aW9uLm1qcyIKICAgICAgXSwKICAgICAgImV4aXRDb2RlIjogMCwKICAgICAgImVycm9yIjogbnVsbAogICAgfSwKICAgIHsKICAgICAgImlkIjogIm5leHQtYnVpbGQiLAogICAgICAic3RhdHVzIjogIlBBU1MiLAogICAgICAiY29tbWFuZCI6ICIvb3B0L2NvZGV4L3J1bnRpbWVzL2NvZGV4LXByaW1hcnktcnVudGltZS9kZXBlbmRlbmNpZXMvbm9kZS9iaW4vbm9kZSIsCiAgICAgICJhcmd1bWVudHMiOiBbCiAgICAgICAgIm5vZGVfbW9kdWxlcy9uZXh0L2Rpc3QvYmluL25leHQiLAogICAgICAgICJidWlsZCIKICAgICAgXSwKICAgICAgImV4aXRDb2RlIjogMCwKICAgICAgImVycm9yIjogbnVsbAogICAgfQogIF0sCiAgInNldHVwU3RhdHVzIjogIkZBSUwiLAogICJjbGVhbnVwIjogewogICAgInN0YXR1cyI6ICJQQVNTIiwKICAgICJkaXJlY3RFeGl0T2JzZXJ2ZWQiOiB0cnVlLAogICAgImV4aXRDb2RlIjogMSwKICAgICJzaWduYWwiOiBudWxsLAogICAgInRyZWVSZWFwZWQiOiB0cnVlLAogICAgInN0cmVhbXNDbG9zZWQiOiB0cnVlLAogICAgImVzY2FsYXRlZCI6IGZhbHNlLAogICAgInBheWxvYWRFeGl0Q29kZSI6IDEsCiAgICAiZWxhcHNlZE1zIjogNSwKICAgICJvd25lcnNoaXAiOiAiTElOVVhfU1VCUkVBUEVSX0FORF9QSURGRCIKICB9LAogICJjb250ZXh0IjogewogICAgInZlcnNpb24iOiAxLAogICAgImJpbmRpbmciOiB7CiAgICAgICJ2ZXJzaW9uIjogMSwKICAgICAgImV4Y2VwdGlvbklkIjogIlBFLVgtQ1JPU1NERUNLLUZJTkFMLVZFUklGWS0yMDI2MTAxNS1SMTMiLAogICAgICAicmVjb3JkRGlnZXN0IjogImE2Njg5ZWJhYjQ5MGVkODFmMzEzY2Y0YmM1ZTJlNTk3MTgxYzAxMmFkNDM2NDUxMjA2OThiMmZhZWYwOTczNTkiLAogICAgICAiYmFzZVNoYSI6ICI5ODZhYTAwMDI3MTFhNDNiNDI1NjAwZjAzODAzZmFlM2Q1Yjk5MDZmIiwKICAgICAgImNhbmRpZGF0ZVNoYSI6ICI1MzYwMWU5ZTM4NmJiNGYxMDYyNzE5YmVmYzc3Yjc3NzhiOWU0NDMwIiwKICAgICAgImNhbmRpZGF0ZVRyZWUiOiAiODVlOWFjY2MxZDI3M2QwZjY0OTExOTM4MGQ3NzVkZjQxZTZkY2YwYSIsCiAgICAgICJzb3VyY2VEaWdlc3QiOiAiM2U2OWMyMzA2NDQyNzU4ZWRjYTQxN2ZkYjQ3OGYxYTYxZTAwOWYxY2JjODJkNTg0YmNhZDZlNzYwMjU3ZGYwZiIsCiAgICAgICJjb250cmFjdERpZ2VzdCI6ICIzM2I3NjIxMjY5ZmExODQxN2MyMDcxM2NjYzE4NTc4Mzg2MWVmMDQzZTM4YTUyN2Y3MjdkZjdlMTA0N2M3Mjc0IiwKICAgICAgInNvdXJjZU1hbmlmZXN0U2hhMjU2IjogImY0YTFmZWJhNmIyNDIyMzg1MmJhNjk4MzdkYjk3ZThkZTViNWRkNWY0NWMxNjIwNWFjZDZlNjI3ZmJmOTMwYTkiLAogICAgICAiZW52aXJvbm1lbnREaWdlc3QiOiAiZjJjNTNhN2U2N2VjNWQxMjczOTNjZWVkNDg3NTEwZWRhYjJhM2EyMjViMWJmODNkY2RkZDc0ZWUyNGY1OGE5YyIsCiAgICAgICJzdGFnZSI6ICJvcmlnaW5hbCIsCiAgICAgICJtYW5pZmVzdFNoYTI1NiI6ICJjYTQ0MTQ4NzdmMzdiNTAwYWRmYmU1MjFhNzM3ZDlhYjVlZWU5MmUxYjY2MjIyMGVjMzg3YjA4ZDQ5Y2IzNmZjIiwKICAgICAgImF0dGVtcHQiOiAxLAogICAgICAibGVhc2UiOiAiODcwODYzNjUtNGMwMy00YTZkLWE4YmItOTg3ODYwYzNkZmUwIgogICAgfSwKICAgICJkYXRhYmFzZVVybCI6ICJmaWxlOi93b3Jrc3BhY2UvY3Jvc3NkZWNrLXIxMy1vcmlnaW5hbC1wcm9vZi9hcnRpZmFjdHMvc291bmRpbmctbGluZS9nZW5lcmljLTUzNjAxZTllMzg2Yi92YWxpZGF0aW9uLWlzb2xhdGVkLTIwMjYxMDE3LTAzNDEyNTYzNy02NTg0YWY3NzY5ZDc0NDAyOTZjZDQzZmQ3NDFhNTFmYi5kYiIsCiAgICAicHJvZmlsZUNvbnRleHRTaGEyNTYiOiAiZWJmNjFiOTRjN2I0NzM3MzZjNWYxZjRhY2U4YzA0MjkzOWUxOTk2ZTgwYzc3YjMzZGI3YzEzZjczNTY2MTE5YyIsCiAgICAiZW52aXJvbm1lbnRTaGEyNTYiOiAiYjkwMmRkN2U3ZTIwNTcxNzc3YzBjZDY3MmJjZTJkNDljNGZkYzhhZWM1NWE4MWI5ZDNmNzIwNmM3ODVhMDQ4MiIsCiAgICAiZW52aXJvbm1lbnRLZXlzIjogWwogICAgICAiREFUQUJBU0VfVVJMIiwKICAgICAgIkZPUkVWRVJfVkFMSURBVElPTl9JU09MQVRJT04iLAogICAgICAiRk9SRVZFUl9WQUxJREFUSU9OX05PTkNFX0hBU0giLAogICAgICAiRk9SRVZFUl9WQUxJREFUSU9OX1BST0RVQ1RJT05fSURFTlRJVFkiLAogICAgICAiR01fUEFTU1dPUkQiLAogICAgICAiR01fVVNFUk5BTUUiLAogICAgICAiSE9NRSIsCiAgICAgICJIT01FUE9SVF9QSEFTRTdfVEFTS19ST09UIiwKICAgICAgIkhPTUVQT1JUX1NZTlRIRVRJQ19FTUFJTF9BREFQVEVSIiwKICAgICAgIkhPTUVQT1JUX1NZTlRIRVRJQ19PVVRCT1hfUEFUSCIsCiAgICAgICJIT01FUE9SVF9UUkFOU0FDVElPTkFMX0VNQUlMX1BST1ZJREVSIiwKICAgICAgIlBBVEgiLAogICAgICAiUEhBU0UyX0xFR0FDWV9BQ0NFU1NfQ09ERSIsCiAgICAgICJQTEFZV1JJR0hUX0JST1dTRVJTX1BBVEgiLAogICAgICAiU09VTkRJTkdfTElORV9JTlRFUk5BTF9SVU5USU1FIiwKICAgICAgIlNPVU5ESU5HX0xJTkVfU1VJVEVfUFJPRklMRSIsCiAgICAgICJTT1VORElOR19MSU5FX1RBU0tfT1dORURfSFRUUCIsCiAgICAgICJWQUxJREFUSU9OX0FSVElGQUNUUyIKICAgIF0KICB9LAogICJkZXBlbmRlbmN5VHJlZVNoYTI1NiI6IG51bGwsCiAgIm91dHB1dEVycm9ycyI6IFsKICAgIHsKICAgICAgImtleSI6ICJkZXBlbmRlbmN5TWFuaWZlc3QiLAogICAgICAibmFtZSI6ICJFcnJvciIsCiAgICAgICJtZXNzYWdlIjogIlBST0RVQ1RfRVhQRVJJRU5DRV9ERVBFTkRFTkNZX1JFQURJTkVTU19ERVBFTkRFTkNZX1NZTUxJTktfRVNDQVBFUyIsCiAgICAgICJzdGFjayI6ICJFcnJvcjogUFJPRFVDVF9FWFBFUklFTkNFX0RFUEVOREVOQ1lfUkVBRElORVNTX0RFUEVOREVOQ1lfU1lNTElOS19FU0NBUEVTXG4gICAgYXQgZmFpbCAoZmlsZTovLy93b3Jrc3BhY2UvY3Jvc3NkZWNrLWNsb3VkLWludGVncmF0aW9uL3NjcmlwdHMvc291bmRpbmctbGluZS9leHBlcmllbmNlLWRlcGVuZGVuY3ktcmVhZGluZXNzLm1qczo2Njo5KVxuICAgIGF0IHZpc2l0IChmaWxlOi8vL3dvcmtzcGFjZS9jcm9zc2RlY2stY2xvdWQtaW50ZWdyYXRpb24vc2NyaXB0cy9zb3VuZGluZy1saW5lL2V4cGVyaWVuY2UtZGVwZW5kZW5jeS1yZWFkaW5lc3MubWpzOjYwNjo3MylcbiAgICBhdCB2aXNpdCAoZmlsZTovLy93b3Jrc3BhY2UvY3Jvc3NkZWNrLWNsb3VkLWludGVncmF0aW9uL3NjcmlwdHMvc291bmRpbmctbGluZS9leHBlcmllbmNlLWRlcGVuZGVuY3ktcmVhZGluZXNzLm1qczo2MjA6NTIpXG4gICAgYXQgdmlzaXQgKGZpbGU6Ly8vd29ya3NwYWNlL2Nyb3NzZGVjay1jbG91ZC1pbnRlZ3JhdGlvbi9zY3JpcHRzL3NvdW5kaW5nLWxpbmUvZXhwZXJpZW5jZS1kZXBlbmRlbmN5LXJlYWRpbmVzcy5tanM6NjIwOjUyKVxuICAgIGF0IHJlYWRpbmVzc0RlcGVuZGVuY3lNYW5pZmVzdCAoZmlsZTovLy93b3Jrc3BhY2UvY3Jvc3NkZWNrLWNsb3VkLWludGVncmF0aW9uL3NjcmlwdHMvc291bmRpbmctbGluZS9leHBlcmllbmNlLWRlcGVuZGVuY3ktcmVhZGluZXNzLm1qczo2MzA6NTIpXG4gICAgYXQgZmlsZTovLy93b3Jrc3BhY2UvY3Jvc3NkZWNrLWNsb3VkLWludGVncmF0aW9uL3NjcmlwdHMvc291bmRpbmctbGluZS9leHBlcmllbmNlLWRlcGVuZGVuY3ktcmVhZGluZXNzLm1qczo4ODc6MzFcbiAgICBhdCBjYXB0dXJlIChmaWxlOi8vL3dvcmtzcGFjZS9jcm9zc2RlY2stY2xvdWQtaW50ZWdyYXRpb24vc2NyaXB0cy9zb3VuZGluZy1saW5lL2V4cGVyaWVuY2UtZGVwZW5kZW5jeS1yZWFkaW5lc3MubWpzOjg2MjoxNClcbiAgICBhdCBjb21wbGV0ZVJlYWRpbmVzc0F0dGVtcHQgKGZpbGU6Ly8vd29ya3NwYWNlL2Nyb3NzZGVjay1jbG91ZC1pbnRlZ3JhdGlvbi9zY3JpcHRzL3NvdW5kaW5nLWxpbmUvZXhwZXJpZW5jZS1kZXBlbmRlbmN5LXJlYWRpbmVzcy5tanM6ODg2OjMwKVxuICAgIGF0IE9iamVjdC5wcmVmbGlnaHQgKGZpbGU6Ly8vd29ya3NwYWNlL2Nyb3NzZGVjay1jbG91ZC1pbnRlZ3JhdGlvbi9zY3JpcHRzL3NvdW5kaW5nLWxpbmUvZXhwZXJpZW5jZS10ZWNobmljYWwtcHJvb2YubWpzOjk0NDoxMilcbiAgICBhdCBhc3luYyBmaWxlOi8vL3dvcmtzcGFjZS9jcm9zc2RlY2stY2xvdWQtaW50ZWdyYXRpb24vc2NyaXB0cy9zb3VuZGluZy1saW5lL2V4cGVyaWVuY2UtcjEzLXRlY2huaWNhbC1wcm9vZi5tanM6MzM6MTEiCiAgICB9CiAgXSwKICAidW5wYXJzZWRPdXRwdXRzIjogWwogICAgImRlcGVuZGVuY3lNYW5pZmVzdCIKICBdLAogICJleGVjdXRpb24iOiB7CiAgICAiZXhpdENvZGUiOiAxLAogICAgImNhbmNlbGxlZCI6IGZhbHNlLAogICAgImNsZWFudXAiOiB7CiAgICAgICJzdGF0dXMiOiAiUEFTUyIsCiAgICAgICJkaXJlY3RFeGl0T2JzZXJ2ZWQiOiB0cnVlLAogICAgICAiZXhpdENvZGUiOiAxLAogICAgICAic2lnbmFsIjogbnVsbCwKICAgICAgInRyZWVSZWFwZWQiOiB0cnVlLAogICAgICAic3RyZWFtc0Nsb3NlZCI6IHRydWUsCiAgICAgICJlc2NhbGF0ZWQiOiBmYWxzZSwKICAgICAgInBheWxvYWRFeGl0Q29kZSI6IDEsCiAgICAgICJlbGFwc2VkTXMiOiA1LAogICAgICAib3duZXJzaGlwIjogIkxJTlVYX1NVQlJFQVBFUl9BTkRfUElERkQiCiAgICB9CiAgfSwKICAiZmlsZXMiOiB7CiAgICAibWFya2VyIjogewogICAgICAicGF0aCI6ICIvd29ya3NwYWNlL2Nyb3NzZGVjay1jbG91ZC1zb3VyY2UvLmdpdC9zb3VuZGluZy1saW5lL2Nyb3NzZGVjay1yMTMtcmVhZGluZXNzLW9yaWdpbmFsLTEubWFya2VyLmpzb24iLAogICAgICAic2hhMjU2IjogIjVlNjVjOTQxNzQ5ZGY5NzkyNDdmNmRlNDI0NGQ2OGYzYmUxN2ZlZDVlMzRkMTkyYmE4ZGI3YmY0Zjk3MTQ5OWEiCiAgICB9LAogICAgImxhdW5jaCI6IHsKICAgICAgInBhdGgiOiAiL3dvcmtzcGFjZS9jcm9zc2RlY2stY2xvdWQtc291cmNlLy5naXQvc291bmRpbmctbGluZS9jcm9zc2RlY2stcjEzLXJlYWRpbmVzcy1vcmlnaW5hbC0xLmxhdW5jaC5qc29uIiwKICAgICAgInNoYTI1NiI6ICI3NWFjNjMzZmQ3ZWM0YjNmNzUwMTk5M2FjY2I4ZjkyM2ZjMWNiM2YwYzk0NjBlYTRiYWFkZmE0NWZlYWM5MTU4IgogICAgfSwKICAgICJjb250ZXh0U2VhbCI6IHsKICAgICAgInBhdGgiOiAiL3dvcmtzcGFjZS9jcm9zc2RlY2stcjEzLW9yaWdpbmFsLXByb29mL2FydGlmYWN0cy9zb3VuZGluZy1saW5lL2RlcGVuZGVuY3ktcmVhZGluZXNzL29yaWdpbmFsL2F0dGVtcHQtMS9wcm9maWxlLWNvbnRleHQuc2VhbC5qc29uIiwKICAgICAgInNoYTI1NiI6ICI4ZWU0NDc2MTkxODQ0ODMxNmY5ZGFlNmY1MDg1YmY2N2IzOTRkMDcyYjlkNWJmMjE0NzdhNzhhOTFmYzE0Njg1IgogICAgfSwKICAgICJuYXRpdmVSZWNlaXB0IjogewogICAgICAicGF0aCI6ICIvd29ya3NwYWNlL2Nyb3NzZGVjay1yMTMtb3JpZ2luYWwtcHJvb2YvYXJ0aWZhY3RzL3NvdW5kaW5nLWxpbmUvZGVwZW5kZW5jeS1yZWFkaW5lc3Mvb3JpZ2luYWwvYXR0ZW1wdC0xL25hdGl2ZS1kZXBlbmRlbmNpZXMuanNvbiIsCiAgICAgICJzaGEyNTYiOiAiYTE5YjVkMzlkYjc1Zjg4OWMwZjhhNTFiYmFjYjJiNTI3MTEzMjBjOGE4M2ZjMzQxZjg5NGU2ZjVhYTM0N2FkZSIKICAgIH0sCiAgICAiYnJvd3NlclJlY2VpcHQiOiB7CiAgICAgICJwYXRoIjogIi93b3Jrc3BhY2UvY3Jvc3NkZWNrLXIxMy1vcmlnaW5hbC1wcm9vZi9hcnRpZmFjdHMvc291bmRpbmctbGluZS9kZXBlbmRlbmN5LXJlYWRpbmVzcy9vcmlnaW5hbC9hdHRlbXB0LTEvYnJvd3Nlci1kZXBlbmRlbmNpZXMuanNvbiIsCiAgICAgICJzaGEyNTYiOiAiN2U0ZTZiYzNhYWU1YTU3ZTVmOThjN2FjNDEzMTRlMTUyMTllNmIxZTRjZTI5MDZlYzkyZDI1ZTA0ZmVlNWJlNyIKICAgIH0sCiAgICAic2V0dXBSZWNlaXB0IjogewogICAgICAicGF0aCI6ICIvd29ya3NwYWNlL2Nyb3NzZGVjay1yMTMtb3JpZ2luYWwtcHJvb2YvYXJ0aWZhY3RzL3NvdW5kaW5nLWxpbmUvZGVwZW5kZW5jeS1yZWFkaW5lc3Mvb3JpZ2luYWwvYXR0ZW1wdC0xL2dlbmVyaWMtc2V0dXAuanNvbiIsCiAgICAgICJzaGEyNTYiOiAiOTE1ZjBkN2U5ZGJiNWZhMTE0YjI1YjFiNTZjMTU1ZDBmM2U0YTFkZjdhNTRhNDY3YjU3YjBiM2ZiNjgyMTIyNSIKICAgIH0sCiAgICAic3Rkb3V0IjogewogICAgICAicGF0aCI6ICIvd29ya3NwYWNlL2Nyb3NzZGVjay1yMTMtb3JpZ2luYWwtcHJvb2YvYXJ0aWZhY3RzL3NvdW5kaW5nLWxpbmUvZGVwZW5kZW5jeS1yZWFkaW5lc3Mvb3JpZ2luYWwvYXR0ZW1wdC0xL3NldHVwLnN0ZG91dC50eHQiLAogICAgICAic2hhMjU2IjogIjE5Zjc2ZWMyNTExNjI3ODAyZWEyYzVkNjc3ODg5OGIyY2IzYmI1MzgzMTVmN2ZmOGVjNGUxODg3OWM2ZTVjMzMiCiAgICB9LAogICAgInN0ZGVyciI6IHsKICAgICAgInBhdGgiOiAiL3dvcmtzcGFjZS9jcm9zc2RlY2stcjEzLW9yaWdpbmFsLXByb29mL2FydGlmYWN0cy9zb3VuZGluZy1saW5lL2RlcGVuZGVuY3ktcmVhZGluZXNzL29yaWdpbmFsL2F0dGVtcHQtMS9zZXR1cC5zdGRlcnIudHh0IiwKICAgICAgInNoYTI1NiI6ICIzMTlkYThhMGIyOWUxNDNmNWQ1NTMzMTk3MzM1OGExZjQxODNjZDNmNzk1Mzg3NmY4YWM3ZmVhMDY1ZmExNGE3IgogICAgfQogIH0KfQo=",
    "base64",
  ),
};

test("only the exact spent collector failure identity can cross a protected base change", () => {
  const old = JSON.parse(collectorFailureBytes.markerBytes);
  const currentBinding = { ...old.binding, baseSha: "a".repeat(40) };
  assert.equal(isPreservedCollectorFailure({ currentBinding, ...collectorFailureBytes }), true);
  for (const binding of [
    { ...currentBinding, baseSha: old.binding.baseSha },
    { ...currentBinding, baseSha: "invalid" },
    { ...currentBinding, recordDigest: "0".repeat(64) },
    { ...currentBinding, contractDigest: "0".repeat(64) },
    { ...currentBinding, environmentDigest: "0".repeat(64) },
    { ...currentBinding, exceptionId: "PE-X-CROSSDECK-FINAL-VERIFY-20261015-R12" },
  ])
    assert.equal(isPreservedCollectorFailure({ currentBinding: binding, ...collectorFailureBytes }), false);
  for (const key of ["markerBytes", "launchBytes", "receiptBytes"])
    assert.equal(
      isPreservedCollectorFailure({
        currentBinding,
        ...collectorFailureBytes,
        [key]: Buffer.concat([collectorFailureBytes[key], Buffer.from("\n")]),
      }),
      false,
    );
  for (const [key, mutate] of [
    [
      "markerBytes",
      (value) => {
        value.attempt = 2;
      },
    ],
    [
      "markerBytes",
      (value) => {
        value.stage = "corrected";
      },
    ],
    [
      "launchBytes",
      (value) => {
        value.binding.baseSha = currentBinding.baseSha;
      },
    ],
    [
      "receiptBytes",
      (value) => {
        value.status = "PASS";
      },
    ],
    [
      "receiptBytes",
      (value) => {
        value.cleanup.status = "FAIL";
      },
    ],
  ]) {
    const value = JSON.parse(collectorFailureBytes[key]);
    mutate(value);
    assert.equal(
      isPreservedCollectorFailure({
        currentBinding,
        ...collectorFailureBytes,
        [key]: Buffer.from(JSON.stringify(value, null, 2) + "\n"),
      }),
      false,
    );
  }
});

test("an unpinned failed attempt cannot cross a base change or create another reservation", (t) => {
  const f = fixture(t),
    attempt = beginReadinessAttempt(f);
  completeReadinessAttempt({ attempt, status: "UNKNOWN", error: Error("synthetic old failure") });
  write(path.join(f.root, "src/example.ts"), "export const synthetic = 2;\n");
  f.git("add", "src/example.ts");
  f.git("commit", "-qm", "synthetic new base");
  const changed = { ...f, baseSha: f.git("rev-parse", "HEAD") };
  assert.throws(() => beginReadinessAttempt(changed), /CAMPAIGN_CHANGED/u);
  assert.throws(() => requireLatestReadinessPASS(changed), /HISTORY_NOT_TERMINAL/u);
  assert.equal(existsSync(attempt.paths.marker.replace("original-1.", "original-2.")), false);
});

test("fixed OS metadata records the standard release symlink while dependency links stay contained", (t) => {
  const metadata = osReleaseMetadata();
  if (existsSync("/etc/os-release")) {
    assert.ok(metadata);
    if (lstatSync("/etc/os-release").isSymbolicLink()) {
      assert.equal(metadata.path, "/etc/os-release");
      assert.equal(metadata.type, "symlink");
      assert.equal(metadata.target, readlinkSync("/etc/os-release"));
      assert.equal(metadata.resolved.path, realpathSync("/etc/os-release"));
      assert.equal(metadata.resolved.sha256, hash(readFileSync(metadata.resolved.path)));
      assert.equal(lstatSync(metadata.resolved.path).isFile(), true);
    } else assert.deepEqual(metadata, { path: "/etc/os-release", sha256: hash(readFileSync("/etc/os-release")) });
  } else assert.equal(metadata, null);
  const f = fixture(t);
  write(path.join(f.root, "outside-node-modules.txt"), "synthetic outside dependency tree\n");
  symlinkSync("../outside-node-modules.txt", path.join(f.root, "node_modules/external-link"));
  assert.throws(() => readinessDependencyManifest(f.root), /DEPENDENCY_SYMLINK_ESCAPES/u);
});
