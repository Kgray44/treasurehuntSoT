import { NextResponse } from "next/server";
import { z } from "zod";

import { databaseKeepsakeStore } from "@/community/keepsake-store";
import {
  createVoyageLogDraftFromWayfarer,
  unavailableWayfarerKeepsakeSource,
} from "@/community/wayfarer-keepsake-source";
import { ensureVoyageLogDraft } from "@/community/voyage-log-owner";
import { communityApiError } from "@/community/api";
import { requireCanonicalAccountIdentity, verifyPlayerCsrf } from "@/platform/auth";

const generateKeepsakeSchema = z
  .object({
    wayfarerKeepsakeId: z.string().trim().min(1).max(191),
  })
  .strict();

export async function POST(request: Request) {
  const identity = await requireCanonicalAccountIdentity();
  if (!identity)
    return NextResponse.json(
      { code: "COMMUNITY_ACCESS_DENIED", error: "Sign in with your canonical account to prepare Voyage Log sharing." },
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
      { code: "COMMUNITY_INVALID_KEEPSAKE_SOURCE", error: "The Wayfarer Keepsake request is invalid." },
      { status: 400 },
    );
  }
  try {
    const result = await createVoyageLogDraftFromWayfarer(unavailableWayfarerKeepsakeSource, databaseKeepsakeStore, {
      ownerAccountId: identity.accountId,
      sourceKeepsakeId: input.wayfarerKeepsakeId,
    });
    const voyageLog = await ensureVoyageLogDraft({ ownerAccountId: identity.accountId, keepsakeId: result.record.id });
    return NextResponse.json(
      {
        state: result.created ? "DRAFT_CREATED" : "DRAFT_EXISTING",
        voyageLogDraft: { id: voyageLog.id, state: voyageLog.lifecycleState },
      },
      { status: result.created ? 201 : 200, headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (cause) {
    return communityApiError(cause);
  }
}
