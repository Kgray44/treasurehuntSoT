import { NextResponse } from "next/server";
import { reauthenticatePrivilegedOperator } from "@/admiralty/assurance";
import { requireAdmiraltyOperator } from "@/admiralty/authorization";
import { admiraltyErrorResponse, enforceAdmiraltyRateLimit, parseAdmiraltyBody } from "@/admiralty/http";
import { reauthenticationSchema } from "@/admiralty/schemas";

export async function POST(request: Request) {
  try {
    const operator = await requireAdmiraltyOperator("PLATFORM_OBSERVE", { request });
    const headers = enforceAdmiraltyRateLimit(`reauth:${operator.accountId}`, 5, 15 * 60_000);
    const input = await parseAdmiraltyBody(request, reauthenticationSchema);
    const assurance = await reauthenticatePrivilegedOperator(operator, input.password);
    return NextResponse.json(
      {
        ok: true,
        assurance: {
          level: assurance.assuranceLevel,
          method: assurance.method,
          issuedAt: assurance.issuedAt,
          expiresAt: assurance.expiresAt,
        },
      },
      { headers },
    );
  } catch (cause) {
    return admiraltyErrorResponse(cause);
  }
}
