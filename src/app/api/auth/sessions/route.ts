import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { revokeAllAccountSessions } from "@/wayfarer/accounts";
import { requireWayfarerAccount } from "@/wayfarer/http";
export async function GET() {
  const session = await requireWayfarerAccount();
  if (!session) return NextResponse.json({ error: "Sign in again to continue." }, { status: 401 });
  const sessions = await db.accountSession.findMany({
    where: { accountId: session.accountId, revokedAt: null, expiresAt: { gt: new Date() } },
    select: { id: true, deviceLabel: true, createdAt: true, lastSeenAt: true, expiresAt: true },
    orderBy: { lastSeenAt: "desc" },
  });
  return NextResponse.json({
    csrfToken: session.csrfToken,
    sessions: sessions.map((item) => ({ ...item, current: item.id === session.id })),
  });
}
export async function DELETE(request: Request) {
  const session = await requireWayfarerAccount(request);
  if (!session) return NextResponse.json({ error: "Sign in again to continue." }, { status: 401 });
  await revokeAllAccountSessions(session.accountId, session.id);
  return NextResponse.json({ ok: true });
}
