import { NextResponse } from "next/server";
import { newAdmiraltyCommandRequest, previewAdmiraltyCommand } from "@/admiralty/commands";
import { requireAdmiraltyOperator } from "@/admiralty/authorization";
import { admiraltyErrorResponse, enforceAdmiraltyRateLimit, parseAdmiraltyBody } from "@/admiralty/http";
import { wayfarerSessionRevokePort } from "@/admiralty/ports/wayfarer-admin-command";
import { sessionRevokeSchema } from "@/admiralty/schemas";

export async function POST(request: Request) {
  try {
    const operator = await requireAdmiraltyOperator("SECURITY_OPERATE", { request });
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
    const preview = await previewAdmiraltyCommand(wayfarerSessionRevokePort(operator), command);
    return NextResponse.json(
      { ok: true, command, preview },
      { headers: enforceAdmiraltyRateLimit(`session-preview:${operator.accountId}`, 20, 10 * 60_000) },
    );
  } catch (cause) {
    return admiraltyErrorResponse(cause);
  }
}
