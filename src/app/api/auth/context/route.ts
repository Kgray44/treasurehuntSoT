import { NextResponse } from "next/server";
import { resolveCurrentUser } from "@/homeport/current-user.server";

export async function GET() {
  const context = await resolveCurrentUser({ rotateCompatibility: true });
  return NextResponse.json(context, {
    status: context.status === "unavailable" ? 503 : 200,
    headers: { "Cache-Control": "no-store, private", Vary: "Cookie" },
  });
}
