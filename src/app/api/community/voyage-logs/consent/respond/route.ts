import { NextResponse } from "next/server";
import { communityApiError } from "@/community/api";
import { respondToVoyageLogPublicationConsent } from "@/community/voyage-log-consent";
import { requireSocialActor, socialAccessDenied } from "../../../social/contract";
import { respondPublicationConsentSchema } from "../contract";

export async function POST(request: Request) {
  const actor = await requireSocialActor(request);
  if (!actor) return socialAccessDenied();
  try {
    const input = respondPublicationConsentSchema.parse(await request.json());
    return NextResponse.json(await respondToVoyageLogPublicationConsent({ ...input, accountId: actor.accountId }), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (cause) {
    return communityApiError(cause);
  }
}
