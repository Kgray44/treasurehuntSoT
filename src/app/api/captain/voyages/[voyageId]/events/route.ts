import { NextResponse } from "next/server";
import { requireCaptainSession } from "@/chronicle/captain-authorization";
import { getCaptainOperationalEvents } from "@/helm/operations";

export async function GET(request: Request, context: { params: Promise<{ voyageId: string }> }) {
  const voyageId = (await context.params).voyageId;
  if (!(await requireCaptainSession(voyageId)))
    return NextResponse.json({ error: "This Voyage is unavailable." }, { status: 403 });
  const search = new URL(request.url).searchParams;
  const category = search.get("category");
  if (category && !["PROGRESSION", "VERIFICATION", "SYSTEM"].includes(category))
    return NextResponse.json({ error: "Invalid event category." }, { status: 400 });
  return NextResponse.json(await getCaptainOperationalEvents(voyageId, search.get("cursor"), category));
}
