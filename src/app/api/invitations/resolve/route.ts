import { NextResponse } from "next/server";
import { readPendingInvitationCsrf, readPendingInvitationToken } from "@/platform/auth";
import { resolveInvitation } from "@/platform/invitations";
import { apiError } from "@/tall-tale/api";

export async function GET() {
  const credential = await readPendingInvitationToken();
  if (!credential) return NextResponse.json({ error: "This invitation is not available." }, { status: 404 });
  try {
    return NextResponse.json({
      invitation: await resolveInvitation(credential),
      csrfToken: await readPendingInvitationCsrf(),
    });
  } catch (cause) {
    return apiError(cause);
  }
}
