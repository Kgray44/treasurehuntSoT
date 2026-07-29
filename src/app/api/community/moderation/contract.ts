import { NextResponse } from "next/server";
import { z } from "zod";
import { communityApiError } from "@/community/api";
import type { CommunityModeratorActor } from "@/community/moderation";
import { db } from "@/lib/db";
import { requireCanonicalAccountIdentity, verifyPlayerCsrf } from "@/platform/auth";

export const opaqueId = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/u);
export const reasonCode = z.string().trim().min(2).max(64);
export const expectedRevision = z.number().int().positive().max(1_000_000);

export async function canonicalCommunityActor(request?: Request): Promise<CommunityModeratorActor | null> {
  const identity = await requireCanonicalAccountIdentity();
  if (!identity || (request && !(await verifyPlayerCsrf(request.headers.get("x-csrf-token"))))) return null;
  const rows = await db.accountRoleAssignment.findMany({
    where: { accountId: identity.accountId, revokedAt: null },
    select: { role: true },
  });
  return { accountId: identity.accountId, roles: rows.map((row) => row.role) };
}
export function denied() {
  return NextResponse.json(
    { code: "COMMUNITY_ACCESS_DENIED", error: "A valid authorized session is required." },
    { status: 403 },
  );
}
export async function readBody<T>(request: Request, schema: z.ZodType<T>) {
  try {
    return { value: schema.parse(await request.json()) } as const;
  } catch (cause) {
    return { error: cause } as const;
  }
}
export function routeError(cause: unknown) {
  return communityApiError(cause);
}
