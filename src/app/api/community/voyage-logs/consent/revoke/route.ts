import { NextResponse } from "next/server";
import { communityApiError } from "@/community/api";
import { revokeVoyageLogPublicationConsent } from "@/community/voyage-log-consent";
import { requireSocialActor, socialAccessDenied } from "../../../social/contract";
import { revokePublicationConsentSchema } from "../contract";

export async function POST(request: Request) {
  const actor = await requireSocialActor(request);
  if (!actor) return socialAccessDenied();
  try {
    const input = revokePublicationConsentSchema.parse(await request.json());
    return NextResponse.json(await revokeVoyageLogPublicationConsent({ ...input, accountId: actor.accountId }), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (cause) {
    return communityApiError(cause);
  }
}
