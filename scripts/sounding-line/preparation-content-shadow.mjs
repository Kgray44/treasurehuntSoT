import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import { canonicalJson, digest } from "./evidence.mjs";
import { PREPARATION_LAYER_IDENTITIES } from "./preparation-reuse-shadow.mjs";

export const PREPARATION_CONTENT_LIMITS = Object.freeze({
  bytes: 2 * 1024 * 1024 * 1024,
  entries: 200000,
  depth: 64,
  metadataBytes: 32 * 1024 * 1024,
  chunkBytes: 64 * 1024,
  deadlineMs: 60000,
});
const observations = new WeakMap();
const need = (condition, code) => {
  if (!condition) throw Error(`SOUNDING_LINE_PREPARATION_CONTENT_${code}`);
};
const signature = (stat) =>
  [stat.dev, stat.ino, stat.mode, stat.nlink, stat.size, stat.mtimeNs, stat.ctimeNs].map(String).join(":");
function rootIdentity(root) {
  need(typeof root === "string" && path.isAbsolute(root), "ROOT");
  const resolved = path.resolve(root);
  need(path.resolve(fs.realpathSync(resolved)) === resolved, "ROOT_ALIAS");
  for (let current = resolved; ; current = path.dirname(current)) {
    const stat = fs.lstatSync(current, { bigint: true });
    need(stat.isDirectory() && !stat.isSymbolicLink(), "ROOT_ALIAS");
    if (path.dirname(current) === current) break;
  }
  return resolved;
}

// Read-only, complete-tree observation. Callers provide an owned immutable layer
// directory, never a workspace, profile, database, or build-output directory.
// The layer name is a declaration, not proof of private-data classification.
// Synchronous I/O needs the existing external owned-process deadline guardian.
export function measurePreparationContentShadow({ root, layer }) {
  need(Object.hasOwn(PREPARATION_LAYER_IDENTITIES, layer), "LAYER");
  const resolved = rootIdentity(root),
    began = performance.now(),
    initial = new Map();
  const entries = [],
    buffer = Buffer.alloc(PREPARATION_CONTENT_LIMITS.chunkBytes);
  let bytes = 0,
    metadataBytes = 0;
  const deadline = () => need(performance.now() - began < PREPARATION_CONTENT_LIMITS.deadlineMs, "DEADLINE");
  function walk(directory, relative = "", depth = 0, collect = true) {
    deadline();
    need(depth <= PREPARATION_CONTENT_LIMITS.depth, "DEPTH");
    const stat = fs.lstatSync(directory, { bigint: true });
    need(stat.isDirectory() && !stat.isSymbolicLink(), "DIRECTORY_ALIAS");
    const key = relative || ".";
    if (collect) {
      initial.set(key, signature(stat));
      need(initial.size <= PREPARATION_CONTENT_LIMITS.entries, "ENTRIES");
      const entry = { path: key, type: "directory", mode: Number(stat.mode & 0o777n) };
      metadataBytes += Buffer.byteLength(canonicalJson(entry));
      need(metadataBytes <= PREPARATION_CONTENT_LIMITS.metadataBytes, "METADATA");
      entries.push(entry);
    } else need(initial.get(key) === signature(stat), "DIRECTORY_DRIFT");
    const names = fs.readdirSync(directory).sort();
    for (const name of names) {
      deadline();
      need(!/[\\\x00-\x1f\x7f:]/u.test(name) && name !== "." && name !== "..", "PATH");
      const childRelative = relative ? `${relative}/${name}` : name;
      need(childRelative.length <= 4096 && !/(^|\/)\.git(?:\/|$)/iu.test(childRelative), "PATH");
      const filename = path.join(directory, name),
        childStat = fs.lstatSync(filename, { bigint: true });
      need(!childStat.isSymbolicLink(), "SYMLINK");
      if (childStat.isDirectory()) walk(filename, childRelative, depth + 1, collect);
      else {
        need(childStat.isFile() && childStat.nlink === 1n, "FILE_TYPE_OR_LINK");
        if (!collect) {
          need(initial.get(childRelative) === signature(childStat), "FILE_DRIFT");
          continue;
        }
        initial.set(childRelative, signature(childStat));
        need(initial.size <= PREPARATION_CONTENT_LIMITS.entries, "ENTRIES");
        need(childStat.size <= BigInt(PREPARATION_CONTENT_LIMITS.bytes - bytes), "BYTES");
        bytes += Number(childStat.size);
        const fd = fs.openSync(filename, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
        let failure, closeFailure, result;
        try {
          need(signature(fs.fstatSync(fd, { bigint: true })) === signature(childStat), "FILE_OPEN_DRIFT");
          const hash = createHash("sha256");
          let position = 0;
          while (position < Number(childStat.size)) {
            deadline();
            const count = fs.readSync(
              fd,
              buffer,
              0,
              Math.min(buffer.length, Number(childStat.size) - position),
              position,
            );
            need(count > 0, "TRUNCATED");
            hash.update(buffer.subarray(0, count));
            position += count;
          }
          need(signature(fs.fstatSync(fd, { bigint: true })) === signature(childStat), "FILE_READ_DRIFT");
          need(signature(fs.lstatSync(filename, { bigint: true })) === signature(childStat), "FILE_NAME_DRIFT");
          result = {
            path: childRelative,
            type: "file",
            bytes: Number(childStat.size),
            mode: Number(childStat.mode & 0o777n),
            sha256: hash.digest("hex"),
          };
        } catch (error) {
          failure = error;
        }
        try {
          fs.closeSync(fd);
        } catch (error) {
          closeFailure = error;
        }
        if (failure && closeFailure)
          throw new AggregateError([failure, closeFailure], "PREPARATION_CONTENT_READ_AND_CLOSE_FAILED", {
            cause: failure,
          });
        if (failure || closeFailure) throw failure || closeFailure;
        metadataBytes += Buffer.byteLength(canonicalJson(result));
        need(metadataBytes <= PREPARATION_CONTENT_LIMITS.metadataBytes, "METADATA");
        entries.push(result);
      }
    }
    need(signature(fs.lstatSync(directory, { bigint: true })) === signature(stat), "DIRECTORY_DRIFT");
  }
  walk(resolved);
  const fileCount = entries.filter((entry) => entry.type === "file").length;
  need(fileCount > 0, "EMPTY");
  // Re-enumerate the whole tree; a late insertion/removal cannot hide behind a
  // matching list of previously opened files. Directory timestamps also bind it.
  walk(resolved, "", 0, false);
  rootIdentity(resolved);
  const inventoryDigest = digest(entries);
  const body = Object.freeze({
    kind: "PREPARATION_CONTENT_SHADOW_OBSERVATION",
    layer,
    inventoryDigest,
    fileCount,
    byteLength: bytes,
    qualification: false,
    reuseAuthorized: false,
    certificate: "NOT_ISSUED",
  });
  const handle = Object.freeze({ ...body, observationDigest: digest(body) });
  observations.set(handle, { resolved, layer, inventoryDigest, bytes, entries });
  return handle;
}

// This independently rereads both complete directories at comparison time.
// Copies, caller hashes, record clones and stale observations grant no authority.
export function comparePreparationContentShadow({ source, destination }) {
  const original = observations.get(source),
    restored = observations.get(destination);
  need(original && restored, "OPAQUE_OBSERVATIONS_REQUIRED");
  need(original.layer === restored.layer && original.resolved !== restored.resolved, "DISTINCT_LAYER_ROOTS");
  need(
    !original.resolved.startsWith(`${restored.resolved}${path.sep}`) &&
      !restored.resolved.startsWith(`${original.resolved}${path.sep}`),
    "OVERLAPPING_ROOTS",
  );
  const sourceNow = measurePreparationContentShadow({ root: original.resolved, layer: original.layer });
  const destinationNow = measurePreparationContentShadow({ root: restored.resolved, layer: restored.layer });
  const sourceUnchanged = sourceNow.inventoryDigest === original.inventoryDigest;
  const destinationUnchanged = destinationNow.inventoryDigest === restored.inventoryDigest;
  return Object.freeze({
    kind: "PREPARATION_SOURCE_DESTINATION_REHASH_SHADOW",
    sourceObservationDigest: source.observationDigest,
    destinationObservationDigest: destination.observationDigest,
    sourceUnchanged,
    destinationUnchanged,
    contentEquivalent:
      sourceUnchanged && destinationUnchanged && sourceNow.inventoryDigest === destinationNow.inventoryDigest,
    disposition:
      !sourceUnchanged || !destinationUnchanged
        ? "REJECT_DRIFT"
        : sourceNow.inventoryDigest !== destinationNow.inventoryDigest
          ? "REJECT_CORRUPTION"
          : "EQUIVALENT_SHADOW",
    action: "RUN_FRESH_PREPARATION",
    qualification: false,
    reuseAuthorized: false,
    certificate: "NOT_ISSUED",
    externalIsolationAttested: false,
  });
}
