import { NextResponse } from "next/server";
import { z } from "zod";
import { personalInformation } from "@/homeport/personal-harbor";
import { requireWayfarerAccount } from "@/wayfarer/http";
import { profileApiError } from "@/wayfarer/http-errors";
import { updateProfile } from "@/wayfarer/profile";

export async function GET() {
  const session = await requireWayfarerAccount();
  if (!session) return NextResponse.json({ error: "Sign in again to continue." }, { status: 401 });
  const result = await personalInformation(session.accountId);
  return result
    ? NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } })
    : NextResponse.json({ error: "Account not found." }, { status: 404 });
}

const updateSchema = z
  .object({ displayName: z.string().trim().min(1).max(80), expectedRevision: z.string().datetime() })
  .strict();

export async function PATCH(request: Request) {
  const session = await requireWayfarerAccount(request);
  if (!session) return NextResponse.json({ error: "A valid signed-in session is required." }, { status: 403 });
  try {
    const input = updateSchema.parse(await request.json());
    await updateProfile(session.accountId, input);
    return NextResponse.json(await personalInformation(session.accountId));
  } catch (cause) {
    return profileApiError(cause);
  }
}
