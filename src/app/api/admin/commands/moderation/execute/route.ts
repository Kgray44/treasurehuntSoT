import { NextResponse } from "next/server";
import { executeAdmiraltyCommand, newAdmiraltyCommandRequest, previewAdmiraltyCommand } from "@/admiralty/commands";
import { requireRecentPrivilegedAssurance } from "@/admiralty/assurance";
import { requireAdmiraltyOperator } from "@/admiralty/authorization";
import { admiraltyErrorResponse, enforceAdmiraltyRateLimit, parseAdmiraltyBody } from "@/admiralty/http";
import { harborlightModerationPort } from "@/admiralty/ports/harborlight-admin-command";
import { moderationActionSchema } from "@/admiralty/schemas";

export async function POST(request: Request) {
  try {
    const operator = await requireAdmiraltyOperator("COMMUNITY_MODERATE", { request });
    await requireRecentPrivilegedAssurance(operator);
    const input = await parseAdmiraltyBody(request, moderationActionSchema);
    const command = newAdmiraltyCommandRequest({ commandType: "MODERATION_ACTION", actorAccountId: operator.accountId, targetType: input.subjectType, targetId: input.subjectId, reason: input.reason, idempotencyKey: input.idempotencyKey, input: { caseId: input.caseId, subjectType: input.subjectType, actionType: input.actionType, expectedRevision: input.expectedRevision, reasonCode: input.reasonCode, secondReviewerId: input.secondReviewerId } });
    const port = harborlightModerationPort(operator);
    const receipt = await executeAdmiraltyCommand(port, command, await previewAdmiraltyCommand(port, command));
    return NextResponse.json({ ok: true, receipt }, { headers: enforceAdmiraltyRateLimit(`moderation-execute:${operator.accountId}`, 10, 10 * 60_000) });
  } catch (cause) { return admiraltyErrorResponse(cause); }
}
