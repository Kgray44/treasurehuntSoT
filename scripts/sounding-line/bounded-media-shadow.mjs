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
// A separate legacy-archive lane; callers of the media lane cannot select these
// larger ceilings through maximumBytes or deadlineMs.
export const LEGACY_ARCHIVE_SHADOW_LIMITS = Object.freeze({
  bytes: 5 * 1024 * 1024 * 1024,
  chunkBytes: 64 * 1024,
  reads: 100000,
  deadlineMs: 600000,
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
function retainJSON(filename, value) {
  const bytes = Buffer.from(JSON.stringify(value) + "\n");
  need(bytes.length <= 256 * 1024, "RECEIPT_BOUND");
  fs.writeFileSync(filename, bytes, { flag: "wx", mode: 0o600 });
  const stat = fs.lstatSync(filename);
  need(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1 && stat.size === bytes.length, "RECEIPT_DRIFT");
  return {
    path: filename,
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    dev: stat.dev,
    ino: stat.ino,
  };
}
function verifyReceipt(reference) {
  let fd;
  try {
    need(reference && reference.bytes <= 256 * 1024, "RECEIPT_BOUND");
    fd = fs.openSync(reference.path, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
    const before = sameFile(fd, reference.path);
    need(
      before.dev === reference.dev && before.ino === reference.ino && before.size === reference.bytes,
      "RECEIPT_DRIFT",
    );
    const buffer = Buffer.alloc(reference.bytes + 1),
      hash = createHash("sha256");
    let bytes = 0,
      count;
    while ((count = fs.readSync(fd, buffer, bytes, buffer.length - bytes, null)) > 0) {
      bytes += count;
      need(bytes <= reference.bytes, "RECEIPT_DRIFT");
    }
    hash.update(buffer.subarray(0, bytes));
    const after = sameFile(fd, reference.path);
    need(
      bytes === reference.bytes &&
        hash.digest("hex") === reference.sha256 &&
        before.mtimeMs === after.mtimeMs &&
        before.ctimeMs === after.ctimeMs,
      "RECEIPT_DRIFT",
    );
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}
async function closeReader(reader, failures) {
  if (!reader) return { started: false, cancelled: false, lockReleased: false };
  let timer,
    cancelled = false,
    lockReleased = false,
    cancelTimedOut = false;
  try {
    cancelled = await Promise.race([
      Promise.resolve()
        .then(() => reader.cancel())
        .then(
          () => true,
          (error) => {
            failures.push({ stage: "READER_CANCEL", error });
            return false;
          },
        ),
      new Promise((resolve) => {
        timer = setTimeout(() => {
          cancelTimedOut = true;
          resolve(false);
        }, 1000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
    try {
      reader.releaseLock();
      lockReleased = true;
    } catch (error) {
      failures.push({ stage: "READER_RELEASE_LOCK", error });
    }
  }
  return {
    started: true,
    cancelled,
    lockReleased,
    cancelTimedOut,
    cancelObservation: cancelTimedOut ? "UNRESOLVED_AT_CLEANUP_CUTOFF" : cancelled ? "SUCCEEDED" : "FAILED",
  };
}

// No production call site. Stream bytes into an exclusive private file instead
// of buffering a complete archive. Expected hashes are declarations, not provider
// authentication, and path rechecks do not attest external runtime isolation.
export function retainMediaTransportShadow(input) {
  return retainTransportShadow(input, MEDIA_SHADOW_LIMITS, "MEDIA_TRANSPORT_SHADOW");
}
export function retainLegacyArchiveTransportShadow(input) {
  return retainTransportShadow(input, LEGACY_ARCHIVE_SHADOW_LIMITS, "LEGACY_ARCHIVE_TRANSPORT_SHADOW");
}
async function retainTransportShadow(input, limits, kind) {
  const {
    directory,
    response,
    expectedBytes,
    expectedSha256,
    maximumBytes = limits.bytes,
    deadlineMs = limits.deadlineMs,
    signal,
  } = input;
  need(Number.isSafeInteger(maximumBytes) && maximumBytes > 0 && maximumBytes <= limits.bytes, "LIMIT");
  need(Number.isSafeInteger(expectedBytes) && expectedBytes > 0 && expectedBytes <= maximumBytes, "SIZE");
  need(typeof expectedSha256 === "string" && /^[a-f0-9]{64}$/u.test(expectedSha256), "DIGEST");
  need(Number.isSafeInteger(deadlineMs) && deadlineMs > 0 && deadlineMs <= limits.deadlineMs, "DEADLINE");
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
  const originalFailures = [];
  let fd,
    reader,
    error,
    bytes = 0,
    reads = 0,
    eof = false,
    rawClosed = false,
    timer,
    abortHandler,
    abortError,
    interruptRead,
    initialRecord,
    terminalRecord;
  let readerCleanup = { cancelled: false, lockReleased: false };
  try {
    sameDirectory(identity);
    fd = fs.openSync(
      rawPath,
      fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW,
      0o600,
    );
    sameFile(fd, rawPath);
    initialRecord = retainJSON(initialPath, {
      kind,
      status: "INCOMPLETE",
      ...expectations,
      authentication: "DECLARED_EXPECTATIONS_NOT_PROVIDER_AUTHENTICATED",
      qualification: false,
      reuseAuthorized: false,
    });
    reader = response?.body?.getReader?.();
    need(response?.ok === true && response.status === 200 && reader, "RESPONSE");
    const length = response.headers.get("content-length");
    need(length === null || (/^[1-9][0-9]*$/u.test(length) && Number(length) === expectedBytes), "CONTENT_LENGTH");
    need(!signal?.aborted, "CANCELLED");
    const interrupt = (failure) => {
      abortError ??= failure;
      interruptRead?.(abortError);
    };
    abortHandler = () => interrupt(Error("SOUNDING_LINE_MEDIA_SHADOW_CANCELLED"));
    if (signal?.aborted) abortHandler();
    else signal?.addEventListener("abort", abortHandler, { once: true });
    timer = setTimeout(() => interrupt(Error("SOUNDING_LINE_MEDIA_SHADOW_DEADLINE")), deadlineMs);
    for (;;) {
      need(performance.now() - began < deadlineMs, "DEADLINE");
      need(reads < limits.reads, "READ_LIMIT");
      reads++;
      // One current read owns the interrupt callback. Racing every read against
      // one unresolved abort promise would retain a reaction per archive chunk.
      let item;
      try {
        item = await new Promise((resolve, reject) => {
          interruptRead = reject;
          if (abortError) reject(abortError);
          else
            Promise.resolve()
              .then(() => reader.read())
              .then(resolve, reject);
        });
      } finally {
        interruptRead = null;
      }
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
      for (let offset = 0; offset < item.value.byteLength; offset += limits.chunkBytes) {
        // Copy one bounded view so a shared producer buffer cannot change the
        // bytes between the hash and write operations.
        const chunk = Buffer.from(item.value.subarray(offset, offset + limits.chunkBytes));
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
    originalFailures.push({ stage: "TRANSPORT", error: failure });
  } finally {
    interruptRead = null;
    clearTimeout(timer);
    if (abortHandler) signal?.removeEventListener("abort", abortHandler);
    readerCleanup = await closeReader(reader, originalFailures);
    error ??= originalFailures[0]?.error;
    if (fd !== undefined) {
      try {
        fs.closeSync(fd);
        rawClosed = true;
      } catch (failure) {
        originalFailures.push({ stage: "RAW_FILE_CLOSE", error: failure });
        error ??= failure;
      }
    }
  }
  const sha256 = hash.digest("hex");
  if (!error && sha256 !== expectedSha256) error = Error("SOUNDING_LINE_MEDIA_SHADOW_DIGEST_MISMATCH");
  if (!error && (!readerCleanup.cancelled || !readerCleanup.lockReleased || !rawClosed))
    error = Error("SOUNDING_LINE_MEDIA_SHADOW_CLEANUP_INCOMPLETE");
  if (error && !originalFailures.some((failure) => failure.error === error))
    originalFailures.push({ stage: "TERMINAL_VALIDATION", error });
  let failureRetained = false;
  if (error) {
    // The directory and this original error record are private, never product
    // output. Do not serialize caller getters or unbounded exception objects.
    const describeFailure = (failure) => {
      const original = {},
        omittedFields = [];
      for (const key of ["name", "message", "stack", "code"]) {
        try {
          const descriptor =
            failure && (typeof failure === "object" || typeof failure === "function")
              ? Object.getOwnPropertyDescriptor(failure, key)
              : null;
          if (descriptor) {
            if (
              Object.hasOwn(descriptor, "value") &&
              typeof descriptor.value === "string" &&
              descriptor.value.length <= 16384
            )
              original[key] = descriptor.value;
            else {
              const stack = key === "stack" ? boundedNativeStack(failure, descriptor) : null;
              if (stack !== null) original[key] = stack;
              else omittedFields.push(key);
            }
          }
        } catch {
          omittedFields.push(key);
        }
      }
      return { original, omittedFields };
    };
    const { original, omittedFields } = describeFailure(error);
    const serialized = Buffer.from(
      JSON.stringify({
        kind: "ORIGINAL_PRIVATE_TRANSPORT_FAILURE",
        representation: "BOUNDED_OWN_STRING_FIELDS_NOT_COMPLETE_EXCEPTION",
        original,
        omittedFields,
        observedFailures: originalFailures.map(({ stage, error: failure }) => ({ stage, ...describeFailure(failure) })),
      }) + "\n",
    );
    try {
      sameDirectory(identity);
      need(serialized.length <= 65536, "FAILURE_RETENTION_BOUND");
      fs.writeFileSync(failurePath, serialized, { flag: "wx", mode: 0o600 });
      failureRetained = true;
    } catch (failure) {
      originalFailures.push({ stage: "ORIGINAL_FAILURE_RECEIPT_RETENTION", error: failure });
      /* The initial receipt remains incomplete; do not claim custody. */
    }
  }
  const terminal = {
    kind,
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
    terminalRecord = retainJSON(terminalPath, terminal);
  } catch (failure) {
    originalFailures.push({ stage: "TERMINAL_RECEIPT_RETENTION", error: failure });
    error ??= failure;
    terminal.status = "FAIL";
    terminal.originalOutcome = "TERMINAL_RETENTION_FAILED";
    terminal.failureRetained = false;
  }
  const result = Object.freeze(
    Object.defineProperties(terminal, {
      originalError: { value: error, enumerable: false },
      originalFailures: {
        value: Object.freeze(originalFailures.map((failure) => Object.freeze({ ...failure }))),
        enumerable: false,
      },
    }),
  );
  if (!error) completed.set(result, { kind, identity, rawPath, bytes, sha256, initialRecord, terminalRecord });
  return result;
}

export function verifyRetainedMediaShadow(receipt) {
  return verifyRetainedTransport(receipt, "MEDIA_TRANSPORT_SHADOW");
}
export function verifyRetainedLegacyArchiveShadow(receipt) {
  return verifyRetainedTransport(receipt, "LEGACY_ARCHIVE_TRANSPORT_SHADOW");
}
function verifyRetainedTransport(receipt, kind) {
  const value = completed.get(receipt);
  if (!value || value.kind !== kind) return null;
  let fd;
  try {
    sameDirectory(value.identity);
    verifyReceipt(value.initialRecord);
    verifyReceipt(value.terminalRecord);
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
    verifyReceipt(value.initialRecord);
    verifyReceipt(value.terminalRecord);
    return Object.freeze({
      bytes,
      sha256: value.sha256,
      receiptBytesVerified: true,
      qualification: false,
      reuseAuthorized: false,
    });
  } catch {
    return null;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}
