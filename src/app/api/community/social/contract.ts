import { NextResponse } from "next/server";
import { z } from "zod";
import { communityApiError } from "@/community/api";
import type { CommunityActor } from "@/community/services";
import { requireCanonicalAccountIdentity, verifyPlayerCsrf } from "@/platform/auth";

const opaqueId = z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/, "Identifier is invalid.");
const subjectType = z.enum(["LISTING", "RELEASE", "CREATOR", "VOYAGE_LOG", "COLLECTION", "GUIDE"]);

export const followInputSchema = z.object({ creatorProfileId: opaqueId }).strict();
export const blockInputSchema = z.object({ accountId: opaqueId }).strict();
export const saveInputSchema = z.object({ subjectType, subjectId: opaqueId }).strict();

export async function requireSocialActor(request: Request): Promise<CommunityActor | null> {
  const identity = await requireCanonicalAccountIdentity();
  if (!identity || !(await verifyPlayerCsrf(request.headers.get("x-csrf-token")))) return null;
  return { accountId: identity.accountId };
}

export function socialAccessDenied() {
  return NextResponse.json(
    { code: "COMMUNITY_ACCESS_DENIED", error: "A valid signed-in session and CSRF token are required." },
    { status: 403 },
  );
}

export async function executeSocialMutation<T>(
  request: Request,
  schema: z.ZodType<T>,
  mutation: (actor: CommunityActor, input: T) => Promise<unknown>,
  status = 200,
) {
  const actor = await requireSocialActor(request);
  if (!actor) return socialAccessDenied();
  try {
    const input = schema.parse(await request.json());
    return NextResponse.json(await mutation(actor, input), { status });
  } catch (cause) {
    if (cause instanceof z.ZodError || cause instanceof SyntaxError)
      return NextResponse.json(
        { code: "COMMUNITY_INVALID_INPUT", error: "The Community request is invalid." },
        { status: 400 },
      );
    return communityApiError(cause);
  }
}
