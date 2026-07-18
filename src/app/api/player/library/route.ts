import { NextResponse } from "next/server";
import { requirePlayerIdentity } from "@/platform/auth";
import { listPlayerLibrary } from "@/platform/libraries";

export async function GET(request: Request) {
  const session = await requirePlayerIdentity();
  if (!session) return NextResponse.json({ error: "Player sign-in required." }, { status: 401 });
  const url = new URL(request.url);
  return NextResponse.json({
    ...(await listPlayerLibrary(session.playerProfileId, {
      search: url.searchParams.get("search") ?? undefined,
      state: url.searchParams.get("state") ?? undefined,
      sort: url.searchParams.get("sort") ?? undefined,
    })),
    csrfToken: session.csrfToken,
  });
}
