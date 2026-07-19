import { NextResponse } from "next/server";

import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const nonceHashPattern = /^[a-f0-9]{64}$/u;

function unavailable() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function GET() {
  const nonceHash = process.env.FOREVER_VALIDATION_NONCE_HASH;
  const productionIdentityEnabled =
    process.env.NODE_ENV !== "production" || process.env.FOREVER_VALIDATION_PRODUCTION_IDENTITY === "1";
  if (
    !productionIdentityEnabled ||
    process.env.FOREVER_VALIDATION_ISOLATION !== "1" ||
    !nonceHash ||
    !nonceHashPattern.test(nonceHash)
  ) {
    return unavailable();
  }

  try {
    const markerCount = await db.platformAuditEvent.count({
      where: {
        action: "VALIDATION_DATABASE_IDENTITY",
        resourceType: "VALIDATION_DATABASE",
        resourceId: nonceHash,
        correlationId: nonceHash,
      },
    });
    const nonceMatch = markerCount === 1;
    return NextResponse.json({ validationDatabase: true, nonceMatch }, { status: nonceMatch ? 200 : 409 });
  } catch {
    return NextResponse.json({ validationDatabase: false, nonceMatch: false }, { status: 503 });
  }
}
