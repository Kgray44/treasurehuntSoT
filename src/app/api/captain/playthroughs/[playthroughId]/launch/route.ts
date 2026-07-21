import { NextResponse } from "next/server";
import { z } from "zod";
import { requireGmCapability, verifyCsrf } from "@/lib/security";
import { apiError } from "@/chronicle/api";
import { launchTalePlaythrough } from "@/chronicle/progression";

const schema = z.object({ expectedVersion: z.number().int().min(0).optional() });

export async function POST(request: Request, context: { params: Promise<{ playthroughId: string }> }) {
  const session = await requireGmCapability("CAPTAIN");
  if (!session)
    return NextResponse.json({ error: "Sign in to Captain's Console to begin this Voyage." }, { status: 401 });
  if (!(await verifyCsrf(session)))
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
      await launchTalePlaythrough((await context.params).playthroughId, session.userId, parsed.data.expectedVersion),
    );
  } catch (cause) {
    return apiError(cause);
  }
}
