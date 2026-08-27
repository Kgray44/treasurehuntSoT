import { NextResponse } from "next/server";
import { requireCaptainSession } from "@/chronicle/captain-authorization";
import { HelmAuthorityError, helmCaptainTransferSchema, transferCaptainAuthority } from "@/helm/authority-lifecycle";
import { verifyWayfarerCsrf } from "@/wayfarer/http";

function failure(cause: HelmAuthorityError) {
  return NextResponse.json(
    { error: cause.message, code: cause.code },
    { status: cause.code === "STALE_STATE" ? 409 : cause.code === "NOT_AUTHORIZED" ? 403 : 422 },
  );
}

export async function POST(request: Request, context: { params: Promise<{ playthroughId: string }> }) {
  const playthroughId = (await context.params).playthroughId;
  const authorization = await requireCaptainSession(playthroughId);
  if (!authorization) return NextResponse.json({ error: "This Voyage is unavailable." }, { status: 403 });
  if (!verifyWayfarerCsrf(authorization.session, request))
    return NextResponse.json({ error: "Your Captain session expired. No authority changed." }, { status: 403 });
  const parsed = helmCaptainTransferSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Refresh the Voyage and choose a current joined Player before transferring Captaincy." },
      { status: 400 },
    );
  try {
    return NextResponse.json(await transferCaptainAuthority(playthroughId, authorization.actor, parsed.data));
  } catch (cause) {
    return cause instanceof HelmAuthorityError
      ? failure(cause)
      : NextResponse.json({ error: "Captaincy could not be transferred. No authority changed." }, { status: 400 });
  }
}
