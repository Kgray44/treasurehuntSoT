import { NextResponse } from "next/server";
import {
  clearPendingInvitationToken,
  readPendingInvitationToken,
  requirePlayerIdentity,
  verifyPendingInvitationCsrf,
} from "@/platform/auth";
import { declineInvitation } from "@/platform/invitations";
import { apiError } from "@/chronicle/api";

export async function POST(request: Request) {
  if (!(await verifyPendingInvitationCsrf(request.headers.get("x-csrf-token"))))
    return NextResponse.json({ error: "The invitation session expired. Open the invitation again." }, { status: 403 });
  const credential = await readPendingInvitationToken();
  if (!credential) return NextResponse.json({ error: "This invitation is not available." }, { status: 404 });
  try {
    const identity = await requirePlayerIdentity();
    const result = await declineInvitation(credential, identity?.playerProfileId);
    await clearPendingInvitationToken();
    return NextResponse.json(result);
  } catch (cause) {
    return apiError(cause);
  }
}
