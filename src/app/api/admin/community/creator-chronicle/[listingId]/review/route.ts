import { NextResponse } from "next/server";
import { requireRecentPrivilegedAssurance } from "@/admiralty/assurance";
import { requireAdmiraltyOperator } from "@/admiralty/authorization";
import { admiraltyErrorResponse, enforceAdmiraltyRateLimit, parseAdmiraltyBody } from "@/admiralty/http";
import { communityApiError } from "@/community/api";
import { CommunityError } from "@/community/domain";
import {
  approveCreatorChroniclePublication,
  creatorChronicleApprovalSchema,
  reviewCreatorChroniclePublication,
} from "@/community/creator-chronicle-moderation";

type Context = { params: Promise<{ listingId: string }> };
const errorResponse = (cause: unknown) =>
  cause instanceof CommunityError ? communityApiError(cause) : admiraltyErrorResponse(cause);
export async function GET(_request: Request, context: Context) {
  try {
    const operator = await requireAdmiraltyOperator("COMMUNITY_MODERATE");
    const headers = enforceAdmiraltyRateLimit(`creator-chronicle-review:${operator.accountId}`, 30, 5 * 60_000);
    const result = await reviewCreatorChroniclePublication(
      {
        accountId: operator.accountId,
        roles: operator.roles.includes("ADMINISTRATOR") ? ["ADMINISTRATOR"] : ["MODERATOR"],
      },
      (await context.params).listingId,
    );
    return NextResponse.json(result, { headers: { ...headers, "Cache-Control": "private, no-store" } });
  } catch (cause) {
    return errorResponse(cause);
  }
}
export async function POST(request: Request, context: Context) {
  try {
    const operator = await requireAdmiraltyOperator("COMMUNITY_MODERATE", { request });
    await requireRecentPrivilegedAssurance(operator);
    const headers = enforceAdmiraltyRateLimit(`creator-chronicle-approval:${operator.accountId}`, 5, 10 * 60_000);
    const input = await parseAdmiraltyBody(request, creatorChronicleApprovalSchema);
    return NextResponse.json(
      await approveCreatorChroniclePublication(
        {
          accountId: operator.accountId,
          roles: operator.roles.includes("ADMINISTRATOR") ? ["ADMINISTRATOR"] : ["MODERATOR"],
        },
        (await context.params).listingId,
        input,
      ),
      { headers },
    );
  } catch (cause) {
    return errorResponse(cause);
  }
}
