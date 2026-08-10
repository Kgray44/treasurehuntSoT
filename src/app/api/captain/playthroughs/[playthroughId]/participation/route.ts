import { NextResponse } from "next/server";
import { apiError } from "@/chronicle/api";
import { requireCaptainSession } from "@/chronicle/captain-authorization";
import {
  CaptainParticipationError,
  captainParticipationMutationSchema,
  changeCaptainParticipation,
  getCaptainParticipation,
} from "@/helm/captain-participation";
import { consumeRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { verifyWayfarerCsrf } from "@/wayfarer/http";

function participationError(cause: CaptainParticipationError) {
  const conflictCodes = new Set(["STALE_STATE", "MEMBERSHIP_CONFLICT", "AUTHORITY_CONFLICT"]);
  const deniedCodes = new Set(["NOT_AUTHORIZED", "VOYAGE_UNAVAILABLE"]);
  return NextResponse.json(
    { error: cause.message, code: cause.code },
    { status: conflictCodes.has(cause.code) ? 409 : deniedCodes.has(cause.code) ? 403 : 422 },
  );
}

export async function GET(_: Request, context: { params: Promise<{ playthroughId: string }> }) {
  const playthroughId = (await context.params).playthroughId;
  const authorization = await requireCaptainSession(playthroughId);
  if (!authorization)
    return NextResponse.json({ error: "This Voyage is unavailable.", code: "VOYAGE_UNAVAILABLE" }, { status: 403 });
  try {
    return NextResponse.json({
      participation: await getCaptainParticipation(playthroughId, authorization.actor),
      csrfToken: authorization.session.csrfToken,
    });
  } catch (cause) {
    return cause instanceof CaptainParticipationError ? participationError(cause) : apiError(cause);
  }
}

export async function POST(request: Request, context: { params: Promise<{ playthroughId: string }> }) {
  const playthroughId = (await context.params).playthroughId;
  const authorization = await requireCaptainSession(playthroughId);
  if (!authorization)
    return NextResponse.json({ error: "This Voyage is unavailable.", code: "VOYAGE_UNAVAILABLE" }, { status: 403 });
  if (!verifyWayfarerCsrf(authorization.session, request))
    return NextResponse.json(
      {
        error: "Your Captain session expired. Player participation has not changed.",
        code: "NOT_AUTHORIZED",
      },
      { status: 403 },
    );
  const rate = consumeRateLimit(`captain-participation:${authorization.session.accountId}`, {
    limit: 20,
    windowMs: 60_000,
  });
  if (!rate.allowed)
    return NextResponse.json(
      { error: "Too many participation changes were requested. Refresh the Voyage before trying again." },
      { status: 429, headers: rateLimitHeaders(rate) },
    );
  const parsed = captainParticipationMutationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      {
        error: "Choose a valid Captain participation mode and refresh the Voyage before trying again.",
        code: "INVALID_MODE",
      },
      { status: 400 },
    );
  try {
    return NextResponse.json(await changeCaptainParticipation(playthroughId, authorization.actor, parsed.data));
  } catch (cause) {
    return cause instanceof CaptainParticipationError ? participationError(cause) : apiError(cause);
  }
}
