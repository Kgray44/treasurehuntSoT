import { generateKeyPairSync, createPublicKey, verify } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildLandfallOfflinePackage } from "@/landfall/offline-package-server";
import { offlineManifestPayload } from "@/landfall/offline-package";
import { projectPlayerLandfallBootstrap } from "@/landfall/player-bootstrap";
import { landfallFixture } from "@/landfall/fixtures";

describe("released Player package material", () => {
  const bootstrap = projectPlayerLandfallBootstrap(
    {
      sessionId: "session-1",
      publishedVersionId: "version-1",
      taleId: "fixture-tale",
      currentSequence: 0,
      definition: landfallFixture,
    },
    { releasedAssets: [], chapterId: null, blockId: null },
  );
  const keys = generateKeyPairSync("ed25519");
  const scope = {
    playerProfileId: "lab-player",
    sessionId: "session-1",
    publishedVersionId: "version-1",
    taleId: "fixture-tale",
    worldspaceId: "town",
  };
  const input = {
    bootstrap,
    scope,
    signing: {
      id: "synthetic-signing-key",
      privateKey: keys.privateKey,
      publicKey: createPublicKey(keys.privateKey).export({ format: "jwk" }) as JsonWebKey,
    },
    issuedAt: 1000,
    expiresAt: 1801000,
    assets: [],
  };
  it("signs only released geometry, with no future-world or live-position resource", () => {
    const material = buildLandfallOfflinePackage(input);
    expect(
      verify(
        null,
        offlineManifestPayload(material.envelope.manifest),
        keys.publicKey,
        Buffer.from(material.envelope.signature, "base64url"),
      ),
    ).toBe(true);
    const payload = new TextDecoder().decode(material.chunks.get("released-chart"));
    expect(payload).not.toContain("isle-region");
    expect(payload).not.toContain("latitude-history");
    expect(JSON.parse(payload).scene.currentPosition).toBeNull();
    expect(material.envelope.manifest.resources.every((resource) => resource.offlineRights === "ALLOWED")).toBe(true);
  });
  it("rejects cross-Voyage bindings and unreleased assets", () => {
    expect(() => buildLandfallOfflinePackage({ ...input, scope: { ...scope, sessionId: "other-session" } })).toThrow(
      "SCOPE_MISMATCH",
    );
    expect(() =>
      buildLandfallOfflinePackage({
        ...input,
        assets: [{ id: "unreleased-future", bytes: new Uint8Array([1]), mime: "image/png", attribution: "Synthetic" }],
      }),
    ).toThrow("UNRELEASED_ASSET");
  });
});
