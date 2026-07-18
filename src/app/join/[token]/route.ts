import { NextResponse } from "next/server";
import { setPendingInvitationToken } from "@/platform/auth";
import { resolveInvitation } from "@/platform/invitations";

export async function GET(request: Request, context: { params: Promise<{ token: string }> }) {
  const token = (await context.params).token;
  try {
    await resolveInvitation(token, false);
    await setPendingInvitationToken(token);
    return NextResponse.redirect(new URL("/player/invitation", request.url));
  } catch {
    return NextResponse.redirect(new URL("/player/invitation?state=invalid", request.url));
  }
}
