import { NextResponse } from "next/server";
import { clearGmSession, requireGm, verifyCsrf } from "@/lib/security";

export async function POST() {
  const session = await requireGm();
  if (!session) return NextResponse.json({ ok: true });
  if (!(await verifyCsrf(session)))
    return NextResponse.json({ error: "Your Captain session expired. Sign in again; no Voyage progress has changed." }, { status: 403 });
  await clearGmSession();
  return NextResponse.json({ ok: true });
}
