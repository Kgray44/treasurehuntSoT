import { NextResponse } from "next/server";
import { listMusterMessages, sendMusterMessage } from "@/muster/chat";
import { musterIdentity, musterError } from "@/muster/http";
import { consumeRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
export async function GET(_: Request, context: { params: Promise<{ voyageId: string }> }) {
  try {
    const { actor } = await musterIdentity();
    return NextResponse.json(
      { messages: await listMusterMessages((await context.params).voyageId, actor) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (cause) {
    return musterError(cause);
  }
}
export async function POST(request: Request, context: { params: Promise<{ voyageId: string }> }) {
  try {
    const { actor } = await musterIdentity(request);
    const limit = consumeRateLimit(`muster-chat:${actor.accountId}`, { limit: 30, windowMs: 60_000 });
    if (!limit.allowed)
      return NextResponse.json(
        { error: "Please pause before sending another message." },
        { status: 429, headers: rateLimitHeaders(limit) },
      );
    const text = await request.text();
    if (text.length > 8000) return NextResponse.json({ error: "Message is too long." }, { status: 413 });
    const input = JSON.parse(text);
    return NextResponse.json(await sendMusterMessage((await context.params).voyageId, actor, input));
  } catch (cause) {
    if (cause instanceof SyntaxError) return NextResponse.json({ error: "Invalid message." }, { status: 400 });
    return musterError(cause);
  }
}
