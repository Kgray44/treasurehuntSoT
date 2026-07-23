import { NextResponse } from "next/server";
import { requireWayfarerAccount } from "@/wayfarer/http";
import {
  listProviderAdapters,
  safeLinkedIdentities,
  unlinkExternalIdentity,
  updateExternalIdentity,
} from "@/wayfarer/providers";
import { profileApiError } from "@/wayfarer/http-errors";

export async function GET() {
  const session = await requireWayfarerAccount();
  if (!session) return NextResponse.json({ error: "Sign in again to continue." }, { status: 401 });
  return NextResponse.json({
    adapters: listProviderAdapters(),
    identities: await safeLinkedIdentities(session.accountId),
  });
}
export async function PATCH(request: Request) {
  const session = await requireWayfarerAccount(request);
  if (!session) return NextResponse.json({ error: "A valid signed-in session is required." }, { status: 403 });
  try {
    const body = await request.json();
    return NextResponse.json(await updateExternalIdentity(session.accountId, body.id, body));
  } catch (cause) {
    return profileApiError(cause);
  }
}
export async function DELETE(request: Request) {
  const session = await requireWayfarerAccount(request);
  if (!session) return NextResponse.json({ error: "A valid signed-in session is required." }, { status: 403 });
  try {
    const body = await request.json();
    await unlinkExternalIdentity(session.accountId, body.id);
    return NextResponse.json({ ok: true });
  } catch (cause) {
    return profileApiError(cause);
  }
}
