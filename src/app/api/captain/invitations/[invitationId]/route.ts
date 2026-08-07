import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCaptainWorkspace } from "@/chronicle/captain-authorization";
import { manageInvitation } from "@/platform/invitations";
import { apiError } from "@/chronicle/api";
import { verifyWayfarerCsrf } from "@/wayfarer/http";

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
  const session = await requireCaptainWorkspace();
  if (!session)
    return NextResponse.json({ error: "Your account cannot manage Captain invitations right now." }, { status: 403 });
  if (!verifyWayfarerCsrf(session, request))
    return NextResponse.json(
      { error: "Your Captain session expired. Sign in again; invitation access has not changed." },
      { status: 403 },
    );
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "This invitation action is invalid. Review the invitation and try again." },
      { status: 400 },
    );
  try {
    return NextResponse.json(
      await manageInvitation(
        (await context.params).invitationId,
        session.accountId,
        parsed.data.action,
        new URL(request.url).origin,
        parsed.data.extendHours,
      ),
    );
  } catch (cause) {
    return apiError(cause);
  }
}
