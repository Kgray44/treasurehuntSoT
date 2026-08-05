import { NextResponse } from "next/server";
import { z } from "zod";
import { accountApiError } from "@/wayfarer/account-api-error";
import { deactivateAccount } from "@/wayfarer/account-lifecycle";
import { clearProductIdentityCookies, requireWayfarerAccount } from "@/wayfarer/http";

const schema = z.object({ password: z.string().min(1).max(256), confirmation: z.literal("DEACTIVATE") }).strict();

export async function POST(request: Request) {
  const session = await requireWayfarerAccount(request);
  if (!session) return NextResponse.json({ error: "A valid signed-in session is required." }, { status: 403 });
  try {
    const input = schema.parse(await request.json());
    const result = await deactivateAccount(session.accountId, input.password, input.confirmation);
    await clearProductIdentityCookies();
    return NextResponse.json(result);
  } catch (cause) {
    return accountApiError(cause);
  }
}
