import { NextResponse } from "next/server";
import { requireStudioWorkspace } from "@/chronicle/studio-authorization";
import { db } from "@/lib/db";
export async function GET() {
  const session = await requireStudioWorkspace();
  if (!session) return NextResponse.json({ error: "Creator authorization is required." }, { status: 403 });
  const imports = await db.privateContentImport.findMany({
    where: {
      OR: [
        { ownerAccountId: session.accountId },
        ...(session.account.legacyGameMasterId ? [{ ownerActorId: session.account.legacyGameMasterId }] : []),
      ],
    },
    select: {
      id: true,
      packageId: true,
      packageRevision: true,
      status: true,
      createdAt: true,
      completedAt: true,
      warnings: true,
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json({ imports }, { headers: { "Cache-Control": "private, no-store" } });
}
