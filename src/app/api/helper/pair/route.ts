import { NextResponse } from "next/server";
import { z } from "zod";
import { requireGmCapability, verifyCsrf } from "@/lib/security";
import { apiError } from "@/tall-tale/api";
import { createHelperPairing } from "@/tall-tale/progression";

const pairingSchema = z.object({
  sessionId: z.string().min(8).max(128),
  deviceId: z.string().min(3).max(160),
});

export async function POST(request: Request) {
  const session = await requireGmCapability("CAPTAIN");
  if (!session) return NextResponse.json({ error: "Captain authentication required." }, { status: 401 });
  if (!(await verifyCsrf(session)))
    return NextResponse.json({ error: "The Captain session expired." }, { status: 403 });
  try {
    const input = pairingSchema.parse(await request.json());
    return NextResponse.json(await createHelperPairing(input.sessionId, input.deviceId), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (cause) {
    return apiError(cause);
  }
}
