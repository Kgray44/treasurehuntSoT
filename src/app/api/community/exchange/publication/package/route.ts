import { NextResponse } from "next/server";
import { communityApiError } from "@/community/api";
import { persistVerifiedCommunityPackage } from "@/community/exchange-service";
import { exchangeAccessDenied, requireExchangeActor } from "../../auth";
import { decodePackageFiles, parseExchangeInput, publicationInputSchema } from "../../input";

export async function POST(request: Request) {
  const identity = await requireExchangeActor(request);
  if (!identity) return exchangeAccessDenied();
  try {
    const input = parseExchangeInput(publicationInputSchema, await request.json());
    return NextResponse.json(
      await persistVerifiedCommunityPackage(
        identity.accountId,
        input.releaseId,
        input.manifest,
        decodePackageFiles(input.files),
      ),
      { status: 201 },
    );
  } catch (cause) {
    return communityApiError(cause);
  }
}
