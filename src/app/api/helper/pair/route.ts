import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCaptainWorkspace } from "@/chronicle/captain-authorization";
import { apiError } from "@/chronicle/api";
import { createHelperPairing } from "@/chronicle/progression";
import { verifyWayfarerCsrf } from "@/wayfarer/http";

const pairingSchema = z.object({
  sessionId: z.string().min(8).max(128),
  deviceId: z.string().min(3).max(160),
});

export async function POST(request: Request) {
  const session = await requireCaptainWorkspace();
  if (!session) return NextResponse.json({ error: "Captain authentication required." }, { status: 401 });
  if (!verifyWayfarerCsrf(session, request))
    return NextResponse.json({ error: "The Captain session expired." }, { status: 403 });
  try {
    const input = pairingSchema.parse(await request.json());
    return NextResponse.json(await createHelperPairing(input.sessionId, input.deviceId, session.accountId), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (cause) {
    return apiError(cause);
  }
}
