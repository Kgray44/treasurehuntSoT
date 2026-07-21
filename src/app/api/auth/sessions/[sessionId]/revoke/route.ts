import { NextResponse } from "next/server";
import { revokeAccountSession } from "@/wayfarer/accounts";
import { requireWayfarerAccount } from "@/wayfarer/http";
export async function POST(request: Request, context: { params: Promise<{ sessionId: string }> }) {
  const session = await requireWayfarerAccount(request);
  if (!session) return NextResponse.json({ error: "Sign in again to continue." }, { status: 401 });
  const { sessionId } = await context.params;
  try {
    await revokeAccountSession(session.accountId, sessionId);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }
}
