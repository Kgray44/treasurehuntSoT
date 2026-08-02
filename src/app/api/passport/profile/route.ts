import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWayfarerAccount } from "@/wayfarer/http";
import { ownerProfileDto, updateProfile, visibilityValues } from "@/wayfarer/profile";
import { profileApiError } from "@/wayfarer/http-errors";

const updateProfileSchema = z
  .object({
    displayName: z.string().max(80).optional(),
    handle: z.string().max(32).nullable().optional(),
    biography: z.string().max(1_000).nullable().optional(),
    defaultVisibility: z.enum(visibilityValues).optional(),
    expectedRevision: z.string().datetime().optional(),
  })
  .strict();

export async function GET() {
  const session = await requireWayfarerAccount();
  if (!session) return NextResponse.json({ error: "Sign in again to continue." }, { status: 401 });
  try {
    return NextResponse.json(await ownerProfileDto(session.accountId));
  } catch (cause) {
    return profileApiError(cause);
  }
}
export async function PATCH(request: Request) {
  const session = await requireWayfarerAccount(request);
  if (!session) return NextResponse.json({ error: "A valid signed-in session is required." }, { status: 403 });
  try {
    await updateProfile(session.accountId, updateProfileSchema.parse(await request.json()));
    return NextResponse.json(await ownerProfileDto(session.accountId));
  } catch (cause) {
    return profileApiError(cause);
  }
}
