import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PRIVATE_SENTINEL, PrivateContentError } from "@/private-content/core";
import { decryptPrivatePackage, encryptPrivatePayload, makePayload } from "@/private-content/package";
import { LocalPrivateAssetStore } from "@/private-content/storage";

function fixture(pathName = "content/tales.json") {
  const entry = Buffer.from(`Synthetic content ${PRIVATE_SENTINEL}`).toString("base64url");
  return makePayload({ manifest: { packageId: "synthetic-package", packageRevision: 1, formatVersion: 1, createdAt: "2026-07-21T00:00:00.000Z", sourceApplicationVersion: "0.2.0", minimumApplicationVersion: "0.2.0", classification: "private", contentType: "tale-draft", tales: [{ logicalId: "synthetic-tale", slug: "clockmaker-lantern", title: "The Clockmaker's Lantern", contentPath: pathName }], assets: [], dependencies: [], totals: { files: 1, assets: 0, plaintextBytes: Buffer.from(entry, "base64url").length } }, entries: { [pathName]: entry } });
}

describe("private Chronicle package v1", () => {
  it("authenticates and decrypts a bounded synthetic payload", async () => {
    const packageBytes = await encryptPrivatePayload(fixture(), "synthetic test passphrase");
    await expect(decryptPrivatePackage(packageBytes, "synthetic test passphrase")).resolves.toMatchObject({ manifest: { packageId: "synthetic-package" } });
  });
  it("fails closed for a wrong passphrase and tampering", async () => {
    const packageBytes = await encryptPrivatePayload(fixture(), "synthetic test passphrase");
    await expect(decryptPrivatePackage(packageBytes, "wrong passphrase")).rejects.toMatchObject({ code: "PRIVATE_PACKAGE_AUTHENTICATION_FAILED" });
    const tampered = Buffer.from(packageBytes); tampered[tampered.length - 2] ^= 1;
    await expect(decryptPrivatePackage(tampered, "synthetic test passphrase")).rejects.toMatchObject({ code: "PRIVATE_PACKAGE_AUTHENTICATION_FAILED" });
  });
  it("rejects traversal before any storage operation", () => {
    expect(() => fixture("../private.txt")).toThrow(PrivateContentError);
  });
  it("stages then finalizes only hash-addressed objects outside the repository", async () => {
    const base = await mkdtemp(path.join(tmpdir(), "sealed-hold-test-")); const root = path.join(base, "objects-root"); const stagingRoot = path.join(base, "staging-root");
    try { const store = new LocalPrivateAssetStore({ root, stagingRoot }); const staged = await store.stageObject(Buffer.from("synthetic asset")); const stored = await store.finalizeObject(staged); expect(stored.storageKey).toMatch(/^objects\/[a-f0-9]{2}\/[a-f0-9]{2}\/[a-f0-9]{64}$/); await expect(store.verifyObject(stored.sha256)).resolves.toMatchObject({ exists: true, valid: true }); } finally { await rm(base, { recursive: true, force: true }); }
  });
});
