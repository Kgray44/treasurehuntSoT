import { NextResponse } from "next/server";
import { communityApiError } from "@/community/api";
import { readParticipantVoyageLogConsentInbox } from "@/community/voyage-log-consent";
import { requireCanonicalAccountIdentity } from "@/platform/auth";
import { socialAccessDenied } from "../../../social/contract";

export async function GET(request: Request) {
  const identity = await requireCanonicalAccountIdentity();
  if (!identity) return socialAccessDenied();
  try {
    return NextResponse.json(await readParticipantVoyageLogConsentInbox(identity.accountId), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (cause) {
    return communityApiError(cause);
  }
}
