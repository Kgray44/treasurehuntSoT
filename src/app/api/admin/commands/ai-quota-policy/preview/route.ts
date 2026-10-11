import { NextResponse } from "next/server";
import { requireAdmiraltyOperator } from "@/admiralty/authorization";
import { admiraltyErrorResponse, enforceAdmiraltyRateLimit, parseAdmiraltyBody } from "@/admiralty/http";
import { previewAdmiraltyCommand } from "@/admiralty/commands";
import { parallaxAIQuotaPort } from "@/admiralty/ports/parallax-ai-quota-command";
import { aiQuotaCommandSchema, aiQuotaCommandIdentity } from "@/parallax/ai-quota-commands";
export async function POST(request: Request) {
  try {
    const operator = await requireAdmiraltyOperator("CONFIG_OPERATE", { request });
    enforceAdmiraltyRateLimit(`ai-policy-preview:${operator.accountId}`, 20, 600000);
    const input = await parseAdmiraltyBody(request, aiQuotaCommandSchema),
      command = aiQuotaCommandIdentity(operator, input);
    const preview = await previewAdmiraltyCommand(parallaxAIQuotaPort(operator), command);
    return NextResponse.json({ preview }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (cause) {
    return admiraltyErrorResponse(cause);
  }
}
