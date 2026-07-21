import { NextResponse } from "next/server";
import { getPublicRelease } from "@/community/services";
export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const release = await getPublicRelease((await context.params).id);
  return release
    ? NextResponse.json(release)
    : NextResponse.json({ code: "COMMUNITY_RELEASE_NOT_FOUND", error: "Release not found." }, { status: 404 });
}
