import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
/** No database, cookies, identity, location, secrets or runtime provider probes. */
export function GET(request: Request) {
  const challenge = new URL(request.url).searchParams.get("challenge");
  const headers = { "Cache-Control": "no-store, max-age=0", "X-Content-Type-Options": "nosniff" };
  if (!challenge || !/^[a-f0-9-]{36}$/.test(challenge))
    return NextResponse.json({ error: "Invalid reachability challenge." }, { status: 400, headers });
  return NextResponse.json({ landfall: "reachable", challenge }, { headers });
}
