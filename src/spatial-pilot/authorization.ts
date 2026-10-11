import { requireWayfarerAccount } from "@/wayfarer/http";

export function pilotEnvironmentEnabled() {
  const url = (process.env.DATABASE_URL ?? "").replaceAll("\\", "/");
  const ownedPreview =
    process.env.SPATIAL_PILOT_ENABLED === "1" &&
    process.env.SPATIAL_PILOT_OWNER_ID === "spatial-pilot-navigator" &&
    url.startsWith("file:") &&
    url.includes("/artifacts/spatial-pilot/");
  const isolatedQualification =
    process.env.SOUNDING_LINE_SUITE_PROFILE === "generic" &&
    process.env.FOREVER_VALIDATION_ISOLATION === "1" &&
    process.env.SOUNDING_LINE_TASK_OWNED_HTTP === "1" &&
    /^[a-f0-9]{64}$/.test(process.env.FOREVER_VALIDATION_NONCE_HASH ?? "") &&
    /^file:.*\/artifacts\/sounding-line\/generic-[a-f0-9]{12}\/validation-isolated-\d{8}-\d{9}-[a-f0-9]{32}\.db$/.test(
      url,
    );
  return ownedPreview || isolatedQualification;
}

export async function requirePilotOwner(request?: Request) {
  if (!pilotEnvironmentEnabled()) return null;
  const session = await requireWayfarerAccount(request);
  return session?.accountId === "spatial-pilot-navigator" ? session : null;
}
