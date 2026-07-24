import { NextResponse } from "next/server";
import { requireGmCapability, verifyCsrf } from "@/lib/security";
import { PrivateContentError } from "@/private-content/core";
import { initiatePrivateUpload } from "@/private-content/uploads";

function failure(error: unknown) {
  const known = error instanceof PrivateContentError;
  return NextResponse.json(
    {
      code: known ? error.code : "PRIVATE_PACKAGE_INVALID",
      error: "The private upload could not be accepted.",
      correlationId: known ? error.correlationId : crypto.randomUUID(),
    },
    {
      status: known && error.code === "PRIVATE_CONTENT_FORBIDDEN" ? 403 : 400,
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}

export async function POST(request: Request) {
  const session = await requireGmCapability("CREATE_TALES");
  if (!session || !(await verifyCsrf(session)))
    return NextResponse.json({ error: "Creator authorization is required." }, { status: 403 });
  try {
    const body = (await request.json()) as {
      idempotencyKey?: string;
      expectedBytes?: number;
      expectedSha256?: string;
      ttlMs?: number;
    };
    const idempotencyKey = body.idempotencyKey;
    if (typeof idempotencyKey !== "string") throw new Error("invalid");
    return NextResponse.json(
      await initiatePrivateUpload({
        actorId: session.userId,
        idempotencyKey,
        expectedBytes: body.expectedBytes,
        expectedSha256: body.expectedSha256,
        ttlMs: body.ttlMs,
      }),
      { status: 201, headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}
