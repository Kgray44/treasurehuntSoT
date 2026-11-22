import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStudioWorkspace } from "@/chronicle/studio-authorization";
import { verifyPlayerCsrf } from "@/platform/auth";
import { communityApiError } from "@/community/api";
import { installCreatorChronicleRelease } from "@/community/creator-chronicle-installation";

const requestSchema = z.strictObject({
  listingId: z.string().min(1).max(128),
  releaseId: z.string().min(1).max(128),
  packageChecksum: z.string().regex(/^[a-f0-9]{64}$/),
  requestId: z.string().min(8).max(128),
});
export async function POST(request: Request) {
  const actor = await requireStudioWorkspace(request);
  if (!actor || !(await verifyPlayerCsrf(request.headers.get("x-csrf-token"))))
    return NextResponse.json(
      { code: "COMMUNITY_ACCESS_DENIED", error: "Creator access and CSRF verification required." },
      { status: 403 },
    );
  try {
    return NextResponse.json(
      await installCreatorChronicleRelease({
        accountId: actor.accountId,
        ...requestSchema.parse(await request.json()),
      }),
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (cause) {
    return communityApiError(cause);
  }
}
