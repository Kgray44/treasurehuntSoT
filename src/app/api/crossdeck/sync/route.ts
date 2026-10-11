import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireWayfarerAccount } from "@/wayfarer/http";
import { consumeRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { CrossdeckError } from "@/crossdeck/contracts";
import { commandSchema } from "@/crossdeck/sync-contracts";
import { createCrossdeckSyncService } from "@/crossdeck/sync-service";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, private", "Referrer-Policy": "no-referrer" };
function error(cause: unknown) {
  const status =
    cause instanceof CrossdeckError
      ? cause.status
      : cause instanceof ZodError || cause instanceof SyntaxError
        ? 400
        : 503;
  return NextResponse.json(
    {
      error:
        cause instanceof CrossdeckError
          ? cause.message
          : status === 400
            ? "Check the item and device details."
            : "Connection interrupted. Check this transfer before trying again.",
    },
    { status, headers },
  );
}
export async function GET(request: Request) {
  try {
    const actor = await requireWayfarerAccount();
    if (!actor) return NextResponse.json({ error: "Sign in to continue on your devices." }, { status: 401, headers });
    const query = new URL(request.url).searchParams;
    const voyageId = z.string().min(1).max(191).parse(query.get("voyage"));
    const surfaceId = z.string().uuid().parse(query.get("surface"));
    return NextResponse.json(await createCrossdeckSyncService(db).read(actor, voyageId, surfaceId), { headers });
  } catch (cause) {
    return error(cause);
  }
}
export async function POST(request: Request) {
  try {
    const actor = await requireWayfarerAccount(request);
    if (!actor) return NextResponse.json({ error: "Sign in again to continue." }, { status: 401, headers });
    const raw = await request.text();
    if (raw.length > 8192)
      return NextResponse.json({ error: "This view is too large to send." }, { status: 413, headers });
    const input = commandSchema.parse(JSON.parse(raw));
    const rate = consumeRateLimit(`crossdeck:sync:${actor.accountId}`, { limit: 180, windowMs: 60_000 });
    if (!rate.allowed)
      return NextResponse.json(
        { error: "Please wait a moment." },
        { status: 429, headers: { ...headers, ...rateLimitHeaders(rate) } },
      );
    return NextResponse.json(await createCrossdeckSyncService(db).command(actor, input), { headers });
  } catch (cause) {
    return error(cause);
  }
}
