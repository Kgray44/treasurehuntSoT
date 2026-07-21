import { NextResponse } from "next/server";
import { z } from "zod";
import { exchangeLegacyAccessCode, LegacyCompatibilityError } from "@/compatibility/legacy-companion";

const schema = z.object({ campaignSlug: z.string().min(3), accessCode: z.string().min(6).max(128) });
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "The invitation details are incomplete." }, { status: 400 });
  try {
    const exchanged = await exchangeLegacyAccessCode(parsed.data.campaignSlug, parsed.data.accessCode);
    return NextResponse.json({
      ok: true,
      sessionId: exchanged.sessionId,
      redirectTo: `/play/${encodeURIComponent(exchanged.campaignSlug)}/session/${encodeURIComponent(exchanged.sessionId)}`,
    });
  } catch (error) {
    const status = error instanceof LegacyCompatibilityError && error.code === "NOT_MIGRATED" ? 409 : 401;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "That invitation could not be recognized." },
      { status },
    );
  }
}
