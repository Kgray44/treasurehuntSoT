import { generateKeyPairSync, webcrypto } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { configuredInstallationSigning, LandfallInstallationSigner } from "./installation-token-server";
import {
  LandfallInstallationReplayGuard,
  readInstallationEnvelope,
  verifyInstallationToken,
} from "./installation-token";
import { landfallFixture } from "./fixtures";
import { validateLandfallDefinition } from "./definition";
const pair = generateKeyPairSync("ed25519");
const configuration = configuredInstallationSigning({
  LANDFALL_INSTALLATION_KEY_ID: "synthetic-lab",
  LANDFALL_INSTALLATION_SIGNING_KEY_PEM: pair.privateKey.export({ format: "pem", type: "pkcs8" }).toString(),
})!;
const now = 1000000,
  scope = {
    taleId: "fixture",
    publishedVersionId: "lab-pin",
    worldspaceId: "town",
    waypointId: "town-arrival",
    id: "lab-installation",
    medium: "QR" as const,
  };
beforeEach(() => vi.stubGlobal("crypto", webcrypto));
describe("published optional installation identity", () => {
  it("fails closed without an operator Ed25519 key and never exposes the private key", () => {
    expect(configuredInstallationSigning({})).toBeNull();
    expect(
      configuredInstallationSigning({
        LANDFALL_INSTALLATION_KEY_ID: "bad",
        LANDFALL_INSTALLATION_SIGNING_KEY_PEM: "invalid",
      }),
    ).toBeNull();
    expect(new LandfallInstallationSigner(null).status()).toEqual({ state: "NOT_CONFIGURED", canComplete: false });
    expect(() => new LandfallInstallationSigner(null).issue(scope)).toThrow("NOT_CONFIGURED");
    expect(JSON.stringify(new LandfallInstallationSigner(configuration).status())).not.toContain("PRIVATE");
  });
  it("issues a bounded seven-day token verifiable offline by the trusted public key", async () => {
    const signer = new LandfallInstallationSigner(configuration, () => now),
      issued = signer.issue(scope);
    const key = await crypto.subtle.importKey(
      "jwk",
      pair.publicKey.export({ format: "jwk" }) as JsonWebKey,
      { name: "Ed25519" },
      false,
      ["verify"],
    );
    const claim = await verifyInstallationToken(issued.token, {
      scope,
      keys: new Map([[configuration.keyId, key]]),
      now,
    });
    expect(claim).toMatchObject({ ...scope, purpose: "LANDFALL_INSTALLATION", expiresAt: now + 7 * 86400000 });
    expect(issued.canComplete).toBe(false);
    expect(issued.token.length).toBeLessThanOrEqual(2048);
    expect(signer.verify(issued.token, scope)).toEqual(claim);
    expect(() => signer.issue({ ...scope, keyId: "payload-supplied" } as typeof scope)).toThrow();
  });
  it("rejects copies from another Chronicle, published version, waypoint, installation or medium", () => {
    const signer = new LandfallInstallationSigner(configuration, () => now),
      token = signer.issue(scope).token;
    for (const field of ["taleId", "publishedVersionId", "worldspaceId", "waypointId", "id"] as const)
      expect(() => signer.verify(token, { ...scope, [field]: "unrelated" })).toThrow("SCOPE_MISMATCH");
    expect(() => signer.verify(token, { ...scope, medium: "NFC" })).toThrow("SCOPE_MISMATCH");
    expect(() => new LandfallInstallationSigner(configuration, () => now + 7 * 86400000).verify(token, scope)).toThrow(
      "EXPIRED",
    );
  });
  it("rejects scripts, URLs, tampering, malformed Unicode and untrusted/rotated signing keys", () => {
    const signer = new LandfallInstallationSigner(configuration, () => now),
      token = signer.issue(scope).token;
    for (const value of [
      "https://example.test/run",
      "<script>code</script>",
      "x".repeat(2049),
      token + ".extra",
      token.replace(/.$/, token.endsWith("A") ? "B" : "A"),
    ])
      expect(() => signer.verify(value, scope)).toThrow();
    const other = generateKeyPairSync("ed25519");
    expect(() =>
      new LandfallInstallationSigner(
        { keyId: configuration.keyId, privateKey: other.privateKey, publicKey: other.publicKey },
        () => now,
      ).verify(token, scope),
    ).toThrow("SIGNATURE_INVALID");
    expect(() =>
      readInstallationEnvelope(
        "_w.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      ),
    ).toThrow("INVALID");
  });
  it("bounds local duplicate suppression without granting completion or crossing published scope", () => {
    const claim = new LandfallInstallationSigner(configuration, () => now).verify(
      new LandfallInstallationSigner(configuration, () => now).issue(scope).token,
      scope,
    );
    const guard = new LandfallInstallationReplayGuard();
    expect(guard.accept(claim)).toBe("NEW");
    expect(guard.accept(claim)).toBe("DUPLICATE");
    for (let index = 1; index < 128; index++) expect(guard.accept({ ...claim, id: `lab-${index}` })).toBe("NEW");
    expect(guard.accept({ ...claim, id: "overflow" })).toBe("CAPACITY");
    guard.clear();
    expect(guard.accept(claim)).toBe("NEW");
  });
  it("keeps installations physical, bounded and paired with an accessible mandatory fallback", () => {
    const definition = structuredClone(landfallFixture);
    const waypoint = definition.waypoints[0];
    waypoint.installations = [
      {
        id: "lab-installation",
        medium: "QR",
        label: "Synthetic tag",
        accessibilityAlternative: "Ask your Captain or use readable confirmation.",
      },
    ];
    expect(() => validateLandfallDefinition(definition)).not.toThrow();
    waypoint.sequence.optional = false;
    waypoint.fallback = { mode: "NONE" };
    expect(() => validateLandfallDefinition(definition)).toThrow();
    const virtual = structuredClone(landfallFixture),
      virtualWaypoint =
        virtual.waypoints.find((item) => item.worldspaceId === "islands") ??
        virtual.waypoints.find(
          (item) => virtual.worldspaces.find((world) => world.id === item.worldspaceId)?.kind === "VIRTUAL",
        )!;
    virtualWaypoint.installations = waypoint.installations;
    expect(() => validateLandfallDefinition(virtual)).toThrow();
  });
});
