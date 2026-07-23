import { NextResponse } from "next/server";
import { requireCanonicalAccountIdentity, verifyPlayerCsrf } from "@/platform/auth";

export async function requireExchangeActor(request: Request) {
  const identity = await requireCanonicalAccountIdentity();
  if (!identity || !(await verifyPlayerCsrf(request.headers.get("x-csrf-token")))) return null;
  return identity;
}

export function exchangeAccessDenied() {
  return NextResponse.json(
    { code: "COMMUNITY_ACCESS_DENIED", error: "A valid signed-in session is required to use the Exchange." },
    { status: 403 },
  );
}
