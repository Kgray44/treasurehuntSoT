import { NextResponse } from "next/server";
import { z } from "zod";
import { communityApiError } from "@/community/api";
import { CommunityError } from "@/community/domain";
import { getSealedHoldPublicMediaPort } from "@/community/sealed-hold-public-media";
import {
  readOwnerVoyageLogPublicMedia,
  removeVoyageLogPublicMedia,
  selectVoyageLogPublicMedia,
} from "@/community/voyage-log-media";
import { requireCanonicalAccountIdentity } from "@/platform/auth";
import { requireSocialActor, socialAccessDenied } from "../../social/contract";

const opaqueId = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/, "Identifier is invalid.");
const selectSchema = z.object({ voyageLogId: opaqueId, sourceOpaqueId: opaqueId }).strict();
const removeSchema = z.object({ voyageLogId: opaqueId, mediaId: opaqueId }).strict();
const invalidInput = () =>
  NextResponse.json({ code: "COMMUNITY_INVALID_INPUT", error: "The Community request is invalid." }, { status: 400 });

export async function GET(request: Request) {
  const identity = await requireCanonicalAccountIdentity();
  if (!identity) return socialAccessDenied();
  const voyageLogId = new URL(request.url).searchParams.get("voyageLogId");
  if (!voyageLogId || !opaqueId.safeParse(voyageLogId).success) return invalidInput();
  try {
    const selected = await readOwnerVoyageLogPublicMedia({ ownerAccountId: identity.accountId, voyageLogId });
    try {
      const candidates = await getSealedHoldPublicMediaPort().listOwnerAuthorizedCandidates({
        ownerAccountId: identity.accountId,
        voyageLogId,
      });
      return NextResponse.json(
        { voyageLogId, selected, candidates, providerStatus: "READY" },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    } catch (cause) {
      if (!(cause instanceof CommunityError) || cause.code !== "COMMUNITY_PUBLIC_MEDIA_PROVIDER_NOT_CONFIGURED")
        throw cause;
      return NextResponse.json(
        { voyageLogId, selected, candidates: [], providerStatus: "NOT_CONFIGURED" },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    }
  } catch (cause) {
    return communityApiError(cause);
  }
}
export async function POST(request: Request) {
  const actor = await requireSocialActor(request);
  if (!actor) return socialAccessDenied();
  try {
    const input = selectSchema.parse(await request.json());
    const derivatives = getSealedHoldPublicMediaPort();
    const source = await derivatives.readOwnerAuthorizedSource({ ...input, ownerAccountId: actor.accountId });
    if (source.sourceOpaqueId !== input.sourceOpaqueId)
      throw new CommunityError("COMMUNITY_MEDIA_SOURCE_MISMATCH", "The selected protected-media identity changed.");
    const selected = await selectVoyageLogPublicMedia({
      ...input,
      ownerAccountId: actor.accountId,
      subjectParticipantId: source.subjectParticipantId,
      declaredMediaType: source.declaredMediaType,
      sourceBytes: source.bytes,
      scannerReceipt: source.scannerReceipt,
      derivatives,
    });
    return NextResponse.json(selected, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (cause) {
    if (cause instanceof z.ZodError || cause instanceof SyntaxError) return invalidInput();
    return communityApiError(cause);
  }
}
export async function DELETE(request: Request) {
  const actor = await requireSocialActor(request);
  if (!actor) return socialAccessDenied();
  try {
    const input = removeSchema.parse(await request.json());
    await removeVoyageLogPublicMedia({ ...input, ownerAccountId: actor.accountId });
    return new NextResponse(null, { status: 204, headers: { "Cache-Control": "private, no-store" } });
  } catch (cause) {
    if (cause instanceof z.ZodError || cause instanceof SyntaxError) return invalidInput();
    return communityApiError(cause);
  }
}
