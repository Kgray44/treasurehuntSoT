import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { shadowCaptureContextSchedule } from "../../scripts/sounding-line/experience-browser.mjs";
import { rawCaptureBinding } from "../../scripts/sounding-line/experience-raw-output.mjs";
import {
  readBoundedRegistryFile,
  sealClosedContextRegistryFiles,
  readRegistryRuntimeCleanups,
} from "../../scripts/sounding-line/closed-context-registry-files.mjs";
const root = fileURLToPath(new URL("../../", import.meta.url));
test("the capture-only registry lane defaults off, is bounded and cannot change Mainline Decision", () => {
  const workflow = fs.readFileSync(path.join(root, ".github/workflows/sounding-line-ordinary.yml"), "utf8");
  const input = workflow.slice(
    workflow.indexOf("      incremental_evidence_shadow:"),
    workflow.indexOf("      evidence_ref:"),
  );
  assert.match(input, /type: boolean\s+default: false/u);
  const preparation = workflow.slice(workflow.indexOf("  experience-preparation:"), workflow.indexOf("  final-check:"));
  const start = preparation.indexOf("      - name: Seal completed-context registry after parent cleanup");
  const finish = preparation.indexOf("      - uses: actions/upload-artifact@v4", start);
  const steps = preparation.slice(start, finish);
  assert(start > preparation.indexOf("id: capture-lifecycle-artifact"));
  assert(start > preparation.indexOf("id: capture-raw-artifact"));
  assert.equal((steps.match(/inputs\.incremental_evidence_shadow == true/gu) ?? []).length, 2);
  assert.equal((steps.match(/inputs\.experience_mode == 'capture'/gu) ?? []).length, 2);
  assert.doesNotMatch(steps, /continue-on-error/u);
  assert.match(steps, /timeout-minutes: 2/u);
  assert.match(steps, /name: Retain encrypted v2 context registry/u);
  assert.match(steps, /if-no-files-found: error/u);
  assert(!/private.?key|contents: write|id-token: write|checks: write/iu.test(steps));
  assert.equal(
    createHash("sha256")
      .update(workflow.slice(workflow.indexOf("  mainline-decision:")))
      .digest("hex"),
    "0cbbb62e9d8c2952cc92d7e2b0a9eecb64ff235573f7e61608c29ed888df4faa",
  );
});
test("local, missing-event and injected private arguments remain unavailable and never create an output channel", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "native-registry-cli-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const output = path.join(directory, "output");
  const clean = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) => !key.startsWith("GITHUB_") && !["GH_TOKEN", "GIT_DIR", "GIT_WORK_TREE"].includes(key),
    ),
  );
  for (const extra of [
    { GITHUB_ACTIONS: "false" },
    { GITHUB_ACTIONS: "true", GITHUB_EVENT_PATH: path.join(directory, "PRIVATE_MISSING_EVENT") },
  ]) {
    const result = spawnSync(
      process.execPath,
      [path.join(root, "scripts/sounding-line/native-registry-producer.mjs"), "--plan", "PRIVATE_UNTRUSTED_ARGUMENT"],
      {
        cwd: root,
        encoding: "utf8",
        windowsHide: true,
        timeout: 10000,
        env: { ...clean, ...extra, GITHUB_OUTPUT: output, SOUNDING_LINE_INCREMENTAL_EVIDENCE_SHADOW: "true" },
      },
    );
    assert.equal(result.status, 0);
    assert.equal(result.stderr, "");
    assert(!result.stdout.includes("PRIVATE_"));
    assert.equal(JSON.parse(result.stdout).classification, "SHADOW_CONTEXT_REGISTRY_UNAVAILABLE");
    assert.equal(JSON.parse(result.stdout).reuseAuthorized, false);
    assert(!fs.existsSync(output));
  }
});
test("bounded registry reads reject traversal, hardlinks, executable files and oversize payloads", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "native-registry-files-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const file = path.join(directory, "evidence.json"),
    original = Buffer.from('{"original":true}\n');
  fs.writeFileSync(file, original, { mode: 0o600 });
  assert(
    (await readBoundedRegistryFile({ root: directory, file: "evidence.json", maximumBytes: original.length })).equals(
      original,
    ),
  );
  for (const name of [
    "../evidence.json",
    "/evidence.json",
    "a\\evidence.json",
    "a/../evidence.json",
    "a:evidence.json",
  ])
    await assert.rejects(readBoundedRegistryFile({ root: directory, file: name, maximumBytes: 1024 }), /_PATH/u);
  await assert.rejects(
    readBoundedRegistryFile({ root: directory, file: "evidence.json", maximumBytes: original.length - 1 }),
    /OWNED_FILE/u,
  );
  await assert.rejects(
    readBoundedRegistryFile({ root: directory, file: "evidence.json", maximumBytes: 2 * 1024 * 1024 + 1 }),
    /BOUND/u,
  );
  fs.linkSync(file, path.join(directory, "alias.json"));
  await assert.rejects(
    readBoundedRegistryFile({ root: directory, file: "evidence.json", maximumBytes: 1024 }),
    /OWNED_FILE/u,
  );
});
test("held owner scope cannot enter registry file inspection", async () => {
  for (const prNumber of [721, 776, 805])
    await assert.rejects(
      sealClosedContextRegistryFiles({ root: "NO_FILESYSTEM_ACCESS", plan: { prNumber } }),
      /SHADOW_CONTEXT_SCOPE/u,
    );
});

test("two fixture profiles bind to their own runtime receipts regardless of path order", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "registry-profile-binding-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const profiles = ["generic", "synthetic-second-profile"];
  const plan = {
    applicable: true,
    prNumber: 900,
    baseSha: "a".repeat(40),
    candidateSha: "b".repeat(40),
    sourceDigest: "c".repeat(64),
    contractDigest: "d".repeat(64),
    contracts: profiles.map((fixtureProfile, i) => ({
      id: `contract-${i}`,
      experience: {
        fixtureProfile,
        devices: ["DESKTOP"],
        roles: ["ANONYMOUS"],
        motion: false,
        journeys: [{ id: `journey-${i}`, roles: ["ANONYMOUS"], steps: [{ state: "READY" }] }],
      },
    })),
  };
  const paths = [],
    profilePaths = [],
    originals = [];
  for (const profile of profiles) {
    const runId = randomUUID(),
      scopeId = randomUUID(),
      binding = {
        version: 1,
        runId,
        scopeId,
        baseSha: plan.baseSha,
        candidateSha: plan.candidateSha,
        planDigest: "e".repeat(64),
      };
    const file = `artifacts/sounding-line/browser-diagnostics/${runId}/${scopeId}/browser-runtime.json`,
      metadata = file.replace(/browser-runtime[.]json$/u, "browser-suite-profile.json");
    fs.mkdirSync(path.dirname(path.join(directory, file)), { recursive: true });
    const closed = { status: "PASS", treeReaped: true, streamsClosed: true };
    fs.writeFileSync(
      path.join(directory, file),
      JSON.stringify({
        diagnosticBinding: binding,
        lifecycle: {
          cleanup: {
            status: "PASS",
            portsReleased: true,
            browser: closed,
            server: closed,
            fixture: { status: "NOT_STARTED" },
            proxy: { status: "NOT_STARTED" },
          },
        },
      }),
      { mode: 0o600 },
    );
    const original = JSON.stringify({ version: 1, profile, diagnosticBinding: binding });
    fs.writeFileSync(path.join(directory, metadata), original, { mode: 0o600 });
    paths.push(file);
    profilePaths.push(metadata);
    originals.push(original);
  }
  const result = await readRegistryRuntimeCleanups({ root: directory, plan, cleanupPaths: [...paths].reverse() });
  assert.deepEqual(
    result.map((value) => value.fixtureProfile),
    [...profiles].reverse(),
  );
  for (const [i, profile] of profiles.entries()) {
    const receipt = result.find((value) => value.fixtureProfile === profile);
    assert.equal(receipt.path, paths[i].slice("artifacts/sounding-line/".length));
    assert.equal(receipt.profileReceiptSha256, createHash("sha256").update(originals[i]).digest("hex"));
  }
  for (const change of [
    (value) => {
      value.profile = "generic";
    },
    (value) => {
      value.profile = "unregistered-profile";
    },
    (value) => {
      value.diagnosticBinding.scopeId = randomUUID();
    },
  ]) {
    const value = JSON.parse(originals[1]);
    change(value);
    fs.writeFileSync(path.join(directory, profilePaths[1]), JSON.stringify(value));
    await assert.rejects(
      readRegistryRuntimeCleanups({ root: directory, plan, cleanupPaths: paths }),
      /PROFILE_RUNTIME_BINDING/u,
    );
  }
});

test("independently committed synthetic authority exercises CLI sealing, parent cleanup denial and no overwrite", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "native-registry-installed-"));
  let success = false;
  t.after(() => {
    if (success) fs.rmSync(directory, { recursive: true, force: true });
    else console.error("SYNTHETIC_NATIVE_REGISTRY_FIXTURE_RETAINED:" + path.basename(directory));
  });
  const authority = path.join(directory, "authority"),
    candidateRoot = path.join(directory, "candidate");
  fs.mkdirSync(path.join(authority, "scripts/sounding-line"), { recursive: true });
  for (const item of fs.readdirSync(path.join(root, "scripts/sounding-line"), { withFileTypes: true })) {
    if (item.isFile())
      fs.copyFileSync(
        path.join(root, "scripts/sounding-line", item.name),
        path.join(authority, "scripts/sounding-line", item.name),
      );
  }
  // Only this separately committed fixture replaces provider transport. The
  // production CLI has no transport argument; no actual provider claim is made.
  const producerPath = path.join(authority, "scripts/sounding-line/native-registry-producer.mjs");
  const source = fs.readFileSync(producerPath, "utf8");
  const begin = source.search(/  const bytes = execFileSync\(\r?\n    "gh",/u),
    finish = source.indexOf("  const artifact =", begin);
  assert(begin > 0 && finish > begin);
  fs.writeFileSync(
    producerPath,
    source.slice(0, begin) +
      '  const bytes = execFileSync(process.execPath, ["-e", "process.stdout.write(require(\'fs\').readFileSync(process.argv[1]))", path.join(root, "provider", id + ".json")], {timeout:5000,windowsHide:true,maxBuffer:1048576});\n' +
      source.slice(finish),
  );
  const git = (cwd, ...args) =>
    execFileSync("git", ["-c", "gc.auto=0", "-c", "core.autocrlf=false", ...args], {
      cwd,
      encoding: "utf8",
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 10000,
    }).trim();
  git(authority, "init", "-q");
  git(authority, "config", "user.name", "Synthetic installed registry");
  git(authority, "config", "user.email", "fixture@example.invalid");
  git(authority, "add", ".");
  git(authority, "commit", "-qm", "Synthetic protected authority");
  const baseSha = git(authority, "rev-parse", "HEAD");
  git(directory, "clone", "--shared", "--quiet", authority, candidateRoot);
  git(candidateRoot, "config", "user.name", "Synthetic candidate");
  git(candidateRoot, "config", "user.email", "fixture@example.invalid");
  fs.writeFileSync(
    path.join(candidateRoot, "candidate-marker.txt"),
    "Synthetic candidate, not a product qualification\n",
  );
  git(candidateRoot, "add", ".");
  git(candidateRoot, "commit", "-qm", "Synthetic candidate identity");
  const candidateSha = git(candidateRoot, "rev-parse", "HEAD");
  const write = (workspace, relative, bytes) => {
    const target = path.join(workspace, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, bytes, { flag: "wx", mode: 0o600 });
  };
  const contract = {
    id: "synthetic.native-registry",
    experience: {
      entryPoint: "/",
      devices: ["DESKTOP"],
      roles: ["ANONYMOUS"],
      motion: false,
      journeys: [
        {
          id: "synthetic-journey",
          roles: ["ANONYMOUS"],
          steps: [
            { action: "assert", state: "READY" },
            { action: "assert", state: "RETURNED" },
          ],
        },
      ],
    },
  };
  const plan = {
    applicable: true,
    prNumber: 900,
    baseSha,
    candidateSha,
    sourceDigest: "b".repeat(64),
    contractDigest: "c".repeat(64),
    contracts: [contract],
    contractIds: [contract.id],
  };
  const target = shadowCaptureContextSchedule(plan)[0],
    stage = "artifacts/sounding-line/product-experience-capture-staging/capture-native-fixture/capture",
    raw = stage.slice(0, -7) + "raw";
  const artifacts = [],
    rawFiles = [];
  for (const [index, type] of ["screenshot", "screenshot", "trace", "recording"].entries()) {
    const state = index === 0 ? "READY" : "RETURNED",
      bytes = Buffer.from(`Explicitly synthetic ${type} bytes ${index}`);
    const id =
      type === "screenshot"
        ? `${contract.id}-synthetic-journey-DESKTOP-ANONYMOUS-REDUCED-${state}-${index}`
        : `synthetic-original-${type}`;
    const originalPath = `${stage}/generic/${id}.data`,
      retainedPath = `${raw}/closed-media/${target.contextId}/${index}`;
    write(candidateRoot, retainedPath, bytes);
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    artifacts.push({
      id,
      type,
      state,
      path: originalPath,
      sha256,
      contractId: contract.id,
      device: "DESKTOP",
      role: "ANONYMOUS",
      motionMode: "REDUCED",
    });
    rawFiles.push({ originalPath, path: retainedPath, bytes: bytes.length, sha256 });
  }
  const journal = {
    version: 1,
    classification: "CLOSED_BROWSER_CONTEXT_OBSERVATION_NOT_RUNTIME_CLEANUP",
    binding: rawCaptureBinding(plan),
    context: target.context,
    artifacts,
    rawFiles,
    journey: { id: "synthetic-journey", status: "PASS", accessibility: { states: [{ state: "READY" }] } },
    mutableStateClass: "UNATTESTED_SHARED_TASK_RUNTIME",
    parentRuntimeCleanup: "UNAVAILABLE_UNTIL_PARENT_REAP",
    qualification: false,
    reuseAuthorized: false,
  };
  write(candidateRoot, `${raw}/closed-contexts/${target.contextId}.json`, JSON.stringify(journal));
  const diagnosticRun = randomUUID(),
    scopeId = randomUUID(),
    runtimePath = `artifacts/sounding-line/browser-diagnostics/${diagnosticRun}/${scopeId}/browser-runtime.json`;
  const closed = { status: "PASS", treeReaped: true, streamsClosed: true };
  write(
    candidateRoot,
    runtimePath,
    JSON.stringify({
      diagnosticBinding: {
        version: 1,
        runId: diagnosticRun,
        scopeId,
        baseSha,
        candidateSha,
        planDigest: "e".repeat(64),
      },
      lifecycle: {
        cleanup: {
          status: "PASS",
          portsReleased: true,
          browser: closed,
          server: closed,
          fixture: { status: "NOT_STARTED" },
          proxy: { status: "NOT_STARTED" },
        },
      },
    }),
  );
  const planPath = "artifacts/sounding-line/product-experience-submission/plan.json";
  write(
    candidateRoot,
    runtimePath.replace(/browser-runtime[.]json$/u, "browser-suite-profile.json"),
    JSON.stringify({
      version: 1,
      profile: "generic",
      diagnosticBinding: JSON.parse(fs.readFileSync(path.join(candidateRoot, runtimePath))).diagnosticBinding,
    }),
  );
  write(candidateRoot, planPath, JSON.stringify(plan));
  const supervision = "artifacts/sounding-line/preparation-supervision/session-fixture/public";
  const terminal = {
    version: 1,
    binding: {
      repository: "Kgray44/treasurehuntSoT",
      base: baseSha,
      candidate: candidateSha,
      runId: "4444",
      attempt: "1",
    },
    observerClosed: true,
    cleanup: { ...closed, directExitObserved: true, ownership: "LINUX_SUBREAPER_AND_PIDFD" },
  };
  write(authority, `${supervision}/terminal.json`, JSON.stringify(terminal));
  for (const [id, name] of [
    [11, `product-experience-raw-${candidateSha}-4444`],
    [22, `product-experience-lifecycle-${candidateSha}-4444`],
  ])
    write(
      authority,
      `provider/${id}.json`,
      JSON.stringify({
        id,
        name,
        expired: false,
        size_in_bytes: 1234,
        digest: `sha256:${"f".repeat(64)}`,
        workflow_run: {
          id: 4444,
          repository_id: 1303074266,
          head_repository_id: 1303074266,
          head_sha: baseSha,
          head_branch: "main",
        },
      }),
    );
  const owner = { id: 64373011, login: "Kgray44" },
    repo = { id: 1303074266, full_name: "Kgray44/treasurehuntSoT", owner };
  const eventPath = path.join(directory, "event.json");
  fs.writeFileSync(
    eventPath,
    JSON.stringify({
      ref: "refs/heads/main",
      repository: repo,
      sender: owner,
      inputs: {
        base_sha: baseSha,
        candidate_sha: candidateSha,
        pr_number: "900",
        experience_mode: "capture",
        experience_diagnostic: "false",
        incremental_evidence_shadow: "true",
      },
      privateUnselectedValue: "PRIVATE_DO_NOT_EMIT",
    }),
  );
  const environment = {
    ...process.env,
    GITHUB_ACTIONS: "true",
    GITHUB_REPOSITORY: repo.full_name,
    GITHUB_REPOSITORY_ID: String(repo.id),
    GITHUB_REF: "refs/heads/main",
    GITHUB_WORKFLOW_REF: `${repo.full_name}/.github/workflows/sounding-line-ordinary.yml@refs/heads/main`,
    GITHUB_SHA: baseSha,
    GITHUB_WORKFLOW_SHA: baseSha,
    GITHUB_ACTOR: owner.login,
    GITHUB_TRIGGERING_ACTOR: owner.login,
    GITHUB_ACTOR_ID: String(owner.id),
    GITHUB_RUN_ID: "4444",
    GITHUB_RUN_ATTEMPT: "1",
    GITHUB_JOB: "experience-preparation",
    GITHUB_EVENT_NAME: "workflow_dispatch",
    GITHUB_EVENT_PATH: eventPath,
    SOUNDING_LINE_INCREMENTAL_EVIDENCE_SHADOW: "true",
  };
  const args = [
    producerPath,
    "--workspace",
    "candidate",
    "--plan",
    `candidate/${planPath}`,
    "--stage",
    `candidate/${stage}`,
    "--runtimes",
    `candidate/${runtimePath}`,
    "--supervision",
    `authority/${supervision}`,
    "--raw-artifact",
    "11",
    "--lifecycle-artifact",
    "22",
  ];
  const run = (output) =>
    spawnSync(process.execPath, args, {
      cwd: directory,
      encoding: "utf8",
      windowsHide: true,
      timeout: 30000,
      env: { ...environment, GITHUB_OUTPUT: output },
    });
  const output = path.join(directory, "output"),
    first = run(output);
  assert.equal(first.status, 0);
  assert.equal(first.stderr, "");
  assert(!first.stdout.includes("PRIVATE_"));
  assert.equal(JSON.parse(first.stdout).classification, "SHADOW_CONTEXT_REGISTRY_SEALED_NOT_ACCEPTANCE", first.stdout);
  assert.equal(JSON.parse(first.stdout).completedContexts, 1);
  assert.equal(JSON.parse(first.stdout).artifactCount, 7);
  assert.equal(JSON.parse(first.stdout).reuseAuthorized, false);
  const encryptedPath = path.join(
      authority,
      "artifacts/sounding-line/context-registry-shadow/run-4444-1/registry-v2.encrypted",
    ),
    encrypted = fs.readFileSync(encryptedPath);
  const header = JSON.parse(Buffer.from(JSON.parse(encrypted).aad, "base64"));
  assert.equal(header.binding.candidateSha, candidateSha);
  assert.equal(header.binding.baseSha, baseSha);
  assert(!encrypted.includes(Buffer.from(artifacts[0].id)));
  const second = run(path.join(directory, "second-output"));
  assert.equal(JSON.parse(second.stdout).classification, "SHADOW_CONTEXT_REGISTRY_UNAVAILABLE");
  assert(fs.readFileSync(encryptedPath).equals(encrypted));
  fs.writeFileSync(
    path.join(authority, supervision, "terminal.json"),
    JSON.stringify({ ...terminal, cleanup: { ...terminal.cleanup, treeReaped: false } }),
  );
  const denied = run(path.join(directory, "denied-output"));
  assert.equal(JSON.parse(denied.stdout).code, "SOUNDING_LINE_NATIVE_REGISTRY_PRODUCER_PARENT_CLEANUP");
  assert(!fs.existsSync(path.join(directory, "denied-output")));
  const installedProducer = fs.readFileSync(producerPath);
  fs.appendFileSync(producerPath, "\n// Synthetic installed-source drift\n");
  const drift = run(path.join(directory, "drift-output"));
  assert.equal(JSON.parse(drift.stdout).code, "SOUNDING_LINE_NATIVE_REGISTRY_PRODUCER_SOURCE_CONTENT");
  fs.writeFileSync(producerPath, installedProducer);
  assert(fs.readFileSync(encryptedPath).equals(encrypted));
  success = true;
});
