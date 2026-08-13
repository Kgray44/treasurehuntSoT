import { NextResponse } from "next/server";
import { newAdmiraltyCommandRequest, previewAdmiraltyCommand } from "@/admiralty/commands";
import { requireAdmiraltyOperator } from "@/admiralty/authorization";
import { admiraltyErrorResponse, enforceAdmiraltyRateLimit, parseAdmiraltyBody } from "@/admiralty/http";
import { wayfarerAccountSuspendPort } from "@/admiralty/ports/wayfarer-admin-command";
import { accountSuspendSchema } from "@/admiralty/schemas";
export async function POST(request: Request) {
  try {
    const operator = await requireAdmiraltyOperator("ACCOUNT_OPERATE", { request });
    const input = await parseAdmiraltyBody(request, accountSuspendSchema);
    const command = newAdmiraltyCommandRequest({ commandType: "ACCOUNT_SUSPEND", actorAccountId: operator.accountId, targetType: "UserAccount", targetId: input.targetAccountId, expectedRevision: input.expectedUpdatedAt, reason: input.reason, idempotencyKey: input.idempotencyKey, input: { expectedUpdatedAt: input.expectedUpdatedAt } });
    return NextResponse.json({ ok: true, command, preview: await previewAdmiraltyCommand(wayfarerAccountSuspendPort(operator), command) }, { headers: enforceAdmiraltyRateLimit(`account-suspend-preview:${operator.accountId}`, 10, 10 * 60_000) });
  } catch (cause) { return admiraltyErrorResponse(cause); }
}
