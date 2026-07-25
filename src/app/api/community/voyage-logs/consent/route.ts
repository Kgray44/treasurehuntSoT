import { NextResponse } from "next/server";
import { communityApiError } from "@/community/api";
import { readOwnerVoyageLogConsentDashboard, requestVoyageLogPublicationConsent } from "@/community/voyage-log-consent";
import { requireCanonicalAccountIdentity } from "@/platform/auth";
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

export async function GET(request: Request) {
  const identity = await requireCanonicalAccountIdentity();
  if (!identity) return socialAccessDenied();
  const voyageLogId = new URL(request.url).searchParams.get("voyageLogId");
  if (!voyageLogId || !/^[A-Za-z0-9_-]{1,128}$/u.test(voyageLogId))
    return NextResponse.json(
      { code: "COMMUNITY_INVALID_INPUT", error: "Voyage Log identifier is invalid." },
      { status: 400 },
    );
  try {
    return NextResponse.json(await readOwnerVoyageLogConsentDashboard(identity.accountId, voyageLogId), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (cause) {
    return communityApiError(cause);
  }
}
