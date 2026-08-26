import { NextResponse } from "next/server";
import { requirePlayerIdentity, verifyPlayerCsrf } from "@/platform/auth";
import { decideInvitationFromPlayerLibrary, InvitationUnavailableError } from "@/platform/invitations";

export async function POST(request: Request, context: { params: Promise<{ invitationId: string }> }) {
  const identity = await requirePlayerIdentity();
  if (!identity) return NextResponse.json({ error: "Player sign-in required." }, { status: 401 });
  if (!(await verifyPlayerCsrf(request.headers.get("x-csrf-token"))))
    return NextResponse.json({ error: "The Player session expired. Your invitation is unchanged." }, { status: 403 });
  const body = (await request.json().catch(() => null)) as { decision?: unknown } | null;
  if (body?.decision !== "accept" && body?.decision !== "decline")
    return NextResponse.json({ error: "Choose accept or decline for this invitation." }, { status: 400 });
  try {
    return NextResponse.json(
      await decideInvitationFromPlayerLibrary({
        invitationId: (await context.params).invitationId,
        playerProfileId: identity.playerProfileId,
        decision: body.decision,
      }),
    );
  } catch (cause) {
    if (cause instanceof InvitationUnavailableError)
      return NextResponse.json(
        { error: cause.message, code: cause.code },
        { status: cause.code === "CONFLICT" ? 409 : 410 },
      );
    return NextResponse.json({ error: "The invitation could not be updated." }, { status: 400 });
  }
}
