import { NextResponse } from "next/server";
import { requireWayfarerAccount } from "@/wayfarer/http";
import { ownerChronicleRecord, saveReflection } from "@/wayfarer/chronicle-history";

export async function GET(_: Request, context: { params: Promise<{ recordId: string }> }) {
  const session = await requireWayfarerAccount();
  if (!session?.account.profile) return NextResponse.json({ error: "Sign in again to continue." }, { status: 401 });
  const record = await ownerChronicleRecord(session.account.profile.id, (await context.params).recordId);
  return record
    ? NextResponse.json(record)
    : NextResponse.json({ error: "Chronicle history record not found." }, { status: 404 });
}

export async function PATCH(request: Request, context: { params: Promise<{ recordId: string }> }) {
  const session = await requireWayfarerAccount(request);
  if (!session?.account.profile)
    return NextResponse.json({ error: "A valid signed-in session is required." }, { status: 403 });
  try {
    return NextResponse.json(
      await saveReflection(session.account.profile.id, (await context.params).recordId, await request.json()),
    );
  } catch (cause) {
    return NextResponse.json(
      { error: cause instanceof Error ? cause.message : "Unable to save reflection." },
      { status: 400 },
    );
  }
}
