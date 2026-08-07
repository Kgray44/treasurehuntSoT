import { NextResponse } from "next/server";
import { z } from "zod";
import { accountApiError } from "@/wayfarer/account-api-error";
import { confirmEmailChange } from "@/wayfarer/accounts";
import { clearProductIdentityCookies } from "@/wayfarer/http";

const schema = z.object({ token: z.string().min(20).max(256) }).strict();

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const result = await confirmEmailChange(input.token);
    await clearProductIdentityCookies();
    return NextResponse.json({ ok: true, displayEmail: result.displayEmail });
  } catch (cause) {
    return accountApiError(cause);
  }
}
