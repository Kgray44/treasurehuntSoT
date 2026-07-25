import { NextResponse } from "next/server";
import { z } from "zod";

import { generatePrivateVoyageKeepsake, toPrivateKeepsakeProjection } from "@/community/keepsakes";
import { databaseKeepsakeStore, findCompletedSessionForOwner } from "@/community/keepsake-store";
import { communityApiError } from "@/community/api";
import { requireCanonicalAccountIdentity, verifyPlayerCsrf } from "@/platform/auth";

const generateKeepsakeSchema = z
  .object({
    taleSessionId: z.string().trim().min(1).max(191),
  })
  .strict();

export async function POST(request: Request) {
  const identity = await requireCanonicalAccountIdentity();
  if (!identity)
    return NextResponse.json(
      { code: "COMMUNITY_ACCESS_DENIED", error: "Sign in with your canonical account to create a Voyage Keepsake." },
      { status: 401 },
    );
  if (!(await verifyPlayerCsrf(request.headers.get("x-csrf-token"))))
    return NextResponse.json(
      { code: "COMMUNITY_ACCESS_DENIED", error: "Your signed-in session could not be verified." },
      { status: 403 },
    );

  let input: z.infer<typeof generateKeepsakeSchema>;
  try {
    input = generateKeepsakeSchema.parse(await request.json());
  } catch {
    return NextResponse.json(
      { code: "COMMUNITY_INVALID_KEEPSAKE", error: "The Voyage Keepsake request is invalid." },
      { status: 400 },
    );
  }
  try {
    const session = await findCompletedSessionForOwner(input.taleSessionId, identity.accountId);
    // The source title is selected from the canonical Chronicle in the
    // adapter. It is never accepted from a browser request.
    if (!session)
      return NextResponse.json(
        { code: "COMMUNITY_COMPLETION_REQUIRED", error: "A completed canonical voyage is required for a Voyage Keepsake." },
        { status: 403 },
      );
    const result = await generatePrivateVoyageKeepsake(databaseKeepsakeStore, {
      ownerAccountId: identity.accountId,
      taleSessionId: input.taleSessionId,
      taleTitle: session.taleTitle,
    });
    return NextResponse.json({ state: result.created ? "CREATED" : "EXISTING", keepsake: toPrivateKeepsakeProjection(result.keepsake) }, { status: result.created ? 201 : 200 });
  } catch (cause) {
    return communityApiError(cause);
  }
}
