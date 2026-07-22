import { NextResponse } from "next/server";
import { requireGmCapability, verifyCsrf } from "@/lib/security";
import { PrivateContentError } from "@/private-content/core";
import { nodeReadableFromRequest, privateUploadLimits, receivePrivateUploadPart } from "@/private-content/uploads";

export const runtime = "nodejs";
export async function PUT(request: Request, { params }: { params: Promise<{ uploadId: string; partNumber: string }> }) {
  const session = await requireGmCapability("CREATE_TALES");
  if (!session || !(await verifyCsrf(session))) return NextResponse.json({ error: "Creator authorization is required." }, { status: 403 });
  try {
    const length = request.headers.get("content-length");
    if (length && (!/^\d+$/.test(length) || Number(length) > privateUploadLimits.maxPartBytes)) throw new Error("invalid");
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/octet-stream")) throw new Error("invalid");
    const digest = request.headers.get("x-content-sha256");
    if (!digest) throw new Error("invalid");
    const value = await params;
    return NextResponse.json(await receivePrivateUploadPart({ actorId: session.userId, uploadId: value.uploadId, partNumber: Number(value.partNumber), expectedSha256: digest, body: nodeReadableFromRequest(request), signal: request.signal }), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const known = error instanceof PrivateContentError;
    return NextResponse.json({ code: known ? error.code : "PRIVATE_PACKAGE_INVALID", error: "The private upload part could not be accepted.", correlationId: known ? error.correlationId : crypto.randomUUID() }, { status: known && error.code === "PRIVATE_CONTENT_FORBIDDEN" ? 403 : 400, headers: { "Cache-Control": "private, no-store" } });
  }
}
