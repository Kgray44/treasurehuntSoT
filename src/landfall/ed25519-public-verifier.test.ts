// @sounding-line suite=unit.landfall contract=landfall.player-live-position
import { generateKeyPairSync, sign, webcrypto } from "node:crypto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { importLandfallEd25519PublicKey, verifyLandfallEd25519 } from "./ed25519-public-verifier";
beforeEach(() => vi.stubGlobal("crypto", webcrypto));
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it("native and compatibility verifiers agree on real Node Ed25519 signatures and reject mutated payloads/signatures", async () => {
  const pair = generateKeyPairSync("ed25519");
  const jwk = pair.publicKey.export({ format: "jwk" });
  const native = await importLandfallEd25519PublicKey(jwk);
  vi.spyOn(webcrypto.subtle, "importKey").mockRejectedValue(
    new DOMException("SYNTHETIC_UNSUPPORTED", "NotSupportedError"),
  );
  const compatible = await importLandfallEd25519PublicKey(jwk);
  const payload = new TextEncoder().encode("public synthetic claim");
  const signature = new Uint8Array(sign(null, payload, pair.privateKey));
  for (const key of [native, compatible]) {
    expect(await verifyLandfallEd25519(key, signature, payload)).toBe(true);
    expect(await verifyLandfallEd25519(key, signature, new Uint8Array([1]))).toBe(false);
    const changed = signature.slice();
    changed[0] ^= 1;
    expect(await verifyLandfallEd25519(key, changed, payload)).toBe(false);
    expect(await verifyLandfallEd25519(key, signature.slice(0, 63), payload)).toBe(false);
  }
  expect(await verifyLandfallEd25519({ kind: "LANDFALL_ED25519_PUBLIC" }, signature, payload)).toBe(false);
});
it("rejects private material, key URLs and noncanonical encoding before import, and never substitutes verification after DataError", async () => {
  const pair = generateKeyPairSync("ed25519");
  const jwk = pair.publicKey.export({ format: "jwk" });
  const importing = vi.spyOn(webcrypto.subtle, "importKey");
  for (const bad of [
    { ...jwk, d: "private" },
    { ...jwk, jku: "https://key.example.test/" },
    { ...jwk, crv: "X25519" },
    { ...jwk, x: "_".repeat(43) },
  ])
    await expect(importLandfallEd25519PublicKey(bad)).rejects.toThrow();
  expect(importing).not.toHaveBeenCalled();
  importing.mockRejectedValue(new DOMException("SYNTHETIC_BAD_KEY", "DataError"));
  await expect(importLandfallEd25519PublicKey(jwk)).rejects.toMatchObject({ name: "DataError" });
});
it("strict fallback rejects a small-order identity key forgery and noncanonical signature scalar", async () => {
  vi.spyOn(webcrypto.subtle, "importKey").mockRejectedValue(
    new DOMException("SYNTHETIC_UNSUPPORTED", "NotSupportedError"),
  );
  const identity = new Uint8Array(32);
  identity[0] = 1;
  const x = Buffer.from(identity).toString("base64url");
  const key = await importLandfallEd25519PublicKey({ kty: "OKP", crv: "Ed25519", x });
  const forged = new Uint8Array(64);
  forged[0] = 1;
  expect(await verifyLandfallEd25519(key, forged, new Uint8Array())).toBe(false);
  const pair = generateKeyPairSync("ed25519");
  const trusted = await importLandfallEd25519PublicKey(pair.publicKey.export({ format: "jwk" }));
  const signature = new Uint8Array(sign(null, new Uint8Array(), pair.privateKey));
  signature.fill(255, 32);
  expect(await verifyLandfallEd25519(trusted, signature, new Uint8Array())).toBe(false);
});
