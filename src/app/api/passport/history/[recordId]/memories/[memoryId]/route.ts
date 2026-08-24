import { NextResponse } from "next/server";
import { requireWayfarerAccount } from "@/wayfarer/http";
import { removeMemory, updateMemory } from "@/wayfarer/chronicle-history";

export async function PUT(request: Request, context: { params: Promise<{ recordId: string; memoryId: string }> }) {
  const session = await requireWayfarerAccount(request);
  if (!session?.account.profile)
    return NextResponse.json({ error: "A valid signed-in session is required." }, { status: 403 });
  try {
    const params = await context.params;
    return NextResponse.json(
      await updateMemory(session.account.profile.id, params.recordId, params.memoryId, await request.json()),
    );
  } catch (cause) {
    return NextResponse.json(
      { error: cause instanceof Error ? cause.message : "Unable to update Chronicle Memory." },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ recordId: string; memoryId: string }> }) {
  const session = await requireWayfarerAccount(request);
  if (!session?.account.profile)
    return NextResponse.json({ error: "A valid signed-in session is required." }, { status: 403 });
  try {
    const params = await context.params;
    await removeMemory(session.account.profile.id, params.recordId, params.memoryId);
    return NextResponse.json({ ok: true });
  } catch (cause) {
    return NextResponse.json(
      { error: cause instanceof Error ? cause.message : "Unable to remove Chronicle Memory." },
      { status: 400 },
    );
  }
}
