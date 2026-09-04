import { NextResponse } from "next/server";
import { assertAuditRuntimeSafe } from "@/audit/runtime";

export const runtime = "nodejs";

export async function GET() {
  const audit = await assertAuditRuntimeSafe();
  if (!audit) return new NextResponse(null, { status: 404 });
  return NextResponse.json(
    {
      status: "BRIGHTWORK_STAGE6_AUDIT_READY",
      sourceSha: audit.config.sourceSha,
      fixtureVersion: audit.receipt.fixtureVersion,
      data: "SYNTHETIC_DISPOSABLE_ONLY",
      providers: "EXTERNAL_DISABLED_SYNTHETIC_EMAIL_ONLY",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
