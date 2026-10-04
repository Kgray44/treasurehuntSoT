import { z } from "zod";
import { landfallId } from "@/landfall/schema";

/** Public installation identity, not a bearer grant, location observation or arrival claim. */
export const installationClaimSchema = z.strictObject({
  version: z.literal(1),
  purpose: z.literal("LANDFALL_INSTALLATION"),
  keyId: landfallId,
  id: landfallId,
  taleId: landfallId,
  publishedVersionId: landfallId,
  worldspaceId: landfallId,
  waypointId: landfallId,
  medium: z.enum(["QR", "NFC"]),
  issuedAt: z.number().int().nonnegative(),
  expiresAt: z.number().int().nonnegative(),
});
export type LandfallInstallationClaim = z.infer<typeof installationClaimSchema>;
export const installationScopeSchema = installationClaimSchema.pick({
  taleId: true,
  publishedVersionId: true,
  worldspaceId: true,
  waypointId: true,
  medium: true,
  id: true,
});
export type LandfallInstallationScope = Pick<
  LandfallInstallationClaim,
  "taleId" | "publishedVersionId" | "worldspaceId" | "waypointId" | "medium" | "id"
>;
const encoder = new TextEncoder();
const maximumLifetime = 30 * 86400000;
function encoded(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}
function decoded(value: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("LANDFALL_INSTALLATION_INVALID");
  const bytes = Uint8Array.from(atob(value.replaceAll("-", "+").replaceAll("_", "/")), (char) => char.charCodeAt(0));
  if (encoded(bytes) !== value) throw new Error("LANDFALL_INSTALLATION_INVALID");
  return bytes;
}
export function installationSigningPayload(claim: LandfallInstallationClaim) {
  return encoded(encoder.encode(JSON.stringify(installationClaimSchema.parse(claim))));
}
export function readInstallationEnvelope(token: string) {
  try {
    if (token.length < 32 || token.length > 2048) throw new Error();
    const [payload, signature, extra] = token.split(".");
    if (!payload || !signature || extra) throw new Error();
    const claim = installationClaimSchema.parse(
      JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(decoded(payload))),
    );
    const bytes = decoded(signature);
    if (bytes.length !== 64 || installationSigningPayload(claim) !== payload) throw new Error();
    return { claim, payload, signature: bytes };
  } catch {
    throw new Error("LANDFALL_INSTALLATION_INVALID");
  }
}
export function validateInstallationScope(
  claim: LandfallInstallationClaim,
  scope: LandfallInstallationScope,
  now: number,
) {
  if (
    !Number.isSafeInteger(now) ||
    now < 0 ||
    claim.issuedAt > now + 1000 ||
    claim.expiresAt <= now ||
    claim.expiresAt <= claim.issuedAt ||
    claim.expiresAt - claim.issuedAt > maximumLifetime
  )
    throw new Error("LANDFALL_INSTALLATION_EXPIRED");
  if (Object.entries(scope).some(([field, value]) => claim[field as keyof LandfallInstallationScope] !== value))
    throw new Error("LANDFALL_INSTALLATION_SCOPE_MISMATCH");
}
/** Trusted first-party key only; tag content cannot supply keys, URLs or executable data. */
export async function verifyInstallationToken(
  token: string,
  input: { scope: LandfallInstallationScope; now: number; keys: ReadonlyMap<string, CryptoKey> },
) {
  const envelope = readInstallationEnvelope(token);
  const key = input.keys.get(envelope.claim.keyId);
  if (
    !key ||
    key.type !== "public" ||
    key.algorithm.name !== "Ed25519" ||
    !(await crypto.subtle.verify("Ed25519", key, envelope.signature as BufferSource, encoder.encode(envelope.payload)))
  )
    throw new Error("LANDFALL_INSTALLATION_SIGNATURE_INVALID");
  validateInstallationScope(envelope.claim, input.scope, input.now);
  return envelope.claim;
}

/** Actor/session/sequence belongs in the scanner lifetime, not a public physical tag. */
export class LandfallInstallationReplayGuard {
  private readonly seen = new Set<string>();
  accept(claim: LandfallInstallationClaim): "NEW" | "DUPLICATE" | "CAPACITY" {
    const key = `${claim.publishedVersionId}:${claim.waypointId}:${claim.medium}:${claim.id}`;
    if (this.seen.has(key)) return "DUPLICATE";
    if (this.seen.size >= 128) return "CAPACITY";
    this.seen.add(key);
    return "NEW";
  }
  clear() {
    this.seen.clear();
  }
}
