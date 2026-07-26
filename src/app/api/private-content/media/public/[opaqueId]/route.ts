import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parsePrivateContentConfiguration } from "@/private-content/config";
import { matchesProtectedMediaEtag } from "@/private-content/media/delivery";
import { createPrivateProviderRuntime } from "@/private-content/providers";

type PublicDerivative = {
  state: string;
  scanState: string;
  withdrawnAt: Date | null;
  outputChecksum: string;
  outputMediaType: string;
  outputByteLength: number;
  purpose: string;
  derivativeObject: { storageKey: string; sha256: string; byteLength: number };
  sourceMedia: { scanState: string; sourceObject: { scanStatus: string } };
  grants: Array<{
    authorizationRevision: string;
    purpose: string;
    association: { sourceRevision: string };
  }>;
};
const privateDb = db as unknown as {
  protectedMediaDerivative: { findUnique(input: unknown): Promise<PublicDerivative | null> };
};

/** Public delivery is application-mediated, short-cacheable, and opaque. */
export async function GET(request: Request, context: { params: Promise<{ opaqueId: string }> }) {
  try {
    const { opaqueId } = await context.params;
    const revision = new URL(request.url).searchParams.get("revision");
    if (!revision || !/^[A-Za-z0-9_.:-]{1,160}$/.test(revision)) return new NextResponse(null, { status: 404 });
    const derivative = await privateDb.protectedMediaDerivative.findUnique({
      where: { storageOpaqueReference: opaqueId },
      include: {
        derivativeObject: true,
        sourceMedia: { include: { sourceObject: true } },
        grants: { where: { state: "ACTIVE", audience: "PUBLIC" }, include: { association: true } },
      },
    });
    const grant = derivative?.grants.find(
      (candidate) =>
        candidate.authorizationRevision === revision &&
        candidate.association.sourceRevision === revision &&
        candidate.purpose === derivative.purpose,
    );
    if (
      !derivative ||
      !grant ||
      derivative.state !== "READY" ||
      derivative.scanState !== "CLEAN" ||
      derivative.withdrawnAt ||
      derivative.sourceMedia.scanState !== "CLEAN" ||
      derivative.sourceMedia.sourceObject.scanStatus !== "CLEAN"
    )
      return new NextResponse(null, { status: 404 });
    const etag = `\"${derivative.outputChecksum}\"`;
    if (matchesProtectedMediaEtag(request.headers.get("if-none-match") ?? undefined, derivative.outputChecksum))
      return new NextResponse(null, {
        status: 304,
        headers: {
          "Cache-Control": "public, max-age=60, must-revalidate",
          ETag: etag,
          "X-Content-Type-Options": "nosniff",
        },
      });
    const runtime = createPrivateProviderRuntime(parsePrivateContentConfiguration());
    const nodeStream = await runtime.storage.read({
      key: derivative.derivativeObject.storageKey,
      sha256: derivative.derivativeObject.sha256,
      byteLength: derivative.derivativeObject.byteLength,
      mediaType: derivative.outputMediaType,
    });
    return new NextResponse(Readable.toWeb(nodeStream) as ReadableStream, {
      headers: {
        "Cache-Control": "public, max-age=60, must-revalidate",
        ETag: etag,
        "Content-Type": derivative.outputMediaType,
        "Content-Length": String(derivative.outputByteLength),
        "Content-Disposition": "inline",
        "X-Content-Type-Options": "nosniff",
        "Cross-Origin-Resource-Policy": "cross-origin",
      },
    });
  } catch {
    // Do not distinguish provider, authorization, absent-object, or opaque-ID failures.
    return new NextResponse(null, { status: 404 });
  }
}
