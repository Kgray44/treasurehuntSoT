import { NextResponse } from "next/server";
import { requirePlayerIdentity, verifyPlayerCsrf } from "@/platform/auth";
import { communityApiError } from "@/community/api";
import { transitionListing } from "@/community/services";
import { z } from "zod";

const transitionRequest = z.object({
  next: z.enum([
    "VALIDATING",
    "READY_FOR_REVIEW",
    "IN_REVIEW",
    "PUBLISHED",
    "UPDATE_PENDING",
    "QUARANTINED",
    "REJECTED",
    "ARCHIVED",
    "REMOVED",
    "DRAFT",
  ]),
});

/** The public route only permits the creator-owned intake path; moderation is
 * intentionally an adapter seam until Wayfarer's canonical role resolver lands. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const identity = await requirePlayerIdentity();
  if (!identity || !(await verifyPlayerCsrf(request.headers.get("x-csrf-token"))))
    return NextResponse.json(
      { code: "COMMUNITY_ACCESS_DENIED", error: "A valid signed-in session is required." },
      { status: 403 },
    );
  try {
    const body = transitionRequest.parse(await request.json());
    return NextResponse.json(
      await transitionListing({ playerProfileId: identity.playerProfileId }, (await context.params).id, body.next),
    );
  } catch (cause) {
    return communityApiError(cause);
  }
}
