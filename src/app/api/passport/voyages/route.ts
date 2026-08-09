import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { materializeChronicleHistory } from "@/wayfarer/chronicle-history";
import { requireWayfarerAccount } from "@/wayfarer/http";
import { queryJourneyArchive } from "@/wakebook/archive-query";
import { parseArchiveQuery } from "@/wakebook/contracts";

export async function GET(request: Request) {
  const session = await requireWayfarerAccount();
  if (!session?.account.profile) return NextResponse.json({ error: "Sign in again to continue." }, { status: 401 });
  try {
    const query = parseArchiveQuery(new URL(request.url).searchParams);
    const projection = await materializeChronicleHistory(session.account.profile.id).catch(() => ({
      membershipsExamined: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      projectionFailures: 1,
    }));
    return NextResponse.json(await queryJourneyArchive(session.account.profile.id, query, projection));
  } catch (cause) {
    const error =
      cause instanceof ZodError || (cause instanceof Error && cause.message === "Archive cursor is invalid.")
        ? "Archive filters are invalid. Clear the filters and try again."
        : "Your Journey Archive could not be read safely. Try again.";
    return NextResponse.json(
      { error },
      { status: cause instanceof ZodError || error.startsWith("Archive filters") ? 400 : 500 },
    );
  }
}
