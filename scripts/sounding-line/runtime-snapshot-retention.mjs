// Content-addressed retention of already-supplied bytes only. This module does
// not attest a stopped runtime, SQLite consistency, producer identity or resume.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { canonicalJson } from "./evidence.mjs";
import { createRawOutputDirectory, readBoundedRawCaptureFile } from "./experience-raw-output.mjs";
const CHUNK = 65536,
  MAXIMUM = 64 * 1024 * 1024,
  MANIFEST = 512 * 1024;
const ROLES = new Set(["sqlite-backup", "browser-authentication-cache", "fixture-state"]);
const MARKER = "RETENTION_ONLY_NO_RUNTIME_QUIESCENCE_OR_PROVIDER_PROOF";
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const encode = (value) => Buffer.from(canonicalJson(value) + "\n");
const need = (condition, code) => {
  if (!condition) throw Error(`SOUNDING_LINE_RUNTIME_RETENTION_${code}`);
};
const equal = (a, b) => canonicalJson(a) === canonicalJson(b);
const keys = (value, names) =>
  value && typeof value === "object" && !Array.isArray(value) && equal(Object.keys(value).sort(), [...names].sort());
function binding(value) {
  need(
    keys(value, ["prNumber", "baseSha", "candidateSha", "sourceDigest", "runtimeDigest", "contextId"]) &&
      Number.isSafeInteger(value.prNumber) &&
      value.prNumber > 0 &&
      ![721, 776, 805].includes(value.prNumber) &&
      [value.baseSha, value.candidateSha].every((v) => typeof v === "string" && /^[a-f0-9]{40}$/u.test(v)) &&
      [value.sourceDigest, value.runtimeDigest, value.contextId].every(
        (v) => typeof v === "string" && /^[a-f0-9]{64}$/u.test(v),
      ),
    "BINDING",
  );
}
export async function createRuntimeSnapshotRetention({ root, rawDirectory, maximumBytes = MAXIMUM }) {
  need(Number.isSafeInteger(maximumBytes) && maximumBytes > 0 && maximumBytes <= MAXIMUM, "BOUND");
  const directory = await createRawOutputDirectory({
    root,
    directory: path.resolve(root, rawDirectory, "runtime-snapshots"),
  });
  await mkdir(path.join(directory, "chunks"), { mode: 0o700 });
  await mkdir(path.join(directory, "manifests"), { mode: 0o700 });
  const chunkIds = new Set();
  let reserved = 0,
    count = 0,
    queued = 0,
    queuedBytes = 0,
    queue = Promise.resolve();
  async function retain({ originalBinding, files }) {
    binding(originalBinding);
    need(files instanceof Map && files.size > 0 && files.size <= 3, "FILES");
    const entries = [...Map.prototype.entries.call(files)].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    let supplied = 0;
    const pending = new Map(),
      records = [];
    for (const [role, input] of entries) {
      need(
        ROLES.has(role) && Buffer.isBuffer(input) && input.length > 0 && input.length <= 32 * 1024 * 1024,
        "FILE_BOUND",
      );
      supplied += input.length;
      need(supplied <= MAXIMUM, "BOUND");
      const bytes = input,
        chunks = [];
      for (let offset = 0; offset < bytes.length; offset += CHUNK) {
        const part = bytes.subarray(offset, offset + CHUNK),
          id = hash(part);
        chunks.push({ sha256: id, bytes: part.length });
        if (!pending.has(id)) pending.set(id, Buffer.from(part));
      }
      records.push({ role, bytes: bytes.length, sha256: hash(bytes), chunks });
    }
    const manifest = {
      schemaVersion: 1,
      kind: "RUNTIME_SNAPSHOT_RETENTION",
      classification: MARKER,
      qualification: false,
      reuseAuthorized: false,
      originalBinding: JSON.parse(canonicalJson(originalBinding)),
      files: records,
    };
    const bytes = encode(manifest),
      id = hash(bytes);
    let additional = bytes.length;
    for (const [chunk, value] of pending) if (!chunkIds.has(chunk)) additional += value.length;
    need(
      bytes.length <= MANIFEST &&
        count < 128 &&
        chunkIds.size + [...pending.keys()].filter((id) => !chunkIds.has(id)).length <= 1024 &&
        reserved + additional <= maximumBytes,
      "BOUND",
    );
    // Reserve before writes; partial failures remain raw fragments and consume
    // their budget. No incomplete manifest is ever returned as a checkpoint.
    reserved += additional;
    count++;
    for (const [chunk, value] of pending) {
      const target = path.join(directory, "chunks", chunk);
      if (!chunkIds.has(chunk)) {
        chunkIds.add(chunk);
        await writeFile(target, value, { flag: "wx", mode: 0o600 });
      }
      const retained = await readBoundedRawCaptureFile({ root, rawDirectory, file: target, maximumBytes: CHUNK });
      need(retained.equals(value), "CHUNK_CHANGED");
    }
    const target = path.join(directory, "manifests", id + ".json");
    await writeFile(target, bytes, { flag: "wx", mode: 0o600 });
    need(
      (await readBoundedRawCaptureFile({ root, rawDirectory, file: target, maximumBytes: MANIFEST })).equals(bytes),
      "MANIFEST_CHANGED",
    );
    return Object.freeze({
      id,
      path: target,
      bytes: bytes.length,
      classification: MARKER,
      qualification: false,
      reuseAuthorized: false,
      measurements: Object.freeze({
        inputBytes: supplied,
        newBytes: additional,
        reservedBytes: reserved,
        uniqueChunks: chunkIds.size,
      }),
    });
  }
  return Object.freeze({
    append(input) {
      let snapshot,
        size = 0;
      try {
        binding(input.originalBinding);
        need(input.files instanceof Map && input.files.size > 0 && input.files.size <= 3, "FILES");
        for (const [role, bytes] of Map.prototype.entries.call(input.files)) {
          need(
            ROLES.has(role) && Buffer.isBuffer(bytes) && bytes.length > 0 && bytes.length <= 32 * 1024 * 1024,
            "FILE_BOUND",
          );
          size += bytes.length;
        }
        need(size <= MAXIMUM && queuedBytes + size <= MAXIMUM && count + queued < 128, "BOUND");
        snapshot = {
          originalBinding: JSON.parse(canonicalJson(input.originalBinding)),
          files: new Map(
            [...Map.prototype.entries.call(input.files)].map(([role, bytes]) => [role, Buffer.from(bytes)]),
          ),
        };
      } catch (error) {
        return Promise.reject(error);
      }
      queued++;
      queuedBytes += size;
      const result = queue
        .then(() => retain(snapshot))
        .finally(() => {
          queued--;
          queuedBytes -= size;
        });
      queue = result.catch(() => {});
      return result;
    },
  });
}

export async function restoreRuntimeSnapshotRetention({ root, rawDirectory, id, expectedOriginalBinding }) {
  binding(expectedOriginalBinding);
  need(typeof id === "string" && /^[a-f0-9]{64}$/u.test(id), "ID");
  const directory = path.resolve(root, rawDirectory, "runtime-snapshots"),
    raw = await readBoundedRawCaptureFile({
      root,
      rawDirectory,
      file: path.join(directory, "manifests", id + ".json"),
      maximumBytes: MANIFEST,
    });
  need(hash(raw) === id, "MANIFEST_CHANGED");
  let manifest;
  try {
    manifest = JSON.parse(raw.toString("utf8"));
  } catch {
    throw Error("SOUNDING_LINE_RUNTIME_RETENTION_MANIFEST");
  }
  need(
    keys(manifest, [
      "schemaVersion",
      "kind",
      "classification",
      "qualification",
      "reuseAuthorized",
      "originalBinding",
      "files",
    ]) &&
      manifest.schemaVersion === 1 &&
      manifest.kind === "RUNTIME_SNAPSHOT_RETENTION" &&
      manifest.classification === MARKER &&
      manifest.qualification === false &&
      manifest.reuseAuthorized === false &&
      equal(manifest.originalBinding, expectedOriginalBinding) &&
      encode(manifest).equals(raw) &&
      Array.isArray(manifest.files) &&
      manifest.files.length > 0 &&
      manifest.files.length <= 3,
    "MANIFEST",
  );
  let total = 0;
  const roles = new Set();
  for (const file of manifest.files) {
    need(
      keys(file, ["role", "bytes", "sha256", "chunks"]) &&
        ROLES.has(file.role) &&
        !roles.has(file.role) &&
        Number.isSafeInteger(file.bytes) &&
        file.bytes > 0 &&
        file.bytes <= 32 * 1024 * 1024 &&
        typeof file.sha256 === "string" &&
        /^[a-f0-9]{64}$/u.test(file.sha256) &&
        Array.isArray(file.chunks) &&
        file.chunks.length === Math.ceil(file.bytes / CHUNK),
      "FILE",
    );
    roles.add(file.role);
    total += file.bytes;
    need(total <= MAXIMUM, "BOUND");
    file.chunks.forEach((chunk, index) =>
      need(
        keys(chunk, ["sha256", "bytes"]) &&
          typeof chunk.sha256 === "string" &&
          /^[a-f0-9]{64}$/u.test(chunk.sha256) &&
          chunk.bytes === Math.min(CHUNK, file.bytes - index * CHUNK),
        "CHUNK",
      ),
    );
  }
  const files = new Map();
  for (const file of manifest.files) {
    const chunks = [];
    for (const chunk of file.chunks) {
      const bytes = await readBoundedRawCaptureFile({
        root,
        rawDirectory,
        file: path.join(directory, "chunks", chunk.sha256),
        maximumBytes: CHUNK,
      });
      need(bytes.length === chunk.bytes && hash(bytes) === chunk.sha256, "CHUNK_CHANGED");
      chunks.push(bytes);
    }
    const bytes = Buffer.concat(chunks);
    need(bytes.length === file.bytes && hash(bytes) === file.sha256, "FILE_CHANGED");
    files.set(file.role, bytes);
  }
  return {
    files,
    originalBinding: JSON.parse(canonicalJson(expectedOriginalBinding)),
    classification: MARKER,
    qualification: false,
    reuseAuthorized: false,
  };
}
