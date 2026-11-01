// Bounded transport parsing only. Provider authentication and decryption are
// independent gates; a well-formed archive never grants evidence authority.
import { inflateRawSync } from "node:zlib";
export const ARTIFACT_REGISTRY_ARCHIVE_MAXIMUM = 9 * 1024 * 1024;
const MEMBER_MAXIMUM = 8 * 1024 * 1024;
const NAME = Buffer.from("registry-v2.encrypted");
const need = (value) => {
  if (!value) throw Error("SOUNDING_LINE_ARTIFACT_REGISTRY_ARCHIVE_INVALID");
};
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}
export function readArtifactRegistryArchive(archive) {
  try {
    need(Buffer.isBuffer(archive) && archive.length >= 22 && archive.length <= ARTIFACT_REGISTRY_ARCHIVE_MAXIMUM);
    let end = -1;
    for (let i = archive.length - 22; i >= Math.max(0, archive.length - 65557); i--)
      if (archive.readUInt32LE(i) === 0x06054b50 && i + 22 + archive.readUInt16LE(i + 20) === archive.length) {
        end = i;
        break;
      }
    need(end >= 0 && archive.readUInt16LE(end + 4) === 0 && archive.readUInt16LE(end + 6) === 0);
    need(archive.readUInt16LE(end + 8) === 1 && archive.readUInt16LE(end + 10) === 1);
    const central = archive.readUInt32LE(end + 16),
      centralSize = archive.readUInt32LE(end + 12);
    need(central + centralSize === end && central + 46 <= end && archive.readUInt32LE(central) === 0x02014b50);
    const flags = archive.readUInt16LE(central + 8),
      method = archive.readUInt16LE(central + 10);
    const crc = archive.readUInt32LE(central + 16),
      compressed = archive.readUInt32LE(central + 20),
      size = archive.readUInt32LE(central + 24);
    const nameSize = archive.readUInt16LE(central + 28),
      extraSize = archive.readUInt16LE(central + 30),
      commentSize = archive.readUInt16LE(central + 32);
    const attributes = archive.readUInt32LE(central + 38),
      type = (attributes >>> 16) & 0xf000;
    need([0, 8, 0x800, 0x808].includes(flags) && [0, 8].includes(method));
    need([0, 0x8000].includes(type) && !(attributes & 0x10));
    need(size > 0 && size <= MEMBER_MAXIMUM && compressed <= ARTIFACT_REGISTRY_ARCHIVE_MAXIMUM);
    need(nameSize === NAME.length && archive.subarray(central + 46, central + 46 + nameSize).equals(NAME));
    need(central + 46 + nameSize + extraSize + commentSize === end);
    need(archive.readUInt16LE(central + 34) === 0 && archive.readUInt32LE(central + 42) === 0);
    need(
      archive.readUInt32LE(0) === 0x04034b50 && archive.readUInt16LE(6) === flags && archive.readUInt16LE(8) === method,
    );
    const localNameSize = archive.readUInt16LE(26),
      localExtraSize = archive.readUInt16LE(28);
    need(localNameSize === NAME.length && archive.subarray(30, 30 + localNameSize).equals(NAME));
    const start = 30 + localNameSize + localExtraSize,
      dataEnd = start + compressed;
    need(dataEnd <= central);
    if (flags & 8) {
      need(
        [0, crc].includes(archive.readUInt32LE(14)) &&
          [0, compressed].includes(archive.readUInt32LE(18)) &&
          [0, size].includes(archive.readUInt32LE(22)),
      );
      need(dataEnd + 16 === central && archive.readUInt32LE(dataEnd) === 0x08074b50);
      need(
        archive.readUInt32LE(dataEnd + 4) === crc &&
          archive.readUInt32LE(dataEnd + 8) === compressed &&
          archive.readUInt32LE(dataEnd + 12) === size,
      );
    } else {
      need(
        dataEnd === central &&
          archive.readUInt32LE(14) === crc &&
          archive.readUInt32LE(18) === compressed &&
          archive.readUInt32LE(22) === size,
      );
    }
    const payload = archive.subarray(start, dataEnd);
    let bytes;
    if (method === 0) bytes = Buffer.from(payload);
    else {
      const inflated = inflateRawSync(payload, { maxOutputLength: MEMBER_MAXIMUM, info: true });
      need(inflated.engine.bytesWritten === payload.length);
      bytes = inflated.buffer;
    }
    need(bytes.length === size && crc32(bytes) === crc);
    return bytes;
  } catch {
    throw Error("SOUNDING_LINE_ARTIFACT_REGISTRY_ARCHIVE_INVALID");
  }
}
