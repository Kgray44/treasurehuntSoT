import { NextResponse } from "next/server";
import { executeAdmiraltyCommand, newAdmiraltyCommandRequest, previewAdmiraltyCommand } from "@/admiralty/commands";
import { requireRecentPrivilegedAssurance } from "@/admiralty/assurance";
import { requireAdmiraltyOperator } from "@/admiralty/authorization";
import { admiraltyErrorResponse, enforceAdmiraltyRateLimit, parseAdmiraltyBody } from "@/admiralty/http";
import { wayfarerAccountSuspendPort } from "@/admiralty/ports/wayfarer-admin-command";
import { accountSuspendSchema } from "@/admiralty/schemas";
export async function POST(request: Request) {
  try {
    const operator = await requireAdmiraltyOperator("ACCOUNT_OPERATE", { request });
    await requireRecentPrivilegedAssurance(operator);
    const input = await parseAdmiraltyBody(request, accountSuspendSchema);
    const command = newAdmiraltyCommandRequest({ commandType: "ACCOUNT_SUSPEND", actorAccountId: operator.accountId, targetType: "UserAccount", targetId: input.targetAccountId, expectedRevision: input.expectedUpdatedAt, reason: input.reason, idempotencyKey: input.idempotencyKey, input: { expectedUpdatedAt: input.expectedUpdatedAt } });
    const port = wayfarerAccountSuspendPort(operator);
    return NextResponse.json({ ok: true, receipt: await executeAdmiraltyCommand(port, command, await previewAdmiraltyCommand(port, command)) }, { headers: enforceAdmiraltyRateLimit(`account-suspend-execute:${operator.accountId}`, 5, 10 * 60_000) });
  } catch (cause) { return admiraltyErrorResponse(cause); }
}
