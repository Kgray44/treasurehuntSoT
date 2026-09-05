import { NextResponse } from "next/server";
import { executeAdmiraltyCommand, newAdmiraltyCommandRequest, previewAdmiraltyCommand } from "@/admiralty/commands";
import { requireRecentPrivilegedAssurance } from "@/admiralty/assurance";
import { requireAdmiraltyOperator } from "@/admiralty/authorization";
import { admiraltyErrorResponse, enforceAdmiraltyRateLimit, parseAdmiraltyBody } from "@/admiralty/http";
import { harborlightReleaseExpiredOutboxClaimsPort } from "@/admiralty/ports/harborlight-outbox-operations-command";
import { communityOutboxReleaseExpiredSchema } from "@/admiralty/schemas";

export async function POST(request: Request) {
  try {
    const operator = await requireAdmiraltyOperator("JOBS_OPERATE", { request });
    await requireRecentPrivilegedAssurance(operator);
    const input = await parseAdmiraltyBody(request, communityOutboxReleaseExpiredSchema);
    const command = newAdmiraltyCommandRequest({
      commandType: "RELEASE_EXPIRED_OUTBOX_CLAIMS",
      actorAccountId: operator.accountId,
      targetType: "CommunityOutboxLease",
      targetId: "expired-claims",
      reason: input.reason,
      idempotencyKey: input.idempotencyKey,
      input: {},
    });
    const port = harborlightReleaseExpiredOutboxClaimsPort(operator);
    const receipt = await executeAdmiraltyCommand(port, command, await previewAdmiraltyCommand(port, command));
    return NextResponse.json(
      { ok: true, receipt },
      { headers: enforceAdmiraltyRateLimit(`community-outbox-execute:${operator.accountId}`, 10, 10 * 60_000) },
    );
  } catch (cause) {
    return admiraltyErrorResponse(cause);
  }
}
