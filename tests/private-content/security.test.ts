import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { PRIVATE_SENTINEL, assertSafeArchivePath } from "@/private-content/core";
import { decryptPrivatePackage, encryptPrivatePayload, makePayload } from "@/private-content/package";
import { scanPrivateContent } from "@/private-content/security";
import { LocalPrivateAssetStore } from "@/private-content/storage";

function payload() {
  const content = Buffer.from("synthetic tale").toString("base64url");
  return makePayload({
    manifest: {
      packageId: "security-fixture",
      packageRevision: 1,
      formatVersion: 1,
      createdAt: "2026-07-21T00:00:00.000Z",
      sourceApplicationVersion: "0.2.0",
      minimumApplicationVersion: "0.2.0",
      classification: "private",
      contentType: "tale-draft",
      tales: [
        { logicalId: "tale", slug: "security-fixture", title: "Security fixture", contentPath: "content/tale.json" },
      ],
      assets: [],
      dependencies: [],
      totals: { files: 1, assets: 0, plaintextBytes: Buffer.from(content, "base64url").length },
    },
    entries: { "content/tale.json": content },
  });
}

describe("private-content security boundary", () => {
  let workspace = "";
  afterEach(async () => {
    if (workspace) await rm(workspace, { recursive: true, force: true });
  });

  it("rejects malformed envelope fields and unsupported protocol choices without plaintext diagnostics", async () => {
    const encrypted = await encryptPrivatePayload(payload(), "synthetic passphrase");
    const original = JSON.parse(encrypted.toString("utf8"));
    for (const mutation of [
      { envelope: { ...original.envelope, salt: "A" } },
      { envelope: { ...original.envelope, nonce: "A" } },
      { envelope: { ...original.envelope, authenticationTag: "A" } },
      { envelope: { ...original.envelope, cipher: "not-a-cipher" } },
      { envelope: { ...original.envelope, payloadFormatVersion: 99 } },
    ]) {
      const malformed = Buffer.from(JSON.stringify({ ...original, ...mutation }));
      await expect(decryptPrivatePackage(malformed, "synthetic passphrase")).rejects.toMatchObject({
        code: expect.stringMatching(/^PRIVATE_PACKAGE_(?:INVALID|UNSUPPORTED)$/),
      });
    }
  });

  it("rejects every platform traversal and reserved-name form", () => {
    for (const unsafe of [
      "../x",
      "/etc/x",
      "C:\\secret",
      "\\\\server\\share",
      "a/../b",
      "a/CON",
      "a/NUL.txt",
      "a\0b",
      "a/run.ps1",
      "a/archive.zip",
    ]) {
      expect(() => assertSafeArchivePath(unsafe)).toThrow();
    }
  });

  it("rejects private storage roots inside the repository and requires distinct roots", () => {
    expect(
      () => new LocalPrivateAssetStore({ root: process.cwd(), stagingRoot: path.join(tmpdir(), "sealed-staging") }),
    ).toThrow();
    const root = path.join(tmpdir(), "sealed-same-root");
    expect(() => new LocalPrivateAssetStore({ root, stagingRoot: root })).toThrow();
  });

  it("detects a deliberate sentinel and a structurally complete private key but not a header fragment", async () => {
    workspace = await mkdtemp(path.join(tmpdir(), "sealed-scan-"));
    await writeFile(path.join(workspace, "fragment.md"), "-----BEGIN PRIVATE KEY-----");
    await expect(scanPrivateContent(workspace)).resolves.toEqual([]);
    await writeFile(path.join(workspace, "sentinel.md"), PRIVATE_SENTINEL);
    await expect(scanPrivateContent(workspace)).resolves.toContainEqual({
      path: "sentinel.md",
      rule: "sensitive-content",
    });
    await writeFile(
      path.join(workspace, "key.md"),
      `-----BEGIN PRIVATE KEY-----\n${"A".repeat(24)}\n-----END PRIVATE KEY-----`,
    );
    await expect(scanPrivateContent(workspace)).resolves.toContainEqual({ path: "key.md", rule: "sensitive-content" });
  });
});
