import { NextResponse } from "next/server";
import { requireWayfarerAccount } from "@/wayfarer/http";
import { generateKeepsake } from "@/wayfarer/chronicle-history";

export async function POST(request: Request, context: { params: Promise<{ recordId: string }> }) {
  const session = await requireWayfarerAccount(request);
  if (!session?.account.profile)
    return NextResponse.json({ error: "A valid signed-in session is required." }, { status: 403 });
  try {
    return NextResponse.json(await generateKeepsake(session.account.profile.id, (await context.params).recordId));
  } catch (cause) {
    return NextResponse.json(
      { error: cause instanceof Error ? cause.message : "Unable to prepare private Keepsake." },
      { status: 400 },
    );
  }
}
