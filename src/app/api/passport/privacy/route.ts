import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWayfarerAccount } from "@/wayfarer/http";
import { privacyRulesForProfile, setPrivacyRules } from "@/wayfarer/profile";
import { profileApiError } from "@/wayfarer/http-errors";

const privacyInputSchema = z
  .object({
    rules: z.record(z.string(), z.string()),
    expectedRevision: z.string().optional(),
  })
  .strict();

export async function GET() {
  const session = await requireWayfarerAccount();
  if (!session?.account.profile) return NextResponse.json({ error: "Sign in again to continue." }, { status: 401 });
  try {
    return NextResponse.json(await privacyRulesForProfile(session.account.profile.id));
  } catch (cause) {
    return profileApiError(cause);
  }
}
export async function PUT(request: Request) {
  const session = await requireWayfarerAccount(request);
  if (!session?.account.profile)
    return NextResponse.json({ error: "A valid signed-in session is required." }, { status: 403 });
  try {
    const body = privacyInputSchema.parse(await request.json());
    return NextResponse.json(await setPrivacyRules(session.account.profile.id, body.rules, body.expectedRevision));
  } catch (cause) {
    return profileApiError(cause);
  }
}
