import { NextResponse } from "next/server";
import { stageSchema } from "@/domain/admin";
import { requireGm, verifyCsrf } from "@/lib/security";
import { stageAdminCommand } from "@/server/admin-command";

export async function POST(request: Request) {
  const session = await requireGm();
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!(await verifyCsrf(session)))
    return NextResponse.json({ error: "The confirmation token expired." }, { status: 403 });
  const parsed = stageSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "The staged action is incomplete." }, { status: 400 });
  try {
    const staged = await stageAdminCommand(parsed.data, session.userId);
    return NextResponse.json({ staged, persistence: "COMMITTED" });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "The action could not be staged." },
      { status: 409 },
    );
  }
}
