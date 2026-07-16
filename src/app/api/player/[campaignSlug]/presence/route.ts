import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePlayer } from "@/lib/security";

const presenceSchema = z.object({
  deviceId: z.string().uuid(),
  route: z.string().max(255),
  visibility: z.enum(["visible", "hidden"]),
  acknowledgedSequence: z.number().int().nonnegative(),
  disconnected: z.boolean().optional(),
});

export async function POST(request: Request, context: { params: Promise<{ campaignSlug: string }> }) {
  const { campaignSlug } = await context.params;
  const access = await requirePlayer(campaignSlug);
  if (!access) return NextResponse.json({ error: "Player access required." }, { status: 401 });
  const parsed = presenceSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid presence update." }, { status: 400 });
  const now = new Date();
  await db.$transaction([
    db.playerAccess.update({ where: { id: access.id }, data: { lastSeenAt: now } }),
    db.playerPresence.upsert({
      where: { campaignId_deviceId: { campaignId: access.campaignId, deviceId: parsed.data.deviceId } },
      update: {
        route: parsed.data.route,
        visibility: parsed.data.visibility,
        acknowledgedSequence: parsed.data.acknowledgedSequence,
        lastHeartbeatAt: now,
        disconnectedAt: parsed.data.disconnected ? now : null,
      },
      create: {
        campaignId: access.campaignId,
        playerAccessId: access.id,
        deviceId: parsed.data.deviceId,
        route: parsed.data.route,
        visibility: parsed.data.visibility,
        acknowledgedSequence: parsed.data.acknowledgedSequence,
        disconnectedAt: parsed.data.disconnected ? now : null,
      },
    }),
  ]);
  return NextResponse.json({ recordedAt: now, state: parsed.data.disconnected ? "DISCONNECTED" : "CONNECTED" });
}
