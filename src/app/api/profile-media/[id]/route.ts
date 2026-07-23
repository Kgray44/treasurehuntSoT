import { NextResponse } from "next/server";
import { requireWayfarerAccount } from "@/wayfarer/http";
import { readProfileMedia } from "@/wayfarer/profile-media";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const result = await readProfileMedia((await context.params).id);
  if (!result || result.media.profile.status !== "ACTIVE")
    return NextResponse.json({ error: "Media not found." }, { status: 404 });
  const session = await requireWayfarerAccount();
  const owner = session?.accountId === result.media.profile.accountId;
  const visibility = result.media.profile.privacyRules[0]?.visibility ?? result.media.profile.defaultVisibility;
  const allowed =
    owner ||
    visibility === "PUBLIC" ||
    visibility === "UNLISTED" ||
    (visibility === "REGISTERED_USERS" && Boolean(session));
  if (!allowed) return NextResponse.json({ error: "Media not found." }, { status: 404 });
  return new Response(new Uint8Array(result.buffer), {
    headers: {
      "Content-Type": result.media.mimeType,
      "Content-Length": String(result.buffer.length),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
