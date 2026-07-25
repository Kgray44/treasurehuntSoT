import { NextResponse } from "next/server";
import { requireGmCapability, verifyCsrf } from "@/lib/security";
import { parsePrivateContentConfiguration } from "@/private-content/config";
import { collectPrivateProviderHealth, createPrivateProviderRuntime } from "@/private-content/providers";
import { db } from "@/lib/db";

export async function GET() {
  const session = await requireGmCapability("ADMIN");
  if (!session) return NextResponse.json({ error: "Administrator authorization is required." }, { status: 403 });
  try {
    const runtime = createPrivateProviderRuntime(parsePrivateContentConfiguration());
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
    return NextResponse.json(
      { providers, backupRuns, repairs, drills },
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
