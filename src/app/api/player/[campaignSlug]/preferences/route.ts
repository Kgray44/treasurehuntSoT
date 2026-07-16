import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePlayer } from "@/lib/security";

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
  return requirePlayer(campaignSlug);
}

export async function GET(_: Request, context: { params: Promise<{ campaignSlug: string }> }) {
  const { campaignSlug } = await context.params;
  const access = await accessFor(campaignSlug);
  if (!access) return NextResponse.json({ error: "Invitation required." }, { status: 401 });
  const value = await db.audioPreference.findUnique({ where: { playerAccessId: access.id } });
  return NextResponse.json(
    value ?? {
      muted: false,
      masterVolume: 0.45,
      ambientVolume: 0.25,
      effectsVolume: 0.55,
      motionMode: "SYSTEM",
      textScale: 1,
      ambientEffects: true,
      textureIntensity: 1,
      fullscreenPreferred: false,
    },
  );
}

export async function PUT(request: Request, context: { params: Promise<{ campaignSlug: string }> }) {
  const { campaignSlug } = await context.params;
  const access = await accessFor(campaignSlug);
  if (!access) return NextResponse.json({ error: "Invitation required." }, { status: 401 });
  const parsed = preferences.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Those companion preferences are not valid." }, { status: 400 });
  const value = await db.audioPreference.upsert({
    where: { playerAccessId: access.id },
    update: parsed.data,
    create: { playerAccessId: access.id, ...parsed.data },
  });
  return NextResponse.json(value);
}
