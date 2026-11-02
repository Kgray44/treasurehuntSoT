import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import { deflateRawSync } from "node:zlib";
import {
  readAttestationArchiveShadow,
  ATTESTATION_ARCHIVE_SHADOW_LIMITS,
} from "../../scripts/sounding-line/attestation-archive-shadow.mjs";

const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
function crc32(bytes) {
  let crc = -1;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ -1) >>> 0;
}
// Independently written fixture producer. It does not import parser internals.
function zip(entries, comment = Buffer.alloc(0)) {
  const locals = [],
    central = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name),
      data = entry.data ?? Buffer.from("{}"),
      method = entry.method ?? 0;
    const payload = Buffer.concat([method === 8 ? deflateRawSync(data) : data, entry.tail ?? Buffer.alloc(0)]),
      crc = crc32(data),
      flags = 0x800 | (entry.descriptor ? 8 : 0),
      extra = entry.extra ?? Buffer.alloc(0);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(flags, 6);
    local.writeUInt16LE(method, 8);
    if (!entry.descriptor) {
      local.writeUInt32LE(crc, 14);
      local.writeUInt32LE(payload.length, 18);
      local.writeUInt32LE(data.length, 22);
    }
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(extra.length, 28);
    const descriptor = Buffer.alloc(entry.descriptor === "signed" ? 16 : entry.descriptor ? 12 : 0);
    if (descriptor.length) {
      const start = descriptor.length === 16 ? 4 : 0;
      if (start) descriptor.writeUInt32LE(0x08074b50);
      descriptor.writeUInt32LE(crc, start);
      descriptor.writeUInt32LE(payload.length, start + 4);
      descriptor.writeUInt32LE(data.length, start + 8);
    }
    const header = Buffer.alloc(46);
    header.writeUInt32LE(0x02014b50);
    header.writeUInt16LE(0x314, 4);
    header.writeUInt16LE(20, 6);
    header.writeUInt16LE(flags, 8);
    header.writeUInt16LE(method, 10);
    header.writeUInt32LE(crc, 16);
    header.writeUInt32LE(payload.length, 20);
    header.writeUInt32LE(data.length, 24);
    header.writeUInt16LE(name.length, 28);
    header.writeUInt16LE(extra.length, 30);
    header.writeUInt32LE(((entry.mode ?? 0o100644) * 65536) >>> 0, 38);
    header.writeUInt32LE(offset, 42);
    const record = Buffer.concat([local, name, extra, payload, descriptor]);
    locals.push(record);
    central.push(header, name, extra);
    offset += record.length;
  }
  const directory = Buffer.concat(central),
    end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(comment.length, 20);
  return Buffer.concat([...locals, directory, end, comment]);
}
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "attestation-shadow-"));
  t.after(() => {
    assert(path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep));
    assert(path.basename(root).startsWith("attestation-shadow-"));
    fs.rmSync(root, { recursive: true, force: true });
  });
  let ordinal = 0;
  return (bytes, extra = {}) => {
    const filename = path.join(root, `archive-${ordinal++}.zip`);
    fs.writeFileSync(filename, bytes, { flag: "wx" });
    return {
      filename,
      expectedBytes: bytes.length,
      expectedSha256: hash(bytes),
      memberNames: ["capture.json"],
      ...extra,
    };
  };
}

test("stored/deflated and signed/unsigned descriptors return exact member bytes after full archive hashing", (t) => {
  const store = fixture(t),
    data = Buffer.from('{"original":"bytes", "unicode":"é"}\n');
  for (const method of [0, 8])
    for (const descriptor of [undefined, "signed", "unsigned"]) {
      const archive = zip(
        [
          { name: "media/one.bin", data: Buffer.alloc(1024 * 1024, 5), method },
          { name: "capture.json", data, method, descriptor },
        ],
        Buffer.from("retained archive comment"),
      );
      const result = readAttestationArchiveShadow(store(archive));
      assert(result.bytes.equals(data));
      assert.equal(result.measurements.archiveHashBytes, archive.length);
      assert.equal(result.archiveSha256, hash(archive));
      assert.equal(result.name, "capture.json");
      assert.equal(result.reuseAuthorized, false);
      assert.equal(result.authentication, "VERIFIED_BYTES_NOT_PROVIDER_AUTHENTICATED");
      assert(result.measurements.largestReadBytes <= 1024 * 1024);
    }
});

test("wrong whole-archive digest rejects before any selected member can be returned", (t) => {
  const store = fixture(t),
    archive = zip([{ name: "capture.json" }]);
  assert.throws(
    () => readAttestationArchiveShadow(store(archive, { expectedSha256: "0".repeat(64) })),
    /ARCHIVE_DIGEST_MISMATCH/u,
  );
});

test("duplicate names, aliases, traversal, symlinks and non-file selected entries are rejected", (t) => {
  const store = fixture(t);
  for (const entries of [
    [{ name: "capture.json" }, { name: "capture.json" }],
    [{ name: "capture.json" }, { name: "artifacts/sounding-line/product-experience-submission/capture.json" }],
    [{ name: "../capture.json" }],
    [{ name: "/capture.json" }],
    [{ name: "C:/capture.json" }],
    [{ name: "folder\\capture.json" }],
    [{ name: "capture.json", mode: 0o120777 }],
    [{ name: "capture.json", mode: 0o40755 }],
    [{ name: "capture.json" }, { name: "capture.json/", mode: 0o40755, data: Buffer.alloc(0) }],
  ])
    assert.throws(() =>
      readAttestationArchiveShadow(
        store(zip(entries), {
          memberNames: ["capture.json", "artifacts/sounding-line/product-experience-submission/capture.json"],
        }),
      ),
    );
});

test("central/local disagreement, CRC damage, descriptors, hidden gaps and trailing bytes fail closed", (t) => {
  const store = fixture(t),
    original = zip([{ name: "capture.json", data: Buffer.from("original"), descriptor: "signed" }]);
  const mutations = [
    (bytes) => {
      bytes[30] ^= 1;
    },
    (bytes) => {
      const central = bytes.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
      bytes.writeUInt32LE(0, central + 16);
    },
    (bytes) => {
      const descriptor = bytes.indexOf(Buffer.from([0x50, 0x4b, 0x07, 0x08]));
      bytes[descriptor + 8] ^= 1;
    },
    (bytes) => {
      const central = bytes.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
      bytes.writeUInt32LE(1, central + 42);
    },
  ];
  for (const mutate of mutations) {
    const archive = Buffer.from(original);
    mutate(archive);
    assert.throws(() => readAttestationArchiveShadow(store(archive)));
  }
  assert.throws(() => readAttestationArchiveShadow(store(Buffer.concat([original, Buffer.from("hidden")]))));
  assert.throws(() => readAttestationArchiveShadow(store(original.subarray(0, original.length - 3))));
  assert.throws(
    () =>
      readAttestationArchiveShadow(store(zip([{ name: "capture.json", method: 8, tail: Buffer.from("unconsumed") }]))),
    /DEFLATE_TRAILING_BYTES/u,
  );
});

test("ZIP64 markers, unbounded metadata and inflated member declarations are explicit failures", (t) => {
  const store = fixture(t);
  const zip64Extra = zip([{ name: "capture.json", extra: Buffer.from([1, 0, 0, 0]) }]);
  assert.throws(() => readAttestationArchiveShadow(store(zip64Extra)), /ZIP64_UNSUPPORTED/u);
  const marker = zip([{ name: "capture.json" }]);
  marker.writeUInt32LE(0xffffffff, marker.length - 22 + 16);
  assert.throws(() => readAttestationArchiveShadow(store(marker)), /ZIP64_UNSUPPORTED/u);
  const large = zip([
    { name: "capture.json", data: Buffer.alloc(ATTESTATION_ARCHIVE_SHADOW_LIMITS.memberBytes + 1), method: 8 },
  ]);
  assert.throws(() => readAttestationArchiveShadow(store(large)), /MEMBER_BOUND/u);
  const archive = zip([{ name: "capture.json" }]);
  archive.writeUInt32LE(ATTESTATION_ARCHIVE_SHADOW_LIMITS.centralBytes + 1, archive.length - 22 + 12);
  assert.throws(() => readAttestationArchiveShadow(store(archive)), /CENTRAL_BOUND/u);
});

test("large-offset corruption cannot wrap through signed 2 GiB or 4 GiB arithmetic", (t) => {
  const store = fixture(t);
  for (const offset of [0x7fffffff, 0x80000000, 0xfffffffe]) {
    const archive = zip([{ name: "capture.json" }]);
    archive.writeUInt32LE(offset, archive.length - 22 + 16);
    assert.throws(() => readAttestationArchiveShadow(store(archive)), /CENTRAL_BOUND/u);
  }
  assert.throws(
    () =>
      readAttestationArchiveShadow(
        store(zip([{ name: "capture.json" }]), { expectedBytes: ATTESTATION_ARCHIVE_SHADOW_LIMITS.archiveBytes + 1 }),
      ),
    /ARCHIVE_BOUND/u,
  );
});

test("hard-linked source files cannot acquire archive custody", (t) => {
  const store = fixture(t),
    input = store(zip([{ name: "capture.json" }]));
  fs.linkSync(input.filename, input.filename + ".alias");
  assert.throws(() => readAttestationArchiveShadow(input), /FILE_IDENTITY/u);
});

test("a native read error and a separate close error both retain their original identities", (t) => {
  const store = fixture(t),
    input = store(zip([{ name: "capture.json" }]));
  const originalRead = fs.readSync,
    originalClose = fs.closeSync;
  const readError = Error("original native read failure"),
    closeError = Error("original close failure");
  let caught;
  try {
    fs.readSync = () => {
      throw readError;
    };
    fs.closeSync = (fd) => {
      originalClose(fd);
      throw closeError;
    };
    try {
      readAttestationArchiveShadow(input);
    } catch (error) {
      caught = error;
    }
  } finally {
    fs.readSync = originalRead;
    fs.closeSync = originalClose;
  }
  assert(caught instanceof AggregateError);
  assert.equal(caught.errors[0], readError);
  assert.equal(caught.errors[1], closeError);
  assert.equal(caught.cause, readError);
});
