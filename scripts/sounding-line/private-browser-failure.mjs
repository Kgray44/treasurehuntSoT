// Diagnostic custody only: this module never produces passing evidence or acceptance.
import { createHash, randomUUID } from "node:crypto";
import {
  constants as F,
  closeSync,
  fstatSync,
  lstatSync,
  mkdirSync,
  openSync,
  readSync,
  realpathSync,
  readdirSync,
  rmdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sealPosttechnicalEvidence } from "./replay-posttechnical-diagnostic.mjs";

export const PRIVATE_BROWSER_FAILURE_CONTEXT = "SOUNDING_LINE_PRIVATE_BROWSER_FAILURE_CONTEXT";
export const BROWSER_FAILURE_LIMITS = Object.freeze({
  files: 128,
  rawBytes: 64 * 1024 * 1024,
  fileBytes: 32 * 1024 * 1024,
  manifestBytes: 1024 * 1024,
  depth: 8,
});
const publicKey =
  "-----BEGIN PUBLIC KEY-----\nMIIBojANBgkqhkiG9w0BAQEFAAOCAY8AMIIBigKCAYEAqhR0X1gnk0ll9753ViDR\nia9R8pIDEYZDydLXSaSg9lRNd6kYNdkyeb7Bqt8z/A/MAJP5ngCPUaH0xvq4n+OQ\nXkF0v9XqdD/xkaZX4Cv4xiLyJkTU2lOdMEKI96o9dsHN428BTZ7nbW7sZ5Uh19L7\n8wYIw/mm+A44+3T5Tp0SCcoUcT9HqTZgk3r1CGu33WvNjeqyid22nYVSsPipQga+\ncTpcDQve9MePaFCPsi/KrRrsK2yxkgUwFY20SWu26ZjklAlQ0+isLE06f3MmsH0s\nimq0PLjcRbDG99iCJ/TiwEpZQJNJQT3n1rN7HzSYef0WZFKKkb+vF/vwihOP1AoF\nOwlHPHj3tiy5TR7ZXoqRSYC43NFDRVHp2WP8mDdJT2TInGhrwCuW/l0bpds+p7wQ\nUC2OIfq1p/FivQtp0X+4UDs8YjpSnrhl8cgqz9ipzr72TrB95I60ygrHIAfqKh47\nHKu5BOb2GG1c5KLTH9oJiZ4hsf620/dZ1Y0JjJAYAmmjAgMBAAE=\n-----END PUBLIC KEY-----\n";
const keyId = "f82684218e386d09e9120d0c7b54722e5833e5c18a3d7a8a73d94b9afead48bc";
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const need = (value, code = "CONTEXT_INVALID") => {
  if (!value) throw Error(`SOUNDING_LINE_PRIVATE_BROWSER_FAILURE_${code}`);
};
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u;
const bindingKeys = ["version", "runId", "scopeId", "baseSha", "candidateSha", "planDigest"];
const failureStatuses = new Set(["failed", "timedOut", "interrupted"]);
const kinds = { screenshot: ".png", video: ".webm", trace: ".zip", "error-context": ".md" };
function bindingValid(value) {
  return (
    value &&
    Object.keys(value).length === bindingKeys.length &&
    value.version === 1 &&
    uuid.test(value.runId) &&
    uuid.test(value.scopeId) &&
    /^[a-f0-9]{40}$/u.test(value.baseSha) &&
    /^[a-f0-9]{40}$/u.test(value.candidateSha) &&
    /^[a-f0-9]{64}$/u.test(value.planDigest)
  );
}
function privateDirectory(directory) {
  const stat = lstatSync(directory);
  need(
    stat.isDirectory() &&
      !stat.isSymbolicLink() &&
      stat.uid === process.getuid() &&
      (stat.mode & 0o022) === 0 &&
      realpathSync(directory) === directory,
    "PATH_INVALID",
  );
}
function ownedDirectory(parent, name) {
  const directory = path.join(parent, name);
  try {
    mkdirSync(directory, { mode: 0o700 });
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  }
  privateDirectory(directory);
  return directory;
}
function childPath(root, relative) {
  need(
    typeof relative === "string" &&
      Buffer.byteLength(relative) <= 240 &&
      !relative.includes("\\") &&
      !path.isAbsolute(relative),
    "PATH_INVALID",
  );
  const parts = relative.split("/");
  need(
    parts.length <= BROWSER_FAILURE_LIMITS.depth &&
      parts.every((part) => part && part !== "." && part !== ".." && !part.includes("\0")),
    "PATH_INVALID",
  );
  let directory = root;
  privateDirectory(directory);
  for (const part of parts.slice(0, -1)) {
    directory = path.join(directory, part);
    privateDirectory(directory);
  }
  return path.join(directory, parts.at(-1));
}
function readOwned(file, maximum, startedAt) {
  let fd;
  try {
    const initial = lstatSync(file);
    need(
      initial.isFile() && !initial.isSymbolicLink() && initial.nlink === 1 && initial.uid === process.getuid(),
      "PATH_INVALID",
    );
    fd = openSync(file, F.O_RDONLY | F.O_NOFOLLOW | F.O_NONBLOCK);
    const before = fstatSync(fd),
      named = lstatSync(file);
    need(
      before.isFile() &&
        before.nlink === 1 &&
        before.uid === process.getuid() &&
        !named.isSymbolicLink() &&
        before.ino === named.ino &&
        before.dev === named.dev &&
        before.ino === initial.ino &&
        before.dev === initial.dev,
      "PATH_INVALID",
    );
    need(before.size > 0 && before.size <= maximum, "LIMIT");
    need(
      before.mtimeMs >= startedAt - 1 &&
        before.ctimeMs >= startedAt - 1 &&
        (!before.birthtimeMs || before.birthtimeMs >= startedAt - 1),
      "STALE",
    );
    const bytes = Buffer.alloc(before.size);
    let offset = 0;
    while (offset < bytes.length) {
      const count = readSync(fd, bytes, offset, bytes.length - offset, offset);
      need(count > 0, "CHANGED");
      offset += count;
    }
    const after = fstatSync(fd),
      finalNamed = lstatSync(file);
    need(
      ["size", "ino", "dev", "mtimeMs", "ctimeMs", "nlink"].every((key) => before[key] === after[key]) &&
        !finalNamed.isSymbolicLink() &&
        finalNamed.ino === before.ino &&
        finalNamed.dev === before.dev,
      "CHANGED",
    );
    return bytes;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}
function safeCode(error) {
  const code = /^SOUNDING_LINE_PRIVATE_BROWSER_FAILURE_([A-Z_]+)$/u.exec(error?.message ?? "")?.[1];
  return code ?? (error?.code === "ENOENT" ? "MISSING" : "IO_FAILED");
}
export function loadBrowserFailureContext(environment = process.env) {
  const context = JSON.parse(environment[PRIVATE_BROWSER_FAILURE_CONTEXT] ?? "null");
  need(
    context &&
      Object.keys(context).length === 5 &&
      context.version === 1 &&
      bindingValid(context.binding) &&
      uuid.test(context.sessionId) &&
      Number.isSafeInteger(context.startedAt) &&
      context.startedAt > 0 &&
      typeof context.directory === "string" &&
      path.isAbsolute(context.directory) &&
      path.normalize(context.directory) === context.directory,
  );
  need(path.basename(context.directory) === context.sessionId, "PATH_INVALID");
  privateDirectory(context.directory);
  const persisted = readOwned(path.join(context.directory, "context.private.json"), 8192, context.startedAt);
  need(persisted.equals(Buffer.from(JSON.stringify(context))), "CONTEXT_INVALID");
  return context;
}
export function writeBrowserFailureManifest(context, records, overflow = false, failures = []) {
  const bytes = Buffer.from(JSON.stringify({ version: 1, sessionId: context.sessionId, records, overflow, failures }));
  need(bytes.length <= BROWSER_FAILURE_LIMITS.manifestBytes, "LIMIT");
  writeFileSync(path.join(context.directory, "manifest.private.json"), bytes, { flag: "wx", mode: 0o600 });
}
export function createBrowserFailureRetention({ root, binding }) {
  need(bindingValid(binding) && hash(publicKey) === keyId);
  root = path.resolve(root);
  privateDirectory(root);
  let parent = root;
  for (const name of ["artifacts", "sounding-line", "private-browser-failures"]) parent = ownedDirectory(parent, name);
  const sessionId = randomUUID(),
    directory = path.join(parent, sessionId);
  mkdirSync(directory, { mode: 0o700 });
  // Use the fresh directory's filesystem clock; wall-clock rounding can precede
  // a just-created file by milliseconds on hosted/overlay filesystems.
  const startedAt = Math.floor(lstatSync(directory).ctimeMs);
  mkdirSync(path.join(directory, "results"), { mode: 0o700 });
  const context = { version: 1, binding, sessionId, startedAt, directory };
  writeFileSync(path.join(directory, "context.private.json"), JSON.stringify(context), { flag: "wx", mode: 0o600 });
  return {
    directory,
    resultsDirectory: path.join(directory, "results"),
    reporter: fileURLToPath(new URL("./private-browser-failure-reporter.mjs", import.meta.url)),
    environment: {
      [PRIVATE_BROWSER_FAILURE_CONTEXT]: JSON.stringify(context),
      PW_TEST_REPORTER: fileURLToPath(new URL("./private-browser-failure-reporter.mjs", import.meta.url)),
    },
    complete: (outcome) => completeBrowserFailureRetention({ context, ...outcome }),
  };
}
export function completeBrowserFailureRetention({ context, exitCode, signal = null, workerClosed }) {
  need(
    (exitCode === null || Number.isInteger(exitCode)) && (signal === null || /^SIG[A-Z0-9]{1,12}$/u.test(signal)),
    "OUTCOME_INVALID",
  );
  const result = {
    version: 1,
    classification: "PRIVATE_FAILURE_DIAGNOSTICS_NOT_ACCEPTANCE",
    qualification: false,
    worker: { exitCode, signal },
    retention: "INCOMPLETE",
    issues: [],
    cleanup: "RAW_RETAINED_PRIVATE",
  };
  if (exitCode === 0 && signal === null) {
    result.retention = "NOT_REQUIRED";
    return result;
  }
  if (!workerClosed) {
    result.issues.push("WORKER_CLOSURE_UNPROVEN");
    return result;
  }
  const files = [],
    inventory = [];
  let rawBytes = 0;
  try {
    loadBrowserFailureContext({ [PRIVATE_BROWSER_FAILURE_CONTEXT]: JSON.stringify(context) });
    const manifestBytes = readOwned(
      path.join(context.directory, "manifest.private.json"),
      BROWSER_FAILURE_LIMITS.manifestBytes,
      context.startedAt,
    );
    const manifest = JSON.parse(manifestBytes);
    need(
      manifest.version === 1 &&
        manifest.sessionId === context.sessionId &&
        Array.isArray(manifest.records) &&
        manifest.records.length <= BROWSER_FAILURE_LIMITS.files &&
        Array.isArray(manifest.failures) &&
        manifest.failures.length <= BROWSER_FAILURE_LIMITS.files &&
        typeof manifest.overflow === "boolean",
      "MANIFEST_INVALID",
    );
    if (manifest.overflow) result.issues.push("LIMIT");
    const failures = new Map();
    for (const failure of manifest.failures) {
      need(
        failure &&
          Object.keys(failure).length === 2 &&
          /^[a-f0-9]{64}$/u.test(failure.id) &&
          failureStatuses.has(failure.status) &&
          !failures.has(failure.id),
        "MANIFEST_INVALID",
      );
      failures.set(failure.id, failure.status);
    }
    const seen = new Set();
    for (const record of manifest.records) {
      try {
        need(
          record &&
            Object.keys(record).length === 4 &&
            failures.get(record.failureId) === record.status &&
            failureStatuses.has(record.status) &&
            Object.hasOwn(kinds, record.kind) &&
            record.path?.endsWith(kinds[record.kind]),
          "MANIFEST_INVALID",
        );
        need(!seen.has(record.path), "MANIFEST_INVALID");
        seen.add(record.path);
        const file = childPath(path.join(context.directory, "results"), record.path);
        const bytes = readOwned(file, BROWSER_FAILURE_LIMITS.fileBytes, context.startedAt);
        need(rawBytes + bytes.length + manifestBytes.length <= BROWSER_FAILURE_LIMITS.rawBytes, "LIMIT");
        rawBytes += bytes.length;
        files.push({ name: `private/results/${record.path}`, bytes });
        inventory.push({ ...record, bytes: bytes.length, sha256: hash(bytes) });
      } catch (error) {
        result.issues.push(safeCode(error));
      }
    }
    if (!files.length || !failures.size) result.issues.push("NO_FAILURE_ATTACHMENTS");
    for (const failureId of failures.keys())
      if (
        Object.keys(kinds).some(
          (kind) => !inventory.some((record) => record.failureId === failureId && record.kind === kind),
        )
      )
        result.issues.push("FAILURE_ATTACHMENTS_INCOMPLETE");
    for (const kind of Object.keys(kinds))
      if (!inventory.some((record) => record.kind === kind))
        result.issues.push(`MISSING_${kind.replaceAll("-", "_").toUpperCase()}`);
    files.unshift({
      name: "private/failure-manifest.json",
      bytes: Buffer.from(JSON.stringify({ ...manifest, inventory, issues: result.issues })),
    });
    const aad = { version: 1, purpose: result.classification, ...context.binding, sessionId: context.sessionId, keyId };
    let encrypted;
    try {
      encrypted = sealPosttechnicalEvidence({
        files,
        aad,
        publicKey,
        inventory,
        limits: {
          files: BROWSER_FAILURE_LIMITS.files + 1,
          rawBytes: BROWSER_FAILURE_LIMITS.rawBytes,
          fileBytes: BROWSER_FAILURE_LIMITS.fileBytes,
          jsonBytes: BROWSER_FAILURE_LIMITS.manifestBytes,
          depth: BROWSER_FAILURE_LIMITS.depth,
          nameBytes: 256,
          envelopeBytes: 128 * 1024 * 1024,
        },
      });
      writeFileSync(path.join(context.directory, "failure.encrypted"), encrypted, { flag: "wx", mode: 0o600 });
      need(
        hash(readOwned(path.join(context.directory, "failure.encrypted"), 128 * 1024 * 1024, context.startedAt)) ===
          hash(encrypted),
        "CHANGED",
      );
    } catch {
      result.retention = "ENCRYPTION_FAILED";
      result.issues.push("ENCRYPTION_FAILED");
      return result;
    }
    Object.assign(result, {
      retention: result.issues.length ? "INCOMPLETE" : "COMPLETE",
      format: "VW-POSTTECHNICAL-EVIDENCE-1",
      keyId,
      ciphertextDigest: hash(encrypted),
      ciphertextBytes: encrypted.length,
      memberCount: files.length,
      rawBytes: files.reduce((total, file) => total + file.bytes.length, 0),
    });
    const cleanupInventory = Buffer.from(
      JSON.stringify({
        version: 1,
        sessionId: context.sessionId,
        ciphertextDigest: result.ciphertextDigest,
        files: inventory.map(({ path, bytes, sha256 }) => ({ path, bytes, sha256 })),
      }),
    );
    result.cleanupInventoryDigest = hash(cleanupInventory);
    try {
      writeFileSync(path.join(context.directory, "cleanup.private.json"), cleanupInventory, {
        flag: "wx",
        mode: 0o600,
      });
      writeFileSync(path.join(context.directory, "retention.json"), JSON.stringify(result) + "\n", {
        flag: "wx",
        mode: 0o600,
      });
    } catch {
      result.retention = "INCOMPLETE";
      result.issues.push("PERSISTENCE_FAILED");
    }
  } catch (error) {
    result.retention = "INCOMPLETE";
    result.issues.push(safeCode(error));
  }
  result.issues = [...new Set(result.issues)];
  return result;
}
export function acknowledgeBrowserFailureUpload({ directory, trustedUpload }) {
  // Trusted workflow only: build this receipt from the actual upload-artifact@v4
  // step outcome and outputs, never candidate files/environment or a boolean.
  // This pure helper does not authenticate GitHub; the caller owns that boundary.
  if (
    !trustedUpload ||
    trustedUpload.outcome !== "success" ||
    !Number.isSafeInteger(trustedUpload.artifactId) ||
    trustedUpload.artifactId <= 0 ||
    !/^(?:sha256:)?[a-f0-9]{64}$/u.test(trustedUpload.artifactDigest ?? "") ||
    !/^[a-f0-9]{64}$/u.test(trustedUpload.ciphertextDigest ?? "")
  )
    return { upload: "FAILED_OR_UNCONFIRMED", cleanup: "RAW_RETAINED_PRIVATE" };
  const context = JSON.parse(readOwned(path.join(directory, "context.private.json"), 8192, 0));
  need(
    typeof directory === "string" &&
      path.isAbsolute(directory) &&
      path.normalize(directory) === directory &&
      directory === context.directory,
    "CONTEXT_INVALID",
  );
  loadBrowserFailureContext({ [PRIVATE_BROWSER_FAILURE_CONTEXT]: JSON.stringify(context) });
  const receipt = JSON.parse(readOwned(path.join(directory, "retention.json"), 8192, context.startedAt));
  need(
    ["COMPLETE", "INCOMPLETE"].includes(receipt.retention) &&
      trustedUpload.ciphertextDigest === receipt.ciphertextDigest &&
      hash(readOwned(path.join(directory, "failure.encrypted"), 128 * 1024 * 1024, context.startedAt)) ===
        receipt.ciphertextDigest,
    "UPLOAD_INVALID",
  );
  if (receipt.retention !== "COMPLETE") return { upload: "SUCCEEDED", cleanup: "RAW_RETAINED_PRIVATE_INCOMPLETE" };
  const cleanupBytes = readOwned(
    path.join(directory, "cleanup.private.json"),
    BROWSER_FAILURE_LIMITS.manifestBytes,
    context.startedAt,
  );
  need(hash(cleanupBytes) === receipt.cleanupInventoryDigest, "UPLOAD_INVALID");
  const inventory = JSON.parse(cleanupBytes);
  need(
    inventory.version === 1 &&
      inventory.sessionId === context.sessionId &&
      inventory.ciphertextDigest === receipt.ciphertextDigest &&
      Array.isArray(inventory.files) &&
      inventory.files.length <= BROWSER_FAILURE_LIMITS.files,
    "UPLOAD_INVALID",
  );
  const covered = new Map();
  const results = path.join(directory, "results");
  for (const entry of inventory.files) {
    need(
      entry &&
        Object.keys(entry).length === 3 &&
        Number.isSafeInteger(entry.bytes) &&
        /^[a-f0-9]{64}$/u.test(entry.sha256),
      "UPLOAD_INVALID",
    );
    const file = childPath(results, entry.path);
    const bytes = readOwned(file, BROWSER_FAILURE_LIMITS.fileBytes, context.startedAt);
    need(!covered.has(file) && bytes.length === entry.bytes && hash(bytes) === entry.sha256, "CHANGED");
    covered.set(file, entry);
  }
  const entries = [];
  function enumerate(current, depth) {
    need(depth <= BROWSER_FAILURE_LIMITS.depth, "LIMIT");
    privateDirectory(current);
    for (const name of readdirSync(current)) {
      const file = path.join(current, name),
        stat = lstatSync(file);
      need(stat.uid === process.getuid() && !stat.isSymbolicLink() && entries.length < 512, "PATH_INVALID");
      if (stat.isDirectory()) {
        enumerate(file, depth + 1);
        entries.push({ file, directory: true });
      } else {
        need(stat.isFile() && stat.nlink === 1, "PATH_INVALID");
        entries.push({ file });
      }
    }
  }
  enumerate(results, 0);
  if (entries.some((entry) => !entry.directory && !covered.has(entry.file)))
    return { upload: "SUCCEEDED", cleanup: "RAW_RETAINED_PRIVATE_UNCAPTURED_FILES" };
  for (const entry of entries) {
    if (entry.directory) rmdirSync(entry.file);
    else unlinkSync(entry.file);
  }
  rmdirSync(results);
  unlinkSync(path.join(directory, "manifest.private.json"));
  return { upload: "SUCCEEDED", cleanup: "RAW_REMOVED_AFTER_UPLOAD" };
}
