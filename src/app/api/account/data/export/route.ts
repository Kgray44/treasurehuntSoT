import { NextResponse } from "next/server";
import { z } from "zod";
import { accountApiError } from "@/wayfarer/account-api-error";
import { requestAccountExport } from "@/wayfarer/account-lifecycle";
import { requireWayfarerAccount } from "@/wayfarer/http";

const schema = z.object({ password: z.string().min(1).max(256) }).strict();

export async function POST(request: Request) {
  const session = await requireWayfarerAccount(request);
  if (!session) return NextResponse.json({ error: "A valid signed-in session is required." }, { status: 403 });
  try {
    const input = schema.parse(await request.json());
    return NextResponse.json(await requestAccountExport(session.accountId, input.password), { status: 201 });
  } catch (cause) {
    return accountApiError(cause);
  }
}
