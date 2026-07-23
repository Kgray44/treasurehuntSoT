import { NextResponse } from "next/server";
import { communityApiError } from "@/community/api";
import { createInstallPlan } from "@/community/exchange";
import { exchangeAccessDenied, requireExchangeActor } from "../../auth";
import { installPlanInputSchema, parseExchangeInput } from "../../input";

export async function POST(request: Request) {
  if (!(await requireExchangeActor(request))) return exchangeAccessDenied();
  try {
    return NextResponse.json(createInstallPlan(parseExchangeInput(installPlanInputSchema, await request.json())));
  } catch (cause) {
    return communityApiError(cause);
  }
}
