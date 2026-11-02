import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, cpSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  authenticateCompletedEvidence,
  authenticatedCompletedReceipt,
  discoverCompletedEvidenceProducerHints,
} from "../../scripts/sounding-line/authenticated-completed-evidence.mjs";
import {
  canonicalJson,
  createEvidenceFingerprint,
  digest,
  FileEvidenceStore,
} from "../../scripts/sounding-line/evidence.mjs";
import {
  buildEvidenceObligations,
  createSnapshotSourceReader,
  runReconciledVerification,
  soundingLineDatabaseUrl,
} from "../../scripts/sounding-line/ordinary.mjs";

const REPOSITORY = "Kgray44/treasurehuntSoT";
const WORKFLOW = ".github/workflows/sounding-line-ordinary.yml";
const UPLOAD = "Retain completed whole obligations after any verifier outcome";
const MODULES = [
  WORKFLOW,
  "scripts/sounding-line/ordinary.mjs",
  "scripts/sounding-line/evidence.mjs",
  "scripts/sounding-line/authenticated-completed-evidence.mjs",
  "scripts/sounding-line/ordinary-supervised.mjs",
  "scripts/sounding-line/verification-budget.mjs",
  "scripts/sounding-line/verification-job-clock.mjs",
  "scripts/sounding-line/verification-preflight.mjs",
  "scripts/sounding-line/verification-supervisor.mjs",
  "scripts/sounding-line/verification-capacity-820.mjs",
  "scripts/sounding-line/verification-source-join-820.mjs",
  "scripts/sounding-line/owned-process.mjs",
  "scripts/sounding-line/owned-process-linux.py",
  "scripts/sounding-line/owned-process-windows.ps1",
  ...[
    "ordinary-checkout.mjs",
    "experience-selected-checkout.mjs",
    "experience-checkout-hydration.mjs",
    "experience-checkout-roots.mjs",
    "experience-pr776-controller-reconciliation.mjs",
    "ordinary-documentation-checkout-profile.mjs",
    "ordinary-custody-probe.mjs",
    "experience-exception.mjs",
    "product-experience.mjs",
    "homeport-source-amendment.mjs",
    "source-snapshot-batches.mjs",
    "source-diagnostics.mjs",
  ].map((name) => `scripts/sounding-line/${name}`),
];
const installed = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const clone = (value) => JSON.parse(JSON.stringify(value));
function git(root, ...args) {
  return execFileSync("git", ["-c", "core.fsmonitor=false", ...args], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}
function put(root, name, bytes) {
  mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
  writeFileSync(path.join(root, name), bytes);
}
function commit(root, text) {
  git(root, "add", ".");
  git(root, "commit", "-qm", text);
  return git(root, "rev-parse", "HEAD");
}
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function zip(members) {
  const locals = [],
    centrals = [];
  let offset = 0;
  for (const [name, bytes] of members) {
    const filename = Buffer.from(name),
      crc = crc32(bytes),
      local = Buffer.alloc(30),
      central = Buffer.alloc(46);
    local.writeUInt32LE(0x04034b50);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(bytes.length, 18);
    local.writeUInt32LE(bytes.length, 22);
    local.writeUInt16LE(filename.length, 26);
    central.writeUInt32LE(0x02014b50);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(bytes.length, 20);
    central.writeUInt32LE(bytes.length, 24);
    central.writeUInt16LE(filename.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, filename, bytes);
    centrals.push(central, filename);
    offset += 30 + filename.length + bytes.length;
  }
  const directory = Buffer.concat(centrals),
    end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(members.length, 8);
  end.writeUInt16LE(members.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}
function reseal(receipt) {
  receipt.fingerprint = createEvidenceFingerprint(receipt.fingerprint);
  const identity = digest({
    candidateSha: receipt.candidateSha,
    obligationId: receipt.obligationId,
    fingerprintDigest: receipt.fingerprint.fingerprintDigest,
    disposition: receipt.disposition,
    originalReceiptId: receipt.originalReceiptId,
  });
  receipt.id = `sl14-${identity.slice(0, 32)}`;
  delete receipt.receiptDigest;
  receipt.receiptDigest = digest(receipt);
}

async function fixture(action, { browser = false, dedicated = false, workflowTransform = (bytes) => bytes } = {}) {
  const owner = mkdtempSync(path.join(tmpdir(), "sl-authenticated-retention-")),
    root = path.join(owner, "candidate");
  mkdirSync(root);
  const context = {
    GITHUB_ACTIONS: "true",
    GITHUB_EVENT_NAME: "pull_request_target",
    GITHUB_REPOSITORY: REPOSITORY,
    GITHUB_JOB: "final-check",
    GITHUB_WORKFLOW_REF: `${REPOSITORY}/${WORKFLOW}@refs/heads/main`,
    SOUNDING_LINE_EVIDENCE_PURPOSE: "PROTECTED_FINAL_VERIFICATION",
    SOUNDING_LINE_ROLE: "",
    SOUNDING_LINE_EXECUTION_ROLE: "",
  };
  const saved = Object.fromEntries(Object.keys(context).map((name) => [name, process.env[name]]));
  Object.assign(process.env, context);
  try {
    git(root, "init", "-q");
    git(root, "config", "user.email", "fixture@example.invalid");
    git(root, "config", "user.name", "Inert fixture");
    for (const name of MODULES) {
      // The root-owned actual workflow draft is copied as inert fixture data
      // when this author worktree is sparse. No workflow is executed here and
      // this synthetic Git authority does not represent a historical M4 exporter.
      const source =
        name === WORKFLOW && !existsSync(path.join(installed, name))
          ? process.env.SOUNDING_LINE_TEST_WORKFLOW_FIXTURE
          : path.join(installed, name);
      assert(source, "sparse policy tests require explicit SOUNDING_LINE_TEST_WORKFLOW_FIXTURE public YAML input");
      const bytes = readFileSync(source);
      put(root, name, name === WORKFLOW ? workflowTransform(bytes) : bytes);
    }
    const files = {
      ".gitignore": "artifacts/\n",
      "package.json": '{"scripts":{}}\n',
      "package-lock.json": '{"lockfileVersion":3}\n',
      "tsconfig.json": "{}\n",
      "next.config.ts": "export default {};\n",
      "postcss.config.mjs": "export default {};\n",
      "playwright.config.ts": "export default {};\n",
      "vitest.config.ts": "export default {};\n",
      "eslint.config.mjs": "export default [];\n",
      ".prettierrc.json": "{}\n",
      ".prettierignore": "node_modules\n",
      ".nvmrc": "24\n",
      "src/example.ts": "export const value = true;\n",
      "tests/unit/example.test.ts": "import '../../src/example';\n",
      "tests/e2e/reach.spec.ts": "import '../../src/example';\n",
      "tests/e2e/admiralty-phase3.spec.ts": "import '../../src/example';\n",
      "tests/admiralty/phase3/run-journeys.mjs": "import '../../../src/example.ts';\n",
      "prisma/schema.sqlite.prisma": 'datasource db { provider = "sqlite" url = env("DATABASE_URL") }\n',
      "scripts/sounding-line/run-browser-suite.mjs": "export const fixture = true;\n",
      "scripts/sounding-line/prepare-browser-authority.mjs": "export const fixture = true;\n",
      "scripts/prepare-validation-isolation.ts": "export {};\n",
      "testing/contracts.json": "{}\n",
      "testing/impact-map.json": "{}\n",
      "testing/suites.json": "{}\n",
    };
    for (const [name, value] of Object.entries(files)) put(root, name, value);
    const baseSha = commit(root, "inert accepted authority");
    put(root, "Development_Docs/producer.md", "producer candidate\n");
    const producerSha = commit(root, "inert producer candidate");
    put(root, "Development_Docs/current.md", "documentation-only successor\n");
    const candidateSha = commit(root, "inert current candidate");
    const plan = {
      mode: "ordinary",
      baseSha,
      candidateSha,
      databaseUrl: soundingLineDatabaseUrl(candidateSha),
      safetyPaths: [],
      lintPaths: [],
      selected: {
        unitTests: ["tests/unit/example.test.ts"],
        browserTests: browser ? [dedicated ? "tests/e2e/admiralty-phase3.spec.ts" : "tests/e2e/reach.spec.ts"] : [],
      },
      buildRequired: browser,
      migrationRequired: false,
      migrationScripts: [],
      registrationValidationRequired: false,
    };
    const producerPlan = { ...plan, candidateSha: producerSha, databaseUrl: soundingLineDatabaseUrl(producerSha) };
    const obligations = await buildEvidenceObligations(root, plan),
      produced = await buildEvidenceObligations(root, producerPlan);
    assert(
      obligations.some((obligation) => obligation.kind === "unit" && !obligation.reuseIndeterminate),
      "inert unit obligation must be reusable",
    );
    const planDigest = "d".repeat(64),
      store = new FileEvidenceStore(path.join(owner, "receipts"));
    const receipts = [];
    for (const obligation of produced)
      receipts.push(
        await store.writeFresh({
          candidateSha: producerSha,
          obligationId: obligation.id,
          fingerprint: obligation.fingerprint,
          planDigest,
          commands: obligation.commandLabels,
          durationMs: 12,
        }),
      );
    const run = {
      id: 101,
      run_attempt: 1,
      status: "completed",
      conclusion: "failure",
      event: "pull_request_target",
      path: WORKFLOW,
      workflow_id: 201,
      head_sha: producerSha,
      head_branch: "inert-candidate",
      repository: { id: 301, full_name: REPOSITORY },
      head_repository: { id: 301, full_name: REPOSITORY },
      actor: { login: "Kgray44" },
      triggering_actor: { login: "Kgray44" },
      referenced_workflows: [],
      pull_requests: [
        {
          number: 401,
          base: { sha: baseSha, ref: "main", repo: { id: 301 } },
          head: { sha: producerSha, ref: "inert-candidate", repo: { id: 301 } },
        },
      ],
    };
    const step = (number, name, conclusion = "success") => ({ number, name, conclusion, status: "completed" });
    const jobs = {
      total_count: 1,
      jobs: [
        {
          id: 501,
          run_id: 101,
          run_attempt: 1,
          head_sha: producerSha,
          name: "Sounding Line / Focused verification",
          status: "completed",
          conclusion: "failure",
          steps: [
            step(1, "Bind the event to exact source identities"),
            step(2, "Run actions/checkout@v4"),
            step(3, "Checkout exact ordinary ancestry and installed reader closure"),
            step(4, "Route through trusted protected-main classification"),
            step(5, "Run the trusted focused verifier against the exact candidate tree", "failure"),
            step(6, UPLOAD),
          ],
        },
      ],
    };
    const observation = {
      authentication: "UNAUTHENTICATED_OBSERVED_METADATA",
      repository: REPOSITORY,
      runId: 101,
      runAttempt: 1,
      workflowRef: `${REPOSITORY}/${WORKFLOW}@refs/heads/main`,
      workflowSha: baseSha,
      event: "pull_request_target",
      job: "final-check",
      authoritySha: baseSha,
      authorityModuleSha256: hash(readFileSync(path.join(root, MODULES[1]))),
      candidateTree: git(root, "rev-parse", `${producerSha}^{tree}`),
      sourceDigest: null,
      environmentClass: "github-actions-nonbrowser-controlled",
    };
    const checkpoints = receipts.map((_, index) => ({
      version: 1,
      kind: "sounding-line-completed-obligation-checkpoint",
      authentication: "RETENTION_ONLY_NO_AUTHENTICATED_PRODUCER",
      candidateSha: producerSha,
      baseSha,
      planDigest,
      producerObservation: clone(observation),
      completedWholeObligations: index + 1,
      receipts: clone(receipts.slice(0, index + 1)),
      wholeVerificationPassed: false,
      qualification: false,
    }));
    const state = {
      root,
      plan,
      producerSha,
      baseSha,
      obligations,
      produced,
      receipts,
      run,
      jobs,
      checkpoints,
      archive: null,
      extraMembers: [],
      memberTransform: (members) => members,
      artifact: {
        id: 601,
        name: "sounding-line-completed-evidence-101-1",
        expired: false,
        workflow_run: {
          id: 101,
          repository_id: 301,
          head_repository_id: 301,
          head_sha: producerSha,
          head_branch: run.head_branch,
        },
      },
      workflow: { id: 201, path: WORKFLOW, state: "active" },
      blobTransform: (value) => value,
      calls: [],
    };
    state.rebuild = () => {
      state.archive = zip(
        state.memberTransform([
          ...state.checkpoints.map((checkpoint, index) => [
            `checkpoint-${String(index + 1).padStart(4, "0")}.json`,
            Buffer.from(`${canonicalJson(checkpoint)}\n`),
          ]),
          ...state.extraMembers,
        ]),
      );
      state.artifact.size_in_bytes = state.archive.length;
      state.artifact.digest = `sha256:${hash(state.archive)}`;
    };
    state.rebuild();
    state.request = async (endpoint, binary = false) => {
      state.calls.push(endpoint);
      if (binary && endpoint === "actions/artifacts/601/zip") return state.archive;
      if (endpoint === "branches/main") return { name: "main", protected: true, commit: { sha: baseSha } };
      if (
        endpoint ===
        "actions/workflows/sounding-line-ordinary.yml/runs?event=pull_request_target&status=completed&per_page=5"
      )
        return { total_count: 1000, workflow_runs: [state.run] };
      if (endpoint === "actions/runs/101/artifacts?per_page=100")
        return { total_count: 1, artifacts: [state.artifact] };
      if (endpoint === "actions/runs/101") return state.run;
      if (endpoint === "actions/runs/101/attempts/1/jobs?per_page=100") return state.jobs;
      if (endpoint === "actions/workflows/sounding-line-ordinary.yml") return state.workflow;
      if (endpoint === "actions/artifacts/601") return state.artifact;
      if (endpoint.startsWith("git/commits/")) {
        const sha = endpoint.slice("git/commits/".length);
        return { sha, tree: { sha: git(root, "rev-parse", `${sha}^{tree}`) } };
      }
      if (endpoint.startsWith("git/blobs/")) {
        const sha = endpoint.slice("git/blobs/".length),
          bytes = execFileSync("git", ["cat-file", "blob", sha], { cwd: root });
        return state.blobTransform({ sha, encoding: "base64", size: bytes.length, content: bytes.toString("base64") });
      }
      throw new Error("unexpected fixture endpoint");
    };
    state.authenticate = (overrides = {}) =>
      authenticateCompletedEvidence({
        root,
        plan,
        producers: [{ runId: 101, attempt: 1, artifactId: 601, authoritySha: baseSha }],
        request: state.request,
        ...overrides,
      });
    state.lookup = (proof, obligation = obligations.find((value) => value.kind === "unit")) =>
      authenticatedCompletedReceipt(proof, {
        root,
        candidateSha,
        obligationId: obligation.id,
        fingerprint: obligation.fingerprint,
      });
    await action(state);
  } finally {
    for (const [name, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    rmSync(owner, { recursive: true, force: true });
  }
}

function matchingReusableObligations(state) {
  return state.obligations.filter(
    (current) =>
      current.kind !== "browser" &&
      !current.reuseIndeterminate &&
      state.produced.some(
        (prior) => prior.id === current.id && canonicalJson(prior.fingerprint) === canonicalJson(current.fingerprint),
      ),
  );
}
function mandatoryFreshObligations(state) {
  const admitted = new Set(matchingReusableObligations(state).map((obligation) => obligation.id));
  return state.obligations.filter((obligation) => !admitted.has(obligation.id));
}

async function rejected(action, options) {
  await fixture(async (state) => {
    await action(state);
    const proof = await state.authenticate();
    assert.equal(proof.admitted, 0);
    assert.equal(state.lookup(proof), null);
    assert.equal(proof.rejections.length, 1);
  }, options);
}

test("cold module entry performs no authenticated lookup or network request", async () => {
  const previous = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = () => {
    calls++;
    throw new Error("inert cold-entry network trap");
  };
  try {
    const url = new URL("../../scripts/sounding-line/authenticated-completed-evidence.mjs", import.meta.url);
    url.search = "cold-entry-fixture";
    const cold = await import(url.href);
    assert.equal(typeof cold.authenticateCompletedEvidence, "function");
    assert.equal(typeof cold.authenticatedCompletedReceipt, "function");
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = previous;
  }
});

test(
  "cold ordinary CLI falls back without credentials and preserves a bounded command failure",
  { timeout: 20000 },
  () => {
    const owner = mkdtempSync(path.join(tmpdir(), "sl-cold-ordinary-cli-"));
    const authority = path.join(owner, "authority"),
      root = path.join(owner, "candidate"),
      shims = path.join(owner, "command-shims"),
      calls = path.join(owner, "command-calls.jsonl"),
      network = path.join(owner, "network-attempts.log");
    const environment = {
      PATH: `${shims}${path.delimiter}${process.env.PATH ?? ""}`,
      LANG: "C.UTF-8",
      TZ: "UTC",
      GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : "/dev/null",
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_OPTIONAL_LOCKS: "0",
      GIT_NO_LAZY_FETCH: "1",
      GITHUB_ACTIONS: "true",
      GITHUB_EVENT_NAME: "pull_request_target",
      GITHUB_REPOSITORY: REPOSITORY,
      GITHUB_JOB: "final-check",
      GITHUB_WORKFLOW_REF: `${REPOSITORY}/${WORKFLOW}@refs/heads/main`,
      SOUNDING_LINE_EVIDENCE_PURPOSE: "PROTECTED_FINAL_VERIFICATION",
      ...Object.fromEntries(
        ["SystemRoot", "ComSpec", "PATHEXT"]
          .filter((name) => process.env[name])
          .map((name) => [name, process.env[name]]),
      ),
    };
    const fixtureGit = (directory, ...args) =>
      execFileSync("git", ["-c", "core.fsmonitor=false", ...args], {
        cwd: directory,
        env: environment,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      }).trim();
    const initialize = (directory) => {
      fixtureGit(directory, "init", "-q");
      fixtureGit(directory, "config", "user.name", "Cold CLI fixture");
      fixtureGit(directory, "config", "user.email", "fixture@example.invalid");
      fixtureGit(directory, "config", "core.hooksPath", process.platform === "win32" ? "NUL" : "/dev/null");
      fixtureGit(directory, "config", "commit.gpgSign", "false");
    };
    const fixtureCommit = (directory, message) => {
      fixtureGit(directory, "add", ".");
      fixtureGit(directory, "commit", "-qm", message);
      return fixtureGit(directory, "rev-parse", "HEAD");
    };
    try {
      mkdirSync(root);
      mkdirSync(shims);
      // Preserve the real cold CLI/import graph in a separate synthetic authority.
      // Importing ordinary.mjs in this test's parent would hide the startup cycle.
      cpSync(path.join(installed, "scripts", "sounding-line"), path.join(authority, "scripts", "sounding-line"), {
        recursive: true,
      });
      initialize(authority);
      fixtureCommit(authority, "synthetic installed authority");
      for (const name of MODULES) put(root, name, readFileSync(path.join(installed, name)));
      for (const [name, contents] of Object.entries({
        ".gitignore": "artifacts/\n",
        "package.json": '{"scripts":{}}\n',
        "package-lock.json": '{"lockfileVersion":3}\n',
        "tsconfig.json": "{}\n",
        "next.config.ts": "export default {};\n",
        "postcss.config.mjs": "export default {};\n",
        "playwright.config.ts": "export default {};\n",
        "vitest.config.ts": "export default {};\n",
        "eslint.config.mjs": "export default [];\n",
        ".prettierrc.json": "{}\n",
        ".prettierignore": "node_modules\n",
        ".nvmrc": "24\n",
        "testing/contracts.json": "{}\n",
        "testing/impact-map.json": "{}\n",
        "testing/suites.json": "{}\n",
        "src/example.ts": "export const value = true;\n",
        "src/example.test.ts": "import './example';\n",
        "Development_Docs/guide.md": "# Inert guide\n",
      }))
        put(root, name, contents);
      initialize(root);
      const baseSha = fixtureCommit(root, "synthetic accepted source");
      put(root, "Development_Docs/guide.md", "# Inert guide\n\nDocumentation-only candidate.\n");
      const candidateSha = fixtureCommit(root, "synthetic candidate");
      for (const command of ["npm", "npx"]) {
        const script = path.join(shims, `${command}.cjs`);
        const source = `require('node:fs').appendFileSync(${JSON.stringify(calls)},JSON.stringify({command:${JSON.stringify(command)},args:process.argv.slice(2)})+'\\n');process.stderr.write('INERT_BOUNDED_COMMAND_FAILURE\\n');process.exit(23);\n`;
        writeFileSync(script, source);
        put(shims, command, `#!${process.execPath}\n${source}`);
        chmodSync(path.join(shims, command), 0o700);
        put(shims, `${command}.cmd`, `@echo off\r\n"${process.execPath}" "${script}" %*\r\n`);
      }
      const denyNetwork = path.join(owner, "deny-network.mjs");
      writeFileSync(
        denyNetwork,
        `import {appendFileSync} from 'node:fs';globalThis.fetch=async()=>{appendFileSync(${JSON.stringify(network)},'DENIED\\n');throw new Error('INERT_NETWORK_FORBIDDEN');};\n`,
      );
      const result = spawnSync(
        process.execPath,
        [
          "--import",
          pathToFileURL(denyNetwork).href,
          path.join(authority, "scripts", "sounding-line", "ordinary.mjs"),
          "--mode",
          "ordinary",
          "--workspace",
          root,
          "--base",
          baseSha,
          "--candidate",
          candidateSha,
        ],
        { cwd: root, env: environment, encoding: "utf8", timeout: 15000 },
      );
      assert.ifError(result.error);
      assert.equal(result.status, 1, result.stderr);
      assert.doesNotMatch(result.stderr, /unsettled top-level await/u);
      const decision = JSON.parse(
        readFileSync(path.join(root, "artifacts", "sounding-line", "ordinary-decision.json")),
      );
      assert.equal(decision.decision, "FAIL");
      assert.equal(decision.candidateSha, candidateSha);
      assert.equal(decision.baseSha, baseSha);
      assert.equal(decision.completedEvidenceIntake.status, "CONSERVATIVE_FRESH_FALLBACK");
      assert.equal(
        decision.completedEvidenceIntake.reason,
        "SOUNDING_LINE_COMPLETED_EVIDENCE_AUTHENTICATED_ACCESS_REQUIRED",
      );
      assert.equal(decision.completedEvidenceIntake.qualification, false);
      assert.equal(decision.failureObservation.stage, "TECHNICAL_VERIFICATION");
      assert.equal(decision.failureObservation.exitCode, 23);
      assert.equal(decision.browserRequired, false);
      assert.equal(decision.buildRequired, false);
      assert.equal(decision.productExperience.applicable, false);
      assert.deepEqual(decision.selected.browserTests, []);
      assert.deepEqual(
        readFileSync(calls, "utf8")
          .trim()
          .split("\n")
          .map((line) => JSON.parse(line)),
        [{ command: "npx", args: ["--no-install", "prettier", "--check", "Development_Docs/guide.md"] }],
      );
      assert.equal(existsSync(network), false);
      assert(result.stdout.endsWith(`${JSON.stringify(decision, null, 2)}\n`));
    } finally {
      rmSync(owner, { recursive: true, force: true });
    }
  },
);

test("legacy direct exporter remains authenticated without accepting an ambiguous route", async () => {
  const supervised =
    "node authority/scripts/sounding-line/ordinary-supervised.mjs --mode ordinary --workspace candidate --base";
  const direct = "node authority/scripts/sounding-line/ordinary.mjs --mode ordinary --workspace candidate --base";
  await fixture(
    async (state) => {
      const proof = await state.authenticate();
      assert.equal(proof.admitted, 1);
      assert(state.lookup(proof));
    },
    { workflowTransform: (bytes) => Buffer.from(bytes.toString().replace(supervised, direct)) },
  );
  await fixture(
    async (state) => {
      const proof = await state.authenticate();
      assert.equal(proof.admitted, 0);
      assert.equal(state.lookup(proof), null);
    },
    { workflowTransform: (bytes) => Buffer.from(bytes.toString() + `\n# ${direct}\n`) },
  );
});

test("pinned ordinary helper authenticates a skipped legacy checkout but rejects failed, duplicated or competing transport", async () => {
  await fixture(async (state) => {
    const job = state.jobs.jobs[0];
    job.steps.splice(3, 0, { name: "Run actions/checkout@v4", status: "completed", conclusion: "skipped" });
    job.steps.forEach((step, index) => {
      step.number = index + 1;
    });
    const original = clone(job.steps);
    assert.equal((await state.authenticate()).admitted, 1);
    for (const mutate of [
      (steps) => {
        steps.find(
          (value) => value.name === "Checkout exact ordinary ancestry and installed reader closure",
        ).conclusion = "failure";
      },
      (steps) => {
        steps.push({
          ...steps.find((value) => value.name === "Checkout exact ordinary ancestry and installed reader closure"),
          number: 8,
        });
      },
      (steps) => {
        steps.find((value) => value.name === "Run actions/checkout@v4" && value.conclusion === "skipped").conclusion =
          "success";
      },
    ]) {
      job.steps = clone(original);
      mutate(job.steps);
      const proof = await state.authenticate();
      assert.equal(proof.admitted, 0);
      assert.equal(state.lookup(proof), null);
      assert.match(proof.rejections[0].reason, /PROVIDER_(?:CHECKOUT|STEP)_INVALID/u);
    }
  });
});

test("historical full-checkout workflow fixture retains its two successful action checkout gate", async () => {
  await fixture(
    async (state) => {
      // Synthetic authority fixture: original workflow bytes, current pinned
      // modules. This does not requalify the original historical producer.
      const candidateCheckout = state.jobs.jobs[0].steps[2];
      candidateCheckout.name = "Run actions/checkout@v4";
      assert.equal((await state.authenticate()).admitted, 1);
      candidateCheckout.name = "Checkout exact ordinary ancestry and installed reader closure";
      assert.equal((await state.authenticate()).admitted, 0);
    },
    {
      workflowTransform: () =>
        execFileSync(
          "git",
          ["show", "e0056ff3bdc4cb8b69fb6aa66a6dba831e25cdab:.github/workflows/sounding-line-ordinary.yml"],
          { cwd: installed, timeout: 15000, maxBuffer: 2 * 1024 * 1024 },
        ),
    },
  );
});

test("completed nonbrowser PASS remains reusable after later producer failure; opaque proof is candidate-bound", async () => {
  await fixture(async (state) => {
    const proof = await state.authenticate(),
      receipt = state.lookup(proof);
    assert.equal(proof.admitted, matchingReusableObligations(state).length);
    assert.equal(proof.admitted, 1, "only the unchanged unit group has a known reusable closure");
    const scanner = state.obligations.find((obligation) =>
      obligation.commandLabels.some((label) => label.includes("private-content/scan")),
    );
    const setup = state.obligations.find((obligation) =>
      obligation.commands.some(([command, args]) => command === "npm" && args.join(" ") === "run db:generate"),
    );
    const typecheck = state.obligations.find((obligation) =>
      obligation.commands.some(([command, args]) => command === "npx" && args.includes("tsc")),
    );
    assert(scanner);
    assert(setup);
    assert(typecheck);
    assert.equal(
      typecheck.reuseIndeterminate,
      true,
      "typecheck transitive closure contains unresolved filesystem/runtime inputs",
    );
    assert.equal(state.lookup(proof, scanner), null, "new current.md changes the scanner whole-source closure");
    assert.equal(state.lookup(proof, setup), null, "new-process Prisma setup output has not been attested");
    assert.equal(state.lookup(proof, typecheck), null, "transitive typecheck closure must remain fresh");
    assert.equal(proof.qualification, false);
    assert(receipt);
    assert.equal(receipt.candidateSha, state.producerSha);
    const origin = proof.provenance.find((value) => value.receiptId === receipt.id);
    assert.equal(origin.runId, 101);
    assert.equal(origin.artifactId, 601);
    assert.equal(origin.authoritySha, state.baseSha);
    assert.equal(origin.artifactDigest, state.artifact.digest);
    assert(Object.isFrozen(proof.provenance));
    assert(Object.isFrozen(origin));
    assert.equal(state.lookup(JSON.parse(JSON.stringify(proof))), null);
    receipt.commands.push("forged");
    assert.notDeepEqual(receipt, state.lookup(proof));
    const obligation = state.obligations.find((value) => value.kind === "unit");
    assert.equal(
      authenticatedCompletedReceipt(proof, {
        root: state.root,
        candidateSha: state.producerSha,
        obligationId: obligation.id,
        fingerprint: obligation.fingerprint,
      }),
      null,
    );
    assert(state.calls.every((endpoint) => !/history|dispatch|refs|check-runs/u.test(endpoint)));
  });
});
for (const dedicated of [false, true])
  test(`complete authenticated, disk and parent hints never skip ${dedicated ? "the dedicated Admiralty journey" : "a standalone whole browser suite"}`, async () => {
    await fixture(
      async (state) => {
        const script = dedicated
          ? "tests/admiralty/phase3/run-journeys.mjs"
          : "scripts/sounding-line/run-browser-suite.mjs";
        const wrapper = state.obligations.find((obligation) =>
          obligation.commands.some(([command, args]) => command === process.execPath && args[0] === script),
        );
        assert.equal(wrapper.kind, "preflight");
        assert.equal(wrapper.reuseReason, "SETUP_OUTPUT_NOT_ATTESTED");
        assert.equal(wrapper.reuseIndeterminate, true);
        assert(
          wrapper.fingerprint.browserIdentity && wrapper.fingerprint.schemaDigest && wrapper.fingerprint.fixtureDigest,
        );
        assert(wrapper.fingerprint.testDefinitionDigest);
        assert(wrapper.fingerprint.semanticClosureMembers.some((member) => member.startsWith(script + "@")));
        assert(!wrapper.fingerprint.inapplicableDependencyClasses.includes("browserIdentity"));
        const produced = state.produced.find((obligation) => obligation.id === wrapper.id);
        assert.equal(canonicalJson(produced.fingerprint), canonicalJson(wrapper.fingerprint));
        assert(state.checkpoints.at(-1).receipts.some((receipt) => receipt.obligationId === wrapper.id));
        const proof = await state.authenticate();
        assert(state.lookup(proof), "the complete run-bound artifact still authenticates useful unit proof");
        assert.equal(
          state.lookup(proof, wrapper),
          null,
          "even complete matching source proof cannot attest current browser runtime",
        );
        const cache = new FileEvidenceStore(path.join(state.root, "artifacts/sounding-line/evidence-store"));
        const disk = await cache.writeFresh({
          candidateSha: state.plan.candidateSha,
          obligationId: wrapper.id,
          fingerprint: wrapper.fingerprint,
          planDigest: "d".repeat(64),
          commands: wrapper.commandLabels,
          durationMs: 1,
        });
        const diskPath = path.join(cache.receiptsRoot(), disk.id + ".json"),
          originalDisk = readFileSync(diskPath);
        const firstCalls = [];
        const first = await runReconciledVerification(
          state.root,
          state.plan,
          (_root, command, args) => firstCalls.push([command, args]),
          { authenticatedEvidence: proof },
        );
        assert.equal(first.finalization.decision, "PASS");
        assert.equal(firstCalls.filter(([, args]) => args[0] === script).length, 1);
        const current = first.reconciliation.find((entry) => entry.obligationId === wrapper.id);
        assert.equal(current.freshExecuted, true);
        assert.deepEqual(current.reasonCodes, ["SETUP_OUTPUT_NOT_ATTESTED"]);
        const failure = new Error("EXPECTED_FRESH_WRAPPER_FAILURE"),
          calls = [];
        let cleanup = 0,
          returned = false;
        const output = path.join(path.dirname(state.root), "second-completed");
        await assert.rejects(
          async () => {
            await runReconciledVerification(
              state.root,
              state.plan,
              async (_root, command, args) => {
                calls.push([command, args]);
                if (args[0] === script) {
                  try {
                    await Promise.resolve();
                    throw failure;
                  } finally {
                    cleanup++;
                  }
                }
              },
              { authenticatedEvidence: proof, completedEvidenceRoot: output },
            );
            returned = true;
          },
          (error) => error === failure,
        );
        assert.equal(calls.filter(([, args]) => args[0] === script).length, 1);
        assert.equal(cleanup, 1);
        assert.equal(returned, false);
        assert(!calls.some(([command, args]) => command === "npm" && args.join(" ") === "run build"));
        assert(!calls.some(([, args]) => args.includes("prisma") && args.includes("generate")));
        const saved = JSON.parse(
          readFileSync(
            path.join(output, `checkpoint-${String(state.obligations.indexOf(wrapper)).padStart(4, "0")}.json`),
            "utf8",
          ),
        );
        assert.deepEqual(
          saved.receipts.map((receipt) => receipt.obligationId),
          state.obligations.slice(0, state.obligations.indexOf(wrapper)).map((obligation) => obligation.id),
        );
        assert.equal(saved.wholeVerificationPassed, false);
        assert.equal(saved.qualification, false);
        assert.deepEqual(readFileSync(diskPath), originalDisk, "cached historical bytes remain untouched");
      },
      { browser: true, dedicated },
    );
  });

test("cancelled producer admits only already-completed whole receipts, never browser proof", async () => {
  await fixture(
    async (state) => {
      state.run.conclusion = "cancelled";
      state.jobs.jobs[0].conclusion = "cancelled";
      state.jobs.jobs[0].steps[4].conclusion = "cancelled";
      const proof = await state.authenticate();
      assert(state.lookup(proof));
      const browser = state.obligations.find((value) => value.kind === "browser");
      assert(browser);
      assert.equal(state.lookup(proof, browser), null);
    },
    { browser: true },
  );
});
for (const reason of [
  "TRUSTED_PARENT_OBSERVED_SEMANTIC_FINGERPRINT_MATCH",
  "AUTHENTICATED_PROTECTED_PRODUCER_FINGERPRINT_MATCH",
])
  test("genuine singleton rebound reason remains admissible transitively: " + reason, async () => {
    await fixture(async (state) => {
      for (const checkpoint of state.checkpoints)
        for (const receipt of checkpoint.receipts) {
          receipt.disposition = "REBOUND";
          receipt.originalReceiptId = `sl14-${"1".repeat(32)}`;
          const identity = {
            originalReceiptId: receipt.originalReceiptId,
            priorFingerprintDigest: receipt.fingerprint.fingerprintDigest,
            currentFingerprintDigest: receipt.fingerprint.fingerprintDigest,
            disposition: "REBOUND",
          };
          receipt.lineage = {
            version: "1.4",
            immutable: true,
            ...identity,
            reasonCodes: [reason],
            lineageDigest: digest(identity),
          };
          reseal(receipt);
        }
      state.rebuild();
      const proof = await state.authenticate();
      assert.equal(state.lookup(proof).disposition, "REBOUND");
    });
  });
test("ordinary source integration reuses authenticated whole groups with canonical finalization and producer provenance", async () => {
  await fixture(async (state) => {
    const proof = await state.authenticate();
    assert.equal(proof.admitted, matchingReusableObligations(state).length);
    assert.equal(proof.admitted, 1, "only the unchanged unit group has a known reusable closure");
    const scanner = state.obligations.find((obligation) =>
      obligation.commandLabels.some((label) => label.includes("private-content/scan")),
    );
    const setup = state.obligations.find((obligation) =>
      obligation.commands.some(([command, args]) => command === "npm" && args.join(" ") === "run db:generate"),
    );
    const typecheck = state.obligations.find((obligation) =>
      obligation.commands.some(([command, args]) => command === "npx" && args.includes("tsc")),
    );
    assert(scanner);
    assert(setup);
    assert(typecheck);
    assert.equal(
      typecheck.reuseIndeterminate,
      true,
      "typecheck transitive closure contains unresolved filesystem/runtime inputs",
    );
    assert.equal(state.lookup(proof, scanner), null, "new current.md changes the scanner whole-source closure");
    assert.equal(state.lookup(proof, setup), null, "new-process Prisma setup output has not been attested");
    assert.equal(state.lookup(proof, typecheck), null, "transitive typecheck closure must remain fresh");
    const executed = [];
    const result = await runReconciledVerification(
      state.root,
      state.plan,
      async (_root, command, args) => {
        executed.push([command, args]);
      },
      { authenticatedEvidence: proof },
    );
    assert.deepEqual(
      executed,
      mandatoryFreshObligations(state).flatMap((obligation) => obligation.commands),
    );
    assert(
      executed.some(([command, args]) => command === "npm" && args.join(" ") === "run db:generate"),
      "valid producer proof must never skip current Prisma setup",
    );
    assert(
      executed.some(([, args]) => args.includes("scripts/private-content/scan.ts")),
      "changed whole-source scan must run fresh",
    );
    assert(
      executed.some(([, args]) => args.includes("tsc") && args.includes("--noEmit")),
      "unknown transitive typecheck inputs must run fresh",
    );
    assert.equal(result.finalization.decision, "PASS");
    assert.deepEqual(result.finalization.errors, []);
    assert.deepEqual(result.finalization.remainder, []);
    assert.equal(result.finalization.requiredObligations, state.obligations.length);
    assert.equal(result.freshObligations, mandatoryFreshObligations(state).length);
    assert.equal(result.freshObligations, 3);
    const reusableIds = new Set(matchingReusableObligations(state).map((obligation) => obligation.id));
    for (const entry of result.reconciliation) {
      if (!reusableIds.has(entry.obligationId)) {
        assert.equal(entry.freshExecuted, true);
        assert.equal(entry.producerProvenance, undefined);
        assert.deepEqual(entry.commandsAvoided, []);
        if (entry.obligationId === typecheck.id)
          assert.deepEqual(entry.reasonCodes, ["SEMANTIC_CLOSURE_INDETERMINATE"]);
        continue;
      }
      assert.equal(entry.freshExecuted, false);
      assert.deepEqual(entry.reasonCodes, ["AUTHENTICATED_PROTECTED_PRODUCER_FINGERPRINT_MATCH"]);
      assert.equal(entry.producerProvenance.runId, 101);
      assert.equal(entry.producerProvenance.attempt, 1);
      assert.equal(entry.producerProvenance.artifactId, 601);
      assert.equal(entry.producerProvenance.authoritySha, state.baseSha);
      assert.equal(entry.producerProvenance.artifactDigest, state.artifact.digest);
    }
    for (const receipt of result.receipts) {
      assert.equal(receipt.candidateSha, state.plan.candidateSha);
      if (!reusableIds.has(receipt.obligationId)) {
        assert.equal(receipt.disposition, "FRESH");
        assert.equal(receipt.originalReceiptId, null);
        continue;
      }
      assert.equal(receipt.disposition, "REBOUND");
      assert(state.receipts.some((source) => source.id === receipt.originalReceiptId));
      assert.deepEqual(receipt.lineage.reasonCodes, ["AUTHENTICATED_PROTECTED_PRODUCER_FINGERPRINT_MATCH"]);
    }
  });
});
test("ordinary source integration never promotes a JSON-cloned proof token and runs every group fresh", async () => {
  await fixture(async (state) => {
    const proof = await state.authenticate();
    const executed = [];
    const result = await runReconciledVerification(
      state.root,
      state.plan,
      async (_root, command, args) => {
        executed.push([command, args]);
      },
      { authenticatedEvidence: clone(proof) },
    );
    assert.deepEqual(
      executed,
      state.obligations.flatMap((obligation) => obligation.commands),
    );
    assert.equal(result.finalization.decision, "PASS");
    assert.deepEqual(result.finalization.errors, []);
    assert.equal(result.freshObligations, state.obligations.length);
    assert(result.reconciliation.every((entry) => entry.freshExecuted && !entry.producerProvenance));
    assert(result.receipts.every((receipt) => receipt.disposition === "FRESH" && receipt.originalReceiptId === null));
  });
});
test("automatic bounded artifact discovery authenticates hints without owner-supplied IDs", async () => {
  await fixture(async (state) => {
    const proof = await state.authenticate({ producers: undefined });
    assert(state.lookup(proof));
    assert.equal(state.calls.filter((endpoint) => endpoint.includes("/runs?event=")).length, 1);
    assert.equal(state.calls.filter((endpoint) => endpoint === "actions/runs/101/artifacts?per_page=100").length, 1);
  });
});
test("bounded recent workflow window admits positive hints even when older runs exist", async () => {
  const calls = [],
    result = await discoverCompletedEvidenceProducerHints({
      request: async (endpoint) => {
        calls.push(endpoint);
        if (endpoint.includes("/runs?event="))
          return {
            total_count: 1000,
            workflow_runs: Array.from({ length: 5 }, (_, index) => ({ id: index + 1, run_attempt: 1 })),
          };
        const id = Number(/actions\/runs\/([0-9]+)\//u.exec(endpoint)[1]);
        return {
          total_count: 1,
          artifacts: [{ id: id + 100, name: `sounding-line-completed-evidence-${id}-1`, expired: false }],
        };
      },
    });
  assert.deepEqual(
    result.hints.map((hint) => hint.runId),
    [1, 2, 3],
  );
  assert.equal(result.complete, false);
  assert.equal(result.examinedRuns, 3);
  assert.equal(calls.length, 4);
  assert(calls.every((endpoint) => !endpoint.startsWith("actions/artifacts?")));
});
test("per-run artifact pagination is unknown and never causes a broader scan", async () => {
  const calls = [],
    result = await discoverCompletedEvidenceProducerHints({
      request: async (endpoint) => {
        calls.push(endpoint);
        return endpoint.includes("/runs?event=")
          ? { total_count: 1000, workflow_runs: [{ id: 1, run_attempt: 1 }] }
          : { total_count: 101, artifacts: [] };
      },
    });
  assert.deepEqual(result.hints, []);
  assert.equal(calls.length, 2);
  assert.equal(result.complete, false);
});
test("run-specific discovery rejects duplicate names and expired artifacts while continuing bounded window", async () => {
  const calls = [],
    result = await discoverCompletedEvidenceProducerHints({
      request: async (endpoint) => {
        calls.push(endpoint);
        if (endpoint.includes("/runs?event="))
          return {
            total_count: 3,
            workflow_runs: [
              { id: 1, run_attempt: 1 },
              { id: 2, run_attempt: 1 },
              { id: 3, run_attempt: 2 },
            ],
          };
        if (endpoint === "actions/runs/1/artifacts?per_page=100")
          return {
            total_count: 2,
            artifacts: [
              { id: 101, name: "sounding-line-completed-evidence-1-1", expired: false },
              { id: 102, name: "sounding-line-completed-evidence-1-1", expired: false },
            ],
          };
        if (endpoint === "actions/runs/2/artifacts?per_page=100")
          return {
            total_count: 1,
            artifacts: [{ id: 201, name: "sounding-line-completed-evidence-2-1", expired: true }],
          };
        return {
          total_count: 1,
          artifacts: [{ id: 301, name: "sounding-line-completed-evidence-3-2", expired: false }],
        };
      },
    });
  assert.deepEqual(result.hints, [{ runId: 3, attempt: 2, artifactId: 301 }]);
  assert.equal(calls.length, 4);
});
test("empty recent window performs at most five run-specific artifact reads", async () => {
  const calls = [],
    result = await discoverCompletedEvidenceProducerHints({
      request: async (endpoint) => {
        calls.push(endpoint);
        return endpoint.includes("/runs?event=")
          ? {
              total_count: 99999,
              workflow_runs: Array.from({ length: 5 }, (_, index) => ({ id: index + 1, run_attempt: 1 })),
            }
          : { total_count: 0, artifacts: [] };
      },
    });
  assert.deepEqual(result.hints, []);
  assert.equal(calls.length, 6);
  assert.equal(result.examinedRuns, 5);
});
for (const [name, mutate] of [
  [
    "untrusted push producer",
    (state) => {
      state.run.event = "push";
    },
  ],
  [
    "fork or wrong head repository",
    (state) => {
      state.run.head_repository.full_name = "other/repository";
    },
  ],
  [
    "unknown triggering actor",
    (state) => {
      state.run.triggering_actor.login = "other";
    },
  ],
  [
    "rerun attempt drift",
    (state) => {
      state.run.run_attempt = 2;
    },
  ],
  [
    "ambiguous pull request",
    (state) => {
      state.run.pull_requests.push(clone(state.run.pull_requests[0]));
    },
  ],
  [
    "non-main producer base",
    (state) => {
      state.run.pull_requests[0].base.ref = "development";
    },
  ],
  [
    "uncompleted producer",
    (state) => {
      state.run.status = "in_progress";
    },
  ],
  [
    "missing upload step",
    (state) => {
      state.jobs.jobs[0].steps.pop();
    },
  ],
  [
    "skipped verifier step",
    (state) => {
      state.jobs.jobs[0].steps[4].conclusion = "skipped";
    },
  ],
  [
    "partial jobs pagination",
    (state) => {
      state.jobs.total_count = 101;
    },
  ],
  [
    "workflow identity mismatch",
    (state) => {
      state.workflow.id++;
    },
  ],
  [
    "server artifact run mismatch",
    (state) => {
      state.artifact.workflow_run.id++;
    },
  ],
  [
    "server digest mismatch",
    (state) => {
      state.artifact.digest = `sha256:${"0".repeat(64)}`;
    },
  ],
  [
    "expired artifact",
    (state) => {
      state.artifact.expired = true;
    },
  ],
  ...MODULES.slice(4).map((module) => [
    `provider supervised authority substitution: ${module}`,
    (state) => {
      const blob = git(state.root, "rev-parse", `${state.baseSha}:${module}`);
      state.blobTransform = (value) =>
        value.sha === blob ? { ...value, content: Buffer.from("substituted guardian").toString("base64") } : value;
    },
  ]),
  [
    "provider authority blob mismatch",
    (state) => {
      state.blobTransform = (value) => ({ ...value, content: Buffer.from("different").toString("base64") });
    },
  ],
  [
    "observation authority identity mismatch",
    (state) => {
      state.checkpoints[0].producerObservation.authoritySha = "0".repeat(40);
      state.rebuild();
    },
  ],
  [
    "unsupported producer environment witness",
    (state) => {
      state.checkpoints[0].producerObservation.environmentClass = "UNSUPPORTED";
      state.rebuild();
    },
  ],
  [
    "whole qualification assertion in checkpoint",
    (state) => {
      state.checkpoints[0].wholeVerificationPassed = true;
      state.rebuild();
    },
  ],
  [
    "partial obligation count",
    (state) => {
      state.checkpoints[0].completedWholeObligations++;
      state.rebuild();
    },
  ],
  [
    "unknown checkpoint fields",
    (state) => {
      state.checkpoints[0].authenticated = true;
      state.rebuild();
    },
  ],
  [
    "raw private or unknown ZIP member",
    (state) => {
      state.extraMembers.push(["private-context.json", Buffer.from("{}")]);
      state.rebuild();
    },
  ],
  [
    "traversing ZIP path",
    (state) => {
      state.memberTransform = (members) => members.map(([name, bytes]) => [`../${name}`, bytes]);
      state.rebuild();
    },
  ],
  [
    "duplicate ZIP member",
    (state) => {
      state.memberTransform = (members) => [...members, members[0]];
      state.rebuild();
    },
  ],
  [
    "checkpoint sequence gap",
    (state) => {
      state.memberTransform = (members) => members.map(([name, bytes]) => [name.replace("0001", "0002"), bytes]);
      state.rebuild();
    },
  ],
  [
    "noncanonical raw JSON bytes",
    (state) => {
      state.memberTransform = (members) => members.map(([name, bytes]) => [name, Buffer.from(bytes.toString().trim())]);
      state.rebuild();
    },
  ],
])
  test(`rejects ${name}`, async () => {
    await rejected(mutate);
  });

test("self-rehashed receipts cannot override any current fingerprint field", async () => {
  await fixture(async (state) => {
    const fields = [
      "qualificationMode",
      "commandDigest",
      "semanticClosureDigest",
      "semanticClosureMembers",
      "testDefinitionDigest",
      "fixtureDigest",
      "schemaDigest",
      "packageLockDigest",
      "toolchainIdentity",
      "browserIdentity",
      "environmentClass",
      "soundingLinePolicyDigest",
      "authorityIdentity",
      "inapplicableDependencyClasses",
    ];
    const original = clone(state.checkpoints);
    for (const field of fields) {
      state.checkpoints = clone(original);
      for (const checkpoint of state.checkpoints)
        for (const receipt of checkpoint.receipts) {
          if (Array.isArray(receipt.fingerprint[field])) receipt.fingerprint[field].push("foreign");
          else
            receipt.fingerprint[field] =
              typeof receipt.fingerprint[field] === "string" ? receipt.fingerprint[field] + "foreign" : "foreign";
          reseal(receipt);
        }
      state.rebuild();
      const proof = await state.authenticate();
      assert.equal(state.lookup(proof), null, field);
    }
  });
});
test("reordered or rewritten completed prefix never becomes trusted", async () => {
  await fixture(
    async (state) => {
      assert(state.checkpoints.length >= 2);
      state.checkpoints[1].receipts[0].durationMs++;
      const receipt = state.checkpoints[1].receipts[0];
      delete receipt.receiptDigest;
      receipt.receiptDigest = digest(receipt);
      state.rebuild();
      const proof = await state.authenticate();
      assert.equal(proof.admitted, 0);
    },
    { browser: true },
  );
});
test("missing protected purpose or local environment is rejected before provider access", async () => {
  await fixture(async (state) => {
    process.env.SOUNDING_LINE_EVIDENCE_PURPOSE = "DEVELOPMENT_ONLY";
    await assert.rejects(state.authenticate(), /PRODUCER_ENVIRONMENT_UNAUTHENTICATED/u);
    assert.equal(state.calls.length, 0);
    process.env.SOUNDING_LINE_EVIDENCE_PURPOSE = "PROTECTED_FINAL_VERIFICATION";
    process.env.GITHUB_ACTIONS = "false";
    await assert.rejects(state.authenticate(), /PRODUCER_ENVIRONMENT_UNAUTHENTICATED/u);
    assert.equal(state.calls.length, 0);
  });
});
test("explicit development roles and diagnostic leases cannot authenticate ordinary producer evidence", async () => {
  await fixture(async (state) => {
    for (const name of ["SOUNDING_LINE_ROLE", "SOUNDING_LINE_EXECUTION_ROLE"]) {
      process.env[name] = "DEVELOPMENT_ONLY";
      await assert.rejects(state.authenticate(), /PRODUCER_ENVIRONMENT_UNAUTHENTICATED/u);
      process.env[name] = "";
    }
    const name = "SOUNDING_LINE_DIAGNOSTIC_LEASE",
      saved = process.env[name];
    try {
      process.env[name] = "inert-lease-fixture";
      await assert.rejects(state.authenticate(), /PRODUCER_ENVIRONMENT_UNAUTHENTICATED/u);
    } finally {
      if (saved === undefined) delete process.env[name];
      else process.env[name] = saved;
    }
    assert.equal(state.calls.length, 0);
  });
});
test("ZIP symlink attributes are rejected even with a matching server artifact digest", async () => {
  await rejected((state) => {
    const central = state.archive.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
    state.archive.writeUInt32LE((0xa1ff << 16) >>> 0, central + 38);
    state.artifact.digest = `sha256:${hash(state.archive)}`;
  });
});
test("current accepted base or candidate working-tree drift fails closed", async () => {
  await fixture(async (state) => {
    await assert.rejects(
      state.authenticate({
        request: async (endpoint, binary) =>
          endpoint === "branches/main"
            ? { name: "main", protected: true, commit: { sha: "0".repeat(40) } }
            : state.request(endpoint, binary),
      }),
      /CURRENT_ACCEPTED_BASE_CHANGED/u,
    );
    put(state.root, "src/example.ts", "export const value = false;\n");
    await assert.rejects(state.authenticate());
  });
});

test("snapshot source reader preserves raw delegate semantics, scope and failed-read retries", () => {
  const root = path.resolve("inert-snapshot"),
    sha = "a".repeat(40),
    calls = [];
  const error = new Error("same delegate error");
  let failures = 1;
  const execute = (binary, args, options) => {
    calls.push({ binary, args, options });
    if (args[1].endsWith(":src/failure.ts") && failures-- > 0) throw error;
    return "  export const same = true;\n";
  };
  const read = createSnapshotSourceReader(root, sha, execute);
  assert.equal(read("src/a.ts"), "export const same = true;");
  assert.equal(read("src/a.ts"), "export const same = true;");
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], {
    binary: "git",
    args: ["show", sha + ":src/a.ts"],
    options: { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  });
  assert.throws(
    () => read("src/failure.ts"),
    (caught) => caught === error,
  );
  assert.equal(read("src/failure.ts"), "export const same = true;");
  assert.equal(read("src/failure.ts"), "export const same = true;");
  assert.equal(calls.length, 3);
  createSnapshotSourceReader(root, sha, execute)("src/a.ts");
  createSnapshotSourceReader(root, "b".repeat(40), execute)("src/a.ts");
  assert.equal(calls.length, 5);
  assert.equal(calls.at(-1).args[1], "b".repeat(40) + ":src/a.ts");
  let mutable = 0;
  const moving = createSnapshotSourceReader(root, "HEAD", () => String(++mutable));
  assert.equal(moving("src/a.ts"), "1");
  assert.equal(moving("src/a.ts"), "2");
});

test("snapshot source reader keeps fixed entry and byte caps with uncached fallback", () => {
  let calls = 0;
  const execute = () => {
    calls++;
    return "x";
  };
  const read = createSnapshotSourceReader(path.resolve("inert-snapshot"), "a".repeat(40), execute);
  for (let n = 0; n < 4097; n++) read("src/" + n + ".ts");
  read("src/0.ts");
  read("src/4096.ts");
  assert.equal(calls, 4098);
  let largeCalls = 0;
  const large = "x".repeat(64 * 1024 * 1024),
    bounded = createSnapshotSourceReader(path.resolve("inert-snapshot"), "c".repeat(40), () => {
      largeCalls++;
      return large;
    });
  assert.equal(bounded("src/full.ts"), large);
  bounded("src/full.ts");
  assert.equal(largeCalls, 1);
  bounded("src/other.ts");
  bounded("src/other.ts");
  assert.equal(largeCalls, 3);
});

function emptyDiscoveryRequest(state, beforeReturn = () => {}) {
  return async (endpoint) => {
    state.calls.push(endpoint);
    beforeReturn(endpoint);
    if (endpoint === "branches/main") return { name: "main", protected: true, commit: { sha: state.baseSha } };
    if (endpoint.includes("/runs?event="))
      return { total_count: 1000, workflow_runs: Array.from({ length: 5 }, (_, n) => ({ id: n + 1, run_attempt: 1 })) };
    if (/^actions\/runs\/[1-5]\/artifacts\?per_page=100$/u.test(endpoint)) return { total_count: 0, artifacts: [] };
    throw new Error("unexpected empty-window endpoint");
  };
}

test("empty discovered producer window skips intake fingerprints and executes every verification command fresh", async () => {
  await fixture(async (state) => {
    const selected = state.plan.selected;
    Object.defineProperty(state.plan, "selected", {
      configurable: true,
      get() {
        throw new Error("empty intake must not build fingerprints");
      },
    });
    const proof = await state.authenticate({ producers: undefined, request: emptyDiscoveryRequest(state) });
    Object.defineProperty(state.plan, "selected", { configurable: true, writable: true, value: selected });
    assert.equal(proof.admitted, 0);
    assert.deepEqual(proof.provenance, []);
    assert.deepEqual(proof.rejections, []);
    assert.equal(state.lookup(proof), null);
    assert.equal(state.calls.length, 7);
    assert.equal(state.calls.filter((x) => x.includes("/artifacts?")).length, 5);
    const executed = [];
    const result = await runReconciledVerification(
      state.root,
      state.plan,
      async (_root, command, args) => {
        executed.push([command, args]);
      },
      { authenticatedEvidence: proof },
    );
    assert.deepEqual(
      executed,
      state.obligations.flatMap((o) => o.commands),
    );
    assert.equal(result.freshObligations, state.obligations.length);
    assert(result.reconciliation.every((x) => x.freshExecuted && !x.producerProvenance));
    assert(result.receipts.every((x) => x.disposition === "FRESH" && x.originalReceiptId === null));
    assert.deepEqual(
      await buildEvidenceObligations(state.root, state.plan),
      state.obligations,
      "new snapshot returns identical complete fingerprints",
    );
  });
});

test("empty discovery still rejects changed protected base, dirty source and post-discovery HEAD drift", async () => {
  await fixture(async (state) => {
    const request = emptyDiscoveryRequest(state);
    await assert.rejects(
      state.authenticate({
        producers: undefined,
        request: async (endpoint) =>
          endpoint === "branches/main"
            ? { name: "main", protected: true, commit: { sha: "f".repeat(40) } }
            : request(endpoint),
      }),
      /CURRENT_ACCEPTED_BASE_CHANGED/u,
    );
    put(state.root, "src/example.ts", "export const changed = true;\n");
    await assert.rejects(state.authenticate({ producers: undefined, request }));
    put(state.root, "src/example.ts", "export const value = true;\n");
    let dirtied = false;
    const postDirty = emptyDiscoveryRequest(state, (endpoint) => {
      if (!dirtied && endpoint.includes("/runs?event=")) {
        dirtied = true;
        put(state.root, "src/example.ts", "export const changed = true;\n");
      }
    });
    await assert.rejects(state.authenticate({ producers: undefined, request: postDirty }));
    put(state.root, "src/example.ts", "export const value = true;\n");
    let changed = false;
    const drift = emptyDiscoveryRequest(state, (endpoint) => {
      if (!changed && endpoint.includes("/runs?event=")) {
        changed = true;
        put(state.root, "Development_Docs/drift.md", "drift\n");
        commit(state.root, "inert drift");
      }
    });
    await assert.rejects(state.authenticate({ producers: undefined, request: drift }), /CURRENT_HEAD_CHANGED/u);
  });
});
