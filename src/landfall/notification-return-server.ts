import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { nativeJourneyScopeSchema, type NativeJourneyScope } from "@/landfall/background-navigation";
import { landfallPackageSigningKey } from "@/landfall/offline-package-server";

const claimSchema = z.strictObject({
  version: z.literal(1),
  scope: nativeJourneyScopeSchema,
  issuedAt: z.number().int().nonnegative(),
  expiresAt: z.number().int().nonnegative(),
});
const aad = Buffer.from("landfall-notification-return-v1");
function key() {
  const signing = landfallPackageSigningKey();
  if (!signing) throw new Error("LANDFALL_RETURN_NOT_CONFIGURED");
  return createHash("sha256")
    .update(signing.privateKey.export({ format: "der", type: "pkcs8" }))
    .update(aad)
    .digest();
}
/** Opaque, actor-bound navigation claim. Not an arrival receipt or authorization grant. */
export function mintLandfallReturnHandle(
  scope: NativeJourneyScope,
  issuedAt = Date.now(),
  expiresAt = issuedAt + 3600_000,
) {
  const claim = claimSchema.parse({ version: 1, scope, issuedAt, expiresAt });
  if (expiresAt <= issuedAt || expiresAt - issuedAt > 86400_000) throw new Error("LANDFALL_RETURN_EXPIRY_INVALID");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(aad);
  const bytes = Buffer.concat([cipher.update(JSON.stringify(claim), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), bytes]).toString("base64url");
}
export function readLandfallReturnHandle(handle: string, now = Date.now()) {
  if (!/^[A-Za-z0-9_-]{32,2048}$/.test(handle)) throw new Error("LANDFALL_RETURN_INVALID");
  try {
    const bytes = Buffer.from(handle, "base64url");
    const decipher = createDecipheriv("aes-256-gcm", key(), bytes.subarray(0, 12));
    decipher.setAAD(aad);
    decipher.setAuthTag(bytes.subarray(12, 28));
    const claim = claimSchema.parse(
      JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString("utf8")),
    );
    if (claim.issuedAt > now || claim.expiresAt <= now || claim.expiresAt - claim.issuedAt > 86400_000)
      throw new Error("expired");
    return claim;
  } catch {
    throw new Error("LANDFALL_RETURN_INVALID_OR_EXPIRED");
  }
}
