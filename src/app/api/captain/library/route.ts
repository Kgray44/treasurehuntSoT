import { NextResponse } from "next/server";
import { requireGmCapability } from "@/lib/security";
import { listCaptainLibrary } from "@/platform/libraries";

export async function GET() {
  const session = await requireGmCapability("CAPTAIN");
  if (!session) return NextResponse.json({ error: "Captain authentication required." }, { status: 401 });
  return NextResponse.json({ csrfToken: session.csrfToken, ...(await listCaptainLibrary(session.userId)) });
}
