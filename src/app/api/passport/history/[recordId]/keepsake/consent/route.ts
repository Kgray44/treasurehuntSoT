import { NextResponse } from "next/server";
import { requireWayfarerAccount } from "@/wayfarer/http";
import { recordKeepsakeConsent } from "@/wayfarer/chronicle-history";

export async function PUT(request: Request, context: { params: Promise<{ recordId: string }> }) {
  const session = await requireWayfarerAccount(request);
  if (!session?.account.profile)
    return NextResponse.json({ error: "A valid signed-in session is required." }, { status: 403 });
  try {
    const { scope, state } = (await request.json()) as { scope?: string; state?: string };
    if (!scope || !["DISPLAY_NAME", "AVATAR", "QUOTE", "PHOTO", "AUDIO", "GENERAL_MEDIA"].includes(scope))
      throw new Error("A valid consent scope is required.");
    if (!state || !["GRANTED", "DENIED", "REVOKED"].includes(state))
      throw new Error("A valid consent state is required.");
    return NextResponse.json(
      await recordKeepsakeConsent(
        session.account.profile.id,
        (await context.params).recordId,
        scope as "DISPLAY_NAME" | "AVATAR" | "QUOTE" | "PHOTO" | "AUDIO" | "GENERAL_MEDIA",
        state as "GRANTED" | "DENIED" | "REVOKED",
      ),
    );
  } catch (cause) {
    return NextResponse.json(
      { error: cause instanceof Error ? cause.message : "Unable to record consent." },
      { status: 400 },
    );
  }
}
