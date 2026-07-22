import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { afterEach, describe, expect, it } from "vitest";
import {
  LocalPhase2PrivateStorageProvider,
  UnconfiguredS3CompatiblePrivateStorageProvider,
} from "@/private-content/provider-storage";

const roots: string[] = [];
async function provider() {
  const root = await mkdtemp(path.join(os.tmpdir(), "sealed-hold-storage-"));
  roots.push(root);
  return new LocalPhase2PrivateStorageProvider({ root });
}
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
async function readAll(stream: Readable) {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("Phase 2 private storage provider", () => {
  it("streams immutable private objects, verifies checksums, and supports bounded reads", async () => {
    const storage = await provider();
    const body = "streamed-private-content";
    const object = await storage.put("normalized", "payloads/a", Readable.from([body]), {
      expectedSha256: hash(body),
      contentLength: Buffer.byteLength(body),
    });
    expect(await storage.exists(object)).toBe(true);
    expect((await readAll(await storage.read(object, { start: 9, end: 15 }))).toString()).toBe("private");
    await expect(
      storage.put("normalized", "payloads/b", Readable.from([body]), { expectedSha256: hash("other") }),
    ).rejects.toMatchObject({
      code: "PRIVATE_PACKAGE_CHECKSUM_MISMATCH",
    });
  });

  it("promotes private content immutably and moves unsafe content into opaque quarantine", async () => {
    const storage = await provider();
    const source = await storage.put("uploads", "package", Readable.from(["asset"]), {});
    const final = await storage.promote(source, { namespace: "objects", key: "assets/1" });
    expect(final.key).toBe("objects/assets/1");
    const quarantined = await storage.moveToQuarantine(final, "SUSPICIOUS_FILE");
    expect(quarantined.key).toMatch(/^quarantine\/suspicious_file\//);
    expect(await storage.exists(final)).toBe(false);
    expect(await storage.exists(quarantined)).toBe(true);
  });

  it("persists multipart parts, rejects duplicate parts, and assembles without a package buffer", async () => {
    const storage = await provider();
    const upload = await storage.beginMultipart({ key: "resumable/private-package", expectedBytes: 11 });
    const first = await storage.uploadPart({
      uploadId: upload.uploadId,
      partNumber: 1,
      body: Readable.from(["hello "]),
      expectedSha256: hash("hello "),
    });
    const second = await storage.uploadPart({
      uploadId: upload.uploadId,
      partNumber: 2,
      body: Readable.from(["world"]),
      expectedSha256: hash("world"),
    });
    await expect(
      storage.uploadPart({
        uploadId: upload.uploadId,
        partNumber: 2,
        body: Readable.from(["world"]),
        expectedSha256: hash("world"),
      }),
    ).rejects.toMatchObject({ code: "PRIVATE_PACKAGE_CONFLICT" });
    const object = await storage.completeMultipart({
      uploadId: upload.uploadId,
      parts: [
        { partNumber: 1, etag: first.etag },
        { partNumber: 2, etag: second.etag },
      ],
    });
    expect((await readAll(await storage.read(object))).toString()).toBe("hello world");
  });

  it("reports a production S3 adapter as unconfigured and fails closed", async () => {
    const storage = new UnconfiguredS3CompatiblePrivateStorageProvider();
    expect(await storage.health()).toEqual({ configured: false, healthy: false });
    await expect(storage.beginMultipart({ key: "x" })).rejects.toMatchObject({
      code: "PRIVATE_CONTENT_CONFIGURATION_INVALID",
    });
  });
});
