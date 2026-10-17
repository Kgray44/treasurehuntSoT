// Inert local Git and generated-key fixtures. No real grant, owner key, API or product execution.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  constants as cryptoConstants,
  createDecipheriv,
  createHash,
  generateKeyPairSync,
  privateDecrypt,
} from "node:crypto";
import {
  closeSync,
  existsSync,
  ftruncateSync,
  linkSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
  writeSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";
import {
  replayAdmissionFailure,
  sourceDiagnosticGit,
  withReplayAdmissionScope,
  withSourceDiagnosticCapture,
} from "../../scripts/sounding-line/source-diagnostics.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const modulePath = path.join(repo, "scripts/sounding-line/experience-r14-observability.mjs");
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const canary = "PRIVATE_R14_CANARY_NOT_PUBLIC";
const label = Buffer.from("VW-POSTTECHNICAL-EVIDENCE-1");
let generated;
let substitutionsReported = false;

function testKeys() {
  generated ??= generateKeyPairSync("rsa", {
    modulusLength: 3072,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  return generated;
}

async function fixture(t) {
  const parent = mkdtempSync(path.join(tmpdir(), "r14-observation-inert-"));
  t.after(() => rmSync(parent, { recursive: true, force: true }));
  const root = path.join(parent, "candidate");
  mkdirSync(root);
  const git = (...args) =>
    execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  git("init", "--quiet", "--initial-branch=main");
  git("config", "user.name", "Inert R14 observer fixture");
  git("config", "user.email", "r14-observer@example.invalid");
  git("config", "core.autocrlf", "false");
  mkdirSync(path.join(root, "src"));
  writeFileSync(path.join(root, "src/fixture.txt"), "public fixture\n");
  git("add", ".");
  git("commit", "--quiet", "-m", "Inert source fixture; no qualification");
  const head = git("rev-parse", "HEAD");
  const plan = {
    exception: { id: "PE-X-CROSSDECK-FINAL-VERIFY-20261015-R14" },
    baseSha: head,
    candidateSha: head,
    sourceDigest: "a".repeat(64),
  };
  const environment = {
    GITHUB_RUN_ID: "123456789",
    GITHUB_RUN_ATTEMPT: "1",
    GITHUB_REPOSITORY: "Kgray44/treasurehuntSoT",
    GITHUB_JOB: "final-check",
  };
  const keys = testKeys();
  const original = readFileSync(modulePath, "utf8");
  const keyLiteral = /const publicKey =\s*("(?:[^"\\]|\\.)*");/u;
  const match = keyLiteral.exec(original);
  assert(match, "fixed production public-key literal exists exactly once");
  assert.equal(original.match(/const publicKey =\s*/gu)?.length, 1);
  const productionKey = JSON.parse(match[1]);
  const productionKeyId = digest(productionKey);
  assert.equal(productionKeyId, "f82684218e386d09e9120d0c7b54722e5833e5c18a3d7a8a73d94b9afead48bc");
  const sealerImport = 'import("./replay-posttechnical-diagnostic.mjs")';
  const absoluteSealerImport = `import(${JSON.stringify(pathToFileURL(path.join(repo, "scripts/sounding-line/replay-posttechnical-diagnostic.mjs")).href)})`;
  assert.equal(original.split(sealerImport).length, 2, "one delayed pure-sealer import");
  assert.equal(original.split(productionKeyId).length, 2, "one fixed key fingerprint");
  // Only the generated fixture transport key/fingerprint and relative import location change.
  // Restore all three substitutions and require byte-identical production logic.
  const replacementLiteral = `const publicKey = ${JSON.stringify(keys.publicKey)};`;
  const transformed = original
    .replace(match[0], replacementLiteral)
    .replace(productionKeyId, digest(keys.publicKey))
    .replace(sealerImport, absoluteSealerImport);
  assert.equal(
    transformed
      .replace(replacementLiteral, match[0])
      .replace(digest(keys.publicKey), productionKeyId)
      .replace(absoluteSealerImport, sealerImport),
    original,
  );
  if (!substitutionsReported) {
    t.diagnostic(
      "GENERATED_TEST_KEY_SUBSTITUTIONS " +
        JSON.stringify({
          sourceSha256: digest(original),
          fixtureSha256: digest(transformed),
          productionLogicByteIdenticalAfterReversal: true,
          substitutions: [
            { before: match[0], after: replacementLiteral },
            { before: productionKeyId, after: digest(keys.publicKey) },
            { before: sealerImport, after: absoluteSealerImport },
          ],
          ownerPrivateKeyAccess: false,
        }),
    );
    substitutionsReported = true;
  }
  const copiedModule = path.join(parent, "observer.generated-test-key.mjs");
  writeFileSync(copiedModule, transformed, { flag: "wx", mode: 0o600 });
  writeFileSync(
    path.join(parent, "fixture-substitutions.json"),
    JSON.stringify({
      classification: "GENERATED_TEST_KEY_TRANSPORT_ONLY_NOT_OWNER_AUTHENTICATION",
      sourceSha256: digest(original),
      fixtureSha256: digest(transformed),
      substitutions: ["fixed public key", "fixed public key fingerprint", "absolute existing pure-sealer import"],
      productionLogicByteIdenticalAfterReversingThreeSubstitutions: true,
    }) + "\n",
    { flag: "wx", mode: 0o600 },
  );
  const observerModule = await import(pathToFileURL(copiedModule).href);
  const create = (overrides = {}) => observerModule.createR14Observation({ root, plan, environment, ...overrides });
  const destination = path.join(root, "artifacts/sounding-line/r14-observation.encrypted");
  return { parent, root, git, head, plan, environment, module: observerModule, create, destination, keys };
}

function authenticateFixture(f, observation) {
  const bytes = readFileSync(f.destination);
  assert.equal(bytes.length, observation.ciphertextBytes);
  assert.equal(digest(bytes), observation.ciphertextDigest);
  const envelope = JSON.parse(bytes);
  const aad = Buffer.from(envelope.aad, "base64");
  const header = JSON.parse(aad);
  for (const [name, value] of Object.entries({
    version: 1,
    observationId: f.module.R14_OBSERVATION.id,
    repository: f.environment.GITHUB_REPOSITORY,
    exceptionId: f.plan.exception.id,
    baseSha: f.plan.baseSha,
    candidateSha: f.plan.candidateSha,
    sourceDigest: f.plan.sourceDigest,
    runId: Number(f.environment.GITHUB_RUN_ID),
    runAttempt: 1,
    job: "final-check",
    keyId: digest(f.keys.publicKey),
  }))
    assert.equal(header[name], value, `authenticated ${name}`);
  const key = privateDecrypt(
    {
      key: f.keys.privateKey,
      padding: cryptoConstants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
      oaepLabel: label,
    },
    Buffer.from(header.wrappedKey, "base64"),
  );
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(header.nonce, "base64"));
    decipher.setAAD(aad);
    decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
    const plain = Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, "base64")), decipher.final()]);
    assert.equal(plain.length, header.plaintextBytes);
    const bundle = JSON.parse(plain);
    assert.deepEqual(bundle.inventory, []);
    assert.deepEqual(
      bundle.files.map((file) => file.name),
      ["private/git-exceptions.original.jsonl", "private/runtime.original.json"],
    );
    const files = new Map(
      bundle.files.map((file) => {
        const content = Buffer.from(file.content, "base64");
        assert.equal(content.length, file.bytes);
        assert.equal(digest(content), file.sha256);
        return [file.name, content];
      }),
    );
    const journal = files.get("private/git-exceptions.original.jsonl").toString("utf8");
    return {
      records: journal
        ? journal
            .trimEnd()
            .split("\n")
            .map((line) => JSON.parse(line))
        : [],
      runtime: JSON.parse(files.get("private/runtime.original.json")),
    };
  } finally {
    key.fill(0);
  }
}

const options = (root, extra = {}) => ({
  cwd: root,
  encoding: "utf8",
  maxBuffer: 1024 * 1024,
  timeout: 5000,
  stdio: ["ignore", "pipe", "ignore"],
  ...extra,
});

test("non-R14 returns before I/O, while malformed current run identities fail closed", async (t) => {
  const f = await fixture(t);
  assert.equal(f.module.createR14Observation({ root: "/absent/inert", plan: { exception: { id: "R13" } } }), null);
  for (const id of ["0", "01", "9007199254740993", "Infinity", "-1"]) {
    assert.throws(() => f.create({ environment: { ...f.environment, GITHUB_RUN_ID: id } }), /R14_OBSERVATION/u);
  }
  for (const patch of [{ GITHUB_RUN_ATTEMPT: "2" }, { GITHUB_JOB: "other" }, { GITHUB_REPOSITORY: "other/repo" }]) {
    assert.throws(() => f.create({ environment: { ...f.environment, ...patch } }), /R14_OBSERVATION/u);
  }
  assert(!existsSync(f.destination));
});

test("actual supported Git success preserves stdout and seals exactly two private members", async (t) => {
  const f = await fixture(t);
  const observer = f.create();
  const result = withSourceDiagnosticCapture(observer, () =>
    withReplayAdmissionScope(() =>
      sourceDiagnosticGit("PRODUCT_EXPERIENCE", ["show", `${f.head}:src/fixture.txt`], options(f.root)),
    ),
  );
  assert.equal(result, "public fixture\n");
  const summary = await observer.finish();
  assert.equal(summary.status, "COMPLETE");
  assert.equal(summary.supportedGitReads, 1);
  assert.equal(summary.observedGitThrows, 0);
  assert.equal(summary.cleanup, true);
  assert.equal(summary.sourceUnchanged, true);
  assert.equal(lstatSync(f.destination).mode & 0o777, 0o600);
  const decrypted = authenticateFixture(f, summary);
  assert.deepEqual(decrypted.records, []);
  assert.equal(decrypted.runtime.finalFailure, null);
  assert.equal(decrypted.runtime.state.evidenceLoss, false);
  await assert.rejects(() => observer.finish(), /R14_OBSERVATION/u);
});

test("actual ignored Git stderr is retained privately without introducing a maxBuffer error", async (t) => {
  const f = await fixture(t);
  const observer = f.create();
  let error;
  try {
    withSourceDiagnosticCapture(observer, () =>
      withReplayAdmissionScope(() =>
        sourceDiagnosticGit(
          "PRODUCT_EXPERIENCE",
          ["show", `${f.head}:src/${canary}.txt`],
          options(f.root, { maxBuffer: 8 }),
        ),
      ),
    );
  } catch (cause) {
    error = cause;
  }
  assert.equal(error?.status, 128);
  assert.equal(error.code, undefined);
  observer.rememberFinalFailure(error);
  const summary = await observer.finish();
  assert.equal(summary.status, "COMPLETE");
  assert.equal(summary.retainedGitThrows, 1);
  assert(!JSON.stringify(summary).includes(canary));
  assert(!readFileSync(f.destination).includes(Buffer.from(canary)));
  const decrypted = authenticateFixture(f, summary);
  assert.equal(decrypted.records[0].error.status, 128);
  assert(Buffer.from(decrypted.records[0].capturedStderr.content, "base64").includes(Buffer.from(canary)));
  assert.equal(decrypted.runtime.finalFailure.status, 128);
});

test("scope and supported-command guards keep unrelated Git reads outside observation", async (t) => {
  const f = await fixture(t);
  const observer = f.create();
  withSourceDiagnosticCapture(observer, () => {
    assert.equal(sourceDiagnosticGit("PRODUCT_EXPERIENCE", ["rev-parse", "HEAD"], options(f.root)).trim(), f.head);
    withReplayAdmissionScope(() => {
      assert.equal(sourceDiagnosticGit("UNKNOWN", ["rev-parse", "HEAD"], options(f.root)).trim(), f.head);
      assert.equal(sourceDiagnosticGit("PRODUCT_EXPERIENCE", ["status", "--porcelain"], options(f.root)), "");
    });
  });
  const summary = await observer.finish();
  assert.equal(summary.supportedGitReads, 0);
  assert.deepEqual(authenticateFixture(f, summary).records, []);
});

test("exact transport replacement preserves return/error identity and captures bounded native causes privately", async (t) => {
  const f = await fixture(t);
  const observer = f.create();
  const invocation = options(f.root);
  const result = { sentinel: "same object" };
  assert.equal(
    observer.executeGitRead(
      (command, args, selected) => {
        assert.equal(command, "git");
        assert.deepEqual(args, ["rev-parse", "HEAD"]);
        assert.deepEqual({ ...selected, stdio: invocation.stdio }, invocation);
        assert(Number.isInteger(selected.stdio[2]));
        writeSync(selected.stdio[2], Buffer.from("discard successful stderr"));
        return result;
      },
      ["rev-parse", "HEAD"],
      invocation,
    ),
    result,
  );
  const nested = Object.assign(new Error(`${canary} inner`), {
    code: "ENOENT",
    errno: -2,
    syscall: "spawn git",
    path: "/inert/private/git",
    spawnargs: ["show", canary],
  });
  const error = Object.assign(new Error(`${canary} outer`, { cause: nested }), {
    status: 7,
    signal: "SIGTERM",
    stdout: Buffer.from([0, 255, 10]),
    stderr: Buffer.from("original private stderr"),
    secretUnknownField: "MUST_NOT_ENUMERATE_ERROR_PROPERTIES",
  });
  assert.throws(
    () =>
      observer.executeGitRead(
        (_command, _args, selected) => {
          writeSync(selected.stdio[2], Buffer.from(`${canary} captured\n`));
          throw error;
        },
        ["show", `${f.head}:src/fixture.txt`],
        invocation,
      ),
    (caught) => caught === error,
  );
  observer.rememberFinalFailure(error);
  const summary = await observer.finish();
  const decrypted = authenticateFixture(f, summary);
  assert.equal(summary.status, "COMPLETE");
  assert.equal(decrypted.records[0].error.message, error.message);
  assert.equal(decrypted.records[0].error.cause.message, nested.message);
  assert.equal(decrypted.runtime.finalFailure.cause.code, "ENOENT");
  assert.equal(decrypted.runtime.finalFailure.cause.errno, -2);
  assert.equal(decrypted.runtime.finalFailure.cause.syscall, "spawn git");
  assert.equal(decrypted.runtime.finalFailure.cause.path, "/inert/private/git");
  assert.deepEqual(decrypted.runtime.finalFailure.cause.spawnargs, ["show", canary]);
  assert(!JSON.stringify(decrypted).includes("MUST_NOT_ENUMERATE_ERROR_PROPERTIES"));
  assert(!JSON.stringify(decrypted).includes("discard successful stderr"));
  assert(!JSON.stringify(summary).includes(canary));
});

test("the exact private campaign commit probe retains stderr without expanding public classification", async (t) => {
  const f = await fixture(t);
  const observer = f.create();
  let error;
  try {
    withSourceDiagnosticCapture(observer, () =>
      withReplayAdmissionScope(() =>
        sourceDiagnosticGit(
          "EXPERIENCE_EXCEPTION",
          ["cat-file", "-e", `${"b".repeat(40)}^{commit}`],
          options(f.root, { maxBuffer: 64 * 1024 * 1024 }),
        ),
      ),
    );
  } catch (cause) {
    error = cause;
  }
  assert.equal(error?.status, 128);
  assert.equal(replayAdmissionFailure(error)?.git ?? null, null);
  // An options-bearing near match must retain its original unobserved transport.
  withSourceDiagnosticCapture(observer, () =>
    withReplayAdmissionScope(() =>
      sourceDiagnosticGit(
        "EXPERIENCE_EXCEPTION",
        ["cat-file", "-e", `${f.head}^{commit}`],
        options(f.root, { maxBuffer: 64 * 1024 * 1024, env: {} }),
      ),
    ),
  );
  const summary = await observer.finish();
  assert.equal(summary.status, "COMPLETE");
  assert.equal(summary.supportedGitReads, 1);
  assert.equal(summary.retainedGitThrows, 1);
  const record = authenticateFixture(f, summary).records[0];
  assert.deepEqual(record.argv, ["cat-file", "-e", `${"b".repeat(40)}^{commit}`]);
  assert(record.capturedStderr.bytes > 0);
});

test("cyclic causes are represented explicitly and excessive depth loses evidence without fabricating completeness", async (t) => {
  const f = await fixture(t);
  const observer = f.create();
  const error = new Error("inert cyclic cause");
  error.cause = error;
  observer.rememberFinalFailure(error);
  const summary = await observer.finish();
  assert.equal(summary.status, "COMPLETE");
  assert.deepEqual(authenticateFixture(f, summary).runtime.finalFailure.cause, { reference: 0 });
  const nested = await fixture(t);
  const bounded = nested.create();
  let deep = new Error("deepest inert cause");
  for (let i = 0; i < 8; i++) deep = new Error(`inert cause ${i}`, { cause: deep });
  bounded.rememberFinalFailure(deep);
  const incomplete = await bounded.finish();
  assert.equal(incomplete.status, "EVIDENCE_LOSS");
  assert.equal(incomplete.evidenceLoss, true);
  assert.equal(authenticateFixture(nested, incomplete).runtime.finalFailure, null);
});

test("nonhistorical stdio options remain exact, and preexisting output bytes are never overwritten", async (t) => {
  const f = await fixture(t);
  const observer = f.create();
  const invocation = options(f.root, { stdio: ["ignore", "pipe", "pipe"] });
  const original = Object.assign(new Error("inert pipe error"), { stderr: Buffer.from("pipe retained") });
  assert.throws(
    () =>
      observer.executeGitRead(
        (_command, _args, selected) => {
          assert.equal(selected, invocation);
          throw original;
        },
        ["show", "HEAD"],
        invocation,
      ),
    (caught) => caught === original,
  );
  mkdirSync(path.dirname(f.destination), { recursive: true });
  writeFileSync(f.destination, "preexisting original\n", { flag: "wx", mode: 0o600 });
  const summary = await observer.finish();
  assert.equal(summary.status, "EVIDENCE_LOSS");
  assert.equal(summary.evidenceLoss, true);
  assert.equal(readFileSync(f.destination, "utf8"), "preexisting original\n");
});

test("source drift blocks a complete observation and does not repair source", async (t) => {
  const f = await fixture(t);
  const observer = f.create();
  writeFileSync(path.join(f.root, "src/fixture.txt"), "changed tracked bytes\n");
  const summary = await observer.finish();
  assert.equal(summary.status, "EVIDENCE_LOSS");
  assert.equal(summary.sourceUnchanged, false);
  assert.equal(summary.cleanup, true);
  assert.equal(readFileSync(path.join(f.root, "src/fixture.txt"), "utf8"), "changed tracked bytes\n");
});

test("the 129th thrown read remains the identical error while retention loss blocks completion", async (t) => {
  const f = await fixture(t);
  const observer = f.create();
  const error = new Error("inert bounded repeated read");
  for (let i = 0; i < 129; i++) {
    assert.throws(
      () =>
        observer.executeGitRead(
          () => {
            throw error;
          },
          ["show", "HEAD"],
          options(f.root),
        ),
      (caught) => caught === error,
    );
  }
  const summary = await observer.finish();
  assert.equal(summary.status, "EVIDENCE_LOSS");
  assert.equal(summary.observedGitThrows, 129);
  assert.equal(summary.retainedGitThrows, 128);
  assert.equal(authenticateFixture(f, summary).records.length, 128);
});

test("oversized stderr is rejected after child completion, without claiming a hard disk cap", async (t) => {
  const f = await fixture(t);
  const observer = f.create();
  const error = new Error("inert oversized fd");
  assert.throws(
    () =>
      observer.executeGitRead(
        (_command, _args, selected) => {
          ftruncateSync(selected.stdio[2], f.module.R14_OBSERVATION.maximumBytes + 1);
          throw error;
        },
        ["show", "HEAD"],
        options(f.root),
      ),
    (caught) => caught === error,
  );
  const summary = await observer.finish();
  assert.equal(summary.status, "EVIDENCE_LOSS");
  assert.equal(summary.observedGitThrows, 1);
  assert.equal(summary.retainedGitThrows, 0);
  assert.equal(summary.cleanup, true);
  assert.deepEqual(authenticateFixture(f, summary).records, []);
});

test("a swapped private stderr name loses evidence without touching its symlink target", async (t) => {
  const f = await fixture(t);
  const observer = f.create();
  const target = path.join(f.parent, "untouched-target");
  writeFileSync(target, "unchanged target\n");
  const error = new Error("inert swapped fd name");
  assert.throws(
    () =>
      observer.executeGitRead(
        (_command, _args, selected) => {
          const filename = readlinkSync(`/proc/self/fd/${selected.stdio[2]}`);
          writeSync(selected.stdio[2], Buffer.from("original observed bytes"));
          unlinkSync(filename);
          symlinkSync(target, filename);
          throw error;
        },
        ["show", "HEAD"],
        options(f.root),
      ),
    (caught) => caught === error,
  );
  const summary = await observer.finish();
  assert.equal(summary.status, "EVIDENCE_LOSS");
  assert.equal(summary.retainedGitThrows, 0);
  assert.equal(summary.cleanup, true);
  assert.equal(readFileSync(target, "utf8"), "unchanged target\n");
});

test("output parent symlinks are rejected before creating directories outside the checkout", async (t) => {
  const f = await fixture(t);
  const observer = f.create();
  const outside = path.join(f.parent, "owned-outside-output");
  mkdirSync(outside);
  symlinkSync(outside, path.join(f.root, "artifacts"));
  const summary = await observer.finish();
  assert.equal(summary.status, "EVIDENCE_LOSS");
  assert.equal(summary.evidenceLoss, true);
  assert.deepEqual(readdirSync(outside), []);
});

test("trusted ciphertext validation binds actual bytes and rejects missing, substituted and unsafe files", async (t) => {
  const f = await fixture(t);
  const summary = await f.create().finish();
  assert.equal(summary.status, "COMPLETE");
  const validate = (file = f.destination, observation = summary) =>
    f.module.validateR14ObservationCiphertext({ file, observation });
  validate();
  const original = readFileSync(f.destination);
  for (const patch of [{ runId: summary.runId + 1 }, { candidateSha: "b".repeat(40) }, { keyId: "c".repeat(64) }]) {
    assert.throws(() => validate(f.destination, { ...summary, ...patch }), /R14_OBSERVATION/u);
  }
  const corrupted = Buffer.from(original);
  corrupted[corrupted.length - 2] ^= 1;
  writeFileSync(f.destination, corrupted);
  assert.throws(() => validate(), /R14_OBSERVATION/u);
  writeFileSync(f.destination, original);
  const outer = JSON.parse(original);
  const header = JSON.parse(Buffer.from(outer.aad, "base64"));
  for (const mutate of [
    (value) => {
      value.runId++;
    },
    (value) => {
      value.extraPrivateContext = "denied";
    },
    (value) => {
      value.nonce = Buffer.alloc(11).toString("base64");
    },
    (value) => {
      value.wrappedKey = Buffer.alloc(383).toString("base64");
    },
  ]) {
    const changedHeader = structuredClone(header);
    mutate(changedHeader);
    const bytes = Buffer.from(
      JSON.stringify({ ...outer, aad: Buffer.from(JSON.stringify(changedHeader)).toString("base64") }),
    );
    writeFileSync(f.destination, bytes);
    assert.throws(
      () =>
        validate(f.destination, {
          ...summary,
          ciphertextBytes: bytes.length,
          ciphertextDigest: digest(bytes),
        }),
      /R14_OBSERVATION/u,
    );
  }
  const noncanonical = Buffer.from(JSON.stringify(outer) + "\n");
  writeFileSync(f.destination, noncanonical);
  assert.throws(
    () =>
      validate(f.destination, {
        ...summary,
        ciphertextBytes: noncanonical.length,
        ciphertextDigest: digest(noncanonical),
      }),
    /R14_OBSERVATION/u,
  );
  writeFileSync(f.destination, original);
  const alternate = path.join(f.parent, "alternate.encrypted");
  writeFileSync(alternate, original);
  assert.throws(() => validate(alternate), /R14_OBSERVATION/u);
  unlinkSync(f.destination);
  assert.throws(() => validate(), /R14_OBSERVATION|ENOENT/u);
  symlinkSync(alternate, f.destination);
  assert.throws(() => validate(), /R14_OBSERVATION|ELOOP/u);
  unlinkSync(f.destination);
  linkSync(alternate, f.destination);
  assert.throws(() => validate(), /R14_OBSERVATION/u);
  unlinkSync(f.destination);
  mkdirSync(f.destination);
  assert.throws(() => validate(), /R14_OBSERVATION/u);
  rmSync(f.destination, { recursive: true });
  const descriptor = openSync(f.destination, "wx", 0o600);
  try {
    ftruncateSync(descriptor, 64 * 1024 * 1024 + 1);
  } finally {
    closeSync(descriptor);
  }
  assert.throws(() => validate(), /R14_OBSERVATION/u);
});
