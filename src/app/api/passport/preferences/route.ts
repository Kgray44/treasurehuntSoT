import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWayfarerAccount } from "@/wayfarer/http";
import { preferenceV1Schema, preferencesForProfileDto, updatePreferences } from "@/wayfarer/profile";
import { profileApiError } from "@/wayfarer/http-errors";

const updatePreferencesSchema = z
  .object({ preferences: preferenceV1Schema, expectedRevision: z.string().datetime().optional() })
  .strict();

export async function GET() {
  const session = await requireWayfarerAccount();
  if (!session?.account.profile) return NextResponse.json({ error: "Sign in again to continue." }, { status: 401 });
  try {
    return NextResponse.json(await preferencesForProfileDto(session.account.profile.id));
  } catch (cause) {
    return profileApiError(cause);
  }
}
export async function PUT(request: Request) {
  const session = await requireWayfarerAccount(request);
  if (!session?.account.profile)
    return NextResponse.json({ error: "A valid signed-in session is required." }, { status: 403 });
  try {
    const body = await request.json();
    const input =
      body && typeof body === "object" && "preferences" in body
        ? updatePreferencesSchema.parse(body)
        : { preferences: preferenceV1Schema.parse(body), expectedRevision: undefined };
    return NextResponse.json(
      await updatePreferences(session.account.profile.id, input.preferences, input.expectedRevision),
    );
  } catch (cause) {
    return profileApiError(cause);
  }
}
