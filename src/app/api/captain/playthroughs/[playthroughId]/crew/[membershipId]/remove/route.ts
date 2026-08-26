import { NextResponse } from "next/server";
import { requireCaptainSession } from "@/chronicle/captain-authorization";
import { verifyWayfarerCsrf } from "@/wayfarer/http";
import { HelmLifecycleError, removeCrewMember } from "@/helm/lifecycle";

export async function POST(
  request: Request,
  context: { params: Promise<{ playthroughId: string; membershipId: string }> },
) {
  const { playthroughId, membershipId } = await context.params;
  const authorization = await requireCaptainSession(playthroughId);
  if (!authorization) return NextResponse.json({ error: "This Voyage is unavailable." }, { status: 403 });
  if (!verifyWayfarerCsrf(authorization.session, request))
    return NextResponse.json({ error: "Your Captain session expired. Crew access has not changed." }, { status: 403 });
  const input = (await request.json().catch(() => ({}))) as { expectedVersion?: unknown };
  if (
    input.expectedVersion !== undefined &&
    (typeof input.expectedVersion !== "number" || !Number.isInteger(input.expectedVersion) || input.expectedVersion < 0)
  )
    return NextResponse.json({ error: "Refresh the Crew before removing anyone." }, { status: 400 });
  try {
    return NextResponse.json(
      await removeCrewMember({
        voyageId: playthroughId,
        membershipId,
        actor: authorization.actor,
        expectedVersion: input.expectedVersion as number | undefined,
      }),
    );
  } catch (cause) {
    if (!(cause instanceof HelmLifecycleError))
      return NextResponse.json({ error: "Unable to remove this Crew member." }, { status: 400 });
    return NextResponse.json(
      { error: cause.message, code: cause.code },
      { status: cause.code === "STALE_STATE" ? 409 : 422 },
    );
  }
}
