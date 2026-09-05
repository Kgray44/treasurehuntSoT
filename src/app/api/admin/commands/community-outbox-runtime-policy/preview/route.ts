import { NextResponse } from "next/server";
import { newAdmiraltyCommandRequest, previewAdmiraltyCommand } from "@/admiralty/commands";
import { requireAdmiraltyOperator } from "@/admiralty/authorization";
import { admiraltyErrorResponse, enforceAdmiraltyRateLimit, parseAdmiraltyBody } from "@/admiralty/http";
import { harborlightRuntimePolicyPort } from "@/admiralty/ports/harborlight-runtime-policy-command";
import { communityOutboxRuntimePolicySchema } from "@/admiralty/schemas";

export async function POST(request: Request) {
  try {
    const operator = await requireAdmiraltyOperator("CONFIG_OPERATE", { request });
    const input = await parseAdmiraltyBody(request, communityOutboxRuntimePolicySchema);
    const command = newAdmiraltyCommandRequest({
      commandType: "COMMUNITY_OUTBOX_RUNTIME_POLICY_UPDATE",
      actorAccountId: operator.accountId,
      targetType: "CommunityOperationalPolicy",
      targetId: "COMMUNITY_OUTBOX_RUNTIME",
      reason: input.reason,
      idempotencyKey: input.idempotencyKey,
      input: {
        expectedRevision: input.expectedRevision,
        dispatchEnabled: input.dispatchEnabled,
        batchSize: input.batchSize,
        pollIntervalMs: input.pollIntervalMs,
      },
    });
    return NextResponse.json(
      { ok: true, command, preview: await previewAdmiraltyCommand(harborlightRuntimePolicyPort(operator), command) },
      { headers: enforceAdmiraltyRateLimit(`community-policy-preview:${operator.accountId}`, 20, 10 * 60_000) },
    );
  } catch (cause) {
    return admiraltyErrorResponse(cause);
  }
}
