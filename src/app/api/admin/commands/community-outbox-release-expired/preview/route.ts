import { NextResponse } from "next/server";
import { newAdmiraltyCommandRequest, previewAdmiraltyCommand } from "@/admiralty/commands";
import { requireAdmiraltyOperator } from "@/admiralty/authorization";
import { admiraltyErrorResponse, enforceAdmiraltyRateLimit, parseAdmiraltyBody } from "@/admiralty/http";
import { harborlightReleaseExpiredOutboxClaimsPort } from "@/admiralty/ports/harborlight-outbox-operations-command";
import { communityOutboxReleaseExpiredSchema } from "@/admiralty/schemas";

export async function POST(request: Request) {
  try {
    const operator = await requireAdmiraltyOperator("JOBS_OPERATE", { request });
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
    return NextResponse.json(
      {
        ok: true,
        command,
        preview: await previewAdmiraltyCommand(harborlightReleaseExpiredOutboxClaimsPort(operator), command),
      },
      { headers: enforceAdmiraltyRateLimit(`community-outbox-preview:${operator.accountId}`, 20, 10 * 60_000) },
    );
  } catch (cause) {
    return admiraltyErrorResponse(cause);
  }
}
