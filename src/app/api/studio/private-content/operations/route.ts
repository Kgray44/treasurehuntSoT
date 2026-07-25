import { NextResponse } from "next/server";
import { requireGmCapability, verifyCsrf } from "@/lib/security";
import { parsePrivateContentConfiguration } from "@/private-content/config";
import { collectPrivateProviderHealth, createPrivateProviderRuntime } from "@/private-content/providers";
import { db } from "@/lib/db";
import { sha256 } from "@/private-content/core";

export async function GET() {
  const session = await requireGmCapability("ADMIN");
  if (!session) return NextResponse.json({ error: "Administrator authorization is required." }, { status: 403 });
  try {
    const runtime = createPrivateProviderRuntime(parsePrivateContentConfiguration());
    const privateDb = db as typeof db & {
      protectedMedia: { count(input: unknown): Promise<number> };
      protectedMediaDerivative: { count(input: unknown): Promise<number> };
      protectedMediaGrant: { count(input: unknown): Promise<number> };
    };
    const [providers, backupRuns, repairs, drills] = await Promise.all([
      collectPrivateProviderHealth(runtime),
      db.privateBackupRun.findMany({
        select: { backupId: true, state: true, verifiedAt: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      db.privateRepairPlan.findMany({
        select: {
          digest: true,
          state: true,
          dryRun: true,
          expiresAt: true,
          createdAt: true,
          _count: { select: { actions: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      db.privateRestoreDrill.findMany({
        select: { targetIdentity: true, state: true, resultCode: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ]);
    // A rolling Phase 3 deployment may serve the existing operations console
    // before Phase 4 migrations are present. Do not hide all operational state
    // because the additive metadata projection is not available yet.
    const protectedMedia = await Promise.all([
      privateDb.protectedMedia?.count({}),
      privateDb.protectedMediaDerivative?.count({ where: { state: "READY" } }),
      privateDb.protectedMediaDerivative?.count({ where: { state: "BLOCKED_CONSENT" } }),
      privateDb.protectedMediaDerivative?.count({ where: { state: "WITHDRAWN" } }),
      privateDb.protectedMediaGrant?.count({ where: { state: { in: ["INVALIDATED", "EXPIRED"] } } }),
    ]).catch(() => [undefined, undefined, undefined, undefined, undefined]);
    return NextResponse.json(
      {
        providers,
        backupRuns: backupRuns.map((backup) => ({
          ...backup,
          backupId: `backup-${sha256(backup.backupId).slice(0, 16)}`,
        })),
        repairs: repairs.map((repair) => ({ ...repair, digest: repair.digest.slice(0, 16) })),
        drills: drills.map((drill) => ({
          ...drill,
          targetIdentity: `restore-${sha256(drill.targetIdentity).slice(0, 16)}`,
        })),
        protectedMedia: {
          total: protectedMedia[0] ?? 0,
          readyDerivatives: protectedMedia[1] ?? 0,
          blockedConsent: protectedMedia[2] ?? 0,
          withdrawnDerivatives: protectedMedia[3] ?? 0,
          staleGrants: protectedMedia[4] ?? 0,
        },
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Private operational status is blocked by server configuration." },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
export async function POST(request: Request) {
  const session = await requireGmCapability("ADMIN");
  if (!session || !(await verifyCsrf(session)))
    return NextResponse.json({ error: "Administrator authorization is required." }, { status: 403 });
  const body = (await request.json().catch(() => null)) as { action?: string } | null;
  if (body?.action !== "provider-check")
    return NextResponse.json({ error: "This operational mutation is not available." }, { status: 400 });
  try {
    return NextResponse.json(
      {
        providers: await collectPrivateProviderHealth(createPrivateProviderRuntime(parsePrivateContentConfiguration())),
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Private provider readiness is blocked." },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
