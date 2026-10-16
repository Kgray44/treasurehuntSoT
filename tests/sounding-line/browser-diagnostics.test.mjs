import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
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
  failureCategoryFor,
  sanitizedFailureCode,
} from "../../scripts/sounding-line/ordinary.mjs";
import { runTrustedExperienceReplay } from "../../scripts/sounding-line/experience-browser.mjs";

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
