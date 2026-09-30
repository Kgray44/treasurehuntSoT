import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/chronicle/api";
import { requireCaptainSession } from "@/chronicle/captain-authorization";
import {
  CaptainCommandConflictError,
  captainLandfallCommand,
  captainLandfallCommandSchema,
} from "@/chronicle/progression";
import { consumeRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { verifyWayfarerCsrf } from "@/wayfarer/http";

const requestSchema = captainLandfallCommandSchema.extend({ confirmed: z.literal(true) });
const privateHeaders = { "Cache-Control": "private, no-store, max-age=0" };

export async function POST(request: Request, context: { params: Promise<{ voyageId: string }> }) {
  const { voyageId } = await context.params;
  const authorization = await requireCaptainSession(voyageId);
  if (!authorization)
    return NextResponse.json({ error: "This Voyage is unavailable." }, { status: 403, headers: privateHeaders });
  if (!verifyWayfarerCsrf(authorization.session, request))
    return NextResponse.json({ error: "Your Captain session expired." }, { status: 403, headers: privateHeaders });
  const rate = consumeRateLimit(`landfall-captain:${authorization.session.accountId}`, { limit: 30, windowMs: 60_000 });
  if (!rate.allowed)
    return NextResponse.json(
      { error: "Too many Captain actions. Wait and refresh the Voyage." },
      { status: 429, headers: { ...privateHeaders, ...rateLimitHeaders(rate) } },
    );
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Review and confirm a valid Landfall command." },
      { status: 400, headers: privateHeaders },
    );
  try {
    const { confirmed: _confirmed, ...command } = parsed.data;
    void _confirmed;
    return NextResponse.json(await captainLandfallCommand(voyageId, authorization.session.accountId, command), {
      headers: privateHeaders,
    });
  } catch (cause) {
    if (cause instanceof CaptainCommandConflictError)
      return NextResponse.json(
        { error: cause.message, code: "STALE_SEQUENCE" },
        { status: 409, headers: privateHeaders },
      );
    const response = apiError(cause);
    response.headers.set("Cache-Control", privateHeaders["Cache-Control"]);
    return response;
  }
}
