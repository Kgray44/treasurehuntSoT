import { NextResponse } from "next/server";
import { executeAdmiraltyCommand, newAdmiraltyCommandRequest, previewAdmiraltyCommand } from "@/admiralty/commands";
import { requireRecentPrivilegedAssurance } from "@/admiralty/assurance";
import { requireAdmiraltyOperator } from "@/admiralty/authorization";
import { admiraltyErrorResponse, enforceAdmiraltyRateLimit, parseAdmiraltyBody } from "@/admiralty/http";
import { wayfarerSessionRevokePort } from "@/admiralty/ports/wayfarer-admin-command";
import { sessionRevokeSchema } from "@/admiralty/schemas";

export async function POST(request: Request) {
  try {
    const operator = await requireAdmiraltyOperator("SECURITY_OPERATE", { request });
    await requireRecentPrivilegedAssurance(operator);
    const input = await parseAdmiraltyBody(request, sessionRevokeSchema);
    const command = newAdmiraltyCommandRequest({
      commandType: "SESSION_REVOKE",
      actorAccountId: operator.accountId,
      targetType: "UserAccount",
      targetId: input.targetAccountId,
      reason: input.reason,
      idempotencyKey: input.idempotencyKey,
      input: { sessionId: input.sessionId },
    });
    const port = wayfarerSessionRevokePort(operator);
    const preview = await previewAdmiraltyCommand(port, command);
    const receipt = await executeAdmiraltyCommand(port, command, preview);
    return NextResponse.json({ ok: true, receipt }, { headers: enforceAdmiraltyRateLimit(`session-execute:${operator.accountId}`, 10, 10 * 60_000) });
  } catch (cause) {
    return admiraltyErrorResponse(cause);
  }
}
