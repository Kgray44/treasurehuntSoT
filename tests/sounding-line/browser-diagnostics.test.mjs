import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { access, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
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
import {
  planProductExperience,
  revisionJson,
  sourceSnapshot,
} from "../../scripts/sounding-line/product-experience.mjs";
import {
  REPLAY_ADMISSION_SUBSTAGES,
  sourceDiagnosticGit,
  withReplayAdmissionSubstage,
  withReplayAdmissionScope,
  withSourceDiagnosticCapture,
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

test("nonapplicable replay returns before exception admission and diagnostic setup", async (t) => {
  const root = await fixture(t);
  const { git } = diagnosticRepository(root);
  await mkdir(path.join(root, "testing"));
  await writeFile(
    path.join(root, "testing/contracts.json"),
    JSON.stringify({ experiencePolicy: { version: 1, evidencePath: "Development_Docs/evidence.json" }, contracts: [] }),
  );
  git("add", "--", "testing/contracts.json");
  git("commit", "--quiet", "-m", "Synthetic trusted policy");
  const baseSha = git("rev-parse", "HEAD");
  await mkdir(path.join(root, "Development_Docs"));
  await mkdir(path.join(root, "tests"));
  await writeFile(path.join(root, "Development_Docs/document-index.json"), '{"synthetic":true}\n');
  await writeFile(path.join(root, "tests/synthetic.test.mjs"), "// Synthetic fixture, never executed.\n");
  git("add", "--", "Development_Docs/document-index.json", "tests/synthetic.test.mjs");
  git("commit", "--quiet", "-m", "Synthetic backend-only change");
  const canonical = planProductExperience({
    root,
    baseSha,
    candidateSha: git("rev-parse", "HEAD"),
    changedPaths: ["Development_Docs/document-index.json", "tests/synthetic.test.mjs"],
    prNumber: 786,
  });
  assert.equal(canonical.applicable, false);
  assert.equal(canonical.classification, "BACKEND_ONLY");
  let reads = 0,
    diagnosticCalls = 0;
  for (const plan of [
    canonical,
    { applicable: false, classification: "BACKEND_ONLY", contractIds: [] },
    { applicable: false, classification: "TRUSTED_POLICY_NOT_YET_ACTIVATED", contractIds: [] },
    ...["BACKEND_ONLY", "DOCUMENTATION_ONLY", "INTERNAL_TOOLING"].map((classification) => ({
      applicable: false,
      classification,
      contractIds: [],
      affectedSurfaces: [],
      uncertainty: [],
      transitivePaths: ["Development_Docs/document-index.json"],
    })),
  ]) {
    const result = await withReplayAdmissionScope(() =>
      withSourceDiagnosticCapture(
        {
          executeGitRead(exec, args, options) {
            reads++;
            return exec("git", args, options);
          },
        },
        () =>
          runTrustedExperienceReplay({
            root,
            plan: Object.freeze(
              Object.fromEntries(
                Object.entries(plan).map(([key, value]) => [key, Array.isArray(value) ? Object.freeze(value) : value]),
              ),
            ),
            environment: syntheticEnvironment({ SOUNDING_LINE_PR_NUMBER: "721" }),
            diagnostics: {
              clearScope() {
                diagnosticCalls++;
              },
              beginScope() {
                diagnosticCalls++;
              },
            },
            onDiagnosticScope() {
              diagnosticCalls++;
            },
          }),
      ),
    );
    assert.deepEqual(result, { status: "NOT_APPLICABLE" });
  }
  assert.equal(reads, 0, "no source recognition or exception claim for a nonapplicable plan");
  assert.equal(diagnosticCalls, 0);
  await assert.rejects(access(path.join(root, "artifacts")), { code: "ENOENT" });
});

test("malformed or forged nonapplicable replay plans cannot bypass admission or create execution artifacts", async (t) => {
  const root = await fixture(t);
  diagnosticRepository(root);
  const empty = { applicable: false, classification: "BACKEND_ONLY", contractIds: [] };
  const graph = { ...empty, affectedSurfaces: [], uncertainty: [], transitivePaths: [] };
  let accessorCalls = 0,
    methodCalls = 0;
  const accessor = () => {
    accessorCalls++;
    return false;
  };
  for (const plan of [
    undefined,
    Object.assign(Object.create({ exception: { id: "inherited-forgery" } }), empty),
    Object.defineProperty({ ...empty }, "exception", { value: { id: "hidden-forgery" } }),
    { ...empty, [Symbol("forged")]: true },
    {},
    { ...empty, applicable: 0 },
    { ...empty, applicable: "false" },
    { ...empty, exception: { id: "forged" } },
    { ...empty, contracts: [{ id: "must-not-run" }] },
    { ...empty, classification: "LOCAL_UI_CHANGE" },
    { ...empty, contractIds: ["must-review"] },
    { ...empty, affectedSurfaces: ["src/app/page.tsx"], uncertainty: [], transitivePaths: [] },
    { ...empty, affectedSurfaces: [], uncertainty: ["unknown"], transitivePaths: [] },
    { ...empty, affectedSurfaces: [], uncertainty: [], transitivePaths: [1] },
    { ...empty, transitivePaths: [] },
    { ...graph, transitivePaths: new Array(1) },
    {
      ...graph,
      transitivePaths: Object.assign([1], {
        some: () => {
          methodCalls++;
          return false;
        },
      }),
    },
    { ...graph, transitivePaths: Object.defineProperty(["path"], "0", { get: accessor }) },
    { ...graph, transitivePaths: Object.defineProperty(["path"], "0", { enumerable: false }) },
    { ...graph, transitivePaths: Object.assign([], { extra: "path" }) },
    { ...graph, transitivePaths: Object.assign([], { [Symbol("extra")]: "path" }) },
    { ...graph, transitivePaths: Object.setPrototypeOf([], Object.create(Array.prototype)) },
    { ...empty, contractIds: Object.assign([], { extra: "obligation" }) },
    Object.defineProperty({ ...empty }, "applicable", { get: accessor }),
    Object.defineProperty({ ...empty }, "classification", { get: accessor }),
    Object.defineProperty({ ...empty }, "contractIds", { get: accessor }),
    Object.defineProperty({ ...empty }, "classification", { enumerable: false }),
    { ...graph, classification: "TRUSTED_POLICY_NOT_YET_ACTIVATED" },
  ])
    await assert.rejects(
      runTrustedExperienceReplay({ root, plan, environment: syntheticEnvironment({ SOUNDING_LINE_PR_NUMBER: "721" }) }),
      /PRODUCT_EXPERIENCE_REPLAY_PLAN_INVALID/u,
    );
  assert.equal(accessorCalls, 0, "malformed input accessors never execute");
  assert.equal(methodCalls, 0, "malformed input methods never execute");
  await assert.rejects(access(path.join(root, "artifacts")), { code: "ENOENT" });
});

test("applicable replay retains actual exception admission and rejects missing immutable plan identity", async (t) => {
  const root = await fixture(t);
  diagnosticRepository(root);
  let reads = 0;
  await assert.rejects(
    withReplayAdmissionScope(() =>
      withSourceDiagnosticCapture(
        {
          executeGitRead(exec, args, options) {
            reads++;
            return exec("git", args, options);
          },
        },
        () =>
          runTrustedExperienceReplay({
            root,
            plan: { applicable: true },
            environment: syntheticEnvironment({ SOUNDING_LINE_PR_NUMBER: "721" }),
          }),
      ),
    ),
    (error) => {
      assert.match(error.message, /PRODUCT_EXPERIENCE_EXCEPTION_EXECUTION_PLAN_CHANGED/u);
      const observed = verificationFailureObservation(error);
      assert.equal(observed.stage, "REPLAY_ADMISSION");
      assert.equal(observed.replayAdmission.substage, "PLAN_INPUT");
      return true;
    },
  );
  assert(reads > 0, "the applicable path still enters the real installed exception gate");
  await assert.rejects(access(path.join(root, "artifacts")), { code: "ENOENT" });
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

// This separate finite workload authority is tested with synthetic data only.
// Never run its CLI, original-plan projection, source prefix, package/browser
// setup, historical workload or real custody/API from these regression fixtures.
const posttechnical = await import("../../scripts/sounding-line/replay-posttechnical-suite.mjs");
const posttechnicalController = await import("../../scripts/sounding-line/replay-posttechnical-diagnostic.mjs");
const posttechnicalCrypto = await import("node:crypto");
function posttechnicalReportFixture() {
  const reports = new Map();
  for (const entry of posttechnical.POSTTECHNICAL_CASES) {
    let suite = reports.get(entry.spec);
    if (!suite) {
      suite = { title: path.basename(entry.spec), file: path.basename(entry.spec), suites: [], specs: [] };
      reports.set(entry.spec, suite);
    }
    for (const title of entry.titlePath.slice(0, -1)) {
      let nested = suite.suites.find((child) => child.title === title);
      if (!nested) {
        nested = { title, file: path.basename(entry.spec), suites: [], specs: [] };
        suite.suites.push(nested);
      }
      suite = nested;
    }
    suite.specs.push({
      title: entry.titlePath.at(-1),
      file: path.basename(entry.spec),
      line: entry.sourceLine,
      column: entry.sourceColumn,
      tests: [
        {
          projectName: "chromium",
          expectedStatus: "passed",
          status: "expected",
          repeatEachIndex: 0,
          results: [{ retry: 0, status: "passed", errors: [], attachments: [] }],
        },
      ],
    });
  }
  return {
    config: {
      rootDir: "/synthetic/candidate/tests/e2e",
      workers: 1,
      projects: [{ name: "chromium", retries: 0, repeatEach: 1 }],
    },
    errors: [],
    stats: { expected: 38, skipped: 0, unexpected: 0, flaky: 0 },
    suites: [...reports.values()],
  };
}

test("posttechnical report requires all exact source identities and one actual Chromium result each", () => {
  const report = posttechnicalReportFixture();
  const summary = posttechnical.validatePosttechnicalBrowserReport(report, { candidate: "/synthetic/candidate" });
  assert.equal(summary.actualCases, 38);
  assert.equal(summary.actualSuites, 6);
  assert.equal(summary.identityDigest, posttechnical.POSTTECHNICAL_POLICY.casesDigest);
  assert.equal(summary.qualification, false);
  const first = (value) => value.suites[0].specs[0];
  for (const mutate of [
    (value) => {
      first(value).title += " changed";
    },
    (value) => {
      first(value).line++;
    },
    (value) => {
      first(value).tests[0].projectName = "webkit-mobile";
    },
    (value) => {
      first(value).tests[0].results.push({ retry: 1, status: "passed" });
    },
    (value) => {
      first(value).tests[0].results[0].status = "skipped";
    },
    (value) => {
      first(value).tests[0].status = "flaky";
    },
    (value) => {
      first(value).tests[0].results = { 0: first(value).tests[0].results[0], length: 1 };
    },
    (value) => {
      delete first(value).tests[0].results;
    },
    (value) => {
      first(value).tests[0].results = [];
    },
    (value) => {
      value.config.rootDir = "/foreign/candidate/tests/e2e";
    },
    (value) => {
      first(value).file = "/foreign/candidate/tests/e2e/crossdeck-experience-refit.spec.ts";
    },
    (value) => {
      first(value).file = "../e2e/crossdeck-experience-refit.spec.ts";
    },
    (value) => {
      value.suites[0].specs[1] = structuredClone(first(value));
    },
    (value) => {
      value.stats.skipped = 1;
    },
    (value) => {
      value.config.workers = 2;
    },
    (value) => {
      value.config.projects[0].retries = 1;
    },
    (value) => {
      value.errors.push({ message: "PRIVATE_REPORT_FAILURE" });
    },
  ]) {
    const changed = structuredClone(report);
    mutate(changed);
    assert.throws(
      () => posttechnical.validatePosttechnicalBrowserReport(changed, { candidate: "/synthetic/candidate" }),
      /REPORT_/u,
    );
  }
});

test("posttechnical runtime and exact command guards cannot broaden a fixed diagnostic", () => {
  const runtime = {
    node: "24.19.0",
    platform: "linux",
    architecture: "x64",
    git: "2.55.0",
    executable: posttechnical.POSTTECHNICAL_WORKLOAD.nodeExecutable,
  };
  posttechnical.assertPosttechnicalRuntime(runtime);
  for (const change of [
    { node: "24.19.1" },
    { git: "2.52.0" },
    { platform: "win32" },
    { architecture: "arm64" },
    { executable: "/untrusted/node" },
  ])
    assert.throws(() => posttechnical.assertPosttechnicalRuntime({ ...runtime, ...change }), /RUNTIME_CHANGED/u);
  assert.equal(posttechnical.validatePosttechnicalCommand(1, "npm", ["run", "db:generate"]).executable, "npm");
  for (const [ordinal, command, args] of [
    [0, "npm", ["run", "db:generate"]],
    [2, "npm", ["run", "db:generate"]],
    [1, "npm", ["run", "build"]],
    [13, "npm", ["run", "build"]],
  ])
    assert.throws(() => posttechnical.validatePosttechnicalCommand(ordinal, command, args), /COMMAND_CHANGED/u);
});

function posttechnicalApiFixture() {
  const P = posttechnical.POSTTECHNICAL_POLICY;
  const environment = {
    ...sourceDiagnosticEnvironment(),
    GITHUB_JOB: "reserve-diagnostic",
    GITHUB_WORKFLOW_REF: `${P.repository}/${P.workflow}@refs/heads/main`,
  };
  const api = sourceDiagnosticApi();
  api.environment = environment;
  const run = api.responses.get("actions/runs/123456");
  api.responses.get("pulls/721").base.sha = posttechnical.POSTTECHNICAL_WORKLOAD.base;
  run.path = P.workflow;
  run.display_title = P.title;
  api.responses.get("actions/workflows/55").path = P.workflow;
  api.responses.get("actions/workflows/55/runs?event=workflow_dispatch&per_page=100&page=1").workflow_runs[0].path =
    P.workflow;
  api.responses.set(`actions/runs/${P.priorRun}`, {
    id: P.priorRun,
    run_attempt: 1,
    event: "workflow_dispatch",
    conclusion: "success",
    head_sha: "63188aa225e69a807eb078f1df14e92f7a536da1",
    path: sourceDiagnosticPolicy.workflow,
    actor: { login: P.actor },
    triggering_actor: { login: P.actor },
  });
  return api;
}

test("new posttechnical admission authenticates its own finite workflow and consumed predecessor without reusing permission", async () => {
  const invoke = (api) =>
    posttechnicalController.validatePosttechnicalExecution({
      request: api.request,
      environment: api.environment,
      job: "reserve-diagnostic",
      installerSha: api.environment.GITHUB_SHA,
      now: sourceDiagnosticNow(),
    });
  const api = posttechnicalApiFixture();
  assert.equal((await invoke(api)).policyDigest, posttechnical.posttechnicalPolicyDigest);
  for (const mutate of [
    (value) => {
      value.environment.GITHUB_RUN_ATTEMPT = "2";
    },
    (value) => {
      value.responses.get("actions/runs/123456").display_title = "Sounding Line finite 1 ordinary";
    },
    (value) => {
      value.responses.get("actions/runs/123456").conclusion = "cancelled";
    },
    (value) => {
      value.responses.get("branches/main").protected = false;
    },
    (value) => {
      value.responses.get("pulls/721").draft = false;
    },
    (value) => {
      value.responses.get("pulls/721").base.sha = "b".repeat(40);
    },
    (value) => {
      value.responses.get("actions/workflows/55/runs?event=workflow_dispatch&per_page=100&page=1").total_count = 2;
    },
    (value) => {
      value.responses.get(`actions/runs/${posttechnical.POSTTECHNICAL_POLICY.priorRun}`).conclusion = "failure";
    },
  ]) {
    const changed = posttechnicalApiFixture();
    mutate(changed);
    await assert.rejects(invoke(changed), /POSTTECHNICAL_DIAGNOSTIC_/u);
    assert.equal(
      changed.calls.some((call) => call.method !== "GET"),
      false,
    );
  }
});

test("posttechnical child environments cannot carry owner credentials or old/new suite permission into the app", () => {
  const inherited = {
    ...sourceDiagnosticEnvironment(),
    GH_TOKEN: "PRIVATE",
    GITHUB_TOKEN: "PRIVATE",
    SOUNDING_LINE_EXCEPTION_PHASE: "qualify",
    SOUNDING_LINE_R13_LOCAL_LEASE: "PRIVATE",
    POSTTECHNICAL_SUITE_LEASE: "PRIVATE",
    NODE_OPTIONS: "PRIVATE",
    GIT_CONFIG_COUNT: "1",
  };
  const worker = posttechnicalController.posttechnicalWorkerEnvironment(inherited, "/synthetic/workspace");
  assert.equal(worker.CI, "true");
  assert.equal(worker.GITHUB_JOB, "reserve-diagnostic");
  assert.equal(
    Object.keys(worker).some((name) =>
      /^(?:GH_TOKEN|GITHUB_TOKEN|SOUNDING_LINE_|POSTTECHNICAL_|GIT_|NODE_OPTIONS)/u.test(name),
    ),
    false,
  );
  const app = posttechnical.scrubPosttechnicalSuiteEnvironment({
    ...worker,
    POSTTECHNICAL_SUITE_LEASE: "PRIVATE",
    SOUNDING_LINE_EXCEPTION_PHASE: "qualify",
    SOUNDING_LINE_BROWSER_DIAGNOSTIC_CONTEXT: "synthetic-scope",
    GH_TOKEN: "PRIVATE",
  });
  assert.equal(app.POSTTECHNICAL_SUITE_LEASE, undefined);
  assert.equal(app.GH_TOKEN, undefined);
  assert.equal(app.SOUNDING_LINE_BROWSER_DIAGNOSTIC_CONTEXT, "synthetic-scope");
  assert.equal(JSON.stringify(app).includes("PRIVATE"), false);
});

test("posttechnical finalization rejects reused, skipped or incomplete obligations even with a PASS label", () => {
  const result = {
    freshObligations: 8,
    obligations: posttechnical.POSTTECHNICAL_WORKLOAD.groups.map(([id]) => ({ id })),
    reconciliation: Array.from({ length: 8 }, () => ({
      freshExecuted: true,
      disposition: "FRESH",
      commandsAvoided: [],
    })),
    commandsAvoided: [],
    finalization: { decision: "PASS", errors: [], remainder: [] },
  };
  assert.equal(posttechnicalController.validatePosttechnicalFreshResult(result).qualification, false);
  for (const mutate of [
    (value) => {
      value.freshObligations = 7;
    },
    (value) => {
      value.reconciliation[0].disposition = "PRESERVED";
    },
    (value) => {
      value.reconciliation[0].freshExecuted = false;
    },
    (value) => {
      value.finalization.remainder.push("missing");
    },
    (value) => {
      value.obligations.reverse();
    },
  ]) {
    const changed = structuredClone(result);
    mutate(changed);
    assert.throws(
      () => posttechnicalController.validatePosttechnicalFreshResult(changed),
      /(?:TECHNICAL_NOT_FRESH_COMPLETE|GROUPS_CHANGED)/u,
    );
  }
});

function decryptSyntheticEnvelope(bytes, privateKey) {
  const envelope = JSON.parse(bytes),
    aad = Buffer.from(envelope.aad, "base64"),
    header = JSON.parse(aad);
  const key = posttechnicalCrypto.privateDecrypt(
    {
      key: privateKey,
      oaepHash: "sha256",
      oaepLabel: Buffer.from("VW-POSTTECHNICAL-EVIDENCE-1"),
      padding: posttechnicalCrypto.constants.RSA_PKCS1_OAEP_PADDING,
    },
    Buffer.from(header.wrappedKey, "base64"),
  );
  const decipher = posttechnicalCrypto.createDecipheriv("aes-256-gcm", key, Buffer.from(header.nonce, "base64"));
  decipher.setAAD(aad);
  decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, "base64")), decipher.final()]));
}

test("private diagnostic envelope roundtrips exact bytes and authenticates header, payload and tag", () => {
  const keys = posttechnicalCrypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  const files = [{ name: "private/PRIVATE_LOG_NAME.txt", bytes: Buffer.from("PRIVATE_LOG_BYTES\u0000\n") }];
  const aad = {
    version: 1,
    diagnosticId: "SYNTHETIC_ONLY",
    runId: 123,
    policyDigest: "a".repeat(64),
    keyId: "b".repeat(64),
    installer: "c".repeat(40),
    candidate: "d".repeat(40),
    historicalBase: "e".repeat(40),
  };
  const bytes = posttechnicalController.sealPosttechnicalEvidence({ files, aad, publicKey: keys.publicKey });
  assert.equal(bytes.includes(Buffer.from("PRIVATE_LOG")), false);
  const decoded = decryptSyntheticEnvelope(bytes, keys.privateKey);
  assert.equal(decoded.files[0].name, files[0].name);
  assert.deepEqual(Buffer.from(decoded.files[0].content, "base64"), files[0].bytes);
  assert.equal(decoded.files[0].sha256, createHash("sha256").update(files[0].bytes).digest("hex"));
  for (const field of ["aad", "ciphertext", "tag"]) {
    const changed = JSON.parse(bytes),
      value = Buffer.from(changed[field], "base64");
    value[0] ^= 1;
    changed[field] = value.toString("base64");
    assert.throws(() => decryptSyntheticEnvelope(Buffer.from(JSON.stringify(changed)), keys.privateKey));
  }
});

test("private evidence collector excludes lease, counters and databases and rejects symlink escapes", async (t) => {
  const root = await fixture(t);
  await mkdir(path.join(root, "private"), { mode: 0o700 });
  await writeFile(path.join(root, "private/worker.stdout.log"), "synthetic-output", { mode: 0o600 });
  for (const name of ["suite-lease.json", "setup-1-started.json", "owner.db"])
    await writeFile(path.join(root, "private", name), "PRIVATE_CAPABILITY", { mode: 0o600 });
  const evidence = posttechnicalController.collectPosttechnicalEvidence({ workspace: root });
  assert.equal(evidence.members.length, 1);
  assert.equal(evidence.members[0].name, "private/worker.stdout.log");
  const { symlink } = await import("node:fs/promises");
  await mkdir(path.join(root, "private/html-report"));
  await symlink(path.join(root, "private/suite-lease.json"), path.join(root, "private/html-report/escape.json"));
  assert.throws(
    () => posttechnicalController.collectPosttechnicalEvidence({ workspace: root }),
    /EVIDENCE_PATH_INVALID/u,
  );
});

test("posttechnical command observation retains the exact failing child privately through authenticated encryption", async (t) => {
  const root = await fixture(t);
  await mkdir(path.join(root, "private"), { mode: 0o700 });
  const args = ["--test", "tests/sounding-line/ordinary.test.mjs", "PRIVATE_ARGV"],
    environment = { PRIVATE_TOKEN: "PRIVATE_ENVIRONMENT" },
    command = "/PRIVATE/node",
    error = Object.assign(new Error("PRIVATE_ORIGINAL_MESSAGE"), {
      code: "ETIMEDOUT",
      errno: -110,
      syscall: "spawnSync /PRIVATE/node",
      status: null,
      signal: "SIGTERM",
      pid: 314,
      path: command,
      spawnargs: args,
    }),
    result = {},
    execution = { runId: 123, installerSha: "a".repeat(40) };
  let calls = 0;
  const runner = posttechnicalController.createPosttechnicalCommandExecutor({
    workspace: root,
    execution,
    result,
    spawnImpl(actualCommand, actualArgs, options) {
      calls++;
      assert.equal(actualCommand, command);
      assert.equal(actualArgs, args);
      assert.deepEqual(options, {
        cwd: path.join(root, "candidate"),
        env: environment,
        stdio: ["ignore", "inherit", "inherit"],
        timeout: posttechnical.POSTTECHNICAL_POLICY.commandMs,
        killSignal: "SIGTERM",
        windowsHide: true,
      });
      return { error, status: null, signal: "SIGTERM", pid: 314, stdout: null, stderr: null };
    },
  });
  try {
    assert.throws(() => runner.execute(command, args, environment, "technical", 6), /WORKER_UNKNOWN/u);
  } finally {
    runner.close();
  }
  assert.equal(calls, 1);
  assert.equal(runner.state.records, 2);
  assert.equal(runner.state.evidenceLoss, false);
  const journal = await readFile(path.join(root, "private/command-executions.original.jsonl")),
    [started, terminal] = journal.toString().trimEnd().split("\n").map(JSON.parse);
  assert.equal(started.event, "STARTED");
  assert.equal(terminal.event, "TERMINAL");
  assert.equal(terminal.phase, "technical");
  assert.equal(terminal.ordinal, 6);
  assert.equal(terminal.runId, execution.runId);
  assert.equal(terminal.installerSha, execution.installerSha);
  assert.equal(terminal.executable, command);
  assert.deepEqual(terminal.argv, args);
  assert.equal(terminal.cwd, path.join(root, "candidate"));
  assert.match(terminal.startedAt, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/u);
  assert.equal(terminal.elapsedMs >= 0, true);
  assert.equal(terminal.errorSource, "CHILD_ERROR");
  assert.deepEqual(terminal.error, {
    available: true,
    name: error.name,
    message: error.message,
    stack: error.stack,
    code: error.code,
    errno: error.errno,
    syscall: error.syscall,
    status: null,
    signal: error.signal,
    pid: error.pid,
    path: error.path,
    spawnargs: args,
  });
  assert.equal(terminal.exitCode, null);
  assert.equal(terminal.signal, "SIGTERM");
  assert.equal(terminal.pid, 314);
  assert.deepEqual(terminal.stdout, { available: false });
  assert.deepEqual(terminal.stderr, { available: false });
  assert.equal(journal.includes(Buffer.from("PRIVATE_ENVIRONMENT")), false);
  const { stat } = await import("node:fs/promises");
  assert.equal((await stat(path.join(root, "private/command-executions.original.jsonl"))).mode & 0o777, 0o600);
  const evidence = posttechnicalController.collectPosttechnicalEvidence({ workspace: root });
  assert.deepEqual(
    evidence.members.map((member) => member.name),
    ["private/command-executions.original.jsonl"],
  );
  const keys = posttechnicalCrypto.generateKeyPairSync("rsa", { modulusLength: 2048 }),
    encrypted = posttechnicalController.sealPosttechnicalEvidence({
      files: evidence.members,
      aad: { version: 1 },
      publicKey: keys.publicKey,
    }),
    decoded = decryptSyntheticEnvelope(encrypted, keys.privateKey);
  assert.deepEqual(Buffer.from(decoded.files[0].content, "base64"), journal);
  assert.equal(encrypted.includes(Buffer.from("PRIVATE_ORIGINAL_MESSAGE")), false);
  const summary = {
    version: 1,
    diagnosticId: posttechnical.POSTTECHNICAL_POLICY.id,
    policyDigest: posttechnical.posttechnicalPolicyDigest,
    status: "EXECUTION_UNKNOWN",
    completeness: "DIAGNOSTIC_INCOMPLETE",
    qualification: false,
    originalCauseClaim: false,
    grantsConsumerTrial: false,
    worker: { result },
  };
  assert.equal(posttechnicalController.validatePosttechnicalPublicReceipt(summary), summary);
  assert.deepEqual(Object.keys(result.failedCommand).sort(), [
    "argvDigest",
    "durationMs",
    "errorCode",
    "exitCode",
    "ordinal",
    "phase",
    "signal",
  ]);
  assert.equal(result.failedCommand.errorCode, "ETIMEDOUT");
  assert.equal(result.failedCommand.argvDigest, posttechnical.posttechnicalDigest(args));
  assert.equal(JSON.stringify(summary).includes("PRIVATE"), false);
  assert.equal(JSON.stringify(summary).includes(root), false);
  for (const changed of [
    { ...result.failedCommand, phase: "SOURCE_RECOGNITION" },
    { ...result.failedCommand, ordinal: 13 },
    { ...result.failedCommand, errorCode: "PRIVATE_ERROR" },
    { ...result.failedCommand, signal: "PRIVATE_SIGNAL" },
    { ...result.failedCommand, argv: args },
    { ...result.failedCommand, durationMs: -1 },
  ])
    assert.throws(
      () =>
        posttechnicalController.validatePosttechnicalPublicReceipt({
          ...summary,
          worker: { result: { failedCommand: changed } },
        }),
      /RESULT_INVALID/u,
    );
});

test("posttechnical child outcomes distinguish observed nonzero exits from uncertain completion without inferring a cause", async (t) => {
  const cases = [
    {
      child: { status: 7, signal: null, pid: 31 },
      phase: "setup",
      failure: "SETUP_COMMAND_FAILED",
      exitCode: 7,
      signal: null,
      errorCode: null,
    },
    {
      child: { status: 1, signal: null, pid: 32 },
      phase: "technical",
      failure: "TECHNICAL_COMMAND_FAILED",
      exitCode: 1,
      signal: null,
      errorCode: null,
    },
    {
      child: { status: null, signal: "SIGKILL", pid: 33 },
      phase: "technical",
      failure: "WORKER_UNKNOWN",
      exitCode: null,
      signal: "SIGKILL",
      errorCode: null,
    },
    {
      child: { status: null, signal: null, pid: 34 },
      phase: "technical",
      failure: "WORKER_UNKNOWN",
      exitCode: null,
      signal: null,
      errorCode: null,
    },
    {
      child: { status: null, error: Object.assign(new Error("PRIVATE_UNKNOWN_CODE"), { code: "PRIVATE_CODE" }) },
      phase: "technical",
      failure: "WORKER_UNKNOWN",
      exitCode: null,
      signal: null,
      errorCode: "UNKNOWN",
    },
    {
      thrown: Object.assign(new Error("PRIVATE_SPAWN_THROW"), { code: "ENOENT" }),
      phase: "setup",
      failure: "WORKER_UNKNOWN",
      exitCode: null,
      signal: null,
      errorCode: "ENOENT",
    },
  ];
  for (const value of cases) {
    const root = await fixture(t);
    await mkdir(path.join(root, "private"), { mode: 0o700 });
    const result = {},
      runner = posttechnicalController.createPosttechnicalCommandExecutor({
        workspace: root,
        execution: { runId: 123, installerSha: "a".repeat(40) },
        result,
        spawnImpl() {
          if (value.thrown) throw value.thrown;
          return value.child;
        },
      });
    try {
      assert.throws(
        () => runner.execute("synthetic-command", ["PRIVATE_ARGV"], {}, value.phase, 1),
        new RegExp(value.failure, "u"),
      );
    } finally {
      runner.close();
    }
    assert.equal(result.failedCommand.exitCode, value.exitCode);
    assert.equal(result.failedCommand.signal, value.signal);
    assert.equal(result.failedCommand.errorCode, value.errorCode);
    assert.equal(JSON.stringify(result).includes("PRIVATE"), false);
    const terminal = (await readFile(path.join(root, "private/command-executions.original.jsonl"), "utf8"))
      .trimEnd()
      .split("\n")
      .map(JSON.parse)[1];
    assert.equal(terminal.error.available, Boolean(value.child?.error || value.thrown));
    assert.equal(terminal.errorSource, value.thrown ? "SPAWN_THROW" : value.child.error ? "CHILD_ERROR" : "NONE");
    assert.equal(terminal.elapsedMs, result.failedCommand.durationMs);
  }
});

test("command evidence keeps partial authenticated bytes and excludes every counter and unlisted private sibling", async (t) => {
  const root = await fixture(t);
  await mkdir(path.join(root, "private"), { mode: 0o700 });
  assert.deepEqual(posttechnicalController.collectPosttechnicalEvidence({ workspace: root }).members, []);
  const partial = Buffer.from('{"event":"STARTED","ordinal":6}\n{"event":"TERMINAL"');
  await writeFile(path.join(root, "private/command-executions.original.jsonl"), partial, { mode: 0o600 });
  for (const [phase, count] of [
    ["setup", 3],
    ["technical", 12],
  ])
    for (let ordinal = 1; ordinal <= count; ordinal++)
      for (const event of ["started", "terminal"])
        await writeFile(path.join(root, "private", `${phase}-${ordinal}-${event}.json`), "PRIVATE_COUNTER", {
          mode: 0o600,
        });
  for (const name of ["command-executions.other.jsonl", "command-executions.original.jsonl.backup", "suite-lease.json"])
    await writeFile(path.join(root, "private", name), "PRIVATE_CAPABILITY", { mode: 0o600 });
  const evidence = posttechnicalController.collectPosttechnicalEvidence({ workspace: root });
  assert.deepEqual(
    evidence.members.map((member) => member.name),
    ["private/command-executions.original.jsonl"],
  );
  assert.deepEqual(evidence.members[0].bytes, partial);
  const keys = posttechnicalCrypto.generateKeyPairSync("rsa", { modulusLength: 2048 }),
    encrypted = posttechnicalController.sealPosttechnicalEvidence({
      files: evidence.members,
      aad: { version: 1 },
      publicKey: keys.publicKey,
    });
  assert.deepEqual(
    Buffer.from(decryptSyntheticEnvelope(encrypted, keys.privateKey).files[0].content, "base64"),
    partial,
  );
  assert.throws(
    () =>
      posttechnicalController.collectPosttechnicalEvidence({
        workspace: root,
        limits: { jsonBytes: partial.length - 1 },
      }),
    /EVIDENCE_PATH_INVALID/u,
  );
  const { link, unlink, symlink } = await import("node:fs/promises"),
    journal = path.join(root, "private/command-executions.original.jsonl"),
    alias = path.join(root, "private/journal-hardlink");
  await link(journal, alias);
  assert.throws(
    () => posttechnicalController.collectPosttechnicalEvidence({ workspace: root }),
    /EVIDENCE_PATH_INVALID/u,
  );
  await unlink(alias);
  await unlink(journal);
  await symlink(path.join(root, "private/suite-lease.json"), journal);
  assert.throws(() => posttechnicalController.collectPosttechnicalEvidence({ workspace: root }), { code: "ELOOP" });
});

test("command journal is create-only and bounded, and unavailable error metadata cannot claim completion", async (t) => {
  for (const failure of ["started-cap", "terminal-cap", "error-getter"]) {
    const root = await fixture(t);
    await mkdir(path.join(root, "private"), { mode: 0o700 });
    let calls = 0;
    const error = new Error("PRIVATE_ORIGINAL_MESSAGE"),
      result = {};
    if (failure === "terminal-cap") error.stack = "PRIVATE_STACK".repeat(1000);
    if (failure === "error-getter")
      Object.defineProperty(error, "stack", {
        get() {
          throw new Error("PRIVATE_GETTER");
        },
      });
    const runner = posttechnicalController.createPosttechnicalCommandExecutor({
      workspace: root,
      execution: { runId: 123, installerSha: "a".repeat(40) },
      result,
      maximumBytes: failure === "started-cap" ? 1 : failure === "terminal-cap" ? 4096 : undefined,
      spawnImpl() {
        calls++;
        return { error, status: null, signal: "SIGTERM", pid: 35 };
      },
    });
    try {
      assert.throws(
        () => runner.execute("synthetic-command", ["PRIVATE_ARGV"], {}, "technical", 6),
        failure === "started-cap" ? /RAW_EVIDENCE_LOSS/u : /WORKER_UNKNOWN/u,
      );
    } finally {
      runner.close();
    }
    assert.equal(runner.state.evidenceLoss, true);
    assert.equal(calls, failure === "started-cap" ? 0 : 1);
    assert.equal(runner.state.records, failure === "started-cap" ? 0 : 1);
    if (calls) {
      assert.equal(result.failedCommand.exitCode, null);
      assert.equal(result.failedCommand.signal, "SIGTERM");
    }
    const journal = await readFile(path.join(root, "private/command-executions.original.jsonl"));
    assert.equal(
      journal.length <=
        (failure === "started-cap"
          ? 1
          : failure === "terminal-cap"
            ? 4096
            : posttechnical.POSTTECHNICAL_POLICY.reportLimit),
      true,
    );
    assert.throws(
      () => posttechnicalController.createPosttechnicalCommandExecutor({ workspace: root, execution: {}, result: {} }),
      /RAW_EVIDENCE_LOSS/u,
    );
    assert.deepEqual(await readFile(path.join(root, "private/command-executions.original.jsonl")), journal);
  }
});

test("command journal write and close uncertainty is explicit while the observed child outcome stays intact", async (t) => {
  const fileSystem = await import("node:fs");
  for (const failure of ["terminal-write", "close"]) {
    const root = await fixture(t);
    await mkdir(path.join(root, "private"), { mode: 0o700 });
    let writes = 0,
      calls = 0;
    const result = {},
      runner = posttechnicalController.createPosttechnicalCommandExecutor({
        workspace: root,
        execution: { runId: 123, installerSha: "a".repeat(40) },
        result,
        spawnImpl() {
          calls++;
          return { status: failure === "close" ? 0 : 3, signal: null, pid: 41 };
        },
        fileImplementation: {
          openSync: fileSystem.openSync,
          writeSync(descriptor, bytes, offset, length) {
            if (++writes === 2 && failure === "terminal-write") {
              fileSystem.writeSync(descriptor, bytes, offset, 17);
              throw Object.assign(new Error("PRIVATE_WRITE_FAILURE"), { code: "EIO" });
            }
            return fileSystem.writeSync(descriptor, bytes, offset, length);
          },
          closeSync(descriptor) {
            fileSystem.closeSync(descriptor);
            if (failure === "close") throw new Error("PRIVATE_CLOSE_FAILURE");
          },
        },
      });
    if (failure === "terminal-write")
      assert.throws(
        () => runner.execute("synthetic-command", ["PRIVATE_ARGV"], {}, "technical", 6),
        /TECHNICAL_COMMAND_FAILED/u,
      );
    else runner.execute("synthetic-command", ["PRIVATE_ARGV"], {}, "technical", 6);
    runner.close();
    assert.equal(calls, 1);
    assert.equal(runner.state.evidenceLoss, true);
    assert.equal(result.failedCommand?.exitCode, failure === "terminal-write" ? 3 : undefined);
    const collected = posttechnicalController.collectPosttechnicalEvidence({ workspace: root });
    assert.equal(collected.members.length, 1);
    const journal = collected.members[0].bytes;
    assert.equal(journal.length, runner.state.bytes + (failure === "terminal-write" ? 17 : 0));
    assert.equal(runner.state.records, failure === "terminal-write" ? 1 : 2);
    assert.equal(journal.includes(Buffer.from("PRIVATE_WRITE_FAILURE")), false);
    assert.equal(journal.includes(Buffer.from("PRIVATE_CLOSE_FAILURE")), false);
  }
});

test("legacy terminal counter failure preserves the full observed child journal and original outcome without overwriting counters", async (t) => {
  const error = Object.assign(new Error("PRIVATE_ORIGINAL_CHILD_FAILURE"), {
    code: "ETIMEDOUT",
    errno: -110,
    syscall: "spawnSync synthetic-command",
    path: "synthetic-command",
    spawnargs: ["PRIVATE_ARGV"],
  });
  for (const value of [
    { child: { error, status: null, signal: "SIGTERM", pid: 51 }, expected: "WORKER_UNKNOWN" },
    { child: { status: 3, signal: null, pid: 52 }, expected: "TECHNICAL_COMMAND_FAILED" },
    { child: { status: 0, signal: null, pid: 53 }, expected: "RAW_EVIDENCE_LOSS" },
  ]) {
    const root = await fixture(t);
    await mkdir(path.join(root, "private"), { mode: 0o700 });
    const counter = path.join(root, "private/technical-6-terminal.json"),
      existingCounter = Buffer.from('{"PRIVATE_EXISTING_COUNTER":"must remain unchanged"}\n');
    await writeFile(counter, existingCounter, { mode: 0o600, flag: "wx" });
    let calls = 0;
    const result = {},
      runner = posttechnicalController.createPosttechnicalCommandExecutor({
        workspace: root,
        execution: { runId: 123, installerSha: "a".repeat(40) },
        result,
        spawnImpl() {
          calls++;
          return value.child;
        },
      });
    try {
      assert.throws(
        () => runner.execute("synthetic-command", ["PRIVATE_ARGV"], {}, "technical", 6),
        new RegExp(value.expected, "u"),
      );
    } finally {
      runner.close();
    }
    assert.equal(calls, 1);
    assert.equal(runner.state.evidenceLoss, true);
    assert.equal(runner.state.records, 2);
    assert.deepEqual(await readFile(counter), existingCounter);
    const evidence = posttechnicalController.collectPosttechnicalEvidence({ workspace: root });
    assert.deepEqual(
      evidence.members.map((member) => member.name),
      ["private/command-executions.original.jsonl"],
    );
    const [started, terminal] = evidence.members[0].bytes.toString().trimEnd().split("\n").map(JSON.parse);
    assert.equal(started.event, "STARTED");
    assert.equal(terminal.event, "TERMINAL");
    assert.equal(terminal.exitCode, value.child.status);
    assert.equal(terminal.signal, value.child.signal);
    assert.equal(terminal.pid, value.child.pid);
    assert.deepEqual(terminal.argv, ["PRIVATE_ARGV"]);
    assert.equal(terminal.error.available, Boolean(value.child.error));
    assert.equal(terminal.status, value.child.status === 0 ? "PASS" : "FAIL");
    if (value.child.error) {
      assert.equal(terminal.error.name, error.name);
      assert.equal(terminal.error.message, error.message);
      assert.equal(terminal.error.stack, error.stack);
      assert.equal(terminal.error.code, error.code);
      assert.equal(terminal.error.errno, error.errno);
      assert.equal(terminal.error.syscall, error.syscall);
      assert.equal(terminal.error.path, error.path);
      assert.deepEqual(terminal.error.spawnargs, error.spawnargs);
    }
    if (value.child.status === 0) assert.equal(result.failedCommand, undefined);
    else {
      assert.equal(result.failedCommand.exitCode, value.child.status);
      assert.equal(result.failedCommand.signal, value.child.signal);
      assert.equal(JSON.stringify(result).includes("PRIVATE"), false);
    }
  }
});

test("posttechnical private suite lease binds exact argv, direct parent and nonce and has one create-only start", async (t) => {
  const root = await fixture(t);
  await mkdir(path.join(root, "private"), { mode: 0o700 });
  const P = posttechnical.POSTTECHNICAL_POLICY,
    W = posttechnical.POSTTECHNICAL_WORKLOAD;
  const paths = posttechnical.posttechnicalPrivatePaths(root),
    candidate = path.join(root, "candidate");
  const originalArguments = [
    "scripts/sounding-line/run-browser-suite.mjs",
    "--profile",
    "generic",
    "--candidate",
    W.candidate,
    "--database-url",
    `file:./artifacts/sounding-line/generic-${W.candidate.slice(0, 12)}/validation-isolated-19700101-000000000-${W.candidate.slice(0, 32)}.db`,
    "--",
    ...new Set(posttechnical.POSTTECHNICAL_CASES.map((entry) => entry.spec)),
  ];
  const marker = {
    version: 1,
    policyDigest: posttechnical.posttechnicalPolicyDigest,
    diagnosticId: P.id,
    reservation: "f".repeat(40),
    nonce: "12345678-1234-1234-1234-123456789abc",
    coordinatorPid: 1234,
    candidate,
    installer: path.join(root, "installer"),
    installerSha: "a".repeat(40),
    originalDecisionDigest: W.originalDecisionSha256,
    commandOrdinal: 8,
    originalArguments,
    runId: 123456,
  };
  const environment = {
    ...sourceDiagnosticEnvironment(),
    GITHUB_JOB: "posttechnical-diagnostic",
    GITHUB_WORKSPACE: root,
    GITHUB_WORKFLOW_REF: `${P.repository}/${P.workflow}@refs/heads/main`,
    CI: "true",
    POSTTECHNICAL_SUITE_LEASE: marker.nonce,
  };
  const argv = posttechnical.posttechnicalSuiteArguments({ candidate, lease: paths.lease, originalArguments });
  const invoke = (change = {}) =>
    posttechnical.validatePosttechnicalLease({
      marker,
      root: candidate,
      candidateSha: W.candidate,
      argv,
      leasePath: paths.lease,
      environment,
      parentPid: 1234,
      now: sourceDiagnosticNow(),
      ...change,
    });
  assert.equal(invoke().suiteStarted, paths.suiteStarted);
  for (const change of [
    { parentPid: 1235 },
    { argv: [...argv, "--retries", "1"] },
    { argv: [...argv, "--r13-technical-proof", "corrected"] },
    { marker: { ...marker, commandOrdinal: 9 } },
    { environment: { ...environment, POSTTECHNICAL_SUITE_LEASE: "wrong" } },
    { environment: { ...environment, SOUNDING_LINE_EXCEPTION_PHASE: "qualify" } },
    { environment: { ...environment, SOUNDING_LINE_R13_TECHNICAL_LEASE: "old" } },
  ])
    assert.throws(() => invoke(change), /SUITE_BINDING_CHANGED/u);
  posttechnical.writePosttechnicalPrivate(paths.suiteStarted, { synthetic: true });
  assert.throws(() => posttechnical.writePosttechnicalPrivate(paths.suiteStarted, { synthetic: true }), {
    code: "EEXIST",
  });
  assert.deepEqual(posttechnical.readPosttechnicalPrivate(paths.suiteStarted), { synthetic: true });
});

test("posttechnical ambiguous remote claim write is never retried", async () => {
  let refWrites = 0;
  const request = async (endpoint, method = "GET") => {
    if (method === "GET" && endpoint.startsWith("git/ref/")) return null;
    if (method === "GET" && endpoint.startsWith("git/commits/")) return { tree: { sha: "b".repeat(40) } };
    if (method === "POST" && ["git/blobs", "git/trees", "git/commits"].includes(endpoint))
      return { sha: "c".repeat(40) };
    if (method === "POST" && endpoint === "git/refs") {
      refWrites++;
      throw Error("PRODUCT_EXPERIENCE_EXCEPTION_CUSTODY_WRITE_OUTCOME_UNKNOWN");
    }
    assert.fail("unexpected synthetic claim request");
  };
  await assert.rejects(
    posttechnicalController.createPosttechnicalReservation({
      request,
      execution: { installerSha: "a".repeat(40), runId: 123456, workflowId: 55 },
    }),
    /WRITE_OUTCOME_UNKNOWN/u,
  );
  assert.equal(refWrites, 1);
});

test("posttechnical public summary rejects raw paths, errors and unrecognized data before publication", () => {
  const P = posttechnical.POSTTECHNICAL_POLICY;
  const summary = {
    version: 1,
    diagnosticId: P.id,
    policyDigest: posttechnical.posttechnicalPolicyDigest,
    status: "EXECUTION_UNKNOWN",
    completeness: "DIAGNOSTIC_INCOMPLETE",
    qualification: false,
    originalCauseClaim: false,
    grantsConsumerTrial: false,
  };
  assert.equal(posttechnicalController.validatePosttechnicalPublicReceipt(summary), summary);
  for (const change of [
    { privatePath: "/PRIVATE/owner" },
    { message: "PRIVATE_ERROR" },
    { status: "https://PRIVATE.example" },
    { failure: "/PRIVATE/owner" },
    { qualification: true },
  ])
    assert.throws(
      () => posttechnicalController.validatePosttechnicalPublicReceipt({ ...summary, ...change }),
      /RESULT_INVALID/u,
    );
  const inherited = {
    ...sourceDiagnosticEnvironment(),
    GITHUB_OUTPUT: "/PRIVATE/output",
    GITHUB_ENV: "/PRIVATE/environment",
    GITHUB_PATH: "/PRIVATE/path",
    GITHUB_STEP_SUMMARY: "/PRIVATE/summary",
    GITHUB_STATE: "/PRIVATE/state",
  };
  const worker = posttechnicalController.posttechnicalWorkerEnvironment(inherited, "/synthetic/workspace");
  for (const key of [
    "GITHUB_OUTPUT",
    "GITHUB_ENV",
    "GITHUB_PATH",
    "GITHUB_STEP_SUMMARY",
    "GITHUB_STATE",
    "DATABASE_URL",
  ])
    assert.equal(worker[key], undefined);
  const app = posttechnical.scrubPosttechnicalSuiteEnvironment(inherited);
  for (const key of ["GITHUB_OUTPUT", "GITHUB_ENV", "GITHUB_PATH", "GITHUB_STEP_SUMMARY", "GITHUB_STATE"])
    assert.equal(app[key], undefined);
});

test("artifact publication output requires complete ciphertext, exact safe receipt and proven worker cleanup", async (t) => {
  const root = await fixture(t),
    P = posttechnical.POSTTECHNICAL_POLICY,
    W = posttechnical.POSTTECHNICAL_WORKLOAD;
  const keys = posttechnicalCrypto.generateKeyPairSync("rsa", { modulusLength: 3072 });
  const execution = { runId: 123456, installerSha: "a".repeat(40) };
  const bytes = posttechnicalController.sealPosttechnicalEvidence({
    files: [{ name: "synthetic/private.log", bytes: Buffer.from("PRIVATE_RAW") }],
    publicKey: keys.publicKey,
    aad: {
      version: 1,
      diagnosticId: P.id,
      runId: execution.runId,
      policyDigest: posttechnical.posttechnicalPolicyDigest,
      keyId: P.evidenceKeyDigest,
      installer: execution.installerSha,
      candidate: W.candidate,
      historicalBase: W.base,
      repository: P.repository,
      runAttempt: 1,
      job: "posttechnical-diagnostic",
      originalRun: sourceDiagnosticPolicy.failedRun,
      originalInputDigest: W.originalDecisionSha256,
      originalArchiveDigest: sourceDiagnosticPolicy.archiveDigest,
      originalPlanDigest: P.originalPlanDigest,
      workloadDigest: W.orderedTuplesSha256,
    },
  });
  const summary = {
    version: 1,
    diagnosticId: P.id,
    policyDigest: posttechnical.posttechnicalPolicyDigest,
    status: "TECHNICAL_DIAGNOSTIC_INCOMPLETE",
    completeness: "DIAGNOSTIC_INCOMPLETE",
    qualification: false,
    originalCauseClaim: false,
    grantsConsumerTrial: false,
    execution,
    workerStarted: true,
    worker: { closureProven: true, cleanup: { status: "PASS", treeReaped: true, streamsClosed: true } },
    encryptedEvidence: {
      keyId: P.evidenceKeyDigest,
      format: "VW-POSTTECHNICAL-EVIDENCE-1",
      ciphertextBytes: bytes.length,
      ciphertextDigest: createHash("sha256").update(bytes).digest("hex"),
    },
  };
  const summaryFile = path.join(root, "reproduction.json"),
    encryptedFile = path.join(root, "private-evidence.encrypted"),
    outputFile = path.join(root, "github-output");
  await writeFile(summaryFile, JSON.stringify(summary));
  await writeFile(encryptedFile, bytes);
  await writeFile(outputFile, "");
  assert.equal(
    posttechnicalController.assertPosttechnicalPublication({ summary, summaryFile, encryptedFile, outputFile }),
    true,
  );
  assert.equal(await readFile(outputFile, "utf8"), "evidence_safe=true\n");
  await writeFile(outputFile, "");
  assert.throws(
    () =>
      posttechnicalController.assertPosttechnicalPublication({
        summary: { ...summary, worker: { cleanup: { status: "FAIL", treeReaped: false, streamsClosed: false } } },
        summaryFile,
        encryptedFile,
        outputFile,
      }),
    /RESULT_INVALID/u,
  );
  await writeFile(encryptedFile, bytes.subarray(0, bytes.length - 1));
  assert.throws(
    () => posttechnicalController.assertPosttechnicalPublication({ summary, summaryFile, encryptedFile, outputFile }),
    /RESULT_INVALID/u,
  );
  assert.equal(await readFile(outputFile, "utf8"), "");
});

test("new posttechnical actor, trigger, ref, job and expiry denials happen before any API read", async () => {
  for (const overrides of [
    { GITHUB_ACTOR: "other" },
    { GITHUB_TRIGGERING_ACTOR: "other" },
    { GITHUB_REF: "refs/heads/candidate" },
    { GITHUB_JOB: "final-check" },
  ]) {
    const api = posttechnicalApiFixture();
    Object.assign(api.environment, overrides);
    await assert.rejects(
      posttechnicalController.validatePosttechnicalExecution({
        request: api.request,
        environment: api.environment,
        job: "reserve-diagnostic",
        installerSha: api.environment.GITHUB_SHA,
        now: sourceDiagnosticNow(),
      }),
      /EXECUTOR_CHANGED/u,
    );
    assert.equal(api.calls.length, 0);
  }
  const api = posttechnicalApiFixture();
  await assert.rejects(
    posttechnicalController.validatePosttechnicalExecution({
      request: api.request,
      environment: api.environment,
      job: "reserve-diagnostic",
      installerSha: api.environment.GITHUB_SHA,
      now: new Date("2026-10-23T00:00:00Z"),
    }),
    /EXECUTOR_CHANGED/u,
  );
  assert.equal(api.calls.length, 0);
});

test("foreign lease selector is rejected before reading or parsing a private JSON file", async (t) => {
  const root = await fixture(t);
  await mkdir(path.join(root, "private"), { mode: 0o700 });
  const foreign = path.join(root, "foreign.json");
  await writeFile(foreign, "MALFORMED_PRIVATE_JSON", { mode: 0o600 });
  await assert.rejects(
    posttechnical.requirePosttechnicalDiagnosticSuite({
      root: path.join(root, "candidate"),
      candidateSha: posttechnical.POSTTECHNICAL_WORKLOAD.candidate,
      options: { "posttechnical-diagnostic": foreign },
      browserTests: [...new Set(posttechnical.POSTTECHNICAL_CASES.map((item) => item.spec))],
      argv: [],
      environment: { GITHUB_WORKSPACE: root },
    }),
    /PRIVATE_PATH_INVALID/u,
  );
  assert.equal(await readFile(foreign, "utf8"), "MALFORMED_PRIVATE_JSON");
});

test("technical scopes advance but only the exact browser command receives its diagnostic context", () => {
  for (let ordinal = 1; ordinal <= 12; ordinal++) {
    const context = { [BROWSER_DIAGNOSTIC_CONTEXT]: `fresh-${ordinal}` };
    const environment = posttechnicalController.posttechnicalCommandEnvironment({
      base: { CI: "true", [BROWSER_DIAGNOSTIC_CONTEXT]: "ambient" },
      overrides: { [BROWSER_DIAGNOSTIC_CONTEXT]: "untrusted-override" },
      scopeEnvironment: context,
      ordinal,
    });
    assert.equal(
      environment[BROWSER_DIAGNOSTIC_CONTEXT],
      ordinal === 8 ? context[BROWSER_DIAGNOSTIC_CONTEXT] : undefined,
    );
  }
});

test("closed partial supervision remains publishable evidence while uncertainty cannot claim execution success", () => {
  const closure = { status: "PASS", treeReaped: true, streamsClosed: true };
  for (const change of [{ exceeded: true }, { timedOut: true }, { ioFailed: true }, { resultInvalid: true }]) {
    const result = posttechnicalController.posttechnicalSupervisionOutcome({
      exit: { code: 1 },
      cleanup: closure,
      counts: [12, 34],
      saved: [12, 34],
      result: null,
      ...change,
    });
    assert.equal(result.closureProven, true);
    assert.equal(result.incomplete, true);
    assert.deepEqual(result.rawLogBytes, [12, 34]);
  }
  const unknown = posttechnicalController.posttechnicalSupervisionOutcome({
    exit: { code: null },
    cleanup: { status: "FAIL", treeReaped: false, streamsClosed: false },
    counts: [1, 2],
    saved: [1, 2],
    result: null,
  });
  assert.equal(unknown.closureProven, false);
  assert.equal(unknown.incomplete, true);
});

test("unsafe source result is retained privately while public fallback is a fresh minimal UNKNOWN", async (t) => {
  const root = await fixture(t);
  await mkdir(path.join(root, "private"), { mode: 0o700 });
  const raw = Buffer.from('{"source":{"message":"PRIVATE_ORIGINAL_GIT_FAILURE"},"malformed":');
  await writeFile(path.join(root, "private/worker-result.json"), raw, { mode: 0o600 });
  const collected = posttechnicalController.collectPosttechnicalEvidence({ workspace: root });
  assert.deepEqual(collected.members.find((member) => member.name === "private/worker-result.json").bytes, raw);
  const fallback = posttechnicalController.minimalPosttechnicalUnknownReceipt({
    execution: { runId: 123, installerSha: "a".repeat(40), workflowId: 55 },
    workerStarted: true,
    worker: { closureProven: true, result: { source: { raw: "PRIVATE" } } },
  });
  assert.equal(fallback.status, "EXECUTION_UNKNOWN");
  assert.equal(fallback.worker.closureProven, true);
  assert.equal(JSON.stringify(fallback).includes("PRIVATE"), false);
  assert.equal(fallback.worker.result, undefined);
});

test("secure collection rejects hardlinks, symlinks, foreign paths and inexpensive configured caps", async (t) => {
  const root = await fixture(t);
  await mkdir(path.join(root, "private"), { mode: 0o700 });
  const file = path.join(root, "private/worker.stdout.log");
  await writeFile(file, "1234567890", { mode: 0o600 });
  assert.equal(posttechnical.securePosttechnicalRead({ file, root, maximum: 10 }).toString(), "1234567890");
  assert.throws(() => posttechnical.securePosttechnicalRead({ file, root, maximum: 9 }), /EVIDENCE_PATH_INVALID/u);
  assert.throws(
    () => posttechnicalController.collectPosttechnicalEvidence({ workspace: root, limits: { rawBytes: 9 } }),
    /EVIDENCE_/u,
  );
  const { link, unlink } = await import("node:fs/promises");
  const alias = path.join(root, "private/alias.log");
  await link(file, alias);
  assert.throws(() => posttechnical.securePosttechnicalRead({ file, root, maximum: 10 }), /EVIDENCE_PATH_INVALID/u);
  await unlink(alias);
  await writeFile(path.join(root, "private/worker.stderr.log"), "x", { mode: 0o600 });
  assert.throws(
    () => posttechnicalController.collectPosttechnicalEvidence({ workspace: root, limits: { files: 1 } }),
    /EVIDENCE_LIMIT/u,
  );
});

test("Git observer preserves exact this, argument objects, return and thrown identities without an extra call", async () => {
  const options = Object.freeze({ cwd: "/synthetic/owned", encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }),
    argv = Object.freeze(["show", "a".repeat(40)]),
    receiver = {},
    returned = {};
  let calls = 0,
    synchronizations = 0,
    captured;
  const implementation = {
    execFileSync: function (...args) {
      calls++;
      assert.equal(this, receiver);
      assert.equal(args[1], argv);
      assert.equal(args[2], options);
      return returned;
    },
  };
  const original = implementation.execFileSync,
    state = { observedGitThrows: 0, evidenceLoss: false, restoreVerified: false };
  const value = await posttechnicalController.withPosttechnicalGitExceptionObserver({
    implementation,
    synchronize: () => synchronizations++,
    state,
    record: () => assert.fail("no failure record expected"),
    operation: () => implementation.execFileSync.call(receiver, "git", argv, options),
  });
  assert.equal(value, returned);
  assert.equal(calls, 1);
  assert.equal(synchronizations, 2);
  assert.equal(implementation.execFileSync, original);
  assert.equal(state.restoreVerified, true);
  const failure = Object.freeze(new Error("PRIVATE_SYNTHETIC_FAILURE"));
  implementation.execFileSync = function (...args) {
    calls++;
    assert.equal(this, receiver);
    assert.equal(args[1], argv);
    throw failure;
  };
  const throwingOriginal = implementation.execFileSync;
  await assert.rejects(
    posttechnicalController.withPosttechnicalGitExceptionObserver({
      implementation,
      synchronize: () => {},
      state,
      record: (record) => {
        captured = record;
      },
      operation: () => implementation.execFileSync.call(receiver, "git", argv, options),
    }),
    (error) => error === failure,
  );
  assert.equal(captured.error, failure);
  assert.equal(captured.invocation[2], options);
  assert.equal(calls, 2);
  assert.equal(implementation.execFileSync, throwingOriginal);
});

test("Git observer synchronizes actual builtin imports and logger/bound/restore failures never mask the original", async (t) => {
  const root = await fixture(t);
  diagnosticRepository(root);
  const builtin = await import("node:child_process"),
    original = builtin.default.execFileSync;
  const state = { observedGitThrows: 0, evidenceLoss: false, restoreVerified: false };
  let sameError;
  await assert.rejects(
    posttechnicalController.withPosttechnicalGitExceptionObserver({
      state,
      record: ({ error }) => {
        sameError = error;
        throw Error("synthetic logger failure");
      },
      operation: () =>
        builtin.execFileSync("git", ["show", "0".repeat(40)], { cwd: root, stdio: ["ignore", "pipe", "ignore"] }),
    }),
    (error) => error === sameError,
  );
  assert.equal(state.observedGitThrows, 1);
  assert.equal(state.evidenceLoss, true);
  assert.equal(builtin.execFileSync, original);
  assert.equal(builtin.default.execFileSync, original);
  await mkdir(path.join(root, "private"), { mode: 0o700 });
  const logger = posttechnicalController.createPosttechnicalGitExceptionLog(path.join(root, "private"), {
    maximumBytes: 1,
  });
  const failure = Object.freeze(new Error("PRIVATE_BOUND_FAILURE")),
    implementation = {
      execFileSync() {
        throw failure;
      },
    };
  let sync = 0;
  await assert.rejects(
    posttechnicalController.withPosttechnicalGitExceptionObserver({
      implementation,
      synchronize: () => {
        if (++sync === 2) throw Error("synthetic restore failure");
      },
      state: logger.state,
      record: logger.record,
      operation: () => implementation.execFileSync("git", ["show", "a".repeat(40)], { cwd: root }),
    }),
    (error) => error === failure,
  );
  logger.close();
  assert.equal(logger.state.evidenceLoss, true);
  assert.equal(logger.state.restoreVerified, false);
});

test("valid JSON context, nonce, wrapped-key and wrong-key mutations fail authenticated decryption", () => {
  const keys = posttechnicalCrypto.generateKeyPairSync("rsa", { modulusLength: 2048 }),
    wrong = posttechnicalCrypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  const aad = {
    version: 1,
    diagnosticId: "SYNTHETIC",
    repository: "synthetic/repo",
    runId: 123,
    runAttempt: 1,
    job: "synthetic-job",
    policyDigest: "a".repeat(64),
    keyId: "b".repeat(64),
    installer: "c".repeat(40),
    candidate: "d".repeat(40),
    historicalBase: "e".repeat(40),
    originalInputDigest: "f".repeat(64),
    originalPlanDigest: "1".repeat(64),
  };
  const input = {
    files: [{ name: "synthetic.bin", bytes: Buffer.from([0, 1, 2, 255]) }],
    aad,
    publicKey: keys.publicKey,
  };
  const first = posttechnicalController.sealPosttechnicalEvidence(input),
    second = posttechnicalController.sealPosttechnicalEvidence(input);
  const firstHeader = JSON.parse(Buffer.from(JSON.parse(first).aad, "base64")),
    secondHeader = JSON.parse(Buffer.from(JSON.parse(second).aad, "base64"));
  assert.notEqual(firstHeader.nonce, secondHeader.nonce);
  assert.notEqual(firstHeader.wrappedKey, secondHeader.wrappedKey);
  for (const field of [
    "version",
    "diagnosticId",
    "repository",
    "runId",
    "runAttempt",
    "job",
    "policyDigest",
    "keyId",
    "installer",
    "candidate",
    "historicalBase",
    "originalInputDigest",
    "originalPlanDigest",
    "nonce",
    "wrappedKey",
    "algorithms",
    "plaintextBytes",
  ]) {
    const envelope = JSON.parse(first),
      header = JSON.parse(Buffer.from(envelope.aad, "base64"));
    if (field === "nonce" || field === "wrappedKey") {
      const value = Buffer.from(header[field], "base64");
      value[0] ^= 1;
      header[field] = value.toString("base64");
    } else header[field] = typeof header[field] === "number" ? header[field] + 1 : `${header[field]}-changed`;
    envelope.aad = Buffer.from(JSON.stringify(header)).toString("base64");
    assert.doesNotThrow(() => JSON.parse(Buffer.from(envelope.aad, "base64")));
    assert.throws(() => decryptSyntheticEnvelope(Buffer.from(JSON.stringify(envelope)), keys.privateKey));
  }
  assert.throws(() => decryptSyntheticEnvelope(first, wrong.privateKey));
  assert.throws(() =>
    posttechnicalCrypto.privateDecrypt(
      {
        key: keys.privateKey,
        oaepHash: "sha256",
        oaepLabel: Buffer.from("WRONG_LABEL"),
        padding: posttechnicalCrypto.constants.RSA_PKCS1_OAEP_PADDING,
      },
      Buffer.from(firstHeader.wrappedKey, "base64"),
    ),
  );
  const multiple = posttechnicalController.sealPosttechnicalEvidence({
    ...input,
    files: [{ name: "empty.bin", bytes: Buffer.alloc(0) }, ...input.files],
  });
  const roundtrip = decryptSyntheticEnvelope(multiple, keys.privateKey);
  assert.equal(roundtrip.files.length, 2);
  for (const member of roundtrip.files) {
    const bytes = Buffer.from(member.content, "base64");
    assert.equal(bytes.length, member.bytes);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), member.sha256);
  }
  const empty = posttechnicalController.sealPosttechnicalEvidence({ files: [], aad, publicKey: keys.publicKey });
  assert.equal(decryptSyntheticEnvelope(empty, keys.privateKey).files.length, 0);
  for (const limits of [{ rawBytes: 3 }, { files: 1 }, { nameBytes: 2 }, { envelopeBytes: 1 }]) {
    const files = limits.files ? [...input.files, { name: "second.bin", bytes: Buffer.from("x") }] : input.files;
    assert.throws(() => posttechnicalController.sealPosttechnicalEvidence({ ...input, files, limits }), /EVIDENCE_/u);
  }
});

function newPosttechnicalReservationFixture(execution) {
  const refs = new Map(),
    blobs = new Map(),
    trees = new Map(),
    commits = new Map(),
    calls = [];
  const baseTree = "b".repeat(40);
  trees.set(baseTree, { tree: [{ path: "src", mode: "040000", type: "tree", sha: "d".repeat(40) }] });
  commits.set(execution.installerSha, { tree: { sha: baseTree }, parents: [] });
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
        assert.equal(body.ref, `refs/tags/${posttechnical.POSTTECHNICAL_POLICY.namespace}/attempt-1`);
        assert.equal(refs.has(body.ref), false);
        refs.set(body.ref, { object: { type: "commit", sha: body.sha } });
        return {};
      }
    }
    if (endpoint.startsWith("git/ref/")) return refs.get(`refs/${endpoint.slice(8)}`) ?? null;
    if (endpoint.startsWith("git/blobs/")) return blobs.get(endpoint.slice(10));
    if (endpoint.startsWith("git/trees/")) return trees.get(endpoint.slice(10));
    if (endpoint.startsWith("git/commits/")) return commits.get(endpoint.slice(12));
    assert.fail("unlisted synthetic posttechnical reservation request");
  };
  return { request, calls, blobs };
}

test("new namespace occupancy and readonly reservation bindings deny replacement or qualification flags", async () => {
  const execution = { installerSha: "a".repeat(40), runId: 123456, workflowId: 55 },
    fixture = newPosttechnicalReservationFixture(execution);
  const claim = await posttechnicalController.createPosttechnicalReservation({ request: fixture.request, execution });
  const writes = fixture.calls.filter((call) => call.method !== "GET").length;
  assert.equal(
    (
      await posttechnicalController.readPosttechnicalReservation({
        request: fixture.request,
        execution,
        reservation: claim.commitSha,
      })
    ).commitSha,
    claim.commitSha,
  );
  await assert.rejects(
    posttechnicalController.createPosttechnicalReservation({ request: fixture.request, execution }),
    /SLOT_CONSUMED/u,
  );
  await assert.rejects(
    posttechnicalController.readPosttechnicalReservation({
      request: fixture.request,
      execution: { ...execution, runId: 123457 },
      reservation: claim.commitSha,
    }),
    /RESERVATION_INVALID/u,
  );
  await assert.rejects(
    posttechnicalController.readPosttechnicalReservation({
      request: fixture.request,
      execution,
      reservation: "0".repeat(40),
    }),
    /RESERVATION_INVALID/u,
  );
  for (const blob of fixture.blobs.values()) {
    const payload = JSON.parse(Buffer.from(blob.content, "base64"));
    payload.qualification = true;
    blob.content = Buffer.from(JSON.stringify(payload)).toString("base64");
  }
  await assert.rejects(
    posttechnicalController.readPosttechnicalReservation({
      request: fixture.request,
      execution,
      reservation: claim.commitSha,
    }),
    /RESERVATION_INVALID/u,
  );
  assert.equal(fixture.calls.filter((call) => call.method !== "GET").length, writes);
  assert.equal(fixture.calls.filter((call) => call.method === "POST" && call.endpoint === "git/refs").length, 1);
});

test("descriptor collection detects a file changed while its exact bytes are being read", async (t) => {
  const root = await fixture(t),
    file = path.join(root, "owned.log");
  await writeFile(file, "original", { mode: 0o600 });
  const fs = await import("node:fs");
  let changed = false;
  assert.throws(
    () =>
      posttechnical.securePosttechnicalRead({
        file,
        root,
        maximum: 8,
        readImpl: (...args) => {
          const count = fs.readSync(...args);
          if (!changed) {
            changed = true;
            fs.writeFileSync(file, "modified");
            fs.utimesSync(file, new Date(0), new Date(0));
          }
          return count;
        },
      }),
    /EVIDENCE_PATH_INVALID/u,
  );
});

test("mandatory media validation needs all fixed outputs and six distinct contained recording files", () => {
  const workspace = "/synthetic/workspace",
    outputs = posttechnical.POSTTECHNICAL_OUTPUTS,
    members = new Map();
  const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    trace = Buffer.from([80, 75, 3, 4, 0]);
  for (const relative of outputs.requiredFixedRelativeFilesOnWholeTechnicalSuccess)
    members.set(
      `candidate/${relative}`,
      relative.endsWith(".png") ? png : relative.endsWith(".zip") ? trace : Buffer.from("{}"),
    );
  for (const rule of outputs.requiredRecursiveBasenamesOnWholeTechnicalSuccess)
    for (let i = 0; i < rule.count; i++)
      members.set(
        `candidate/${rule.directory}/synthetic-${rule.basename}-${i}/${rule.basename}`,
        rule.kind === "nonemptyPNG" ? png : Buffer.from("{}"),
      );
  for (const rule of outputs.requestedGeneratedVideoRules) {
    const recordings = {};
    for (const kind of ["desktop", "phone"]) {
      const relative = `${rule.directory}/${kind}.webm`;
      members.set(`candidate/${relative}`, Buffer.from([26, 69, 223, 163]));
      recordings[kind] = `${workspace}/candidate/${relative}`;
    }
    members.set(`candidate/${rule.observationFile}`, Buffer.from(JSON.stringify({ recordings })));
  }
  const list = () => [...members].map(([name, bytes]) => ({ name, bytes }));
  assert.equal(
    posttechnicalController.validatePosttechnicalRequiredEvidence({ members: list(), workspace }).complete,
    true,
  );
  const missing = `candidate/${outputs.requiredFixedRelativeFilesOnWholeTechnicalSuccess[0]}`;
  const saved = members.get(missing);
  members.delete(missing);
  assert.equal(
    posttechnicalController.validatePosttechnicalRequiredEvidence({ members: list(), workspace }).complete,
    false,
  );
  members.set(missing, saved);
  const rule = outputs.requestedGeneratedVideoRules[0];
  members.set(
    `candidate/${rule.observationFile}`,
    Buffer.from(JSON.stringify({ recordings: { desktop: "/FOREIGN/private.webm", phone: "/FOREIGN/private.webm" } })),
  );
  assert.equal(
    posttechnicalController.validatePosttechnicalRequiredEvidence({ members: list(), workspace }).complete,
    false,
  );
  assert.equal(
    [...members.keys()].some((name) => name.endsWith("paired-witness.json")),
    false,
  );
});
