import { NextResponse } from "next/server";
import { requirePilotOwner } from "@/spatial-pilot/authorization";
import { provisionPilot } from "@/spatial-pilot/service";
import { apiError } from "@/chronicle/api";
import { provisionRoomTest, roomTestKinds } from "@/spatial-pilot/room-test";
import { canonicalPublicAppOrigin } from "@/homeport/public-app-origin";
export async function POST(request: Request) {
  const owner = await requirePilotOwner(request);
  if (!owner) return NextResponse.json({ error: "This synthetic pilot is unavailable." }, { status: 404 });
  const input = await request.json().catch(() => null);
  if (!input || !["provision", "replay", "room-test"].includes(input.action))
    return NextResponse.json({ error: "Choose provision or replay." }, { status: 400 });
  if (input.action === "room-test" && input.room !== undefined && !roomTestKinds.includes(input.room))
    return NextResponse.json({ error: "Choose an available private room test." }, { status: 400 });
  if (
    input.action === "room-test" &&
    input.reviewedObservationSha256 !== undefined &&
    (typeof input.reviewedObservationSha256 !== "string" || !/^[a-f0-9]{64}$/.test(input.reviewedObservationSha256))
  )
    return NextResponse.json(
      { error: "Provide the exact SHA-256 of the locally reviewed observation." },
      { status: 400 },
    );
  try {
    const origin = canonicalPublicAppOrigin().origin;
    return NextResponse.json(
      input.action === "room-test"
        ? await provisionRoomTest(owner.accountId, origin, input.room, input.reviewedObservationSha256)
        : await provisionPilot(owner.accountId, origin, input.action === "replay"),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (cause) {
    return apiError(cause);
  }
}
