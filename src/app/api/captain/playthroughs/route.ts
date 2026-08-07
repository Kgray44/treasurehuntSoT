import { NextResponse } from "next/server";
import { requireCaptainWorkspace } from "@/chronicle/captain-authorization";
import { createPlaythroughAndInvitations } from "@/platform/invitations";
import { apiError } from "@/chronicle/api";
import { verifyWayfarerCsrf } from "@/wayfarer/http";

export async function POST(request: Request) {
  const session = await requireCaptainWorkspace();
  if (!session)
    return NextResponse.json({ error: "Sign in to Captain's Console to create a Voyage." }, { status: 401 });
  if (!verifyWayfarerCsrf(session, request))
    return NextResponse.json(
      { error: "Your Captain session expired. Sign in again; no Voyage or invitations were created." },
      { status: 403 },
    );
  try {
    return NextResponse.json(
      await createPlaythroughAndInvitations(await request.json(), session.accountId, new URL(request.url).origin),
      { status: 201 },
    );
  } catch (cause) {
    return apiError(cause);
  }
}
