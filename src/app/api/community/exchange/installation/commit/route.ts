import { NextResponse } from "next/server";
import { communityApiError } from "@/community/api";
import { installVerifiedCommunityPackage } from "@/community/exchange-service";
import { exchangeAccessDenied, requireExchangeActor } from "../../auth";
import { installCommitInputSchema, parseExchangeInput } from "../../input";

export async function POST(request: Request) {
  const identity = await requireExchangeActor(request);
  if (!identity) return exchangeAccessDenied();
  try {
    const input = parseExchangeInput(installCommitInputSchema, await request.json());
    return NextResponse.json(await installVerifiedCommunityPackage({ ...input, accountId: identity.accountId }), {
      status: 201,
    });
  } catch (cause) {
    return communityApiError(cause);
  }
}
