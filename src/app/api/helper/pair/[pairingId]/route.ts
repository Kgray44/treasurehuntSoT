import { NextResponse } from "next/server";
import { requireCaptainWorkspace } from "@/chronicle/captain-authorization";
import { apiError } from "@/chronicle/api";
import { revokeHelperPairing } from "@/chronicle/progression";
import { verifyWayfarerCsrf } from "@/wayfarer/http";

export async function DELETE(request: Request, context: { params: Promise<{ pairingId: string }> }) {
  const session = await requireCaptainWorkspace();
  if (!session) return NextResponse.json({ error: "Captain authentication required." }, { status: 401 });
  if (!verifyWayfarerCsrf(session, request))
    return NextResponse.json({ error: "The Captain session expired." }, { status: 403 });
  try {
    return NextResponse.json(await revokeHelperPairing((await context.params).pairingId, session.accountId));
  } catch (cause) {
    return apiError(cause);
  }
}
