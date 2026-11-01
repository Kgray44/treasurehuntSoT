import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { inflateRawSync } from "node:zlib";

export const ATTESTATION_ARCHIVE_SHADOW_LIMITS = Object.freeze({
  archiveBytes: 5 * 1024 ** 3,
  centralBytes: 16 * 1024 * 1024,
  metadataBytes: 32 * 1024 * 1024,
  memberBytes: 8 * 1024 * 1024,
  entries: 16384,
  chunkBytes: 65536,
  deadlineMs: 600000,
});
const need = (condition, code) => {
  if (!condition) throw Error(`SOUNDING_LINE_ATTESTATION_SHADOW_${code}`);
};
const safe = (name) =>
  typeof name === "string" &&
  name.length > 0 &&
  name.length <= 4096 &&
  !/[\\:\x00-\x1f\x7f]/u.test(name) &&
  name.split("/").every((part) => part && part !== "." && part !== "..");
const crcTable = Array.from({ length: 256 }, (_, value) => {
  for (let i = 0; i < 8; i++) value = (value >>> 1) ^ (0xedb88320 & -(value & 1));
  return value >>> 0;
});
const crc32 = (bytes) => {
  let value = 0xffffffff;
  for (const byte of bytes) value = (value >>> 8) ^ crcTable[(value ^ byte) & 255];
  return (value ^ 0xffffffff) >>> 0;
};
function extras(bytes) {
  for (let offset = 0; offset < bytes.length; ) {
    need(offset + 4 <= bytes.length, "EXTRA_INVALID");
    const kind = bytes.readUInt16LE(offset),
      length = bytes.readUInt16LE(offset + 2);
    need(kind !== 1, "ZIP64_UNSUPPORTED");
    need(offset + 4 + length <= bytes.length, "EXTRA_INVALID");
    offset += 4 + length;
  }
}

// Unhooked, read-only experiment. A full file digest precedes member lookup.
// No extraction or selected-range proof can substitute for the complete digest.
// Expected digests remain caller declarations, not provider authentication.
export function readAttestationArchiveShadow({
  filename,
  expectedBytes,
  expectedSha256,
  memberNames,
  deadlineMs = ATTESTATION_ARCHIVE_SHADOW_LIMITS.deadlineMs,
}) {
  const limits = ATTESTATION_ARCHIVE_SHADOW_LIMITS;
  need(typeof filename === "string" && path.isAbsolute(filename), "PATH");
  need(
    Number.isSafeInteger(expectedBytes) && expectedBytes >= 22 && expectedBytes <= limits.archiveBytes,
    "ARCHIVE_BOUND",
  );
  need(typeof expectedSha256 === "string" && /^[a-f0-9]{64}$/u.test(expectedSha256), "DIGEST");
  need(
    Array.isArray(memberNames) &&
      memberNames.length > 0 &&
      memberNames.length <= 2 &&
      memberNames.every(safe) &&
      new Set(memberNames).size === memberNames.length,
    "MEMBER_NAMES",
  );
  need(Number.isSafeInteger(deadlineMs) && deadlineMs > 0 && deadlineMs <= limits.deadlineMs, "DEADLINE");
  const began = performance.now(),
    namesWanted = new Set(memberNames);
  const stats = {
    archiveHashBytes: 0,
    metadataReadBytes: 0,
    largestReadBytes: 0,
    selectedCompressedBytes: 0,
    selectedBytes: 0,
  };
  let fd, result, originalError, cleanupError;
  try {
    const named = fs.lstatSync(filename);
    need(
      named.isFile() && !named.isSymbolicLink() && named.nlink === 1 && named.size === expectedBytes,
      "FILE_IDENTITY",
    );
    fd = fs.openSync(filename, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
    const before = fs.fstatSync(fd);
    need(
      before.isFile() &&
        before.nlink === 1 &&
        before.ino === named.ino &&
        before.dev === named.dev &&
        before.size === expectedBytes,
      "FILE_IDENTITY",
    );
    const remaining = () => need(performance.now() - began < deadlineMs, "DEADLINE");
    const read = (offset, length, metadata = true) => {
      remaining();
      need(
        Number.isSafeInteger(offset) &&
          Number.isSafeInteger(length) &&
          offset >= 0 &&
          length >= 0 &&
          offset + length <= expectedBytes,
        "RANGE",
      );
      if (metadata) {
        stats.metadataReadBytes += length;
        need(stats.metadataReadBytes <= limits.metadataBytes, "METADATA_BOUND");
      }
      stats.largestReadBytes = Math.max(stats.largestReadBytes, length);
      const bytes = Buffer.alloc(length);
      for (let received = 0; received < length; ) {
        remaining();
        const count = fs.readSync(fd, bytes, received, length - received, offset + received);
        need(count > 0, "TRUNCATED");
        received += count;
      }
      return bytes;
    };
    const hash = createHash("sha256"),
      hashBegan = performance.now(),
      hashBuffer = Buffer.alloc(limits.chunkBytes);
    for (let offset = 0; offset < expectedBytes; ) {
      remaining();
      const requested = Math.min(hashBuffer.length, expectedBytes - offset);
      const count = fs.readSync(fd, hashBuffer, 0, requested, offset);
      need(count > 0, "TRUNCATED");
      hash.update(hashBuffer.subarray(0, count));
      offset += count;
      stats.archiveHashBytes += count;
      stats.largestReadBytes = Math.max(stats.largestReadBytes, requested);
    }
    need(hash.digest("hex") === expectedSha256, "ARCHIVE_DIGEST_MISMATCH");
    stats.hashMs = performance.now() - hashBegan;
    const lookupBegan = performance.now(),
      tailSize = Math.min(expectedBytes, 65557),
      tail = read(expectedBytes - tailSize, tailSize);
    const ends = [];
    for (let offset = tail.length - 22; offset >= 0; offset--)
      if (tail.readUInt32LE(offset) === 0x06054b50 && offset + 22 + tail.readUInt16LE(offset + 20) === tail.length)
        ends.push(offset);
    need(ends.length === 1, "END_RECORD");
    const end = ends[0],
      count = tail.readUInt16LE(end + 10),
      centralSize = tail.readUInt32LE(end + 12),
      centralOffset = tail.readUInt32LE(end + 16);
    need(count !== 0xffff && centralSize !== 0xffffffff && centralOffset !== 0xffffffff, "ZIP64_UNSUPPORTED");
    need(
      tail.readUInt16LE(end + 4) === 0 && tail.readUInt16LE(end + 6) === 0 && tail.readUInt16LE(end + 8) === count,
      "SPLIT_ARCHIVE",
    );
    need(
      count > 0 &&
        count <= limits.entries &&
        centralSize <= limits.centralBytes &&
        centralOffset + centralSize === expectedBytes - tailSize + end,
      "CENTRAL_BOUND",
    );
    const central = read(centralOffset, centralSize),
      names = new Set(),
      regions = [];
    let cursor = 0,
      expanded = 0,
      selected;
    for (let index = 0; index < count; index++) {
      need(cursor + 46 <= central.length && central.readUInt32LE(cursor) === 0x02014b50, "CENTRAL_INVALID");
      const flags = central.readUInt16LE(cursor + 8),
        method = central.readUInt16LE(cursor + 10),
        crc = central.readUInt32LE(cursor + 16);
      const compressed = central.readUInt32LE(cursor + 20),
        size = central.readUInt32LE(cursor + 24),
        nameSize = central.readUInt16LE(cursor + 28);
      const extraSize = central.readUInt16LE(cursor + 30),
        commentSize = central.readUInt16LE(cursor + 32),
        attributes = central.readUInt32LE(cursor + 38),
        local = central.readUInt32LE(cursor + 42);
      const next = cursor + 46 + nameSize + extraSize + commentSize;
      need([0, 8, 0x800, 0x808].includes(flags) && [0, 8].includes(method), "ENCODING_OR_METHOD");
      need(compressed !== 0xffffffff && size !== 0xffffffff && local !== 0xffffffff, "ZIP64_UNSUPPORTED");
      need(
        next <= central.length && nameSize > 0 && nameSize <= 4096 && central.readUInt16LE(cursor + 34) === 0,
        "CENTRAL_INVALID",
      );
      expanded += size;
      need(expanded <= 8 * 1024 ** 3, "EXPANSION_BOUND");
      const rawName = central.subarray(cursor + 46, cursor + 46 + nameSize);
      need(flags & 0x800 || !rawName.some((byte) => byte > 127), "NAME_ENCODING_UNSUPPORTED");
      const name = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(rawName),
        directory = name.endsWith("/");
      const identityName = directory ? name.slice(0, -1) : name;
      need(Buffer.from(name).equals(rawName) && safe(identityName) && !names.has(identityName), "MEMBER_PATH");
      names.add(identityName);
      const mode = (attributes >>> 16) & 0xf000;
      need(
        (directory ? [0, 0x4000] : [0, 0x8000]).includes(mode) && (!(attributes & 0x10) || directory),
        "MEMBER_TYPE",
      );
      need(method !== 0 || compressed === size, "STORED_SIZE");
      extras(central.subarray(cursor + 46 + nameSize, cursor + 46 + nameSize + extraSize));
      need(local + 30 <= centralOffset, "LOCAL_RANGE");
      const header = read(local, 30);
      need(
        header.readUInt32LE(0) === 0x04034b50 && header.readUInt16LE(6) === flags && header.readUInt16LE(8) === method,
        "LOCAL_HEADER",
      );
      const localNameSize = header.readUInt16LE(26),
        localExtraSize = header.readUInt16LE(28);
      need(localNameSize === nameSize, "LOCAL_NAME");
      const details = read(local + 30, localNameSize + localExtraSize);
      need(details.subarray(0, nameSize).equals(rawName), "LOCAL_NAME");
      extras(details.subarray(nameSize));
      const start = local + 30 + localNameSize + localExtraSize,
        dataEnd = start + compressed;
      need(dataEnd <= centralOffset, "LOCAL_RANGE");
      let regionEnd = dataEnd;
      if (flags & 8) {
        need(
          [0, crc].includes(header.readUInt32LE(14)) &&
            [0, compressed].includes(header.readUInt32LE(18)) &&
            [0, size].includes(header.readUInt32LE(22)),
          "LOCAL_SIZES",
        );
        const first = read(dataEnd, 4),
          signature = first.readUInt32LE(0) === 0x08074b50,
          descriptor = read(dataEnd, signature ? 16 : 12);
        const shift = signature ? 4 : 0;
        need(
          descriptor.readUInt32LE(shift) === crc &&
            descriptor.readUInt32LE(shift + 4) === compressed &&
            descriptor.readUInt32LE(shift + 8) === size,
          "DESCRIPTOR",
        );
        regionEnd += descriptor.length;
      } else
        need(
          header.readUInt32LE(14) === crc && header.readUInt32LE(18) === compressed && header.readUInt32LE(22) === size,
          "LOCAL_SIZES",
        );
      need(regionEnd <= centralOffset, "LOCAL_RANGE");
      regions.push({ start: local, end: regionEnd });
      if (namesWanted.has(name)) {
        need(
          !selected && !directory && size <= limits.memberBytes && compressed <= limits.memberBytes,
          "MEMBER_BOUND_OR_DUPLICATE",
        );
        const payload = read(start, compressed, false);
        let bytes;
        if (method === 0) {
          need(compressed === size, "STORED_SIZE");
          bytes = payload;
        } else {
          const inflated = inflateRawSync(payload, { maxOutputLength: limits.memberBytes, info: true });
          need(inflated.engine.bytesWritten === payload.length, "DEFLATE_TRAILING_BYTES");
          bytes = inflated.buffer;
        }
        need(bytes.length === size && crc32(bytes) === crc, "MEMBER_INTEGRITY");
        selected = { name, bytes };
        stats.selectedCompressedBytes = compressed;
        stats.selectedBytes = size;
      }
      cursor = next;
    }
    regions.sort((a, b) => a.start - b.start);
    need(
      cursor === central.length &&
        regions[0].start === 0 &&
        regions.every((region, i) => region.end === (regions[i + 1]?.start ?? centralOffset)) &&
        selected,
      "REGIONS_OR_MEMBER_MISSING",
    );
    remaining();
    const after = fs.fstatSync(fd),
      finalName = fs.lstatSync(filename);
    need(
      after.dev === before.dev &&
        after.ino === before.ino &&
        after.size === before.size &&
        after.mtimeMs === before.mtimeMs &&
        after.ctimeMs === before.ctimeMs &&
        after.nlink === 1 &&
        finalName.isFile() &&
        !finalName.isSymbolicLink() &&
        finalName.dev === after.dev &&
        finalName.ino === after.ino &&
        finalName.nlink === 1,
      "SOURCE_CHANGED",
    );
    stats.lookupMs = performance.now() - lookupBegan;
    result = {
      kind: "WHOLE_ARCHIVE_MEMBER_SHADOW",
      name: selected.name,
      bytes: selected.bytes,
      archiveSha256: expectedSha256,
      measurements: stats,
      qualification: false,
      reuseAuthorized: false,
      authentication: "VERIFIED_BYTES_NOT_PROVIDER_AUTHENTICATED",
    };
  } catch (error) {
    originalError = error;
  } finally {
    if (fd !== undefined) {
      try {
        fs.closeSync(fd);
      } catch (error) {
        cleanupError = error;
      }
    }
  }
  if (originalError && cleanupError)
    throw new AggregateError(
      [originalError, cleanupError],
      "SOUNDING_LINE_ATTESTATION_SHADOW_READ_AND_CLEANUP_FAILED",
      { cause: originalError },
    );
  if (originalError) throw originalError;
  if (cleanupError) throw cleanupError;
  return result;
}
