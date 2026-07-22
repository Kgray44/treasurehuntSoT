import { NextResponse } from "next/server";
import { requireWayfarerAccount } from "@/wayfarer/http";
import { ownerProfile, setPrivacyRules } from "@/wayfarer/profile";
import { profileApiError } from "@/wayfarer/http-errors";

export async function GET() {
  const session = await requireWayfarerAccount();
  if (!session?.account.profile) return NextResponse.json({ error: "Sign in again to continue." }, { status: 401 });
  try {
    return NextResponse.json((await ownerProfile(session.accountId)).privacyRules);
  } catch (cause) {
    return profileApiError(cause);
  }
}
export async function PUT(request: Request) {
  const session = await requireWayfarerAccount(request);
  if (!session?.account.profile)
    return NextResponse.json({ error: "A valid signed-in session is required." }, { status: 403 });
  try {
    await setPrivacyRules(session.account.profile.id, (await request.json()).rules ?? {});
    return NextResponse.json((await ownerProfile(session.accountId)).privacyRules);
  } catch (cause) {
    return profileApiError(cause);
  }
}
