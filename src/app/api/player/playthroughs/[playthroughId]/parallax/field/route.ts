import { NextResponse } from "next/server";
import { requirePlayerIdentity, playerCanAccessPlaythrough, verifyPlayerCsrf } from "@/platform/auth";
import { contributeFieldObservation, withdrawFieldObservation } from "@/parallax/field-service";
import { fieldContributionSchema, fieldWithdrawalSchema } from "@/parallax/field-contracts";
import { consumeRateLimit } from "@/lib/rate-limit";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
export async function POST(request: Request, context: { params: Promise<{ playthroughId: string }> }) {
  const identity = await requirePlayerIdentity();
  if (!identity) return NextResponse.json({ error: "Player sign-in required." }, { status: 401, headers });
  const { playthroughId } = await context.params;
  if (!(await playerCanAccessPlaythrough(playthroughId, identity.playerProfileId)))
    return NextResponse.json({ error: "Voyage unavailable." }, { status: 404, headers });
  if (!(await verifyPlayerCsrf(request.headers.get("x-csrf-token"))))
    return NextResponse.json({ error: "Session expired." }, { status: 403, headers });
  if (!consumeRateLimit(`parallax.field:${identity.playerProfileId}`, { limit: 20, windowMs: 60000 }).allowed)
    return NextResponse.json({ error: "Please wait." }, { status: 429, headers });
  try {
    const body = await request.text();
    if (Buffer.byteLength(body) > 4096)
      return NextResponse.json({ error: "Field evidence is too large." }, { status: 413, headers });
    const raw = JSON.parse(body);
    if (raw.action === "WITHDRAW") {
      const input = fieldWithdrawalSchema.parse(raw);
      return NextResponse.json(await withdrawFieldObservation(identity.playerProfileId, input.observationId), {
        headers,
      });
    }
    return NextResponse.json(
      await contributeFieldObservation(playthroughId, identity.playerProfileId, fieldContributionSchema.parse(raw)),
      { headers },
    );
  } catch {
    return NextResponse.json(
      { error: "Feedback was not retained. Your Chronicle completion is unaffected." },
      { status: 409, headers },
    );
  }
}
