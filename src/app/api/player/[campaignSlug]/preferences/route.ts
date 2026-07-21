import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireLegacyCompatibilityAccess } from "@/compatibility/legacy-companion";

const preferences = z.object({
  muted: z.boolean(),
  masterVolume: z.number().min(0).max(1),
  ambientVolume: z.number().min(0).max(1),
  effectsVolume: z.number().min(0).max(1),
  motionMode: z.enum(["SYSTEM", "FULL", "GENTLE", "REDUCED"]),
  textScale: z.number().min(0.85).max(1.5),
  ambientEffects: z.boolean(),
  textureIntensity: z.number().min(0).max(1),
  fullscreenPreferred: z.boolean(),
});

async function accessFor(campaignSlug: string) {
  return requireLegacyCompatibilityAccess(campaignSlug);
}

const defaults = {
  muted: false,
  masterVolume: 0.45,
  ambientVolume: 0.25,
  effectsVolume: 0.55,
  motionMode: "SYSTEM" as const,
  textScale: 1,
  ambientEffects: true,
  textureIntensity: 1,
  fullscreenPreferred: false,
};

function legacyPreferences(raw: string) {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return defaults;
    const value = (parsed as Record<string, unknown>).legacyCompanion;
    return value && typeof value === "object" && !Array.isArray(value) ? { ...defaults, ...value } : defaults;
  } catch {
    return defaults;
  }
}

export async function GET(_: Request, context: { params: Promise<{ campaignSlug: string }> }) {
  const { campaignSlug } = await context.params;
  const access = await accessFor(campaignSlug);
  if (!access) return NextResponse.json({ error: "Invitation required." }, { status: 401 });
  const player = await db.playerProfile.findUniqueOrThrow({
    where: { id: access.playerId },
    select: { preferences: true },
  });
  return NextResponse.json(legacyPreferences(player.preferences));
}

export async function PUT(request: Request, context: { params: Promise<{ campaignSlug: string }> }) {
  const { campaignSlug } = await context.params;
  const access = await accessFor(campaignSlug);
  if (!access) return NextResponse.json({ error: "Invitation required." }, { status: 401 });
  const parsed = preferences.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Those companion preferences are not valid." }, { status: 400 });
  const player = await db.playerProfile.findUniqueOrThrow({
    where: { id: access.playerId },
    select: { preferences: true },
  });
  let allPreferences: Record<string, unknown> = {};
  try {
    const parsedPreferences: unknown = JSON.parse(player.preferences);
    if (parsedPreferences && typeof parsedPreferences === "object" && !Array.isArray(parsedPreferences))
      allPreferences = parsedPreferences as Record<string, unknown>;
  } catch {}
  await db.playerProfile.update({
    where: { id: access.playerId },
    data: { preferences: JSON.stringify({ ...allPreferences, legacyCompanion: parsed.data }) },
  });
  return NextResponse.json(parsed.data);
}
