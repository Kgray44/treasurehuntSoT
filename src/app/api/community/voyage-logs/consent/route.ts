import { NextResponse } from "next/server";
import { communityApiError } from "@/community/api";
import { requestVoyageLogPublicationConsent } from "@/community/voyage-log-consent";
import { requireSocialActor, socialAccessDenied } from "../../social/contract";
import { requestPublicationConsentSchema } from "./contract";

export async function POST(request: Request) {
  const actor = await requireSocialActor(request);
  if (!actor) return socialAccessDenied();
  try {
    const input = requestPublicationConsentSchema.parse(await request.json());
    return NextResponse.json(
      await requestVoyageLogPublicationConsent({
        ...input,
        ownerAccountId: actor.accountId,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
      }),
      { status: 201, headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (cause) {
    return communityApiError(cause);
  }
}
