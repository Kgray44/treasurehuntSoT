// Complete-object transport only. Selection and snapshot ordering belong to the caller.
export const SOURCE_SNAPSHOT_MAX_BUFFER = 128 * 1024 * 1024;
const metadataObjects = 512;
const metadataLineBytes = 96;
const invalid = () => {
  throw new Error("PRODUCT_EXPERIENCE_SOURCE_SNAPSHOT_INVALID");
};

export function readSourceSnapshotBatches(sources, read, { maxBuffer = SOURCE_SNAPSHOT_MAX_BUFFER } = {}) {
  if (
    !Number.isSafeInteger(maxBuffer) ||
    maxBuffer < 128 ||
    maxBuffer > SOURCE_SNAPSHOT_MAX_BUFFER ||
    !Array.isArray(sources) ||
    typeof read !== "function" ||
    sources.some((entry) => typeof entry?.blob !== "string" || !/^[a-f0-9]{40}$/u.test(entry.blob))
  )
    invalid();
  const records = [];
  const chunkSize = Math.min(metadataObjects, Math.floor(maxBuffer / metadataLineBytes));
  const request = (kind, entries) =>
    read(["cat-file", kind], {
      encoding: null,
      maxBuffer,
      input: entries.map((entry) => entry.blob).join("\n") + "\n",
    });
  for (let start = 0; start < sources.length; start += chunkSize) {
    const entries = sources.slice(start, start + chunkSize);
    const bytes = request("--batch-check", entries);
    if (!Buffer.isBuffer(bytes)) invalid();
    let offset = 0;
    for (const entry of entries) {
      const newline = bytes.indexOf(10, offset);
      if (newline < offset || newline - offset >= metadataLineBytes) invalid();
      const match = /^([a-f0-9]{40}) blob (0|[1-9][0-9]*)$/u.exec(bytes.subarray(offset, newline).toString("utf8"));
      if (!match || match[1] !== entry.blob) invalid();
      const size = Number(match[2]);
      const header = Buffer.from(`${entry.blob} blob ${match[2]}\n`);
      const frameBytes = header.length + size + 1;
      if (!Number.isSafeInteger(size) || !Number.isSafeInteger(frameBytes) || frameBytes > maxBuffer) invalid();
      records.push({ ...entry, size, header, frameBytes });
      offset = newline + 1;
    }
    if (offset !== bytes.length) invalid();
  }

  const batches = [];
  let batch = [],
    total = 0;
  for (const record of records) {
    if (total + record.frameBytes > maxBuffer) {
      batches.push(batch);
      batch = [];
      total = 0;
    }
    batch.push(record);
    total += record.frameBytes;
  }
  if (batch.length) batches.push(batch);
  const contents = new Map();
  for (const entries of batches) {
    const bytes = request("--batch", entries);
    if (!Buffer.isBuffer(bytes)) invalid();
    let offset = 0;
    for (const entry of entries) {
      const body = offset + entry.header.length;
      const end = body + entry.size;
      if (!bytes.subarray(offset, body).equals(entry.header) || end >= bytes.length || bytes[end] !== 10) invalid();
      contents.set(entry.path, bytes.subarray(body, end).toString("utf8"));
      offset = end + 1;
    }
    if (offset !== bytes.length) invalid();
  }
  return contents;
}
