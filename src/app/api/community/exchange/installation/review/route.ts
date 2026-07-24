import { NextResponse } from "next/server";
import { communityApiError } from "@/community/api";
import { reviewVerifiedCommunityPackage } from "@/community/exchange-service";
import { exchangeAccessDenied, requireExchangeActor } from "../../auth";
import { installReviewInputSchema, parseExchangeInput } from "../../input";

export async function POST(request: Request) {
  if (!(await requireExchangeActor(request))) return exchangeAccessDenied();
  try {
    return NextResponse.json(
      await reviewVerifiedCommunityPackage(parseExchangeInput(installReviewInputSchema, await request.json())),
    );
  } catch (cause) {
    return communityApiError(cause);
  }
}
