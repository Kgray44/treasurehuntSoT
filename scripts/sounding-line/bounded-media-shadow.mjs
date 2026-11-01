import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { types } from "node:util";

export const MEDIA_SHADOW_LIMITS = Object.freeze({
  bytes: 256 * 1024 * 1024,
  chunkBytes: 64 * 1024,
  reads: 65536,
  deadlineMs: 120000,
});
const completed = new WeakMap();
const NativeError = Error;
const nativeStackGetter = Object.getOwnPropertyDescriptor(new NativeError(), "stack")?.get;
const prepareStackTrace = Object.getOwnPropertyDescriptor(NativeError, "prepareStackTrace");
const nativeErrorPrototypes = new Map(
  [Error, EvalError, RangeError, ReferenceError, SyntaxError, TypeError, URIError, AggregateError].map((ctor) => [
    ctor.prototype,
    Object.getOwnPropertyDescriptor(ctor.prototype, "name")?.value,
  ]),
);
function boundedNativeStack(error, descriptor) {
  // Node 24 lazily formats native Error stacks. Recognize only the original
  // intrinsic accessor and formatter, with ordinary bounded data properties.
  // Custom getters, subclasses and later formatter substitutions stay omitted.
  if (!nativeStackGetter || descriptor?.get !== nativeStackGetter || !types.isNativeError(error)) return null;
  const prototype = Object.getPrototypeOf(error),
    expectedName = nativeErrorPrototypes.get(prototype);
  const name = Object.getOwnPropertyDescriptor(error, "name"),
    message = Object.getOwnPropertyDescriptor(error, "message");
  const actualName = Object.getOwnPropertyDescriptor(prototype, "name");
  const formatter = Object.getOwnPropertyDescriptor(NativeError, "prepareStackTrace");
  const limit = Object.getOwnPropertyDescriptor(NativeError, "stackTraceLimit");
  if (
    expectedName === undefined ||
    actualName?.value !== expectedName ||
    (name && (typeof name.value !== "string" || name.value.length > 1024)) ||
    typeof message?.value !== "string" ||
    message.value.length > 16384 ||
    formatter?.value !== prepareStackTrace?.value ||
    formatter?.get ||
    !Number.isSafeInteger(limit?.value) ||
    limit.value < 0 ||
    limit.value > 128
  )
    return null;
  const value = nativeStackGetter.call(error);
  return typeof value === "string" && value.length <= 16384 ? value : null;
}
const need = (condition, code) => {
  if (!condition) throw Error(`SOUNDING_LINE_MEDIA_SHADOW_${code}`);
};
const directoryIdentity = (directory) => {
  need(typeof directory === "string" && path.isAbsolute(directory), "DIRECTORY");
  const resolved = path.resolve(directory);
  need(path.resolve(fs.realpathSync(resolved)) === resolved, "DIRECTORY_ALIAS");
  for (let current = resolved; ; current = path.dirname(current)) {
    const stat = fs.lstatSync(current);
    need(stat.isDirectory() && !stat.isSymbolicLink(), "DIRECTORY_ALIAS");
    if (path.dirname(current) === current) break;
  }
  const stat = fs.lstatSync(resolved);
  return { directory: resolved, dev: stat.dev, ino: stat.ino };
};
const sameDirectory = (identity) => {
  const stat = fs.lstatSync(identity.directory);
  need(
    stat.isDirectory() &&
      !stat.isSymbolicLink() &&
      stat.dev === identity.dev &&
      stat.ino === identity.ino &&
      path.resolve(fs.realpathSync(identity.directory)) === identity.directory,
    "DIRECTORY_DRIFT",
  );
};
const sameFile = (fd, filename) => {
  const actual = fs.fstatSync(fd),
    named = fs.lstatSync(filename);
  need(
    actual.isFile() &&
      named.isFile() &&
      !named.isSymbolicLink() &&
      actual.nlink === 1 &&
      named.nlink === 1 &&
      actual.dev === named.dev &&
      actual.ino === named.ino,
    "FILE_DRIFT",
  );
  return actual;
};
async function closeReader(reader) {
  if (!reader) return { started: false, cancelled: false, lockReleased: false };
  let timer,
    cancelled = false,
    lockReleased = false;
  try {
    cancelled = await Promise.race([
      Promise.resolve()
        .then(() => reader.cancel())
        .then(
          () => true,
          () => false,
        ),
      new Promise((resolve) => {
        timer = setTimeout(() => resolve(false), 1000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
    try {
      reader.releaseLock();
      lockReleased = true;
    } catch {
      /* Retain incomplete closure. */
    }
  }
  return { started: true, cancelled, lockReleased };
}

// No production call site. Stream bytes into an exclusive private file instead
// of buffering a complete archive. Expected hashes are declarations, not provider
// authentication, and path rechecks do not attest external runtime isolation.
export async function retainMediaTransportShadow({
  directory,
  response,
  expectedBytes,
  expectedSha256,
  maximumBytes = MEDIA_SHADOW_LIMITS.bytes,
  deadlineMs = MEDIA_SHADOW_LIMITS.deadlineMs,
  signal,
}) {
  need(Number.isSafeInteger(maximumBytes) && maximumBytes > 0 && maximumBytes <= MEDIA_SHADOW_LIMITS.bytes, "LIMIT");
  need(Number.isSafeInteger(expectedBytes) && expectedBytes > 0 && expectedBytes <= maximumBytes, "SIZE");
  need(typeof expectedSha256 === "string" && /^[a-f0-9]{64}$/u.test(expectedSha256), "DIGEST");
  need(Number.isSafeInteger(deadlineMs) && deadlineMs > 0 && deadlineMs <= MEDIA_SHADOW_LIMITS.deadlineMs, "DEADLINE");
  need(signal === undefined || signal instanceof AbortSignal, "SIGNAL");
  const identity = directoryIdentity(directory),
    id = `media-shadow-${randomUUID()}`;
  const rawPath = path.join(identity.directory, `${id}.original.bin`);
  const initialPath = path.join(identity.directory, `${id}.initial.json`);
  const terminalPath = path.join(identity.directory, `${id}.terminal.json`);
  const failurePath = path.join(identity.directory, `${id}.original-failure.json`);
  const expectations = { expectedBytes, expectedSha256, maximumBytes, deadlineMs };
  const began = performance.now(),
    hash = createHash("sha256");
  let fd,
    reader,
    error,
    bytes = 0,
    reads = 0,
    eof = false,
    rawClosed = false,
    timer,
    abortHandler;
  let readerCleanup = { cancelled: false, lockReleased: false };
  try {
    sameDirectory(identity);
    fd = fs.openSync(
      rawPath,
      fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW,
      0o600,
    );
    sameFile(fd, rawPath);
    fs.writeFileSync(
      initialPath,
      JSON.stringify({
        kind: "MEDIA_TRANSPORT_SHADOW",
        status: "INCOMPLETE",
        ...expectations,
        authentication: "DECLARED_EXPECTATIONS_NOT_PROVIDER_AUTHENTICATED",
        qualification: false,
        reuseAuthorized: false,
      }) + "\n",
      { flag: "wx", mode: 0o600 },
    );
    reader = response?.body?.getReader?.();
    need(response?.ok === true && response.status === 200 && reader, "RESPONSE");
    const length = response.headers.get("content-length");
    need(length === null || (/^[1-9][0-9]*$/u.test(length) && Number(length) === expectedBytes), "CONTENT_LENGTH");
    need(!signal?.aborted, "CANCELLED");
    const abort = new Promise((_, reject) => {
      abortHandler = () => reject(Error("SOUNDING_LINE_MEDIA_SHADOW_CANCELLED"));
      if (signal?.aborted) abortHandler();
      else signal?.addEventListener("abort", abortHandler, { once: true });
      timer = setTimeout(() => reject(Error("SOUNDING_LINE_MEDIA_SHADOW_DEADLINE")), deadlineMs);
    });
    for (;;) {
      need(performance.now() - began < deadlineMs, "DEADLINE");
      need(reads < MEDIA_SHADOW_LIMITS.reads, "READ_LIMIT");
      reads++;
      const item = await Promise.race([reader.read(), abort]);
      need(performance.now() - began < deadlineMs, "DEADLINE");
      need(item && typeof item.done === "boolean", "FRAME");
      if (item.done) {
        eof = true;
        break;
      }
      need(item.value instanceof Uint8Array, "FRAME");
      need(bytes + item.value.byteLength <= expectedBytes && bytes + item.value.byteLength <= maximumBytes, "OVERFLOW");
      if (item.value.byteLength === 0) continue;
      sameDirectory(identity);
      sameFile(fd, rawPath);
      for (let offset = 0; offset < item.value.byteLength; offset += MEDIA_SHADOW_LIMITS.chunkBytes) {
        // Copy one bounded view so a shared producer buffer cannot change the
        // bytes between the hash and write operations.
        const chunk = Buffer.from(item.value.subarray(offset, offset + MEDIA_SHADOW_LIMITS.chunkBytes));
        let written = 0;
        while (written < chunk.length) {
          const count = fs.writeSync(fd, chunk, written, chunk.length - written);
          need(count > 0, "WRITE");
          hash.update(chunk.subarray(written, written + count));
          written += count;
          bytes += count;
        }
      }
    }
    need(bytes === expectedBytes, "TRUNCATED");
    fs.fsyncSync(fd);
    need(sameFile(fd, rawPath).size === bytes, "FILE_DRIFT");
    sameDirectory(identity);
    need(performance.now() - began < deadlineMs, "DEADLINE");
  } catch (failure) {
    error = failure;
  } finally {
    clearTimeout(timer);
    if (abortHandler) signal?.removeEventListener("abort", abortHandler);
    readerCleanup = await closeReader(reader);
    if (fd !== undefined) {
      try {
        fs.closeSync(fd);
        rawClosed = true;
      } catch (failure) {
        error ??= failure;
      }
    }
  }
  const sha256 = hash.digest("hex");
  if (!error && sha256 !== expectedSha256) error = Error("SOUNDING_LINE_MEDIA_SHADOW_DIGEST_MISMATCH");
  if (!error && (!readerCleanup.cancelled || !readerCleanup.lockReleased || !rawClosed))
    error = Error("SOUNDING_LINE_MEDIA_SHADOW_CLEANUP_INCOMPLETE");
  let failureRetained = false;
  if (error) {
    // The directory and this original error record are private, never product
    // output. Do not serialize caller getters or unbounded exception objects.
    const original = {},
      omittedFields = [];
    for (const key of ["name", "message", "stack", "code"]) {
      try {
        const descriptor =
          error && (typeof error === "object" || typeof error === "function")
            ? Object.getOwnPropertyDescriptor(error, key)
            : null;
        if (descriptor) {
          if (
            Object.hasOwn(descriptor, "value") &&
            typeof descriptor.value === "string" &&
            descriptor.value.length <= 16384
          )
            original[key] = descriptor.value;
          else {
            const stack = key === "stack" ? boundedNativeStack(error, descriptor) : null;
            if (stack !== null) original[key] = stack;
            else omittedFields.push(key);
          }
        }
      } catch {
        omittedFields.push(key);
      }
    }
    const serialized = Buffer.from(
      JSON.stringify({
        kind: "ORIGINAL_PRIVATE_TRANSPORT_FAILURE",
        representation: "BOUNDED_OWN_STRING_FIELDS_NOT_COMPLETE_EXCEPTION",
        original,
        omittedFields,
      }) + "\n",
    );
    try {
      sameDirectory(identity);
      need(serialized.length <= 65536, "FAILURE_RETENTION_BOUND");
      fs.writeFileSync(failurePath, serialized, { flag: "wx", mode: 0o600 });
      failureRetained = true;
    } catch {
      /* The initial receipt remains incomplete; do not claim custody. */
    }
  }
  const terminal = {
    kind: "MEDIA_TRANSPORT_SHADOW",
    status: error ? "FAIL" : "PASS",
    ...expectations,
    bytes,
    sha256,
    reads,
    eof,
    rawClosed,
    readerCleanup,
    rawPath,
    initialPath,
    terminalPath,
    failurePath: error ? failurePath : null,
    failureRetained,
    elapsedMs: performance.now() - began,
    byteObservation: "HASHED_SUCCESSFUL_WRITE_RETURNS_NOT_INDEPENDENT_READBACK",
    cleanupReserveMs: 1000,
    originalOutcome: error ? "FAILED_OR_INCOMPLETE" : "DECLARED_BYTES_MATCH",
    authentication: "DECLARED_EXPECTATIONS_NOT_PROVIDER_AUTHENTICATED",
    qualification: false,
    reuseAuthorized: false,
  };
  try {
    sameDirectory(identity);
    fs.writeFileSync(terminalPath, JSON.stringify(terminal) + "\n", { flag: "wx", mode: 0o600 });
  } catch (failure) {
    error ??= failure;
    terminal.status = "FAIL";
    terminal.originalOutcome = "TERMINAL_RETENTION_FAILED";
    terminal.failureRetained = false;
  }
  const result = Object.freeze(Object.defineProperty(terminal, "originalError", { value: error, enumerable: false }));
  if (!error) completed.set(result, { identity, rawPath, bytes, sha256 });
  return result;
}

export function verifyRetainedMediaShadow(receipt) {
  const value = completed.get(receipt);
  if (!value) return null;
  let fd;
  try {
    sameDirectory(value.identity);
    fd = fs.openSync(value.rawPath, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
    const before = sameFile(fd, value.rawPath);
    need(before.size === value.bytes, "FILE_DRIFT");
    const hash = createHash("sha256"),
      buffer = Buffer.alloc(MEDIA_SHADOW_LIMITS.chunkBytes);
    let count,
      bytes = 0;
    while ((count = fs.readSync(fd, buffer, 0, buffer.length, null)) > 0) {
      bytes += count;
      need(bytes <= value.bytes, "FILE_DRIFT");
      hash.update(buffer.subarray(0, count));
    }
    const after = sameFile(fd, value.rawPath);
    need(
      bytes === value.bytes &&
        hash.digest("hex") === value.sha256 &&
        before.mtimeMs === after.mtimeMs &&
        before.ctimeMs === after.ctimeMs,
      "FILE_DRIFT",
    );
    sameDirectory(value.identity);
    return Object.freeze({ bytes, sha256: value.sha256, qualification: false, reuseAuthorized: false });
  } catch {
    return null;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}
