import { NextResponse } from "next/server";
import { materializeChronicleHistory } from "@/wayfarer/chronicle-history";
import { requireWayfarerAccount } from "@/wayfarer/http";
import { queryWakebookInsights } from "@/wakebook/insights";

export async function GET() {
  const session = await requireWayfarerAccount();
  if (!session?.account.profile) return NextResponse.json({ error: "Sign in again to continue." }, { status: 401 });
  try {
    let notice: string | null = null;
    try {
      await materializeChronicleHistory(session.account.profile.id);
    } catch {
      notice = "Some supplementary history could not be refreshed. Your last accepted private records are still shown.";
    }
    const insights = await queryWakebookInsights(session.account.profile.id);
    return NextResponse.json({ ...insights, freshness: notice ? "PARTIAL" : insights.freshness, notice });
  } catch {
    return NextResponse.json(
      { error: "Your private archive insights could not be read safely. Try again." },
      { status: 500 },
    );
  }
}
