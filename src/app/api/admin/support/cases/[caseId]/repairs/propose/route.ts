import { NextResponse } from "next/server";
import { requireAdmiraltyOperator } from "@/admiralty/authorization";
import { admiraltyErrorResponse, enforceAdmiraltyRateLimit, parseAdmiraltyBody } from "@/admiralty/http";
import { supportRepairProposalSchema } from "@/admiralty/schemas";
import { createSupportRepairProposal } from "@/admiralty/support-repair-service";

export async function POST(request: Request, context: { params: Promise<{ caseId: string }> }) {
  try {
    const operator = await requireAdmiraltyOperator("SUPPORT_USE", { request });
    const headers = enforceAdmiraltyRateLimit(`support-repair-proposal:${operator.accountId}`, 20, 10 * 60_000);
    const input = await parseAdmiraltyBody(request, supportRepairProposalSchema);
    const { caseId } = await context.params;
    const result = await createSupportRepairProposal(operator, { caseId, ...input });
    return NextResponse.json(
      { ok: true, proposal: result.proposal, preview: result.preview },
      { headers: { ...headers, "Cache-Control": "private, no-store" } },
    );
  } catch (cause) {
    return admiraltyErrorResponse(cause);
  }
}
