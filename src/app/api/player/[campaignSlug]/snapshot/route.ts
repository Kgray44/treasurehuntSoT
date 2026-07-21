import { NextResponse } from "next/server";
import { requireLegacyCompatibilityAccess } from "@/compatibility/legacy-companion";
import { getTaleSessionState } from "@/chronicle/progression";

/** Compatibility response sourced exclusively from the mapped Chronicle Session. */
export async function GET(_: Request, context: { params: Promise<{ campaignSlug: string }> }) {
  const access = await requireLegacyCompatibilityAccess((await context.params).campaignSlug);
  if (!access) return NextResponse.json({ error: "Invitation required." }, { status: 401 });
  return NextResponse.json(await getTaleSessionState(access.sessionId, undefined, false, true), {
    headers: { "Cache-Control": "no-store, private" },
  });
}
