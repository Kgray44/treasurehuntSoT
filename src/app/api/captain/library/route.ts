import { NextResponse } from "next/server";
import { requireCaptainWorkspace } from "@/chronicle/captain-authorization";
import { listCaptainLibrary } from "@/platform/libraries";

export async function GET() {
  const session = await requireCaptainWorkspace();
  if (!session) return NextResponse.json({ error: "Sign in to Captain's Console to continue." }, { status: 401 });
  return NextResponse.json({
    csrfToken: session.csrfToken,
    ...(await listCaptainLibrary(session.account.legacyGameMasterId, session.accountId)),
  });
}
