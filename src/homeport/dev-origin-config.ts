const governedDevOrigins = ["127.0.0.1", "staging.absoluterelativesystems.com"] as const;

function normalizeExactHostname(value: string) {
  const hostname = value.trim().toLocaleLowerCase("en-US");
  if (!hostname) return null;
  if (hostname.includes("*") || hostname.includes("://") || hostname.includes("/") || hostname.includes(":"))
    throw new Error(
      `HOMEPORT_ALLOWED_DEV_ORIGINS requires exact hostnames without schemes, ports, paths, or wildcards: ${value}`,
    );
  const labels = hostname.split(".");
  if (hostname.length > 253 || labels.some((label) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u.test(label)))
    throw new Error(`HOMEPORT_ALLOWED_DEV_ORIGINS contains an invalid hostname: ${value}`);
  return hostname;
}

export function homeportAllowedDevOrigins(additional = process.env.HOMEPORT_ALLOWED_DEV_ORIGINS) {
  const configured =
    additional
      ?.split(",")
      .map(normalizeExactHostname)
      .filter((value) => value !== null) ?? [];
  return [...new Set([...governedDevOrigins, ...configured])];
}
