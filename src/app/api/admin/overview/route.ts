import { NextResponse } from "next/server";
import { requireAdmiraltyOperator } from "@/admiralty/authorization";
import { admiraltyErrorResponse, enforceAdmiraltyRateLimit } from "@/admiralty/http";
import { admiraltyOverview } from "@/admiralty/projections";

export async function GET() {
  try {
    const operator = await requireAdmiraltyOperator("PLATFORM_OBSERVE");
    const headers = enforceAdmiraltyRateLimit(`overview:${operator.accountSessionId}`, 60, 60_000);
    return NextResponse.json(await admiraltyOverview(operator), {
      headers: { ...headers, "Cache-Control": "private, no-store" },
    });
  } catch (cause) {
    return admiraltyErrorResponse(cause);
  }
}
