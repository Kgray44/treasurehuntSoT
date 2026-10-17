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

// The separate hosted reconstruction is exercised only with synthetic API/ZIP/
// Git fixtures. These tests never invoke its CLI, source child, campaign helpers,
// real API, historical source checkout or any product/consumer execution.
const {
  REPLAY_SOURCE_DIAGNOSTIC_POLICY: sourceDiagnosticPolicy,
  replaySourceDiagnosticPolicyDigest,
  validateDiagnosticEnvironment,
  validateDiagnosticExecution,
  createDiagnosticReservation,
  readDiagnosticReservation,
  createReadOnlyDiagnosticRequest,
  readBoundedDiagnosticBody,
  downloadDiagnosticArchive,
  strictDiagnosticZipMember,
  validateDiagnosticPaths,
  installHistoricalOverlay,
  sourceDiagnosticChildEnvironment,
  sourceDiagnosticResult,
  diagnosticFailureResult,
} = await import("../../scripts/sounding-line/replay-admission-source-diagnostic.mjs");

function sourceDiagnosticEnvironment(overrides = {}) {
  const policy = sourceDiagnosticPolicy;
  return {
    GITHUB_ACTIONS: "true",
    GITHUB_REPOSITORY: policy.repository,
    GITHUB_REF: "refs/heads/main",
    GITHUB_SHA: "a".repeat(40),
    GITHUB_EVENT_NAME: "workflow_dispatch",
    GITHUB_RUN_ATTEMPT: "1",
    GITHUB_ACTOR: policy.actor,
    GITHUB_TRIGGERING_ACTOR: policy.actor,
    GITHUB_WORKFLOW_REF: `${policy.repository}/${policy.workflow}@refs/heads/main`,
    GITHUB_JOB: "reserve-diagnostic",
    GITHUB_RUN_ID: "123456",
    ...overrides,
  };
}
function sourceDiagnosticApi() {
  const policy = sourceDiagnosticPolicy,
    environment = sourceDiagnosticEnvironment();
  const run = {
    id: 123456,
    run_attempt: 1,
    event: "workflow_dispatch",
    head_sha: environment.GITHUB_SHA,
    head_branch: "main",
    path: policy.workflow,
    status: "in_progress",
    conclusion: null,
    repository: { full_name: policy.repository },
    head_repository: { full_name: policy.repository },
    actor: { login: policy.actor },
    triggering_actor: { login: policy.actor },
    workflow_id: 55,
  };
  const responses = new Map([
    ["actions/runs/123456", run],
    ["actions/workflows/55", { id: 55, path: policy.workflow, state: "active" }],
    [
      "branches/main",
      {
        name: "main",
        commit: { sha: environment.GITHUB_SHA },
        protected: true,
        protection: {
          required_status_checks: { checks: [{ context: "Sounding Line / Mainline Decision", app_id: 15368 }] },
        },
      },
    ],
    [
      "pulls/721",
      {
        state: "open",
        draft: true,
        merged: false,
        base: { ref: "main", repo: { full_name: policy.repository } },
        head: { sha: policy.candidate, repo: { full_name: policy.repository } },
      },
    ],
    [
      "actions/workflows/55/runs?event=workflow_dispatch&per_page=100&page=1",
      { total_count: 1, workflow_runs: [structuredClone(run)] },
    ],
  ]);
  const calls = [];
  const request = async (endpoint, method = "GET") => {
    calls.push({ endpoint, method });
    assert.equal(method, "GET");
    assert.ok(responses.has(endpoint), "synthetic API must explicitly cover every read");
    return structuredClone(responses.get(endpoint));
  };
  return { environment, responses, calls, request };
}
const sourceDiagnosticNow = () => new Date("2026-10-17T07:00:00Z");

test("finite diagnostic rejects actor, executor, rerun, lease, ref and expiry changes before requests", async () => {
  const environment = sourceDiagnosticEnvironment();
  assert.equal(validateDiagnosticEnvironment(environment, "reserve-diagnostic", sourceDiagnosticNow()).runId, 123456);
  for (const changed of [
    { GITHUB_ACTOR: "another-owner" },
    { GITHUB_TRIGGERING_ACTOR: "another-owner" },
    { GITHUB_JOB: "final-check" },
    { GITHUB_RUN_ATTEMPT: "2" },
    { GITHUB_REF: "refs/heads/candidate" },
    { GITHUB_EVENT_NAME: "pull_request_target" },
    { GITHUB_WORKFLOW_REF: "private-url" },
    { SOUNDING_LINE_EXCEPTION_PHASE: "qualify" },
    { SOUNDING_LINE_R13_LOCAL_LEASE: "old-lease" },
  ])
    assert.throws(
      () => validateDiagnosticEnvironment({ ...environment, ...changed }, "reserve-diagnostic", sourceDiagnosticNow()),
      /CONTEXT_INVALID/u,
    );
  assert.throws(
    () => validateDiagnosticEnvironment(environment, "reserve-diagnostic", new Date("2026-10-23T00:00:00Z")),
    /EXPIRED/u,
  );
});

test("finite diagnostic authenticates main protection, exact draft subject and complete one-dispatch history", async () => {
  const valid = sourceDiagnosticApi();
  const execute = (api) =>
    validateDiagnosticExecution({
      request: api.request,
      environment: api.environment,
      installerSha: api.environment.GITHUB_SHA,
      job: "reserve-diagnostic",
      now: sourceDiagnosticNow(),
    });
  const result = await execute(valid);
  assert.equal(result.policyDigest, replaySourceDiagnosticPolicyDigest);
  assert.equal(valid.calls.length, 5);
  for (const mutate of [
    (api) => {
      api.responses.get("branches/main").protected = false;
    },
    (api) => {
      api.responses.get("branches/main").protection.required_status_checks.checks[0].app_id = 7;
    },
    (api) => {
      api.responses.get("branches/main").commit.sha = "b".repeat(40);
    },
    (api) => {
      api.responses.get("pulls/721").draft = false;
    },
    (api) => {
      api.responses.get("pulls/721").head.sha = "b".repeat(40);
    },
    (api) => {
      api.responses.get("actions/runs/123456").head_sha = "b".repeat(40);
    },
    (api) => {
      api.responses.get("actions/runs/123456").triggering_actor.login = "other";
    },
    (api) => {
      api.responses.get("actions/runs/123456").status = "completed";
    },
    (api) => {
      api.responses.get("actions/runs/123456").conclusion = "cancelled";
    },
    (api) => {
      api.responses.get("actions/workflows/55/runs?event=workflow_dispatch&per_page=100&page=1").total_count = 2;
    },
    (api) => {
      api.responses
        .get("actions/workflows/55/runs?event=workflow_dispatch&per_page=100&page=1")
        .workflow_runs.unshift({ id: 111, conclusion: "cancelled" });
    },
  ]) {
    const api = sourceDiagnosticApi();
    mutate(api);
    await assert.rejects(execute(api), /(?:PROTECTION|BINDING|HISTORY)_INVALID/u);
    assert.equal(
      api.calls.some((call) => call.method !== "GET"),
      false,
    );
  }
});

function diagnosticReservationApi(execution, { loseRefResponse = false } = {}) {
  const calls = [],
    refs = new Map(),
    blobs = new Map(),
    trees = new Map(),
    commits = new Map();
  const treeSha = "f".repeat(40);
  trees.set(treeSha, { tree: [{ path: "source", mode: "040000", type: "tree", sha: "e".repeat(40) }] });
  commits.set(execution.installerSha, { tree: { sha: treeSha }, parents: [] });
  const request = async (endpoint, method = "GET", body) => {
    calls.push({ endpoint, method });
    if (method === "POST") {
      const sha = createHash("sha256").update(JSON.stringify(body)).digest("hex").slice(0, 40);
      if (endpoint === "git/blobs") {
        blobs.set(sha, { content: Buffer.from(body.content).toString("base64") });
        return { sha };
      }
      if (endpoint === "git/trees") {
        trees.set(sha, { tree: [...trees.get(body.base_tree).tree, ...body.tree] });
        return { sha };
      }
      if (endpoint === "git/commits") {
        commits.set(sha, { tree: { sha: body.tree }, parents: body.parents.map((parent) => ({ sha: parent })) });
        return { sha };
      }
      if (endpoint === "git/refs") {
        assert.equal(body.ref, `refs/tags/${sourceDiagnosticPolicy.namespace}/attempt-1`);
        if (refs.has(body.ref)) throw Error("PRODUCT_EXPERIENCE_EXCEPTION_SLOT_CONSUMED");
        refs.set(body.ref, { object: { type: "commit", sha: body.sha } });
        if (loseRefResponse) throw Error("PRODUCT_EXPERIENCE_EXCEPTION_CUSTODY_WRITE_OUTCOME_UNKNOWN");
        return { ref: body.ref };
      }
    }
    if (endpoint.startsWith("git/ref/")) return refs.get(`refs/${endpoint.slice(8)}`) ?? null;
    if (endpoint.startsWith("git/blobs/")) return blobs.get(endpoint.slice(10));
    if (endpoint.startsWith("git/trees/")) return trees.get(endpoint.slice(10));
    if (endpoint.startsWith("git/commits/")) return commits.get(endpoint.slice(12));
    assert.fail("unexpected synthetic reservation operation");
  };
  return { request, calls, refs };
}

test("diagnostic atomic reservation has one distinct immutable slot and worker cannot write", async () => {
  const api = sourceDiagnosticApi();
  const execution = await validateDiagnosticExecution({
    request: api.request,
    environment: api.environment,
    installerSha: api.environment.GITHUB_SHA,
    job: "reserve-diagnostic",
    now: sourceDiagnosticNow(),
  });
  const fixture = diagnosticReservationApi(execution);
  const claim = await createDiagnosticReservation({ request: fixture.request, execution });
  assert.match(claim.commitSha, /^[a-f0-9]{40}$/u);
  assert.equal(claim.diagnosticOnly, true);
  assert.equal(claim.grantsQualification, false);
  assert.equal(claim.binding.originalRun, 39004965102);
  const writes = fixture.calls.filter((call) => call.method === "POST").length;
  assert.equal(writes, 4);
  assert.equal(
    (await readDiagnosticReservation({ request: fixture.request, execution, reservation: claim.commitSha })).commitSha,
    claim.commitSha,
  );
  await assert.rejects(createDiagnosticReservation({ request: fixture.request, execution }), /SLOT_CONSUMED/u);
  await assert.rejects(
    readDiagnosticReservation({
      request: fixture.request,
      execution: { ...execution, runId: 123457 },
      reservation: claim.commitSha,
    }),
    /RESERVATION_INVALID/u,
  );
  await assert.rejects(
    readDiagnosticReservation({ request: fixture.request, execution, reservation: "0".repeat(40) }),
    /RESERVATION_INVALID/u,
  );
  const readonly = createReadOnlyDiagnosticRequest(fixture.request);
  assert.throws(() => readonly("git/refs", "POST", {}), /READ_ONLY_REQUEST_REQUIRED/u);
  assert.equal(fixture.calls.filter((call) => call.method === "POST").length, writes);
  assert.equal(
    fixture.calls.some((call) => /(?:qualify|qualified|PE-X-CROSSDECK)/u.test(call.endpoint)),
    false,
  );
});

test("ambiguous diagnostic reservation creation is preserved without a second write", async () => {
  const execution = { installerSha: "a".repeat(40), runId: 123456, workflowId: 55 };
  const fixture = diagnosticReservationApi(execution, { loseRefResponse: true });
  await assert.rejects(createDiagnosticReservation({ request: fixture.request, execution }), /WRITE_OUTCOME_UNKNOWN/u);
  assert.equal(fixture.refs.size, 1);
  assert.equal(fixture.calls.filter((call) => call.endpoint === "git/refs" && call.method === "POST").length, 1);
});

test("diagnostic archive redirects strip credentials and oversize/forged archives fail boundedly", async () => {
  const calls = [];
  await assert.rejects(
    downloadDiagnosticArchive({
      token: "PRIVATE_SYNTHETIC_TOKEN",
      fetchImpl: async (url, options) => {
        calls.push({ url, options });
        return calls.length === 1
          ? new Response(null, {
              status: 302,
              headers: { location: "https://archive.example.invalid/blob?private-signature" },
            })
          : new Response("forged");
      },
    }),
    /ARCHIVE_INVALID/u,
  );
  assert.equal(calls.length, 2);
  assert.equal(calls[0].options.headers.Authorization, "Bearer PRIVATE_SYNTHETIC_TOKEN");
  assert.deepEqual(calls[1].options.headers, {});
  assert.equal(
    calls.every((call) => call.options.redirect === "manual"),
    true,
  );
  for (const location of ["http://archive.example.invalid/blob", "https://user:secret@archive.example.invalid/blob"]) {
    let count = 0;
    await assert.rejects(
      downloadDiagnosticArchive({
        token: "secret",
        fetchImpl: async () => {
          count++;
          return new Response(null, { status: 302, headers: { location } });
        },
      }),
      /ARCHIVE_TRANSPORT_FAILED/u,
    );
    assert.equal(count, 1);
  }
  await assert.rejects(
    readBoundedDiagnosticBody(
      new Response("secret", { headers: { "content-length": String(1024 * 1024 + 1) } }),
      1024 * 1024,
    ),
    /ARCHIVE_TOO_LARGE/u,
  );
  await assert.rejects(readBoundedDiagnosticBody(new Response("12345"), 4), /ARCHIVE_TOO_LARGE/u);
  assert.equal((await readBoundedDiagnosticBody(new Response("1234"), 4)).toString(), "1234");
});

function syntheticDiagnosticZip(bytes, name = "ordinary-decision.json", descriptor = true) {
  const filename = Buffer.from(name),
    local = Buffer.alloc(30),
    central = Buffer.alloc(46),
    end = Buffer.alloc(22);
  local.writeUInt32LE(0x04034b50);
  local.writeUInt16LE(descriptor ? 8 : 0, 6);
  local.writeUInt16LE(filename.length, 26);
  const tail = descriptor ? Buffer.alloc(16) : Buffer.alloc(0);
  if (descriptor) {
    tail.writeUInt32LE(0x08074b50);
    tail.writeUInt32LE(bytes.length, 8);
    tail.writeUInt32LE(bytes.length, 12);
  }
  central.writeUInt32LE(0x02014b50);
  central.writeUInt16LE(descriptor ? 8 : 0, 8);
  central.writeUInt32LE(bytes.length, 20);
  central.writeUInt32LE(bytes.length, 24);
  central.writeUInt16LE(filename.length, 28);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length + filename.length, 12);
  end.writeUInt32LE(local.length + filename.length + bytes.length + tail.length, 16);
  return Buffer.concat([local, filename, bytes, tail, central, filename, end]);
}

test("strict diagnostic ZIP reader accepts only one exact bounded hash-pinned member without extraction", () => {
  const bytes = Buffer.from('{"synthetic":true}\n');
  const expected = {
    name: "ordinary-decision.json",
    bytes: bytes.length,
    digest: createHash("sha256").update(bytes).digest("hex"),
  };
  for (const descriptor of [true, false])
    assert.deepEqual(
      strictDiagnosticZipMember(syntheticDiagnosticZip(bytes, expected.name, descriptor), expected),
      bytes,
    );
  assert.throws(
    () => strictDiagnosticZipMember(syntheticDiagnosticZip(bytes, "../private.json"), expected),
    /ARCHIVE_INVALID/u,
  );
  assert.throws(
    () => strictDiagnosticZipMember(syntheticDiagnosticZip(bytes), { ...expected, digest: "0".repeat(64) }),
    /ARCHIVE_INVALID/u,
  );
  assert.throws(
    () => strictDiagnosticZipMember(syntheticDiagnosticZip(bytes), { ...expected, bytes: 9 * 1024 * 1024 }),
    /ARCHIVE_INVALID/u,
  );
  const twoEntries = syntheticDiagnosticZip(bytes);
  twoEntries.writeUInt16LE(2, twoEntries.length - 12);
  assert.throws(() => strictDiagnosticZipMember(twoEntries, expected), /ARCHIVE_INVALID/u);
});

test("diagnostic paths forbid symlink/escape or overwrite and overlay rejects foreign checkouts before writes", async (t) => {
  const root = await fixture(t);
  for (const name of ["installer", "authority", "candidate", "receipts"]) await mkdir(path.join(root, name));
  const paths = {
    workspace: root,
    installer: path.join(root, "installer"),
    authority: path.join(root, "authority"),
    candidate: path.join(root, "candidate"),
    output: path.join(root, "receipts/reproduction.json"),
    mode: "diagnose",
  };
  assert.equal(validateDiagnosticPaths(paths).candidate, paths.candidate);
  assert.throws(() => validateDiagnosticPaths({ ...paths, candidate: path.join(root, "installer") }), /PATH_INVALID/u);
  assert.throws(() => validateDiagnosticPaths({ ...paths, output: path.join(root, "outside.json") }), /PATH_INVALID/u);
  await writeFile(paths.output, "original");
  assert.throws(() => validateDiagnosticPaths(paths), /OUTPUT_INVALID/u);
  for (const name of ["installer", "authority", "candidate"]) diagnosticRepository(path.join(root, name));
  assert.throws(() => installHistoricalOverlay({ ...paths, installerSha: "0".repeat(40) }));
  assert.equal(await readFile(paths.output, "utf8"), "original");
  await assert.rejects(readFile(path.join(paths.authority, "scripts/sounding-line/source-diagnostics.mjs")), {
    code: "ENOENT",
  });
});

test("source child receives actual diagnostic metadata with no credentials, Git overrides or consumer permission", () => {
  const environment = sourceDiagnosticEnvironment({
    GITHUB_JOB: "source-diagnostic",
    GH_TOKEN: "private",
    GITHUB_TOKEN: "private",
    NODE_OPTIONS: "--require private",
    GIT_TRACE: "private",
    GIT_CONFIG_COUNT: "1",
    SOUNDING_LINE_EXCEPTION_PHASE: "qualify",
    SOUNDING_LINE_EXCEPTION_LEASE: "private",
    SOUNDING_LINE_R13_LOCAL_LEASE: "private",
  });
  const child = sourceDiagnosticChildEnvironment(environment);
  assert.equal(child.GITHUB_JOB, "source-diagnostic");
  assert.equal(child.GITHUB_RUN_ID, "123456");
  assert.equal(
    Object.keys(child).some((key) => /^(?:GH_TOKEN|GITHUB_TOKEN|SOUNDING_LINE_|GIT_|NODE_OPTIONS)/u.test(key)),
    false,
  );
  assert.equal(JSON.stringify(child).includes("private"), false);
});

test("a source-only nonreproduction or new Git failure never grants product acceptance or the original cause", async (t) => {
  const result = {
    status: "NOT_REPRODUCED",
    completeness: "DIAGNOSTIC_INCOMPLETE",
    originalCauseClaim: false,
    qualification: false,
    milestones: [
      "SOURCE_RECOGNITION",
      "PLAN_INPUT",
      "REGISTRY_READ",
      "CAMPAIGN_RELATION",
      "HEAD_CHECK",
      "PLAN_REBUILD",
      "PLAN_COMPARE",
      "REGISTRY_READ",
      "HISTORICAL_PREPARE",
    ],
    productExecutions: 0,
    consumerAdmissions: 0,
    networkRequests: 0,
  };
  assert.equal(sourceDiagnosticResult(result).status, "NOT_REPRODUCED");
  for (const change of [
    { status: "PASS" },
    { originalCauseClaim: true },
    { qualification: true },
    { productExecutions: 1 },
    { consumerAdmissions: 1 },
    { networkRequests: 1 },
    { milestones: ["PHASE_CLAIM"] },
  ])
    assert.throws(() => sourceDiagnosticResult({ ...result, ...change }), /SOURCE_CHILD_INVALID/u);
  const root = await fixture(t);
  diagnosticRepository(root);
  let observation;
  await assert.rejects(
    withVerificationStage("REPLAY_ADMISSION", () =>
      withReplayAdmissionSubstage("PLAN_REBUILD", () => sourceSnapshot(root, "0".repeat(40))),
    ),
    (error) => {
      observation = verificationFailureObservation(error);
      return true;
    },
  );
  assert.equal(observation.replayAdmission.git.operation, "LS_TREE");
  const observed = sourceDiagnosticResult({ ...result, status: "SOURCE_OPERATION_FAILURE_REPRODUCED", observation });
  assert.equal(observed.originalCauseClaim, false);
  assert.equal(observed.qualification, false);
  assert.equal(JSON.stringify(observed).includes(root), false);
});

test("unknown or partial source execution never becomes a known setup failure or retry permission", () => {
  for (const diagnosticCode of ["WRITE_OUTCOME_UNKNOWN", "SOURCE_CHILD_UNKNOWN", "PRIVATE_UNCLASSIFIED_ERROR"]) {
    const result = diagnosticFailureResult({ diagnosticCode, message: "PRIVATE", stack: "PRIVATE" });
    assert.equal(result.status, "EXECUTION_UNKNOWN");
    assert.equal(result.completeness, "DIAGNOSTIC_INCOMPLETE");
    assert.equal(JSON.stringify(result).includes("PRIVATE"), false);
  }
  assert.equal(
    diagnosticFailureResult({ diagnosticCode: "BINDING_INVALID" }).status,
    "DIAGNOSTIC_SETUP_OR_BINDING_FAILURE",
  );
  assert.equal(
    diagnosticFailureResult({ diagnosticCode: "SOURCE_POSTCONDITION_INVALID" }, true).status,
    "EXECUTION_UNKNOWN",
  );
});
