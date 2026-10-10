import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { db } from "@/lib/db";
import { requireWayfarerAccount } from "@/wayfarer/http";
import { consumeRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { actionSchema, CrossdeckError } from "@/crossdeck/contracts";
import { createCrossdeckService } from "@/crossdeck/service";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, private", "Referrer-Policy": "no-referrer" };
function error(cause: unknown) {
  if (cause instanceof CrossdeckError)
    return NextResponse.json({ error: cause.message }, { status: cause.status, headers });
  if (cause instanceof ZodError || cause instanceof SyntaxError)
    return NextResponse.json({ error: "Check the device details and try again." }, { status: 400, headers });
  return NextResponse.json(
    { error: "Devices are temporarily unavailable. Try again shortly." },
    { status: 503, headers },
  );
}
export async function GET(request: Request) {
  try {
    const actor = await requireWayfarerAccount();
    if (!actor) return NextResponse.json({ error: "Sign in to manage your devices." }, { status: 401, headers });
    const service = createCrossdeckService(db);
    const voyageId = new URL(request.url).searchParams.get("voyage") || undefined;
    return NextResponse.json(
      {
        surfaces: await service.list(actor, voyageId),
        voyages: await service.voyages(actor),
        csrfToken: actor.csrfToken,
      },
      { headers },
    );
  } catch (cause) {
    return error(cause);
  }
}
export async function POST(request: Request) {
  try {
    const actor = await requireWayfarerAccount(request);
    if (!actor)
      return NextResponse.json({ error: "Your sign-in expired. Sign in again to continue." }, { status: 401, headers });
    const text = await request.text();
    if (text.length > 8192)
      return NextResponse.json({ error: "Device details are too large." }, { status: 413, headers });
    const action = actionSchema.parse(JSON.parse(text));
    const rate = consumeRateLimit(
      `crossdeck:${actor.accountId}:${action.action === "claim" || action.action === "challenge" ? "pairing" : "presence"}`,
      { limit: action.action === "claim" || action.action === "challenge" ? 12 : 120, windowMs: 60_000 },
    );
    if (!rate.allowed)
      return NextResponse.json(
        { error: "Please wait a moment before trying again." },
        { status: 429, headers: { ...headers, ...rateLimitHeaders(rate) } },
      );
    return NextResponse.json(await createCrossdeckService(db).act(actor, action), { headers });
  } catch (cause) {
    return error(cause);
  }
}
