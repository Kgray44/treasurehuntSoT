import { NextResponse } from "next/server";
import { requireRecentPrivilegedAssurance } from "@/admiralty/assurance";
import { writeAdministrativeAudit } from "@/admiralty/audit";
import { requireAdmiraltyOperator } from "@/admiralty/authorization";
import { admiraltyErrorResponse, enforceAdmiraltyRateLimit, parseAdmiraltyBody } from "@/admiralty/http";
import { communityApiError } from "@/community/api";
import { CommunityError } from "@/community/domain";
import {
  approveSpatialPublication,
  reviewSpatialPublicationForModeration,
  spatialModerationApprovalSchema,
} from "@/community/spatial-moderation";

type RouteContext = { params: Promise<{ listingId: string }> };

function errorResponse(cause: unknown) {
  return cause instanceof CommunityError ? communityApiError(cause) : admiraltyErrorResponse(cause);
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const operator = await requireAdmiraltyOperator("COMMUNITY_MODERATE");
    const headers = enforceAdmiraltyRateLimit(`spatial-review:${operator.accountId}`, 30, 5 * 60_000);
    const review = await reviewSpatialPublicationForModeration(
      {
        accountId: operator.accountId,
        roles: operator.roles.includes("ADMINISTRATOR") ? ["ADMINISTRATOR"] : ["MODERATOR"],
      },
      (await context.params).listingId,
    );
    await writeAdministrativeAudit({
      actorAccountId: operator.accountId,
      actorRole: operator.roles.includes("ADMINISTRATOR") ? "ADMINISTRATOR" : "MODERATOR",
      capability: "COMMUNITY_MODERATE",
      action: "COMMUNITY_SPATIAL_RELEASE_REVIEWED",
      targetType: "CommunityRelease",
      targetId: review.releaseId,
      reason: "Operator inspected the pending spatial package for a publication decision.",
      authorizationBasis: operator.authorizationBasis,
      accountSessionId: operator.accountSessionId,
    });
    return NextResponse.json(review, { headers });
  } catch (cause) {
    return errorResponse(cause);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const operator = await requireAdmiraltyOperator("COMMUNITY_MODERATE", { request });
    await requireRecentPrivilegedAssurance(operator);
    const headers = enforceAdmiraltyRateLimit(`spatial-approval:${operator.accountId}`, 5, 10 * 60_000);
    const input = await parseAdmiraltyBody(request, spatialModerationApprovalSchema);
    const result = await approveSpatialPublication(
      {
        accountId: operator.accountId,
        roles: operator.roles.includes("ADMINISTRATOR") ? ["ADMINISTRATOR"] : ["MODERATOR"],
        authorizationBasis: operator.authorizationBasis,
        accountSessionId: operator.accountSessionId,
      },
      (await context.params).listingId,
      input,
    );
    return NextResponse.json(result, { headers });
  } catch (cause) {
    return errorResponse(cause);
  }
}
