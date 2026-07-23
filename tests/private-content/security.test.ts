import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { PRIVATE_SENTINEL, assertSafeArchivePath } from "@/private-content/core";
import { decryptPrivatePackage, encryptPrivatePayload, makePayload } from "@/private-content/package";
import { scanPrivateContent, scanPrivateContentReport } from "@/private-content/security";
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

  it("classifies only exact unchanged governed chat archives while retaining strict scans elsewhere", async () => {
    workspace = await mkdtemp(path.join(tmpdir(), "sealed-archive-scan-"));
    const archiveRelative = "Codex_Chats/chats/019f854e-6112-7c33-ac11-a976c0c71e0c--fixture.md";
    const archivePath = path.join(workspace, archiveRelative);
    const archiveText = `Historical synthetic prompt marker: ${PRIVATE_SENTINEL}`;
    await mkdir(path.dirname(archivePath), { recursive: true });
    await mkdir(path.join(workspace, "Codex_Chats"), { recursive: true });
    await writeFile(archivePath, archiveText);
    const manifestContentSha256 = createHash("sha256").update("canonical archive content").digest("hex");
    await writeFile(
      path.join(workspace, "Codex_Chats/manifest.json"),
      JSON.stringify({ conversations: [{ archive_path: archiveRelative, content_sha256: manifestContentSha256 }] }),
    );
    await writeFile(
      path.join(workspace, "Codex_Chats/governed-private-content-archives.json"),
      JSON.stringify({
        archives: [
          {
            path: archiveRelative,
            archiveSha256: createHash("sha256").update(archiveText).digest("hex"),
            manifestContentSha256,
            classification: "historical-synthetic-prompt-sentinel",
          },
        ],
      }),
    );
    const governed = await scanPrivateContentReport(workspace);
    expect(governed.violations).toEqual([]);
    expect(governed.classifications).toContainEqual({
      path: archiveRelative,
      classification: "governed-historical-archive",
    });

    await writeFile(archivePath, `${archiveText} changed`);
    await expect(scanPrivateContent(workspace)).resolves.toContainEqual({
      path: archiveRelative,
      rule: "sensitive-content",
    });

    const newArchive = path.join(workspace, "Codex_Chats/chats/019f85e9-90b3-72f0-824e-6de3748eef42--new.md");
    await writeFile(newArchive, `-----BEGIN PRIVATE KEY-----\n${"A".repeat(24)}\n-----END PRIVATE KEY-----`);
    await expect(scanPrivateContent(workspace)).resolves.toContainEqual({
      path: "Codex_Chats/chats/019f85e9-90b3-72f0-824e-6de3748eef42--new.md",
      rule: "sensitive-content",
    });

    const activeSource = path.join(workspace, "src/active.ts");
    await mkdir(path.dirname(activeSource), { recursive: true });
    await writeFile(activeSource, PRIVATE_SENTINEL);
    await expect(scanPrivateContent(workspace)).resolves.toContainEqual({
      path: "src/active.ts",
      rule: "sensitive-content",
    });
  });

  it("rejects broad or malformed governed archive policy entries", async () => {
    workspace = await mkdtemp(path.join(tmpdir(), "sealed-archive-policy-"));
    await mkdir(path.join(workspace, "Codex_Chats"), { recursive: true });
    await writeFile(
      path.join(workspace, "Codex_Chats/governed-private-content-archives.json"),
      JSON.stringify({
        archives: [
          {
            path: "Codex_Chats/chats/*.md",
            archiveSha256: "a".repeat(64),
            manifestContentSha256: "b".repeat(64),
            classification: "historical-synthetic-prompt-sentinel",
          },
        ],
      }),
    );
    await expect(scanPrivateContent(workspace)).resolves.toContainEqual({
      path: "Codex_Chats/governed-private-content-archives.json",
      rule: "invalid-governed-archive-policy",
    });
  });
});
