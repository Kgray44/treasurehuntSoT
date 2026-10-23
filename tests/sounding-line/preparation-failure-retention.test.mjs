// Inert setup/build children and synthetic errors only. No app, DB or browser.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { constants, createDecipheriv, createHash, generateKeyPairSync, privateDecrypt, randomUUID } from "node:crypto";
import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  createPreparationCapture,
  preparationFailureEvidenceFiles,
  PREPARATION_LIMITS,
  preparationPrivateError,
} from "../../scripts/sounding-line/development-preparation-evidence.mjs";
import {
  createPreparationFailurePublisher,
  preparationPublicationUploadPaths,
  sealPreparationFailureEvidence,
  validatePreparationBinding,
} from "../../scripts/sounding-line/preparation-failure-publication.mjs";
import {
  createPreparationFailurePublicationOutput,
  PREPARATION_FAILURE_OUTPUT_KEYS as keys,
} from "../../scripts/sounding-line/preparation-failure-output.mjs";
import { browserFailurePublicationUploadPaths } from "../../scripts/sounding-line/private-browser-failure-publication.mjs";
import {
  createDevelopmentBrowserPlan,
  developmentFixtureEnvironment,
  executeDevelopmentBrowserSuite,
  runDevelopmentSetupCommand,
} from "../../scripts/sounding-line/develop-browser-suite.mjs";

const canary = "PRIVATE_SYNTHETIC_PREPARATION_DIAGNOSTIC";
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const receipt = () => ({ version: 1, role: "DEVELOPMENT_ONLY", qualification: false, status: "FAIL", commands: [] });
function binding() {
  return {
    version: 1,
    sessionId: randomUUID(),
    controllerSha: "a".repeat(40),
    candidateSha: "b".repeat(40),
    selectorDigest: hash("tests/e2e/synthetic.spec.ts:1"),
    provider: {
      repository: "Kgray44/treasurehuntSoT",
      runId: "123",
      attempt: 1,
      workflowSha: "a".repeat(40),
    },
  };
}
function fixture(t) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(tmpdir(), "preparation-retention-")));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return { root, binding: binding() };
}
const childEnvironment = () =>
  Object.fromEntries(
    Object.entries(process.env).filter(([key]) =>
      ["SystemRoot", "WINDIR", "ComSpec", "PATH", "Path", "PATHEXT", "TEMP", "TMP"].includes(key),
    ),
  );
async function step(f, capture, result, label, code) {
  return runDevelopmentSetupCommand(
    { workspace: f.root },
    { ...childEnvironment(), PHASE2_LEGACY_ACCESS_CODE: `synthetic-${"s".repeat(32)}` },
    capture,
    { label, args: ["-e", code] },
    result.commands,
  );
}
function context(token, b) {
  return JSON.parse(preparationFailureEvidenceFiles(token, b).files[0].bytes);
}
const key = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});
function decrypt(bytes) {
  const envelope = JSON.parse(bytes),
    aad = Buffer.from(envelope.aad, "base64"),
    header = JSON.parse(aad);
  const secret = privateDecrypt(
    {
      key: key.privateKey,
      oaepHash: "sha256",
      oaepLabel: Buffer.from("VW-POSTTECHNICAL-EVIDENCE-1"),
      padding: constants.RSA_PKCS1_OAEP_PADDING,
    },
    Buffer.from(header.wrappedKey, "base64"),
  );
  try {
    const cipher = createDecipheriv("aes-256-gcm", secret, Buffer.from(header.nonce, "base64"));
    cipher.setAAD(aad);
    cipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
    return {
      header,
      content: JSON.parse(Buffer.concat([cipher.update(Buffer.from(envelope.ciphertext, "base64")), cipher.final()])),
    };
  } finally {
    secret.fill(0);
  }
}

for (const label of ["prisma-generate", "next-build"])
  test(`actual failed ${label} retains exact closed bytes and genuine phase`, { timeout: 35000 }, async (t) => {
    const f = fixture(t),
      capture = createPreparationCapture(f.binding, f.root),
      result = receipt();
    capture.source({ head: f.binding.candidateSha, digest: "c".repeat(64) });
    const stdout = `${canary}:stdout:synthetic-${"s".repeat(32)}`,
      stderr = `${canary}:stderr`;
    await assert.rejects(
      step(
        f,
        capture,
        result,
        label,
        `process.stdout.write(${JSON.stringify(stdout)});process.stderr.write(${JSON.stringify(stderr)});process.exitCode=17`,
      ),
      /DEVELOPMENT_SETUP_FAILED/u,
    );
    const logs = await capture.close();
    assert.equal(logs.length, 2);
    assert.equal(fs.readFileSync(logs[0].file, "utf8").includes(`synthetic-${"s".repeat(32)}`), false);
    assert(fs.readFileSync(logs[0].file, "utf8").includes("[REDACTED_GENERATED_RUNTIME_CREDENTIAL]"));
    const token = capture.complete(result, Error(canary)),
      retained = preparationFailureEvidenceFiles(token, f.binding),
      actual = context(token, f.binding);
    assert.equal(result.commands[0].exit.code, 17);
    assert.equal(result.commands[0].cleanup.status, "PASS");
    assert.equal(actual.producers[0].ordinal, 1);
    assert.equal(actual.producers[0].producer, label === "next-build" ? "PRODUCTION_BUILD" : "PRISMA_GENERATE");
    assert.equal(actual.sourceUnavailable, false);
    assert.equal(actual.error.message.text, canary);
    assert.deepEqual(retained.issues, []);
    assert.equal(retained.files[1].bytes.toString(), stdout);
    assert.equal(retained.files[2].bytes.toString(), stderr);
    assert(retained.files.every((file) => !/server\.|browser\./u.test(file.name)));
    const sealed = sealPreparationFailureEvidence(token, f.binding, key.publicKey),
      unsealed = decrypt(sealed.bytes);
    assert.equal(sealed.bytes.includes(Buffer.from(canary)), false);
    assert.equal(unsealed.header.purpose, "PRIVATE_PREPARATION_FAILURE_DIAGNOSTICS_NOT_ACCEPTANCE");
    assert.equal(Buffer.from(unsealed.content.files[1].content, "base64").toString(), stdout);
    assert.equal(unsealed.content.files[1].sha256, hash(stdout));
  });

test(
  "host failure after successful children retains real zero exits without fabricating a browser failure",
  { timeout: 35000 },
  async (t) => {
    const f = fixture(t),
      capture = createPreparationCapture(f.binding),
      result = receipt();
    for (const label of [
      "sqlite-bootstrap",
      "generic-seed",
      "scripts/sounding-line/prepare-validation-isolation.mjs",
      "next-build",
    ])
      await step(f, capture, result, label, "process.stdout.write('closed-success')");
    capture.phase("MANIFEST");
    const actual = context(capture.complete(result, Error(`${canary}:manifest-write`)), f.binding);
    assert.equal(actual.phase, "MANIFEST");
    assert.deepEqual(
      actual.producers.map((item) => item.ordinal),
      [1, 2, 3, 4],
    );
    assert(actual.producers.every((item) => item.exit.code === 0 && item.cleanup.status === "PASS"));
    assert.equal(actual.error.message.text, `${canary}:manifest-write`);
  },
);

test("early fingerprint failure has an encrypted receipt and explicit unavailable source with no invented producer", (t) => {
  const f = fixture(t),
    capture = createPreparationCapture(f.binding);
  capture.phase("SOURCE_FINGERPRINT");
  const token = capture.complete(receipt(), Error(canary)),
    actual = context(token, f.binding);
  assert.equal(actual.source, null);
  assert.equal(actual.sourceUnavailable, true);
  assert.deepEqual(actual.producers, []);
  assert.equal(preparationFailureEvidenceFiles(token, f.binding).files.length, 1);
  assert.equal(decrypt(sealPreparationFailureEvidence(token, f.binding, key.publicKey).bytes).content.files.length, 1);
  for (const fake of [JSON.parse(JSON.stringify(token)), {}, { ...token }])
    assert.throws(() => sealPreparationFailureEvidence(fake, f.binding, key.publicKey));
  assert.throws(() => preparationFailureEvidenceFiles(token, { ...f.binding, candidateSha: "c".repeat(40) }));
});

test(
  "actual prepare catches a fingerprint error, writes private detail and releases its owned lock",
  { timeout: 35000 },
  async (t) => {
    const f = fixture(t),
      source = path.join(f.root, "repository"),
      workspace = path.join(f.root, "candidate"),
      outputDirectory = path.join(f.root, "private-output");
    fs.mkdirSync(source);
    const env = {
      ...childEnvironment(),
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : "/dev/null",
      GIT_AUTHOR_NAME: "Inert fixture",
      GIT_AUTHOR_EMAIL: "fixture@example.invalid",
      GIT_COMMITTER_NAME: "Inert fixture",
      GIT_COMMITTER_EMAIL: "fixture@example.invalid",
    };
    const git = (...args) =>
      execFileSync("git", ["-C", source, ...args], { env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
    git("init", "--quiet", "--initial-branch=main", "--template=");
    git("config", "core.hooksPath", process.platform === "win32" ? "NUL" : "/dev/null");
    git("config", "commit.gpgsign", "false");
    fs.writeFileSync(path.join(source, "package.json"), '{"name":"inert-fingerprint-failure","private":true}\n');
    git("add", "--all");
    git("commit", "--quiet", "--no-verify", "-m", "Inert fixture");
    git("worktree", "add", "--quiet", "--detach", workspace, "HEAD");
    const plan = createDevelopmentBrowserPlan({
      workspace,
      outputDirectory,
      candidateSha: git("rev-parse", "HEAD"),
      test: "tests/e2e/synthetic.spec.ts:1",
    });
    // Missing locked parser fails before any setup child can start.
    const authorityNames = ["GITHUB_ACTIONS", "GITHUB_OUTPUT"];
    const priorAuthority = authorityNames.map((name) => process.env[name]);
    let result;
    try {
      for (const name of authorityNames) delete process.env[name];
      result = await executeDevelopmentBrowserSuite("prepare", plan, {});
    } finally {
      authorityNames.forEach((name, index) =>
        priorAuthority[index] === undefined ? delete process.env[name] : (process.env[name] = priorAuthority[index]),
      );
    }
    assert.equal(result.status, "FAIL");
    assert.deepEqual(result.commands, []);
    assert.equal(result.privateError.code.text, "MODULE_NOT_FOUND");
    assert.equal(fs.existsSync(path.join(plan.stateDirectory, "active.lock")), false);
    const saved = JSON.parse(fs.readFileSync(path.join(outputDirectory, "development-result.private.json")));
    assert.equal(saved.privateError.code.text, "MODULE_NOT_FOUND");
    assert.equal(result.preparationRetention.publication.status, "NOT_CONFIGURED");
  },
);

test(
  "synchronous spawn denial records the attempted ordinal without claiming a started child",
  { timeout: 35000 },
  async (t) => {
    const f = fixture(t),
      capture = createPreparationCapture(f.binding),
      result = receipt();
    await assert.rejects(
      runDevelopmentSetupCommand(
        { workspace: 7 },
        childEnvironment(),
        capture,
        { label: "next-build", args: ["-e", ""] },
        result.commands,
      ),
    );
    const actual = context(capture.complete(result, Error(canary)), f.binding);
    assert.equal(actual.producers[0].spawned, false);
    assert.equal(actual.producers[0].exit, null);
    assert.equal(actual.producers[0].cleanup, null);
    assert.deepEqual(actual.producers[0].streams, []);
    assert.equal(result.commands[0].cleanup.status, "NOT_STARTED");
  },
);

test(
  "real child cleanup with an injected receipt-directory failure publishes receipt-only INCOMPLETE",
  { timeout: 35000 },
  async (t) => {
    const f = fixture(t),
      capture = createPreparationCapture(f.binding),
      result = receipt(),
      original = fsp.rm;
    let injected = false,
      leftover;
    fsp.rm = async function (file, ...args) {
      if (!injected && path.basename(String(file)).startsWith("sounding-line-job-")) {
        injected = true;
        leftover = file;
        throw Error(canary);
      }
      return original.call(this, file, ...args);
    };
    syncBuiltinESMExports();
    try {
      await assert.rejects(step(f, capture, result, "next-build", "process.stdout.write('closed')"));
    } finally {
      fsp.rm = original;
      syncBuiltinESMExports();
      if (leftover) await original(leftover, { recursive: true, force: true });
    }
    assert.equal(injected, true);
    const retained = preparationFailureEvidenceFiles(capture.complete(result, Error(canary)), f.binding);
    assert.deepEqual(retained.issues, ["PRODUCER_CLOSURE_UNPROVEN"]);
    assert.equal(retained.files.length, 1);
    assert.equal(JSON.parse(retained.files[0].bytes).producers[0].streams[0].complete, false);
  },
);

test(
  "stream capture caps bytes while draining and preserves the original setup outcome",
  { timeout: 35000 },
  async (t) => {
    const f = fixture(t),
      capture = createPreparationCapture(f.binding),
      result = receipt();
    await assert.rejects(
      step(
        f,
        capture,
        result,
        "next-build",
        `process.stdout.write(Buffer.alloc(${PREPARATION_LIMITS.streamBytes + 1024},120))`,
      ),
      /DEVELOPMENT_LOG_LIMIT_EXCEEDED/u,
    );
    const retained = preparationFailureEvidenceFiles(capture.complete(result, Error(canary)), f.binding),
      actual = JSON.parse(retained.files[0].bytes);
    assert.equal(retained.files[1].bytes.length, PREPARATION_LIMITS.streamBytes);
    assert.equal(actual.producers[0].streams[0].observedBytes, PREPARATION_LIMITS.streamBytes + 1024);
    assert.equal(actual.producers[0].streams[0].complete, false);
    assert.equal(actual.producers[0].exit.code, 0);
    assert.deepEqual(retained.issues, ["STREAM_TRUNCATED"]);
  },
);

test("aggregate capture is bounded across genuine sequential producers", { timeout: 35000 }, async (t) => {
  const f = fixture(t),
    capture = createPreparationCapture(f.binding),
    result = receipt();
  for (const label of ["prisma-generate", "sqlite-bootstrap"])
    await step(f, capture, result, label, "process.stdout.write(Buffer.alloc(12*1024*1024,120))");
  await assert.rejects(step(f, capture, result, "next-build", "process.stdout.write(Buffer.alloc(12*1024*1024,120))"));
  const retained = preparationFailureEvidenceFiles(capture.complete(result, Error(canary)), f.binding);
  assert.equal(
    retained.files.slice(1).reduce((count, file) => count + file.bytes.length, 0),
    PREPARATION_LIMITS.aggregateBytes,
  );
  assert(retained.issues.includes("STREAM_TRUNCATED"));
});

test("private error and receipt overflow remain explicit and bounded", (t) => {
  const f = fixture(t),
    capture = createPreparationCapture(f.binding),
    result = receipt();
  const error = Error("x".repeat(PREPARATION_LIMITS.errorBytes + 10));
  result.syntheticOversize = "x".repeat(PREPARATION_LIMITS.receiptBytes + 10);
  const retained = preparationFailureEvidenceFiles(capture.complete(result, error), f.binding);
  assert(retained.files[0].bytes.length <= PREPARATION_LIMITS.receiptBytes);
  assert.deepEqual(retained.issues, ["ERROR_TRUNCATED", "RECEIPT_TRUNCATED"]);
  assert.equal(preparationPrivateError(error).message.truncated, true);
});

const linux = {
  skip: typeof process.getuid !== "function" ? "Linux owner-ID publication guards require hosted qualification" : false,
};
function publishedFixture(t, initial = "") {
  const f = fixture(t);
  f.file = path.join(f.root, "github-output");
  fs.writeFileSync(f.file, initial, { mode: 0o600 });
  f.nonce = randomUUID();
  f.sink = createPreparationFailurePublicationOutput({ outputFile: f.file, nonce: f.nonce, binding: f.binding });
  f.publisher = createPreparationFailurePublisher({
    binding: f.binding,
    authorityRoot: f.root,
    onPublication: f.sink.capture,
  });
  const capture = createPreparationCapture(f.binding);
  capture.phase("SOURCE_FINGERPRINT");
  f.token = capture.complete(receipt(), Error(canary));
  return f;
}
test("Linux trusted route stages only its fixed-key encrypted exact pair after preparation fails", linux, (t) => {
  const f = publishedFixture(t),
    publication = f.publisher.complete(f.token);
  assert.equal(publication.status, "STAGED");
  assert.equal(f.sink.finish({ failed: true }).status, "ENABLED_EXACT_MEMORY_PATHS");
  const paths = preparationPublicationUploadPaths(publication, f.binding);
  assert.deepEqual(
    paths.map((file) => path.basename(file)),
    ["preparation.encrypted", "retention.json"],
  );
  assert(fs.readFileSync(f.file, "utf8").includes(`${keys.publish}=${f.nonce}`));
  for (const file of paths) assert.equal(fs.readFileSync(file).includes(Buffer.from(canary)), false);
  const metadata = JSON.parse(fs.readFileSync(paths[1]));
  assert.equal(metadata.retention, "COMPLETE");
  assert.equal(metadata.qualification, false);
  assert.equal(metadata.keyId, "f82684218e386d09e9120d0c7b54722e5833e5c18a3d7a8a73d94b9afead48bc");
  assert.throws(() => browserFailurePublicationUploadPaths(publication));
  assert.throws(() => preparationPublicationUploadPaths(JSON.parse(JSON.stringify(publication)), f.binding));
  assert.throws(() => preparationPublicationUploadPaths(publication, { ...f.binding, sessionId: randomUUID() }));
  assert.equal(f.publisher.complete(f.token).status, "NOT_REPUBLISHED");
});
test("Linux stale, duplicate, foreign-context and forged publication selections stay disabled", linux, (t) => {
  for (const kind of ["clone", "stale", "duplicate", "context"]) {
    const f = publishedFixture(t),
      publication = f.publisher.complete(f.token);
    let sink = f.sink;
    if (kind === "stale")
      sink = createPreparationFailurePublicationOutput({ outputFile: f.file, nonce: f.nonce, binding: f.binding });
    if (kind === "context")
      sink = createPreparationFailurePublicationOutput({
        outputFile: f.file,
        nonce: f.nonce,
        binding: { ...f.binding, sessionId: randomUUID() },
      });
    assert.throws(() => sink.capture(kind === "clone" ? JSON.parse(JSON.stringify(publication)) : publication));
    assert.equal(sink.finish({ failed: true }).status, "DISABLED");
    assert(fs.readFileSync(f.file, "utf8").includes(`${keys.publish}=false`));
  }
});
test("Linux mutation or replacement after capture disables final upload selection", linux, (t) => {
  for (const kind of ["grow", "same-size", "rename", "metadata"]) {
    const f = publishedFixture(t),
      publication = f.publisher.complete(f.token),
      paths = preparationPublicationUploadPaths(publication, f.binding);
    if (kind === "grow") fs.appendFileSync(paths[0], canary);
    if (kind === "same-size") fs.writeFileSync(paths[0], Buffer.alloc(fs.statSync(paths[0]).size, 120));
    if (kind === "rename") {
      const original = fs.readFileSync(paths[0]);
      fs.renameSync(paths[0], `${paths[0]}.original`);
      fs.writeFileSync(paths[0], original);
    }
    if (kind === "metadata") fs.writeFileSync(paths[1], canary);
    assert.equal(f.sink.finish({ failed: true }).status, "DISABLED");
    assert(fs.readFileSync(f.file, "utf8").includes(`${keys.publish}=false`));
  }
});
test("Linux encryption, persistence and output faults remain separate non-publication outcomes", linux, (t) => {
  const cases = ["encryption", "persistence", "output"];
  for (const kind of cases) {
    const f = publishedFixture(t),
      originalWrite = fs.writeSync,
      originalOpen = fs.openSync;
    // Pure encryption failure cannot mint paths; production key cannot be overridden.
    if (kind === "encryption") {
      assert.throws(() => sealPreparationFailureEvidence(f.token, f.binding, "invalid generated test key"));
      const originalEncrypt = crypto.publicEncrypt;
      crypto.publicEncrypt = () => {
        throw Error(canary);
      };
      syncBuiltinESMExports();
      try {
        assert.equal(f.publisher.complete(f.token).code, "ENCRYPTION_FAILED");
      } finally {
        crypto.publicEncrypt = originalEncrypt;
        syncBuiltinESMExports();
      }
    } else {
      fs.openSync = function (file, ...args) {
        if (kind === "persistence" && String(file).endsWith("preparation.encrypted")) throw Error(canary);
        return originalOpen.call(this, file, ...args);
      };
      fs.writeSync = function (fd, bytes, ...args) {
        if (kind === "output" && Buffer.isBuffer(bytes) && bytes.toString().startsWith(`${keys.paths}<<`))
          throw Error(canary);
        return originalWrite.call(this, fd, bytes, ...args);
      };
      syncBuiltinESMExports();
      try {
        const result = f.publisher.complete(f.token);
        if (kind === "persistence") assert.equal(result.code, "PERSISTENCE_OR_OUTPUT_FAILED");
        else assert.equal(result.status, "STAGED");
        assert.equal(f.sink.finish({ failed: true }).status, "DISABLED");
      } finally {
        fs.writeSync = originalWrite;
        fs.openSync = originalOpen;
        syncBuiltinESMExports();
      }
    }
    assert(fs.readFileSync(f.file, "utf8").includes(`${keys.publish}=false`));
    assert.equal(context(f.token, f.binding).error.message.text, canary);
  }
});
test("Linux symlink, hardlink and preexisting output authority are refused", linux, (t) => {
  for (const kind of ["symlink", "hardlink", "prior"]) {
    const f = publishedFixture(t, kind === "prior" ? `${keys.publish}=forged\n${keys.paths}<<OPEN\n` : "");
    if (kind !== "prior") {
      const linked = path.join(f.root, "linked");
      if (kind === "symlink") fs.symlinkSync(f.file, linked);
      else fs.linkSync(f.file, linked);
      const sink = createPreparationFailurePublicationOutput({
        outputFile: linked,
        nonce: f.nonce,
        binding: f.binding,
      });
      assert.equal(sink.initialized, false);
    } else {
      assert.equal(f.publisher.complete(f.token).status, "NOT_PUBLISHED");
      assert.equal(f.sink.finish({ failed: true }).status, "DISABLED");
    }
  }
});

test("workflow preparation failure selects its own always-uploader while execution stays skipped", () => {
  const workflow = fs.readFileSync(path.join(repository, ".github/workflows/sounding-line-focused-repair.yml"), "utf8");
  const prepare = workflow
    .split("- name: Retain encrypted preparation failure diagnostics")[1]
    .split("- name: Run the selected")[0];
  assert(prepare.includes("always()"));
  assert(
    prepare.includes(
      "steps.prepare.outputs.private_preparation_failure_publish == steps.development-source.outputs.preparation_failure_publication_nonce",
    ),
  );
  assert(prepare.includes("path: ${{ steps.prepare.outputs.private_preparation_failure_paths }}"));
  assert(!prepare.includes("development-execution"));
  assert(!prepare.includes("private_browser_failure"));
  const select = (upstream, publish, paths) => upstream !== "" && publish === upstream && paths !== "";
  const nonce = randomUUID();
  assert(select(nonce, nonce, "/authority/preparation.encrypted\n/authority/retention.json"));
  for (const args of [
    ["", nonce, "paths"],
    [nonce, randomUUID(), "paths"],
    [nonce, nonce, ""],
    [nonce, "true", "paths"],
  ])
    assert.equal(select(...args), false);
  assert(workflow.includes("contents: read\n  actions: read"));
  assert(!workflow.includes("actions: write"));
});
test("product environment strips output authority, both publication nonces and credentials", () => {
  const names = [
    "GITHUB_OUTPUT",
    "GITHUB_TOKEN",
    "GH_TOKEN",
    "SOUNDING_LINE_PREPARATION_FAILURE_PUBLICATION_NONCE",
    "SOUNDING_LINE_PRIVATE_FAILURE_PUBLICATION_NONCE",
  ];
  const prior = names.map((name) => process.env[name]);
  try {
    for (const name of names) process.env[name] = canary;
    const env = developmentFixtureEnvironment(
      { activeRuntimeDirectory: tmpdir() },
      "synthetic.db",
      "synthetic-credential",
      "a".repeat(64),
    );
    for (const name of names) assert.equal(env[name], undefined);
  } finally {
    names.forEach((name, index) =>
      prior[index] === undefined ? delete process.env[name] : (process.env[name] = prior[index]),
    );
  }
});
test("provider and controller contexts reject altered identity", () => {
  validatePreparationBinding(binding());
  for (const mutate of [
    (b) => {
      b.provider.attempt = 0;
    },
    (b) => {
      b.provider.repository = "untrusted/repo";
    },
    (b) => {
      b.provider.workflowSha = "c".repeat(40);
    },
    (b) => {
      b.extra = true;
    },
  ]) {
    const value = binding();
    mutate(value);
    assert.throws(() => validatePreparationBinding(value));
  }
});
