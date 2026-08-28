import { NextResponse } from "next/server";
import { requireCaptainSession } from "@/chronicle/captain-authorization";
import { apiError } from "@/chronicle/api";
import { captainSessionAction } from "@/chronicle/progression";
import { getCaptainVoyageProjection } from "@/helm/operations";
import { consumeRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { verifyWayfarerCsrf } from "@/wayfarer/http";

export async function GET(_: Request, context: { params: Promise<{ sessionId: string }> }) {
  try {
    const sessionId = (await context.params).sessionId;
    const authorization = await requireCaptainSession(sessionId);
    if (!authorization)
      return NextResponse.json(
        { error: "This Voyage is unavailable. Return to Captain's Console and choose another Voyage." },
        { status: 403 },
      );
    const projection = await getCaptainVoyageProjection(sessionId, authorization.actor);
    if (!projection) return NextResponse.json({ error: "This Voyage is unavailable." }, { status: 403 });
    return NextResponse.json({ ...projection, csrfToken: authorization.session.csrfToken });
  } catch (cause) {
    return apiError(cause);
  }
}

export async function POST(request: Request, context: { params: Promise<{ sessionId: string }> }) {
  const sessionId = (await context.params).sessionId;
  const authorization = await requireCaptainSession(sessionId);
  if (!authorization)
    return NextResponse.json({ error: "This Voyage is not assigned to your account." }, { status: 403 });
  if (!verifyWayfarerCsrf(authorization.session, request))
    return NextResponse.json(
      { error: "Your Captain session expired. Sign in again; no Voyage progress has changed." },
      { status: 403 },
    );
  try {
    const rate = consumeRateLimit(`tale-captain:${authorization.session.accountId}`, { limit: 60, windowMs: 60_000 });
    if (!rate.allowed)
      return NextResponse.json(
        { error: "Too many Captain actions were requested. Wait a moment, review the Voyage status, then try again." },
        { status: 429, headers: rateLimitHeaders(rate) },
      );
    return NextResponse.json(
      await captainSessionAction(sessionId, authorization.session.accountId, await request.json()),
    );
  } catch (cause) {
    return apiError(cause);
  }
}
