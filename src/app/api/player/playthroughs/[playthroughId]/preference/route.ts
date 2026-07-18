import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePlayerIdentity, verifyPlayerCsrf } from "@/platform/auth";
import { writePlatformAudit } from "@/platform/audit";
import { updatePlayerPlaythroughPreference } from "@/platform/libraries";
import { apiError } from "@/tall-tale/api";

const schema = z.object({ action: z.enum(["pin", "unpin", "hide", "show"]) });

export async function POST(request: Request, context: { params: Promise<{ playthroughId: string }> }) {
  const identity = await requirePlayerIdentity();
  if (!identity) return NextResponse.json({ error: "Player sign-in required." }, { status: 401 });
  if (!(await verifyPlayerCsrf(request.headers.get("x-csrf-token"))))
    return NextResponse.json({ error: "The Player session expired." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose a valid library action." }, { status: 400 });
  try {
    const playthroughId = (await context.params).playthroughId;
    const result = await updatePlayerPlaythroughPreference(identity.playerProfileId, playthroughId, parsed.data.action);
    await writePlatformAudit({
      actorType: "PLAYER",
      actorId: identity.playerProfileId,
      action: `PLAYER_LIBRARY_${parsed.data.action.toUpperCase()}`,
      resourceType: "PLAYTHROUGH",
      resourceId: playthroughId,
    });
    return NextResponse.json(result);
  } catch (cause) {
    return apiError(cause);
  }
}
