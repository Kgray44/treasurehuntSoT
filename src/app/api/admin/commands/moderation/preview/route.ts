import { NextResponse } from "next/server";
import { newAdmiraltyCommandRequest, previewAdmiraltyCommand } from "@/admiralty/commands";
import { requireAdmiraltyOperator } from "@/admiralty/authorization";
import { admiraltyErrorResponse, enforceAdmiraltyRateLimit, parseAdmiraltyBody } from "@/admiralty/http";
import { harborlightModerationPort } from "@/admiralty/ports/harborlight-admin-command";
import { moderationActionSchema } from "@/admiralty/schemas";

export async function POST(request: Request) {
  try {
    const operator = await requireAdmiraltyOperator("COMMUNITY_MODERATE", { request });
    const input = await parseAdmiraltyBody(request, moderationActionSchema);
    const command = newAdmiraltyCommandRequest({
      commandType: "MODERATION_ACTION",
      actorAccountId: operator.accountId,
      targetType: input.subjectType,
      targetId: input.subjectId,
      reason: input.reason,
      idempotencyKey: input.idempotencyKey,
      input: {
        caseId: input.caseId,
        subjectType: input.subjectType,
        actionType: input.actionType,
        expectedRevision: input.expectedRevision,
        reasonCode: input.reasonCode,
        secondReviewerId: input.secondReviewerId,
      },
    });
    return NextResponse.json(
      { ok: true, command, preview: await previewAdmiraltyCommand(harborlightModerationPort(operator), command) },
      { headers: enforceAdmiraltyRateLimit(`moderation-preview:${operator.accountId}`, 20, 10 * 60_000) },
    );
  } catch (cause) {
    return admiraltyErrorResponse(cause);
  }
}
