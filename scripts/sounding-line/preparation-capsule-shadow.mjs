import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { canonicalJson } from "./evidence.mjs";
import {
  measurePreparationContentShadow,
  inspectPreparationContentShadow,
  comparePreparationContentShadow,
} from "./preparation-content-shadow.mjs";

export const PREPARATION_CAPSULE_LIMITS = Object.freeze({
  bytes: 128 * 1024 * 1024,
  entries: 8192,
  chunkBytes: 64 * 1024,
  manifestBytes: 2 * 1024 * 1024,
  deadlineMs: 60000,
});
const capsules = new WeakMap();
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const need = (condition, code) => {
  if (!condition) throw Error(`SOUNDING_LINE_PREPARATION_CAPSULE_${code}`);
};
const signature = (stat) =>
  [stat.dev, stat.ino, stat.mode, stat.nlink, stat.size, stat.mtimeNs, stat.ctimeNs].map(String).join(":");
function directoryIdentity(directory) {
  need(typeof directory === "string" && path.isAbsolute(directory), "DIRECTORY");
  const root = path.resolve(directory);
  need(path.resolve(fs.realpathSync(root)) === root, "DIRECTORY_ALIAS");
  for (let current = root; ; current = path.dirname(current)) {
    const stat = fs.lstatSync(current);
    need(stat.isDirectory() && !stat.isSymbolicLink(), "DIRECTORY_ALIAS");
    if (path.dirname(current) === current) break;
  }
  const stat = fs.lstatSync(root);
  return { root, dev: stat.dev, ino: stat.ino };
}
function sameDirectory(identity) {
  const current = directoryIdentity(identity.root);
  need(current.dev === identity.dev && current.ino === identity.ino, "DIRECTORY_DRIFT");
}
function sameFile(fd, filename) {
  const actual = fs.fstatSync(fd, { bigint: true }),
    named = fs.lstatSync(filename, { bigint: true });
  need(
    actual.isFile() &&
      named.isFile() &&
      !named.isSymbolicLink() &&
      actual.nlink === 1n &&
      named.nlink === 1n &&
      signature(actual) === signature(named),
    "FILE_DRIFT",
  );
  return actual;
}
function closeFiles(fds, original) {
  const errors = original ? [original] : [];
  for (const fd of fds)
    if (fd !== undefined)
      try {
        fs.closeSync(fd);
      } catch (error) {
        errors.push(error);
      }
  if (errors.length > 1)
    throw new AggregateError(errors, "PREPARATION_CAPSULE_ORIGINAL_AND_CLEANUP_FAILURES", { cause: errors[0] });
  if (errors.length) throw errors[0];
}

// A private, bounded producer pilot for one permitted layer. All output bytes
// come from measured descriptors. No declaration or handle is a provider proof,
// data-classification certificate or authorization to replace preparation.
export function createPreparationCapsuleShadow({ source, directory, layer }) {
  need(layer === "prisma-client", "UNSUPPORTED_LAYER");
  const parent = directoryIdentity(directory),
    sourceIdentity = directoryIdentity(source);
  need(
    !sourceIdentity.root.startsWith(`${parent.root}${path.sep}`) &&
      !parent.root.startsWith(`${sourceIdentity.root}${path.sep}`) &&
      parent.root !== sourceIdentity.root,
    "OVERLAPPING_ROOTS",
  );
  const began = performance.now(),
    deadline = () => need(performance.now() - began < PREPARATION_CAPSULE_LIMITS.deadlineMs, "DEADLINE");
  const original = measurePreparationContentShadow({ root: sourceIdentity.root, layer });
  const inventory = inspectPreparationContentShadow(original).entries;
  need(
    original.byteLength <= PREPARATION_CAPSULE_LIMITS.bytes && inventory.length <= PREPARATION_CAPSULE_LIMITS.entries,
    "BOUND",
  );
  deadline();
  sameDirectory(parent);
  const root = path.join(parent.root, `preparation-capsule-${randomUUID()}`);
  fs.mkdirSync(root, { mode: 0o700 });
  const payload = path.join(root, "payload"),
    initial = path.join(root, "initial.json"),
    manifestPath = path.join(root, "manifest.json");
  const initialBytes = Buffer.from(
    JSON.stringify({
      kind: "PREPARATION_CAPSULE_SHADOW",
      status: "INCOMPLETE",
      layer,
      original,
      qualification: false,
      reuseAuthorized: false,
    }) + "\n",
  );
  let identity, initialReference, failure, manifestReference;
  try {
    identity = directoryIdentity(root);
    fs.writeFileSync(initial, initialBytes, { flag: "wx", mode: 0o600 });
    initialReference = {
      signature: signature(fs.lstatSync(initial, { bigint: true })),
      bytes: initialBytes.length,
      sha256: hash(initialBytes),
    };
    fs.mkdirSync(payload);
    const buffer = Buffer.alloc(PREPARATION_CAPSULE_LIMITS.chunkBytes);
    for (const entry of inventory) {
      deadline();
      sameDirectory(identity);
      sameDirectory(sourceIdentity);
      const target = entry.path === "." ? payload : path.join(payload, ...entry.path.split("/"));
      if (entry.type === "directory") {
        if (entry.path !== ".") fs.mkdirSync(target);
        continue;
      }
      const origin = path.join(sourceIdentity.root, ...entry.path.split("/"));
      need(path.resolve(fs.realpathSync(origin)) === origin, "SOURCE_ALIAS");
      let input, output, originalError;
      try {
        input = fs.openSync(origin, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
        const before = sameFile(input, origin);
        need(Number(before.size) === entry.bytes && Number(before.mode & 0o777n) === entry.mode, "SOURCE_DRIFT");
        output = fs.openSync(
          target,
          fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | (fs.constants.O_NOFOLLOW || 0),
          0o600,
        );
        const digest = createHash("sha256");
        let position = 0;
        while (position < entry.bytes) {
          deadline();
          const count = fs.readSync(input, buffer, 0, Math.min(buffer.length, entry.bytes - position), position);
          need(count > 0, "SOURCE_TRUNCATED");
          let written = 0;
          while (written < count) {
            const copied = fs.writeSync(output, buffer, written, count - written);
            need(copied > 0, "WRITE");
            written += copied;
          }
          digest.update(buffer.subarray(0, count));
          position += count;
        }
        need(
          digest.digest("hex") === entry.sha256 && signature(sameFile(input, origin)) === signature(before),
          "SOURCE_DRIFT",
        );
        fs.fchmodSync(output, entry.mode);
        fs.fsyncSync(output);
        need(Number(sameFile(output, target).size) === entry.bytes, "DESTINATION_DRIFT");
      } catch (error) {
        originalError = error;
      }
      closeFiles([output, input], originalError);
    }
    // Restore original directory modes after construction, including empty dirs.
    for (const entry of [...inventory].reverse())
      if (entry.type === "directory")
        fs.chmodSync(entry.path === "." ? payload : path.join(payload, ...entry.path.split("/")), entry.mode);
    deadline();
    sameDirectory(identity);
    sameDirectory(sourceIdentity);
    const restored = measurePreparationContentShadow({ root: payload, layer });
    const comparison = comparePreparationContentShadow({ source: original, destination: restored });
    need(comparison.contentEquivalent, "SOURCE_DESTINATION_MISMATCH");
    const manifest = {
      kind: "PREPARATION_CAPSULE_SHADOW",
      version: 1,
      status: "COMPLETE_SHADOW",
      layer,
      original,
      restored,
      inventory,
      comparison,
      certificate: "NOT_ISSUED",
      qualification: false,
      reuseAuthorized: false,
    };
    const bytes = Buffer.from(canonicalJson(manifest) + "\n");
    need(bytes.length <= PREPARATION_CAPSULE_LIMITS.manifestBytes, "MANIFEST_BOUND");
    fs.writeFileSync(manifestPath, bytes, { flag: "wx", mode: 0o600 });
    const stat = fs.lstatSync(manifestPath, { bigint: true });
    manifestReference = { signature: signature(stat), bytes: bytes.length, sha256: hash(bytes) };
    const result = Object.freeze({
      status: "PASS",
      root,
      payload,
      manifestPath,
      bytes: original.byteLength,
      files: original.fileCount,
      inventoryDigest: original.inventoryDigest,
      manifestSha256: manifestReference.sha256,
      qualification: false,
      reuseAuthorized: false,
      certificate: "NOT_ISSUED",
    });
    capsules.set(result, {
      identity,
      initial,
      initialReference,
      manifestPath,
      manifestReference,
      inventoryDigest: original.inventoryDigest,
      layer,
      payload,
    });
    verifyPreparationCapsuleShadow(result);
    return result;
  } catch (error) {
    failure = error;
  }
  let failureRetained = false,
    retentionError;
  try {
    sameDirectory(parent);
    sameDirectory(identity ?? directoryIdentity(root));
    const description = (error) => {
      const message = Object.getOwnPropertyDescriptor(error, "message");
      return typeof message?.value === "string" && message.value.length <= 16384 ? message.value : null;
    };
    const nested = Object.getOwnPropertyDescriptor(failure, "errors")?.value;
    const errors = Array.isArray(nested) && nested.length <= 3 ? nested : [failure];
    fs.writeFileSync(
      path.join(root, "failure.json"),
      JSON.stringify({
        kind: "PREPARATION_CAPSULE_SHADOW_FAILURE",
        representation: "BOUNDED_OWN_MESSAGES_NOT_COMPLETE_EXCEPTIONS",
        message: description(failure),
        observedFailureMessages: errors.map(description),
        original: { bytes: original.byteLength, inventoryDigest: original.inventoryDigest },
        qualification: false,
        reuseAuthorized: false,
      }) + "\n",
      { flag: "wx", mode: 0o600 },
    );
    failureRetained = true;
  } catch (error) {
    retentionError = error;
  }
  return Object.freeze(
    Object.defineProperties(
      {
        status: "FAIL",
        root,
        payload,
        initial,
        initialReceiptCustody: initialReference ? "PINNED" : "UNAVAILABLE",
        failureRetained,
        qualification: false,
        reuseAuthorized: false,
        certificate: "NOT_ISSUED",
      },
      { originalError: { value: failure }, retentionError: { value: retentionError } },
    ),
  );
}

export function verifyPreparationCapsuleShadow(result) {
  const value = capsules.get(result);
  if (!value) return null;
  const verifyReference = (filename, reference) => {
    let fd, failure;
    try {
      fd = fs.openSync(filename, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
      const before = sameFile(fd, filename);
      need(signature(before) === reference.signature && Number(before.size) === reference.bytes, "MANIFEST_DRIFT");
      const bytes = Buffer.alloc(reference.bytes);
      let position = 0;
      while (position < bytes.length) {
        const count = fs.readSync(fd, bytes, position, bytes.length - position, position);
        need(count > 0, "MANIFEST_TRUNCATED");
        position += count;
      }
      need(
        hash(bytes) === reference.sha256 && signature(sameFile(fd, filename)) === signature(before),
        "MANIFEST_DRIFT",
      );
    } catch (error) {
      failure = error;
    }
    closeFiles([fd], failure);
  };
  sameDirectory(value.identity);
  verifyReference(value.initial, value.initialReference);
  verifyReference(value.manifestPath, value.manifestReference);
  const measured = measurePreparationContentShadow({ root: value.payload, layer: value.layer });
  need(measured.inventoryDigest === value.inventoryDigest, "PAYLOAD_DRIFT");
  sameDirectory(value.identity);
  verifyReference(value.initial, value.initialReference);
  verifyReference(value.manifestPath, value.manifestReference);
  return Object.freeze({
    inventoryDigest: measured.inventoryDigest,
    byteLength: measured.byteLength,
    fileCount: measured.fileCount,
    manifestBytesVerified: true,
    qualification: false,
    reuseAuthorized: false,
    certificate: "NOT_ISSUED",
  });
}
