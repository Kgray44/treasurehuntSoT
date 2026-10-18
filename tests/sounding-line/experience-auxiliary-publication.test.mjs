// Modeled source-only boundary regressions. No original archive reproduction or product acceptance is claimed.
import assert from "node:assert/strict";
import { constants as cryptoConstants, createDecipheriv, generateKeyPairSync, privateDecrypt } from "node:crypto";
import { EventEmitter } from "node:events";
import { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { rename } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import AxeBuilder from "@axe-core/playwright";
import {
  createRawOutputDirectory,
  EXPERIENCE_RAW_OUTPUT,
  rawCaptureBinding,
  copyDeclaredCaptureFile,
  sealRawCaptureOutput,
} from "../../scripts/sounding-line/experience-raw-output.mjs";
import {
  captureAndPublishExperience,
  publishExperienceCapture,
} from "../../scripts/sounding-line/experience-capture-publication.mjs";
import { validateExperienceArtifacts } from "../../scripts/sounding-line/product-experience.mjs";
import { validatePairedEvidence } from "../../scripts/sounding-line/experience-paired.mjs";
import {
  retainRawCaptureOutput,
  retainInterruptedRawCapture,
  verifiedRawCapturePaths,
} from "../../scripts/sounding-line/experience-raw-retention.mjs";
import { sealPosttechnicalEvidence } from "../../scripts/sounding-line/replay-posttechnical-diagnostic.mjs";
import {
  canonical,
  contractIds,
  completedCapture,
  evidencePath,
  fakePairedRun,
  fixture,
  hash,
  identity,
  publicationJsonFiles,
  readJson,
  relative,
  snapshot,
  staging,
  staged,
  webm,
  write,
} from "./fixtures/auxiliary-publication-modeled.mjs";

const keys = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});
const encryption = { publicKey: keys.publicKey, keyId: hash(keys.publicKey) };
const retainSynthetic = (options) => retainRawCaptureOutput({ ...options, encryption });
const rawDirectoryFor = (paths) => `${path.posix.dirname(paths.capture_stage_path)}/raw`;

function decryptEnvelope(bytes) {
  const envelope = JSON.parse(bytes),
    aad = Buffer.from(envelope.aad, "base64"),
    header = JSON.parse(aad);
  assert.equal(envelope.format, "VW-POSTTECHNICAL-EVIDENCE-1");
  const key = privateDecrypt(
    {
      key: keys.privateKey,
      oaepHash: "sha256",
      oaepLabel: Buffer.from("VW-POSTTECHNICAL-EVIDENCE-1"),
      padding: cryptoConstants.RSA_PKCS1_OAEP_PADDING,
    },
    Buffer.from(header.wrappedKey, "base64"),
  );
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(header.nonce, "base64"));
  decipher.setAAD(aad);
  decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
  const payload = JSON.parse(
    Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, "base64")), decipher.final()]),
  );
  for (const file of payload.files) {
    const content = Buffer.from(file.content, "base64");
    assert.equal(file.bytes, content.length);
    assert.equal(file.sha256, hash(content));
  }
  return { header, payload };
}

function reconstructRetention(root, encryptedDirectory, binding) {
  const receipt = readJson(root, `${encryptedDirectory}/retention.json`);
  assert.equal(receipt.retention, "COMPLETE");
  assert.equal(receipt.acceptance, false);
  assert.equal(receipt.qualification, false);
  const envelopes = new Map();
  for (const file of receipt.encryptedFiles) {
    const bytes = readFileSync(path.join(root, encryptedDirectory, file.name));
    assert.equal(bytes.length, file.bytes);
    assert.equal(hash(bytes), file.sha256);
    const decoded = decryptEnvelope(bytes);
    assert.deepEqual(decoded.header.binding, binding);
    assert.equal(decoded.header.qualification, false);
    envelopes.set(file.name, decoded);
  }
  const index = JSON.parse(
    Buffer.from(
      envelopes.get("index.encrypted").payload.files.find((file) => file.name === "index.json").content,
      "base64",
    ),
  );
  assert.equal(index.acceptance, false);
  assert.equal(index.qualification, false);
  assert.equal(index.outcomeScope, "CAPTURE_PRODUCER");
  assert.deepEqual(index.binding, binding);
  const parts = [];
  for (const file of index.files) {
    const { chunks, ...expectedFile } = file,
      reconstructed = [];
    let offset = 0;
    for (const chunk of chunks) {
      assert.equal(chunk.offset, offset);
      parts.push(chunk.name);
      const decoded = envelopes.get(chunk.name),
        metadata = JSON.parse(
          Buffer.from(decoded.payload.files.find((member) => member.name === "metadata.json").content, "base64"),
        );
      assert.deepEqual(metadata.file, expectedFile);
      assert.deepEqual(metadata.chunk, chunk);
      assert.deepEqual(metadata.binding, binding);
      const bytes = Buffer.from(decoded.payload.files.find((member) => member.name === "chunk.bin").content, "base64");
      assert.equal(bytes.length, chunk.bytes);
      assert.equal(hash(bytes), chunk.sha256);
      assert(bytes.length <= 16 * 1024 * 1024);
      reconstructed.push(bytes);
      offset += bytes.length;
      assert.equal(JSON.stringify(decoded.header).includes(file.path), false);
    }
    const bytes = Buffer.concat(reconstructed);
    assert.equal(bytes.length, file.bytes);
    assert.equal(hash(bytes), file.sha256);
    assert.deepEqual(bytes, readFileSync(path.join(root, file.path)));
    assert.equal(JSON.stringify(receipt).includes(file.path), false);
    assert.equal(JSON.stringify(receipt).includes(file.sha256), false);
  }
  assert.equal(new Set(parts).size, parts.length);
  assert.deepEqual(
    parts.sort(),
    receipt.encryptedFiles
      .map((file) => file.name)
      .filter((name) => name !== "index.encrypted")
      .sort(),
  );
  return { receipt, index };
}

async function tinyRawFixture(t) {
  const f = fixture(t),
    rawDirectory = `${staging}/capture-recovery/raw`,
    encryptedDirectory = `${staging}/capture-recovery/encrypted`;
  await createRawOutputDirectory({ root: f.root, directory: rawDirectory });
  write(f.root, `${rawDirectory}/SOURCE_ONLY_PRIVATE_AUXILIARY.webm`, webm);
  return {
    ...f,
    rawDirectory,
    encryptedDirectory,
    binding: rawCaptureBinding(f.plan),
    outcome: "FAIL",
    beforeRaw: snapshot(f.root, rawDirectory),
  };
}

function changedEnvelope(input, change) {
  const envelope = JSON.parse(sealPosttechnicalEvidence(input)),
    header = JSON.parse(Buffer.from(envelope.aad, "base64"));
  change(envelope, header);
  envelope.aad = Buffer.from(JSON.stringify(header)).toString("base64");
  return Buffer.from(JSON.stringify(envelope));
}

function changedAad(input, change) {
  const aad = structuredClone(input.aad);
  change(aad);
  // Produce valid GCM with deliberately wrong clear bindings. Rejection therefore
  // tests expected-header validation, not authentication failure in a test decryptor.
  return sealPosttechnicalEvidence({ ...input, aad });
}

// The installed AxeBuilder implementation itself creates/closes its finishRun blank page.
// Only the Playwright evaluation/video I/O boundary is modeled; no Axe method is replaced.
class VideoContext extends EventEmitter {
  constructor(root, directory, existingPrimary = null) {
    super();
    this.root = root;
    this.directory = directory;
    this.existingPrimary = existingPrimary;
    this.pagesMade = [];
  }
  async newPage() {
    const index = this.pagesMade.length;
    const file =
      index === 0 && this.existingPrimary
        ? this.existingPrimary
        : `${this.directory}/${index === 0 ? "primary" : "auxiliary"}-${index}.webm`;
    const context = { instance: this, root: this.root };
    const page = new EventEmitter();
    Object.assign(page, {
      closed: false,
      evaluationNames: [],
      context: () => context.instance,
      mainFrame: () => page,
      video: () => ({ path: async () => path.join(context.root, file) }),
      async evaluate(operation) {
        if (typeof operation === "string") return operation.startsWith("typeof ") ? true : undefined;
        this.evaluationNames.push(operation.name);
        if (operation.name === "axeGetFrameContexts") return [];
        if (operation.name === "axeRunPartial") return { modeledPartial: true };
        if (operation.name === "chunkResultString") return undefined;
        if (operation.name === "axeFinishRun") return { violations: [], incomplete: [], modeledOnly: true };
        assert.fail(`Unexpected real Axe dependency boundary: ${operation.name}`);
      },
      async close() {
        if (this.closed) return;
        this.closed = true;
        if (!existsSync(path.join(context.root, file))) write(context.root, file, webm);
        this.emit("close");
      },
    });
    this.pagesMade.push(page);
    this.emit("page", page);
    return page;
  }
  async close() {
    for (const page of this.pagesMade) await page.close();
  }
}

function retained(before, root, directory) {
  const after = snapshot(root, directory);
  for (const [file, value] of Object.entries(before)) assert.deepEqual(after[file], value, file);
}

async function rawFixture(t) {
  const f = await staged(t),
    rawDirectory = `${path.posix.dirname(f.workingDirectory)}/raw`;
  await createRawOutputDirectory({ root: f.root, directory: rawDirectory });
  const binding = rawCaptureBinding(f.plan),
    declarations = [],
    auxiliaryFiles = [];
  const required = f.replay.captured.artifacts.filter(
    (artifact) => artifact.type === "recording" && !artifact.state?.startsWith("PAIRED_"),
  );
  assert.equal(required.length, 32);
  for (const [index, artifact] of required.entries()) {
    const source = `${rawDirectory}/generic/recordings/context-${index}/${path.posix.basename(artifact.path)}`;
    mkdirSync(path.dirname(path.join(f.root, source)), { recursive: true });
    await rename(path.join(f.root, artifact.path), path.join(f.root, source));
    const context = new VideoContext(f.root, path.posix.dirname(source), source),
      main = await context.newPage();
    const result = await new AxeBuilder({ page: main }).analyze();
    assert.equal(result.modeledOnly, true);
    assert.deepEqual(result.violations, []);
    assert.equal(context.pagesMade.length, 2);
    assert.equal(context.pagesMade[1].closed, true);
    const auxiliary = relative(f.root, await context.pagesMade[1].video().path());
    auxiliaryFiles.push(auxiliary);
    await context.close();
    declarations.push(
      await copyDeclaredCaptureFile({
        root: f.root,
        rawDirectory,
        source,
        destination: artifact.path,
        kind: "recording",
        binding,
      }),
    );
  }
  const pairDirectory = `${f.workingDirectory}/generic/paired`,
    pairs = snapshot(f.root, pairDirectory);
  for (const file of Object.keys(pairs)) {
    const source = `${rawDirectory}/generic/paired/${file.slice(pairDirectory.length + 1)}`;
    mkdirSync(path.dirname(path.join(f.root, source)), { recursive: true });
    await rename(path.join(f.root, file), path.join(f.root, source));
    const kind = file.endsWith(".json")
      ? "json"
      : file.endsWith(".png")
        ? "screenshot"
        : file.endsWith(".webm")
          ? "recording"
          : "trace";
    declarations.push(
      await copyDeclaredCaptureFile({ root: f.root, rawDirectory, source, destination: file, kind, binding }),
    );
  }
  const rawOnly = `${rawDirectory}/generic/paired/unregistered-diagnostic.txt`;
  write(f.root, rawOnly, "modeled raw-only diagnostic, never evidence\n");
  const beforeRaw = snapshot(f.root, rawDirectory),
    beforeStage = snapshot(f.root, f.workingDirectory);
  return { ...f, rawDirectory, binding, declarations, auxiliaryFiles, rawOnly, beforeRaw, beforeStage };
}

async function inventory(f, outcome) {
  await sealRawCaptureOutput({ root: f.root, rawDirectory: f.rawDirectory, binding: f.binding, outcome });
  return readJson(f.root, `${f.rawDirectory}/raw-output-inventory.json`);
}

test("real Axe dependency finishRun retains a modeled auxiliary video without disabling modern analysis", async (t) => {
  const f = await staged(t),
    rawDirectory = `${path.posix.dirname(f.workingDirectory)}/raw`;
  await createRawOutputDirectory({ root: f.root, directory: rawDirectory });
  const context = new VideoContext(f.root, `${rawDirectory}/generic/recordings`),
    primary = await context.newPage();
  assert.equal(existsSync(await primary.video().path()), false);
  const result = await new AxeBuilder({ page: primary }).analyze();
  assert.equal(result.modeledOnly, true);
  assert(primary.evaluationNames.includes("axeRunPartial"));
  assert.equal(context.pagesMade.length, 2);
  const blank = context.pagesMade[1];
  assert(blank.evaluationNames.includes("axeFinishRun"));
  assert.equal(blank.closed, true);
  assert.equal(existsSync(await blank.video().path()), true);
  assert.equal(existsSync(await primary.video().path()), false);
  const destination = `${f.workingDirectory}/generic/primary-0.webm`,
    source = relative(f.root, await primary.video().path());
  await assert.rejects(
    copyDeclaredCaptureFile({
      root: f.root,
      rawDirectory,
      source,
      destination,
      kind: "recording",
      binding: rawCaptureBinding(f.plan),
    }),
    /ENOENT/u,
  );
  await context.close();
  assert.equal(existsSync(await primary.video().path()), true);
  await copyDeclaredCaptureFile({
    root: f.root,
    rawDirectory,
    source,
    destination,
    kind: "recording",
    binding: rawCaptureBinding(f.plan),
  });
  assert.equal(readFileSync(path.join(f.root, destination)).equals(webm), true);
  assert.equal(existsSync(path.join(f.root, f.workingDirectory, "generic", "auxiliary-1.webm")), false);
  assert.equal(readFileSync(await blank.video().path()).equals(webm), true);
  assert.deepEqual(snapshot(f.root), f.before);
});

test("modeled full seven-contract32+6 capture publishes only required closure and preserves complete raw auxiliary output", async (t) => {
  const f = await rawFixture(t);
  const result = await publishExperienceCapture(f),
    capture = JSON.parse(readFileSync(result.capturePath, "utf8"));
  assert.equal(capture.journeys.length, 32);
  assert.equal(capture.pairedEvidence.browserContexts, 6);
  assert.deepEqual([...new Set(capture.journeys.map((journey) => journey.contractId))].sort(), [...contractIds].sort());
  assert.equal(capture.journeys.length + capture.pairedEvidence.browserContexts, 38);
  assert.deepEqual(capture.journeys, f.replay.captured.journeys);
  assert.deepEqual(identity(capture.artifacts), identity(f.replay.captured.artifacts));
  validateExperienceArtifacts({ root: f.root, plan: f.plan, evidence: capture });
  validatePairedEvidence({
    root: f.root,
    plan: f.plan,
    evidence: capture,
    read: (file) => readFileSync(path.join(f.root, file)),
  });
  const journal = readJson(f.root, `${f.journalDirectory}/journal.json`);
  assert.equal(journal.status, "PASS");
  assert.deepEqual(
    journal.files.map((file) => file.path).sort(),
    [...publicationJsonFiles(), ...new Set(capture.artifacts.map((artifact) => artifact.path))].sort(),
  );
  const sealed = await inventory(f, "PASS");
  assert.equal(sealed.outcome, "PASS");
  assert.equal(sealed.qualification, false);
  assert.equal(sealed.acceptance, false);
  assert.deepEqual(sealed.binding, f.binding);
  for (const file of [...f.auxiliaryFiles, f.rawOnly]) {
    assert.equal(sealed.files.find((entry) => entry.path === file)?.classification, "RAW_ONLY", file);
    assert.equal(
      sealed.declarations.some((entry) => entry.source === file),
      false,
      file,
    );
    assert.equal(
      capture.artifacts.some((entry) => entry.path === file),
      false,
      file,
    );
  }
  assert.equal(sealed.declarations.filter((entry) => entry.kind === "recording").length, 38);
  assert.equal(sealed.files.filter((entry) => entry.classification === "DECLARED").length, f.declarations.length);
  retained(f.beforeRaw, f.root, f.rawDirectory);
  retained(f.beforeStage, f.root, f.workingDirectory);
  assert.deepEqual(readFileSync(path.join(f.root, evidencePath)), f.reviewBytes);
});

test("paired producer copies its complete typed closure byte-for-byte and retains undeclared raw auxiliary media", async (t) => {
  const f = fixture(t),
    workingDirectory = `${staging}/capture-modeled-pair/capture`,
    rawDirectory = `${staging}/capture-modeled-pair/raw`;
  mkdirSync(path.join(f.root, workingDirectory), { recursive: true });
  await createRawOutputDirectory({ root: f.root, directory: rawDirectory });
  let rawPair;
  const replay = await completedCapture({
    root: f.root,
    plan: { ...f.plan, outputDirectory: workingDirectory },
    rawOutputDirectory: `${rawDirectory}/generic`,
    runPaired: (command, args, options) => {
      const result = fakePairedRun(command, args, options);
      rawPair = relative(f.root, options.env.CROSSDECK_REFIT_ARTIFACT_ROOT);
      write(f.root, `${rawPair}/f7523d782c134663907bdef9cc0c594e.webm`, webm);
      return result;
    },
  });
  const raw = snapshot(f.root, rawPair),
    stagePair = snapshot(f.root, `${workingDirectory}/generic/paired`);
  assert.equal(replay.captured.journeys.length, 32);
  assert.equal(replay.captured.pairedEvidence.browserContexts, 6);
  // Runtime/profile are generated after the paired producer by the modeled replay,
  // while all 27 producer report/witness/observation/media files must match raw.
  assert.equal(Object.keys(stagePair).length, 29);
  const laterDiagnostics = new Set([
    replay.captured.pairedEvidence.runtime.path,
    replay.captured.pairedEvidence.profile.path,
  ]);
  for (const [file, entry] of Object.entries(stagePair)) {
    if (laterDiagnostics.has(file)) continue;
    const source = rawPair + file.slice(`${workingDirectory}/generic/paired`.length);
    assert.equal(raw[source].bytes, entry.bytes, file);
  }
  assert.equal(
    Object.keys(stagePair).some((file) => file.endsWith("f7523d782c134663907bdef9cc0c594e.webm")),
    false,
  );
  const sealed = await sealRawCaptureOutput({
    root: f.root,
    rawDirectory,
    binding: rawCaptureBinding(f.plan),
    outcome: "PASS",
  });
  assert.equal(sealed.declarations.length, 27);
  assert.equal(sealed.declarations.filter((entry) => entry.destination.endsWith("/observations.json")).length, 3);
  assert.equal(
    sealed.files.find((entry) => entry.path.endsWith("f7523d782c134663907bdef9cc0c594e.webm")).classification,
    "RAW_ONLY",
  );
  assert.deepEqual(snapshot(f.root), f.before);
});

test("failed paired execution preserves every raw output without copying failed outputs into closed staging", async (t) => {
  const f = fixture(t),
    workingDirectory = `${staging}/capture-failed-pair/capture`,
    rawDirectory = `${staging}/capture-failed-pair/raw`;
  mkdirSync(path.join(f.root, workingDirectory), { recursive: true });
  await createRawOutputDirectory({ root: f.root, directory: rawDirectory });
  let rawPair;
  await assert.rejects(
    completedCapture({
      root: f.root,
      plan: { ...f.plan, outputDirectory: workingDirectory },
      rawOutputDirectory: `${rawDirectory}/generic`,
      runPaired: (command, args, options) => {
        fakePairedRun(command, args, options);
        rawPair = relative(f.root, options.env.CROSSDECK_REFIT_ARTIFACT_ROOT);
        write(f.root, `${rawPair}/failed-auxiliary.webm`, webm);
        return { status: 1 };
      },
    }),
    /PAIRED_EXECUTION_FAILED/u,
  );
  assert.equal(Object.keys(snapshot(f.root, `${workingDirectory}/generic/paired`)).length, 0);
  const raw = snapshot(f.root, rawPair);
  assert.equal(Object.keys(raw).length, 28);
  const sealed = await sealRawCaptureOutput({
    root: f.root,
    rawDirectory,
    binding: rawCaptureBinding(f.plan),
    outcome: "FAIL",
  });
  assert.equal(sealed.declarations.length, 0);
  assert.equal(sealed.files.length, 28);
  assert(sealed.files.every((entry) => entry.classification === "RAW_ONLY"));
  retained(raw, f.root, rawPair);
  assert.deepEqual(snapshot(f.root), f.before);
});

test("actual wrapper seals before publication and rejects changed declared source without altering canonical preimages", async (t) => {
  const f = fixture(t),
    paths = {};
  let rawSource, stagedDestination;
  await assert.rejects(
    captureAndPublishExperience({
      ...f,
      retainRaw: retainSynthetic,
      environment: { [EXPERIENCE_RAW_OUTPUT]: "caller-value-must-be-replaced" },
      onPaths: async (value) => Object.assign(paths, value),
      replay: async (options) => {
        assert.equal(options.environment[EXPERIENCE_RAW_OUTPUT], rawDirectoryFor(paths));
        const replay = await completedCapture(options);
        const artifact = replay.captured.artifacts.find((entry) => entry.type === "recording");
        rawSource = `${rawDirectoryFor(paths)}/generic/${path.posix.basename(artifact.path)}`;
        stagedDestination = artifact.path;
        mkdirSync(path.dirname(path.join(f.root, rawSource)), { recursive: true });
        await rename(path.join(f.root, artifact.path), path.join(f.root, rawSource));
        await copyDeclaredCaptureFile({
          root: f.root,
          rawDirectory: rawDirectoryFor(paths),
          source: rawSource,
          destination: artifact.path,
          kind: "recording",
          binding: rawCaptureBinding(f.plan),
        });
        writeFileSync(path.join(f.root, rawSource), Buffer.concat([webm, Buffer.from("modeled source mutation")]));
        return replay;
      },
    }),
    (error) => error instanceof AggregateError && /RAW_OUTPUT_DECLARATION_CHANGED/u.test(error.cause?.message),
  );
  assert.deepEqual(snapshot(f.root), f.before);
  assert.equal(readFileSync(path.join(f.root, stagedDestination)).equals(webm), true);
  assert.equal(readFileSync(path.join(f.root, rawSource)).equals(webm), false);
  assert.equal(existsSync(path.join(f.root, paths.capture_journal_path)), false);
  assert.equal(existsSync(path.join(f.root, rawDirectoryFor(paths), "raw-output-inventory.json")), false);
});

test("actual wrapper preserves partial raw and stage on a declared-copy failure and keeps the original failure", async (t) => {
  const f = fixture(t),
    paths = {};
  let originalFailure, rawSource, stagedDestination;
  await assert.rejects(
    captureAndPublishExperience({
      ...f,
      retainRaw: retainSynthetic,
      onPaths: async (value) => Object.assign(paths, value),
      replay: async (options) => {
        rawSource = `${rawDirectoryFor(paths)}/generic/primary.webm`;
        stagedDestination = `${options.plan.outputDirectory}/generic/primary.webm`;
        write(f.root, rawSource, webm);
        await copyDeclaredCaptureFile({
          root: f.root,
          rawDirectory: rawDirectoryFor(paths),
          source: rawSource,
          destination: stagedDestination,
          kind: "recording",
          binding: rawCaptureBinding(f.plan),
        });
        try {
          await copyDeclaredCaptureFile({
            root: f.root,
            rawDirectory: rawDirectoryFor(paths),
            source: `${rawDirectoryFor(paths)}/generic/missing.webm`,
            destination: `${options.plan.outputDirectory}/generic/missing.webm`,
            kind: "recording",
            binding: rawCaptureBinding(f.plan),
          });
        } catch (error) {
          originalFailure = error;
          throw error;
        }
        assert.fail("missing source must reject");
      },
    }),
    (error) => error === originalFailure && error.code === "ENOENT",
  );
  assert.deepEqual(snapshot(f.root), f.before);
  assert.equal(readFileSync(path.join(f.root, rawSource)).equals(webm), true);
  assert.equal(readFileSync(path.join(f.root, stagedDestination)).equals(webm), true);
  const sealed = readJson(f.root, `${rawDirectoryFor(paths)}/raw-output-inventory.json`);
  assert.equal(sealed.outcome, "FAIL");
  assert.equal(sealed.acceptance, false);
  assert.equal(sealed.declarations.length, 1);
});

test("secondary raw seal failure aggregates rather than obscures the original replay failure", async (t) => {
  const f = fixture(t),
    paths = {},
    original = new Error("SOURCE_ONLY_REPLAY_FAILURE");
  let rawSource, stagedDestination;
  await assert.rejects(
    captureAndPublishExperience({
      ...f,
      retainRaw: retainSynthetic,
      onPaths: async (value) => Object.assign(paths, value),
      replay: async (options) => {
        rawSource = `${rawDirectoryFor(paths)}/generic/primary.webm`;
        stagedDestination = `${options.plan.outputDirectory}/generic/primary.webm`;
        write(f.root, rawSource, webm);
        await copyDeclaredCaptureFile({
          root: f.root,
          rawDirectory: rawDirectoryFor(paths),
          source: rawSource,
          destination: stagedDestination,
          kind: "recording",
          binding: rawCaptureBinding(f.plan),
        });
        writeFileSync(path.join(f.root, stagedDestination), "modeled changed declared destination");
        throw original;
      },
    }),
    (error) => {
      assert(error instanceof AggregateError);
      assert.equal(error.cause, original);
      assert.equal(error.errors[0], original);
      assert.match(error.errors[1].message, /RAW_OUTPUT_DECLARATION_CHANGED/u);
      return true;
    },
  );
  assert.deepEqual(snapshot(f.root), f.before);
  assert.equal(readFileSync(path.join(f.root, rawSource)).equals(webm), true);
  assert.equal(readFileSync(path.join(f.root, stagedDestination), "utf8"), "modeled changed declared destination");
});

test("encrypted retention reconstructs every raw, auxiliary and declaration byte with synthetic key only", async (t) => {
  const f = await rawFixture(t),
    encryptedDirectory = `${path.posix.dirname(f.rawDirectory)}/encrypted`;
  await inventory(f, "PASS");
  const before = snapshot(f.root, f.rawDirectory);
  const result = await retainSynthetic({
    root: f.root,
    rawDirectory: f.rawDirectory,
    encryptedDirectory,
    binding: f.binding,
    outcome: "PASS",
  });
  assert.equal(result.retention, "COMPLETE");
  const { index } = reconstructRetention(f.root, encryptedDirectory, f.binding);
  assert.equal(index.outcome, "PASS");
  assert.deepEqual(index.files.map((file) => file.path).sort(), Object.keys(before).sort());
  for (const file of index.files) assert.equal(file.permissions, before[file.path].mode);
  for (const file of [...f.auxiliaryFiles, f.rawOnly]) assert(index.files.some((entry) => entry.path === file));
  const clear = Buffer.concat(
    Object.keys(snapshot(f.root, encryptedDirectory)).map((file) => readFileSync(path.join(f.root, file))),
  );
  assert.equal(clear.includes(Buffer.from("modeled raw-only diagnostic, never evidence")), false);
  assert.equal(clear.includes(Buffer.from(path.posix.basename(f.auxiliaryFiles[0]))), false);
  assert.deepEqual(snapshot(f.root, f.rawDirectory), before);
  assert.deepEqual(snapshot(f.root), f.before);
  const verified = await verifiedRawCapturePaths(result);
  assert.deepEqual(
    verified.sort(),
    [
      ...result.encryptedFiles.map((file) => `${encryptedDirectory}/${file.name}`),
      `${encryptedDirectory}/retention.json`,
    ].sort(),
  );
  await assert.rejects(
    retainInterruptedRawCapture({ root: f.root, encryptedDirectory, plan: f.plan }),
    /EXISTING_RETENTION_UNTRUSTED/u,
  );
  await assert.rejects(
    retainSynthetic({
      root: f.root,
      rawDirectory: f.rawDirectory,
      encryptedDirectory,
      binding: f.binding,
      outcome: "PASS",
    }),
    /EEXIST/u,
  );
});

test("raw file over one 16MiB segment reconstructs exactly without increasing envelope limits", async (t) => {
  const f = fixture(t),
    rawDirectory = `${staging}/capture-segments/raw`,
    encryptedDirectory = `${staging}/capture-segments/encrypted`;
  await createRawOutputDirectory({ root: f.root, directory: rawDirectory });
  const file = `${rawDirectory}/SOURCE_ONLY_PRIVATE_AUXILIARY.bin`;
  write(f.root, file, Buffer.alloc(16 * 1024 * 1024 + 19, 0x61));
  write(f.root, `${rawDirectory}/empty.bin`, Buffer.alloc(0));
  const binding = rawCaptureBinding(f.plan);
  await retainSynthetic({ root: f.root, rawDirectory, encryptedDirectory, binding, outcome: "FAIL" });
  const { index } = reconstructRetention(f.root, encryptedDirectory, binding);
  assert.equal(index.outcome, "FAIL");
  assert.deepEqual(
    index.files.find((entry) => entry.path === file).chunks.map((chunk) => chunk.bytes),
    [16 * 1024 * 1024, 19],
  );
  assert.deepEqual(
    index.files.find((entry) => entry.path.endsWith("/empty.bin")).chunks.map((chunk) => chunk.bytes),
    [0],
  );
  assert.deepEqual(snapshot(f.root), f.before);
});

test("partial encrypted retention blocks publication, preserves ciphertext/raw/stage and refuses reuse", async (t) => {
  const f = fixture(t),
    paths = {},
    failure = new Error("SOURCE_ONLY_ENCRYPTION_FAILURE");
  let calls = 0,
    beforeRaw,
    beforeStage;
  await assert.rejects(
    captureAndPublishExperience({
      ...f,
      onPaths: async (value) => Object.assign(paths, value),
      retainRaw: (options) =>
        retainRawCaptureOutput({
          ...options,
          encryption,
          seal: (input) => {
            calls += 1;
            if (calls === 2) throw failure;
            return sealPosttechnicalEvidence(input);
          },
        }),
      replay: async (options) => {
        const replay = await completedCapture(options);
        write(f.root, `${rawDirectoryFor(paths)}/a-source-only-auxiliary.webm`, webm);
        write(f.root, `${rawDirectoryFor(paths)}/b-source-only-auxiliary.webm`, webm);
        beforeRaw = snapshot(f.root, rawDirectoryFor(paths));
        beforeStage = snapshot(f.root, options.plan.outputDirectory);
        return replay;
      },
    }),
    (error) => error instanceof AggregateError && error.cause === failure && error.errors[0] === failure,
  );
  assert.equal(calls, 2);
  assert.equal(paths.capture_raw_retention_status, "INCOMPLETE");
  assert.equal(Object.hasOwn(paths, "capture_raw_path"), false);
  assert.deepEqual(snapshot(f.root), f.before);
  retained(beforeRaw, f.root, rawDirectoryFor(paths));
  retained(beforeStage, f.root, paths.capture_stage_path);
  assert.equal(existsSync(path.join(f.root, paths.capture_journal_path)), false);
  const encryptedDirectory = paths.capture_raw_encrypted_path,
    partial = readJson(f.root, `${encryptedDirectory}/retention-failure.json`);
  assert.equal(partial.retention, "INCOMPLETE");
  assert.equal(partial.acceptance, false);
  assert.equal(partial.encryptedFiles.length, 1);
  assert.equal(existsSync(path.join(f.root, encryptedDirectory, "retention.json")), false);
  const first = partial.encryptedFiles[0],
    bytes = readFileSync(path.join(f.root, encryptedDirectory, first.name));
  assert.equal(hash(bytes), first.sha256);
  const decoded = decryptEnvelope(bytes),
    metadata = JSON.parse(
      Buffer.from(decoded.payload.files.find((file) => file.name === "metadata.json").content, "base64"),
    );
  assert.equal(metadata.file.path, `${rawDirectoryFor(paths)}/a-source-only-auxiliary.webm`);
  assert.deepEqual(
    Buffer.from(decoded.payload.files.find((file) => file.name === "chunk.bin").content, "base64"),
    webm,
  );
  const preserved = snapshot(f.root, encryptedDirectory);
  await assert.rejects(
    retainSynthetic({
      root: f.root,
      rawDirectory: rawDirectoryFor(paths),
      encryptedDirectory,
      binding: rawCaptureBinding(f.plan),
      outcome: "FAIL",
    }),
    /EEXIST/u,
  );
  await assert.rejects(
    retainInterruptedRawCapture({ root: f.root, encryptedDirectory, plan: f.plan }),
    /EXISTING_RETENTION_UNTRUSTED/u,
  );
  assert.deepEqual(snapshot(f.root, encryptedDirectory), preserved);
});

test("R1 only a fresh in-process completion can authorize the exact encrypted upload members", async (t) => {
  const f = await tinyRawFixture(t),
    completion = await retainSynthetic(f);
  const expected = [
    ...completion.encryptedFiles.map((file) => `${f.encryptedDirectory}/${file.name}`),
    `${f.encryptedDirectory}/retention.json`,
  ].sort();
  assert.deepEqual((await verifiedRawCapturePaths(completion)).sort(), expected);
  for (const forged of [
    {},
    { ...completion },
    structuredClone(completion),
    readJson(f.root, `${f.encryptedDirectory}/retention.json`),
  ])
    await assert.rejects(verifiedRawCapturePaths(forged), /TRUSTED_COMPLETION_REQUIRED/u);
  assert.deepEqual(snapshot(f.root, f.rawDirectory), f.beforeRaw);
  assert.deepEqual(snapshot(f.root), f.before);
});

test("R1 forged COMPLETE receipt with correctly hashed plaintext .encrypted files is never recovered or uploaded", async (t) => {
  const f = await tinyRawFixture(t);
  mkdirSync(path.join(f.root, f.encryptedDirectory));
  const bytes = Buffer.from("SOURCE_ONLY_PLAINTEXT_AUXILIARY_CONTENT\n"),
    name = "part-000001.encrypted";
  write(f.root, `${f.encryptedDirectory}/${name}`, bytes);
  const forged = {
    version: 1,
    qualification: false,
    acceptance: false,
    binding: f.binding,
    producer: { runId: process.env.GITHUB_RUN_ID ?? null, runAttempt: process.env.GITHUB_RUN_ATTEMPT ?? null },
    invocation: "capture-recovery",
    retention: "COMPLETE",
    encryptedFiles: [{ name, bytes: bytes.length, sha256: hash(bytes) }],
  };
  write(f.root, `${f.encryptedDirectory}/retention.json`, JSON.stringify(forged));
  const before = snapshot(f.root, f.encryptedDirectory);
  await assert.rejects(
    retainInterruptedRawCapture({ root: f.root, encryptedDirectory: f.encryptedDirectory, plan: f.plan }),
    /EXISTING_RETENTION_UNTRUSTED/u,
  );
  await assert.rejects(verifiedRawCapturePaths(forged), /TRUSTED_COMPLETION_REQUIRED/u);
  assert.deepEqual(snapshot(f.root, f.encryptedDirectory), before);
  assert.deepEqual(snapshot(f.root, f.rawDirectory), f.beforeRaw);
  assert.deepEqual(snapshot(f.root), f.before);
});

test("R1 interrupted recovery freshly encrypts a current raw directory and returns a minted completion", async (t) => {
  const f = await tinyRawFixture(t);
  const completion = await retainInterruptedRawCapture({
    root: f.root,
    encryptedDirectory: f.encryptedDirectory,
    plan: f.plan,
    encryption,
  });
  const paths = await verifiedRawCapturePaths(completion);
  assert(paths.includes(`${f.encryptedDirectory}/index.encrypted`));
  assert(paths.includes(`${f.encryptedDirectory}/retention.json`));
  assert.equal(paths.length, 3);
  const { index } = reconstructRetention(f.root, f.encryptedDirectory, f.binding);
  assert.equal(index.outcome, "FAIL");
  assert.deepEqual(snapshot(f.root, f.rawDirectory), f.beforeRaw);
  assert.deepEqual(snapshot(f.root), f.before);
});

const invalidSeals = [
  ["plaintext encrypted output", () => Buffer.from("SOURCE_ONLY_PLAINTEXT_NOT_AN_ENVELOPE")],
  [
    "outer format",
    (input) =>
      changedEnvelope(input, (envelope) => {
        envelope.format = "FORGED_ENVELOPE";
      }),
  ],
  [
    "unknown outer member",
    (input) =>
      changedEnvelope(input, (envelope) => {
        envelope.unlisted = "SOURCE_ONLY";
      }),
  ],
  [
    "truncated tag",
    (input) =>
      changedEnvelope(input, (envelope) => {
        envelope.tag = "AA==";
      }),
  ],
  [
    "invalid nonce",
    (input) =>
      changedEnvelope(input, (_envelope, header) => {
        header.nonce = "AA==";
      }),
  ],
  [
    "invalid wrapped key",
    (input) =>
      changedEnvelope(input, (_envelope, header) => {
        header.wrappedKey = "AA==";
      }),
  ],
  [
    "algorithm",
    (input) =>
      changedEnvelope(input, (_envelope, header) => {
        header.algorithms.content = "PLAINTEXT";
      }),
  ],
  [
    "header format",
    (input) =>
      changedEnvelope(input, (_envelope, header) => {
        header.format = "FORGED_FORMAT";
      }),
  ],
  [
    "AAD key",
    (input) =>
      changedAad(input, (aad) => {
        aad.keyId = "0".repeat(64);
      }),
  ],
  [
    "AAD source",
    (input) =>
      changedAad(input, (aad) => {
        aad.binding.sourceDigest = "0".repeat(64);
      }),
  ],
  [
    "AAD contract",
    (input) =>
      changedAad(input, (aad) => {
        aad.binding.contractDigest = "0".repeat(64);
      }),
  ],
  [
    "AAD record",
    (input) =>
      changedAad(input, (aad) => {
        aad.binding.recordDigest = "0".repeat(64);
      }),
  ],
  [
    "AAD candidate",
    (input) =>
      changedAad(input, (aad) => {
        aad.binding.candidateSha = "0".repeat(40);
      }),
  ],
  [
    "AAD run",
    (input) =>
      changedAad(input, (aad) => {
        aad.producer.runId = "999999999";
      }),
  ],
  [
    "AAD attempt",
    (input) =>
      changedAad(input, (aad) => {
        aad.producer.runAttempt = "999";
      }),
  ],
  [
    "AAD invocation",
    (input) =>
      changedAad(input, (aad) => {
        aad.invocation = "capture-other";
      }),
  ],
  [
    "AAD part",
    (input) =>
      changedAad(input, (aad) => {
        aad.part = "part-999999.encrypted";
      }),
  ],
  [
    "AAD qualification",
    (input) =>
      changedAad(input, (aad) => {
        aad.qualification = true;
      }),
  ],
];
for (const [name, seal] of invalidSeals) {
  test(`R1 rejects ${name} before minting completion or exposing upload paths`, async (t) => {
    const f = await tinyRawFixture(t);
    await assert.rejects(retainRawCaptureOutput({ ...f, encryption, seal }), /PRODUCT_EXPERIENCE_RAW_RETENTION_/u);
    assert.equal(existsSync(path.join(f.root, f.encryptedDirectory, "retention.json")), false);
    const failure = readJson(f.root, `${f.encryptedDirectory}/retention-failure.json`);
    assert.equal(failure.retention, "INCOMPLETE");
    assert.equal(failure.encryptedFiles.length, 0);
    await assert.rejects(verifiedRawCapturePaths(failure), /TRUSTED_COMPLETION_REQUIRED/u);
    assert.deepEqual(snapshot(f.root, f.rawDirectory), f.beforeRaw);
    assert.deepEqual(snapshot(f.root), f.before);
  });
}

for (const mutation of ["missing index", "unlisted member", "rehashed altered envelope", "changed raw source"]) {
  test(`R1 invalidates a minted upload handle after ${mutation}`, async (t) => {
    const f = await tinyRawFixture(t),
      completion = await retainSynthetic(f);
    if (mutation === "missing index") rmSync(path.join(f.root, f.encryptedDirectory, "index.encrypted"));
    if (mutation === "unlisted member")
      write(f.root, `${f.encryptedDirectory}/unlisted.encrypted`, "SOURCE_ONLY_UNLISTED_MEMBER");
    if (mutation === "changed raw source")
      writeFileSync(path.join(f.root, f.rawDirectory, "SOURCE_ONLY_PRIVATE_AUXILIARY.webm"), "SOURCE_ONLY_CHANGED_RAW");
    if (mutation === "rehashed altered envelope") {
      const file = completion.encryptedFiles.find((entry) => entry.name.startsWith("part-")),
        target = path.join(f.root, f.encryptedDirectory, file.name);
      const forged = Buffer.from("SOURCE_ONLY_REPLACED_PLAINTEXT");
      writeFileSync(target, forged);
      const receipt = readJson(f.root, `${f.encryptedDirectory}/retention.json`),
        row = receipt.encryptedFiles.find((entry) => entry.name === file.name);
      row.bytes = forged.length;
      row.sha256 = hash(forged);
      writeFileSync(path.join(f.root, f.encryptedDirectory, "retention.json"), JSON.stringify(receipt));
      // Even mutating the caller-visible object cannot alter its private immutable pins.
      file.bytes = forged.length;
      file.sha256 = hash(forged);
    }
    await assert.rejects(verifiedRawCapturePaths(completion), /PRODUCT_EXPERIENCE_RAW_RETENTION_/u);
    const before = snapshot(f.root, f.encryptedDirectory);
    await assert.rejects(
      retainInterruptedRawCapture({ root: f.root, encryptedDirectory: f.encryptedDirectory, plan: f.plan }),
      /EXISTING_RETENTION_UNTRUSTED/u,
    );
    assert.deepEqual(snapshot(f.root, f.encryptedDirectory), before);
    assert.deepEqual(snapshot(f.root), f.before);
  });
}

test("workflow retains only minted exact encrypted member paths and gates trusted cancellation recovery", () => {
  const workflow = readFileSync(new URL("../../.github/workflows/sounding-line-ordinary.yml", import.meta.url), "utf8");
  const upload = workflow.split("\n      - ").find((step) => step.includes("name: product-experience-raw-"));
  assert(upload);
  assert(
    upload.includes(
      "(steps.experience.outputs.capture_raw_verified_paths != '' || (steps.capture-raw-retention.outcome == 'success' && steps.capture-raw-retention.outputs.capture_raw_verified_paths != ''))",
    ),
  );
  assert(
    upload.includes(
      "path: ${{ steps.experience.outputs.capture_raw_verified_paths || steps.capture-raw-retention.outputs.capture_raw_verified_paths }}",
    ),
  );
  assert.equal(upload.includes("path: ${{ steps.experience.outputs.capture_raw_encrypted_path }}"), false);
  assert.equal(upload.includes("capture_raw_path"), false);
  assert.equal(upload.includes("capture_stage_path"), false);
  assert.equal(upload.includes("**"), false);
  assert.equal(workflow.includes("steps.experience.outputs.capture_raw_path"), false);
  const recovery = workflow
    .split("\n      - ")
    .find((step) => step.includes("name: Retain current raw capture after failure or cancellation"));
  assert(recovery);
  assert.match(recovery, /steps\.experience\.outcome != 'success'/u);
  assert(recovery.includes("id: capture-raw-retention"));
  assert(recovery.includes("steps.experience.outputs.capture_raw_verified_paths == ''"));
  assert(recovery.includes("node authority/scripts/sounding-line/experience-raw-retention.mjs"));
  assert(recovery.includes('--encrypted "$CAPTURE_ENCRYPTED"'));
});

for (const suffix of ["85a8727549ca43929d0d17d8bc188581.webm", "unregistered.json"]) {
  test(`closed staging rejects ${suffix} while retaining raw diagnostics and all previous canonical bytes`, async (t) => {
    const f = await rawFixture(t);
    write(f.root, `${f.workingDirectory}/generic/${suffix}`, suffix.endsWith(".json") ? "{}\n" : webm);
    await assert.rejects(
      publishExperienceCapture(f),
      /CAPTURE_PUBLICATION_(?:UNREFERENCED_OUTPUT|JSON_CLOSURE_CHANGED)/u,
    );
    assert.deepEqual(snapshot(f.root), f.before);
    retained(f.beforeRaw, f.root, f.rawDirectory);
    assert.equal(existsSync(path.join(f.root, f.workingDirectory, "generic", suffix)), true);
    const sealed = await inventory(f, "FAIL");
    assert.equal(sealed.outcome, "FAIL");
    assert.equal(sealed.acceptance, false);
  });
}

for (const type of ["recording", "trace"]) {
  test(`missing declared ${type} is not excused by retained auxiliary recordings`, async (t) => {
    const f = await rawFixture(t),
      required = f.replay.captured.artifacts.find((artifact) => artifact.type === type);
    rmSync(path.join(f.root, required.path));
    await assert.rejects(publishExperienceCapture(f), /CAPTURE_PUBLICATION_|ENOENT/u);
    assert.deepEqual(snapshot(f.root), f.before);
    retained(f.beforeRaw, f.root, f.rawDirectory);
    for (const auxiliary of f.auxiliaryFiles) assert.equal(existsSync(path.join(f.root, auxiliary)), true);
  });
}

test("raw directory and declared destination ownership are create-only and do not cross invocation boundaries", async (t) => {
  const f = await rawFixture(t),
    declared = f.declarations[0];
  await assert.rejects(createRawOutputDirectory({ root: f.root, directory: f.rawDirectory }), /EEXIST|RAW_/u);
  const source = `${f.rawDirectory}/generic/recordings/extra-primary.webm`;
  write(f.root, source, webm);
  const destination = f.replay.captured.artifacts.find((artifact) => artifact.type === "recording").path;
  await assert.rejects(
    copyDeclaredCaptureFile({
      root: f.root,
      rawDirectory: f.rawDirectory,
      source: declared.source,
      destination,
      kind: "recording",
      binding: f.binding,
    }),
    /EEXIST/u,
  );
  await assert.rejects(
    copyDeclaredCaptureFile({
      root: f.root,
      rawDirectory: f.rawDirectory,
      source,
      destination: `${canonical}/escaped.webm`,
      kind: "recording",
      binding: f.binding,
    }),
    /RAW_/u,
  );
  await assert.rejects(
    copyDeclaredCaptureFile({
      root: f.root,
      rawDirectory: f.rawDirectory,
      source: declared.source,
      destination: `${staging}/capture-different-invocation/capture/${path.posix.basename(declared.source)}`,
      kind: "recording",
      binding: f.binding,
    }),
    /RAW_OUTPUT_COPY_PATH_INVALID/u,
  );
  const symlink = `${f.rawDirectory}/generic/recordings/linked.webm`;
  symlinkSync(path.join(f.root, source), path.join(f.root, symlink));
  await assert.rejects(
    copyDeclaredCaptureFile({
      root: f.root,
      rawDirectory: f.rawDirectory,
      source: symlink,
      destination: `${f.workingDirectory}/linked.webm`,
      kind: "recording",
      binding: f.binding,
    }),
    /RAW_/u,
  );
  assert.equal(declared.sha256, hash(webm));
  assert.equal(readFileSync(path.join(f.root, source)).equals(webm), true);
  assert.deepEqual(snapshot(f.root), f.before);
  retained(f.beforeRaw, f.root, f.rawDirectory);
});

for (const afterRename of [false, true]) {
  test(`modeled promotion failure ${afterRename ? "after" : "before"} rename restores preimages and preserves raw, auxiliary and failed staging`, async (t) => {
    const f = await rawFixture(t),
      failure = new Error("SOURCE_ONLY_MODELED_PROMOTION_FAILURE");
    let calls = 0;
    await assert.rejects(
      publishExperienceCapture({
        ...f,
        promote: async (from, to) => {
          calls += 1;
          if (calls === 4 && !afterRename) throw failure;
          await rename(from, to);
          if (calls === 4 && afterRename) throw failure;
        },
      }),
      (error) => error === failure,
    );
    assert.equal(calls, 4);
    assert.deepEqual(snapshot(f.root), f.before);
    retained(f.beforeRaw, f.root, f.rawDirectory);
    retained(f.beforeStage, f.root, f.workingDirectory);
    const journal = readJson(f.root, `${f.journalDirectory}/journal.json`);
    assert.equal(journal.status, "FAILED");
    assert.equal(journal.attempted.length, 4);
    assert.equal(
      journal.rollback.some((entry) => entry.status === "FAILED"),
      false,
    );
    for (const entry of journal.files) {
      const bytes = readFileSync(path.join(f.root, f.journalDirectory, "preimages", entry.path));
      assert.equal(bytes.toString("base64"), f.before[entry.path].bytes);
    }
    const sealed = await inventory(f, "FAIL");
    assert.equal(sealed.outcome, "FAIL");
    assert.equal(sealed.acceptance, false);
    retained(f.beforeRaw, f.root, f.rawDirectory);
  });
}
