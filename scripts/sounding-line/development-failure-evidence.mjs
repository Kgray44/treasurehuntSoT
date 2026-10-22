// Live trusted-host bytes only. Tokens and raw contents cannot be reconstructed from JSON.
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import path from "node:path";
const captured = new WeakMap();
const labels = ["server.stdout", "server.stderr", "browser.stdout", "browser.stderr"];
export const DEVELOPMENT_FAILURE_REPORT_LIMIT = 1024 * 1024;
const streamLimit = 16 * 1024 * 1024;
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const need = (value) => {
  if (!value) throw Error("DEVELOPMENT_FAILURE_EVIDENCE_INVALID");
};
const sha = (value, length) => typeof value === "string" && new RegExp(`^[a-f0-9]{${length}}$`, "u").test(value);
const exact = (value, keys) =>
  value &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  Object.keys(value).length === keys.length &&
  keys.every((key) => Object.hasOwn(value, key));
function validBinding(binding) {
  return (
    exact(binding, ["version", "runId", "scopeId", "baseSha", "candidateSha", "planDigest"]) &&
    binding.version === 1 &&
    [binding.runId, binding.scopeId].every((value) =>
      /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u.test(value ?? ""),
    ) &&
    sha(binding.baseSha, 40) &&
    sha(binding.candidateSha, 40) &&
    sha(binding.planDigest, 64)
  );
}
export function createDevelopmentFailureEvidence({
  binding,
  selector,
  provider = null,
  report,
  streams,
  producersClosed,
}) {
  need(producersClosed === true && validBinding(binding));
  need(/^tests\/e2e\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.spec\.ts(?::[1-9][0-9]*)?$/u.test(selector ?? ""));
  need(Buffer.byteLength(selector) <= 1024);
  need(
    provider === null ||
      (exact(provider, ["repository", "runId", "attempt", "workflowSha"]) &&
        provider.repository === "Kgray44/treasurehuntSoT" &&
        typeof provider.runId === "string" &&
        /^[1-9][0-9]{0,19}$/u.test(provider.runId ?? "") &&
        Number.isSafeInteger(provider.attempt) &&
        provider.attempt > 0 &&
        sha(provider.workflowSha, 40)),
  );
  need(["COMPLETE", "MISSING", "UNREADABLE"].includes(report?.status));
  need(exact(report, report.status === "COMPLETE" ? ["status", "bytes"] : ["status"]));
  need(Array.isArray(streams) && streams.length === labels.length);
  const files = [],
    issues = [],
    inventory = [];
  if (report.status === "COMPLETE") {
    need(
      Buffer.isBuffer(report.bytes) &&
        report.bytes.length > 0 &&
        report.bytes.length <= DEVELOPMENT_FAILURE_REPORT_LIMIT,
    );
    files.push({ name: "private/development/playwright-report.original.json", bytes: Buffer.from(report.bytes) });
  } else issues.push("DEVELOPMENT_REPORT_UNAVAILABLE");
  for (const [index, stream] of streams.entries()) {
    need(exact(stream, ["label", "bytes", "originalBytes", "originalStreamSHA256", "complete"]));
    need(stream.label === labels[index] && Buffer.isBuffer(stream.bytes) && stream.bytes.length <= streamLimit);
    need(
      Number.isSafeInteger(stream.originalBytes) &&
        stream.originalBytes >= stream.bytes.length &&
        sha(stream.originalStreamSHA256, 64),
    );
    need(typeof stream.complete === "boolean");
    if (stream.complete)
      need(stream.originalBytes === stream.bytes.length && hash(stream.bytes) === stream.originalStreamSHA256);
    else issues.push("DEVELOPMENT_STREAM_INCOMPLETE");
    const name = `private/development/${stream.label}.retained.bin`;
    files.push({ name, bytes: Buffer.from(stream.bytes) });
    inventory.push({
      name,
      retainedBytes: stream.bytes.length,
      originalBytes: stream.originalBytes,
      originalStreamSHA256: stream.originalStreamSHA256,
      complete: stream.complete,
    });
  }
  const context = {
    version: 1,
    role: "DEVELOPMENT_ONLY",
    qualification: false,
    binding: structuredClone(binding),
    selector,
    provider: structuredClone(provider),
    report: { status: report.status },
    streams: inventory,
  };
  files.unshift({ name: "private/development/context.json", bytes: Buffer.from(JSON.stringify(context)) });
  need(files.reduce((sum, file) => sum + file.bytes.length, 0) <= 64 * 1024 * 1024);
  const token = Object.freeze({
    classification: "DEVELOPMENT_PRIVATE_DIAGNOSTICS_NOT_ACCEPTANCE",
    qualification: false,
  });
  captured.set(token, { binding: JSON.stringify(binding), files, issues: [...new Set(issues)] });
  return token;
}
export function developmentFailureEvidenceFiles(token, binding) {
  const value = captured.get(token);
  need(value && value.binding === JSON.stringify(binding));
  return {
    files: value.files.map(({ name, bytes }) => ({ name, bytes: Buffer.from(bytes) })),
    issues: [...value.issues],
  };
}

export async function readDevelopmentFailureReport(directory, startedAt) {
  let handle;
  try {
    need(
      typeof directory === "string" &&
        path.isAbsolute(directory) &&
        path.resolve(directory) === directory &&
        Number.isSafeInteger(startedAt) &&
        startedAt > 0,
    );
    const folder = await lstat(directory);
    need(
      typeof process.getuid === "function" &&
        folder.isDirectory() &&
        !folder.isSymbolicLink() &&
        folder.uid === process.getuid() &&
        (folder.mode & 0o077) === 0 &&
        (await realpath(directory)) === directory,
    );
    const file = path.join(directory, "playwright-report.original.json");
    const before = await lstat(file);
    need(
      before.isFile() &&
        !before.isSymbolicLink() &&
        before.nlink === 1 &&
        before.uid === process.getuid() &&
        (before.mode & 0o077) === 0 &&
        before.size > 0 &&
        before.size <= DEVELOPMENT_FAILURE_REPORT_LIMIT &&
        (await realpath(file)) === file,
    );
    need(
      before.mtimeMs >= startedAt - 1 &&
        before.ctimeMs >= startedAt - 1 &&
        (!before.birthtimeMs || before.birthtimeMs >= startedAt - 1),
    );
    handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const opened = await handle.stat();
    const keys = ["dev", "ino", "nlink", "uid", "mode", "size", "mtimeMs", "ctimeMs"];
    need(opened.isFile() && keys.every((key) => opened[key] === before[key]));
    const bytes = Buffer.alloc(before.size);
    let offset = 0;
    while (offset < bytes.length) {
      const { bytesRead } = await handle.read(bytes, offset, bytes.length - offset, offset);
      need(bytesRead > 0);
      offset += bytesRead;
    }
    const extra = await handle.read(Buffer.alloc(1), 0, 1, offset);
    need(extra.bytesRead === 0);
    const final = await handle.stat(),
      named = await lstat(file),
      currentFolder = await lstat(directory);
    need(
      bytes.length === before.size &&
        !named.isSymbolicLink() &&
        keys.every((key) => final[key] === before[key] && named[key] === before[key]) &&
        !currentFolder.isSymbolicLink() &&
        currentFolder.isDirectory() &&
        currentFolder.uid === folder.uid &&
        currentFolder.mode === folder.mode &&
        currentFolder.dev === folder.dev &&
        currentFolder.ino === folder.ino,
    );
    return { status: "COMPLETE", bytes };
  } catch (error) {
    return { status: error.code === "ENOENT" ? "MISSING" : "UNREADABLE" };
  } finally {
    if (handle) await handle.close();
  }
}
