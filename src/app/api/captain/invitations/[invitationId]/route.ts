import { NextResponse } from "next/server";
import { z } from "zod";
import { requireGmCapability, verifyCsrf } from "@/lib/security";
import { manageInvitation } from "@/platform/invitations";
import { apiError } from "@/tall-tale/api";

const schema = z.object({
  action: z.enum(["copied", "extend", "revoke", "replace"]),
  extendHours: z
    .number()
    .int()
    .min(1)
    .max(24 * 90)
    .optional(),
});

export async function POST(request: Request, context: { params: Promise<{ invitationId: string }> }) {
  const session = await requireGmCapability("CAPTAIN");
  if (!session) return NextResponse.json({ error: "Captain authentication required." }, { status: 401 });
  if (!(await verifyCsrf(session)))
    return NextResponse.json({ error: "The Captain session expired." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invitation action is invalid." }, { status: 400 });
  try {
    return NextResponse.json(
      await manageInvitation(
        (await context.params).invitationId,
        session.userId,
        parsed.data.action,
        new URL(request.url).origin,
        parsed.data.extendHours,
      ),
    );
  } catch (cause) {
    return apiError(cause);
  }
}
