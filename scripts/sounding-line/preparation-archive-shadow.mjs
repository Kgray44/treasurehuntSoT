// Physical, private restore of one fully hashed capsule ZIP. Declared archive
// identities are not provider authentication, isolation or execution authority.
import fs from "node:fs";
import path from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { readPreparationArchiveMemberShadow } from "./attestation-archive-shadow.mjs";
import {
  measurePreparationContentShadow,
  inspectPreparationContentShadow,
  restorePreparationObservationModesShadow,
} from "./preparation-content-shadow.mjs";
import { eligiblePreparationInventoryShadow, preparationPublisherContext } from "./preparation-publisher-shadow.mjs";
import { canonicalJson, digest } from "./evidence.mjs";
const completed = new WeakMap(),
  hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const need = (condition, code) => {
  if (!condition) throw Error(`SOUNDING_LINE_PREPARATION_RESTORE_${code}`);
};
const signature = (stat) =>
  [stat.dev, stat.ino, stat.mode, stat.nlink, stat.size, stat.mtimeNs, stat.ctimeNs].map(String).join(":");
function directoryIdentity(directory) {
  need(typeof directory === "string" && path.isAbsolute(directory), "DIRECTORY");
  const resolved = path.resolve(directory);
  need(path.resolve(fs.realpathSync.native(resolved)) === resolved, "DIRECTORY_ALIAS");
  for (let current = resolved; ; current = path.dirname(current)) {
    const stat = fs.lstatSync(current, { bigint: true });
    need(stat.isDirectory() && !stat.isSymbolicLink(), "DIRECTORY_ALIAS");
    if (current === path.dirname(current)) break;
  }
  const stat = fs.lstatSync(resolved, { bigint: true });
  return { directory: resolved, dev: stat.dev, ino: stat.ino };
}
function sameDirectory(value) {
  const current = directoryIdentity(value.directory);
  need(current.dev === value.dev && current.ino === value.ino, "DIRECTORY_DRIFT");
}
function readPinned(filename, expected) {
  let fd, failure, bytes;
  try {
    fd = fs.openSync(filename, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0) | (fs.constants.O_NONBLOCK || 0));
    const before = fs.fstatSync(fd, { bigint: true });
    need(
      before.isFile() &&
        before.nlink === 1n &&
        signature(before) === expected.signature &&
        signature(fs.lstatSync(filename, { bigint: true })) === expected.signature,
      "RECEIPT_DRIFT",
    );
    bytes = Buffer.alloc(expected.bytes);
    let offset = 0;
    while (offset < bytes.length) {
      const count = fs.readSync(fd, bytes, offset, bytes.length - offset, offset);
      need(count > 0, "RECEIPT_TRUNCATED");
      offset += count;
    }
    need(
      signature(fs.fstatSync(fd, { bigint: true })) === expected.signature &&
        signature(fs.lstatSync(filename, { bigint: true })) === expected.signature &&
        hash(bytes) === expected.sha256,
      "RECEIPT_DRIFT",
    );
  } catch (error) {
    failure = error;
  }
  if (fd !== undefined)
    try {
      fs.closeSync(fd);
    } catch (error) {
      if (failure)
        throw new AggregateError([failure, error], "PREPARATION_RESTORE_READ_AND_CLOSE_FAILED", { cause: failure });
      throw error;
    }
  if (failure) throw failure;
  return bytes;
}
function writeExclusive(filename, bytes) {
  need(Buffer.isBuffer(bytes) && bytes.length <= 32 * 1024 ** 2, "FILE_BOUND");
  let fd, failure;
  try {
    fd = fs.openSync(
      filename,
      fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | (fs.constants.O_NOFOLLOW || 0),
      0o600,
    );
    let offset = 0;
    while (offset < bytes.length) {
      const count = fs.writeSync(fd, bytes, offset, Math.min(65536, bytes.length - offset));
      need(count > 0, "SHORT_WRITE");
      offset += count;
    }
    fs.fsyncSync(fd);
    const actual = fs.fstatSync(fd, { bigint: true }),
      named = fs.lstatSync(filename, { bigint: true });
    need(
      actual.isFile() &&
        actual.nlink === 1n &&
        signature(actual) === signature(named) &&
        actual.size === BigInt(bytes.length),
      "FILE_DRIFT",
    );
  } catch (error) {
    failure = error;
  }
  if (fd !== undefined)
    try {
      fs.closeSync(fd);
    } catch (error) {
      if (failure)
        throw new AggregateError([failure, error], "PREPARATION_RESTORE_WRITE_AND_CLOSE_FAILED", { cause: failure });
      throw error;
    }
  if (failure) throw failure;
  return { signature: signature(fs.lstatSync(filename, { bigint: true })), bytes: bytes.length, sha256: hash(bytes) };
}
export function restorePreparationArchiveShadow({
  filename,
  expectedBytes,
  expectedSha256,
  manifestSha256,
  inventoryDigest,
  directory,
}) {
  const parent = directoryIdentity(directory),
    root = path.join(parent.directory, `preparation-restore-${randomUUID()}`);
  const references = new Map();
  let identity, originalError, retentionError, result;
  const began = performance.now();
  fs.mkdirSync(root, { mode: 0o700 });
  try {
    identity = directoryIdentity(root);
    references.set(
      "restore.initial.json",
      writeExclusive(
        path.join(root, "restore.initial.json"),
        Buffer.from(
          canonicalJson({
            kind: "PREPARATION_ARCHIVE_RESTORE_SHADOW",
            status: "INCOMPLETE",
            expectedBytes,
            expectedSha256,
            manifestSha256,
            inventoryDigest,
            qualification: false,
            reuseAuthorized: false,
          }) + "\n",
        ),
      ),
    );
    const read = (name) => {
      need(performance.now() - began < 60000, "DEADLINE");
      sameDirectory(parent);
      sameDirectory(identity);
      return readPreparationArchiveMemberShadow({
        filename,
        expectedBytes,
        expectedSha256,
        memberNames: [name],
        deadlineMs: Math.max(1, Math.floor(60000 - (performance.now() - began))),
      });
    };
    const manifestResult = read("manifest.json"),
      manifestBytes = manifestResult.bytes;
    need(manifestBytes.length <= 2 * 1024 ** 2 && hash(manifestBytes) === manifestSha256, "MANIFEST_BYTES");
    const manifest = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(manifestBytes));
    need(
      manifest.kind === "PREPARATION_CAPSULE_SHADOW" &&
        manifest.version === 1 &&
        manifest.status === "COMPLETE_SHADOW" &&
        manifest.layer === "prisma-client" &&
        manifest.qualification === false &&
        manifest.reuseAuthorized === false &&
        manifest.certificate === "NOT_ISSUED",
      "MANIFEST",
    );
    eligiblePreparationInventoryShadow(manifest.inventory);
    need(
      digest(manifest.inventory) === inventoryDigest &&
        manifest.original?.inventoryDigest === inventoryDigest &&
        manifest.comparison?.contentEquivalent === true &&
        manifest.comparison.sourceUnchanged === true &&
        manifest.comparison.destinationUnchanged === true &&
        manifest.comparison.action === "RUN_FRESH_PREPARATION" &&
        manifest.comparison.certificate === "NOT_ISSUED" &&
        manifest.comparison.qualification === false &&
        manifest.comparison.reuseAuthorized === false,
      "ORIGINAL_COMPARISON",
    );
    const files = manifest.inventory.filter((entry) => entry.type === "file"),
      allowed = new Map([
        ["initial.json", "file"],
        ["manifest.json", "file"],
        ["publisher.json", "file"],
        ["payload", "directory"],
        ...files.map((entry) => [`payload/${entry.path}`, "file"]),
      ]);
    need(
      files.length > 0 &&
        files.every(
          (entry) =>
            Number.isSafeInteger(entry.bytes) &&
            entry.bytes >= 0 &&
            entry.bytes <= 32 * 1024 ** 2 &&
            /^[a-f0-9]{64}$/u.test(entry.sha256),
        ) &&
        files.reduce((sum, entry) => sum + entry.bytes, 0) <= 128 * 1024 ** 2 &&
        manifest.inventory.length === files.length + 1,
      "PAYLOAD_BOUND",
    );
    need(
      manifestResult.members.every((entry) => allowed.get(entry.path) === entry.type) &&
        manifestResult.members.filter((entry) => entry.type === "file").length === files.length + 3,
      "COMPLETE_ARCHIVE_MEMBERSHIP",
    );
    const initialBytes = read("initial.json").bytes,
      publisherBytes = read("publisher.json").bytes;
    need(initialBytes.length <= 65536 && publisherBytes.length <= 2 * 1024 ** 2, "METADATA_BOUND");
    const initial = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(initialBytes)),
      publisher = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(publisherBytes));
    preparationPublisherContext(publisher.context);
    need(
      initial.kind === "PREPARATION_CAPSULE_SHADOW" &&
        initial.status === "INCOMPLETE" &&
        initial.layer === "prisma-client" &&
        initial.qualification === false &&
        initial.reuseAuthorized === false &&
        initial.original?.observationDigest === manifest.original.observationDigest,
      "INITIAL",
    );
    need(
      publisher.kind === "PREPARATION_SOURCE_CAPSULE_SHADOW" &&
        publisher.version === 1 &&
        publisher.qualification === false &&
        publisher.reuseAuthorized === false &&
        publisher.certificate === "NOT_ISSUED" &&
        publisher.context.jobKey === "publisher" &&
        publisher.capsule?.manifestSha256 === manifestSha256 &&
        publisher.capsule.initialSha256 === hash(initialBytes) &&
        publisher.capsule.inventoryDigest === inventoryDigest &&
        publisher.capsule.fileCount === files.length &&
        publisher.capsule.byteLength === files.reduce((sum, entry) => sum + entry.bytes, 0) &&
        /^[a-f0-9]{64}$/u.test(publisher.identity?.inputFingerprint),
      "PUBLISHER",
    );
    for (const [name, bytes] of [
      ["manifest.json", manifestBytes],
      ["initial.json", initialBytes],
      ["publisher.json", publisherBytes],
    ])
      references.set(name, writeExclusive(path.join(root, name), bytes));
    const payload = path.join(root, "payload");
    fs.mkdirSync(payload, { mode: 0o700 });
    for (const entry of files) {
      const member = read(`payload/${entry.path}`);
      need(member.bytes.length === entry.bytes && hash(member.bytes) === entry.sha256, "PAYLOAD_BYTES");
      writeExclusive(path.join(payload, entry.path), member.bytes);
    }
    const transported = measurePreparationContentShadow({ root: payload, layer: "prisma-client" });
    const restored = restorePreparationObservationModesShadow(transported, manifest.inventory);
    need(restored.inventoryDigest === inventoryDigest, "PAYLOAD_INVENTORY");
    for (const [name, reference] of references) readPinned(path.join(root, name), reference);
    sameDirectory(parent);
    sameDirectory(identity);
    result = Object.freeze({
      kind: "PREPARATION_ARCHIVE_RESTORE_SHADOW",
      status: "PASS",
      root,
      inventoryDigest,
      manifestSha256,
      inputFingerprint: publisher.identity.inputFingerprint,
      byteLength: restored.byteLength,
      fileCount: restored.fileCount,
      elapsedMs: performance.now() - began,
      certificate: "NOT_ISSUED",
      authentication: "DECLARED_BYTES_NOT_PROVIDER_AUTHENTICATED",
      qualification: false,
      reuseAuthorized: false,
    });
    references.set(
      "restore.terminal.json",
      writeExclusive(path.join(root, "restore.terminal.json"), Buffer.from(canonicalJson(result) + "\n")),
    );
    completed.set(result, {
      parent,
      identity,
      references,
      inventoryDigest,
      payload,
      publisherContext: preparationPublisherContext(publisher.context),
    });
    return result;
  } catch (error) {
    originalError = error;
    try {
      sameDirectory(parent);
      if (identity) sameDirectory(identity);
      else identity = directoryIdentity(root);
      writeExclusive(
        path.join(root, "restore.failure.json"),
        Buffer.from(
          canonicalJson({
            kind: "PREPARATION_ARCHIVE_RESTORE_SHADOW",
            status: "FAIL",
            originalErrorDescription:
              "Original exception retained in the in-memory result; this record is not its serialization",
            errorDescriptionIsCompleteOriginal: false,
            certificate: "NOT_ISSUED",
            qualification: false,
            reuseAuthorized: false,
          }) + "\n",
        ),
      );
    } catch (error) {
      retentionError = error;
    }
  }
  return Object.freeze(
    Object.defineProperties(
      {
        kind: "PREPARATION_ARCHIVE_RESTORE_SHADOW",
        status: "FAIL",
        root,
        certificate: "NOT_ISSUED",
        qualification: false,
        reuseAuthorized: false,
      },
      { originalError: { value: originalError }, retentionError: { value: retentionError } },
    ),
  );
}
export function inspectPreparationArchiveRestoreShadow(handle) {
  const value = completed.get(handle);
  if (!value) return null;
  try {
    sameDirectory(value.parent);
    sameDirectory(value.identity);
    for (const [name, reference] of value.references) readPinned(path.join(value.identity.directory, name), reference);
    const measured = measurePreparationContentShadow({ root: value.payload, layer: "prisma-client" });
    need(measured.inventoryDigest === value.inventoryDigest, "PAYLOAD_DRIFT");
    return Object.freeze({
      ...handle,
      payload: value.payload,
      publisherContext: value.publisherContext,
      observation: measured,
      inventory: inspectPreparationContentShadow(measured).entries,
    });
  } catch {
    return null;
  }
}
