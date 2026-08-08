import { safeReturnTo } from "./return-to";

const bindOnlyHostnames = new Set(["0.0.0.0", "::", "[::]"]);
const internalHostnameSuffixes = [".internal", ".local", ".localdomain"];

export class PublicAppOriginError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PublicAppOriginError";
  }
}

function isPrivateIpv4(hostname: string) {
  const octets = hostname.split(".").map(Number);
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) return false;
  const [first, second] = octets;
  return (
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 100 && second >= 64 && second <= 127)
  );
}

function isPrivateIpv6(hostname: string) {
  const normalized = hostname.replace(/^\[|\]$/gu, "").toLowerCase();
  return normalized === "::1" || /^f[cd][0-9a-f]:/u.test(normalized) || /^fe[89ab][0-9a-f]:/u.test(normalized);
}

function isInternalProductionHostname(hostname: string) {
  const normalized = hostname.toLowerCase();
  return (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    (!normalized.includes(".") && !normalized.includes(":")) ||
    internalHostnameSuffixes.some((suffix) => normalized.endsWith(suffix)) ||
    isPrivateIpv4(normalized) ||
    isPrivateIpv6(normalized)
  );
}

export function canonicalPublicAppOrigin() {
  const configured =
    process.env.HOMEPORT_PUBLIC_APP_ORIGIN?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim() || undefined;
  const value = configured ?? (process.env.NODE_ENV === "production" ? undefined : "http://localhost:3000");
  if (!value) throw new PublicAppOriginError("The public application origin is not configured.");

  let origin: URL;
  try {
    origin = new URL(value);
  } catch {
    throw new PublicAppOriginError("The public application origin is invalid.");
  }
  if (
    !["http:", "https:"].includes(origin.protocol) ||
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash
  )
    throw new PublicAppOriginError("The public application origin must be an exact HTTP or HTTPS origin.");

  if (bindOnlyHostnames.has(origin.hostname.toLowerCase()))
    throw new PublicAppOriginError("A server bind address cannot be used as the public application origin.");
  if (process.env.NODE_ENV === "production" && isInternalProductionHostname(origin.hostname))
    throw new PublicAppOriginError(
      "A loopback, private, or internal host cannot be used as the production public origin.",
    );

  return new URL(origin.origin);
}

export function publicAppUrl(path: string) {
  const safePath = safeReturnTo(path, "");
  if (!safePath || safePath !== path)
    throw new PublicAppOriginError("The public application destination must be an application-relative path.");
  return new URL(safePath, canonicalPublicAppOrigin());
}
