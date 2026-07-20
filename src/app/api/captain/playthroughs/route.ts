import { NextResponse } from "next/server";
import { requireGmCapability, verifyCsrf } from "@/lib/security";
import { createPlaythroughAndInvitations } from "@/platform/invitations";
import { apiError } from "@/tall-tale/api";

export async function POST(request: Request) {
  const session = await requireGmCapability("CAPTAIN");
  if (!session)
    return NextResponse.json({ error: "Sign in to Captain's Console to create a Voyage." }, { status: 401 });
  if (!(await verifyCsrf(session)))
    return NextResponse.json(
      { error: "Your Captain session expired. Sign in again; no Voyage or invitations were created." },
      { status: 403 },
    );
  try {
    return NextResponse.json(
      await createPlaythroughAndInvitations(await request.json(), session.userId, new URL(request.url).origin),
      { status: 201 },
    );
  } catch (cause) {
    return apiError(cause);
  }
}
