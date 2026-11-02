import { createHash } from "node:crypto";
import { readSourceSnapshotBatches } from "./source-snapshot-batches.mjs";

// Unhooked comparison only. The caller retains every original outcome. These
// observations neither replace a Git read nor authenticate an evidence receipt.
export const SOURCE_BATCH_SHADOW_LIMITS = Object.freeze({
  queries: 8192,
  revisions: 16,
  entries: 100000,
  readBytes: 8 * 1024 * 1024,
  totalBytes: 64 * 1024 * 1024,
});
const oid = (value) => typeof value === "string" && /^[a-f0-9]{40}$/u.test(value);
const invalid = () => {
  throw Error("SOUNDING_LINE_SOURCE_BATCH_SHADOW_INVALID");
};
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const canonical = (file) =>
  typeof file === "string" &&
  file.length <= 4096 &&
  !/[\\\x00-\x1f\x7f:]/u.test(file) &&
  file.split("/").every((part) => part && part !== "." && part !== "..");
// Git's default quoted output and pathspec grammar are deliberately outside
// this first comparison. Unsupported selectors retain their original outcome.
const literal = (file) => canonical(file) && /^[A-Za-z0-9_.@+ /-]+$/u.test(file);
const modes = new Map([
  ["040000", "tree"],
  ["100644", "blob"],
  ["100755", "blob"],
  ["120000", "blob"],
  ["160000", "commit"],
]);

function inventory(bytes, budget) {
  if (!Buffer.isBuffer(bytes) || bytes.length > SOURCE_BATCH_SHADOW_LIMITS.readBytes) invalid();
  budget.bytes += bytes.length;
  if (budget.bytes > SOURCE_BATCH_SHADOW_LIMITS.totalBytes) invalid();
  const entries = new Map();
  let offset = 0;
  while (offset < bytes.length) {
    const end = bytes.indexOf(0, offset);
    if (end < 0) invalid();
    const frame = bytes.subarray(offset, end);
    const tab = frame.indexOf(9);
    if (tab < 0) invalid();
    const metadata = frame.subarray(0, tab).toString("utf8");
    const match = /^(040000|100644|100755|120000|160000) (tree|blob|commit) ([a-f0-9]{40})$/u.exec(metadata);
    if (!match || modes.get(match[1]) !== match[2]) invalid();
    const raw = frame.subarray(tab + 1);
    const file = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(raw);
    if (!canonical(file) || !Buffer.from(file).equals(raw) || entries.has(file)) invalid();
    if (++budget.entries > SOURCE_BATCH_SHADOW_LIMITS.entries) invalid();
    entries.set(file, Object.freeze({ mode: match[1], type: match[2], blob: match[3], metadata }));
    offset = end + 1;
  }
  // A full recursive tree must explicitly include each parent. Do not invent
  // directory identities or accept a leaf that also acts as a parent.
  for (const file of entries.keys()) {
    const parts = file.split("/");
    for (let i = 1; i < parts.length; i++) if (entries.get(parts.slice(0, i).join("/"))?.type !== "tree") invalid();
  }
  return entries;
}

export function compareSourceBatchShadow({ queries, read }) {
  if (!Array.isArray(queries) || queries.length > SOURCE_BATCH_SHADOW_LIMITS.queries || typeof read !== "function")
    invalid();
  const ids = new Set();
  let originalBytes = 0;
  // Snapshot successful bytes before invoking any reader. Original outcome
  // references are returned unchanged, including the exact failed error object.
  const input = queries.map((query) => {
    if (
      !query ||
      typeof query.id !== "string" ||
      !/^[A-Za-z0-9_.-]{1,160}$/u.test(query.id) ||
      ids.has(query.id) ||
      !oid(query.revision) ||
      !["ls-tree-path", "identity", "blob"].includes(query.operation) ||
      typeof query.path !== "string" ||
      !query.legacy ||
      typeof query.legacy.ok !== "boolean" ||
      (query.legacy.ok && !Buffer.isBuffer(query.legacy.value)) ||
      (!query.legacy.ok && !Object.hasOwn(query.legacy, "error"))
    )
      invalid();
    ids.add(query.id);
    originalBytes += query.legacy.ok ? query.legacy.value.length : 0;
    if (originalBytes > SOURCE_BATCH_SHADOW_LIMITS.totalBytes) invalid();
    return { ...query, bytes: query.legacy.ok ? Buffer.from(query.legacy.value) : null };
  });
  const eligible = input.filter((query) => query.legacy.ok && literal(query.path));
  const revisions = [...new Set(eligible.map((query) => query.revision))];
  const stats = { originalQueries: queries.length, batchGitReads: 0, matched: 0, mismatched: 0, unavailable: 0 };
  const trees = new Map(),
    blobs = new Map(),
    budget = { bytes: 0, entries: 0 };
  const boundedRead = (args, options) => {
    stats.batchGitReads++;
    return read(args, options);
  };
  if (revisions.length <= SOURCE_BATCH_SHADOW_LIMITS.revisions) {
    for (const revision of revisions) {
      try {
        trees.set(
          revision,
          inventory(
            boundedRead(["ls-tree", "-rzt", revision], {
              encoding: null,
              maxBuffer: SOURCE_BATCH_SHADOW_LIMITS.readBytes,
            }),
            budget,
          ),
        );
      } catch {
        trees.set(revision, null);
      }
    }
    const wanted = new Map();
    for (const query of eligible) {
      const entry = trees.get(query.revision)?.get(query.path);
      if (query.operation === "blob" && entry?.type === "blob") wanted.set(entry.blob, entry.blob);
    }
    if (wanted.size) {
      try {
        const bodies = readSourceSnapshotBatches(
          [...wanted.values()].map((blob) => ({ path: blob, blob })),
          boundedRead,
          {
            encoding: null,
            maxBuffer: SOURCE_BATCH_SHADOW_LIMITS.readBytes,
            maxTotalBytes: SOURCE_BATCH_SHADOW_LIMITS.totalBytes - budget.bytes,
          },
        );
        for (const [blob, bytes] of bodies) {
          // Metadata alone cannot establish that a caller returned this blob.
          const actual = createHash("sha1")
            .update(Buffer.from(`blob ${bytes.length}\0`))
            .update(bytes)
            .digest("hex");
          if (actual !== blob) invalid();
          blobs.set(blob, bytes);
        }
      } catch {
        blobs.clear();
      }
    }
  }
  const rows = input.map((query) => {
    let status = "UNAVAILABLE",
      comparison = null;
    if (!query.legacy.ok) status = "ORIGINAL_FAILURE";
    else if (literal(query.path) && trees.get(query.revision)) {
      const entry = trees.get(query.revision).get(query.path);
      if (query.operation === "ls-tree-path")
        comparison = entry ? Buffer.from(`${entry.metadata}\t${query.path}\n`) : Buffer.alloc(0);
      else if (entry && query.operation === "identity") comparison = Buffer.from(`${entry.blob}\n`);
      else if (entry?.type === "blob" && query.operation === "blob") comparison = blobs.get(entry.blob) ?? null;
      if (comparison !== null) status = comparison.equals(query.bytes) ? "MATCH" : "MISMATCH";
    }
    if (status === "MATCH") stats.matched++;
    else if (status === "MISMATCH") stats.mismatched++;
    else if (status === "UNAVAILABLE") stats.unavailable++;
    return Object.freeze({
      id: query.id,
      status,
      legacy: query.legacy,
      originalSha256: query.bytes ? digest(query.bytes) : null,
      comparisonSha256: comparison !== null ? digest(comparison) : null,
      qualification: false,
      reuseAuthorized: false,
    });
  });
  return Object.freeze({
    kind: "SOURCE_BATCH_SHADOW_COMPARISON",
    rows: Object.freeze(rows),
    stats: Object.freeze(stats),
    qualification: false,
    reuseAuthorized: false,
    productionReadsReplaced: 0,
  });
}
