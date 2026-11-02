import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import {
  retainMediaTransportShadow,
  verifyRetainedMediaShadow,
  MEDIA_SHADOW_LIMITS,
  LEGACY_ARCHIVE_SHADOW_LIMITS,
  retainLegacyArchiveTransportShadow,
  verifyRetainedLegacyArchiveShadow,
} from "../../scripts/sounding-line/bounded-media-shadow.mjs";

const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bounded-media-shadow-"));
  t.after(() => {
    assert(path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep));
    assert(path.basename(root).startsWith("bounded-media-shadow-"));
    fs.rmSync(root, { recursive: true, force: true });
  });
  const directory = path.join(root, "private");
  fs.mkdirSync(directory, { mode: 0o700 });
  return { root, directory };
}
function response(chunks, options = {}) {
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(chunk);
        controller.close();
      },
    }),
    options,
  );
}
const options = (directory, bytes, extra = {}) => ({
  directory,
  expectedBytes: bytes.length,
  expectedSha256: hash(bytes),
  ...extra,
});

test("legacy archive spooling has a separate opaque profile without expanding the media lane", async (t) => {
  const { directory } = fixture(t),
    bytes = Buffer.alloc(130000, 0x5a);
  const result = await retainLegacyArchiveTransportShadow({
    ...options(directory, bytes),
    response: response([bytes]),
  });
  assert.equal(result.status, "PASS");
  assert.equal(result.kind, "LEGACY_ARCHIVE_TRANSPORT_SHADOW");
  assert.equal(result.maximumBytes, LEGACY_ARCHIVE_SHADOW_LIMITS.bytes);
  assert.equal(result.deadlineMs, LEGACY_ARCHIVE_SHADOW_LIMITS.deadlineMs);
  assert.equal(verifyRetainedLegacyArchiveShadow(result).sha256, hash(bytes));
  assert.equal(verifyRetainedMediaShadow(result), null);
  assert.equal(verifyRetainedLegacyArchiveShadow(JSON.parse(JSON.stringify(result))), null);
  await assert.rejects(
    retainMediaTransportShadow({
      ...options(directory, bytes),
      response: response([bytes]),
      maximumBytes: LEGACY_ARCHIVE_SHADOW_LIMITS.bytes,
    }),
    /LIMIT/u,
  );
  await assert.rejects(
    retainMediaTransportShadow({
      ...options(directory, bytes),
      response: response([bytes]),
      deadlineMs: LEGACY_ARCHIVE_SHADOW_LIMITS.deadlineMs,
    }),
    /DEADLINE/u,
  );
});

test("legacy 2 GiB and 4 GiB declarations preserve interrupted prefixes without allocating the declared size", async (t) => {
  const { directory } = fixture(t),
    prefix = Buffer.alloc(64 * 1024, 0x5a);
  for (const expectedBytes of [2 ** 31 - 1, 2 ** 31, 2 ** 31 + 1, 2 ** 32 - 1, 2 ** 32, 2 ** 32 + 1]) {
    const original = Error(`interrupted declared archive ${expectedBytes}`);
    let reads = 0;
    const r = {
      ok: true,
      status: 200,
      headers: new Headers(),
      body: {
        getReader: () => ({
          read: async () => {
            if (reads++ === 0) return { done: false, value: prefix };
            throw original;
          },
          cancel: async () => {},
          releaseLock: () => {},
        }),
      },
    };
    const result = await retainLegacyArchiveTransportShadow({
      directory,
      response: r,
      expectedBytes,
      expectedSha256: "a".repeat(64),
    });
    assert.equal(result.status, "FAIL");
    assert.equal(result.originalError, original);
    assert.equal(result.bytes, prefix.length);
    assert(fs.readFileSync(result.rawPath).equals(prefix));
    assert.equal(result.failureRetained, true);
    assert.equal(verifyRetainedLegacyArchiveShadow(result), null);
  }
  await assert.rejects(
    retainLegacyArchiveTransportShadow({
      directory,
      expectedBytes: LEGACY_ARCHIVE_SHADOW_LIMITS.bytes + 1,
      expectedSha256: "a".repeat(64),
    }),
    /SIZE/u,
  );
});

test("bounded streaming retains exact bytes without calling whole-response buffering", async (t) => {
  const { directory } = fixture(t);
  const chunks = [Buffer.alloc(1024 * 1024, 0xa5), Buffer.from([0, 255, 13, 10]), Buffer.alloc(1024 * 1024, 0x4b)];
  const bytes = Buffer.concat(chunks),
    r = response(chunks, { headers: { "content-length": String(bytes.length) } });
  r.arrayBuffer = () => assert.fail("whole response must not be buffered");
  const result = await retainMediaTransportShadow({ ...options(directory, bytes), response: r });
  assert.equal(result.status, "PASS");
  assert(fs.readFileSync(result.rawPath).equals(bytes));
  assert.equal(JSON.parse(fs.readFileSync(result.initialPath)).status, "INCOMPLETE");
  assert.equal(JSON.parse(fs.readFileSync(result.terminalPath)).status, "PASS");
  assert.deepEqual(verifyRetainedMediaShadow(result), {
    bytes: bytes.length,
    sha256: hash(bytes),
    receiptBytesVerified: true,
    qualification: false,
    reuseAuthorized: false,
  });
  assert.equal(verifyRetainedMediaShadow(JSON.parse(JSON.stringify(result))), null);
  assert.equal(result.authentication, "DECLARED_EXPECTATIONS_NOT_PROVIDER_AUTHENTICATED");
  assert.equal(result.reuseAuthorized, false);
  assert.equal(result.originalError, undefined);
});

test("original stream failures keep their identity, exact prefix and failed receipts", async (t) => {
  const { directory } = fixture(t),
    prefix = Buffer.from("original prefix"),
    error = Error("private synthetic network failure");
  let pulls = 0;
  const r = new Response(
    new ReadableStream({
      pull(controller) {
        if (pulls++ === 0) controller.enqueue(prefix);
        else controller.error(error);
      },
    }),
  );
  const result = await retainMediaTransportShadow({
    ...options(directory, Buffer.concat([prefix, Buffer.from(" tail")])),
    response: r,
  });
  assert.equal(result.status, "FAIL");
  assert.equal(result.originalError, error);
  assert(fs.readFileSync(result.rawPath).equals(prefix));
  assert.equal(result.sha256, hash(prefix));
  assert.equal(result.failureRetained, true);
  const failed = JSON.parse(fs.readFileSync(result.failurePath));
  assert.equal(failed.original.message, error.message);
  assert.equal(failed.original.stack, error.stack);
  assert.equal(JSON.parse(fs.readFileSync(result.terminalPath)).status, "FAIL");
  assert.equal(verifyRetainedMediaShadow(result), null);
  assert(!JSON.stringify(result).includes(error.message));
});

test("simultaneous transport, cancel, release and file-close failures preserve separate originals", async (t) => {
  const { directory } = fixture(t),
    originalOpen = fs.openSync,
    originalClose = fs.closeSync;
  const readError = Error("original read"),
    cancelError = Error("original cancel"),
    releaseError = Error("original release"),
    closeError = Error("original raw close");
  let rawFd;
  fs.openSync = (...args) => {
    const fd = originalOpen(...args);
    if (String(args[0]).endsWith(".original.bin")) rawFd = fd;
    return fd;
  };
  fs.closeSync = (fd) => {
    originalClose(fd);
    if (fd === rawFd) {
      rawFd = undefined;
      throw closeError;
    }
  };
  try {
    const r = {
      ok: true,
      status: 200,
      headers: new Headers(),
      body: {
        getReader: () => ({
          read: async () => {
            throw readError;
          },
          cancel: async () => {
            throw cancelError;
          },
          releaseLock: () => {
            throw releaseError;
          },
        }),
      },
    };
    const result = await retainMediaTransportShadow({ ...options(directory, Buffer.from("expected")), response: r });
    assert.equal(result.status, "FAIL");
    assert.equal(result.originalError, readError);
    assert.deepEqual(
      result.originalFailures.map(({ stage }) => stage),
      ["TRANSPORT", "READER_CANCEL", "READER_RELEASE_LOCK", "RAW_FILE_CLOSE"],
    );
    assert.deepEqual(
      result.originalFailures.map(({ error }) => error),
      [readError, cancelError, releaseError, closeError],
    );
    assert.equal(result.failureRetained, true);
    const retained = JSON.parse(fs.readFileSync(result.failurePath));
    assert.deepEqual(
      retained.observedFailures.map(({ original }) => original.message),
      [readError.message, cancelError.message, releaseError.message, closeError.message],
    );
    assert.equal(verifyRetainedMediaShadow(result), null);
    assert.equal(JSON.stringify(result).includes("original cancel"), false);
  } finally {
    fs.openSync = originalOpen;
    fs.closeSync = originalClose;
  }
});

test("unresolved reader cancellation remains explicit after its finite cleanup cutoff", async (t) => {
  const { directory } = fixture(t),
    readError = Error("original interrupted read");
  const r = {
    ok: true,
    status: 200,
    headers: new Headers(),
    body: {
      getReader: () => ({
        read: async () => {
          throw readError;
        },
        cancel: () => new Promise(() => {}),
        releaseLock: () => {},
      }),
    },
  };
  const result = await retainMediaTransportShadow({ ...options(directory, Buffer.from("expected")), response: r });
  assert.equal(result.status, "FAIL");
  assert.equal(result.originalError, readError);
  assert.equal(result.readerCleanup.cancelTimedOut, true);
  assert.equal(result.readerCleanup.cancelObservation, "UNRESOLVED_AT_CLEANUP_CUTOFF");
  assert.equal(result.readerCleanup.cancelled, false);
  assert.equal(verifyRetainedMediaShadow(result), null);
});

test("private failure receipt write failures remain exact in-process originals", async (t) => {
  const { directory } = fixture(t),
    write = fs.writeFileSync;
  const readError = Error("original network read"),
    retentionError = Error("original private receipt write");
  fs.writeFileSync = (...args) => {
    if (String(args[0]).endsWith(".original-failure.json")) throw retentionError;
    return write(...args);
  };
  try {
    const r = {
      ok: true,
      status: 200,
      headers: new Headers(),
      body: {
        getReader: () => ({
          read: async () => {
            throw readError;
          },
          cancel: async () => {},
          releaseLock: () => {},
        }),
      },
    };
    const result = await retainMediaTransportShadow({ ...options(directory, Buffer.from("expected")), response: r });
    assert.equal(result.originalError, readError);
    assert.equal(result.failureRetained, false);
    assert.equal(result.originalFailures.at(-1).stage, "ORIGINAL_FAILURE_RECEIPT_RETENTION");
    assert.equal(result.originalFailures.at(-1).error, retentionError);
    assert.equal(verifyRetainedMediaShadow(result), null);
  } finally {
    fs.writeFileSync = write;
  }
});

test("oversize, truncated and wrong-digest bodies never become complete media", async (t) => {
  const { directory } = fixture(t),
    bytes = Buffer.from("expected");
  for (const [chunks, expectedSha256, code] of [
    [[Buffer.from("expected extra")], hash(bytes), "OVERFLOW"],
    [[Buffer.from("short")], hash(bytes), "TRUNCATED"],
    [[bytes], "0".repeat(64), "DIGEST_MISMATCH"],
  ]) {
    const result = await retainMediaTransportShadow({
      ...options(directory, bytes),
      expectedSha256,
      response: response(chunks),
    });
    assert.equal(result.status, "FAIL");
    assert.match(result.originalError.message, new RegExp(code, "u"));
    assert.equal(verifyRetainedMediaShadow(result), null);
    assert(fs.existsSync(result.initialPath));
    assert(fs.existsSync(result.terminalPath));
    assert(result.bytes <= bytes.length);
  }
});

test("HTTP/header denials close the original reader and retain incomplete custody", async (t) => {
  const { directory } = fixture(t),
    bytes = Buffer.from("ok");
  for (const opts of [
    { status: 500 },
    { status: 206 },
    { headers: { "content-length": "3" } },
    { headers: { "content-length": "02" } },
  ]) {
    let cancelled = 0;
    const r = new Response(
      new ReadableStream({
        cancel() {
          cancelled++;
        },
      }),
      opts,
    );
    const result = await retainMediaTransportShadow({ ...options(directory, bytes), response: r });
    assert.equal(result.status, "FAIL");
    assert.equal(result.bytes, 0);
    assert.equal(cancelled, 1);
    assert.equal(result.readerCleanup.cancelled, true);
    assert.equal(result.readerCleanup.lockReleased, true);
    assert.equal(result.rawClosed, true);
  }
});

test("pending reads and zero-byte hot streams cannot escape the wall-clock bound", async (t) => {
  const { directory } = fixture(t),
    bytes = Buffer.from("x");
  for (const source of [
    {},
    {
      pull(controller) {
        controller.enqueue(new Uint8Array(0));
      },
    },
  ]) {
    const result = await retainMediaTransportShadow({
      ...options(directory, bytes),
      deadlineMs: 20,
      response: new Response(new ReadableStream(source)),
    });
    assert.equal(result.status, "FAIL");
    assert.match(result.originalError.message, /DEADLINE/u);
    assert.equal(result.readerCleanup.cancelled, true);
    assert.equal(result.readerCleanup.lockReleased, true);
    assert.equal(result.rawClosed, true);
  }
});

test("pre-aborted and in-flight cancellation do not reset allowance or mask failure", async (t) => {
  const { directory } = fixture(t),
    bytes = Buffer.from("x");
  for (const pre of [true, false]) {
    const controller = new AbortController();
    let timer;
    if (pre) controller.abort();
    else timer = setTimeout(() => controller.abort(), 10);
    try {
      const result = await retainMediaTransportShadow({
        ...options(directory, bytes),
        signal: controller.signal,
        response: new Response(new ReadableStream({})),
      });
      assert.equal(result.status, "FAIL");
      assert.match(result.originalError.message, /CANCELLED/u);
      assert.equal(result.rawClosed, true);
      assert.equal(result.readerCleanup.cancelled, true);
    } finally {
      clearTimeout(timer);
    }
  }
});

test("fixed byte/deadline limits reject expansion before creating files", async (t) => {
  const { directory } = fixture(t),
    bytes = Buffer.from("x");
  for (const extra of [
    { maximumBytes: MEDIA_SHADOW_LIMITS.bytes + 1 },
    { deadlineMs: MEDIA_SHADOW_LIMITS.deadlineMs + 1 },
    { expectedBytes: MEDIA_SHADOW_LIMITS.bytes + 1 },
    { expectedBytes: 0 },
    { expectedSha256: "caller-says-authenticated" },
  ])
    await assert.rejects(
      retainMediaTransportShadow({ ...options(directory, bytes, extra), response: response([bytes]) }),
      /MEDIA_SHADOW_/u,
    );
  assert.deepEqual(fs.readdirSync(directory), []);
});

test("directory aliases cannot redirect transport and later byte drift invalidates the opaque handle", async (t) => {
  const { root, directory } = fixture(t),
    bytes = Buffer.from("original");
  const alias = path.join(root, "alias");
  fs.symlinkSync(directory, alias, process.platform === "win32" ? "junction" : "dir");
  await assert.rejects(
    retainMediaTransportShadow({ ...options(alias, bytes), response: response([bytes]) }),
    /DIRECTORY_ALIAS/u,
  );
  assert.deepEqual(fs.readdirSync(directory), []);
  const result = await retainMediaTransportShadow({ ...options(directory, bytes), response: response([bytes]) });
  assert.equal(result.status, "PASS");
  fs.writeFileSync(result.rawPath, Buffer.from("mutation"));
  assert.equal(verifyRetainedMediaShadow(result), null);
  assert.equal(JSON.parse(fs.readFileSync(result.terminalPath)).status, "PASS");
});

test("empty-chunk floods stop at a fixed read count without expanding the byte budget", async (t) => {
  const { directory } = fixture(t),
    bytes = Buffer.from("x");
  const result = await retainMediaTransportShadow({
    ...options(directory, bytes),
    response: new Response(
      new ReadableStream({
        pull(controller) {
          controller.enqueue(new Uint8Array(0));
        },
      }),
    ),
  });
  assert.equal(result.status, "FAIL");
  assert.match(result.originalError.message, /READ_LIMIT/u);
  assert.equal(result.reads, MEDIA_SHADOW_LIMITS.reads);
  assert.equal(result.bytes, 0);
  assert.equal(result.rawClosed, true);
});

test("caller-defined stack and name getters are never executed during failed retention", async (t) => {
  const { directory } = fixture(t),
    bytes = Buffer.from("x");
  for (const property of ["stack", "name"]) {
    let invoked = 0;
    const error = Error("original data message");
    Object.defineProperty(error, property, {
      configurable: true,
      get() {
        invoked++;
        throw Error("caller getter");
      },
    });
    const result = await retainMediaTransportShadow({
      ...options(directory, bytes),
      response: new Response(
        new ReadableStream({
          start(c) {
            c.error(error);
          },
        }),
      ),
    });
    assert.equal(result.status, "FAIL");
    assert.equal(result.originalError, error);
    assert.equal(invoked, 0);
    const record = JSON.parse(fs.readFileSync(result.failurePath));
    assert(record.omittedFields.includes(property));
    assert(record.omittedFields.includes("stack"));
  }
});

test("later stack formatter substitution cannot execute inside failure retention", async (t) => {
  const { directory } = fixture(t),
    bytes = Buffer.from("x"),
    original = Object.getOwnPropertyDescriptor(Error, "prepareStackTrace");
  let invoked = 0,
    result;
  try {
    Error.prepareStackTrace = () => {
      invoked++;
      return "caller formatter";
    };
    const error = Error("original data message");
    result = await retainMediaTransportShadow({
      ...options(directory, bytes),
      response: new Response(
        new ReadableStream({
          start(c) {
            c.error(error);
          },
        }),
      ),
    });
  } finally {
    if (original) Object.defineProperty(Error, "prepareStackTrace", original);
    else delete Error.prepareStackTrace;
  }
  assert.equal(result.status, "FAIL");
  assert.equal(invoked, 0);
  assert(JSON.parse(fs.readFileSync(result.failurePath)).omittedFields.includes("stack"));
});

test("missing or changed initial/terminal receipts invalidate otherwise identical raw bytes", async (t) => {
  const { directory } = fixture(t),
    bytes = Buffer.from("unchanged original payload");
  for (const key of ["initialPath", "terminalPath"])
    for (const operation of ["alter", "delete"]) {
      const result = await retainMediaTransportShadow({ ...options(directory, bytes), response: response([bytes]) });
      assert(verifyRetainedMediaShadow(result)?.receiptBytesVerified);
      assert(fs.readFileSync(result.rawPath).equals(bytes));
      if (operation === "alter") fs.writeFileSync(result[key], "{}\n");
      else fs.unlinkSync(result[key]);
      assert.equal(verifyRetainedMediaShadow(result), null);
      assert(fs.readFileSync(result.rawPath).equals(bytes));
    }
});

test("generated 2 GiB and 4 GiB archive declarations are explicitly rejected before reader acquisition", async (t) => {
  const { directory } = fixture(t);
  for (const boundary of [2 * 1024 ** 3, 4 * 1024 ** 3])
    for (const offset of [-1, 0, 1]) {
      const expectedBytes = boundary + offset;
      let remaining = expectedBytes,
        generated = 0,
        acquired = 0,
        cancelled = false;
      const body = new ReadableStream({
        pull(controller) {
          const size = Math.min(65536, remaining);
          remaining -= size;
          generated += size;
          controller.enqueue(new Uint8Array(size));
        },
        cancel() {
          cancelled = true;
        },
      });
      try {
        await assert.rejects(
          retainMediaTransportShadow({
            directory,
            expectedBytes,
            expectedSha256: "a".repeat(64),
            response: {
              body: {
                getReader() {
                  acquired++;
                  return body.getReader();
                },
              },
            },
          }),
          /MEDIA_SHADOW_SIZE/u,
        );
        assert.equal(acquired, 0);
        assert(generated <= 65536);
        assert.deepEqual(fs.readdirSync(directory), []);
      } finally {
        await body.cancel();
      }
      assert.equal(cancelled, true);
    }
});
