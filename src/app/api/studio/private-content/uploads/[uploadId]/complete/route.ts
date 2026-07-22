import { NextResponse } from "next/server";
import { requireGmCapability, verifyCsrf } from "@/lib/security";
import { PrivateContentError } from "@/private-content/core";
import { completePrivateUploadStream } from "@/private-content/uploads";

export async function POST(request: Request, { params }: { params: Promise<{ uploadId: string }> }) {
  const session = await requireGmCapability("CREATE_TALES");
  if (!session || !(await verifyCsrf(session))) return NextResponse.json({ error: "Creator authorization is required." }, { status: 403 });
  try {
    return NextResponse.json(await completePrivateUploadStream({ actorId: session.userId, uploadId: (await params).uploadId, expectedSha256: request.headers.get("x-content-sha256") ?? undefined }), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const known = error instanceof PrivateContentError;
    return NextResponse.json({ code: known ? error.code : "PRIVATE_PACKAGE_INVALID", error: "The private upload could not be completed.", correlationId: known ? error.correlationId : crypto.randomUUID() }, { status: known && error.code === "PRIVATE_CONTENT_FORBIDDEN" ? 403 : 400, headers: { "Cache-Control": "private, no-store" } });
  }
}
