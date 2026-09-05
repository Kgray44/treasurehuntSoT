import { NextResponse } from "next/server";
import { executeAdmiraltyCommand, newAdmiraltyCommandRequest, previewAdmiraltyCommand } from "@/admiralty/commands";
import { requireRecentPrivilegedAssurance } from "@/admiralty/assurance";
import { requireAdmiraltyOperator } from "@/admiralty/authorization";
import { admiraltyErrorResponse, enforceAdmiraltyRateLimit, parseAdmiraltyBody } from "@/admiralty/http";
import { harborlightRuntimePolicyPort } from "@/admiralty/ports/harborlight-runtime-policy-command";
import { communityOutboxRuntimePolicySchema } from "@/admiralty/schemas";

export async function POST(request: Request) {
  try {
    const operator = await requireAdmiraltyOperator("CONFIG_OPERATE", { request });
    await requireRecentPrivilegedAssurance(operator);
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
    const port = harborlightRuntimePolicyPort(operator);
    const receipt = await executeAdmiraltyCommand(port, command, await previewAdmiraltyCommand(port, command));
    return NextResponse.json(
      { ok: true, receipt },
      { headers: enforceAdmiraltyRateLimit(`community-policy-execute:${operator.accountId}`, 10, 10 * 60_000) },
    );
  } catch (cause) {
    return admiraltyErrorResponse(cause);
  }
}
