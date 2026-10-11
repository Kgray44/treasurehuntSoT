import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireWayfarerAccount } from "@/wayfarer/http";
import { CrossdeckError } from "@/crossdeck/contracts";
import { crossdeckRealtimeServer } from "@/crossdeck/realtime-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const headers = {
  "Cache-Control": "no-store, private, no-transform",
  "Referrer-Policy": "no-referrer",
  "X-Accel-Buffering": "no",
  Vary: "Cookie",
};
export async function GET(request: Request) {
  try {
    const origin = request.headers.get("origin");
    const site = request.headers.get("sec-fetch-site");
    // Native EventSource is same-origin. No CORS channel or token-bearing query is supported.
    if ((site && !["same-origin", "none"].includes(site)) || (origin && origin !== new URL(request.url).origin))
      return NextResponse.json({ error: "Device events are unavailable." }, { status: 403, headers });
    const actor = await requireWayfarerAccount();
    if (!actor) return NextResponse.json({ error: "Sign in to continue on your devices." }, { status: 401, headers });
    const query = new URL(request.url).searchParams;
    if ([...query.keys()].some((key) => !["voyage", "surface"].includes(key)))
      return NextResponse.json({ error: "Check the device details." }, { status: 400, headers });
    const voyageId = z.string().min(1).max(191).parse(query.get("voyage"));
    const surfaceId = z.string().uuid().parse(query.get("surface"));
    const stream = await crossdeckRealtimeServer(db).connect(actor, voyageId, surfaceId, request.signal);
    return new Response(stream, { headers: { ...headers, "Content-Type": "text/event-stream; charset=utf-8" } });
  } catch (cause) {
    const status = cause instanceof CrossdeckError ? cause.status : cause instanceof z.ZodError ? 400 : 503;
    return NextResponse.json(
      { error: status === 403 ? "This device is unavailable." : "Device connection interrupted." },
      { status, headers },
    );
  }
}
