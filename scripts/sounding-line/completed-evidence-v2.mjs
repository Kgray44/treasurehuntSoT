// Lossless storage codec only. Self-hashes, compaction and reconstruction never
// authenticate a producer, spend an ordinal, authorize reuse or qualify a tree.
import { createHash } from "node:crypto";
import { canonicalJson, verifyReceipt } from "./evidence.mjs";
const MiB = 1024 * 1024;
const TOP = [
  "version",
  "kind",
  "authentication",
  "candidateSha",
  "baseSha",
  "planDigest",
  "producerObservation",
  "completedWholeObligations",
  "receipts",
  "wholeVerificationPassed",
  "qualification",
].sort();
const MARKER = "COMPACT_RETENTION_ONLY_NO_PROVIDER_AUTHENTICATION";
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const json = (value) => Buffer.from(canonicalJson(value) + "\n");
const need = (value, code) => {
  if (!value) throw Error(`SOUNDING_LINE_COMPLETED_V2_${code}`);
};
const equal = (a, b) => canonicalJson(a) === canonicalJson(b);
const keys = (value, names) =>
  value && typeof value === "object" && !Array.isArray(value) && equal(Object.keys(value).sort(), [...names].sort());
function parse(bytes, maximum) {
  need(Buffer.isBuffer(bytes) && bytes.length > 0 && bytes.length <= maximum, "FRAME_BOUND");
  let value;
  try {
    value = JSON.parse(bytes.toString("utf8"));
  } catch {
    throw Error("SOUNDING_LINE_COMPLETED_V2_JSON");
  }
  const pending = [[value, 0]];
  let nodes = 0;
  while (pending.length) {
    const [entry, depth] = pending.pop();
    need(++nodes <= 500000 && depth <= 64, "STRUCTURE_BOUND");
    if (entry && typeof entry === "object") {
      const children = Object.values(entry);
      need(children.length <= 100000, "STRUCTURE_BOUND");
      for (const child of children) pending.push([child, depth + 1]);
    }
  }
  need(json(value).equals(bytes), "CANONICAL_BYTES");
  return value;
}
function validate(checkpoint, ordinal, priorFiles, files) {
  need(
    keys(checkpoint, TOP) &&
      checkpoint.version === 1 &&
      checkpoint.kind === "sounding-line-completed-obligation-checkpoint" &&
      checkpoint.authentication === "RETENTION_ONLY_NO_AUTHENTICATED_PRODUCER" &&
      checkpoint.qualification === false &&
      checkpoint.wholeVerificationPassed === false,
    "CHECKPOINT",
  );
  need(
    [checkpoint.baseSha, checkpoint.candidateSha].every((s) => /^[a-f0-9]{40}$/u.test(s ?? "")) &&
      /^[a-f0-9]{64}$/u.test(checkpoint.planDigest ?? ""),
    "SOURCE_IDENTITY",
  );
  need(
    checkpoint.completedWholeObligations === ordinal &&
      Array.isArray(checkpoint.receipts) &&
      checkpoint.receipts.length === ordinal &&
      files.length === ordinal &&
      equal(files.slice(0, -1), priorFiles),
    "PREFIX",
  );
  const ids = new Set(),
    obligations = new Set();
  for (const receipt of checkpoint.receipts) {
    need(
      verifyReceipt(receipt).valid &&
        receipt.candidateSha === checkpoint.candidateSha &&
        ["FRESH", "PRESERVED", "REBOUND"].includes(receipt.disposition) &&
        !ids.has(receipt.id) &&
        !obligations.has(receipt.obligationId),
      "RECEIPT",
    );
    ids.add(receipt.id);
    obligations.add(receipt.obligationId);
  }
  const { receipts: _receipts, completedWholeObligations: _ordinal, ...identity } = checkpoint;
  return canonicalJson(identity);
}
function entries(input, maximum) {
  need(input instanceof Map && input.size > 0 && input.size <= maximum, "MEMBERS");
  return [...Map.prototype.entries.call(input)].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}

export function compactCompletedEvidenceV2(checkpoints) {
  const source = entries(checkpoints, 128),
    members = new Map(),
    index = [];
  let originalBytes = 0,
    uniqueBytes = 0,
    prior = [],
    identity;
  for (const [position, [name, bytes]] of source.entries()) {
    need(name === `checkpoint-${String(position + 1).padStart(4, "0")}.json`, "SEQUENCE");
    originalBytes += bytes?.length ?? 0;
    need(originalBytes <= 64 * MiB, "TOTAL_BOUND");
    const checkpoint = parse(bytes, 8 * MiB);
    need(Array.isArray(checkpoint?.receipts), "CHECKPOINT");
    const receiptFiles =
      checkpoint.receipts?.map((receipt) => {
        const original = json(receipt);
        need(original.length <= 8 * MiB, "FRAME_BOUND");
        const file = `receipt-${sha(original)}.json`;
        if (!members.has(file)) {
          uniqueBytes += original.length;
          need(uniqueBytes <= 32 * MiB, "TOTAL_BOUND");
          members.set(file, original);
        }
        return file;
      }) ?? [];
    const observed = validate(checkpoint, position + 1, prior, receiptFiles);
    need(identity === undefined || identity === observed, "MIXED_SOURCE");
    identity = observed;
    const { receipts: _receipts, ...header } = checkpoint;
    need(json(header).length <= 65536, "HEADER_BOUND");
    index.push({ name, bytes: bytes.length, sha256: sha(bytes), header, receiptFiles });
    prior = receiptFiles;
  }
  const manifest = {
    schemaVersion: 2,
    kind: "COMPACT_COMPLETED_EVIDENCE_RETENTION",
    authentication: MARKER,
    qualification: false,
    checkpoints: index,
  };
  const indexBytes = json(manifest);
  need(indexBytes.length <= 2 * MiB, "INDEX_BOUND");
  members.set("manifest-v2.json", indexBytes);
  return {
    members,
    measurements: {
      originalBytes,
      uniqueReceiptBytes: uniqueBytes,
      indexBytes: indexBytes.length,
      members: members.size,
    },
    authentication: MARKER,
    qualification: false,
  };
}

export function restoreCompletedEvidenceV2(members) {
  const supplied = entries(members, 129),
    files = new Map(supplied),
    used = new Set(["manifest-v2.json"]);
  let storedBytes = 0;
  for (const [name, bytes] of supplied) {
    need(name === "manifest-v2.json" || /^receipt-[a-f0-9]{64}\.json$/u.test(name), "MEMBER_NAME");
    need(Buffer.isBuffer(bytes), "FRAME_BOUND");
    storedBytes += bytes.length;
    need(storedBytes <= 34 * MiB, "TOTAL_BOUND");
  }
  const manifest = parse(files.get("manifest-v2.json"), 2 * MiB);
  need(
    keys(manifest, ["schemaVersion", "kind", "authentication", "qualification", "checkpoints"]) &&
      manifest.schemaVersion === 2 &&
      manifest.kind === "COMPACT_COMPLETED_EVIDENCE_RETENTION" &&
      manifest.authentication === MARKER &&
      manifest.qualification === false &&
      Array.isArray(manifest.checkpoints) &&
      manifest.checkpoints.length > 0 &&
      manifest.checkpoints.length <= 128,
    "MANIFEST",
  );
  let declaredBytes = 0;
  for (const record of manifest.checkpoints) {
    need(
      keys(record, ["name", "bytes", "sha256", "header", "receiptFiles"]) &&
        Number.isSafeInteger(record.bytes) &&
        record.bytes > 0 &&
        record.bytes <= 8 * MiB &&
        /^[a-f0-9]{64}$/u.test(record.sha256 ?? ""),
      "INDEX",
    );
    declaredBytes += record.bytes;
    need(declaredBytes <= 64 * MiB, "TOTAL_BOUND");
  }
  const decoded = new Map(),
    restored = new Map();
  let prior = [],
    identity;
  for (const [position, record] of manifest.checkpoints.entries()) {
    need(
      record.name === `checkpoint-${String(position + 1).padStart(4, "0")}.json` &&
        keys(
          record.header,
          TOP.filter((key) => key !== "receipts"),
        ) &&
        json(record.header).length <= 65536 &&
        Array.isArray(record.receiptFiles) &&
        record.receiptFiles.length === position + 1,
      "INDEX",
    );
    let prospectiveBytes = json(record.header).length + 16;
    const receipts = record.receiptFiles.map((file) => {
      need(typeof file === "string" && /^receipt-[a-f0-9]{64}\.json$/u.test(file), "MEMBER_NAME");
      const bytes = files.get(file);
      need(Buffer.isBuffer(bytes) && sha(bytes) === file.slice(8, -5), "RECEIPT_BYTES");
      prospectiveBytes += bytes.length;
      need(prospectiveBytes <= 8 * MiB + 32, "FRAME_BOUND");
      if (!decoded.has(file)) decoded.set(file, parse(bytes, 8 * MiB));
      used.add(file);
      return decoded.get(file);
    });
    const checkpoint = { ...record.header, receipts };
    const observed = validate(checkpoint, position + 1, prior, record.receiptFiles);
    need(identity === undefined || identity === observed, "MIXED_SOURCE");
    identity = observed;
    const bytes = json(checkpoint);
    need(bytes.length === record.bytes && sha(bytes) === record.sha256, "ORIGINAL_CHECKPOINT_BYTES");
    restored.set(record.name, bytes);
    prior = record.receiptFiles;
  }
  need(used.size === files.size, "UNREFERENCED_MEMBER");
  return restored;
}
