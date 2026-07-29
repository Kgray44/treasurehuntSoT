import { NextResponse } from "next/server";

import { communityApiError } from "@/community/api";
import { revealCreatorResponseSpoiler } from "@/community/social";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id))
    return NextResponse.json(
      { code: "COMMUNITY_SPOILER_UNAVAILABLE", error: "This spoiler section is unavailable." },
      { status: 404 },
    );
  try {
    return NextResponse.json(await revealCreatorResponseSpoiler(id), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (cause) {
    return communityApiError(cause);
  }
}
