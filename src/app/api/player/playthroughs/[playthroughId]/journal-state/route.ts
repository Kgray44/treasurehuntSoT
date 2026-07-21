import { NextResponse } from "next/server";
import { consumeRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { requirePlayerIdentity, verifyPlayerCsrf } from "@/platform/auth";
import { getPlayerJournalReadingState, updatePlayerJournalReadingState } from "@/platform/libraries";
import { journalReadingStateInputSchema } from "@/chronicle/journal-contract";

export async function GET(_: Request, context: { params: Promise<{ playthroughId: string }> }) {
  const session = await requirePlayerIdentity();
  if (!session) return NextResponse.json({ error: "Player sign-in required." }, { status: 401 });
  const readingState = await getPlayerJournalReadingState(
    session.playerProfileId,
    (await context.params).playthroughId,
  );
  return readingState
    ? NextResponse.json({ readingState, csrfToken: session.csrfToken })
    : NextResponse.json({ error: "Voyage journal not found." }, { status: 404 });
}

export async function POST(request: Request, context: { params: Promise<{ playthroughId: string }> }) {
  const session = await requirePlayerIdentity();
  if (!session) return NextResponse.json({ error: "Player sign-in required." }, { status: 401 });
  if (!(await verifyPlayerCsrf(request.headers.get("x-csrf-token"))))
    return NextResponse.json({ error: "The Player session expired." }, { status: 403 });
  const rate = consumeRateLimit(`journal-state:${session.playerProfileId}`, { limit: 90, windowMs: 60_000 });
  if (!rate.allowed)
    return NextResponse.json(
      { error: "Journal state is being saved too quickly." },
      { status: 429, headers: rateLimitHeaders(rate) },
    );
  const parsed = journalReadingStateInputSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid journal reading state." }, { status: 400 });
  const readingState = await updatePlayerJournalReadingState(
    session.playerProfileId,
    (await context.params).playthroughId,
    parsed.data,
  );
  return readingState
    ? NextResponse.json({ readingState })
    : NextResponse.json({ error: "Voyage journal not found." }, { status: 404 });
}
