import { NextResponse } from "next/server";
import { communityApiError } from "@/community/api";
import { compareReleaseUpdate } from "@/community/exchange";
import { exchangeAccessDenied, requireExchangeActor } from "../../auth";
import { parseExchangeInput, updateComparisonInputSchema } from "../../input";

export async function POST(request: Request) {
  if (!(await requireExchangeActor(request))) return exchangeAccessDenied();
  try {
    return NextResponse.json(
      compareReleaseUpdate(parseExchangeInput(updateComparisonInputSchema, await request.json())),
    );
  } catch (cause) {
    return communityApiError(cause);
  }
}
