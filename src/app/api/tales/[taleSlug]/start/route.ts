import { NextResponse } from "next/server";
import { apiError } from "@/chronicle/api";
import { startTaleSession } from "@/chronicle/progression";
import { setTaleSessionCookie } from "@/chronicle/session-cookie";
import { requireWayfarerAccount } from "@/wayfarer/http";

export async function POST(request: Request, context: { params: Promise<{ taleSlug: string }> }) {
  try {
    const body = (await request.json().catch(() => ({}))) as { ownerLabel?: string; aliasEdited?: boolean };
    const account = await requireWayfarerAccount();
    if (account && !(await requireWayfarerAccount(request)))
      return NextResponse.json({ error: "A valid signed-in session is required." }, { status: 403 });
    const result = await startTaleSession((await context.params).taleSlug, {
      ownerLabel: body.ownerLabel,
      aliasEdited: Boolean(body.aliasEdited),
      accountId: account?.accountId,
      profileId: account?.account.profile?.id,
      canonicalDisplayName: account?.account.profile?.displayName,
    });
    await setTaleSessionCookie(result.sessionId, result.token);
    return NextResponse.json(
      { sessionId: result.sessionId, url: `/play/${result.taleSlug}/session/${result.sessionId}` },
      { status: 201 },
    );
  } catch (cause) {
    return apiError(cause);
  }
}
