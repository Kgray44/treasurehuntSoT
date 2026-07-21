import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireLegacyCompatibilityAccess } from "@/compatibility/legacy-companion";

const presenceSchema = z.object({
  deviceId: z.string().uuid(),
  route: z.string().max(255),
  visibility: z.enum(["visible", "hidden"]),
  acknowledgedSequence: z.number().int().nonnegative(),
  disconnected: z.boolean().optional(),
});

export async function POST(request: Request, context: { params: Promise<{ campaignSlug: string }> }) {
  const { campaignSlug } = await context.params;
  const access = await requireLegacyCompatibilityAccess(campaignSlug);
  if (!access) return NextResponse.json({ error: "Player access required." }, { status: 401 });
  const parsed = presenceSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid presence update." }, { status: 400 });
  const now = new Date();
  await db.$transaction([
    db.playerProfile.update({ where: { id: access.playerId }, data: { lastSeenAt: now } }),
    db.taleSession.update({
      where: { id: access.sessionId },
      data: { lastHeartbeatAt: parsed.data.disconnected ? undefined : now },
    }),
  ]);
  return NextResponse.json({ recordedAt: now, state: parsed.data.disconnected ? "DISCONNECTED" : "CONNECTED" });
}
