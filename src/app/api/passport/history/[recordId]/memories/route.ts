import { NextResponse } from "next/server";
import { requireWayfarerAccount } from "@/wayfarer/http";
import { addMemory } from "@/wayfarer/chronicle-history";

export async function POST(request: Request, context: { params: Promise<{ recordId: string }> }) {
  const session = await requireWayfarerAccount(request);
  if (!session?.account.profile)
    return NextResponse.json({ error: "A valid signed-in session is required." }, { status: 403 });
  try {
    return NextResponse.json(
      await addMemory(session.account.profile.id, (await context.params).recordId, await request.json()),
    );
  } catch (cause) {
    return NextResponse.json(
      { error: cause instanceof Error ? cause.message : "Unable to save Chronicle Memory." },
      { status: 400 },
    );
  }
}
