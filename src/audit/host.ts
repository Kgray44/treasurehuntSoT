type AuditEnvironment = Record<string, string | undefined>;

function exactHostname(value: string | undefined) {
  const hostname = value?.trim().toLowerCase();
  if (!hostname || hostname.length > 253 || hostname.includes(":") || hostname.includes("/") || hostname.includes("*"))
    return null;
  return hostname.split(".").every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u.test(label)) ? hostname : null;
}

function originHostname(value: string | undefined) {
  if (!value) return null;
  try {
    const origin = new URL(value);
    if (origin.origin !== value || !["http:", "https:"].includes(origin.protocol)) return null;
    return origin.hostname.toLowerCase();
  } catch {
    return null;
  }
}

function requestHostname(value: string | null) {
  if (!value) return null;
  try {
    return new URL(`http://${value}`).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function auditModeEnabled(environment: AuditEnvironment = process.env) {
  return environment.VOYAGEWRIGHT_AUDIT_MODE?.trim() === "true";
}

/** This deliberately has no Node-only dependencies so Next's request proxy can
 * reject unapproved hosts before an audit route is reached. */
export function auditRequestHostAllowed(host: string | null, environment: AuditEnvironment = process.env) {
  if (!auditModeEnabled(environment)) return true;
  const expected = exactHostname(environment.VOYAGEWRIGHT_AUDIT_HOSTNAME);
  const local = originHostname(environment.VOYAGEWRIGHT_AUDIT_LOCAL_ORIGIN);
  const actual = requestHostname(host);
  return Boolean(actual && expected && local && (actual === expected || actual === local));
}

export function auditAllowsLocalPublicOrigin(origin: URL, environment: AuditEnvironment = process.env) {
  if (!auditModeEnabled(environment)) return false;
  const configured = environment.VOYAGEWRIGHT_AUDIT_PUBLIC_ORIGIN?.trim();
  if (!configured || origin.origin !== configured) return false;
  const expected = exactHostname(environment.VOYAGEWRIGHT_AUDIT_HOSTNAME);
  return Boolean(
    expected &&
      origin.hostname.toLowerCase() === expected &&
      (expected === "localhost" || expected.endsWith(".localhost")),
  );
}
