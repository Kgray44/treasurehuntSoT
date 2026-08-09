import { NextResponse } from "next/server";
import { requireRecentPrivilegedAssurance } from "@/admiralty/assurance";
import { requireAdmiraltyOperator } from "@/admiralty/authorization";
import { admiraltyErrorResponse, enforceAdmiraltyRateLimit, parseAdmiraltyBody } from "@/admiralty/http";
import { supportReadSchema } from "@/admiralty/schemas";
import { readSupportAccessGrant } from "@/admiralty/support-access";

export async function POST(request: Request) {
  try {
    const operator = await requireAdmiraltyOperator("SUPPORT_USE", { request });
    await requireRecentPrivilegedAssurance(operator);
    const headers = enforceAdmiraltyRateLimit(`support-read:${operator.accountId}`, 30, 5 * 60_000);
    const input = await parseAdmiraltyBody(request, supportReadSchema);
    const projection = await readSupportAccessGrant(operator, input);
    return NextResponse.json(
      { ok: true, projection },
      { headers: { ...headers, "Cache-Control": "private, no-store" } },
    );
  } catch (cause) {
    return admiraltyErrorResponse(cause);
  }
}
