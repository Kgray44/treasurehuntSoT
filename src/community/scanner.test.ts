import { afterEach, describe, expect, it } from "vitest";
import { CommunityError } from "./domain";
import { assertCommunityBinaryFormat, sha256 } from "./package";
import { createCommunityBinaryScanner, scanCommunityPackageFiles } from "./scanner";
import { syntheticBinaryFixtures, syntheticFixtureBytes } from "./synthetic-binary-fixtures";

const originalEnvironment = { ...process.env };
const mutableEnvironment = process.env as Record<string, string | undefined>;
const png = syntheticBinaryFixtures[0];
const glb = syntheticBinaryFixtures[1];

function enableSyntheticValidationEnvironment() {
  mutableEnvironment.NODE_ENV = "test";
  process.env.COMMUNITY_BINARY_SCANNER_PROVIDER = "synthetic-test";
  process.env.FOREVER_VALIDATION_ISOLATION = "1";
  process.env.FOREVER_VALIDATION_NONCE_HASH = "a".repeat(64);
  process.env.DATABASE_URL = "file:C:/isolated/validation-isolated-unit.db";
}

afterEach(() => {
  for (const key of Object.keys(process.env)) if (!(key in originalEnvironment)) delete process.env[key];
  Object.assign(process.env, originalEnvironment);
});

describe("Community binary scanner providers", () => {
  it("defaults to fail-closed scanner-unavailable evidence", async () => {
    delete process.env.COMMUNITY_BINARY_SCANNER_PROVIDER;
    const bytes = syntheticFixtureBytes(png);
    await expect(
      createCommunityBinaryScanner().scan({
        bytes,
        sha256: sha256(bytes),
        byteLength: bytes.byteLength,
        declaredMediaType: "image/png",
        detectedMediaType: "image/png",
      }),
    ).resolves.toMatchObject({ result: "SCAN_NOT_CONFIGURED", provider: "not-configured" });
  });

  it("permits synthetic scanning only in the nonce-bound isolated test runtime", () => {
    process.env.COMMUNITY_BINARY_SCANNER_PROVIDER = "synthetic-test";
    delete process.env.FOREVER_VALIDATION_NODE_ENV;
    mutableEnvironment.NODE_ENV = "production";
    expect(() => createCommunityBinaryScanner()).toThrow("NODE_ENV=test");
    mutableEnvironment.NODE_ENV = "development";
    expect(() => createCommunityBinaryScanner()).toThrow("NODE_ENV=test");
    mutableEnvironment.NODE_ENV = "test";
    delete process.env.FOREVER_VALIDATION_ISOLATION;
    delete process.env.FOREVER_VALIDATION_NONCE_HASH;
    delete process.env.DATABASE_URL;
    expect(() => createCommunityBinaryScanner()).toThrow("nonce-bound validation runtime");
    enableSyntheticValidationEnvironment();
    expect(() => createCommunityBinaryScanner()).not.toThrow();
  });

  it("fails closed for an invalid provider", () => {
    process.env.COMMUNITY_BINARY_SCANNER_PROVIDER = "untrusted";
    expect(() => createCommunityBinaryScanner()).toThrow(CommunityError);
  });

  it("hash-attests only the exact synthetic 2D and GLB fixtures", async () => {
    enableSyntheticValidationEnvironment();
    const files = [png, glb].map((fixture) => ({
      path: `${fixture.id}.${fixture.detectedMediaType === "image/png" ? "png" : "glb"}`,
      mediaType: fixture.detectedMediaType,
      bytes: syntheticFixtureBytes(fixture),
    }));
    const scanned = await scanCommunityPackageFiles(files);
    expect(scanned.result).toBe("CLEAN");
    expect(scanned.receipts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provider: "synthetic-test",
          evidenceKind: "synthetic-hash-attested",
          fixtureId: png.id,
          sha256: png.sha256,
          safeReasonCode: "EXACT_ALLOWLISTED_FIXTURE",
        }),
        expect.objectContaining({ fixtureId: glb.id, sha256: glb.sha256, result: "CLEAN" }),
      ]),
    );
    expect(scanned.receipts.every((item) => item.validationRunId === "a".repeat(64))).toBe(true);
  });

  it("rejects modified, unknown, malformed, mistyped, and unsupported binary inputs", async () => {
    enableSyntheticValidationEnvironment();
    const modified = syntheticFixtureBytes(glb);
    modified[modified.length - 1] ^= 1;
    const scanner = createCommunityBinaryScanner();
    await expect(
      scanner.scan({
        bytes: modified,
        sha256: sha256(modified),
        byteLength: modified.byteLength,
        declaredMediaType: "model/gltf-binary",
        detectedMediaType: "model/gltf-binary",
      }),
    ).resolves.toMatchObject({ result: "SUSPICIOUS", safeReasonCode: "FIXTURE_HASH_NOT_ALLOWLISTED" });
    const pngBytes = syntheticFixtureBytes(png);
    await expect(
      scanner.scan({
        bytes: pngBytes,
        sha256: sha256(pngBytes),
        byteLength: pngBytes.byteLength,
        declaredMediaType: "image/jpeg",
        detectedMediaType: "image/png",
      }),
    ).resolves.toMatchObject({ result: "SUSPICIOUS", safeReasonCode: "FIXTURE_MEDIA_TYPE_MISMATCH" });
    expect(() =>
      assertCommunityBinaryFormat({ path: "bad.glb", mediaType: "model/gltf-binary", bytes: new Uint8Array([1]) }),
    ).toThrow();
    expect(() =>
      assertCommunityBinaryFormat({ path: "bad.png", mediaType: "image/png", bytes: new Uint8Array([1]) }),
    ).toThrow();
  });
});
