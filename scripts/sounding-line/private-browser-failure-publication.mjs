// Privacy boundary only. Publishing a diagnostic never supplies acceptance.
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
import { PRIVATE_BROWSER_FAILURE_CONTEXT, createBrowserFailureRetention } from "./private-browser-failure.mjs";

const keyId = "f82684218e386d09e9120d0c7b54722e5833e5c18a3d7a8a73d94b9afead48bc";
const maximum = 128 * 1024 * 1024;
const format = "VW-POSTTECHNICAL-EVIDENCE-1";
const classification = "PRIVATE_FAILURE_DIAGNOSTICS_NOT_ACCEPTANCE";
const authority = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u;
const sha = /^[a-f0-9]{64}$/u;
const mintedPublications = new WeakMap();
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const need = (value, code) => {
  if (!value) throw Error(`PRIVATE_BROWSER_PUBLICATION_${code}`);
};
const exactKeys = (value, keys) =>
  value &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  Object.keys(value).length === keys.length &&
  keys.every((key) => Object.hasOwn(value, key));
const codes = new Set([
  "WORKER_CLOSURE_UNPROVEN",
  "MISSING",
  "PATH_INVALID",
  "LIMIT",
  "STALE",
  "CHANGED",
  "MANIFEST_INVALID",
  "NO_FAILURE_ATTACHMENTS",
  "FAILURE_ATTACHMENTS_INCOMPLETE",
  "MISSING_SCREENSHOT",
  "MISSING_VIDEO",
  "MISSING_TRACE",
  "MISSING_ERROR_CONTEXT",
  "ENCRYPTION_FAILED",
  "PERSISTENCE_FAILED",
  "IO_FAILED",
  "CONTEXT_INVALID",
  "DEVELOPMENT_EVIDENCE_INVALID",
  "DEVELOPMENT_REPORT_UNAVAILABLE",
  "DEVELOPMENT_STREAM_INCOMPLETE",
]);
function directory(file) {
  const stat = lstatSync(file);
  need(
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
  const target = path.join(parent, name);
  try {
    mkdirSync(target, { mode: 0o700 });
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  }
  directory(target);
  return target;
}
function contextValid(context) {
  const b = context?.binding;
  return (
    exactKeys(context, ["version", "binding", "sessionId", "startedAt", "directory"]) &&
    context.version === 1 &&
    uuid.test(context.sessionId) &&
    Number.isSafeInteger(context.startedAt) &&
    context.startedAt > 0 &&
    typeof context.directory === "string" &&
    path.isAbsolute(context.directory) &&
    path.normalize(context.directory) === context.directory &&
    path.basename(context.directory) === context.sessionId &&
    exactKeys(b, ["version", "runId", "scopeId", "baseSha", "candidateSha", "planDigest"]) &&
    b.version === 1 &&
    uuid.test(b.runId) &&
    uuid.test(b.scopeId) &&
    /^[a-f0-9]{40}$/u.test(b.baseSha) &&
    /^[a-f0-9]{40}$/u.test(b.candidateSha) &&
    sha.test(b.planDigest)
  );
}
function regularBytes(file, startedAt) {
  directory(path.dirname(file));
  const initial = lstatSync(file);
  need(
    initial.isFile() &&
      !initial.isSymbolicLink() &&
      initial.uid === process.getuid() &&
      initial.nlink === 1 &&
      initial.size > 0 &&
      initial.size <= maximum,
    "SOURCE_INVALID",
  );
  need(
    initial.mtimeMs >= startedAt - 1 &&
      initial.ctimeMs >= startedAt - 1 &&
      (!initial.birthtimeMs || initial.birthtimeMs >= startedAt - 1),
    "SOURCE_STALE",
  );
  let fd;
  try {
    fd = openSync(file, F.O_RDONLY | F.O_NOFOLLOW | F.O_NONBLOCK);
    const opened = fstatSync(fd);
    need(
      opened.isFile() &&
        opened.uid === process.getuid() &&
        opened.nlink === 1 &&
        ["dev", "ino", "size", "mtimeMs", "ctimeMs"].every((key) => opened[key] === initial[key]),
      "SOURCE_CHANGED",
    );
    const bytes = Buffer.alloc(opened.size);
    let offset = 0;
    while (offset < bytes.length) {
      const count = readSync(fd, bytes, offset, bytes.length - offset, offset);
      need(count > 0, "SOURCE_CHANGED");
      offset += count;
    }
    const after = fstatSync(fd),
      named = lstatSync(file);
    need(
      !named.isSymbolicLink() &&
        named.isFile() &&
        ["dev", "ino", "size", "mtimeMs", "ctimeMs", "nlink"].every(
          (key) => after[key] === opened[key] && named[key] === opened[key],
        ),
      "SOURCE_CHANGED",
    );
    return bytes;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}
function base64(value, limit) {
  need(typeof value === "string" && value.length <= Math.ceil(limit / 3) * 4, "ENVELOPE_INVALID");
  const bytes = Buffer.from(value, "base64");
  need(bytes.length <= limit && bytes.toString("base64") === value, "ENVELOPE_INVALID");
  return bytes;
}
// Pure validation may be called with untrusted data; it cannot publish anything.
export function validateBrowserFailurePublication({ bytes, context, retention }) {
  need(contextValid(context), "CONTEXT_INVALID");
  need(Buffer.isBuffer(bytes) && bytes.length > 0 && bytes.length <= maximum, "ENVELOPE_INVALID");
  need(
    retention?.version === 1 &&
      retention.classification === classification &&
      retention.qualification === false &&
      ["COMPLETE", "INCOMPLETE"].includes(retention.retention) &&
      retention.format === format &&
      retention.keyId === keyId &&
      sha.test(retention.ciphertextDigest) &&
      retention.ciphertextBytes === bytes.length &&
      digest(bytes) === retention.ciphertextDigest,
    "RECEIPT_MISMATCH",
  );
  need(
    Number.isSafeInteger(retention.memberCount) &&
      retention.memberCount >= 1 &&
      retention.memberCount <= 129 &&
      Number.isSafeInteger(retention.rawBytes) &&
      retention.rawBytes > 0 &&
      retention.rawBytes <= 64 * 1024 * 1024,
    "RECEIPT_INVALID",
  );
  const exit = retention.worker?.exitCode,
    signal = retention.worker?.signal;
  need(
    (exit === null || Number.isInteger(exit)) &&
      (signal === null || /^SIG[A-Z0-9]{1,12}$/u.test(signal)) &&
      (exit !== 0 || signal !== null) &&
      retention.cleanup === "RAW_RETAINED_PRIVATE" &&
      Array.isArray(retention.issues) &&
      retention.issues.length <= 128,
    "RECEIPT_INVALID",
  );
  const envelope = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  need(
    exactKeys(envelope, ["format", "aad", "ciphertext", "tag"]) &&
      envelope.format === format &&
      Buffer.from(JSON.stringify(envelope)).equals(bytes),
    "ENVELOPE_INVALID",
  );
  const aad = base64(envelope.aad, 8192),
    header = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(aad));
  const expected = { ...context.binding, purpose: classification, sessionId: context.sessionId, keyId };
  need(
    exactKeys(header, [...Object.keys(expected), "format", "algorithms", "plaintextBytes", "nonce", "wrappedKey"]) &&
      Buffer.from(JSON.stringify(header)).equals(aad) &&
      Object.entries(expected).every(([key, value]) => header[key] === value) &&
      header.format === format &&
      JSON.stringify(header.algorithms) === '{"content":"AES-256-GCM","keyWrap":"RSA-OAEP-SHA256"}',
    "HEADER_INVALID",
  );
  need(
    Number.isSafeInteger(header.plaintextBytes) &&
      header.plaintextBytes > 0 &&
      header.plaintextBytes <= maximum &&
      base64(envelope.ciphertext, maximum).length === header.plaintextBytes &&
      base64(envelope.tag, 16).length === 16 &&
      base64(header.nonce, 12).length === 12 &&
      base64(header.wrappedKey, 384).length === 384,
    "ENVELOPE_INVALID",
  );
  return {
    version: 1,
    classification,
    qualification: false,
    retention: retention.retention,
    format,
    keyId,
    ciphertextDigest: retention.ciphertextDigest,
    ciphertextBytes: bytes.length,
    memberCount: retention.memberCount,
    rawBytes: retention.rawBytes,
    worker: { exitCode: exit, signal },
    issues: [...new Set(retention.issues.map((code) => (codes.has(code) ? code : "UNCLASSIFIED_COLLECTION_ISSUE")))],
    cleanup: "RAW_RETAINED_PRIVATE",
    diagnosticBinding: { ...context.binding, sessionId: context.sessionId },
  };
}
function privateWrite(file, bytes) {
  let fd;
  try {
    fd = openSync(file, F.O_WRONLY | F.O_CREAT | F.O_EXCL | F.O_NOFOLLOW, 0o600);
    let offset = 0;
    while (offset < bytes.length) {
      const count = writeSync(fd, bytes, offset, bytes.length - offset);
      need(count > 0, "STAGING_FAILED");
      offset += count;
    }
    fsyncSync(fd);
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}
function publicationCode(error) {
  const code = /^PRIVATE_BROWSER_PUBLICATION_([A-Z_]+)$/u.exec(error?.message ?? "")?.[1];
  return code ?? "IO_OR_FORMAT_FAILED";
}
function publishCaptured(collector, context, retention, authorityRoot) {
  if (retention.retention === "NOT_REQUIRED") return { status: "NOT_REQUIRED", qualification: false };
  if (retention.retention === "ENCRYPTION_FAILED" || !retention.ciphertextDigest)
    return { status: "NOT_PUBLISHED", code: "NO_COLLECTOR_ENCRYPTED_EVIDENCE", qualification: false };
  try {
    need(contextValid(context) && collector.directory === context.directory, "CONTEXT_INVALID");
    const bytes = regularBytes(path.join(collector.directory, "failure.encrypted"), context.startedAt);
    const metadata = validateBrowserFailurePublication({ bytes, context, retention });
    need(
      typeof authorityRoot === "string" &&
        path.isAbsolute(authorityRoot) &&
        path.normalize(authorityRoot) === authorityRoot,
      "DIRECTORY_INVALID",
    );
    let parent = authorityRoot;
    directory(parent);
    for (const name of ["artifacts", "sounding-line"]) parent = ensure(parent, name);
    const published = ensure(parent, "private-browser-failure-publication");
    // Pending files are outside the workflow upload allowlist. A complete pair
    // enters the publication directory only after validation and durable writes.
    const pendingRoot = ensure(parent, "private-browser-failure-publication-pending"),
      id = randomUUID(),
      pending = path.join(pendingRoot, id),
      target = path.join(published, id);
    mkdirSync(pending, { mode: 0o700 });
    directory(pending);
    privateWrite(path.join(pending, "failure.encrypted"), bytes);
    privateWrite(path.join(pending, "retention.json"), Buffer.from(JSON.stringify(metadata) + "\n"));
    need(
      digest(regularBytes(path.join(pending, "failure.encrypted"), context.startedAt)) === metadata.ciphertextDigest,
      "STAGING_FAILED",
    );
    try {
      lstatSync(target);
      need(false, "STAGING_ALREADY_EXISTS");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    renameSync(pending, target);
    directory(target);
    const publication = {
      status: "STAGED",
      publicationId: id,
      diagnosticRetention: retention.retention,
      files: 2,
      // Trusted callers must upload only this minted pair, never directory globs.
      uploadPaths: [path.join(target, "failure.encrypted"), path.join(target, "retention.json")],
      qualification: false,
    };
    mintedPublications.set(publication, { paths: [...publication.uploadPaths], at: performance.now() });
    return publication;
  } catch (error) {
    return { status: "NOT_PUBLISHED", code: publicationCode(error), qualification: false };
  }
}
// An identity check only: JSON, clones and disk receipts cannot mint upload paths.
export function browserFailurePublicationUploadPaths(publication, notBefore = 0) {
  const minted = mintedPublications.get(publication);
  need(minted && minted.at >= notBefore, "UNTRUSTED_PUBLICATION");
  return [...minted.paths];
}
// This closure is the sole publication entry point. Never deserialize a
// candidate retention.json as a collector result or expose stage(JSON).
export function createPublishableBrowserFailureRetention({
  root,
  binding,
  authorityRoot = authority,
  onPublication,
  developmentOnlyEvidence = false,
}) {
  need(onPublication === undefined || typeof onPublication === "function", "CALLBACK_INVALID");
  const collector = createBrowserFailureRetention({ root, binding: { ...binding }, developmentOnlyEvidence });
  const context = JSON.parse(collector.environment[PRIVATE_BROWSER_FAILURE_CONTEXT]);
  let completed;
  return Object.freeze({
    directory: collector.directory,
    resultsDirectory: collector.resultsDirectory,
    reporter: collector.reporter,
    environment: Object.freeze({ ...collector.environment }),
    complete(outcome) {
      if (completed)
        return {
          ...completed,
          publication: { status: "NOT_REPUBLISHED", code: "SESSION_ALREADY_COMPLETED", qualification: false },
        };
      const retention = collector.complete({
        exitCode: outcome.exitCode,
        signal: outcome.signal ?? null,
        workerClosed: outcome.workerClosed,
        ...(developmentOnlyEvidence ? { developmentEvidence: outcome.developmentEvidence } : {}),
      });
      const publication = publishCaptured(collector, context, retention, authorityRoot);
      if (publication.status === "STAGED" && onPublication) {
        try {
          onPublication(publication);
          publication.output = { status: "CAPTURED_NOT_UPLOADED", qualification: false };
        } catch {
          publication.output = { status: "CAPTURE_FAILED", qualification: false };
        }
      }
      completed = { ...retention, publication };
      return completed;
    },
  });
}
