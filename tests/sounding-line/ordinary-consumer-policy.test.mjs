// Opt-in source fixture: execute registered policy tests only, never consumer
// verification, application setup, a browser, replay, capture or authority lease.
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";
import { artifactJson } from "../../scripts/sounding-line/experience-attestation.mjs";
import { buildPlan, buildEvidenceObligations, runVerificationCommands } from "../../scripts/sounding-line/ordinary.mjs";
import { r9HistoricalEvidencePlan } from "../../scripts/sounding-line/experience-r9.mjs";

const fixtureFlag = "SOUNDING_LINE_ORDINARY_CONSUMER_POLICY_FIXTURE";
const frozen = {
  head: "7241f5a8a5965d67882a0b205601eba3087ddef5",
  tree: "28e172e042953fbf8d1bac697f9ad273ce1c637b",
  base: "2e2efa5b8b02e9e5dd0bb0b15d9b23c2f694d7ed",
  source: "8c4a27ed0a7368b56a1552d11fcc0006cb7bb348af18504480c7678c5647fa3f",
  contract: "33b7621269fa18417c20713ccc185783861ef043e38a527f727df7e1047c7274",
  archive: "3c3bf79e45d7235bbca961243484482bd83aef3c203aa6b4d1e5eeed78526804",
};
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");

if (process.env[fixtureFlag])
  test(
    "frozen ordinary3 consumer executes real registered policy under its hosted environment only",
    { timeout: 1500000 },
    async (t) => {
      const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
      const archive = readFileSync(process.env.SOUNDING_LINE_ORDINARY_POLICY_FAILED_ARCHIVE);
      assert.equal(hash(archive), frozen.archive);
      const failed = artifactJson(archive, "ordinary-decision.json");
      assert.equal(failed.decision, "FAIL");
      assert.equal(failed.candidateSha, frozen.head);
      assert.equal(failed.candidateTree, frozen.tree);
      assert.equal(failed.baseSha, frozen.base);
      const owned = mkdtempSync(path.join(tmpdir(), "ordinary-consumer-policy-"));
      assert(owned.startsWith(path.resolve(tmpdir()) + path.sep));
      const checkout = path.join(owned, "checkout");
      assert(process.env.SOUNDING_LINE_ORDINARY_POLICY_OUTPUT, "retained external proof directory is required");
      const proof = path.resolve(process.env.SOUNDING_LINE_ORDINARY_POLICY_OUTPUT);
      assert(!proof.startsWith(owned + path.sep) && proof !== owned, "proof must survive workspace cleanup");
      assert(!existsSync(proof), "proof directory must be new; retained evidence cannot be overwritten");
      mkdirSync(proof, { recursive: true });
      const git = (root, ...args) =>
        execFileSync("git", args, {
          cwd: root,
          encoding: "utf8",
          maxBuffer: 64 * 1024 * 1024,
          stdio: ["ignore", "pipe", "pipe"],
        }).trim();
      t.after(() => {
        if (existsSync(path.join(checkout, ".git"))) git(repo, "worktree", "remove", "--force", checkout);
        rmSync(owned, { recursive: true, force: true });
      });
      git(repo, "worktree", "add", "--no-checkout", "--detach", checkout, frozen.head);
      git(checkout, "-c", "core.longpaths=true", "read-tree", "-mu", "HEAD");
      symlinkSync(
        path.join(repo, "node_modules"),
        path.join(checkout, "node_modules"),
        process.platform === "win32" ? "junction" : "dir",
      );
      assert.equal(git(checkout, "rev-parse", "HEAD^{tree}"), frozen.tree);
      assert.equal(process.env.SOUNDING_LINE_PR_NUMBER, "721");
      assert.equal(process.env.SOUNDING_LINE_EXCEPTION_PHASE, "qualify");
      assert.equal(process.env.GITHUB_ACTIONS, "true");
      // Deliberately omit prNumber: production must still use the ambient PR721.
      // Historical downloads are not needed for this policy-only source fixture.
      const plan = await buildPlan({
        root: checkout,
        baseSha: frozen.base,
        candidateSha: frozen.head,
        experienceEvidenceRequired: false,
      });
      assert.equal(plan.productExperience.sourceDigest, frozen.source);
      assert.equal(plan.productExperience.contractDigest, frozen.contract);
      assert.equal(plan.productExperience.exception.id, "PE-X-CROSSDECK-FINAL-VERIFY-20261015-R9");
      const historical = r9HistoricalEvidencePlan(plan.productExperience);
      assert.equal(historical.baseSha, "151417a772c1bcde4e5c7f256302b803d25d40da");
      assert.equal(historical.sourceDigest, "6d8ebc54902e7bce42a73c1e92d2ad6bc3465f94a1632c04559112bd3afee0ba");
      assert.equal(historical.exception.id, "PE-X-CROSSDECK-FINAL-VERIFY-20261015-R8");
      const obligations = await buildEvidenceObligations(checkout, plan);
      assert.equal(obligations.length, 8);
      assert.equal(new Set(obligations.map((entry) => entry.id)).size, 8);
      assert.deepEqual(plan.selected.browserTests, [
        "tests/e2e/crossdeck-experience-refit.spec.ts",
        "tests/e2e/crossdeck-phase1.spec.ts",
        "tests/e2e/crossdeck-phase2.spec.ts",
        "tests/e2e/crossdeck-refit-recovery.spec.ts",
        "tests/e2e/homeport-phase2.spec.ts",
        "tests/e2e/reach-laboratory.spec.ts",
      ]);
      const registration = JSON.parse(git(checkout, "show", `${frozen.head}:package.json`)).scripts[
        "test:sounding-line"
      ];
      assert.match(registration, /^node --test(?: tests\/sounding-line\/[\w.-]+\.mjs)+$/u);
      const policyArgs = registration.split(/\s+/u).slice(1);
      assert.equal(policyArgs.filter((argument) => argument.endsWith(".mjs")).length, 7);
      assert(policyArgs.includes("tests/sounding-line/ordinary.test.mjs"));
      assert(policyArgs.includes("tests/sounding-line/browser-diagnostics.test.mjs"));
      const overlay = [
        "ordinary.test.mjs",
        "browser-diagnostics.test.mjs",
        "experience-exception.test.mjs",
        "ordinary-consumer-policy.test.mjs",
      ].map((name) => {
        const file = `tests/sounding-line/${name}`;
        const bytes = readFileSync(path.join(repo, file));
        copyFileSync(path.join(repo, file), path.join(checkout, file));
        return { path: file, repairedSha256: hash(bytes) };
      });
      const store = path.join(checkout, "artifacts/sounding-line/evidence-store");
      mkdirSync(store, { recursive: true });
      assert.deepEqual(readdirSync(store), []);
      const executions = [],
        mocked = [];
      // This canonical scheduler's injected callback is the only command boundary.
      // Its PASS timings are not qualification: all non-policy work is mocked.
      runVerificationCommands(checkout, plan, (_root, command, args) => {
        if (args[0] !== "--test" || !args.includes("tests/sounding-line/ordinary.test.mjs")) {
          mocked.push({
            command: path.basename(command),
            firstArguments: args.slice(0, 4),
            argumentCount: args.length,
            classification: "MOCKED_NOT_EXECUTED",
          });
          return;
        }
        assert.equal(command, process.execPath);
        assert.equal(executions.length, 0);
        // Preserve executable lookup and owned temporary/cache locations without
        // borrowing credentials, a live lease or recursive fixture flags.
        const operational = Object.fromEntries(
          Object.entries(process.env).filter(([name]) =>
            /^(?:PATH|SYSTEMROOT|WINDIR|COMSPEC|PATHEXT|TEMP|TMP|TMPDIR|NPM_CONFIG_CACHE|PLAYWRIGHT_BROWSERS_PATH|XDG_CACHE_HOME|COREPACK_HOME)$/iu.test(
              name,
            ),
          ),
        );
        const environment = {
          ...operational,
          SOUNDING_LINE_PR_NUMBER: "721",
          SOUNDING_LINE_EXCEPTION_PHASE: "qualify",
          GITHUB_ACTIONS: "true",
          SOUNDING_LINE_EXCEPTION_LEASE: "synthetic-policy-only-no-authority",
          SOUNDING_LINE_EXCEPTION_ORDINARY_LEASE: "synthetic-policy-only-no-authority",
          GITHUB_RUN_ID: "99999000001",
          GITHUB_RUN_ATTEMPT: "1",
          GITHUB_JOB: "final-check",
          GITHUB_SHA: frozen.base,
          GITHUB_REF: "refs/heads/main",
          SOUNDING_LINE_BASE_SHA: frozen.base,
        };
        for (const name of [fixtureFlag, "GH_TOKEN", "GITHUB_TOKEN"]) delete environment[name];
        // TAP is declaration ordered and can conceal progress in later files.
        // Retain immediate execution events independently without changing tests.
        const reporter = path.join(proof, "policy-progress-reporter.mjs");
        const progress = path.join(proof, "registered-policy.progress.jsonl");
        writeFileSync(
          reporter,
          `import { openSync, appendFileSync, fsyncSync, closeSync } from "node:fs";
const output = openSync(${JSON.stringify(progress)}, "wx");
export default async function* report(source) {
 try {
  for await (const { type, data } of source) {
    if (!["test:dequeue", "test:complete", "test:summary"].includes(type)) continue;
    appendFileSync(output, JSON.stringify({ observedAt: new Date().toISOString(), type,
      file: data.entryFile ?? data.file, name: data.name, nesting: data.nesting,
      line: data.line, column: data.column, testId: data.testId, parentId: data.parentId,
      passed: data.details?.passed, durationMs: data.details?.duration_ms,
      counts: data.counts }) + "\\n");
    fsyncSync(output);
  }
 } finally { closeSync(output); }
}
`,
          { flag: "wx" },
        );
        const executedArguments = [
          "--test-reporter=tap",
          "--test-reporter-destination=stdout",
          `--test-reporter=${pathToFileURL(reporter).href}`,
          "--test-reporter-destination=stderr",
          ...policyArgs,
        ];
        const startedAt = new Date().toISOString();
        const started = performance.now();
        const result = spawnSync(command, executedArguments, {
          cwd: checkout,
          env: environment,
          encoding: "utf8",
          timeout: 1200000,
          maxBuffer: 64 * 1024 * 1024,
        });
        writeFileSync(path.join(proof, "registered-policy.stdout.txt"), result.stdout ?? "", { flag: "wx" });
        writeFileSync(path.join(proof, "registered-policy.stderr.txt"), result.stderr ?? "", { flag: "wx" });
        const terminal = {
          startedAt,
          completedAt: new Date().toISOString(),
          elapsedMs: performance.now() - started,
          childDeadlineMs: 1200000,
          exitCode: result.status,
          signal: result.signal,
          errorCode: result.error?.code ?? null,
          executedArguments,
          reporterSha256: hash(readFileSync(reporter)),
          progressSha256: existsSync(progress) ? hash(readFileSync(progress)) : null,
        };
        writeFileSync(path.join(proof, "registered-policy.terminal.json"), JSON.stringify(terminal, null, 2) + "\n", {
          flag: "wx",
        });
        assert.ifError(result.error);
        assert.equal(result.status, 0, result.stderr + "\n" + result.stdout.slice(-12000));
        executions.push({
          command: "node",
          actualScheduledArguments: args,
          executedRegisteredArguments: policyArgs,
          terminal,
          exitCode: result.status,
          hostedEnvironment: Object.fromEntries(
            Object.entries(environment).filter(([name]) => /^(?:SOUNDING_LINE_|GITHUB_)/u.test(name)),
          ),
          operationalEnvironmentNames: Object.keys(operational).sort(),
          temporaryDirectory: operational.TEMP ?? operational.TMPDIR ?? operational.TMP,
          stdoutSha256: hash(result.stdout),
          stderrSha256: hash(result.stderr),
          classification: "REAL_REGISTERED_POLICY_TEST_EXECUTION_NOT_PRODUCT_VERIFICATION",
        });
      });
      assert.equal(executions.length, 1);
      assert(mocked.length > 0);
      assert.deepEqual(readdirSync(store), []);
      const receipt = {
        classification: "FROZEN_CONSUMER_POLICY_FIXTURE_WITH_TEST_OVERLAY_NOT_QUALIFICATION",
        status: "PASS",
        frozen,
        repairSourceHead: git(repo, "rev-parse", "HEAD"),
        overlay,
        productionDefaultCampaign: plan.productExperience.exception.id,
        inventoryEntries: obligations.find((entry) =>
          entry.commandLabels.some((label) => label.includes("private-content/scan")),
        ).fingerprint.semanticClosureMembers.length,
        obligationGroups: obligations.map((entry) => entry.id),
        technicalBrowserSelections: plan.selected.browserTests,
        historicalTuple: {
          baseSha: historical.baseSha,
          sourceDigest: historical.sourceDigest,
          exceptionId: historical.exception.id,
        },
        executions,
        mocked,
        consumerApplicationBuilds: 0,
        consumerDatabaseCommands: 0,
        consumerBrowsers: 0,
        consumerReplays: 0,
        consumerCaptures: 0,
        liveAuthorityLeases: 0,
        liveExternalServiceRequests: 0,
        liveCustodyWrites: 0,
        liveEffectEvidence: "SOURCE_AUDITED_COMMAND_ROUTING_NOT_INSTRUMENTED_COUNTERS",
        policyFixturesMayCreate: [
          "synthetic child processes",
          "owned loopback sockets",
          "fake phase files",
          "in-memory API stores",
        ],
        finalization: "NOT_RUN",
        qualification: "NONE",
        limitation:
          "Real policy tests execute repaired test bytes over frozen consumer source. All application commands are mocked; default true-loader final consumer audit and fresh protected qualification remain separate gates.",
      };
      writeFileSync(path.join(proof, "policy-fixture.receipt.json"), JSON.stringify(receipt, null, 2) + "\n", {
        flag: "wx",
      });
      t.diagnostic(
        JSON.stringify({
          ...receipt,
          executions: executions.length,
          mocked: mocked.length,
          overlay: overlay.length,
          obligationGroups: obligations.length,
        }),
      );
    },
  );
