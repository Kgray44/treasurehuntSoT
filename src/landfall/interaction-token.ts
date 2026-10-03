import { z } from "zod";
import { landfallId } from "@/landfall/schema";
import { nativeJourneyScopeSchema, type NativeJourneyScope } from "@/landfall/background-navigation";

export const landfallInteractionClaimSchema = z.strictObject({
  version: z.literal(1),
  id: landfallId,
  keyId: landfallId,
  medium: z.enum(["QR", "NFC"]),
  scope: nativeJourneyScopeSchema,
  taleId: landfallId,
  issuedAt: z.number().int().nonnegative(),
  expiresAt: z.number().int().nonnegative(),
});
export type LandfallInteractionClaim = z.infer<typeof landfallInteractionClaimSchema>;
const encoder = new TextEncoder();
function decode(encoded: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(encoded)) throw new Error("LANDFALL_TOKEN_MALFORMED");
  const text = atob(encoded.replaceAll("-", "+").replaceAll("_", "/"));
  return Uint8Array.from(text, (char) => char.charCodeAt(0));
}
function encode(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}
export function landfallInteractionPayload(input: LandfallInteractionClaim): string {
  return encode(encoder.encode(JSON.stringify(landfallInteractionClaimSchema.parse(input))));
}
/** Signature keys are supplied by trusted configuration, never by tag/scanner payloads. No URLs or code execute. */
export async function verifyLandfallInteractionToken(
  token: string,
  input: {
    scope: NativeJourneyScope;
    taleId: string;
    medium: "QR" | "NFC";
    now: number;
    keys: ReadonlyMap<string, CryptoKey>;
  },
): Promise<LandfallInteractionClaim> {
  if (!Number.isFinite(input.now) || token.length > 2048 || token.length < 32)
    throw new Error("LANDFALL_TOKEN_MALFORMED");
  const [encoded, signature, extra] = token.split(".");
  if (!encoded || !signature || extra) throw new Error("LANDFALL_TOKEN_MALFORMED");
  let claim: LandfallInteractionClaim;
  let signed: Uint8Array;
  try {
    claim = landfallInteractionClaimSchema.parse(JSON.parse(new TextDecoder().decode(decode(encoded))));
    signed = decode(signature);
  } catch {
    throw new Error("LANDFALL_TOKEN_MALFORMED");
  }
  const key = input.keys.get(claim.keyId);
  if (!key || key.type !== "public" || key.algorithm.name !== "Ed25519" || signed.length !== 64)
    throw new Error("LANDFALL_TOKEN_SIGNATURE_INVALID");
  if (!(await crypto.subtle.verify("Ed25519", key, signed as BufferSource, encoder.encode(encoded))))
    throw new Error("LANDFALL_TOKEN_SIGNATURE_INVALID");
  if (
    claim.medium !== input.medium ||
    claim.taleId !== input.taleId ||
    Object.entries(input.scope).some(([field, value]) => claim.scope[field as keyof NativeJourneyScope] !== value)
  )
    throw new Error("LANDFALL_TOKEN_SCOPE_MISMATCH");
  if (
    claim.issuedAt > input.now + 1000 ||
    claim.expiresAt <= input.now ||
    claim.expiresAt <= claim.issuedAt ||
    claim.expiresAt - claim.issuedAt > 86400000
  )
    throw new Error("LANDFALL_TOKEN_EXPIRED");
  return claim;
}

/** Bounded replay cache augments canonical One Voyage idempotency; a scan never writes progression. */
export class LandfallInteractionReplayGuard {
  private readonly seen = new Map<string, number>();
  accept(claim: LandfallInteractionClaim, now: number): "NEW" | "DUPLICATE" | "EXPIRED" | "CAPACITY" {
    if (!Number.isFinite(now) || claim.expiresAt <= now) return "EXPIRED";
    for (const [id, expiresAt] of this.seen) if (expiresAt <= now) this.seen.delete(id);
    const key = `${claim.scope.playerProfileId}:${claim.scope.sessionId}:${claim.scope.publishedVersionId}:${claim.scope.expectedSequence}:${claim.id}`;
    if (this.seen.has(key)) return "DUPLICATE";
    if (this.seen.size >= 128) return "CAPACITY";
    this.seen.set(key, claim.expiresAt);
    return "NEW";
  }
  clear() {
    this.seen.clear();
  }
}
