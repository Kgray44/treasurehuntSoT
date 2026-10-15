import { NextResponse } from "next/server";
import { requireCanonicalAccountIdentity } from "@/platform/auth";
import { communityApiError } from "@/community/api";
import { listOwnedSpatialPublications, listSpatialPublicationLicenses } from "@/community/spatial-publication";

export async function GET(request: Request) {
  const actor = await requireCanonicalAccountIdentity();
  if (!actor)
    return NextResponse.json(
      { code: "COMMUNITY_ACCESS_DENIED", error: "Sign in to review Community licenses." },
      { status: 403 },
    );
  try {
    const url = new URL(request.url);
    const kind = url.searchParams.get("kind");
    const source = {
      kind,
      id: url.searchParams.get("id"),
      revision: Number(url.searchParams.get("revision")),
      ...(kind === "ENVIRONMENT" ? { versionId: url.searchParams.get("versionId") } : {}),
    };
    const [licenses, listings] = await Promise.all([
      listSpatialPublicationLicenses(),
      listOwnedSpatialPublications(actor.accountId, source),
    ]);
    return NextResponse.json({ licenses, listings }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (cause) {
    return communityApiError(cause);
  }
}
