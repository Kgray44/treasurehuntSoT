import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { z } from "zod";

const authorizationSchema = z.strictObject({
  schemaVersion: z.literal(1),
  sdkVersion: z.literal("1.0.0"),
  ownerAuthorized: z.literal(true),
  purpose: z.literal("PRIVATE_APPLICATION_EVALUATION"),
  licenseAcceptedByOwner: z.literal(true),
  independentResearchExcluded: z.literal(true),
  expiresAt: z.string().datetime(),
  permittedOrigins: z.array(z.string().url()).min(1).max(8),
});

// Original vendor files only. The public metadata hashes do not grant a license.
export const eighthwallAssets = {
  "xr.js": [1036695, "s5c5NoYvTLd64y0k8lPYoOix3k+ioM9oiDN0KInugp0=", "text/javascript"],
  "xr-slam.js": [5538007, "OY9nXJIIkq/UUh1Rlt8ra4obipC2pcdJz1rRpuCoUnA=", "text/javascript"],
  LICENSE: [15994, "7RZv8eUALNdVfyxZWiOYsJLnZIEHDmvDslPlFRfzrmE=", "text/plain; charset=utf-8"],
  "resources/media-worker.js": [4995543, "20fInKLsfZ66deEUwZWJbHTHsP+IjOKXDf2b2L3+2o0=", "text/javascript"],
  "resources/powered-by.svg": [6056, "TIvxN3GAesVclj/AhCH2EebhqzfVQQ3Au/BJ+UvqB5c=", "image/svg+xml"],
} as const;

export function admitEighthwallAuthorization(raw: unknown, origin: string, now = Date.now()) {
  const parsed = authorizationSchema.safeParse(raw);
  if (!parsed.success || !Number.isFinite(now) || Date.parse(parsed.data.expiresAt) <= now) return false;
  try {
    const url = new URL(origin);
    return (
      (url.protocol === "https:" || (url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname))) &&
      parsed.data.permittedOrigins.includes(url.origin)
    );
  } catch {
    return false;
  }
}

export async function eighthwallAuthorized(origin: string) {
  try {
    return admitEighthwallAuthorization(
      JSON.parse(
        await readFile(resolve("tmp/browser-ar-local-assets/eighthwall-1.0.0/authorization.private.json"), "utf8"),
      ),
      origin,
    );
  } catch {
    return false;
  }
}

export async function readEighthwallAsset(asset: string, origin: string) {
  if (!Object.hasOwn(eighthwallAssets, asset) || !(await eighthwallAuthorized(origin))) return null;
  const [size, digest, type] = eighthwallAssets[asset as keyof typeof eighthwallAssets];
  try {
    const bytes = await readFile(resolve("tmp/browser-ar-local-assets/eighthwall-1.0.0/package/dist", asset));
    if (bytes.length !== size || createHash("sha256").update(bytes).digest("base64") !== digest) return null;
    return { bytes, type };
  } catch {
    return null;
  }
}

export async function eighthwallAvailability(origin: string) {
  const files = await Promise.all(Object.keys(eighthwallAssets).map((asset) => readEighthwallAsset(asset, origin)));
  if (files.some((file) => !file)) return null;
  return {
    version: "1.0.0" as const,
    scriptUrl: "/api/dev/parallax-tracker/xr.js",
    integrity: `sha256-${eighthwallAssets["xr.js"][1]}`,
  };
}
