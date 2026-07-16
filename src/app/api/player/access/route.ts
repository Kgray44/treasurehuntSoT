import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { setPlayerSession } from "@/lib/security";

const schema = z.object({ campaignSlug: z.string().min(3), accessCode: z.string().min(6).max(128) });
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "The invitation details are incomplete." }, { status: 400 });
  const campaign = await db.campaign.findUnique({
    where: { slug: parsed.data.campaignSlug },
    include: { playerAccesses: { take: 1 } },
  });
  if (
    !campaign ||
    !campaign.playerAccesses[0] ||
    !(await bcrypt.compare(parsed.data.accessCode, campaign.accessCodeHash))
  )
    return NextResponse.json({ error: "That invitation could not be recognized." }, { status: 401 });
  await setPlayerSession(campaign.playerAccesses[0].id);
  await db.playerAccess.update({ where: { id: campaign.playerAccesses[0].id }, data: { lastSeenAt: new Date() } });
  return NextResponse.json({ ok: true });
}
