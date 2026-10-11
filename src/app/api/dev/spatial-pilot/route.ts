import { NextResponse } from "next/server";
import { requirePilotOwner } from "@/spatial-pilot/authorization";
import { provisionPilot } from "@/spatial-pilot/service";
import { apiError } from "@/chronicle/api";
export async function POST(request: Request) {
  const owner = await requirePilotOwner(request);
  if (!owner) return NextResponse.json({ error: "This synthetic pilot is unavailable." }, { status: 404 });
  const input = await request.json().catch(() => null);
  if (!input || !["provision", "replay"].includes(input.action))
    return NextResponse.json({ error: "Choose provision or replay." }, { status: 400 });
  try {
    return NextResponse.json(
      await provisionPilot(owner.accountId, new URL(request.url).origin, input.action === "replay"),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (cause) {
    return apiError(cause);
  }
}
