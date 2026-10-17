import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const controls = ["run-browser-suite.mjs", "browser-authority.mjs"];
const contextKey = "SOUNDING_LINE_BROWSER_DIAGNOSTIC_CONTEXT";
const nonceKey = "SOUNDING_LINE_PRIVATE_FAILURE_PUBLICATION_NONCE";
function put(root, relative, bytes) {
  const file = path.join(root, relative);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, bytes);
}
function markerScript(identity) {
  return `import { writeFileSync } from 'node:fs';
const [output, ...args] = process.argv.slice(2);
writeFileSync(output, JSON.stringify({ identity: ${JSON.stringify(identity)}, cwd: process.cwd(), args,
  context: process.env.${contextKey} ?? null, output: process.env.GITHUB_OUTPUT ?? null,
  nonce: process.env.${nonceKey} ?? null,
  runId: process.env.GITHUB_RUN_ID ?? null, custom: process.env.ROUTING_FIXTURE ?? null,
  credentialsPresent: Boolean(process.env.GH_TOKEN || process.env.GITHUB_TOKEN) }));\n`;
}
async function withExecutors(action) {
  const owner = mkdtempSync(path.join(tmpdir(), "sl-owned-runner-routing-"));
  const authority = path.join(owner, "authority");
  const candidate = path.join(owner, "candidate");
  try {
    mkdirSync(candidate);
    const scripts = path.join(authority, "scripts", "sounding-line");
    // Load unchanged public framework source before replacing executable files
    // with inert markers. Imports need their original named exports; no actual
    // framework/browser/product runner or dependency setup is invoked.
    cpSync(fileURLToPath(new URL("../../scripts/sounding-line/", import.meta.url)), scripts, { recursive: true });
    const ordinary = await import(pathToFileURL(path.join(scripts, "ordinary.mjs")).href);
    for (const name of controls) {
      put(authority, `scripts/sounding-line/${name}`, markerScript("AUTHORITY:" + name));
      put(candidate, `scripts/sounding-line/${name}`, markerScript("CANDIDATE:" + name));
    }
    put(candidate, "scripts/product-fixture.mjs", markerScript("PRODUCT"));
    let scopes = 0;
    const diagnostics = { beginScope: () => ({ [contextKey]: `owned-context-${++scopes}` }) };
    const calls = [];
    const invoke = (cwd, command, argv, options) => {
      calls.push({ cwd, command, argv: [...argv], options });
      ordinary.run(cwd, command, argv, { ...options, stdio: "pipe" });
    };
    await action({ owner, authority, candidate, ordinary, diagnostics, calls, invoke, scopes: () => scopes });
  } finally {
    rmSync(owner, { recursive: true, force: true });
  }
}

for (const name of controls)
  test(`canonical ${name} executes the protected sibling with exact candidate context`, async () => {
    await withExecutors(async ({ owner, authority, candidate, ordinary, diagnostics, calls, invoke, scopes }) => {
      const output = path.join(owner, "observed.json");
      const canonical = `scripts/sounding-line/${name}`;
      const argv = [canonical, output, "--candidate", "a".repeat(40), "--", "tests/e2e/inert.spec.ts"];
      const original = [...argv];
      const options = {
        timeout: 5000,
        env: {
          GITHUB_OUTPUT: path.join(owner, "owned-action-output"),
          [nonceKey]: "fresh-owned-step-nonce",
          GITHUB_RUN_ID: "owned-public-run",
          ROUTING_FIXTURE: "unchanged",
          [contextKey]: "stale-context",
          GH_TOKEN: "inert-fixture-token",
        },
      };
      const snapshot = structuredClone(options);
      ordinary.browserDiagnosticRunner(diagnostics, invoke)(candidate, process.execPath, argv, options);
      const observed = JSON.parse(readFileSync(output, "utf8"));
      assert.equal(observed.identity, "AUTHORITY:" + name);
      assert.equal(observed.cwd, candidate);
      assert.deepEqual(observed.args, argv.slice(2));
      assert.equal(observed.context, "owned-context-1");
      assert.equal(observed.output, options.env.GITHUB_OUTPUT);
      assert.equal(observed.nonce, options.env[nonceKey]);
      assert.equal(observed.runId, "owned-public-run");
      assert.equal(observed.custom, "unchanged");
      assert.equal(observed.credentialsPresent, false);
      assert.equal(calls[0].argv[0], path.join(authority, canonical));
      assert.deepEqual(calls[0].argv.slice(1), original.slice(1));
      assert.equal(calls[0].cwd, candidate);
      assert.equal(calls[0].options.timeout, options.timeout);
      assert.equal(scopes(), 1);
      assert.deepEqual(argv, original, "canonical plan arguments are never mutated");
      assert.deepEqual(options, snapshot, "the caller's environment/options stay unchanged");
    });
  });

test("candidate and lookalike product paths cannot retain GITHUB_OUTPUT or be rewritten", async () => {
  await withExecutors(async ({ owner, candidate, ordinary, diagnostics, calls, invoke, scopes }) => {
    const saved = process.env.GITHUB_OUTPUT;
    const savedNonce = process.env[nonceKey];
    process.env.GITHUB_OUTPUT = path.join(owner, "inherited-action-output");
    process.env[nonceKey] = "inherited-owned-nonce";
    try {
      for (const [index, script] of [
        "scripts/product-fixture.mjs",
        "./scripts/sounding-line/browser-authority.mjs",
        path.join(candidate, "scripts/sounding-line/browser-authority.mjs"),
      ].entries()) {
        const output = path.join(owner, `product-${index}.json`);
        const argv = [script, output, "--unchanged", "value with spaces"];
        ordinary.browserDiagnosticRunner(diagnostics, invoke)(candidate, process.execPath, argv, {
          env: {
            GITHUB_OUTPUT: path.join(owner, "caller-action-output"),
            [nonceKey]: "caller-owned-nonce",
            GITHUB_RUN_ID: "owned-public-run",
            ROUTING_FIXTURE: "kept",
          },
        });
        const observed = JSON.parse(readFileSync(output, "utf8"));
        assert(observed.identity === "PRODUCT" || observed.identity.startsWith("CANDIDATE:"));
        assert.equal(observed.cwd, candidate);
        assert.deepEqual(observed.args, argv.slice(2));
        assert.equal(observed.output, null, "neither inherited nor caller-provided output file reaches product code");
        assert.equal(observed.nonce, null, "neither inherited nor caller-provided nonce reaches product code");
        assert.equal(observed.runId, "owned-public-run", "other CI variables remain unchanged");
        assert.equal(observed.custom, "kept");
        assert.equal(observed.context, null);
        assert.equal(calls.at(-1).argv[0], script);
      }
      const captured = [];
      const argv = ["scripts/sounding-line/browser-authority.mjs", "not-executed"];
      ordinary.browserDiagnosticRunner(diagnostics, (_cwd, command, actual) => captured.push([command, actual]))(
        candidate,
        "arbitrary-product-command",
        argv,
      );
      assert.deepEqual(captured, [["arbitrary-product-command", argv]], "only the canonical Node executable routes");
      assert.equal(scopes(), 4, "every command still advances the diagnostic scope");
    } finally {
      if (saved === undefined) delete process.env.GITHUB_OUTPUT;
      else process.env.GITHUB_OUTPUT = saved;
      if (savedNonce === undefined) delete process.env[nonceKey];
      else process.env[nonceKey] = savedNonce;
    }
  });
});

test("outer exception admission sees canonical argv before protected execution", async () => {
  await withExecutors(async ({ owner, candidate, ordinary, diagnostics, calls, invoke }) => {
    const plan = { exception: { id: "INERT_EXISTING_GUARD" } };
    const claims = [];
    const output = path.join(owner, "leased.json");
    const argv = ["scripts/sounding-line/run-browser-suite.mjs", output, "--profile", "generic"];
    const routed = ordinary.exceptionCommandRunner(
      plan,
      ordinary.browserDiagnosticRunner(diagnostics, invoke),
      async (request) => {
        claims.push(request);
        return { lease: "inert-lease" };
      },
    );
    await routed(candidate, process.execPath, argv, { env: { GITHUB_OUTPUT: path.join(owner, "owned-output") } });
    assert.deepEqual(claims, [{ root: candidate, plan, kind: "technical", claim: true }]);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].options.env.SOUNDING_LINE_EXCEPTION_LEASE, "inert-lease");
    assert.equal(calls[0].options.env[contextKey], "owned-context-1");
    assert.equal(argv[0], "scripts/sounding-line/run-browser-suite.mjs");
  });
});

test("an existing exception denial stops before routing or scope creation", async () => {
  await withExecutors(async ({ candidate, ordinary, diagnostics, scopes }) => {
    const denial = new Error("INERT_EXISTING_DENIAL");
    const routed = ordinary.exceptionCommandRunner(
      { exception: { id: "INERT_EXISTING_GUARD" } },
      ordinary.browserDiagnosticRunner(diagnostics, () => assert.fail("denied command cannot execute")),
      async () => {
        throw denial;
      },
    );
    await assert.rejects(
      routed(candidate, process.execPath, ["scripts/sounding-line/run-browser-suite.mjs"]),
      (error) => error === denial,
    );
    assert.equal(scopes(), 0);
  });
});

test("first failed browser profile stops before the later selected profile", async () => {
  await withExecutors(async ({ candidate, ordinary, diagnostics }) => {
    const git = (...args) =>
      execFileSync("git", args, { cwd: candidate, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
    put(candidate, ".gitignore", "artifacts/\n");
    put(candidate, "package.json", '{"scripts":{}}\n');
    put(candidate, "package-lock.json", '{"lockfileVersion":3}\n');
    git("init", "--quiet");
    git("config", "user.name", "Inert routing fixture");
    git("config", "user.email", "fixture@example.invalid");
    git("add", ".");
    git("commit", "--quiet", "-m", "inert candidate source");
    const candidateSha = git("rev-parse", "HEAD");
    const plan = {
      mode: "ordinary",
      candidateSha,
      baseSha: candidateSha,
      safetyPaths: [],
      lintPaths: [],
      databaseUrl: ordinary.soundingLineDatabaseUrl(candidateSha),
      selected: {
        unitTests: [],
        browserTests: ["tests/e2e/harborlight-phase2.spec.ts", "tests/e2e/reach-laboratory.spec.ts"],
      },
      buildRequired: true,
      migrationRequired: false,
      migrationScripts: [],
      registrationValidationRequired: false,
    };
    const group = ordinary.verificationObligationGroups(plan).find((entry) => entry.kind === "browser");
    assert.equal(
      group.commands.filter(([, args]) => args[0] === "scripts/sounding-line/run-browser-suite.mjs").length,
      2,
    );
    const failure = new Error("INERT_CURRENT_PROFILE_FAILURE");
    const profiles = [];
    const runner = ordinary.browserDiagnosticRunner(diagnostics, (_cwd, _command, args) => {
      if (path.basename(args[0]) !== "run-browser-suite.mjs") return;
      profiles.push(args[args.indexOf("--profile") + 1]);
      throw failure;
    });
    await assert.rejects(ordinary.runReconciledVerification(candidate, plan, runner), (error) => error === failure);
    assert.deepEqual(profiles, ["harborlight-phase2"], "later generic profile must not run after current failure");
    assert.equal(failure.soundingLineTimings.at(-1).status, "FAIL");
  });
});
