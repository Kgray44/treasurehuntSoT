import { z } from "zod";
import { ed25519 } from "@noble/curves/ed25519.js";

type CompatiblePublicKey = Readonly<{ kind: "LANDFALL_ED25519_PUBLIC" }>;
export type LandfallEd25519PublicKey = CryptoKey | CompatiblePublicKey;
const compatibleKeys = new WeakMap<CompatiblePublicKey, Uint8Array>();
const publicJwk = z.strictObject({
  kty: z.literal("OKP"),
  crv: z.literal("Ed25519"),
  x: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  ext: z.boolean().optional(),
  key_ops: z.array(z.literal("verify")).max(1).optional(),
  alg: z.literal("EdDSA").optional(),
  kid: z.string().max(128).optional(),
});
/** Only currently authenticated first-party trust anchors may call this; scanned claims cannot select keys. */
export async function importLandfallEd25519PublicKey(input: unknown): Promise<LandfallEd25519PublicKey> {
  const jwk = publicJwk.parse(input);
  const bytes = Uint8Array.from(atob(jwk.x.replaceAll("-", "+").replaceAll("_", "/")), (value) => value.charCodeAt(0));
  const canonical = btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
  if (bytes.length !== 32 || canonical !== jwk.x || !ed25519.utils.isValidPublicKey(bytes, false))
    throw new Error("LANDFALL_PUBLIC_KEY_INVALID");
  try {
    return await crypto.subtle.importKey("jwk", jwk, "Ed25519", false, ["verify"]);
  } catch (error) {
    // Older native WebViews lack this algorithm. Other import errors remain failures.
    if (!error || typeof error !== "object" || !("name" in error) || error.name !== "NotSupportedError") throw error;
    const key = Object.freeze({ kind: "LANDFALL_ED25519_PUBLIC" as const });
    compatibleKeys.set(key, bytes);
    return key;
  }
}
export function isLandfallEd25519PublicKey(key: LandfallEd25519PublicKey) {
  return "kind" in key ? compatibleKeys.has(key) : key.type === "public" && key.algorithm.name === "Ed25519";
}
/** Public verification only, strict RFC8032 checks; no signing or weakened signature fallback. */
export async function verifyLandfallEd25519(key: LandfallEd25519PublicKey, signature: Uint8Array, payload: Uint8Array) {
  if (!isLandfallEd25519PublicKey(key) || signature.length !== 64 || payload.length > 1024 * 1024) return false;
  if ("kind" in key) {
    const bytes = compatibleKeys.get(key);
    return bytes !== undefined && ed25519.verify(signature, payload, bytes, { zip215: false });
  }
  return crypto.subtle.verify("Ed25519", key, signature as BufferSource, payload as BufferSource);
}
