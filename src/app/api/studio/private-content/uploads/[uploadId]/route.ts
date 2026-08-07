import { NextResponse } from "next/server";
import { requireStudioWorkspace } from "@/chronicle/studio-authorization";
import { PrivateContentError } from "@/private-content/core";
import {
  cancelPrivateUpload,
  pausePrivateUpload,
  privateUploadStatus,
  resumePrivateUpload,
} from "@/private-content/uploads";

function failure(error: unknown) {
  const known = error instanceof PrivateContentError;
  return NextResponse.json(
    {
      code: known ? error.code : "PRIVATE_PACKAGE_INVALID",
      error: "Private upload is unavailable.",
      correlationId: known ? error.correlationId : crypto.randomUUID(),
    },
    {
      status: known && error.code === "PRIVATE_CONTENT_FORBIDDEN" ? 403 : 400,
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}
export async function GET(_request: Request, { params }: { params: Promise<{ uploadId: string }> }) {
  const session = await requireStudioWorkspace();
  if (!session) return NextResponse.json({ error: "Creator authorization is required." }, { status: 403 });
  try {
    return NextResponse.json(
      await privateUploadStatus({ actorId: session.accountId, uploadId: (await params).uploadId }),
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}
export async function DELETE(request: Request, { params }: { params: Promise<{ uploadId: string }> }) {
  const session = await requireStudioWorkspace(request);
  if (!session) return NextResponse.json({ error: "Creator authorization is required." }, { status: 403 });
  try {
    return NextResponse.json(
      await cancelPrivateUpload({ actorId: session.accountId, uploadId: (await params).uploadId }),
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}
export async function PATCH(request: Request, { params }: { params: Promise<{ uploadId: string }> }) {
  const session = await requireStudioWorkspace(request);
  if (!session) return NextResponse.json({ error: "Creator authorization is required." }, { status: 403 });
  try {
    const body = (await request.json()) as { action?: string };
    const input = { actorId: session.accountId, uploadId: (await params).uploadId };
    if (body.action === "pause")
      return NextResponse.json(await pausePrivateUpload(input), { headers: { "Cache-Control": "private, no-store" } });
    if (body.action === "resume")
      return NextResponse.json(await resumePrivateUpload(input), { headers: { "Cache-Control": "private, no-store" } });
    throw new Error("invalid");
  } catch (error) {
    return failure(error);
  }
}
