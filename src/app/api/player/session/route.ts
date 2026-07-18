import { NextResponse } from "next/server";
import { clearPlayerIdentitySession, requirePlayerIdentity, verifyPlayerCsrf } from "@/platform/auth";

export async function GET() {
  const session = await requirePlayerIdentity();
  if (!session) return NextResponse.json({ authenticated: false }, { status: 401 });
  return NextResponse.json({
    authenticated: true,
    csrfToken: session.csrfToken,
    player: { id: session.player.id, displayName: session.player.displayName },
    expiresAt: session.expiresAt.toISOString(),
  });
}

export async function DELETE(request: Request) {
  if (!(await verifyPlayerCsrf(request.headers.get("x-csrf-token"))))
    return NextResponse.json({ error: "The Player session expired." }, { status: 403 });
  await clearPlayerIdentitySession();
  return NextResponse.json({ ok: true });
}
