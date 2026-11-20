// Bounded random-access ZIP/ZIP64 validation. No archive path is ever extracted.
import { constants as F, closeSync, fstatSync, lstatSync, openSync, readSync } from "node:fs";
import { inflateRawSync } from "node:zlib";
import { createHash } from "node:crypto";

const fail = (code) => {
  throw new Error(`PRIVATE_CAPTURE_ARCHIVE_${code}`);
};
const signature = (bytes, offset, expected) =>
  offset >= 0 && offset + 4 <= bytes.length && bytes.readUInt32LE(offset) === expected;
const table = Uint32Array.from({ length: 256 }, (_, i) => {
  let value = i;
  for (let j = 0; j < 8; j++) value = (value >>> 1) ^ (0xedb88320 & -(value & 1));
  return value >>> 0;
});
export function privateArchiveCRC32(bytes, checkDeadline = () => {}) {
  let value = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    if (i % 262144 === 0) checkDeadline();
    value = (value >>> 8) ^ table[(value ^ bytes[i]) & 255];
  }
  return (value ^ 0xffffffff) >>> 0;
}
const identity = (s) => [s.dev, s.ino, s.size, s.mtimeMs, s.ctimeMs, s.nlink].join(":");
function number64(bytes, offset) {
  if (offset < 0 || offset + 8 > bytes.length) fail("ZIP64_INVALID");
  const value = bytes.readBigUInt64LE(offset);
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) fail("ZIP64_INVALID");
  return Number(value);
}
function extraFields(bytes) {
  const result = new Map();
  let offset = 0;
  while (offset < bytes.length) {
    if (offset + 4 > bytes.length) fail("EXTRA_INVALID");
    const tag = bytes.readUInt16LE(offset),
      size = bytes.readUInt16LE(offset + 2);
    offset += 4;
    if (offset + size > bytes.length || result.has(tag) || ![1, 0x5455, 0x000a].includes(tag)) fail("EXTRA_INVALID");
    result.set(tag, bytes.subarray(offset, offset + size));
    offset += size;
  }
  return result;
}
function sizes64(extra, fields) {
  const bytes = extra.get(1);
  let offset = 0;
  const result = {};
  for (const [name, value] of fields) {
    if (value !== 0xffffffff) {
      result[name] = value;
      continue;
    }
    if (!bytes) fail("ZIP64_INVALID");
    result[name] = number64(bytes, offset);
    offset += 8;
  }
  if (bytes && offset !== bytes.length) fail("ZIP64_INVALID");
  return result;
}
export function openPrivateCaptureArchive({ archivePath, limits, signal, expectedDigest, checkDeadline = () => {} }) {
  const descriptor = openSync(archivePath, F.O_RDONLY | F.O_NOFOLLOW),
    initial = fstatSync(descriptor);
  let closed = false;
  const check = () => {
    signal?.throwIfAborted();
    checkDeadline();
    if (
      closed ||
      !initial.isFile() ||
      initial.nlink !== 1 ||
      identity(fstatSync(descriptor)) !== identity(initial) ||
      identity(lstatSync(archivePath)) !== identity(initial)
    )
      fail("FILE_CHANGED");
  };
  const close = () => {
    if (!closed) {
      closed = true;
      closeSync(descriptor);
    }
  };
  const range = (offset, size, cap) => {
    check();
    if (
      ![offset, size, cap].every(Number.isSafeInteger) ||
      offset < 0 ||
      size < 0 ||
      size > cap ||
      offset + size > initial.size
    )
      fail("RANGE_INVALID");
    const bytes = Buffer.alloc(size);
    let consumed = 0;
    while (consumed < size) {
      signal?.throwIfAborted();
      checkDeadline();
      const read = readSync(descriptor, bytes, consumed, Math.min(1048576, size - consumed), offset + consumed);
      if (!read) fail("TRUNCATED");
      consumed += read;
    }
    check();
    return bytes;
  };
  try {
    if (initial.size < 22 || initial.size > limits.archiveBytes) fail("ARCHIVE_LIMIT");
    if (expectedDigest !== undefined) {
      if (!/^sha256:[a-f0-9]{64}$/u.test(expectedDigest)) fail("DIGEST_INVALID");
      const digest = createHash("sha256");
      for (let offset = 0; offset < initial.size; offset += 1048576)
        digest.update(range(offset, Math.min(1048576, initial.size - offset), 1048576));
      if (`sha256:${digest.digest("hex")}` !== expectedDigest) fail("DIGEST_MISMATCH");
    }
    const tailStart = Math.max(0, initial.size - 65557),
      tail = range(tailStart, initial.size - tailStart, 65557);
    let eocd = -1;
    for (let i = tail.length - 22; i >= 0; i--)
      if (signature(tail, i, 0x06054b50) && i + 22 + tail.readUInt16LE(i + 20) === tail.length) {
        eocd = i;
        break;
      }
    if (eocd < 0 || tail.readUInt16LE(eocd + 4) || tail.readUInt16LE(eocd + 6) || tail.readUInt16LE(eocd + 20))
      fail("EOCD_INVALID");
    const end = tailStart + eocd;
    let count = tail.readUInt16LE(eocd + 10),
      centralBytes = tail.readUInt32LE(eocd + 12),
      centralStart = tail.readUInt32LE(eocd + 16),
      centralEnd = end;
    if (tail.readUInt16LE(eocd + 8) !== count) fail("MULTIDISK_UNSUPPORTED");
    const zip64 = count === 0xffff || centralBytes === 0xffffffff || centralStart === 0xffffffff;
    if (zip64) {
      const locator = range(end - 20, 20, 20);
      if (!signature(locator, 0, 0x07064b50) || locator.readUInt32LE(4) || locator.readUInt32LE(16) !== 1)
        fail("ZIP64_INVALID");
      const start = number64(locator, 8),
        header = range(start, 56, 56);
      if (
        !signature(header, 0, 0x06064b50) ||
        number64(header, 4) !== 44 ||
        start + 56 !== end - 20 ||
        header.readUInt32LE(16) ||
        header.readUInt32LE(20) ||
        number64(header, 24) !== number64(header, 32)
      )
        fail("ZIP64_INVALID");
      const count64 = number64(header, 32),
        bytes64 = number64(header, 40),
        start64 = number64(header, 48);
      if (
        (count !== 0xffff && count !== count64) ||
        (centralBytes !== 0xffffffff && centralBytes !== bytes64) ||
        (centralStart !== 0xffffffff && centralStart !== start64)
      )
        fail("ZIP64_INVALID");
      count = count64;
      centralBytes = bytes64;
      centralStart = start64;
      centralEnd = start;
    }
    if (count < 3 || count > 4610 || centralBytes > 4194304 || centralStart + centralBytes !== centralEnd)
      fail("CENTRAL_LIMIT");
    const central = range(centralStart, centralBytes, 4194304),
      entries = new Map();
    let cursor = 0,
      expanded = 0;
    for (let i = 0; i < count; i++) {
      signal?.throwIfAborted();
      checkDeadline();
      if (!signature(central, cursor, 0x02014b50) || cursor + 46 > central.length) fail("CENTRAL_INVALID");
      const flags = central.readUInt16LE(cursor + 8),
        method = central.readUInt16LE(cursor + 10),
        crc = central.readUInt32LE(cursor + 16);
      const nameBytes = central.readUInt16LE(cursor + 28),
        extraBytes = central.readUInt16LE(cursor + 30),
        commentBytes = central.readUInt16LE(cursor + 32);
      const next = cursor + 46 + nameBytes + extraBytes + commentBytes,
        attributes = central.readUInt32LE(cursor + 38);
      if (
        next > central.length ||
        nameBytes > 64 ||
        extraBytes > 1024 ||
        commentBytes ||
        central.readUInt16LE(cursor + 34) ||
        ![0, 8, 0x800, 0x808].includes(flags) ||
        ![0, 8].includes(method) ||
        ![0, 0x8000].includes((attributes >>> 16) & 0xf000) ||
        attributes & 0x10
      )
        fail("MEMBER_INVALID");
      const nameBuffer = central.subarray(cursor + 46, cursor + 46 + nameBytes),
        name = nameBuffer.toString("ascii");
      if (
        !nameBuffer.equals(Buffer.from(name, "ascii")) ||
        !/^(?:part-[0-9]{6}\.encrypted|index\.encrypted|retention\.json)$/u.test(name) ||
        entries.has(name)
      )
        fail("MEMBER_INVALID");
      const extra = extraFields(central.subarray(cursor + 46 + nameBytes, cursor + 46 + nameBytes + extraBytes));
      const rawCompressed = central.readUInt32LE(cursor + 20),
        rawBytes = central.readUInt32LE(cursor + 24),
        rawLocal = central.readUInt32LE(cursor + 42);
      const { bytes, compressed, local } = sizes64(extra, [
        ["bytes", rawBytes],
        ["compressed", rawCompressed],
        ["local", rawLocal],
      ]);
      const memberLimit = name === "retention.json" ? limits.receiptBytes : limits.partBytes;
      expanded += bytes;
      if (
        bytes < 1 ||
        bytes > memberLimit ||
        compressed < 1 ||
        compressed > limits.partBytes + 1048576 ||
        expanded > limits.encryptedBytes + limits.receiptBytes ||
        local + 30 > centralStart
      )
        fail("EXPANSION_LIMIT");
      const header = range(local, 30, 30),
        localNameBytes = header.readUInt16LE(26),
        localExtraBytes = header.readUInt16LE(28);
      if (
        !signature(header, 0, 0x04034b50) ||
        header.readUInt16LE(6) !== flags ||
        header.readUInt16LE(8) !== method ||
        localNameBytes !== nameBytes ||
        localExtraBytes > 1024
      )
        fail("LOCAL_INVALID");
      const variable = range(local + 30, localNameBytes + localExtraBytes, 1088);
      if (!variable.subarray(0, localNameBytes).equals(nameBuffer)) fail("LOCAL_INVALID");
      const localExtra = extraFields(variable.subarray(localNameBytes));
      const localRawBytes = header.readUInt32LE(22),
        localRawCompressed = header.readUInt32LE(18);
      const localSizes = sizes64(localExtra, [
        ["bytes", localRawBytes],
        ["compressed", localRawCompressed],
      ]);
      const start = local + 30 + localNameBytes + localExtraBytes;
      let finish = start + compressed;
      if (flags & 8) {
        if (
          ![0, crc].includes(header.readUInt32LE(14)) ||
          ![0, bytes].includes(localSizes.bytes) ||
          ![0, compressed].includes(localSizes.compressed)
        )
          fail("LOCAL_INVALID");
        const wide = rawBytes === 0xffffffff || rawCompressed === 0xffffffff;
        const descriptorBytes = range(finish, wide ? 24 : 16, 24);
        if (
          !signature(descriptorBytes, 0, 0x08074b50) ||
          descriptorBytes.readUInt32LE(4) !== crc ||
          (wide ? number64(descriptorBytes, 8) : descriptorBytes.readUInt32LE(8)) !== compressed ||
          (wide ? number64(descriptorBytes, 16) : descriptorBytes.readUInt32LE(12)) !== bytes
        )
          fail("DESCRIPTOR_INVALID");
        finish += descriptorBytes.length;
      } else if (header.readUInt32LE(14) !== crc || localSizes.bytes !== bytes || localSizes.compressed !== compressed)
        fail("LOCAL_INVALID");
      if (finish > centralStart) fail("OVERLAP");
      entries.set(name, { local, start, finish, compressed, bytes, method, crc });
      cursor = next;
    }
    if (cursor !== central.length) fail("CENTRAL_INVALID");
    const regions = [...entries.values()].sort((a, b) => a.local - b.local);
    if (regions[0].local !== 0 || regions.some((entry, i) => entry.finish !== (regions[i + 1]?.local ?? centralStart)))
      fail("OVERLAP");
    function read(name) {
      const entry = entries.get(name);
      if (!entry) fail("MEMBER_MISSING");
      const compressed = range(entry.start, entry.compressed, limits.partBytes + 1048576);
      let bytes;
      try {
        if (entry.method === 0) bytes = compressed;
        else {
          check();
          const result = inflateRawSync(compressed, { maxOutputLength: entry.bytes, info: true });
          check();
          if (result.engine.bytesWritten !== compressed.length) fail("DEFLATE_TRAILING_DATA");
          bytes = result.buffer;
        }
      } catch {
        fail("DEFLATE_INVALID");
      }
      if (bytes.length !== entry.bytes || privateArchiveCRC32(bytes, checkDeadline) !== entry.crc)
        fail("CRC_OR_SIZE_INVALID");
      check();
      return bytes;
    }
    // Authenticate CRC and actual expanded sizes for every member before exposure.
    for (const name of entries.keys()) read(name);
    let receipt;
    try {
      receipt = JSON.parse(read("retention.json"));
    } catch {
      fail("RECEIPT_INVALID");
    }
    if (!Number.isSafeInteger(receipt.partCount) || receipt.partCount < 1 || receipt.partCount > 4608)
      fail("MEMBER_CLOSURE_INVALID");
    const names = Array.from(
      { length: receipt.partCount },
      (_, i) => `part-${String(i + 1).padStart(6, "0")}.encrypted`,
    ).concat("index.encrypted", "retention.json");
    if (names.length !== entries.size || names.some((name) => !entries.has(name))) fail("MEMBER_CLOSURE_INVALID");
    class VerifiedEntries extends Map {
      constructor() {
        super(names.map((name) => [name, null]));
      }
      get(name) {
        return read(name);
      }
      set() {
        fail("IMMUTABLE_MEMBERS");
      }
      delete() {
        fail("IMMUTABLE_MEMBERS");
      }
      clear() {
        fail("IMMUTABLE_MEMBERS");
      }
    }
    // Map's constructor calls set, so populate through Map.prototype directly.
    const indexed = new Map(names.map((name) => [name, null]));
    Object.setPrototypeOf(indexed, VerifiedEntries.prototype);
    check();
    return Object.freeze({ entries: indexed, close, archiveBytes: initial.size, zip64 });
  } catch (error) {
    close();
    throw error;
  }
}
