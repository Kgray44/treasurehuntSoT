import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { openPrivateCaptureArchive } from "../../scripts/sounding-line/experience-private-archive.mjs";
import { PRIVATE_CAPTURE_LIMITS } from "../../scripts/sounding-line/experience-private-publication.mjs";
import {
  closeAuthenticatedPrivateCapturePacket,
  createPrivateCaptureFixtureProvider,
  isAuthenticatedPrivateCapturePacket,
  retrievePrivateCaptureArtifact,
} from "../../scripts/sounding-line/experience-private-provider.mjs";
import { privateProviderHttpFixture } from "./fixtures/private-capture-http.mjs";
import { privateCaptureZipFixture } from "./fixtures/private-capture-zip.mjs";

const sha = (bytes) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
const members = () => [
  ["part-000001.encrypted", Buffer.from("synthetic-cipher-part")],
  ["index.encrypted", Buffer.from("synthetic-cipher-index")],
  ["retention.json", Buffer.from(JSON.stringify({ partCount: 1 }))],
];
const binding = {
  repository: "fixture/repository",
  controllerSha: "a".repeat(40),
  baseSha: "a".repeat(40),
  candidateSha: "b".repeat(40),
  candidateTree: "c".repeat(40),
  sourceDigest: "d".repeat(64),
  contractDigest: "e".repeat(64),
  planDigest: "f".repeat(64),
  runId: "123",
  runAttempt: "1",
  workflowPath: ".github/workflows/sounding-line-ordinary.yml",
};
async function root(t) {
  const value = await mkdtemp(path.join(os.tmpdir(), "private-provider-"));
  t.after(() => rm(value, { recursive: true, force: true }));
  return value;
}
async function onDisk(t, archive, limits = PRIVATE_CAPTURE_LIMITS) {
  const directory = await root(t),
    archivePath = path.join(directory, "fixture.zip");
  await writeFile(archivePath, archive);
  return () => openPrivateCaptureArchive({ archivePath, limits, expectedDigest: sha(archive) });
}

async function provider(t, options = {}) {
  const downloadRoot = await root(t),
    archive = options.archive ?? privateCaptureZipFixture(members(), { zip64: true, method: 8, descriptor: true });
  const http = privateProviderHttpFixture(new Map([[456, { id: 456, runId: 123, bytes: archive }]]), {
    ...options,
    binding,
  });
  return {
    downloadRoot,
    http,
    instance: createPrivateCaptureFixtureProvider({
      request: http.request,
      credential: async () => "SYNTHETIC_PROVIDER_CREDENTIAL",
      downloadRoot,
      actors: ["fixture-producer"],
      allowedBlobOrigins: ["https://blob.fixture.invalid"],
      limits: options.limits,
      now: options.now,
      monotonicNow: options.monotonicNow,
      lateCleanupTimeoutMs: options.lateCleanupTimeoutMs,
    }),
  };
}

test("strict stored/deflated ZIP and ZIP64 with signed descriptors restore exact member bytes", async (t) => {
  for (const zip64 of [false, true])
    for (const method of [0, 8])
      for (const descriptor of [false, true]) {
        const input = members(),
          open = await onDisk(t, privateCaptureZipFixture(input, { zip64, method, descriptor }));
        const archive = open();
        try {
          assert.equal(archive.zip64, zip64);
          for (const [name, bytes] of input) assert.deepEqual(archive.entries.get(name), bytes);
        } finally {
          archive.close();
        }
        assert.throws(() => archive.entries.get("index.encrypted"), /FILE_CHANGED/u);
      }
});
test("CRC corruption, duplicate/traversal/foreign names and omitted current parts are rejected", async (t) => {
  for (const bytes of [
    privateCaptureZipFixture(members(), { crcDelta: 1 }),
    privateCaptureZipFixture([...members(), members()[0]]),
    privateCaptureZipFixture([...members(), ["../foreign.encrypted", Buffer.from("x")]]),
    privateCaptureZipFixture([...members(), ["foreign.json", Buffer.from("x")]]),
    privateCaptureZipFixture(
      members().map(([name, b]) => [name === "retention.json" ? name : name.replace("000001", "000002"), b]),
    ),
  ])
    assert.throws(await onDisk(t, bytes), /CRC_OR_SIZE_INVALID|MEMBER_INVALID|MEMBER_CLOSURE_INVALID/u);
});
test("ZIP64 overflow, truncated metadata, link attributes and excessive expansion fail before exposure", async (t) => {
  const wide = privateCaptureZipFixture(members(), { zip64: true });
  const overflow = Buffer.from(wide);
  overflow.writeBigUInt64LE(0xffffffffffffffffn, overflow.length - 22 - 20 + 8);
  const link = privateCaptureZipFixture(members());
  const central = link.indexOf(Buffer.from([80, 75, 1, 2]));
  link.writeUInt32LE((0o120777 << 16) >>> 0, central + 38);
  const bomb = privateCaptureZipFixture([["part-000001.encrypted", Buffer.alloc(8192)], ...members().slice(1)], {
    method: 8,
  });
  for (const [bytes, limits] of [
    [overflow, PRIVATE_CAPTURE_LIMITS],
    [wide.subarray(0, wide.length - 1), PRIVATE_CAPTURE_LIMITS],
    [link, PRIVATE_CAPTURE_LIMITS],
    [bomb, { ...PRIVATE_CAPTURE_LIMITS, partBytes: 1024 }],
  ])
    assert.throws(
      await onDisk(t, bytes, limits),
      /ZIP64_INVALID|RANGE_INVALID|EOCD_INVALID|MEMBER_INVALID|EXPANSION_LIMIT/u,
    );
});
test("original on-disk digest is required, and open archive mutation is rejected", async (t) => {
  const bytes = privateCaptureZipFixture(members()),
    directory = await root(t),
    archivePath = path.join(directory, "fixture.zip");
  await writeFile(archivePath, bytes);
  assert.throws(
    () =>
      openPrivateCaptureArchive({
        archivePath,
        limits: PRIVATE_CAPTURE_LIMITS,
        expectedDigest: `sha256:${"0".repeat(64)}`,
      }),
    /DIGEST_MISMATCH/u,
  );
  const archive = openPrivateCaptureArchive({
    archivePath,
    limits: PRIVATE_CAPTURE_LIMITS,
    expectedDigest: sha(bytes),
  });
  await writeFile(archivePath, Buffer.alloc(bytes.length));
  assert.throws(() => archive.entries.get("index.encrypted"), /FILE_CHANGED/u);
  archive.close();
});
test("authenticated retrieval verifies metadata, downloaded bytes, ZIP64 and exact current closure without credential forwarding", async (t) => {
  const f = await provider(t),
    packet = await f.instance.retrieve({ artifactId: 456, expectedBinding: binding });
  assert.equal(isAuthenticatedPrivateCapturePacket(packet), true);
  assert.equal(isAuthenticatedPrivateCapturePacket(structuredClone({ artifact: packet.artifact })), false);
  assert.deepEqual(packet.entries.get("part-000001.encrypted"), members()[0][1]);
  assert.equal(f.http.requests.length, 8);
  await closeAuthenticatedPrivateCapturePacket(packet);
  assert.equal(isAuthenticatedPrivateCapturePacket(packet), false);
  assert.deepEqual(await readdir(f.downloadRoot), []);
  await assert.rejects(retrievePrivateCaptureArtifact(), /POLICY_NOT_INSTALLED/u);
});
test("wrong source, run, attempt, actor, workflow and changed/expired metadata never yield a packet", async (t) => {
  for (const change of [
    (value) => {
      if (value.head_sha) value.head_sha = "9".repeat(40);
    },
    (value) => {
      if (value.run_attempt) value.run_attempt = 2;
    },
    (value) => {
      if (value.actor) value.actor.login = "foreign";
    },
    (value) => {
      if (value.path) value.path = "foreign.yml";
    },
    (value) => {
      if (value.expires_at) value.expires_at = "2000-01-01T00:00:00Z";
    },
  ]) {
    const f = await provider(t, { mutate: change });
    await assert.rejects(f.instance.retrieve({ artifactId: 456, expectedBinding: binding }), /PROVENANCE_INVALID/u);
    assert.deepEqual(await readdir(f.downloadRoot), []);
  }
  const changed = await provider(t, {
    mutate: (value, url, requests) => {
      if (value.name && requests.length > 5) value.updated_at = "changed";
    },
  });
  await assert.rejects(changed.instance.retrieve({ artifactId: 456, expectedBinding: binding }), /PROVENANCE_CHANGED/u);
  assert.deepEqual(await readdir(changed.downloadRoot), []);
});
test("unapproved redirects, actual digest/size mismatch and byte caps fail with owned cleanup", async (t) => {
  for (const responseBarrier of [
    (response, url) =>
      url.endsWith("/zip")
        ? new Response(null, { status: 302, headers: { location: "https://foreign.invalid/leak" } })
        : response,
    (response, url) =>
      url.startsWith("https://blob.") ? new Response(Buffer.from("wrong archive"), { status: 200 }) : response,
    (response, url) =>
      url.startsWith("https://blob.")
        ? new Response(null, { status: 302, headers: { location: "https://foreign.invalid/second-hop" } })
        : response,
  ]) {
    const f = await provider(t, { responseBarrier });
    await assert.rejects(
      f.instance.retrieve({ artifactId: 456, expectedBinding: binding }),
      /REDIRECT_NOT_APPROVED|ARCHIVE_DIGEST_OR_LENGTH_MISMATCH|DOWNLOAD_RESPONSE_INVALID/u,
    );
    assert.deepEqual(await readdir(f.downloadRoot), []);
  }
  const cap = await provider(t, { limits: { archiveBytes: 128 } });
  await assert.rejects(cap.instance.retrieve({ artifactId: 456, expectedBinding: binding }), /PROVENANCE_INVALID/u);
});
test("cancellation interrupts a request that ignores the signal, with no retry or disk output", async (t) => {
  const controller = new AbortController();
  let calls = 0;
  const instance = createPrivateCaptureFixtureProvider({
    lateCleanupTimeoutMs: 20,
    request: () => {
      calls++;
      queueMicrotask(() => controller.abort());
      return new Promise(() => {});
    },
    credential: async () => "SYNTHETIC",
    downloadRoot: await root(t),
    actors: ["fixture-producer"],
    allowedBlobOrigins: ["https://blob.fixture.invalid"],
  });
  await assert.rejects(
    instance.retrieve({ artifactId: 456, expectedBinding: binding, signal: controller.signal }),
    (error) => {
      assert.equal(error.cause.name, "AbortError");
      assert(error.errors.some((value) => /CLEANUP_TIMEOUT/u.test(value.message)));
      return true;
    },
  );
  assert.equal(calls, 1);
});

test("authenticated nested provenance and the caller binding cannot be relabeled after retrieval starts", async (t) => {
  const expectedBinding = structuredClone(binding);
  const f = await provider(t, {
    requestBarrier: () => {
      expectedBinding.repository = "foreign/repository";
    },
  });
  const packet = await f.instance.retrieve({ artifactId: 456, expectedBinding });
  for (const action of [
    () => {
      packet.run.actor.login = "foreign";
    },
    () => {
      packet.artifact.workflow_run.id = 999;
    },
    () => {
      packet.workflow.path = "foreign.yml";
    },
  ])
    assert.throws(action, TypeError);
  assert.equal(packet.run.actor.login, "fixture-producer");
  assert.equal(isAuthenticatedPrivateCapturePacket(packet), true);
  await closeAuthenticatedPrivateCapturePacket(packet);
  assert.deepEqual(await readdir(f.downloadRoot), []);
});
test("expiry is checked against the clock after the final metadata response", async (t) => {
  let current = Date.parse("2098-01-01T00:00:00Z"),
    workflowReads = 0;
  const f = await provider(t, {
    now: () => current,
    responseBarrier: (response, url) => {
      if (url.includes("/workflows/") && ++workflowReads === 2) current = Date.parse("2100-01-01T00:00:00Z");
      return response;
    },
  });
  await assert.rejects(f.instance.retrieve({ artifactId: 456, expectedBinding: binding }), /PROVENANCE_INVALID/u);
  assert.deepEqual(await readdir(f.downloadRoot), []);
});
test("synchronous archive verification polls an elapsed deadline before exposing entries", async (t) => {
  const bytes = privateCaptureZipFixture(members(), { method: 8, zip64: true }),
    directory = await root(t);
  const archivePath = path.join(directory, "deadline.zip");
  await writeFile(archivePath, bytes);
  let checks = 0;
  assert.throws(
    () =>
      openPrivateCaptureArchive({
        archivePath,
        limits: PRIVATE_CAPTURE_LIMITS,
        expectedDigest: sha(bytes),
        checkDeadline: () => {
          if (++checks === 12) throw new Error("SYNTHETIC_ELAPSED_DEADLINE");
        },
      }),
    /SYNTHETIC_ELAPSED_DEADLINE/u,
  );
  assert.equal(checks, 12);
});
test("a download finalization failure yields no packet and preserves cleanup plus the primary failure", async (t) => {
  for (const corrupt of [false, true]) {
    const f = await provider(t, {
      responseBarrier: (response, url) => {
        if (!url.startsWith("https://blob.")) return response;
        const inner = corrupt ? new Response(Buffer.from("wrong archive")) : response;
        return {
          status: inner.status,
          headers: inner.headers,
          body: {
            get locked() {
              return inner.body.locked;
            },
            getReader: () => inner.body.getReader(),
            cancel: async () => {
              throw new Error("SYNTHETIC_FINAL_CANCEL_FAILED");
            },
          },
        };
      },
    });
    await assert.rejects(f.instance.retrieve({ artifactId: 456, expectedBinding: binding }), (error) => {
      const messages = [];
      const visit = (e) => {
        messages.push(e.message);
        for (const child of e.errors ?? []) visit(child);
      };
      visit(error);
      assert(messages.some((m) => m.includes("SYNTHETIC_FINAL_CANCEL_FAILED")));
      if (corrupt) assert(messages.some((m) => m.includes("ARCHIVE_DIGEST_OR_LENGTH_MISMATCH")));
      return true;
    });
    assert.deepEqual(await readdir(f.downloadRoot), []);
  }
});

test("late responses after abort are disposed exactly once, including finalizer failure and timeout accounting", async (t) => {
  for (const outcome of ["closed", "failed", "unresolved", "locked"]) {
    const controller = new AbortController(),
      downloadRoot = await root(t);
    let calls = 0,
      cancels = 0,
      settle;
    const finalizer = new Promise((resolve) => {
      settle = resolve;
    });
    const instance = createPrivateCaptureFixtureProvider({
      request: () => {
        calls++;
        queueMicrotask(() => controller.abort());
        return new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                status: 200,
                headers: new Headers(),
                body: {
                  locked: outcome === "locked",
                  cancel: async () => {
                    cancels++;
                    settle();
                    if (outcome === "failed") throw new Error("SYNTHETIC_LATE_CANCEL_FAILED");
                    if (outcome === "unresolved") return new Promise(() => {});
                  },
                },
              }),
            5,
          ),
        );
      },
      credential: async () => "SYNTHETIC_PROVIDER_CREDENTIAL",
      downloadRoot,
      actors: ["fixture-producer"],
      allowedBlobOrigins: ["https://blob.fixture.invalid"],
      lateCleanupTimeoutMs: 20,
    });
    await assert.rejects(
      instance.retrieve({ artifactId: 456, expectedBinding: binding, signal: controller.signal }),
      (error) => {
        if (outcome === "closed") assert.equal(error.name, "AbortError");
        else {
          assert.equal(error.cause.name, "AbortError");
          assert(
            error.errors.some((value) =>
              new RegExp(
                outcome === "failed"
                  ? "SYNTHETIC_LATE_CANCEL_FAILED"
                  : outcome === "locked"
                    ? "CLEANUP_BODY_LOCKED"
                    : "CLEANUP_TIMEOUT",
                "u",
              ).test(value.message),
            ),
          );
        }
        return true;
      },
    );
    if (outcome !== "locked") await finalizer;
    assert.equal(calls, 1);
    assert.equal(cancels, outcome === "locked" ? 0 : 1);
    assert.deepEqual(await readdir(downloadRoot), []);
  }
});
test("a response settling after the drain deadline still has its registered disposal observer", async (t) => {
  const controller = new AbortController(),
    downloadRoot = await root(t);
  let calls = 0,
    cancels = 0,
    finish;
  const disposed = new Promise((resolve) => {
    finish = resolve;
  });
  const instance = createPrivateCaptureFixtureProvider({
    request: () => {
      calls++;
      queueMicrotask(() => controller.abort());
      return new Promise((resolve) =>
        setTimeout(
          () =>
            resolve({
              body: {
                locked: false,
                cancel: async () => {
                  cancels++;
                  finish();
                },
              },
            }),
          50,
        ),
      );
    },
    credential: async () => "SYNTHETIC_PROVIDER_CREDENTIAL",
    downloadRoot,
    actors: ["fixture-producer"],
    allowedBlobOrigins: ["https://blob.fixture.invalid"],
    lateCleanupTimeoutMs: 10,
  });
  await assert.rejects(
    instance.retrieve({ artifactId: 456, expectedBinding: binding, signal: controller.signal }),
    (error) => {
      assert.equal(error.cause.name, "AbortError");
      assert(error.errors.some((value) => /CLEANUP_TIMEOUT/u.test(value.message)));
      return true;
    },
  );
  await disposed;
  assert.equal(calls, 1);
  assert.equal(cancels, 1);
  assert.deepEqual(await readdir(downloadRoot), []);
});

test("a blob response that settles after abort disposes its body and cleans the already-owned directory", async (t) => {
  for (const failed of [false, true]) {
    const controller = new AbortController();
    let cancels = 0;
    const f = await provider(t, {
      lateCleanupTimeoutMs: 100,
      requestBarrier: async (url) => {
        if (url.startsWith("https://blob.")) {
          queueMicrotask(() => controller.abort());
          await new Promise((resolve) => setTimeout(resolve, 5));
        }
      },
      responseBarrier: (response, url) => {
        if (!url.startsWith("https://blob.")) return response;
        return {
          status: response.status,
          headers: response.headers,
          body: {
            get locked() {
              return response.body.locked;
            },
            cancel: async () => {
              cancels++;
              await response.body.cancel();
              if (failed) throw new Error("SYNTHETIC_LATE_BLOB_FINALIZER_FAILED");
            },
          },
        };
      },
    });
    await assert.rejects(
      f.instance.retrieve({ artifactId: 456, expectedBinding: binding, signal: controller.signal }),
      (error) => {
        if (failed) {
          assert.equal(error.cause.name, "AbortError");
          assert(error.errors.some((e) => /SYNTHETIC_LATE_BLOB_FINALIZER_FAILED/u.test(e.message)));
        } else assert.equal(error.name, "AbortError");
        return true;
      },
    );
    assert.equal(cancels, 1);
    assert.equal(f.http.requests.length, 5);
    assert.deepEqual(await readdir(f.downloadRoot), []);
  }
});
