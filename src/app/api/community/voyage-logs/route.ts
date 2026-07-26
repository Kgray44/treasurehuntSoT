import { NextResponse } from "next/server";

import { readPublicVoyageLogs } from "@/community/voyage-log-public";

function unavailable() {
  return NextResponse.json(
    { code: "COMMUNITY_PUBLIC_READ_UNAVAILABLE", error: "Public Voyage Logs are temporarily unavailable." },
    { status: 503 },
  );
}

export async function GET(request: Request) {
  if (new URL(request.url).search)
    return NextResponse.json(
      { code: "COMMUNITY_INVALID_QUERY", error: "Query parameters are not supported." },
      { status: 400 },
    );
  try {
    return NextResponse.json(await readPublicVoyageLogs());
  } catch {
    return unavailable();
  }
}
