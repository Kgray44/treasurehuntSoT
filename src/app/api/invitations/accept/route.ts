import { NextResponse } from "next/server";
import { z } from "zod";
import {
  clearPendingInvitationToken,
  createPlayerIdentitySession,
  readPendingInvitationToken,
  requirePlayerIdentity,
  verifyPendingInvitationCsrf,
} from "@/platform/auth";
import { acceptInvitation } from "@/platform/invitations";
import { apiError } from "@/tall-tale/api";

const schema = z.object({ pin: z.string().max(80).optional(), displayName: z.string().trim().max(80).optional() });

export async function POST(request: Request) {
  if (!(await verifyPendingInvitationCsrf(request.headers.get("x-csrf-token"))))
    return NextResponse.json({ error: "The invitation session expired. Open the invitation again." }, { status: 403 });
  const credential = await readPendingInvitationToken();
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!credential || !parsed.success)
    return NextResponse.json({ error: "Invitation details are incomplete." }, { status: 400 });
  try {
    const identity = await requirePlayerIdentity();
    const accepted = await acceptInvitation(credential, parsed.data, identity?.playerProfileId);
    const csrfToken = await createPlayerIdentitySession(accepted.playerId);
    await clearPendingInvitationToken();
    return NextResponse.json({
      ok: true,
      playthroughId: accepted.playthroughId,
      csrfToken,
      idempotent: accepted.idempotent,
    });
  } catch (cause) {
    return apiError(cause);
  }
}
