import { NextResponse } from "next/server";
import { requireCaptainSession } from "@/chronicle/captain-authorization";
import { verifyWayfarerCsrf } from "@/wayfarer/http";
import { HelmLifecycleError, cancelVoyage } from "@/helm/lifecycle";

export async function POST(request: Request, context: { params: Promise<{ playthroughId: string }> }) {
  const playthroughId = (await context.params).playthroughId;
  const authorization = await requireCaptainSession(playthroughId);
  if (!authorization) return NextResponse.json({ error: "This Voyage is unavailable." }, { status: 403 });
  if (!verifyWayfarerCsrf(authorization.session, request))
    return NextResponse.json({ error: "Your Captain session expired. The Voyage remains active." }, { status: 403 });
  const input = (await request.json().catch(() => ({}))) as { expectedVersion?: unknown };
  if (
    input.expectedVersion !== undefined &&
    (typeof input.expectedVersion !== "number" || !Number.isInteger(input.expectedVersion) || input.expectedVersion < 0)
  )
    return NextResponse.json({ error: "Refresh the Voyage before cancelling it." }, { status: 400 });
  try {
    return NextResponse.json(
      await cancelVoyage({
        voyageId: playthroughId,
        actor: authorization.actor,
        expectedVersion: input.expectedVersion as number | undefined,
      }),
    );
  } catch (cause) {
    if (!(cause instanceof HelmLifecycleError))
      return NextResponse.json({ error: "Unable to cancel this Voyage." }, { status: 400 });
    return NextResponse.json(
      { error: cause.message, code: cause.code },
      { status: cause.code === "STALE_STATE" ? 409 : 422 },
    );
  }
}
