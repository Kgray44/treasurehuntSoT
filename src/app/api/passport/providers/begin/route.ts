import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWayfarerAccount } from "@/wayfarer/http";
import { beginProviderLink } from "@/wayfarer/providers";
import { profileApiError } from "@/wayfarer/http-errors";
const beginSchema = z
  .object({ provider: z.string().min(1).max(80), redirectPath: z.literal("/account/linked-identities").optional() })
  .strict();
export async function POST(request: Request) {
  const session = await requireWayfarerAccount(request);
  if (!session) return NextResponse.json({ error: "A valid signed-in session is required." }, { status: 403 });
  try {
    const body = beginSchema.parse(await request.json());
    return NextResponse.json(await beginProviderLink(session.accountId, body.provider, body.redirectPath));
  } catch (cause) {
    return profileApiError(cause);
  }
}
