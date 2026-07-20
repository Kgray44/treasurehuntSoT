import { NextResponse } from "next/server";
import { requireGmCapability } from "@/lib/security";
import { listCaptainLibrary } from "@/platform/libraries";

export async function GET() {
  const session = await requireGmCapability("CAPTAIN");
  if (!session)
    return NextResponse.json({ error: "Sign in to Captain's Console to open this Voyage library." }, { status: 401 });
  return NextResponse.json({ csrfToken: session.csrfToken, ...(await listCaptainLibrary(session.userId)) });
}
