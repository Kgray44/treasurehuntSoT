import { NextResponse } from "next/server";
import { requireCaptainSession } from "@/chronicle/captain-authorization";
import { getTaleSessionState } from "@/chronicle/progression";
import { apiError } from "@/chronicle/api";

export async function GET(_: Request, context: { params: Promise<{ playthroughId: string }> }) {
  const playthroughId = (await context.params).playthroughId;
  const authorization = await requireCaptainSession(playthroughId);
  if (!authorization || authorization.playthrough.previewMode)
    return NextResponse.json(
      { error: "This Voyage is unavailable. Return to Captain's Console and choose another Voyage." },
      { status: 403 },
    );
  try {
    return NextResponse.json({
      preview: await getTaleSessionState(playthroughId, undefined, false, true),
      mutating: false,
    });
  } catch (cause) {
    return apiError(cause);
  }
}
