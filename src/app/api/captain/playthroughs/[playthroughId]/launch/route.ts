import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCaptainSession } from "@/chronicle/captain-authorization";
import { apiError } from "@/chronicle/api";
import { launchTalePlaythrough } from "@/chronicle/progression";
import { verifyWayfarerCsrf } from "@/wayfarer/http";

const schema = z.object({ expectedVersion: z.number().int().min(0).optional() });

export async function POST(request: Request, context: { params: Promise<{ playthroughId: string }> }) {
  const playthroughId = (await context.params).playthroughId;
  const authorization = await requireCaptainSession(playthroughId);
  if (!authorization)
    return NextResponse.json({ error: "This Voyage is not assigned to your account." }, { status: 403 });
  if (!verifyWayfarerCsrf(authorization.session, request))
    return NextResponse.json(
      { error: "Your Captain session expired. Sign in again; Crew access has not changed." },
      { status: 403 },
    );
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success)
    return NextResponse.json(
      { error: "This Voyage cannot begin with the current state. Refresh the Voyage and try again." },
      { status: 400 },
    );
  try {
    return NextResponse.json(
      await launchTalePlaythrough(playthroughId, authorization.session.accountId, parsed.data.expectedVersion),
    );
  } catch (cause) {
    return apiError(cause);
  }
}
