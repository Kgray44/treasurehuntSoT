import { NextResponse } from "next/server";
import { enforceAdmiraltyRateLimit } from "@/admiralty/http";
import { readReachRuntimePolicy } from "@/reach/admin-service";
import { reachErrorResponse, reachPrivateHeaders, reachRequestAddress } from "@/reach/http";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    enforceAdmiraltyRateLimit("reach-public-policy-global", 5000, 60000);
    enforceAdmiraltyRateLimit(`reach-public-policy:${reachRequestAddress(request)}`, 600, 60000);
    return NextResponse.json(await readReachRuntimePolicy(), { headers: reachPrivateHeaders });
  } catch (cause) {
    return reachErrorResponse(cause);
  }
}
