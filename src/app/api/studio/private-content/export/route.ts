import { NextResponse } from "next/server";
import { requireStudioWorkspace } from "@/chronicle/studio-authorization";
import { db } from "@/lib/db";
import { PrivateContentError } from "@/private-content/core";
import { exportPrivateImport } from "@/private-content/service";

export async function POST(request: Request) {
  const session = await requireStudioWorkspace(request);
  if (!session) return NextResponse.json({ error: "Creator authorization is required." }, { status: 403 });
  try {
    const body = (await request.json()) as { importId?: string; passphrase?: string };
    if (!body.importId || typeof body.passphrase !== "string") throw new Error("invalid");
    const owned = await db.privateContentImport.findFirst({
      where: {
        id: body.importId,
        OR: [
          { ownerAccountId: session.accountId },
          ...(session.account.legacyGameMasterId ? [{ ownerActorId: session.account.legacyGameMasterId }] : []),
        ],
      },
      select: { id: true },
    });
    if (!owned) return NextResponse.json({ error: "Private import not found." }, { status: 404 });
    const receipt = await exportPrivateImport(body.importId, body.passphrase);
    return NextResponse.json(
      { ...receipt, packageBytes: receipt.packageBytes.toString("base64") },
      { headers: { "Cache-Control": "private, no-store", Pragma: "no-cache" } },
    );
  } catch (error) {
    const correlationId = error instanceof PrivateContentError ? error.correlationId : crypto.randomUUID();
    return NextResponse.json(
      {
        code: error instanceof PrivateContentError ? error.code : "PRIVATE_PACKAGE_AUTHENTICATION_FAILED",
        error: "The private export could not be created.",
        correlationId,
      },
      { status: 400, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
