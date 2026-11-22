import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStudioWorkspace } from "@/chronicle/studio-authorization";
import { verifyPlayerCsrf } from "@/platform/auth";
import { communityApiError } from "@/community/api";
import {
  creatorChroniclePublicationSchema,
  submitCreatorChroniclePublication,
} from "@/community/creator-chronicle-publication";

const requestSchema = z.strictObject({
  publication: creatorChroniclePublicationSchema,
  reviewDigest: z.string().regex(/^[a-f0-9]{64}$/),
});
export async function POST(request: Request) {
  const actor = await requireStudioWorkspace(request);
  if (!actor || !(await verifyPlayerCsrf(request.headers.get("x-csrf-token"))))
    return NextResponse.json(
      { code: "COMMUNITY_ACCESS_DENIED", error: "Creator access and CSRF verification required." },
      { status: 403 },
    );
  try {
    const input = requestSchema.parse(await request.json());
    return NextResponse.json(
      await submitCreatorChroniclePublication(actor.accountId, input.publication, input.reviewDigest),
      { status: 201, headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (cause) {
    return communityApiError(cause);
  }
}
