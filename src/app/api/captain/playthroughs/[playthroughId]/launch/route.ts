import { NextResponse } from "next/server";
import { z } from "zod";
import { requireGmCapability, verifyCsrf } from "@/lib/security";
import { apiError } from "@/tall-tale/api";
import { launchTalePlaythrough } from "@/tall-tale/progression";

const schema = z.object({ expectedVersion: z.number().int().min(0).optional() });

export async function POST(request: Request, context: { params: Promise<{ playthroughId: string }> }) {
  const session = await requireGmCapability("CAPTAIN");
  if (!session) return NextResponse.json({ error: "Captain authentication required." }, { status: 401 });
  if (!(await verifyCsrf(session)))
    return NextResponse.json({ error: "The Captain session expired." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Launch state is invalid." }, { status: 400 });
  try {
    return NextResponse.json(
      await launchTalePlaythrough((await context.params).playthroughId, session.userId, parsed.data.expectedVersion),
    );
  } catch (cause) {
    return apiError(cause);
  }
}
