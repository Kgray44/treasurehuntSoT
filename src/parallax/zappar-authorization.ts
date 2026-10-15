import { z } from "zod";

/** A private owner-supplied entitlement record, never a license issued by Voyagewright. */
export const zapparAuthorizationSchema = z.strictObject({
  schemaVersion: z.literal(1),
  sdkVersion: z.literal("4.4.0"),
  ownerAuthorized: z.literal(true),
  activeEntitlement: z.enum(["TRIAL", "COMMERCIAL"]),
  expiresAt: z.string().datetime(),
  termsAcceptedByOwner: z.literal(true),
  domainAuthorization: z.enum(["VENDOR_TEST_EXEMPTION", "REGISTERED_SELF_HOSTING"]),
  permittedOrigins: z.array(z.string().url()).min(1).max(8),
  scriptSha256: z.string().regex(/^[a-f0-9]{64}$/),
});

export function admitZapparAuthorization(raw: unknown, origin: string, now = Date.now()) {
  const parsed = zapparAuthorizationSchema.safeParse(raw);
  if (!parsed.success || !Number.isFinite(now) || Date.parse(parsed.data.expiresAt) <= now) return null;
  let requested: URL;
  try {
    requested = new URL(origin);
  } catch {
    return null;
  }
  if (requested.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(requested.hostname)) return null;
  const host = requested.hostname;
  const testExempt =
    /^(?:192|10|127)\.[0-9.]+$/.test(host) ||
    host === "0.0.0.0" ||
    host.endsWith(".ngrok.io") ||
    host.endsWith(".zappar.io");
  if (parsed.data.domainAuthorization === "VENDOR_TEST_EXEMPTION" && !testExempt) return null;
  if (parsed.data.domainAuthorization === "REGISTERED_SELF_HOSTING" && parsed.data.activeEntitlement !== "COMMERCIAL")
    return null;
  // Exact origins: no wildcard licenses, forwarded host inference, or path-based origin matches.
  if (!parsed.data.permittedOrigins.some((entry) => entry === requested.origin)) return null;
  return parsed.data;
}
