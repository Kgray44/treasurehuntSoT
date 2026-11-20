// File-backed intake for the existing artifact verifier. This is not the held
// private-media prototype: no decryption, extraction, upload or native admission.
import { createHash, randomUUID } from "node:crypto";
import { constants, lstat, mkdir, open, realpath, rmdir, statfs, unlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createInflateRaw, inflateRawSync } from "node:zlib";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { capacityBinding, EXPERIENCE_INTAKE_LIMITS, EXPERIENCE_STORAGE_RESERVE } from "./experience-capacity.mjs";

const fail = (code) => {
  throw new Error(`PRODUCT_EXPERIENCE_INTAKE_${code}`);
};
const identity = (s) => [s.dev, s.ino, s.size, s.mtimeMs, s.ctimeMs, s.nlink].join(":");
const sameObject = (a, b) => a.dev === b.dev && a.ino === b.ino;
const table = Uint32Array.from({ length: 256 }, (_, i) => {
  let value = i;
  for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ (0xedb88320 & -(value & 1));
  return value >>> 0;
});
function crc32(bytes, check) {
  let value = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    if (i % 262144 === 0) check();
    value = (value >>> 8) ^ table[(value ^ bytes[i]) & 255];
  }
  return (value ^ 0xffffffff) >>> 0;
}
function cleanupError(primary, error) {
  return primary
    ? new AggregateError([primary, error], "PRODUCT_EXPERIENCE_INTAKE_CLEANUP_FAILED", { cause: primary })
    : error;
}
function bounded(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("PRODUCT_EXPERIENCE_INTAKE_CLEANUP_TIMEOUT")), ms);
    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
function during(promise, signal) {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    Promise.resolve(promise)
      .then(resolve, reject)
      .finally(() => signal.removeEventListener("abort", abort));
  });
}
async function dispose(response, ms) {
  if (response?.body) {
    if (response.body.locked) fail("CLEANUP_BODY_LOCKED");
    await bounded(response.body.cancel(), ms);
  }
}
export async function intakeResponse(request, signal, cleanupMs = EXPERIENCE_INTAKE_LIMITS.cleanupMs) {
  signal.throwIfAborted();
  const pending = Promise.resolve().then(() => request(signal));
  try {
    return await during(pending, signal);
  } catch (error) {
    if (signal.aborted) {
      // An ignored signal does not terminate a request. Await bounded disposal;
      // an unresolved request remains an explicit cleanup failure. Its observer
      // stays registered for any eventual body, with rejection observed.
      const disposal = pending.then(
        (response) => dispose(response, cleanupMs),
        () => {},
      );
      try {
        await bounded(disposal, cleanupMs);
      } catch (cleanup) {
        throw cleanupError(error, cleanup);
      }
    }
    throw error;
  }
}
export async function readBoundedArtifactMetadata(response, signal, maximum = EXPERIENCE_INTAKE_LIMITS.metadataBytes) {
  if (!Number.isSafeInteger(maximum) || maximum < 1 || maximum > EXPERIENCE_INTAKE_LIMITS.metadataBytes)
    fail("LIMIT_INVALID");
  let reader, primary, result;
  try {
    if (!response.ok || !response.body || ![null, "identity"].includes(response.headers.get("content-encoding")))
      fail("METADATA_RESPONSE_INVALID");
    reader = response.body.getReader();
    const parts = [];
    let bytes = 0;
    while (true) {
      const item = await during(reader.read(), signal);
      if (item.done) break;
      if (item.value.byteLength > EXPERIENCE_INTAKE_LIMITS.chunkBytes || bytes + item.value.byteLength > maximum)
        fail("METADATA_LIMIT");
      bytes += item.value.byteLength;
      parts.push(Buffer.from(item.value));
    }
    result = JSON.parse(Buffer.concat(parts));
  } catch (error) {
    primary = error;
  }
  const failures = [];
  if (reader) {
    try {
      await bounded(reader.cancel(), EXPERIENCE_INTAKE_LIMITS.cleanupMs);
    } catch (error) {
      failures.push(error);
    }
    try {
      reader.releaseLock();
    } catch (error) {
      failures.push(error);
    }
  } else
    try {
      await dispose(response, EXPERIENCE_INTAKE_LIMITS.cleanupMs);
    } catch (error) {
      failures.push(error);
    }
  if (failures.length)
    throw new AggregateError([...(primary ? [primary] : []), ...failures], "PRODUCT_EXPERIENCE_INTAKE_CLEANUP_FAILED", {
      cause: primary ?? failures[0],
    });
  if (primary) throw primary;
  signal.throwIfAborted();
  return result;
}
export async function storageSnapshot(root) {
  const volumes = os.platform() === "win32" ? ["C:/", "D:/"] : [root];
  const rows = [];
  for (const volume of volumes) {
    const s = await statfs(volume, { bigint: true }),
      free = s.bavail * s.bsize;
    if (free > BigInt(Number.MAX_SAFE_INTEGER)) fail("FREE_BYTES_INVALID");
    rows.push({
      volume,
      freeBytes: Number(free),
      reserveBytes: os.platform() === "win32" ? EXPERIENCE_STORAGE_RESERVE : 0,
      writes:
        os.platform() !== "win32" ||
        path.parse(root).root.toUpperCase() === path.parse(path.resolve(volume)).root.toUpperCase(),
    });
  }
  if (!rows.some((row) => row.writes)) fail("VOLUME_UNSUPPORTED");
  return rows;
}
const LOCAL_MEDIA_LIMITS = Object.freeze({ ...EXPERIENCE_INTAKE_LIMITS, timeoutMs: 900000 });
function narrowLimits(overrides = {}, ceilings = EXPERIENCE_INTAKE_LIMITS) {
  const limits = { ...ceilings, ...overrides };
  for (const [name, value] of Object.entries(limits))
    if (
      !Object.hasOwn(EXPERIENCE_INTAKE_LIMITS, name) ||
      !Number.isSafeInteger(value) ||
      value < 1 ||
      value > ceilings[name]
    )
      fail("LIMIT_INVALID");
  return Object.freeze(limits);
}
const size64 = (bytes, offset) => {
  if (offset < 0 || offset + 8 > bytes.length) fail("ZIP64_INVALID");
  const n = bytes.readBigUInt64LE(offset);
  if (n > BigInt(Number.MAX_SAFE_INTEGER)) fail("ZIP64_INVALID");
  return Number(n);
};
function wideValues(extra, fields) {
  let at = 0,
    wide;
  while (at < extra.length) {
    if (at + 4 > extra.length) fail("ZIP_EXTRA_INVALID");
    const id = extra.readUInt16LE(at),
      n = extra.readUInt16LE(at + 2);
    at += 4;
    if (at + n > extra.length) fail("ZIP_EXTRA_INVALID");
    if (id === 1) {
      if (wide) fail("ZIP64_INVALID");
      wide = extra.subarray(at, at + n);
    }
    at += n;
  }
  const result = {};
  let cursor = 0;
  for (const [key, value] of fields) {
    if (value !== 0xffffffff) result[key] = value;
    else {
      if (!wide) fail("ZIP64_INVALID");
      result[key] = size64(wide, cursor);
      cursor += 8;
    }
  }
  if (wide && cursor !== wide.length) fail("ZIP64_INVALID");
  return result;
}
async function manifestReader({ file, archivePath, pin, limits, check }) {
  const checkIdentity = async () => {
    check();
    const current = await file.stat(),
      named = await lstat(archivePath);
    if (
      !current.isFile() ||
      current.nlink !== 1 ||
      named.isSymbolicLink() ||
      identity(current) !== identity(pin) ||
      identity(named) !== identity(pin)
    )
      fail("FILE_CHANGED");
  };
  const range = async (offset, size, cap) => {
    await checkIdentity();
    if (
      ![offset, size, cap].every(Number.isSafeInteger) ||
      offset < 0 ||
      size < 0 ||
      size > cap ||
      offset + size > pin.size
    )
      fail("ZIP_RANGE_INVALID");
    const bytes = Buffer.alloc(size);
    let used = 0;
    while (used < size) {
      check();
      const r = await file.read(bytes, used, Math.min(limits.chunkBytes, size - used), offset + used);
      if (!r.bytesRead) fail("ZIP_TRUNCATED");
      used += r.bytesRead;
    }
    await checkIdentity();
    return bytes;
  };
  // Rehash the actual opened file; do not authenticate a caller supplied path or
  // a stream digest after reopening a potentially replaced pathname.
  const digest = createHash("sha256");
  for (let at = 0; at < pin.size; at += limits.chunkBytes)
    digest.update(await range(at, Math.min(limits.chunkBytes, pin.size - at), limits.chunkBytes));
  const verifiedDigest = `sha256:${digest.digest("hex")}`;
  let catalog;
  const readCatalog = async () => {
    await checkIdentity();
    if (catalog) return catalog;
    const tailSize = Math.min(pin.size, 65557),
      tail = await range(pin.size - tailSize, tailSize, 65557);
    let end = -1;
    for (let i = tail.length - 22; i >= 0; i--)
      if (tail.readUInt32LE(i) === 0x06054b50 && i + 22 + tail.readUInt16LE(i + 20) === tail.length) {
        end = i;
        break;
      }
    if (
      end < 0 ||
      tail.readUInt16LE(end + 4) ||
      tail.readUInt16LE(end + 6) ||
      tail.readUInt16LE(end + 8) !== tail.readUInt16LE(end + 10)
    )
      fail("ZIP_END_INVALID");
    let count = tail.readUInt16LE(end + 10),
      centralBytes = tail.readUInt32LE(end + 12),
      centralStart = tail.readUInt32LE(end + 16),
      centralEnd = pin.size - tailSize + end;
    if (count === 65535 || centralBytes === 0xffffffff || centralStart === 0xffffffff) {
      const locator = await range(centralEnd - 20, 20, 20);
      if (locator.readUInt32LE(0) !== 0x07064b50 || locator.readUInt32LE(4) || locator.readUInt32LE(16) !== 1)
        fail("ZIP64_INVALID");
      const wideStart = size64(locator, 8),
        wide = await range(wideStart, 56, 56);
      if (
        wide.readUInt32LE(0) !== 0x06064b50 ||
        size64(wide, 4) !== 44 ||
        wideStart + 56 !== centralEnd - 20 ||
        wide.readUInt32LE(16) ||
        wide.readUInt32LE(20) ||
        size64(wide, 24) !== size64(wide, 32)
      )
        fail("ZIP64_INVALID");
      const n = size64(wide, 32),
        s = size64(wide, 40),
        o = size64(wide, 48);
      if (
        (count !== 65535 && count !== n) ||
        (centralBytes !== 0xffffffff && centralBytes !== s) ||
        (centralStart !== 0xffffffff && centralStart !== o)
      )
        fail("ZIP64_INVALID");
      count = n;
      centralBytes = s;
      centralStart = o;
      centralEnd = wideStart;
    }
    if (
      count < 1 ||
      count > limits.members ||
      centralBytes > limits.centralBytes ||
      centralStart + centralBytes !== centralEnd
    )
      fail("ZIP_CENTRAL_LIMIT");
    const central = await range(centralStart, centralBytes, limits.centralBytes),
      names = new Set(),
      regions = [],
      entries = [];
    let cursor = 0,
      expanded = 0;
    for (let i = 0; i < count; i++) {
      check();
      if (cursor + 46 > central.length || central.readUInt32LE(cursor) !== 0x02014b50) fail("ZIP_CENTRAL_INVALID");
      const flags = central.readUInt16LE(cursor + 8),
        method = central.readUInt16LE(cursor + 10),
        crc = central.readUInt32LE(cursor + 16),
        nameSize = central.readUInt16LE(cursor + 28),
        extraSize = central.readUInt16LE(cursor + 30),
        commentSize = central.readUInt16LE(cursor + 32),
        attributes = central.readUInt32LE(cursor + 38),
        next = cursor + 46 + nameSize + extraSize + commentSize;
      if (
        next > central.length ||
        nameSize < 1 ||
        nameSize > 2048 ||
        extraSize > 4096 ||
        commentSize ||
        central.readUInt16LE(cursor + 34) ||
        ![0, 8, 0x800, 0x808].includes(flags) ||
        ![0, 8].includes(method) ||
        ![0, 0x8000].includes((attributes >>> 16) & 0xf000) ||
        attributes & 0x10
      )
        fail("ZIP_MEMBER_INVALID");
      const nameBytes = central.subarray(cursor + 46, cursor + 46 + nameSize),
        name = nameBytes.toString("utf8");
      if (
        !nameBytes.equals(Buffer.from(name)) ||
        /[\\\u0000-\u001f\u007f:]/u.test(name) ||
        name.startsWith("/") ||
        name.split("/").some((p) => !p || p === "." || p === "..") ||
        names.has(name)
      )
        fail("ZIP_MEMBER_INVALID");
      names.add(name);
      const sizes = wideValues(central.subarray(cursor + 46 + nameSize, cursor + 46 + nameSize + extraSize), [
        ["bytes", central.readUInt32LE(cursor + 24)],
        ["compressed", central.readUInt32LE(cursor + 20)],
        ["local", central.readUInt32LE(cursor + 42)],
      ]);
      expanded += sizes.bytes;
      if (expanded > limits.archiveBytes || sizes.compressed > limits.archiveBytes) fail("ZIP_EXPANSION_LIMIT");
      const local = await range(sizes.local, 30, 30),
        ln = local.readUInt16LE(26),
        le = local.readUInt16LE(28);
      if (
        local.readUInt32LE(0) !== 0x04034b50 ||
        local.readUInt16LE(6) !== flags ||
        local.readUInt16LE(8) !== method ||
        ln !== nameSize ||
        le > 4096
      )
        fail("ZIP_LOCAL_INVALID");
      const variable = await range(sizes.local + 30, ln + le, 6144);
      if (!variable.subarray(0, ln).equals(nameBytes)) fail("ZIP_LOCAL_INVALID");
      const localSizes = wideValues(variable.subarray(ln), [
        ["bytes", local.readUInt32LE(22)],
        ["compressed", local.readUInt32LE(18)],
      ]);
      const start = sizes.local + 30 + ln + le;
      let finish = start + sizes.compressed;
      if (flags & 8) {
        if (
          ![0, crc].includes(local.readUInt32LE(14)) ||
          ![0, sizes.bytes].includes(localSizes.bytes) ||
          ![0, sizes.compressed].includes(localSizes.compressed)
        )
          fail("ZIP_LOCAL_INVALID");
        const isWide =
            central.readUInt32LE(cursor + 24) === 0xffffffff || central.readUInt32LE(cursor + 20) === 0xffffffff,
          d = await range(finish, isWide ? 24 : 16, 24);
        if (
          d.readUInt32LE(0) !== 0x08074b50 ||
          d.readUInt32LE(4) !== crc ||
          (isWide ? size64(d, 8) : d.readUInt32LE(8)) !== sizes.compressed ||
          (isWide ? size64(d, 16) : d.readUInt32LE(12)) !== sizes.bytes
        )
          fail("ZIP_DESCRIPTOR_INVALID");
        finish += d.length;
      } else if (
        local.readUInt32LE(14) !== crc ||
        localSizes.bytes !== sizes.bytes ||
        localSizes.compressed !== sizes.compressed
      )
        fail("ZIP_LOCAL_INVALID");
      if (finish > centralStart) fail("ZIP_OVERLAP");
      regions.push({ start: sizes.local, end: finish });
      entries.push(Object.freeze({ name, ...sizes, start, method, crc }));
      cursor = next;
    }
    regions.sort((a, b) => a.start - b.start);
    if (
      cursor !== central.length ||
      regions[0].start !== 0 ||
      regions.some((r, i) => r.end !== (regions[i + 1]?.start ?? centralStart))
    )
      fail("ZIP_OVERLAP");
    catalog = Object.freeze(entries);
    return catalog;
  };
  const readJson = async (filename) => {
    if (!/^[A-Za-z0-9_.-]+\.json$/u.test(filename)) fail("MANIFEST_NAME_INVALID");
    const matches = (await readCatalog()).filter(
      (e) => e.name === filename || e.name === `artifacts/sounding-line/product-experience-submission/${filename}`,
    );
    if (matches.length > 1) fail("MANIFEST_AMBIGUOUS");
    const selected = matches[0];
    if (!selected) fail("MANIFEST_MISSING");
    if (
      selected.bytes < 1 ||
      selected.bytes > limits.manifestBytes ||
      selected.compressed > limits.manifestBytes + 65536
    )
      fail("MANIFEST_LIMIT");
    const packed = await range(selected.start, selected.compressed, limits.manifestBytes + 65536);
    let bytes;
    if (selected.method === 0) bytes = packed;
    else {
      const inflated = inflateRawSync(packed, { maxOutputLength: selected.bytes, info: true });
      if (inflated.engine.bytesWritten !== packed.length) fail("MANIFEST_DEFLATE_INVALID");
      bytes = inflated.buffer;
    }
    check();
    if (bytes.length !== selected.bytes || crc32(bytes, check) !== selected.crc) fail("MANIFEST_CRC_INVALID");
    const result = JSON.parse(bytes);
    await checkIdentity();
    return result;
  };
  const chunks = async function* (start, length) {
    for (let at = 0; at < length; at += limits.chunkBytes)
      yield await range(start + at, Math.min(limits.chunkBytes, length - at), limits.chunkBytes);
  };
  const copyMember = async ({ name, expectedSha256, write }, diagnosticOnly = false) => {
    if (typeof write !== "function" || (!diagnosticOnly && !/^[a-f0-9]{64}$/u.test(expectedSha256 ?? "")))
      fail("MEMBER_REQUEST_INVALID");
    const entry = (await readCatalog()).find((e) => e.name === name);
    if (!entry) fail("MEMBER_MISSING");
    let count = 0,
      crc = 0xffffffff;
    const hash = createHash("sha256");
    const output = async (bytes) => {
      check();
      if (count + bytes.length > entry.bytes) fail("MEMBER_EXPANSION_LIMIT");
      for (let i = 0; i < bytes.length; i++) {
        if (i % 262144 === 0) check();
        crc = (crc >>> 8) ^ table[(crc ^ bytes[i]) & 255];
      }
      hash.update(bytes);
      await write(bytes);
      count += bytes.length;
    };
    if (entry.method === 0) {
      if (entry.bytes !== entry.compressed) fail("MEMBER_SIZE_INVALID");
      for await (const bytes of chunks(entry.start, entry.compressed)) await output(bytes);
    } else {
      const input = Readable.from(chunks(entry.start, entry.compressed));
      const decoder = createInflateRaw({ chunkSize: 65536 });
      const completion = pipeline(input, decoder);
      completion.catch(() => {});
      try {
        for await (const bytes of decoder) await output(bytes);
        await completion;
        if (decoder.bytesWritten !== entry.compressed) fail("MEMBER_DEFLATE_INVALID");
      } catch (error) {
        input.destroy(error);
        decoder.destroy(error);
        await completion.catch(() => {});
        throw error;
      }
    }
    await checkIdentity();
    const sha256 = hash.digest("hex");
    if (
      count !== entry.bytes ||
      (crc ^ 0xffffffff) >>> 0 !== entry.crc ||
      (!diagnosticOnly && sha256 !== expectedSha256)
    )
      fail("MEMBER_DIGEST_OR_SIZE_MISMATCH");
    return Object.freeze({ name, bytes: count, sha256 });
  };
  const copyArchive = async (write) => {
    if (typeof write !== "function") fail("ARCHIVE_WRITER_INVALID");
    const hash = createHash("sha256");
    let bytes = 0;
    for await (const chunk of chunks(0, pin.size)) {
      check();
      await write(chunk);
      hash.update(chunk);
      bytes += chunk.length;
    }
    await checkIdentity();
    const digest = `sha256:${hash.digest("hex")}`;
    if (digest !== verifiedDigest) fail("FILE_CHANGED");
    return Object.freeze({ bytes, digest });
  };
  return {
    verifiedDigest,
    readJson,
    catalog: readCatalog,
    copyMember: (request) => copyMember(request),
    copyDiagnosticMember: ({ name, write }) => copyMember({ name, write }, true),
    copyArchive,
  };
}
export function createBoundedArtifactIntake(options) {
  return createArtifactIntake(options, EXPERIENCE_INTAKE_LIMITS);
}
export function createLocalMediaArtifactIntake(options) {
  return createArtifactIntake(options, LOCAL_MEDIA_LIMITS);
}
export function createDiagnosticArtifactIntake(options) {
  return createArtifactIntake(options, LOCAL_MEDIA_LIMITS, true);
}
function createArtifactIntake(
  { root, limits: overrides, measure = storageSnapshot },
  ceilings,
  diagnosticOnly = false,
) {
  const limits = narrowLimits(overrides, ceilings);
  root = path.resolve(root);
  let busy = false,
    poisoned = false;
  return Object.freeze({
    limits,
    withArtifact: async ({ binding: input, expectedBytes, expectedDigest, request, signal }, action) => {
      const binding = capacityBinding(input);
      if (busy || poisoned) fail("CONCURRENT_OR_UNRESOLVED");
      if (
        !Number.isSafeInteger(expectedBytes) ||
        expectedBytes < 22 ||
        expectedBytes > limits.archiveBytes ||
        !/^sha256:[a-f0-9]{64}$/u.test(expectedDigest ?? "") ||
        typeof request !== "function" ||
        typeof action !== "function"
      )
        fail("DECLARATION_INVALID");
      busy = true;
      const started = performance.now(),
        deadline = AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(limits.timeoutMs)]);
      const check = () => {
        deadline.throwIfAborted();
        if (performance.now() - started >= limits.timeoutMs) fail("DEADLINE_EXCEEDED");
      };
      let directory,
        directoryPin,
        archivePath,
        file,
        filePin,
        response,
        reader,
        primary,
        result,
        lock,
        lockPin,
        total = 0;
      const lockPath = path.join(root, ".experience-artifact-intake.lock");
      let acceptsOperations = false,
        activeOperation = false,
        leaseFailure;
      const operations = [];
      const lease =
        (fn) =>
        (...args) => {
          if (operations.length >= limits.members + 16) {
            leaseFailure ??= new Error("PRODUCT_EXPERIENCE_INTAKE_OPERATION_LIMIT");
            const rejected = Promise.reject(leaseFailure);
            rejected.catch(() => {});
            return rejected;
          }
          const operation = Promise.resolve().then(() => {
            if (!acceptsOperations) fail("CAPABILITY_EXPIRED");
            if (activeOperation) fail("OVERLAPPING_OPERATION");
            activeOperation = true;
            return Promise.resolve()
              .then(() => fn(...args))
              .finally(() => {
                activeOperation = false;
              });
          });
          operations.push(
            operation.then(
              (value) => ({ status: "fulfilled", value }),
              (reason) => ({ status: "rejected", reason }),
            ),
          );
          return operation;
        };
      const space = async () => {
        const rows = await measure(root, { remainingBytes: expectedBytes - total + 64 * 1048576, binding });
        check();
        if (!Array.isArray(rows) || !rows.length || !rows.some((r) => r.writes)) fail("MEASUREMENT_INVALID");
        for (const r of rows) {
          if (!Number.isSafeInteger(r.freeBytes) || !Number.isSafeInteger(r.reserveBytes) || r.reserveBytes < 0)
            fail("MEASUREMENT_INVALID");
          if (r.freeBytes - (r.writes ? expectedBytes - total + 64 * 1048576 : 0) <= r.reserveBytes)
            fail("RESERVE_REACHED");
        }
      };
      try {
        check();
        if ((await realpath(root)) !== root || !(await lstat(root)).isDirectory()) fail("ROOT_INVALID");
        await space();
        lock = await open(
          lockPath,
          constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
          0o600,
        );
        lockPin = await lock.stat();
        await lock.writeFile(JSON.stringify(binding));
        await lock.sync();
        directory = path.join(root, `artifact-intake-${randomUUID()}`);
        await mkdir(directory, { mode: 0o700 });
        directoryPin = await lstat(directory);
        archivePath = path.join(directory, "archive.zip");
        response = await intakeResponse(request, deadline, limits.cleanupMs);
        check();
        if (!response.ok || !response.body || ![null, "identity"].includes(response.headers.get("content-encoding")))
          fail("RESPONSE_INVALID");
        const declared = response.headers.get("content-length");
        if (declared !== null && (!/^[1-9][0-9]*$/u.test(declared) || Number(declared) !== expectedBytes))
          fail("DECLARED_SIZE_MISMATCH");
        file = await open(
          archivePath,
          constants.O_RDWR | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
          0o600,
        );
        filePin = await file.stat();
        reader = response.body.getReader();
        const hash = createHash("sha256");
        while (true) {
          check();
          const item = await during(reader.read(), deadline);
          if (item.done) break;
          const chunk = item.value;
          if (
            chunk.byteLength > limits.chunkBytes ||
            total + chunk.byteLength > expectedBytes ||
            total + chunk.byteLength > limits.archiveBytes
          )
            fail("ACTUAL_SIZE_LIMIT");
          await space();
          await file.writeFile(chunk);
          hash.update(chunk);
          total += chunk.byteLength;
        }
        await bounded(reader.cancel(), limits.cleanupMs);
        reader.releaseLock();
        reader = null;
        await dispose(response, limits.cleanupMs);
        response = null;
        await file.sync();
        check();
        if (total !== expectedBytes || `sha256:${hash.digest("hex")}` !== expectedDigest)
          fail("ACTUAL_DIGEST_OR_SIZE_MISMATCH");
        const pin = await file.stat();
        if (!sameObject(pin, filePin) || pin.size !== total) fail("FILE_CHANGED");
        const archive = await manifestReader({ file, archivePath, pin, limits, check });
        if (archive.verifiedDigest !== expectedDigest) fail("ACTUAL_DIGEST_OR_SIZE_MISMATCH");
        acceptsOperations = true;
        result = await action(
          Object.freeze({
            binding,
            bytes: total,
            digest: expectedDigest,
            readJson: lease(archive.readJson),
            catalog: lease(archive.catalog),
            copyMember: lease(archive.copyMember),
            copyArchive: lease(archive.copyArchive),
            ...(diagnosticOnly ? { copyDiagnosticMember: lease(archive.copyDiagnosticMember) } : {}),
          }),
        );
        check();
      } catch (error) {
        primary = error;
      }
      acceptsOperations = false;
      let drainFailure;
      const drained = await bounded(Promise.all(operations), limits.cleanupMs).catch((error) => {
        drainFailure = error;
        return [];
      });
      const operationFailures = [
        ...new Set([
          ...(leaseFailure ? [leaseFailure] : []),
          ...drained.filter((r) => r.status === "rejected").map((r) => r.reason),
        ]),
      ];
      const additionalOperationFailures = operationFailures.filter((error) => error !== primary);
      if (additionalOperationFailures.length)
        primary = new AggregateError(
          [...(primary ? [primary] : []), ...additionalOperationFailures],
          "PRODUCT_EXPERIENCE_INTAKE_OPERATION_FAILED",
          { cause: primary ?? additionalOperationFailures[0] },
        );
      if (drainFailure) primary = cleanupError(primary, drainFailure);
      const failures = [];
      if (reader) {
        try {
          await bounded(reader.cancel(), limits.cleanupMs);
        } catch (error) {
          failures.push(error);
        }
        try {
          reader.releaseLock();
        } catch (error) {
          failures.push(error);
        }
      } else if (response)
        try {
          await dispose(response, limits.cleanupMs);
        } catch (error) {
          failures.push(error);
        }
      if (file)
        try {
          await file.close();
        } catch (error) {
          failures.push(error);
        }
      if (directory)
        try {
          const current = await lstat(directory);
          if (!directoryPin || !sameObject(current, directoryPin) || !current.isDirectory() || current.isSymbolicLink())
            fail("CLEANUP_IDENTITY_CHANGED");
          if (filePin) {
            const named = await lstat(archivePath);
            if (!sameObject(named, filePin) || !named.isFile() || named.isSymbolicLink() || named.nlink !== 1)
              fail("CLEANUP_IDENTITY_CHANGED");
            await unlink(archivePath);
          }
          await rmdir(directory);
        } catch (error) {
          failures.push(error);
        }
      if (lock)
        try {
          await lock.close();
          const named = await lstat(lockPath);
          if (!lockPin || !sameObject(named, lockPin) || !named.isFile() || named.isSymbolicLink() || named.nlink !== 1)
            fail("CLEANUP_LOCK_IDENTITY_CHANGED");
          // Unknown cleanup keeps the lock as a cross-process stop marker.
          if (!failures.length && !(primary instanceof AggregateError && primary.message.includes("CLEANUP")))
            await unlink(lockPath);
        } catch (error) {
          failures.push(error);
        }
      busy = false;
      if (failures.length) {
        poisoned = true;
        throw new AggregateError(
          [...(primary ? [primary] : []), ...failures],
          "PRODUCT_EXPERIENCE_INTAKE_CLEANUP_FAILED",
          { cause: primary ?? failures[0] },
        );
      }
      if (primary) {
        if (primary instanceof AggregateError && primary.message.includes("CLEANUP")) poisoned = true;
        throw primary;
      }
      check();
      return result;
    },
  });
}
