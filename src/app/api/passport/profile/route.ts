import { NextResponse } from "next/server";
import { requireWayfarerAccount } from "@/wayfarer/http";
import { ownerProfile, updateProfile } from "@/wayfarer/profile";
import { profileApiError } from "@/wayfarer/http-errors";

export async function GET() {
  const session = await requireWayfarerAccount();
  if (!session) return NextResponse.json({ error: "Sign in again to continue." }, { status: 401 });
  try {
    return NextResponse.json(await ownerProfile(session.accountId));
  } catch (cause) {
    return profileApiError(cause);
  }
}
export async function PATCH(request: Request) {
  const session = await requireWayfarerAccount(request);
  if (!session) return NextResponse.json({ error: "A valid signed-in session is required." }, { status: 403 });
  try {
    return NextResponse.json(await updateProfile(session.accountId, await request.json()));
  } catch (cause) {
    return profileApiError(cause);
  }
}
