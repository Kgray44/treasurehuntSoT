import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdtemp, open, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  LocalPrivatePackageV2Sink,
  stagePrivatePackageV2,
  type PrivatePackageV2Source,
} from "@/private-content/v2-streaming-io";
import { encryptPrivatePackageV2, encryptPrivatePackageV2FromSource } from "@/private-content/streaming";
import { makePayload } from "@/private-content/package";

const roots: string[] = [];
const digest = (value: Buffer) => createHash("sha256").update(value).digest("hex");
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

describe("v2 protected streaming sink", () => {
  it("writes contiguous chunks without accumulating a file and rejects gaps", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "sealed-v2-sink-"));
    roots.push(root);
    const bytes = Buffer.from("streamed private file");
    const hash = digest(bytes);
    const sink = new LocalPrivatePackageV2Sink(root);
    const manifest = {
      packageId: "sink-proof",
      packageRevision: 1,
      formatVersion: 1 as const,
      createdAt: "2026-07-22T00:00:00.000Z",
      sourceApplicationVersion: "0.2",
      minimumApplicationVersion: "0.2",
      classification: "private" as const,
      contentType: "tale-draft" as const,
      tales: [{ logicalId: "tale", slug: "sink-proof", title: "Sink proof", contentPath: "tales/proof.json" }],
      assets: [],
      dependencies: [],
      totals: { files: 1, assets: 0, plaintextBytes: bytes.length },
    };
    await sink.beginPackage({
      header: {
        format: "forever-treasure-private-stream",
        version: 2,
        streamId: "00000000-0000-4000-8000-000000000000",
        packageId: "sink-proof",
        packageRevision: 1,
        createdAt: "2026-07-22T00:00:00.000Z",
        cipher: { name: "aes-256-gcm", keyBytes: 32, nonceBytes: 12, authenticationTagBytes: 16 },
        keyDerivation: {
          name: "scrypt",
          salt: "AAAAAAAAAAAAAAAAAAAAAA",
          N: 32768,
          r: 8,
          p: 1,
          keyBytes: 32,
          maxmemBytes: 67108864,
        },
        recordFormat: { name: "forever-treasure-private-record-stream", version: 1 },
      },
      manifest,
      correlationId: "correlation",
    });
    await sink.beginFile({
      recordFormatVersion: 1,
      kind: "file-start",
      logicalId: "tale",
      relativePath: "tales/proof.json",
      mediaType: "application/json",
      representation: "json",
      byteLength: bytes.length,
      sha256: hash,
    });
    await sink.writeFileChunk({ logicalId: "tale", chunkIndex: 0, offset: 0, bytes: bytes.subarray(0, 6) });
    await expect(
      sink.writeFileChunk({ logicalId: "tale", chunkIndex: 2, offset: 6, bytes: bytes.subarray(6) }),
    ).rejects.toMatchObject({ code: "PRIVATE_PACKAGE_INVALID" });
    await sink.writeFileChunk({ logicalId: "tale", chunkIndex: 1, offset: 6, bytes: bytes.subarray(6) });
    await sink.completeFile({
      recordFormatVersion: 1,
      kind: "file-end",
      logicalId: "tale",
      byteLength: bytes.length,
      sha256: hash,
    });
    await expect(
      sink.completePackage({
        chainDigest: hash,
        recordCount: 4,
        fileCount: 1,
        plaintextBytes: bytes.length,
        manifestSha256: hash,
      }),
    ).resolves.toMatchObject({ files: [{ byteLength: bytes.length }] });
  });
  it("streams authenticated v2 records directly into protected staging", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "sealed-v2-events-"));
    roots.push(root);
    const bytes = Buffer.from('{"schemaVersion":1}');
    const entry = bytes.toString("base64url");
    const payload = makePayload({
      manifest: {
        packageId: "events-proof",
        packageRevision: 1,
        formatVersion: 1,
        createdAt: "2026-07-22T00:00:00.000Z",
        sourceApplicationVersion: "0.2",
        minimumApplicationVersion: "0.2",
        classification: "private",
        contentType: "tale-draft",
        tales: [{ logicalId: "tale", slug: "events-proof", title: "Events", contentPath: "tales/proof.json" }],
        assets: [],
        dependencies: [],
        totals: { files: 1, assets: 0, plaintextBytes: bytes.length },
      },
      entries: { "tales/proof.json": entry },
    });
    const staged = await stagePrivatePackageV2({
      source: encryptPrivatePackageV2(payload, "passphrase"),
      passphrase: "passphrase",
      stagingRoot: root,
    });
    expect(staged.files).toHaveLength(1);
    expect(staged.files[0]!.sha256).toBe(digest(bytes));
  });
  it("exports a canonical source without base64 or complete-file buffering", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "sealed-v2-source-"));
    roots.push(root);
    const bytes = Buffer.from('{"schemaVersion":1,"streamed":true}');
    const manifest = {
      packageId: "source-proof",
      packageRevision: 1,
      formatVersion: 1 as const,
      createdAt: "2026-07-22T00:00:00.000Z",
      sourceApplicationVersion: "0.2",
      minimumApplicationVersion: "0.2",
      classification: "private" as const,
      contentType: "tale-draft" as const,
      tales: [{ logicalId: "tale", slug: "source-proof", title: "Source proof", contentPath: "tales/proof.json" }],
      assets: [],
      dependencies: [],
      totals: { files: 1, assets: 0, plaintextBytes: bytes.length },
    };
    const source: PrivatePackageV2Source = {
      packageId: manifest.packageId,
      packageRevision: manifest.packageRevision,
      manifest,
      async *files() {
        yield {
          logicalId: "tale",
          relativePath: "tales/proof.json",
          mediaType: "application/json",
          representation: "json",
          byteLength: bytes.length,
          sha256: digest(bytes),
          async *openStream() {
            yield bytes.subarray(0, 7);
            yield bytes.subarray(7);
          },
        };
      },
    };
    const staged = await stagePrivatePackageV2({
      source: encryptPrivatePackageV2FromSource(source, "passphrase"),
      passphrase: "passphrase",
      stagingRoot: root,
    });
    expect(staged.files[0]).toMatchObject({ byteLength: bytes.length, sha256: digest(bytes) });
  });
  it("streams a generated 512 MiB package through a temporary provider object within the bounded RSS budget", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "sealed-v2-large-"));
    roots.push(root);
    const providerPath = path.join(root, "provider-object.ftprivate");
    const stagedRoot = path.join(root, "staging");
    const chunk = Buffer.alloc(1024 * 1024, 0x5a),
      repetitions = 512;
    const fileHash = createHash("sha256");
    for (let i = 0; i < repetitions; i++) fileHash.update(chunk);
    const manifest = {
      packageId: "large-stream-proof",
      packageRevision: 1,
      formatVersion: 1 as const,
      createdAt: "2026-07-22T00:00:00.000Z",
      sourceApplicationVersion: "0.2",
      minimumApplicationVersion: "0.2",
      classification: "private" as const,
      contentType: "tale-draft" as const,
      tales: [
        { logicalId: "tale", slug: "large-stream-proof", title: "Large source proof", contentPath: "tales/proof.json" },
      ],
      assets: [],
      dependencies: [],
      totals: { files: 1, assets: 0, plaintextBytes: chunk.length * repetitions },
    };
    const source: PrivatePackageV2Source = {
      packageId: manifest.packageId,
      packageRevision: manifest.packageRevision,
      manifest,
      async *files() {
        yield {
          logicalId: "tale",
          relativePath: "tales/proof.json",
          mediaType: "application/json",
          representation: "json",
          byteLength: manifest.totals.plaintextBytes,
          sha256: fileHash.digest("hex"),
          async *openStream() {
            for (let i = 0; i < repetitions; i++) yield chunk;
          },
        };
      },
    };
    const warmedRss = process.memoryUsage().rss;
    const output = await open(providerPath, "wx", 0o600);
    let peakRss = warmedRss;
    try {
      for await (const wire of encryptPrivatePackageV2FromSource(source, "large passphrase")) {
        await output.write(wire);
        peakRss = Math.max(peakRss, process.memoryUsage().rss);
      }
    } finally {
      await output.close();
    }
    const staged = await stagePrivatePackageV2({
      source: createReadStream(providerPath),
      passphrase: "large passphrase",
      stagingRoot: stagedRoot,
    });
    peakRss = Math.max(peakRss, process.memoryUsage().rss);
    expect(staged.files[0]).toMatchObject({ byteLength: manifest.totals.plaintextBytes });
    expect(peakRss - warmedRss).toBeLessThan(128 * 1024 * 1024);
  }, 180_000);
});
