import { NextResponse } from "next/server";
import { materializeChronicleHistory } from "@/wayfarer/chronicle-history";
import { requireWayfarerAccount } from "@/wayfarer/http";
import { queryVoyageDetail } from "@/wakebook/archive-query";

export async function GET(_: Request, context: { params: Promise<{ recordId: string }> }) {
  const session = await requireWayfarerAccount();
  if (!session?.account.profile) return NextResponse.json({ error: "Sign in again to continue." }, { status: 401 });
  try {
    const profileId = session.account.profile.id;
    await materializeChronicleHistory(profileId).catch(() => undefined);
    const detail = await queryVoyageDetail(profileId, (await context.params).recordId);
    return detail
      ? NextResponse.json(detail)
      : NextResponse.json({ error: "Voyage record not found." }, { status: 404 });
  } catch {
    return NextResponse.json({ error: "Voyage record not found." }, { status: 404 });
  }
}
