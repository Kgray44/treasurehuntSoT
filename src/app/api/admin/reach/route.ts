import { NextResponse } from "next/server";
import { requireAdmiraltyOperator } from "@/admiralty/authorization";
import { enforceAdmiraltyRateLimit } from "@/admiralty/http";
import { getReachAdminOverview } from "@/reach/admin-service";
import { reachErrorResponse, reachPrivateHeaders } from "@/reach/http";

export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const operator = await requireAdmiraltyOperator("CONFIG_OBSERVE");
    enforceAdmiraltyRateLimit(`reach-admin-read:${operator.accountId}`, 60, 300000);
    return NextResponse.json(await getReachAdminOverview(operator), { headers: reachPrivateHeaders });
  } catch (cause) {
    return reachErrorResponse(cause);
  }
}
