import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePlayer } from "@/lib/security";
const schema = z.object({ eventId: z.string().min(8), deviceId: z.string().min(8).max(128) });
export async function POST(request: Request, context: { params: Promise<{ campaignSlug: string }> }) {
  const { campaignSlug } = await context.params; const access = await requirePlayer(campaignSlug);
  if (!access) return NextResponse.json({ error: "Invitation required." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid acknowledgement." }, { status: 400 });
  await db.viewedCeremony.upsert({ where: { campaignId_deviceId_eventId: { campaignId: access.campaignId, ...parsed.data } }, update: {}, create: { campaignId: access.campaignId, ...parsed.data } });
  return NextResponse.json({ ok: true });
}
