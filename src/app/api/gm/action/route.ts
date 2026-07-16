import { NextResponse } from "next/server";
import { gmActionSchema } from "@/domain/story";
import { requireGm, verifyCsrf } from "@/lib/security";
import { executeProgressionAction } from "@/server/progression";
export async function POST(request: Request) {
  const session = await requireGm();
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!(await verifyCsrf(session)))
    return NextResponse.json({ error: "The confirmation token expired. Refresh the dashboard." }, { status: 403 });
  const parsed = gmActionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "That action was not confirmed correctly." }, { status: 400 });
  try {
    return NextResponse.json(
      await executeProgressionAction(parsed.data.campaignSlug, parsed.data.action, session.userId),
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "The action could not be completed." },
      { status: 409 },
    );
  }
}
