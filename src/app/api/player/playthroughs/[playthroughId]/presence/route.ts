import { NextResponse } from "next/server";
import {
  MembershipPresenceError,
  membershipPresenceHeartbeatSchema,
  membershipPresencePolicy,
  recordMembershipPresence,
} from "@/platform/membership-presence";
import { requirePlayerIdentity, verifyPlayerCsrf } from "@/platform/auth";
import { consumeRateLimit, rateLimitHeaders } from "@/lib/rate-limit";

export async function POST(request: Request, context: { params: Promise<{ playthroughId: string }> }) {
  const identity = await requirePlayerIdentity();
  if (!identity) return NextResponse.json({ error: "Player sign-in required." }, { status: 401 });
  if (!(await verifyPlayerCsrf(request.headers.get("x-csrf-token"))))
    return NextResponse.json({ error: "The Player session expired." }, { status: 403 });
  const rate = consumeRateLimit(
    `membership-presence:${identity.playerProfileId}:${(await context.params).playthroughId}`,
    {
      limit: membershipPresencePolicy.heartbeatLimitPerMinute,
      windowMs: 60_000,
    },
  );
  if (!rate.allowed)
    return NextResponse.json(
      { error: "Presence is being reported too quickly." },
      { status: 429, headers: rateLimitHeaders(rate) },
    );
  const input = membershipPresenceHeartbeatSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: "Invalid presence update." }, { status: 400 });
  try {
    return NextResponse.json(
      await recordMembershipPresence({
        taleSessionId: (await context.params).playthroughId,
        playerProfileId: identity.playerProfileId,
        ...input.data,
      }),
    );
  } catch (cause) {
    if (cause instanceof MembershipPresenceError)
      return NextResponse.json(
        {
          error:
            cause.code === "FUTURE_SEQUENCE"
              ? "Presence acknowledgement is ahead of this Voyage."
              : "This Voyage is unavailable.",
        },
        { status: cause.code === "FUTURE_SEQUENCE" ? 422 : 403 },
      );
    throw cause;
  }
}
