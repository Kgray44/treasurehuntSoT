// Inert synthetic proof fixtures only: no application, browser, custody or workflow.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  R12_TECHNICAL,
  inspectR12TechnicalReport,
  r12TechnicalBrowserArguments,
  r12TechnicalEnvironment,
  r12TechnicalExitCode,
  r12TechnicalMarkerPath,
  r12TechnicalSourceManifest,
  r12TechnicalSuiteArguments,
  requireR12TechnicalSuite,
  runR12TechnicalProof,
  validateR12FocusedReceipt,
} from "../../scripts/sounding-line/experience-r12-technical-proof.mjs";
import { writeBrowserDiagnosticReceipt } from "../../scripts/sounding-line/browser-diagnostics.mjs";

const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const write = (file, value) => {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, typeof value === "string" || Buffer.isBuffer(value) ? value : JSON.stringify(value));
};
function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), "r12-focused-synthetic-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  git("init", "-q");
  git("config", "user.name", "Synthetic test");
  git("config", "user.email", "synthetic@example.invalid");
  write(path.join(root, ".gitignore"), "artifacts/\ntest-results/\n");
  write(path.join(root, R12_TECHNICAL.spec), "// immutable synthetic technical case\n");
  write(path.join(root, "src/example.ts"), "export const value = 1;\n");
  git("add", ".");
  git("commit", "-qm", "synthetic immutable source");
  const sha = git("rev-parse", "HEAD");
  const tree = git("rev-parse", "HEAD^{tree}");
  const record = { id: "SYNTHETIC_R12_NOT_A_GRANT" };
  const manifest = {
    baseSha: sha,
    candidateSha: sha,
    candidateTree: tree,
    sourceDigest: "d".repeat(64),
    contractDigest: "c".repeat(64),
    recordDigest: "e".repeat(64),
  };
  return {
    root,
    git,
    record,
    manifest,
    admission: async () => ({ record, manifest }),
    baseSha: sha,
    candidateSha: sha,
  };
}
function report(root, status = "passed") {
  return {
    config: {
      rootDir: path.join(root, "tests/e2e"),
      workers: 1,
      projects: [{ name: "chromium", retries: 0, repeatEach: 1 }],
    },
    errors: [],
    suites: [
      {
        specs: [
          {
            title: R12_TECHNICAL.title,
            file: "crossdeck-phase2.spec.ts",
            tests: [
              {
                projectName: "chromium",
                expectedStatus: "passed",
                status: status === "passed" ? "expected" : "unexpected",
                results: [{ status, retry: 0, attachments: [] }],
              },
            ],
          },
        ],
      },
    ],
  };
}
function syntheticExecution(f, stage, status = "passed") {
  return async ({ root, argumentsList, environment }) => {
    assert.equal(root, f.root);
    assert.ok(existsSync(r12TechnicalMarkerPath(root, stage)), "reservation must exist before synthetic setup");
    const marker = JSON.parse(readFileSync(r12TechnicalMarkerPath(root, stage), "utf8"));
    assert.equal(marker.status, "STARTED");
    const expected = r12TechnicalSuiteArguments({
      root,
      baseSha: f.baseSha,
      candidateSha: f.candidateSha,
      stage,
      databaseUrl: marker.databaseUrl,
    });
    assert.deepEqual(argumentsList.slice(1), expected);
    assert.equal(environment.GH_TOKEN, undefined);
    assert.equal(environment.CROSSDECK_ANDROID_CDP, undefined);
    assert.equal(environment.NODE_OPTIONS, undefined);
    assert.equal(environment.CROSSDECK_SERVER_METRICS_PATH, undefined);
    write(r12TechnicalMarkerPath(root, stage, true), {
      stage,
      lease: marker.lease,
      baseSha: f.baseSha,
      candidateSha: f.candidateSha,
      sourceDigest: f.manifest.sourceDigest,
    });
    write(environment.PLAYWRIGHT_JSON_OUTPUT_FILE, report(root, status));
    const successful = status === "passed";
    await writeBrowserDiagnosticReceipt(
      root,
      "browser-runtime.json",
      {
        failureCategory: successful ? null : "PRODUCT_FAILURE",
        lifecycle: { cleanup: { status: "PASS", portsReleased: true } },
      },
      environment,
    );
    await writeBrowserDiagnosticReceipt(
      root,
      "browser-suite-profile.json",
      { profile: "generic", browserTests: r12TechnicalBrowserArguments(), status: successful ? "PASS" : "FAIL" },
      environment,
    );
    const imagePath = path.join(root, "test-results/mandatory-technical-screenshot.png");
    const bytes = Buffer.from("synthetic unchanged-case mandatory screenshot bytes");
    if (successful) write(imagePath, bytes);
    write(path.join(root, "artifacts/crossdeck-phase2/crossdeck.surface-handoff-D1.json"), {
      source: { sourceSha: f.candidateSha, sourceTree: f.manifest.candidateTree, dirty: false },
      scenarioId: R12_TECHNICAL.title,
      tier: "D1",
      profile: "chromium-mobile",
      passFailDisposition: successful ? "PASS" : "FAIL",
      assertions: successful
        ? [
            { id: "crossdeck.phase2.continuity", state: "PASS" },
            { id: "keyboard-reduced-motion-privacy", state: "PASS" },
          ]
        : [],
      artifacts: successful ? [{ path: imagePath, sha256: hash(bytes), kind: "SCREENSHOT" }] : [],
      cleanupReceipt: { result: "PASS", remainingResources: [] },
    });
    return { exitCode: successful ? 0 : 1, cancelled: false, cleanup: { status: "PASS" } };
  };
}

test("R12 fixes the exact case and strips ambient CDP, provider, credentials and Node flags", () => {
  assert.deepEqual(r12TechnicalBrowserArguments(), [
    R12_TECHNICAL.spec,
    "--grep",
    "crossdeck\\.surface-handoff$",
    "--workers",
    "1",
    "--retries",
    "0",
    "--repeat-each",
    "1",
    "--reporter",
    "json",
  ]);
  assert.deepEqual(
    r12TechnicalEnvironment({
      PATH: "/synthetic",
      PLAYWRIGHT_BROWSERS_PATH: "/owned/cache",
      GH_TOKEN: "secret",
      NODE_OPTIONS: "--import=forbidden",
      CROSSDECK_ANDROID_CDP: "forbidden",
      CROSSDECK_SERVER_METRICS_PATH: "/external",
      SOUNDING_LINE_EXCEPTION_LEASE: "forbidden",
      PLAYWRIGHT_BASE_URL: "https://forbidden.invalid",
    }),
    { PATH: "/synthetic", PLAYWRIGHT_BROWSERS_PATH: "/owned/cache" },
  );
});

test("R12 preserves an original PASS as not reproduced and publishes the unchanged technical screenshot", async (t) => {
  const f = fixture(t);
  const receipt = await runR12TechnicalProof({
    ...f,
    stage: "original",
    execute: syntheticExecution(f, "original"),
    environment: { GH_TOKEN: "secret", NODE_OPTIONS: "forbidden", CROSSDECK_ANDROID_CDP: "forbidden" },
  });
  assert.equal(receipt.status, "PASS");
  assert.equal(receipt.outcome, "NOT_REPRODUCED");
  assert.equal(receipt.caseExecutions, 1);
  assert.equal(receipt.productCaptures, 0);
  assert.equal(receipt.media.length, 1);
  validateR12FocusedReceipt({ root: f.root, record: f.record, stage: "original", receipt });
  f.git("add", R12_TECHNICAL.publicationDirectory);
  f.git("commit", "-qm", "synthetic proof publication");
  validateR12FocusedReceipt({
    root: f.root,
    revision: f.git("rev-parse", "HEAD"),
    record: f.record,
    stage: "original",
    receipt,
  });
  let executions = 0;
  await assert.rejects(
    runR12TechnicalProof({
      ...f,
      stage: "original",
      execute: async () => {
        executions++;
      },
    }),
    /PROOF_ALREADY_CONSUMED|EEXIST/u,
  );
  assert.equal(executions, 0);
  assert.equal(JSON.parse(readFileSync(r12TechnicalMarkerPath(f.root, "original"), "utf8")).status, "PASS");
});

test("R12 original product failure retains an exact one-case failed report and successful cleanup", async (t) => {
  const f = fixture(t);
  const receipt = await runR12TechnicalProof({
    ...f,
    stage: "original",
    execute: syntheticExecution(f, "original", "failed"),
  });
  assert.equal(receipt.status, "FAIL");
  assert.equal(receipt.outcome, "ORIGINAL_CASE_FAILED");
  assert.deepEqual(receipt.media, []);
  validateR12FocusedReceipt({ root: f.root, record: f.record, stage: "original", receipt });
});

test("R12 corrected case must pass; publication rejects result, hash, scope and assertion drift", async (t) => {
  const original = fixture(t);
  await runR12TechnicalProof({
    ...original,
    stage: "original",
    execute: syntheticExecution(original, "original", "failed"),
  });
  const correctedRoot = `${original.root}-corrected`;
  t.after(() => rmSync(correctedRoot, { recursive: true, force: true }));
  original.git("worktree", "add", "--detach", "-q", correctedRoot, original.candidateSha);
  const f = { ...original, root: correctedRoot };
  const receipt = await runR12TechnicalProof({ ...f, stage: "corrected", execute: syntheticExecution(f, "corrected") });
  validateR12FocusedReceipt({ root: f.root, record: f.record, stage: "corrected", receipt });
  for (const patch of [{ status: "FAIL" }, { additionalRepeats: 1 }, { productCaptures: 1 }, { caseExecutions: 2 }]) {
    assert.throws(
      () =>
        validateR12FocusedReceipt({
          root: f.root,
          record: f.record,
          stage: "corrected",
          receipt: { ...receipt, ...patch },
        }),
      /PUBLISHED_RECEIPT_SCOPE_CHANGED/u,
    );
  }
  write(path.join(f.root, receipt.files.report.path), {
    ...report(f.root),
    errors: [{ message: "synthetic corrupted report" }],
  });
  assert.throws(
    () => validateR12FocusedReceipt({ root: f.root, record: f.record, stage: "corrected", receipt }),
    /PUBLISHED_OUTPUT_HASH_CHANGED/u,
  );
});

test("R12 will not spend the corrected case before an original terminal one-case result", async (t) => {
  const f = fixture(t);
  let executions = 0;
  const options = {
    ...f,
    stage: "corrected",
    execute: async () => {
      executions++;
    },
  };
  await assert.rejects(runR12TechnicalProof(options), /ORIGINAL_CASE_REQUIRED_FIRST/u);
  write(r12TechnicalMarkerPath(f.root, "original"), {
    status: "UNKNOWN",
    caseExecutions: 0,
    baseSha: f.baseSha,
    recordDigest: f.manifest.recordDigest,
  });
  await assert.rejects(runR12TechnicalProof(options), /ORIGINAL_CASE_REQUIRED_FIRST/u);
  assert.equal(executions, 0);
  assert.equal(existsSync(r12TechnicalMarkerPath(f.root, "corrected")), false);
});

test("R12 consumes setup failure and cancellation without claiming any executed case", async (t) => {
  for (const mode of ["setup", "cancelled"]) {
    const f = fixture(t);
    const options = {
      ...f,
      stage: "original",
      execute: async () => {
        if (mode === "setup") throw Error("synthetic setup failed");
        return { exitCode: null, cancelled: true, cleanup: { status: "PASS" } };
      },
    };
    if (mode === "setup") await assert.rejects(runR12TechnicalProof(options), /synthetic setup failed/u);
    else assert.equal((await runR12TechnicalProof(options)).status, "UNKNOWN");
    const receipt = JSON.parse(
      readFileSync(path.join(f.root, R12_TECHNICAL.publicationDirectory, "original/receipt.json"), "utf8"),
    );
    assert.equal(receipt.caseExecutions, 0);
    assert.equal(receipt.files.report, null);
    assert.equal(receipt.status, mode === "setup" ? "FAIL" : "UNKNOWN");
    assert.throws(
      () => validateR12FocusedReceipt({ root: f.root, record: f.record, stage: "original", receipt }),
      /PUBLISHED_RECEIPT_SCOPE_CHANGED/u,
    );
    await assert.rejects(runR12TechnicalProof(options), /PROOF_ALREADY_CONSUMED|EEXIST/u);
  }
});

test("R12 cancellation with complete PASS or interrupted reports stays unknown and cannot spend corrected", async (t) => {
  for (const status of ["passed", "interrupted"]) {
    const f = fixture(t);
    const execute = syntheticExecution(f, "original", status);
    const receipt = await runR12TechnicalProof({
      ...f,
      stage: "original",
      execute: async (options) => ({ ...(await execute(options)), cancelled: true }),
    });
    assert.equal(receipt.caseExecutions, 1);
    assert.equal(receipt.status, "UNKNOWN");
    assert.equal(receipt.outcome, "EXECUTION_UNKNOWN");
    assert.equal(JSON.parse(readFileSync(r12TechnicalMarkerPath(f.root, "original"), "utf8")).status, "UNKNOWN");
    await assert.rejects(
      runR12TechnicalProof({ ...f, stage: "corrected", execute: async () => assert.fail("must not launch corrected") }),
      /ORIGINAL_CASE_REQUIRED_FIRST/u,
    );
  }
});

test("R12 failed cleanup is unknown rather than an original product-failure claim", async (t) => {
  const f = fixture(t);
  const execute = syntheticExecution(f, "original", "failed");
  const receipt = await runR12TechnicalProof({
    ...f,
    stage: "original",
    execute: async (options) => ({ ...(await execute(options)), cleanup: { status: "FAIL" } }),
  });
  assert.equal(receipt.status, "UNKNOWN");
  assert.equal(receipt.outcome, "EXECUTION_UNKNOWN");
  await assert.rejects(
    runR12TechnicalProof({ ...f, stage: "corrected", execute: async () => assert.fail("must not launch corrected") }),
    /ORIGINAL_CASE_REQUIRED_FIRST/u,
  );
});

test("R12 rejects ignored and nonignored untracked runtime source before setup and after mutation", async (t) => {
  for (const ignored of [false, true]) {
    const f = fixture(t);
    if (ignored) {
      write(path.join(f.root, ".gitignore"), "artifacts/\ntest-results/\nsrc/injected.ts\n");
      f.git("add", ".gitignore");
      f.git("commit", "-qm", "synthetic ignored runtime input");
    }
    const initial = r12TechnicalSourceManifest(f.root);
    assert.ok(initial.length);
    write(path.join(f.root, "src/injected.ts"), "export const unauthorized = true;\n");
    assert.throws(() => r12TechnicalSourceManifest(f.root), /UNTRACKED_RUNTIME_SOURCE_FORBIDDEN/u);
    await assert.rejects(
      runR12TechnicalProof({ ...f, stage: "original", execute: async () => assert.fail("must not execute") }),
      /UNTRACKED_RUNTIME_SOURCE_FORBIDDEN/u,
    );
    assert.equal(existsSync(r12TechnicalMarkerPath(f.root, "original")), false);
  }
});

test("R12 CLI result fails closed for corrected failure, cancellation and incomplete setup", () => {
  assert.equal(r12TechnicalExitCode({ stage: "corrected", status: "PASS" }), 0);
  assert.equal(r12TechnicalExitCode({ stage: "corrected", status: "FAIL" }), 1);
  assert.equal(r12TechnicalExitCode({ stage: "original", status: "UNKNOWN", caseExecutions: 1 }), 1);
  assert.equal(r12TechnicalExitCode({ stage: "original", status: "FAIL", caseExecutions: 0 }), 1);
  assert.equal(
    r12TechnicalExitCode({ stage: "original", status: "FAIL", caseExecutions: 1, outcome: "ORIGINAL_CASE_FAILED" }),
    0,
  );
});

test("R12 report rejects extra cases, retries, repeats, wrong project and automatic media", () => {
  const root = "/synthetic";
  for (const mutate of [
    (r) => r.suites[0].specs.push(structuredClone(r.suites[0].specs[0])),
    (r) => {
      r.suites[0].specs[0].tests[0].results[0].retry = 1;
    },
    (r) => {
      r.config.projects[0].repeatEach = 0;
    },
    (r) => {
      r.config.projects[0].repeatEach = 2;
    },
    (r) => {
      r.suites[0].specs[0].tests[0].projectName = "webkit-mobile";
    },
    (r) => {
      r.suites[0].specs[0].tests[0].results[0].attachments.push({ contentType: "video/webm" });
    },
  ]) {
    const value = report(root);
    mutate(value);
    assert.throws(() => inspectR12TechnicalReport(value), /REPORT_CASE_COUNT_CHANGED|REPORT_SCOPE_CHANGED/u);
  }
});

test("R12 suite cannot enter setup without a reservation or with broadened arguments", async (t) => {
  const f = fixture(t);
  const options = { "r12-technical-proof": "original", "r12-base": f.baseSha, "database-url": "file:/synthetic.db" };
  await assert.rejects(
    requireR12TechnicalSuite({ root: f.root, candidateSha: f.candidateSha, options, browserTests: [], argv: [] }),
    /RESERVATION_REQUIRED/u,
  );
  const markerPath = r12TechnicalMarkerPath(f.root, "original");
  write(markerPath, {
    status: "STARTED",
    classification: R12_TECHNICAL.classification,
    stage: "original",
    baseSha: f.baseSha,
    candidateSha: f.candidateSha,
    lease: "synthetic",
    databaseUrl: options["database-url"],
  });
  await assert.rejects(
    requireR12TechnicalSuite({
      root: f.root,
      candidateSha: f.candidateSha,
      options,
      browserTests: [...r12TechnicalBrowserArguments(), "--debug"],
      argv: [],
      environment: { SOUNDING_LINE_R12_TECHNICAL_LEASE: "synthetic" },
    }),
    /INVOCATION_CHANGED/u,
  );
  assert.equal(existsSync(r12TechnicalMarkerPath(f.root, "original", true)), false);
});

test("R12 stage reservations share the common Git directory across worktrees", (t) => {
  const f = fixture(t);
  const other = path.join(f.root, "other-worktree");
  f.git("worktree", "add", "--detach", "-q", other, f.candidateSha);
  assert.equal(r12TechnicalMarkerPath(other, "original"), r12TechnicalMarkerPath(f.root, "original"));
  assert.notEqual(r12TechnicalMarkerPath(other, "corrected"), r12TechnicalMarkerPath(f.root, "original"));
});
