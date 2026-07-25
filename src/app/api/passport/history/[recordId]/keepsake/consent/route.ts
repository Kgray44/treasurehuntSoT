import { NextResponse } from "next/server";
import { requireWayfarerAccount } from "@/wayfarer/http";
import { recordKeepsakeConsent } from "@/wayfarer/chronicle-history";

export async function PUT(request: Request, context: { params: Promise<{ recordId: string }> }) {
  const session = await requireWayfarerAccount(request);
  if (!session?.account.profile)
    return NextResponse.json({ error: "A valid signed-in session is required." }, { status: 403 });
  try {
    const { granted } = (await request.json()) as { granted?: boolean };
    if (typeof granted !== "boolean") throw new Error("A consent decision is required.");
    return NextResponse.json(
      await recordKeepsakeConsent(session.account.profile.id, (await context.params).recordId, granted),
    );
  } catch (cause) {
    return NextResponse.json(
      { error: cause instanceof Error ? cause.message : "Unable to record consent." },
      { status: 400 },
    );
  }
}
