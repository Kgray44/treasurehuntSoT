import { NextResponse } from "next/server";
import { requireGmCapability, verifyCsrf } from "@/lib/security";
import { apiError } from "@/chronicle/api";
import { revokeHelperPairing } from "@/chronicle/progression";

export async function DELETE(_: Request, context: { params: Promise<{ pairingId: string }> }) {
  const session = await requireGmCapability("CAPTAIN");
  if (!session) return NextResponse.json({ error: "Captain authentication required." }, { status: 401 });
  if (!(await verifyCsrf(session)))
    return NextResponse.json({ error: "The Captain session expired." }, { status: 403 });
  try {
    return NextResponse.json(await revokeHelperPairing((await context.params).pairingId, session.userId));
  } catch (cause) {
    return apiError(cause);
  }
}
