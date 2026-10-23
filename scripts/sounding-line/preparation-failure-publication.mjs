// Trusted-host PREPARE publication. This route cannot accept browser evidence,
// candidate JSON, caller-supplied ciphertext, or a caller-supplied wrapping key.
import { createHash, randomUUID } from "node:crypto";
import {
  constants as F,
  closeSync,
  fstatSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readSync,
  realpathSync,
  renameSync,
  writeSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { preparationFailureEvidenceFiles } from "./development-preparation-evidence.mjs";
import { BROWSER_FAILURE_ENCRYPTION_KEY } from "./private-browser-failure.mjs";
import { sealPosttechnicalEvidence } from "./replay-posttechnical-diagnostic.mjs";

const authority = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const minted = new WeakMap();
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const purpose = "PRIVATE_PREPARATION_FAILURE_DIAGNOSTICS_NOT_ACCEPTANCE";
const maximum = 64 * 1024 * 1024;
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u;
const need = (value, code) => {
  if (!value) throw Error(`PREPARATION_PUBLICATION_${code}`);
};
export function validatePreparationBinding(binding) {
  need(
    binding &&
      Object.keys(binding).sort().join(",") ===
        "candidateSha,controllerSha,provider,selectorDigest,sessionId,version" &&
      binding.version === 1 &&
      uuid.test(binding.sessionId) &&
      /^[a-f0-9]{40}$/u.test(binding.candidateSha) &&
      /^[a-f0-9]{40}$/u.test(binding.controllerSha) &&
      /^[a-f0-9]{64}$/u.test(binding.selectorDigest),
    "CONTEXT_INVALID",
  );
  const provider = binding.provider;
  need(
    provider === null ||
      (provider &&
        Object.keys(provider).sort().join(",") === "attempt,repository,runId,workflowSha" &&
        provider.repository === "Kgray44/treasurehuntSoT" &&
        /^[1-9][0-9]{0,19}$/u.test(provider.runId) &&
        Number.isSafeInteger(provider.attempt) &&
        provider.attempt > 0 &&
        provider.attempt <= 999999 &&
        provider.workflowSha === binding.controllerSha),
    "CONTEXT_INVALID",
  );
}
function directory(file) {
  need(typeof process.getuid === "function", "OWNER_ID_UNAVAILABLE");
  const stat = lstatSync(file);
  need(
    path.isAbsolute(file) &&
      path.normalize(file) === file &&
      !/[\r\n\0*?\[\]{}!]/u.test(file) &&
      stat.isDirectory() &&
      !stat.isSymbolicLink() &&
      stat.uid === process.getuid() &&
      (stat.mode & 0o022) === 0 &&
      realpathSync(file) === file,
    "DIRECTORY_INVALID",
  );
}
function ensure(parent, name) {
  directory(parent);
  const file = path.join(parent, name);
  try {
    mkdirSync(file, { mode: 0o700 });
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  }
  directory(file);
  return file;
}
function write(file, bytes) {
  need(bytes.length > 0 && bytes.length <= maximum, "LIMIT");
  let fd;
  try {
    fd = openSync(file, F.O_WRONLY | F.O_CREAT | F.O_EXCL | F.O_NOFOLLOW, 0o600);
    let offset = 0;
    while (offset < bytes.length) {
      const count = writeSync(fd, bytes, offset, bytes.length - offset);
      need(count > 0, "WRITE_FAILED");
      offset += count;
    }
    fsyncSync(fd);
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}
function verify(file, bytes, startedAt, identity) {
  directory(path.dirname(file));
  const named = lstatSync(file);
  need(
    named.isFile() &&
      !named.isSymbolicLink() &&
      named.nlink === 1 &&
      named.uid === process.getuid() &&
      named.size === bytes.length &&
      named.size <= maximum &&
      realpathSync(file) === file &&
      named.mtimeMs >= startedAt - 1 &&
      named.ctimeMs >= startedAt - 1 &&
      (!named.birthtimeMs || named.birthtimeMs >= startedAt - 1),
    "FILE_INVALID",
  );
  if (identity)
    need(
      ["dev", "ino", "size", "mtimeMs", "ctimeMs", "nlink", "uid"].every((key) => identity[key] === named[key]),
      "FILE_REPLACED",
    );
  let fd;
  try {
    fd = openSync(file, F.O_RDONLY | F.O_NOFOLLOW | F.O_NONBLOCK);
    const opened = fstatSync(fd),
      keys = ["dev", "ino", "size", "mtimeMs", "ctimeMs", "nlink", "uid"];
    need(opened.isFile() && keys.every((key) => opened[key] === named[key]), "FILE_CHANGED");
    const value = Buffer.alloc(opened.size);
    let offset = 0;
    while (offset < value.length) {
      const count = readSync(fd, value, offset, value.length - offset, offset);
      need(count > 0, "FILE_CHANGED");
      offset += count;
    }
    const after = fstatSync(fd),
      current = lstatSync(file);
    need(
      !current.isSymbolicLink() &&
        keys.every((key) => after[key] === opened[key] && current[key] === opened[key]) &&
        hash(value) === hash(bytes),
      "FILE_CHANGED",
    );
    return current;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}
// Pure encryption seam for generated-key roundtrips. It never mints paths.
export function sealPreparationFailureEvidence(token, binding, publicKey) {
  validatePreparationBinding(binding);
  const captured = preparationFailureEvidenceFiles(token, binding);
  need(captured.failed, "FAILURE_REQUIRED");
  const bytes = sealPosttechnicalEvidence({
    files: captured.files,
    aad: { ...binding, purpose, keyId: hash(publicKey) },
    publicKey,
    limits: {
      files: 17,
      rawBytes: 33 * 1024 * 1024,
      fileBytes: 16 * 1024 * 1024,
      jsonBytes: 1024 * 1024,
      envelopeBytes: maximum,
    },
  });
  return {
    bytes,
    issues: captured.issues,
    memberCount: captured.files.length,
    rawBytes: captured.files.reduce((total, file) => total + file.bytes.length, 0),
  };
}
export function preparationPublicationUploadPaths(publication, binding, notBefore = 0) {
  const value = minted.get(publication);
  need(value && value.at >= notBefore && JSON.stringify(value.binding) === JSON.stringify(binding), "UNTRUSTED_TOKEN");
  // Revalidate immutable staged bytes when the host actually selects the paths.
  for (const item of value.files) verify(item.path, item.bytes, value.startedAt, item.identity);
  return value.files.map((item) => item.path);
}
export function createPreparationFailurePublisher({ binding, authorityRoot = authority, onPublication }) {
  validatePreparationBinding(binding);
  const context = JSON.parse(JSON.stringify(binding)),
    startedAt = Date.now();
  let completed = false;
  return Object.freeze({
    complete(token) {
      if (completed) return { status: "NOT_REPUBLISHED", qualification: false };
      completed = true;
      let captured;
      try {
        captured = preparationFailureEvidenceFiles(token, context);
      } catch {
        return { status: "NOT_PUBLISHED", code: "COLLECTION_INVALID", qualification: false };
      }
      if (!captured.failed) return { status: "NOT_REQUIRED", qualification: false };
      let sealed;
      try {
        need(hash(BROWSER_FAILURE_ENCRYPTION_KEY.publicKey) === BROWSER_FAILURE_ENCRYPTION_KEY.keyId, "KEY_INVALID");
        sealed = sealPreparationFailureEvidence(token, context, BROWSER_FAILURE_ENCRYPTION_KEY.publicKey);
      } catch {
        return { status: "NOT_PUBLISHED", code: "ENCRYPTION_FAILED", qualification: false };
      }
      try {
        let parent = authorityRoot;
        directory(parent);
        for (const name of ["artifacts", "sounding-line"]) parent = ensure(parent, name);
        const published = ensure(parent, "private-preparation-failure-publication"),
          pendingRoot = ensure(parent, "private-preparation-failure-publication-pending"),
          id = randomUUID(),
          pending = path.join(pendingRoot, id),
          target = path.join(published, id);
        mkdirSync(pending, { mode: 0o700 });
        directory(pending);
        const metadata = {
          version: 1,
          role: "DEVELOPMENT_ONLY",
          qualification: false,
          classification: purpose,
          retention: sealed.issues.length ? "INCOMPLETE" : "COMPLETE",
          collectionIssues: sealed.issues,
          encryption: "COMPLETE",
          publication: "STAGED_NOT_UPLOADED",
          keyId: BROWSER_FAILURE_ENCRYPTION_KEY.keyId,
          ciphertextDigest: hash(sealed.bytes),
          ciphertextBytes: sealed.bytes.length,
          memberCount: sealed.memberCount,
          rawBytes: sealed.rawBytes,
          binding: context,
        };
        const files = [
          { name: "preparation.encrypted", bytes: sealed.bytes },
          { name: "retention.json", bytes: Buffer.from(JSON.stringify(metadata) + "\n") },
        ];
        for (const file of files) {
          write(path.join(pending, file.name), file.bytes);
          verify(path.join(pending, file.name), file.bytes, startedAt);
        }
        try {
          lstatSync(target);
          need(false, "TARGET_EXISTS");
        } catch (error) {
          if (error.code !== "ENOENT") throw error;
        }
        renameSync(pending, target);
        directory(target);
        const publication = Object.freeze({ status: "STAGED", qualification: false, retention: metadata.retention });
        minted.set(publication, {
          binding: context,
          at: performance.now(),
          startedAt,
          files: files.map((file) => ({
            path: path.join(target, file.name),
            bytes: file.bytes,
            identity: verify(path.join(target, file.name), file.bytes, startedAt),
          })),
        });
        if (onPublication) onPublication(publication);
        return publication;
      } catch {
        return { status: "NOT_PUBLISHED", code: "PERSISTENCE_OR_OUTPUT_FAILED", qualification: false };
      }
    },
  });
}
