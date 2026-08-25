import { NextResponse } from "next/server";
import { requireRecentPrivilegedAssurance } from "@/admiralty/assurance";
import { requireAdmiraltyOperator } from "@/admiralty/authorization";
import { admiraltyErrorResponse, enforceAdmiraltyRateLimit, parseAdmiraltyBody } from "@/admiralty/http";
import { supportTideglassDiagnosticSchema } from "@/admiralty/schemas";
import { readSupportAccessGrant } from "@/admiralty/support-access";
import { tideglassDiagnosticProjection } from "@/tideglass/diagnostics";
import { compareExactEditions, prismaTideglassEditionRepository } from "@/tideglass/service";

export async function POST(request: Request) {
  try {
    const operator = await requireAdmiraltyOperator("SUPPORT_USE", { request });
    await requireRecentPrivilegedAssurance(operator);
    const headers = enforceAdmiraltyRateLimit(`support-tideglass:${operator.accountId}`, 20, 5 * 60_000);
    const input = await parseAdmiraltyBody(request, supportTideglassDiagnosticSchema);
    await readSupportAccessGrant(operator, {
      grantId: input.grantId,
      targetAccountId: input.targetAccountId,
      scope: "TIDEGLASS_DIAGNOSTICS",
    });
    const result = await compareExactEditions(
      prismaTideglassEditionRepository,
      { kind: "ACCOUNT", accountId: input.targetAccountId },
      {
        chronicleId: input.chronicleId,
        sourceEditionId: input.sourceEditionId,
        targetEditionId: input.targetEditionId,
      },
    );
    return NextResponse.json(
      { ok: true, diagnostic: tideglassDiagnosticProjection(result) },
      { headers: { ...headers, "Cache-Control": "private, no-store" } },
    );
  } catch (cause) {
    return admiraltyErrorResponse(cause);
  }
}
