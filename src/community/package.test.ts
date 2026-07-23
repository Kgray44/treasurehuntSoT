import { describe, expect, it } from "vitest";
import { CommunityError } from "./domain";
import { assertPublicationScanStatus, packageChecksum, sha256, verifyCommunityPackage } from "./package";

const bytes = new TextEncoder().encode('{"title":"Safe"}');
const item = {
  id: "safe",
  type: "CHRONICLE" as const,
  path: "items/safe.json",
  checksum: sha256(bytes),
  mediaType: "application/json",
  byteLength: bytes.byteLength,
  dependencies: [],
};
const manifest = {
  schemaVersion: 1 as const,
  packageId: "package-1",
  releaseId: "release-1",
  semanticVersion: "1.0.0",
  license: { key: "ALL_RIGHTS_RESERVED", version: 1 },
  attribution: [{ displayName: "Creator", contributionType: "ORIGINAL_CREATOR" }],
  items: [item],
};

describe("Community package verification", () => {
  it("produces a deterministic checksum for a complete package", () => {
    const result = verifyCommunityPackage(manifest, [{ path: item.path, mediaType: item.mediaType, bytes }]);
    expect(result.checksum).toBe(packageChecksum(manifest));
  });
  it("rejects traversal, undeclared content and checksum substitution", () => {
    expect(() =>
      verifyCommunityPackage(manifest, [{ path: "../escape.json", mediaType: "application/json", bytes }]),
    ).toThrow(CommunityError);
    expect(() =>
      verifyCommunityPackage(manifest, [{ path: item.path, mediaType: item.mediaType, bytes: new Uint8Array([1]) }]),
    ).toThrow("checksum");
    expect(() =>
      verifyCommunityPackage(manifest, [
        { path: item.path, mediaType: item.mediaType, bytes },
        { path: "items/extra.json", mediaType: "application/json", bytes },
      ]),
    ).toThrow();
  });
  it("rejects executable paths and dependency cycles", () => {
    expect(() =>
      verifyCommunityPackage({ ...manifest, items: [{ ...item, path: "items/run.ps1" }] }, [
        { path: "items/run.ps1", mediaType: "application/json", bytes },
      ]),
    ).toThrow();
    const loop = { ...item, id: "loop", dependencies: ["loop"] };
    expect(() =>
      verifyCommunityPackage({ ...manifest, items: [loop] }, [{ path: loop.path, mediaType: loop.mediaType, bytes }]),
    ).toThrow("cycle");
  });
  it("supports the full Phase 2 taxonomy but reserves Voyage Logs and enforces truthful binary scans", () => {
    const guide = { ...item, id: "guide", type: "GUIDE" as const, path: "guides/guide.md", mediaType: "text/markdown" };
    const guideBytes = new TextEncoder().encode("# Guide");
    expect(
      verifyCommunityPackage(
        { ...manifest, items: [{ ...guide, checksum: sha256(guideBytes), byteLength: guideBytes.byteLength }] },
        [{ path: guide.path, mediaType: guide.mediaType, bytes: guideBytes }],
      ).manifest.items[0].type,
    ).toBe("GUIDE");
    expect(() =>
      assertPublicationScanStatus("SCAN_NOT_CONFIGURED", [{ path: "assets/p.png", mediaType: "image/png", bytes }]),
    ).toThrow("scanner verification is not configured");
  });
});
