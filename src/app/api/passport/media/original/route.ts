import { NextResponse } from "next/server";
import { readOwnedProfileMediaOriginal } from "@/wayfarer/profile-media";
import { requireWayfarerAccount } from "@/wayfarer/http";

export async function GET(request: Request) {
  const session = await requireWayfarerAccount();
  const profileId = session?.account.profile?.id;
  const id = new URL(request.url).searchParams.get("id")?.trim();
  if (!profileId || !id) return NextResponse.json({ error: "Original media not found." }, { status: 404 });
  const result = await readOwnedProfileMediaOriginal(profileId, id);
  if (!result) return NextResponse.json({ error: "Original media not found." }, { status: 404 });
  return new Response(new Uint8Array(result.buffer), {
    headers: {
      "Content-Type": result.mimeType,
      "Content-Length": String(result.buffer.length),
      "Cache-Control": "private, no-store",
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
