import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parsePrivateContentConfiguration } from "@/private-content/config";
import { createPrivateProviderRuntime } from "@/private-content/providers";
import { requireWayfarerAccount } from "@/wayfarer/http";

type MemoryMediaAssociation = {
  protectedMedia: {
    detectedMediaType: string;
    byteLength: number;
    scanState: string;
    availabilityState: string;
    withdrawnAt: Date | null;
    archivedAt: Date | null;
    sourceObject: {
      storageKey: string;
      sha256: string;
      byteLength: number;
      scanStatus: string;
      finalizedAt: Date | null;
    };
  };
};
const privateDb = db as unknown as {
  chronicleMemory: { findFirst(input: unknown): Promise<{ id: string } | null> };
  protectedMediaAssociation: { findFirst(input: unknown): Promise<MemoryMediaAssociation | null> };
};

/** Owner-only original delivery for an attached Memory; all unsafe states collapse to a neutral 404. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ recordId: string; memoryId: string; mediaId: string }> },
) {
  try {
    const session = await requireWayfarerAccount();
    if (!session?.account.profile) return new NextResponse(null, { status: 404 });
    const { recordId, memoryId, mediaId } = await context.params;
    const memory = await privateDb.chronicleMemory.findFirst({
      where: {
        id: memoryId,
        playerProfileId: session.account.profile.id,
        playerChronicleRecordId: recordId,
        deletedAt: null,
        record: { playerProfileId: session.account.profile.id },
      },
      select: { id: true },
    });
    if (!memory) return new NextResponse(null, { status: 404 });
    const association = await privateDb.protectedMediaAssociation.findFirst({
      where: {
        protectedMediaId: mediaId,
        ownerAccountId: session.account.id,
        authority: "WAYFARER",
        subjectKind: "WAYFARER_MEMORY",
        subjectOpaqueId: memory.id,
        purpose: "MEMORY_PRIVATE",
        removedAt: null,
      },
      select: {
        protectedMedia: {
          select: {
            detectedMediaType: true,
            byteLength: true,
            scanState: true,
            availabilityState: true,
            withdrawnAt: true,
            archivedAt: true,
            sourceObject: {
              select: { storageKey: true, sha256: true, byteLength: true, scanStatus: true, finalizedAt: true },
            },
          },
        },
      },
    });
    const media = association?.protectedMedia;
    if (
      !media ||
      media.scanState !== "CLEAN" ||
      media.availabilityState !== "AVAILABLE" ||
      media.withdrawnAt ||
      media.archivedAt ||
      media.sourceObject.scanStatus !== "CLEAN" ||
      !media.sourceObject.finalizedAt
    )
      return new NextResponse(null, { status: 404 });
    const runtime = createPrivateProviderRuntime(parsePrivateContentConfiguration());
    const stream = await runtime.storage.read({
      key: media.sourceObject.storageKey,
      sha256: media.sourceObject.sha256,
      byteLength: media.sourceObject.byteLength,
      mediaType: media.detectedMediaType,
    });
    return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Type": media.detectedMediaType,
        "Content-Length": String(media.byteLength),
        "Content-Disposition": "inline",
        "X-Content-Type-Options": "nosniff",
        "Cross-Origin-Resource-Policy": "same-site",
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
