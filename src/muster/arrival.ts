import { db } from "@/lib/db";
import { loadMusterAccess, MusterError } from "./service";
import type { CanonicalCaptainActor } from "@/chronicle/captain-authorization";
import { EMBARKATION_VERSION } from "@/animation/embarkation/program";

type PresentationPreferences = {
  arrivals?: Record<string, { program: string; presentedAt: string }>;
  [key: string]: unknown;
};
function parse(value: string): PresentationPreferences {
  try {
    const p = JSON.parse(value);
    return p && typeof p === "object" && !Array.isArray(p) ? p : {};
  } catch {
    return {};
  }
}
export async function arrivalFor(voyageId: string, actor: CanonicalCaptainActor) {
  const profile = await db.playerProfile.findUnique({
    where: { accountId: actor.accountId },
    select: { id: true, displayName: true, claimedAt: true, preferences: true },
  });
  if (!profile) throw new MusterError("Your profile is unavailable.");
  return {
    person: { key: profile.id, displayName: profile.displayName, registered: Boolean(profile.claimedAt) },
    seen: Boolean(parse(profile.preferences).arrivals?.[voyageId]?.presentedAt),
    program: EMBARKATION_VERSION,
  };
}
export async function recordArrival(voyageId: string, actor: CanonicalCaptainActor) {
  await loadMusterAccess(voyageId, actor, db, true);
  // Use the existing per-person presentation store alongside journals. Compare
  // the entire prior payload so an arrival cannot discard concurrent preferences.
  for (let attempt = 0; attempt < 4; attempt++) {
    const profile = await db.playerProfile.findUnique({
      where: { accountId: actor.accountId },
      select: { id: true, preferences: true },
    });
    if (!profile) throw new MusterError("Your profile is unavailable.");
    const prefs = parse(profile.preferences);
    if (prefs.arrivals?.[voyageId]?.presentedAt) return;
    const result = await db.playerProfile.updateMany({
      where: { id: profile.id, preferences: profile.preferences },
      data: {
        preferences: JSON.stringify({
          ...prefs,
          arrivals: {
            ...prefs.arrivals,
            [voyageId]: { program: EMBARKATION_VERSION, presentedAt: new Date().toISOString() },
          },
        }),
      },
    });
    if (result.count) return;
  }
  throw new MusterError("Your presentation state changed. Please try again.", 409);
}
