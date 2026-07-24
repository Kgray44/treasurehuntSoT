import { NextResponse } from "next/server";
import { requireWayfarerAccount } from "@/wayfarer/http";
import { saveProfileMedia } from "@/wayfarer/profile-media";
import { profileApiError } from "@/wayfarer/http-errors";
export async function POST(request: Request) {
  const session = await requireWayfarerAccount(request);
  if (!session?.account.profile)
    return NextResponse.json({ error: "A valid signed-in session is required." }, { status: 403 });
  try {
    const body = await request.json();
    if (body.kind !== "AVATAR" && body.kind !== "BANNER") throw new Error("kind");
    return NextResponse.json(await saveProfileMedia(session.account.profile.id, body.kind, body.dataUrl, body.altText));
  } catch (cause) {
    return profileApiError(cause);
  }
}
