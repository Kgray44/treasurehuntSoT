import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { LocalPrivatePackageV2Sink, stagePrivatePackageV2 } from "@/private-content/v2-streaming-io";
import { encryptPrivatePackageV2 } from "@/private-content/streaming";
import { makePayload } from "@/private-content/package";

const roots: string[] = [];
const digest = (value: Buffer) => createHash("sha256").update(value).digest("hex");
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

describe("v2 protected streaming sink", () => {
  it("writes contiguous chunks without accumulating a file and rejects gaps", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "sealed-v2-sink-")); roots.push(root);
    const bytes = Buffer.from("streamed private file"); const hash = digest(bytes);
    const sink = new LocalPrivatePackageV2Sink(root);
    await sink.beginPackage({ packageId: "sink-proof", packageRevision: 1, formatVersion: 1, createdAt: "2026-07-22T00:00:00.000Z", sourceApplicationVersion: "0.2", minimumApplicationVersion: "0.2", classification: "private", contentType: "tale-draft", tales: [{ logicalId: "tale", slug: "sink-proof", title: "Sink proof", contentPath: "tales/proof.json" }], assets: [], dependencies: [], totals: { files: 1, assets: 0, plaintextBytes: bytes.length } });
    await sink.beginFile({ logicalId: "tale", relativePath: "tales/proof.json", mediaType: "application/json", representation: "json", byteLength: bytes.length, sha256: hash });
    await sink.writeFileChunk({ logicalId: "tale", chunkIndex: 0, offset: 0, bytes: bytes.subarray(0, 6) });
    await expect(sink.writeFileChunk({ logicalId: "tale", chunkIndex: 2, offset: 6, bytes: bytes.subarray(6) })).rejects.toMatchObject({ code: "PRIVATE_PACKAGE_INVALID" });
    await sink.writeFileChunk({ logicalId: "tale", chunkIndex: 1, offset: 6, bytes: bytes.subarray(6) });
    await sink.completeFile({ logicalId: "tale", byteLength: bytes.length, sha256: hash });
    await expect(sink.completePackage()).resolves.toMatchObject({ files: [{ byteLength: bytes.length }] });
  });
  it("streams authenticated v2 records directly into protected staging", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "sealed-v2-events-")); roots.push(root);
    const bytes = Buffer.from('{"schemaVersion":1}'); const entry = bytes.toString("base64url");
    const payload = makePayload({ manifest: { packageId: "events-proof", packageRevision: 1, formatVersion: 1, createdAt: "2026-07-22T00:00:00.000Z", sourceApplicationVersion: "0.2", minimumApplicationVersion: "0.2", classification: "private", contentType: "tale-draft", tales: [{ logicalId: "tale", slug: "events-proof", title: "Events", contentPath: "tales/proof.json" }], assets: [], dependencies: [], totals: { files: 1, assets: 0, plaintextBytes: bytes.length } }, entries: { "tales/proof.json": entry } });
    const staged = await stagePrivatePackageV2({ source: encryptPrivatePackageV2(payload, "passphrase"), passphrase: "passphrase", stagingRoot: root });
    expect(staged.files).toHaveLength(1); expect(staged.files[0]!.sha256).toBe(digest(bytes));
  });
});
