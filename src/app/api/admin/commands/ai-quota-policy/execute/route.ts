import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmiraltyOperator } from "@/admiralty/authorization";
import { requireRecentPrivilegedAssurance } from "@/admiralty/assurance";
import { admiraltyErrorResponse, enforceAdmiraltyRateLimit, parseAdmiraltyBody } from "@/admiralty/http";
import { aiQuotaCommandSchema, executeAIQuotaPolicy } from "@/parallax/ai-quota-commands";
const executeSchema = z.strictObject({ input: aiQuotaCommandSchema, previewId: z.uuid(), confirmed: z.literal(true) });
export async function POST(request: Request) {
  try {
    const operator = await requireAdmiraltyOperator("CONFIG_OPERATE", { request });
    enforceAdmiraltyRateLimit(`ai-policy-execute:${operator.accountId}`, 10, 600000);
    await requireRecentPrivilegedAssurance(operator);
    const body = await parseAdmiraltyBody(request, executeSchema);
    const receipt = await executeAIQuotaPolicy(operator, body.input, body.previewId);
    return NextResponse.json({ receipt }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (cause) {
    return admiraltyErrorResponse(cause);
  }
}
