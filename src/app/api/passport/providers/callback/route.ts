import { NextResponse } from "next/server";
import { requireWayfarerAccount } from "@/wayfarer/http";
import { completeProviderLink } from "@/wayfarer/providers";
import { profileApiError } from "@/wayfarer/http-errors";
export async function POST(request: Request) {
  const session = await requireWayfarerAccount(request);
  if (!session) return NextResponse.json({ error: "A valid signed-in session is required." }, { status: 403 });
  try {
    return NextResponse.json(await completeProviderLink({ accountId: session.accountId, ...(await request.json()) }));
  } catch (cause) {
    return profileApiError(cause);
  }
}
