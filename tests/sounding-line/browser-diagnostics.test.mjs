import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  BROWSER_DIAGNOSTIC_CONTEXT,
  browserReceiptPaths,
  createBrowserDiagnosticSession,
  readBrowserDiagnosticReceipt,
  writeBrowserDiagnosticReceipt,
} from "../../scripts/sounding-line/browser-diagnostics.mjs";
import {
  browserDiagnosticRunner,
  completeOrdinaryVerification,
  failureCategoryFor,
  sanitizedFailureCode,
} from "../../scripts/sounding-line/ordinary.mjs";
import { runTrustedExperienceReplay } from "../../scripts/sounding-line/experience-browser.mjs";
import { revisionJson, sourceSnapshot } from "../../scripts/sounding-line/product-experience.mjs";
import {
  REPLAY_ADMISSION_SUBSTAGES,
  sourceDiagnosticGit,
  withReplayAdmissionSubstage,
} from "../../scripts/sounding-line/source-diagnostics.mjs";
import {
  claimExceptionPhase,
  exceptionBinding,
  requireExceptionPhase,
} from "../../scripts/sounding-line/experience-exception.mjs";
import {
  observeVerificationFailure,
  verificationFailureObservation,
  withVerificationStage,
} from "../../scripts/sounding-line/verification-diagnostics.mjs";

const sourceRoot = fileURLToPath(new URL("../../", import.meta.url));
const identity = { baseSha: "a".repeat(40), candidateSha: "b".repeat(40), planDigest: "c".repeat(64) };
function syntheticEnvironment(overrides) {
  const environment = { ...process.env, SOUNDING_LINE_PR_NUMBER: "0" };
  // A synthetic repository cannot borrow the enclosing campaign's execution
  // phase, lease or credentials. Keep GITHUB_ACTIONS and diagnostic inputs real.
  for (const key of Object.keys(environment))
    if (
      /^(?:GH_TOKEN|GITHUB_TOKEN|SOUNDING_LINE_EXCEPTION_(?:PHASE|LEASE|ORDINARY_LEASE)|SOUNDING_LINE_R\d+_LOCAL_LEASE)$/u.test(
        key,
      )
    )
      delete environment[key];
  return { ...environment, ...overrides };
}
async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), "browser-diagnostics-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}
async function seedLegacy(root, status = "PASS") {
  const directory = path.join(root, "artifacts/sounding-line");
  await mkdir(directory, { recursive: true });
  const records = {
    "browser-runtime.json": JSON.stringify({
      failureCategory: status === "PASS" ? null : "OLD_FAILURE",
      timing: { browserExecutionMs: 53962 },
      historical: true,
    }),
    "browser-suite-profile.json": JSON.stringify({ status, profile: "generic", browserTests: ["old.spec.ts"] }),
  };
  for (const [name, bytes] of Object.entries(records)) await writeFile(path.join(directory, name), bytes);
  return async () => {
    for (const [name, bytes] of Object.entries(records))
      assert.equal(await readFile(path.join(directory, name), "utf8"), bytes);
  };
}

test("actual ordinary preflight preserves the safe experience code and never attaches historical browser work", async (t) => {
  const root = await fixture(t);
  const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  const files = {
    "package.json": JSON.stringify({
      scripts: {
        "test:changed": "node scripts/sounding-line/ordinary.mjs --mode ordinary",
        "test:release": "node scripts/sounding-line/ordinary.mjs --mode release",
        "test:sounding-line": "node --test tests/sounding-line/ordinary.test.mjs",
      },
    }),
    "testing/contracts.json": JSON.stringify({
      experiencePolicy: { version: 1, evidencePath: "Development_Docs/evidence.json" },
      contracts: [
        {
          id: "crossdeck.phase2.continuity",
          experienceIntent: {
            integrationOwner: "Synthetic private detail must not appear",
            sourcePaths: ["src/app"],
            systems: ["crossdeck"],
          },
        },
      ],
    }),
    "testing/impact-map.json": "{}",
    "testing/suites.json": "{}",
    "src/app/page.tsx": "export default function Page(){return <main>Before</main>}",
  };
  for (const [name, bytes] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(root, name)), { recursive: true });
    await writeFile(path.join(root, name), bytes);
  }
  git("init", "--quiet", "--initial-branch=main");
  git("config", "core.autocrlf", "false");
  git("config", "user.name", "Diagnostic Fixture");
  git("config", "user.email", "diagnostics@example.invalid");
  git("add", ".");
  git("commit", "--quiet", "-m", "base");
  const baseSha = git("rev-parse", "HEAD");
  await writeFile(path.join(root, "src/app/page.tsx"), files["src/app/page.tsx"].replace("Before", "After"));
  git("add", ".");
  git("commit", "--quiet", "-m", "candidate");
  const candidateSha = git("rev-parse", "HEAD");
  for (const historicalStatus of [null, "PASS", "FAIL"]) {
    const assertPreserved = historicalStatus ? await seedLegacy(root, historicalStatus) : () => {};
    const result = spawnSync(
      process.execPath,
      [
        path.join(sourceRoot, "scripts/sounding-line/ordinary.mjs"),
        "--workspace",
        root,
        "--mode",
        "ordinary",
        "--base",
        baseSha,
        "--candidate",
        candidateSha,
      ],
      {
        cwd: root,
        env: syntheticEnvironment({ [BROWSER_DIAGNOSTIC_CONTEXT]: "inherited-untrusted-context" }),
        encoding: "utf8",
        timeout: 20000,
      },
    );
    assert.ifError(result.error);
    assert.equal(result.status, 1, result.stderr);
    const receipt = JSON.parse(
      await readFile(path.join(root, "artifacts/sounding-line/ordinary-decision.json"), "utf8"),
    );
    assert.equal(receipt.decision, "FAIL");
    assert.deepEqual(receipt.timing.commands, []);
    assert.equal(receipt.error, "PRODUCT_EXPERIENCE_EXPERIENCE_DESIGN_REQUIRED");
    assert.equal(receipt.failureCategory, "PRODUCT_EXPERIENCE_FAILURE");
    assert.equal(receipt.failureObservation.stage, "CLASSIFICATION");
    assert.equal(receipt.failureObservation.code, null);
    assert.equal(receipt.browserQualification, null);
    assert.equal(receipt.browserSuiteProfile, null);
    assert.equal(JSON.stringify(receipt).includes("Synthetic private detail"), false);
    await assertPreserved();
  }
});

test("scoped runtime and profile receipts require every exact identity field", async (t) => {
  const root = await fixture(t);
  const preserved = await seedLegacy(root);
  const session = createBrowserDiagnosticSession(root, identity);
  assert.deepEqual(await session.read(), { binding: null, runtime: null, profile: null });
  const environment = session.beginScope();
  for (const name of ["browser-runtime.json", "browser-suite-profile.json"]) {
    const receipt = await writeBrowserDiagnosticReceipt(
      root,
      name,
      { status: "FAIL", failureCategory: "PRODUCT_FAILURE" },
      environment,
    );
    const expected = JSON.stringify(receipt);
    const paths = browserReceiptPaths(root, environment);
    const target = name === "browser-runtime.json" ? paths.runtime : paths.profile;
    assert.deepEqual(await readBrowserDiagnosticReceipt(root, name, environment), receipt);
    for (const field of ["version", "runId", "scopeId", "baseSha", "candidateSha", "planDigest"]) {
      const changed = structuredClone(receipt);
      changed.diagnosticBinding[field] =
        field === "version"
          ? 2
          : changed.diagnosticBinding[field].replace(/^[a-f0-9]/u, (first) => (first === "a" ? "b" : "a"));
      await writeFile(target, JSON.stringify(changed));
      assert.equal(await readBrowserDiagnosticReceipt(root, name, environment), null, field);
    }
    await writeFile(target, expected);
  }
  const current = await session.read();
  assert.equal(current.runtime.failureCategory, "PRODUCT_FAILURE");
  assert.equal(current.profile.status, "FAIL");
  session.beginScope();
  assert.equal((await session.read()).runtime, null);
  assert.equal((await session.read()).profile, null);
  await preserved();
});

test("concurrent invocations with the same source and plan cannot read each other's browser receipts", async (t) => {
  const root = await fixture(t);
  const sessions = [createBrowserDiagnosticSession(root, identity), createBrowserDiagnosticSession(root, identity)];
  const contexts = sessions.map((session) => session.beginScope());
  await Promise.all(
    contexts.map((environment, index) =>
      writeBrowserDiagnosticReceipt(root, "browser-runtime.json", { invocation: index }, environment),
    ),
  );
  const receipts = await Promise.all(sessions.map((session) => session.read()));
  assert.notEqual(receipts[0].binding.runId, receipts[1].binding.runId);
  assert.deepEqual(
    receipts.map((receipt) => receipt.runtime.invocation),
    [0, 1],
  );
});

test("missing, malformed, foreign and unwritable scoped diagnostics are unavailable without legacy fallback", async (t) => {
  const root = await fixture(t);
  const preserved = await seedLegacy(root);
  const session = createBrowserDiagnosticSession(root, identity);
  const environment = session.beginScope();
  const paths = browserReceiptPaths(root, environment);
  await mkdir(paths.directory, { recursive: true });
  for (const bytes of ["{", "null", "[]", '{"status":"PASS"}', '{"diagnosticBinding":{}}']) {
    await writeFile(paths.runtime, bytes);
    assert.equal((await session.read()).runtime, null);
  }
  await rm(paths.directory, { recursive: true });
  await writeFile(paths.directory, "fixture blocks receipt directory");
  assert.equal(
    await writeBrowserDiagnosticReceipt(root, "browser-runtime.json", { status: "PASS" }, environment),
    null,
  );
  for (const value of ["malformed", "null", "{}", JSON.stringify({ ...identity, runId: "../../escape" })]) {
    const invalid = { [BROWSER_DIAGNOSTIC_CONTEXT]: value };
    assert.equal(browserReceiptPaths(root, invalid), null);
    assert.equal(await writeBrowserDiagnosticReceipt(root, "browser-runtime.json", { status: "PASS" }, invalid), null);
    assert.equal(await readBrowserDiagnosticReceipt(root, "browser-runtime.json", invalid), null);
  }
  await preserved();
});

test("standalone helpers retain their unbound receipt paths", async (t) => {
  const root = await fixture(t);
  const receipt = { version: 1, status: "PASS" };
  await writeBrowserDiagnosticReceipt(root, "browser-runtime.json", receipt, {});
  assert.deepEqual(
    JSON.parse(await readFile(path.join(root, "artifacts/sounding-line/browser-runtime.json"), "utf8")),
    receipt,
  );
  assert.deepEqual(await readBrowserDiagnosticReceipt(root, "browser-runtime.json", {}), receipt);
});

test("a later setup failure cannot attach an earlier successful browser command", async (t) => {
  const root = await fixture(t);
  const session = createBrowserDiagnosticSession(root, identity);
  let environment;
  const execute = browserDiagnosticRunner(session, (_root, _command, _args, options) => {
    environment = options.env;
  });
  execute(root, process.execPath, ["scripts/sounding-line/browser-authority.mjs"]);
  await writeBrowserDiagnosticReceipt(root, "browser-runtime.json", { status: "PASS" }, environment);
  assert.equal((await session.read()).runtime.status, "PASS");
  const failSetup = browserDiagnosticRunner(session, () => {
    throw new Error("SYNTHETIC_SETUP_FAILURE");
  });
  assert.throws(() => failSetup(root, "npm", ["run", "build"]), /SYNTHETIC_SETUP_FAILURE/u);
  assert.equal((await session.read()).runtime, null);
});

test("actual suite setup failure writes only its current profile and preserves old runtime evidence", async (t) => {
  const root = await fixture(t);
  const preserved = await seedLegacy(root, "FAIL");
  const session = createBrowserDiagnosticSession(root, identity);
  const result = spawnSync(
    process.execPath,
    [
      path.join(sourceRoot, "scripts/sounding-line/run-browser-suite.mjs"),
      "--workspace",
      root,
      "--profile",
      "generic",
      "--candidate",
      identity.candidateSha,
      "--database-url",
      "file:./unused.sqlite",
      "--",
      "synthetic.spec.ts",
    ],
    { cwd: root, env: syntheticEnvironment(session.beginScope()), encoding: "utf8", timeout: 15000 },
  );
  assert.ifError(result.error);
  assert.equal(result.status, 1);
  const receipt = await session.read();
  assert.equal(receipt.runtime, null);
  assert.equal(receipt.profile.status, "FAIL");
  assert.equal(receipt.profile.failureCategory, "SUITE_FIXTURE_CONTRACT_UNSATISFIED");
  await preserved();
});

test("entering a replay profile replaces an earlier command's diagnostic scope before adapter setup", async (t) => {
  const root = await fixture(t);
  const session = createBrowserDiagnosticSession(root, identity);
  await writeBrowserDiagnosticReceipt(root, "browser-runtime.json", { status: "PASS" }, session.beginScope());
  await assert.rejects(
    runTrustedExperienceReplay({
      root,
      plan: {
        applicable: true,
        candidateSha: identity.candidateSha,
        contracts: [{ experience: { fixtureProfile: "synthetic-unsupported-profile" } }],
      },
      environment: {},
      diagnostics: session,
    }),
    /PRODUCT_EXPERIENCE_PROFILE_ADAPTER_REQUIRED/u,
  );
  assert.equal((await session.read()).runtime, null);
});

test("replay setup I/O failure cannot inherit earlier successful browser work", async (t) => {
  const root = await fixture(t);
  const session = createBrowserDiagnosticSession(root, identity);
  await writeBrowserDiagnosticReceipt(root, "browser-runtime.json", { status: "PASS" }, session.beginScope());
  await mkdir(path.join(root, "artifacts/sounding-line/product-experience-plan.json"));
  await assert.rejects(runTrustedExperienceReplay({ root, plan: { applicable: true }, diagnostics: session }));
  assert.deepEqual(await session.read(), { binding: null, runtime: null, profile: null });
});

test("experience diagnostics retain only fixed codes and never suffix details or unknown tokens", () => {
  for (const code of [
    "EXPERIENCE_DESIGN_REQUIRED",
    "ACCEPTED_REFERENCE_UNKNOWN",
    "TRUSTED_REPLAY_FAILED",
    "ACTION_OUTCOME_NOT_OBSERVED",
  ]) {
    const error = new Error(`PRODUCT_EXPERIENCE_${code}:synthetic-private-name:token=value`);
    assert.equal(sanitizedFailureCode(error), `PRODUCT_EXPERIENCE_${code}`);
    assert.equal(failureCategoryFor(error), "PRODUCT_EXPERIENCE_FAILURE");
  }
  for (const error of [
    "PRODUCT_EXPERIENCE_PRIVATE_UPPERCASE_VALUE:secret",
    "PRODUCT_EXPERIENCE_EXPERIENCE_DESIGN_REQUIRED\nsecret",
    "PRODUCT_EXPERIENCE_ATTESTATION_ACCESS_FAILED_403:secret",
  ])
    assert.equal(sanitizedFailureCode(new Error(error)), "PRODUCT_EXPERIENCE_FAILURE");
  assert.equal(
    sanitizedFailureCode(new Error("synthetic arbitrary secret")),
    "SOUNDING_LINE_PRODUCT_FAILURE:VERIFICATION_COMMAND_FAILED",
  );
});

test("native replay setup failure retains completed technical results and a safe current stage", async (t) => {
  const root = await fixture(t);
  const diagnostics = createBrowserDiagnosticSession(root, identity);
  await writeBrowserDiagnosticReceipt(root, "browser-runtime.json", { status: "PASS" }, diagnostics.beginScope());
  await mkdir(path.join(root, "artifacts/sounding-line/product-experience-plan.json"));
  const verification = {
    timings: [{ command: "synthetic-completed-technical", status: "PASS", durationMs: 17 }],
    obligations: [{ id: "synthetic-obligation" }],
    reconciliation: [{ obligationId: "synthetic-obligation", freshExecuted: true }],
    finalization: { decision: "PASS", requiredObligations: 1 },
    freshObligations: 1,
    commandsAvoided: 0,
    avoidedDurationMs: 0,
  };
  const result = { decision: "FAIL", timing: { commands: [] } };
  // No Git checkout/exception, no contracts and a native failing setup path:
  // this fixture cannot claim a campaign phase or launch a browser profile.
  const plan = { candidateSha: identity.candidateSha, productExperience: { applicable: true, contracts: [] } };
  let failure;
  await assert.rejects(
    completeOrdinaryVerification({
      root,
      plan,
      result,
      verification,
      diagnostics,
      verifyExperience: () => ({ status: "PASS", classification: "SYNTHETIC_HISTORICAL_CHECK" }),
    }),
    (error) => {
      failure = verificationFailureObservation(error);
      assert.equal(failure.stage, "REPLAY_PLAN_WRITE");
      assert.equal(failure.code, error.code);
      assert(["EISDIR", "EACCES", "EPERM"].includes(failure.code));
      assert.equal(sanitizedFailureCode(error), "SOUNDING_LINE_PRODUCT_FAILURE:VERIFICATION_COMMAND_FAILED");
      return true;
    },
  );
  assert(failure);
  assert.equal(result.decision, "FAIL");
  assert.deepEqual(result.timing.commands, verification.timings);
  for (const key of [
    "obligations",
    "reconciliation",
    "finalization",
    "freshObligations",
    "commandsAvoided",
    "avoidedDurationMs",
  ])
    assert.deepEqual(result.evidenceReconciliation[key], verification[key]);
  assert.equal(result.evidenceReconciliation.requiredObligations, 1);
  assert.equal(result.productExperienceDecision.status, "PASS");
  assert.equal(result.productExperienceReplay, undefined);
  assert.deepEqual(await diagnostics.read(), { binding: null, runtime: null, profile: null });
});

test("stage observations preserve typed denials and the deepest original frozen error", async () => {
  const error = Object.freeze(new Error("PRODUCT_EXPERIENCE_EXCEPTION_EXECUTION_PHASE_BINDING_MISMATCH"));
  await assert.rejects(
    withVerificationStage("EXPERIENCE_REPLAY", () =>
      withVerificationStage("REPLAY_ADMISSION", () => {
        throw error;
      }),
    ),
    (observed) => observed === error,
  );
  assert.equal(verificationFailureObservation(error).stage, "REPLAY_ADMISSION");
  assert.equal(sanitizedFailureCode(error), "PRODUCT_EXPERIENCE_FAILURE");
  assert.equal(failureCategoryFor(error), "PRODUCT_EXPERIENCE_FAILURE");
});

test("failure observations exclude arbitrary messages, names, codes, paths and throwing getters", () => {
  let messageRead = false;
  const error = {
    name: "SECRET_NAME",
    code: "PRIVATE_TOKEN",
    syscall: "open /private/token",
    signal: "SECRET_SIGNAL",
    status: 900,
    get message() {
      messageRead = true;
      throw new Error("private-message");
    },
    get cause() {
      throw new Error("private-cause");
    },
    path: "/private/file",
    argv: ["private-token"],
    stack: "private-stack",
  };
  observeVerificationFailure("PRIVATE_STAGE", error);
  assert.deepEqual(verificationFailureObservation(error), {
    version: 1,
    stage: "UNCLASSIFIED",
    phase: null,
    errorName: "Error",
    code: null,
    causeCode: null,
    syscall: null,
    exitCode: null,
    signal: null,
  });
  assert.equal(messageRead, false);
  const native = Object.assign(new TypeError("private-message"), {
    code: "ENOBUFS",
    cause: { code: "ETIMEDOUT", message: "private-cause" },
    syscall: "spawnSync",
    status: 1,
    signal: "SIGTERM",
  });
  observeVerificationFailure("REPLAY_PROFILE_PROCESS", native);
  assert.deepEqual(verificationFailureObservation(native), {
    version: 1,
    stage: "REPLAY_PROFILE_PROCESS",
    phase: null,
    errorName: "TypeError",
    code: "ENOBUFS",
    causeCode: "ETIMEDOUT",
    syscall: "spawnSync",
    exitCode: 1,
    signal: "SIGTERM",
  });
  assert(!JSON.stringify(verificationFailureObservation(native)).includes("private"));
  assert.equal(verificationFailureObservation("private thrown value").errorName, "Error");
});

test("owned phase mkdir and create-only serialization preserve binding and existing denial semantics", async (t) => {
  const root = await fixture(t);
  const plan = {
    ...identity,
    sourceDigest: "d".repeat(64),
    contractDigest: "e".repeat(64),
    exception: { id: "SYNTHETIC" },
  };
  const value = claimExceptionPhase({
    root,
    phase: "experience",
    plan,
    runId: 123,
    preparationReservation: "SYNTHETIC",
  });
  const saved = JSON.parse(
    await readFile(path.join(root, "artifacts/sounding-line/exception-experience.json"), "utf8"),
  );
  assert.deepEqual(saved, value);
  assert.deepEqual(saved.binding, exceptionBinding(plan));
  requireExceptionPhase({
    root,
    phase: "experience",
    plan,
    environment: { GITHUB_RUN_ID: "123", SOUNDING_LINE_EXCEPTION_LEASE: value.lease },
  });
  assert.throws(
    () => claimExceptionPhase({ root, phase: "experience", plan, runId: 123 }),
    (error) => {
      assert.equal(error.message, "PRODUCT_EXPERIENCE_EXCEPTION_EXECUTION_PHASE_ALREADY_CONSUMED");
      const observed = verificationFailureObservation(error);
      assert.equal(observed.stage, "PHASE_CREATE");
      assert.equal(observed.phase, "experience");
      assert.equal(observed.code, "EEXIST");
      assert.equal(sanitizedFailureCode(error), "PRODUCT_EXPERIENCE_FAILURE");
      return true;
    },
  );
  const blocked = await fixture(t);
  await writeFile(path.join(blocked, "artifacts"), "SYNTHETIC_NON_DIRECTORY");
  assert.throws(
    () => claimExceptionPhase({ root: blocked, phase: "experience", plan, runId: 123 }),
    (error) => {
      const observed = verificationFailureObservation(error);
      assert.equal(observed.stage, "PHASE_DIRECTORY");
      assert.equal(observed.phase, "experience");
      assert.equal(observed.code, error.code);
      assert(["ENOTDIR", "EEXIST"].includes(observed.code));
      assert.equal(sanitizedFailureCode(error), "SOUNDING_LINE_PRODUCT_FAILURE:VERIFICATION_COMMAND_FAILED");
      return true;
    },
  );
});

function diagnosticRepository(root) {
  const git = (...args) =>
    execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  git("init", "--quiet", "--initial-branch=main");
  git("config", "user.name", "Synthetic Diagnostic");
  git("config", "user.email", "synthetic@example.invalid");
  git("commit", "--quiet", "--allow-empty", "-m", "first");
  const first = git("rev-parse", "HEAD");
  git("commit", "--quiet", "--allow-empty", "-m", "second");
  return { git, first, second: git("rev-parse", "HEAD") };
}
async function admissionFailure(substage, operation) {
  let original;
  await assert.rejects(
    withVerificationStage("REPLAY_ADMISSION", () =>
      withReplayAdmissionSubstage(substage, () => {
        try {
          return operation();
        } catch (error) {
          original = error;
          Object.freeze(error);
          throw error;
        }
      }),
    ),
    (error) => error === original,
  );
  return original;
}

test("actual Git ancestry failure retains fixed identity and validated revisions without raw arguments", async (t) => {
  const root = await fixture(t);
  const { first, second } = diagnosticRepository(root);
  const args = ["merge-base", "--is-ancestor", second, first];
  const error = await admissionFailure("PLAN_REBUILD", () =>
    sourceDiagnosticGit("DIAGNOSED_CONTINUATION", args, {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    }),
  );
  const observed = verificationFailureObservation(error);
  assert.equal(error.status, 1);
  assert.equal(observed.stage, "REPLAY_ADMISSION");
  assert.equal(observed.replayAdmission.substage, "PLAN_REBUILD");
  const git = observed.replayAdmission.git;
  assert.equal(git.component, "DIAGNOSED_CONTINUATION");
  assert.equal(git.operation, "ANCESTRY");
  assert.equal(git.classification, "NOT_ANCESTOR");
  assert.equal(git.argumentsSha256, createHash("sha256").update(JSON.stringify(args)).digest("hex"));
  assert.equal(git.arguments[2].revision.sha, second);
  assert.equal(git.arguments[3].revision.sha, first);
  assert.deepEqual(git.stderr, { available: false });
  assert.equal(sanitizedFailureCode(error), "SOUNDING_LINE_PRODUCT_FAILURE:VERIFICATION_COMMAND_FAILED");
  assert.equal(failureCategoryFor(error), "PRODUCT_FAILURE");
  assert(!JSON.stringify(observed).includes(root));
  assert.equal(Object.isFrozen(error), true);
});

test("actual metadata conflict retains source binding and bounded output hashes without private fixture text", async (t) => {
  const root = await fixture(t);
  const { first, second } = diagnosticRepository(root);
  const secret = "PRIVATE_DIAGNOSTIC_SENTINEL";
  const directory = path.join(root, `r12-readme-${secret}`);
  await mkdir(directory);
  const files = ["current", "base", "other"].map((name) => path.join(directory, name));
  const padding = `${secret}\n`.repeat(4000);
  await Promise.all(files.map((file, index) => writeFile(file, `${["ours", "base", "theirs"][index]}\n${padding}`)));
  const error = await admissionFailure("PLAN_REBUILD", () =>
    sourceDiagnosticGit(
      "DIAGNOSED_CONTINUATION",
      ["merge-file", "--stdout", ...files],
      { cwd: root, maxBuffer: 64 * 1024 * 1024, timeout: 5000, stdio: ["ignore", "pipe", "ignore"] },
      { file: ".agents/README.md", revisions: [first, first, second] },
    ),
  );
  const observed = verificationFailureObservation(error),
    git = observed.replayAdmission.git;
  assert.equal(error.status, 1);
  assert.equal(git.operation, "METADATA_MERGE");
  assert.equal(git.classification, "MERGE_CONFLICT");
  assert.equal(git.metadata.file, "AGENTS_README");
  assert.deepEqual(git.metadata.revisions, [first, first, second]);
  assert.equal(git.stdout.representation, "BUFFER");
  assert(git.stdout.bytes > 65536);
  assert.equal(git.stdout.hashedBytes, 65536);
  assert.equal(git.stdout.complete, false);
  assert.equal(git.stdout.sha256, createHash("sha256").update(error.stdout.subarray(0, 65536)).digest("hex"));
  assert(!JSON.stringify(observed).includes(secret));
  assert(!JSON.stringify(observed).includes(root));
  assert(!JSON.stringify(observed).includes("<<<<<<<"));
});

test("actual product-source Git readers preserve failure provenance through their existing typed translation", async (t) => {
  const root = await fixture(t);
  const { first } = diagnosticRepository(root);
  const secretPath = "src/PRIVATE_SOURCE_PATH_" + "x".repeat(128);
  const error = await admissionFailure("PLAN_REBUILD", () => revisionJson(root, first, secretPath));
  const observed = verificationFailureObservation(error),
    git = observed.replayAdmission.git;
  assert.equal(error.message, `PRODUCT_EXPERIENCE_REGISTRY_INVALID:${secretPath}`);
  assert.equal(error.cause, undefined);
  assert.equal(git.component, "PRODUCT_EXPERIENCE");
  assert.equal(git.operation, "SHOW");
  assert.equal(git.exitCode, 128);
  assert.equal(git.arguments[1].revision.sha, first);
  assert.equal(git.arguments[1].revision.selector, "PATH");
  assert(git.stderr.bytes > 0 && git.stderr.bytes < 65536);
  assert.equal(git.stderr.hashedBytes, git.stderr.bytes);
  assert.equal(git.stderr.complete, true);
  assert.equal(sanitizedFailureCode(error), "PRODUCT_EXPERIENCE_REGISTRY_INVALID");
  assert.equal(failureCategoryFor(error), "PRODUCT_EXPERIENCE_FAILURE");
  assert(!JSON.stringify(observed).includes("PRIVATE_SOURCE_PATH"));
  assert(!JSON.stringify(observed).includes(root));
});

test("unknown components and unsupported private command shapes execute unchanged without hashing", async (t) => {
  const root = await fixture(t);
  const { first } = diagnosticRepository(root);
  for (const [component, argument] of [
    ["PRIVATE_COMPONENT", `${first}:src/missing.ts`],
    ["PRODUCT_EXPERIENCE", `${first}:PRIVATE_CONTEXT_FILE`],
  ]) {
    const error = await admissionFailure("PLAN_REBUILD", () =>
      sourceDiagnosticGit(component, ["show", argument], {
        cwd: root,
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
        stdio: ["ignore", "pipe", "ignore"],
      }),
    );
    assert.equal(error.status, 128);
    const observed = verificationFailureObservation(error);
    assert.equal(observed.replayAdmission.git, null);
    assert(!JSON.stringify(observed).includes("PRIVATE"));
  }
});

test("historically ignored Git stderr cannot introduce a new maxBuffer failure", async (t) => {
  const root = await fixture(t);
  const { first } = diagnosticRepository(root);
  const error = await admissionFailure("PLAN_REBUILD", () =>
    sourceDiagnosticGit("PRODUCT_EXPERIENCE", ["show", `${first}:src/PRIVATE_STDERR_SENTINEL_missing.ts`], {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 8,
      stdio: ["ignore", "pipe", "ignore"],
    }),
  );
  assert.equal(error.status, 128);
  assert.equal(error.code, undefined);
  const observed = verificationFailureObservation(error);
  assert.equal(observed.replayAdmission.git.operation, "SHOW");
  assert.equal(observed.replayAdmission.git.exitCode, 128);
  assert.deepEqual(observed.replayAdmission.git.stderr, { available: false });
  assert(!JSON.stringify(observed).includes("PRIVATE_STDERR_SENTINEL"));
});

test("the exact public .prettierrc.json selector retains actual Git-reader failure provenance", async (t) => {
  const root = await fixture(t);
  const { first } = diagnosticRepository(root);
  const error = await admissionFailure("PLAN_REBUILD", () => revisionJson(root, first, ".prettierrc.json"));
  assert.equal(error.message, "PRODUCT_EXPERIENCE_REGISTRY_INVALID:.prettierrc.json");
  assert.equal(sanitizedFailureCode(error), "PRODUCT_EXPERIENCE_REGISTRY_INVALID");
  const observed = verificationFailureObservation(error);
  assert.equal(observed.stage, "REPLAY_ADMISSION");
  assert.equal(observed.replayAdmission.substage, "PLAN_REBUILD");
  const git = observed.replayAdmission.git;
  assert.equal(git.component, "PRODUCT_EXPERIENCE");
  assert.equal(git.operation, "SHOW");
  assert.equal(git.exitCode, 128);
  assert.equal(git.arguments[1].revision.sha, first);
  assert.equal(git.arguments[1].revision.pathSha256, createHash("sha256").update(".prettierrc.json").digest("hex"));
  assert.equal(git.stderr.available, true);
  assert(git.stderr.bytes > 0);
  assert(!JSON.stringify(observed).includes(root));
  assert(!JSON.stringify(observed).includes(".prettierrc.json"));
});

test("fixed replay substages preserve synchronous values, frozen errors and concurrent async isolation", async () => {
  for (const substage of REPLAY_ADMISSION_SUBSTAGES) {
    const error = Object.freeze(new Error("PRIVATE_SUBSTAGE_ERROR"));
    await assert.rejects(
      withVerificationStage("REPLAY_ADMISSION", () =>
        withReplayAdmissionSubstage(substage, () => {
          throw error;
        }),
      ),
      (value) => value === error,
    );
    assert.equal(verificationFailureObservation(error).replayAdmission.substage, substage);
    assert.equal(verificationFailureObservation(error).replayAdmission.git, null);
  }
  assert.equal(
    withReplayAdmissionSubstage("HEAD_CHECK", () => 42),
    42,
  );
  const observed = await Promise.all(
    ["HEAD_CHECK", "LIVE_CONTEXT"].map(async (substage) => {
      const error = Object.freeze(new Error("PRIVATE_CONCURRENT_ERROR"));
      await assert.rejects(
        withVerificationStage("REPLAY_ADMISSION", () =>
          withReplayAdmissionSubstage(substage, async () => {
            await Promise.resolve();
            throw error;
          }),
        ),
        (value) => value === error,
      );
      return verificationFailureObservation(error).replayAdmission.substage;
    }),
  );
  assert.deepEqual(observed, ["HEAD_CHECK", "LIVE_CONTEXT"]);
  const deepest = Object.freeze(new Error("PRODUCT_EXPERIENCE_EXCEPTION_EXECUTION_PHASE_ALREADY_CONSUMED"));
  await assert.rejects(
    withVerificationStage("REPLAY_ADMISSION", () =>
      withReplayAdmissionSubstage("PHASE_CLAIM", () => {
        throw observeVerificationFailure("PHASE_CREATE", deepest, { phase: "experience" });
      }),
    ),
    (value) => value === deepest,
  );
  assert.equal(verificationFailureObservation(deepest).stage, "PHASE_CREATE");
  assert.equal(verificationFailureObservation(deepest).replayAdmission.substage, "PHASE_CLAIM");
});

test("caught Git probes cannot label a later unrelated admission failure", async (t) => {
  const root = await fixture(t);
  diagnosticRepository(root);
  const later = Object.freeze(new Error("PRIVATE_LATER_FAILURE"));
  await assert.rejects(
    withVerificationStage("REPLAY_ADMISSION", () =>
      withReplayAdmissionSubstage("PLAN_REBUILD", () => {
        try {
          sourceSnapshot(root, "0".repeat(40));
        } catch {
          /* Expected synthetic read failure is handled. */
        }
        throw later;
      }),
    ),
    (value) => value === later,
  );
  assert.equal(verificationFailureObservation(later).replayAdmission.git, null);
  assert.equal(verificationFailureObservation(later).replayAdmission.substage, "PLAN_REBUILD");
});

test("an actual Git failure at the ordinary replay seam preserves technical results and launches no replay", async (t) => {
  const root = await fixture(t);
  diagnosticRepository(root);
  const diagnostics = createBrowserDiagnosticSession(root, identity);
  const verification = {
    timings: [{ phase: "synthetic", status: "PASS" }],
    obligations: [],
    reconciliation: [],
    finalization: { decision: "PASS", requiredObligations: 0 },
    freshObligations: 0,
    commandsAvoided: [],
    avoidedDurationMs: 0,
  };
  const result = { decision: "FAIL", timing: { commands: [] } };
  await assert.rejects(
    completeOrdinaryVerification({
      root,
      plan: { candidateSha: identity.candidateSha, productExperience: { applicable: true, contracts: [] } },
      result,
      verification,
      diagnostics,
      verifyExperience: () => ({ status: "PASS" }),
      replay: () =>
        withVerificationStage("REPLAY_ADMISSION", () =>
          withReplayAdmissionSubstage("PLAN_REBUILD", () => sourceSnapshot(root, "0".repeat(40))),
        ),
    }),
    (error) => {
      const observed = verificationFailureObservation(error);
      assert.equal(observed.replayAdmission.git.component, "PRODUCT_EXPERIENCE");
      assert.equal(observed.replayAdmission.git.operation, "LS_TREE");
      assert.equal(observed.exitCode, 128);
      assert.equal(sanitizedFailureCode(error), "SOUNDING_LINE_PRODUCT_FAILURE:VERIFICATION_COMMAND_FAILED");
      return true;
    },
  );
  assert.equal(result.decision, "FAIL");
  assert.deepEqual(result.timing.commands, verification.timings);
  assert.equal(result.evidenceReconciliation.finalization.decision, "PASS");
  assert.equal(result.productExperienceDecision.status, "PASS");
  assert.equal(result.productExperienceReplay, undefined);
  assert.deepEqual(await diagnostics.read(), { binding: null, runtime: null, profile: null });
  await assert.rejects(readFile(path.join(root, "artifacts/sounding-line/exception-experience.json")), {
    code: "ENOENT",
  });
});
