import { NextResponse } from "next/server";
import { requireWayfarerAccount } from "@/wayfarer/http";
import { publicProfileProjection } from "@/wayfarer/profile";
export async function GET(request: Request, context: { params: Promise<{ handle: string }> }) {
  const anonymousPreview = new URL(request.url).searchParams.get("viewer") === "public";
  const session = anonymousPreview ? null : await requireWayfarerAccount();
  try {
    const profile = await publicProfileProjection((await context.params).handle, {
      accountId: session?.accountId,
      registered: Boolean(session),
    });
    if (!profile) return NextResponse.json({ error: "Profile not found." }, { status: 404 });
    return NextResponse.json(profile, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  }
}
