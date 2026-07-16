import { NextResponse } from "next/server";
import { commandSchema } from "@/domain/admin";
import { requireGm, verifyCsrf } from "@/lib/security";
import { CommandConflict, executeAdminCommand } from "@/server/admin-command";

export async function POST(request: Request) {
  const session = await requireGm();
  if (!session)
    return NextResponse.json({ error: "Authentication required.", code: "UNAUTHENTICATED" }, { status: 401 });
  if (!(await verifyCsrf(session)))
    return NextResponse.json(
      { error: "The confirmation token expired. Refresh the Command Center.", code: "CSRF" },
      { status: 403 },
    );
  const parsed = commandSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "The command request is incomplete.", code: "VALIDATION", issues: parsed.error.issues },
      { status: 400 },
    );
  try {
    return NextResponse.json(await executeAdminCommand(parsed.data, session.userId));
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "The command could not be completed.",
        code: error instanceof CommandConflict ? error.code : "COMMAND_FAILED",
      },
      { status: error instanceof CommandConflict ? 409 : 500 },
    );
  }
}
