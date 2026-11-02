import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import {
  preparationPublisherContext,
  compareTransferredPreparationShadow,
  PREPARATION_PUBLISHER_READERS,
  PREPARATION_SHADOW_WORKFLOW,
} from "../../scripts/sounding-line/preparation-publisher-shadow.mjs";
import { createPreparationCapsuleShadow } from "../../scripts/sounding-line/preparation-capsule-shadow.mjs";
import {
  measurePreparationContentShadow,
  inspectPreparationContentShadow,
  restorePreparationObservationModesShadow,
} from "../../scripts/sounding-line/preparation-content-shadow.mjs";
const repository = fileURLToPath(new URL("../..", import.meta.url));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
function context(jobKey = "publisher") {
  return {
    repository: "Kgray44/treasurehuntSoT",
    repositoryId: 1303074266,
    actor: "Kgray44",
    actorId: 64373011,
    ref: "refs/heads/main",
    event: "workflow_dispatch",
    workflowRef: `Kgray44/treasurehuntSoT/${PREPARATION_SHADOW_WORKFLOW}@refs/heads/main`,
    workflowSha: "a".repeat(40),
    runId: 101,
    attempt: 1,
    jobKey,
    sourceCommit: "a".repeat(40),
    sourceTree: "b".repeat(40),
    readerDigest: "c".repeat(64),
    nonce: (jobKey === "publisher" ? "1" : "2").repeat(64),
  };
}
function temporary(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "preparation-publisher-shadow-"));
  t.after(() => {
    assert(root.startsWith(path.resolve(os.tmpdir()) + path.sep));
    fs.rmSync(root, { recursive: true });
  });
  return root;
}
function fixture(t) {
  const root = temporary(t),
    source = path.join(root, "source"),
    parent = path.join(root, "private"),
    fresh = path.join(root, "fresh"),
    directory = path.join(root, "downloaded");
  fs.mkdirSync(source);
  fs.mkdirSync(parent);
  fs.writeFileSync(path.join(source, "index.js"), "module.exports = {};\n");
  fs.writeFileSync(path.join(source, "schema.prisma"), "synthetic public schema\n");
  fs.chmodSync(path.join(source, "index.js"), 0o755);
  fs.cpSync(source, fresh, { recursive: true });
  const capsule = createPreparationCapsuleShadow({ source, directory: parent, layer: "prisma-client" });
  assert.equal(capsule.status, "PASS");
  fs.cpSync(capsule.root, directory, { recursive: true });
  fs.chmodSync(path.join(directory, "payload/index.js"), 0o644);
  const publisher = {
    kind: "PREPARATION_SOURCE_CAPSULE_SHADOW",
    version: 1,
    context: preparationPublisherContext(context()),
    identity: { inputFingerprint: "d".repeat(64) },
    capsule: {
      inventoryDigest: capsule.inventoryDigest,
      byteLength: capsule.bytes,
      fileCount: capsule.files,
      manifestSha256: capsule.manifestSha256,
      initialSha256: hash(fs.readFileSync(path.join(directory, "initial.json"))),
    },
    certificate: "NOT_ISSUED",
    qualification: false,
    reuseAuthorized: false,
  };
  const writePublisher = () => fs.writeFileSync(path.join(directory, "publisher.json"), JSON.stringify(publisher));
  writePublisher();
  return {
    root,
    source,
    fresh,
    directory,
    publisher,
    writePublisher,
    compare: () =>
      compareTransferredPreparationShadow({
        directory,
        context: preparationPublisherContext(context("independent-verifier")),
        inputFingerprint: "d".repeat(64),
        freshObservation: measurePreparationContentShadow({ root: fresh, layer: "prisma-client" }),
      }),
  };
}

test("preparation context is strict declared scope and never provider or reuse authority", () => {
  const value = preparationPublisherContext(context());
  assert(Object.isFrozen(value));
  assert.equal(value.qualification, false);
  assert.equal(value.reuseAuthorized, false);
  assert.equal(value.certificate, "NOT_ISSUED");
  assert.equal(
    preparationPublisherContext(JSON.parse(JSON.stringify(value))).authentication,
    "DECLARED_NATIVE_CONTEXT_NOT_PROVIDER_PROOF",
  );
  for (const change of [
    { repositoryId: 1 },
    { actor: "another-owner" },
    { actorId: 1 },
    { ref: "refs/heads/candidate" },
    { event: "pull_request_target" },
    { attempt: 2 },
    { runId: 0 },
    { jobKey: "final-check" },
    { workflowSha: "f".repeat(40) },
    { sourceTree: "bad" },
    { nonce: "short" },
    { readerDigest: "short" },
    { injected: true },
  ])
    assert.throws(() => preparationPublisherContext({ ...context(), ...change }));
  assert.throws(() => preparationPublisherContext({ ...value, qualification: true }));
  let calls = 0;
  const accessor = { ...context() };
  Object.defineProperty(accessor, "nonce", {
    enumerable: true,
    get() {
      calls++;
      return "1".repeat(64);
    },
  });
  assert.throws(() => preparationPublisherContext(accessor));
  assert.equal(calls, 0);
});

test("independent transfer comparison preserves original contexts and restores original modes as new observations", (t) => {
  const f = fixture(t),
    before = fs.statSync(path.join(f.source, "index.js")).mode & 0o777;
  const result = f.compare();
  assert.equal(result.equivalent, true);
  assert.equal(result.originalProducer.jobKey, "publisher");
  assert.equal(result.independentVerifier.jobKey, "independent-verifier");
  assert.notEqual(result.originalProducer.nonce, result.independentVerifier.nonce);
  assert.equal(fs.statSync(path.join(f.directory, "payload/index.js")).mode & 0o777, before);
  assert.equal(result.restoredObservation.inventoryDigest, result.inventoryDigest);
  assert.equal(result.providerAuthentication, "NOT_ESTABLISHED_BY_THIS_RECEIPT");
  assert.equal(result.certificate, "NOT_ISSUED");
  assert.equal(result.qualification, false);
  assert.equal(result.reuseAuthorized, false);
  assert(Object.isFrozen(result.originalProducer));
});

test("self-consistent source/role/run substitutions, partial records and corrupted bytes cannot compare", (t) => {
  for (const change of ["nonce", "run", "reader", "fingerprint", "authority", "partial", "payload", "initial"]) {
    const f = fixture(t);
    if (change === "nonce") f.publisher.context = { ...f.publisher.context, nonce: "2".repeat(64) };
    if (change === "run") f.publisher.context = { ...f.publisher.context, runId: 102 };
    if (change === "reader") f.publisher.context = { ...f.publisher.context, readerDigest: "e".repeat(64) };
    if (change === "fingerprint") f.publisher.identity.inputFingerprint = "e".repeat(64);
    if (change === "authority") f.publisher.reuseAuthorized = true;
    if (change === "partial") {
      const p = path.join(f.directory, "manifest.json"),
        m = JSON.parse(fs.readFileSync(p));
      m.status = "INCOMPLETE";
      fs.writeFileSync(p, JSON.stringify(m));
      f.publisher.capsule.manifestSha256 = hash(fs.readFileSync(p));
    }
    if (change === "payload") fs.appendFileSync(path.join(f.directory, "payload/index.js"), "corrupt");
    if (change === "initial") fs.appendFileSync(path.join(f.directory, "initial.json"), "corrupt");
    f.writePublisher();
    assert.throws(() => f.compare(), undefined, change);
  }
});

test("mode restoration cannot operate from a cloned observation or a replaced inode and cannot reset allowance", (t) => {
  const root = temporary(t),
    file = path.join(root, "index.js");
  fs.writeFileSync(file, "original");
  const observation = measurePreparationContentShadow({ root, layer: "prisma-client" }),
    inventory = inspectPreparationContentShadow(observation).entries;
  assert.throws(
    () => restorePreparationObservationModesShadow(JSON.parse(JSON.stringify(observation)), inventory),
    /UNAVAILABLE/u,
  );
  const desired = inventory.map((entry) =>
    entry.type === "file" ? { ...entry, mode: entry.mode === 0o755 ? 0o644 : 0o755 } : entry,
  );
  const other = path.join(temporary(t), "other.js");
  fs.writeFileSync(other, "original");
  const held = path.join(temporary(t), "original-held.js"),
    open = fs.openSync;
  let swapped = false;
  fs.openSync = (...args) => {
    if (args[0] === file && !swapped) {
      swapped = true;
      fs.renameSync(file, held);
      fs.renameSync(other, file);
    }
    return open(...args);
  };
  try {
    assert.throws(() => restorePreparationObservationModesShadow(observation, desired), /INODE_DRIFT/u);
  } finally {
    fs.openSync = open;
  }
  assert.equal(fs.statSync(file).mode & 0o777, inventory.find((entry) => entry.path === "index.js").mode);
  assert.throws(() => restorePreparationObservationModesShadow(observation, desired), /SPENT/u);
});

test("a copied fresh observation cannot authorize a transferred comparison", (t) => {
  const f = fixture(t),
    measured = measurePreparationContentShadow({ root: f.fresh, layer: "prisma-client" });
  assert.throws(
    () =>
      compareTransferredPreparationShadow({
        directory: f.directory,
        context: preparationPublisherContext(context("independent-verifier")),
        inputFingerprint: "d".repeat(64),
        freshObservation: JSON.parse(JSON.stringify(measured)),
      }),
    /FRESH_OBSERVATION/u,
  );
});

test("publisher and independent job use the exact declared reader closure without implicit modules", (t) => {
  const root = temporary(t);
  for (const file of PREPARATION_PUBLISHER_READERS) {
    const target = path.join(root, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(repository, file), target);
  }
  const result = execFileSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      "const m=await import('./scripts/sounding-line/preparation-publisher-shadow.mjs');console.log(m.PREPARATION_PUBLISHER_READERS.length)",
    ],
    { cwd: root, encoding: "utf8", timeout: 10000, maxBuffer: 65536 },
  );
  assert.equal(Number(result.trim()), PREPARATION_PUBLISHER_READERS.length);
  const workflow = fs.readFileSync(path.join(repository, PREPARATION_SHADOW_WORKFLOW), "utf8");
  const closures = [...workflow.matchAll(/sparse-checkout: \|\r?\n((?: {12}\/[^\r\n]+\r?\n)+)/gu)].map((match) =>
    match[1]
      .trim()
      .split(/\r?\n/u)
      .map((value) => value.trim().slice(1))
      .sort(),
  );
  assert.equal(closures.length, 2);
  for (const paths of closures) assert.deepEqual(paths, [...PREPARATION_PUBLISHER_READERS].sort());
  const verifier = workflow.slice(workflow.indexOf("  independent-verifier:"));
  assert(
    verifier.indexOf("Generate independent fresh Prisma client before downloading cache") <
      verifier.indexOf("Download only this run's exact original capsule artifact"),
  );
  assert.match(verifier, /artifact-ids: \$\{\{ needs\.publisher\.outputs\.artifact_id \}\}/u);
  assert.match(workflow, /contents: read\n  actions: read/u);
  assert(!/continue-on-error|permissions:\s*write/gu.test(workflow));
  assert.equal((workflow.match(/timeout-minutes: 10/gu) ?? []).length, 2);
});
