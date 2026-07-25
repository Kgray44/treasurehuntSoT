import { NextResponse } from "next/server";
import { z } from "zod";

import type { KeepsakeStore } from "@/community/keepsakes";
import { requireCanonicalAccountIdentity, verifyPlayerCsrf } from "@/platform/auth";

const generateKeepsakeSchema = z
  .object({
    taleSessionId: z.string().trim().min(1).max(191),
  })
  .strict();

/**
 * This endpoint is intentionally closed until the shared Community service
 * owner wires an atomic KeepsakeStore over the Phase 3 migrations.  A route
 * must not substitute a process-local store or report a generated Keepsake
 * before canonical completion and unique persistence can be proven.
 */
async function resolveKeepsakeStore(): Promise<KeepsakeStore | null> {
  return null;
}

function unavailable() {
  return NextResponse.json(
    {
      code: "COMMUNITY_KEEPSAKE_STORE_UNAVAILABLE",
      error: "Voyage Keepsake generation is not available until its secure storage service is configured.",
    },
    { status: 503 },
  );
}

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

  try {
    generateKeepsakeSchema.parse(await request.json());
  } catch {
    return NextResponse.json(
      { code: "COMMUNITY_INVALID_KEEPSAKE", error: "The Voyage Keepsake request is invalid." },
      { status: 400 },
    );
  }

  // Keep this explicit integration seam visible to avoid a misleading 201
  // response while the schema has no migration-backed shared store adapter.
  if (!(await resolveKeepsakeStore())) return unavailable();
  return unavailable();
}
