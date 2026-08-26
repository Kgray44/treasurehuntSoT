import { NextResponse } from "next/server";
import { requirePlayerIdentity, verifyPlayerCsrf } from "@/platform/auth";
import { HelmLifecycleError, leaveVoyage } from "@/helm/lifecycle";

function responseFor(cause: HelmLifecycleError) {
  const status = cause.code === "STALE_STATE" ? 409 : cause.code === "NOT_AUTHORIZED" ? 403 : 422;
  return NextResponse.json({ error: cause.message, code: cause.code }, { status });
}

export async function POST(request: Request, context: { params: Promise<{ playthroughId: string }> }) {
  const identity = await requirePlayerIdentity();
  if (!identity) return NextResponse.json({ error: "Player sign-in required." }, { status: 401 });
  if (!(await verifyPlayerCsrf(request.headers.get("x-csrf-token"))))
    return NextResponse.json({ error: "The Player session expired. No Voyage membership changed." }, { status: 403 });
  const input = (await request.json().catch(() => ({}))) as { expectedVersion?: unknown };
  if (
    input.expectedVersion !== undefined &&
    (typeof input.expectedVersion !== "number" || !Number.isInteger(input.expectedVersion) || input.expectedVersion < 0)
  )
    return NextResponse.json({ error: "Refresh the Voyage before leaving it." }, { status: 400 });
  try {
    return NextResponse.json(
      await leaveVoyage({
        voyageId: (await context.params).playthroughId,
        playerProfileId: identity.playerProfileId,
        expectedVersion: input.expectedVersion as number | undefined,
      }),
    );
  } catch (cause) {
    return cause instanceof HelmLifecycleError
      ? responseFor(cause)
      : NextResponse.json({ error: "Unable to leave this Voyage." }, { status: 400 });
  }
}
