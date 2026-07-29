import { NextResponse } from "next/server";
import { updateAchievementPresentation } from "@/wayfarer/artifacts";
import { requireWayfarerAccount } from "@/wayfarer/http";

export async function PATCH(request: Request, context: { params: Promise<{ achievementId: string }> }) {
  const session = await requireWayfarerAccount(request);
  if (!session?.account.profile)
    return NextResponse.json({ error: "A valid signed-in session is required." }, { status: 401 });
  try {
    return (await updateAchievementPresentation(
      session.account.profile.id,
      (await context.params).achievementId,
      await request.json(),
    ))
      ? NextResponse.json({ ok: true })
      : NextResponse.json({ error: "Achievement not found." }, { status: 404 });
  } catch (cause) {
    return NextResponse.json(
      { error: cause instanceof Error ? cause.message : "Invalid achievement presentation." },
      { status: 400 },
    );
  }
}
