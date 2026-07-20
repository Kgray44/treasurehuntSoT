import { NextResponse } from "next/server";
import { stageSchema } from "@/domain/admin";
import { requireGm, verifyCsrf } from "@/lib/security";
import { stageAdminCommand } from "@/server/admin-command";

export async function POST(request: Request) {
  const session = await requireGm();
  if (!session) return NextResponse.json({ error: "Sign in to Captain's Console to continue." }, { status: 401 });
  if (!(await verifyCsrf(session)))
    return NextResponse.json({ error: "This confirmation expired. Refresh Captain's Console and review the action." }, { status: 403 });
  const parsed = stageSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "The prepared Voyage action is incomplete. Review it and try again." }, { status: 400 });
  try {
    const staged = await stageAdminCommand(parsed.data, session.userId);
    return NextResponse.json({ staged, persistence: "COMMITTED" });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "The Voyage action could not be prepared. No progress has changed. Review the Voyage and try again.",
      },
      { status: 409 },
    );
  }
}
