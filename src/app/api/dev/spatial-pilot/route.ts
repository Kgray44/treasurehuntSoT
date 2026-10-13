import { NextResponse } from "next/server";
import { requirePilotOwner } from "@/spatial-pilot/authorization";
import { provisionPilot } from "@/spatial-pilot/service";
import { apiError } from "@/chronicle/api";
import { provisionRoomTest } from "@/spatial-pilot/room-test";
export async function POST(request: Request) {
  const owner = await requirePilotOwner(request);
  if (!owner) return NextResponse.json({ error: "This synthetic pilot is unavailable." }, { status: 404 });
  const input = await request.json().catch(() => null);
  if (!input || !["provision", "replay", "room-test"].includes(input.action))
    return NextResponse.json({ error: "Choose provision or replay." }, { status: 400 });
  try {
    return NextResponse.json(
      input.action === "room-test"
        ? await provisionRoomTest(owner.accountId, new URL(request.url).origin)
        : await provisionPilot(owner.accountId, new URL(request.url).origin, input.action === "replay"),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (cause) {
    return apiError(cause);
  }
}
