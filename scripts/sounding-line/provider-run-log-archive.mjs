// Read one fixed native step log without extraction. Parsing bytes grants no
// provider authenticity, receipt admission, qualification or reuse authority.
import { inflateRawSync } from "node:zlib";
const TARGET = "Sounding Line _ Focused verification/2_Bind the event to exact source identities.txt";
export const PROVIDER_RUN_LOG_ARCHIVE_MAXIMUM = 8 * 1024 * 1024;
const SELECTED_MAXIMUM = 16384;
const need = (condition) => {
  if (!condition) throw Error("SOUNDING_LINE_PROVIDER_RUN_LOG_ARCHIVE_INVALID");
};
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function extras(archive, start, length) {
  const end = start + length;
  need(end <= archive.length);
  while (start < end) {
    need(start + 4 <= end);
    const id = archive.readUInt16LE(start),
      size = archive.readUInt16LE(start + 2);
    need(id !== 1 && start + 4 + size <= end);
    start += 4 + size;
  }
  need(start === end);
}
export function readOriginalEventStepLog(archive) {
  try {
    need(Buffer.isBuffer(archive) && archive.length >= 22 && archive.length <= PROVIDER_RUN_LOG_ARCHIVE_MAXIMUM);
    let end = -1;
    for (let i = archive.length - 22; i >= Math.max(0, archive.length - 65557); i--)
      if (archive.readUInt32LE(i) === 0x06054b50 && i + 22 + archive.readUInt16LE(i + 20) === archive.length) {
        end = i;
        break;
      }
    need(end >= 0 && archive.readUInt16LE(end + 4) === 0 && archive.readUInt16LE(end + 6) === 0);
    const count = archive.readUInt16LE(end + 10),
      central = archive.readUInt32LE(end + 16),
      centralSize = archive.readUInt32LE(end + 12);
    need(count > 0 && count <= 512 && archive.readUInt16LE(end + 8) === count && central + centralSize === end);
    let cursor = central,
      expanded = 0,
      selected;
    const names = new Set(),
      regions = [];
    for (let index = 0; index < count; index++) {
      need(cursor + 46 <= end && archive.readUInt32LE(cursor) === 0x02014b50);
      const flags = archive.readUInt16LE(cursor + 8),
        method = archive.readUInt16LE(cursor + 10),
        crc = archive.readUInt32LE(cursor + 16);
      const compressed = archive.readUInt32LE(cursor + 20),
        size = archive.readUInt32LE(cursor + 24),
        nameSize = archive.readUInt16LE(cursor + 28),
        extraSize = archive.readUInt16LE(cursor + 30),
        commentSize = archive.readUInt16LE(cursor + 32),
        attributes = archive.readUInt32LE(cursor + 38),
        local = archive.readUInt32LE(cursor + 42);
      const next = cursor + 46 + nameSize + extraSize + commentSize;
      expanded += size;
      need(
        [0, 8, 0x800, 0x808].includes(flags) &&
          [0, 8].includes(method) &&
          [0, 0x8000].includes((attributes >>> 16) & 0xf000) &&
          !(attributes & 0x10),
      );
      need(
        archive.readUInt16LE(cursor + 34) === 0 &&
          next <= end &&
          nameSize > 0 &&
          nameSize <= 1024 &&
          expanded <= 64 * 1024 * 1024 &&
          compressed <= PROVIDER_RUN_LOG_ARCHIVE_MAXIMUM,
      );
      const rawName = archive.subarray(cursor + 46, cursor + 46 + nameSize),
        name = new TextDecoder("utf-8", { fatal: true }).decode(rawName);
      need(
        Buffer.from(name).equals(rawName) &&
          !name.includes("\\") &&
          !name.includes("\0") &&
          !name.includes(":") &&
          !name.startsWith("/") &&
          name.split("/").every((part) => part && part !== "." && part !== "..") &&
          !names.has(name),
      );
      names.add(name);
      extras(archive, cursor + 46 + nameSize, extraSize);
      need(
        local + 30 <= central &&
          archive.readUInt32LE(local) === 0x04034b50 &&
          archive.readUInt16LE(local + 6) === flags &&
          archive.readUInt16LE(local + 8) === method,
      );
      const localNameSize = archive.readUInt16LE(local + 26),
        localExtraSize = archive.readUInt16LE(local + 28);
      need(localNameSize === nameSize && archive.subarray(local + 30, local + 30 + localNameSize).equals(rawName));
      extras(archive, local + 30 + localNameSize, localExtraSize);
      const start = local + 30 + localNameSize + localExtraSize,
        dataEnd = start + compressed,
        regionEnd = dataEnd + (flags & 8 ? 16 : 0);
      need(regionEnd <= central);
      if (flags & 8) {
        need(
          [0, crc].includes(archive.readUInt32LE(local + 14)) &&
            [0, compressed].includes(archive.readUInt32LE(local + 18)) &&
            [0, size].includes(archive.readUInt32LE(local + 22)),
        );
        need(
          archive.readUInt32LE(dataEnd) === 0x08074b50 &&
            archive.readUInt32LE(dataEnd + 4) === crc &&
            archive.readUInt32LE(dataEnd + 8) === compressed &&
            archive.readUInt32LE(dataEnd + 12) === size,
        );
      } else
        need(
          archive.readUInt32LE(local + 14) === crc &&
            archive.readUInt32LE(local + 18) === compressed &&
            archive.readUInt32LE(local + 22) === size,
        );
      regions.push({ start: local, end: regionEnd });
      if (name === TARGET) {
        need(selected === undefined && size > 0 && size <= SELECTED_MAXIMUM && compressed <= 65536);
        const payload = archive.subarray(start, dataEnd);
        if (method === 0) {
          need(compressed === size);
          selected = Buffer.from(payload);
        } else {
          const inflated = inflateRawSync(payload, { maxOutputLength: SELECTED_MAXIMUM, info: true });
          need(inflated.engine.bytesWritten === payload.length);
          selected = inflated.buffer;
        }
        need(selected.length === size && crc32(selected) === crc);
      }
      cursor = next;
    }
    regions.sort((a, b) => a.start - b.start);
    need(
      cursor === end &&
        regions[0].start === 0 &&
        regions.every((region, index) => region.end === (regions[index + 1]?.start ?? central)) &&
        selected !== undefined,
    );
    return selected;
  } catch {
    throw Error("SOUNDING_LINE_PROVIDER_RUN_LOG_ARCHIVE_INVALID");
  }
}
