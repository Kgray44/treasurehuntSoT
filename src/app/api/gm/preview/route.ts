import { NextResponse } from "next/server";
import { previewSchema } from "@/domain/admin";
import { requireGm } from "@/lib/security";
import { previewAdminCommand } from "@/server/admin-command";

export async function POST(request: Request) {
  if (!(await requireGm()))
    return NextResponse.json({ error: "Sign in to Captain's Console to continue." }, { status: 401 });
  const parsed = previewSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "The Voyage preview request is incomplete. Review the action and try again." },
      { status: 400 },
    );
  return NextResponse.json(await previewAdminCommand(parsed.data));
}
