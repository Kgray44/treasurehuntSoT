import { NextResponse } from "next/server";
import { requireGmCapability, verifyCsrf } from "@/lib/security";
import { inspectPrivatePackage } from "@/private-content/service";
import { PrivateContentError } from "@/private-content/core";

const MAX_UPLOAD_BASE64_CHARS = 48 * 1024 * 1024;

function failure(error: unknown) { const correlationId = error instanceof PrivateContentError ? error.correlationId : crypto.randomUUID(); return NextResponse.json({ code: "PRIVATE_PACKAGE_AUTHENTICATION_FAILED", error: "The private package could not be authenticated or opened.", correlationId }, { status: 400, headers: { "Cache-Control": "private, no-store" } }); }
export async function POST(request: Request) {
  const session = await requireGmCapability("CREATE_TALES"); if (!session || !(await verifyCsrf(session))) return NextResponse.json({ error: "Creator authorization is required." }, { status: 403 });
  try { const body = await request.json() as { packageBase64?: string; passphrase?: string }; if (!body.packageBase64 || body.packageBase64.length > MAX_UPLOAD_BASE64_CHARS || typeof body.passphrase !== "string") throw new Error("invalid"); return NextResponse.json(await inspectPrivatePackage(Buffer.from(body.packageBase64, "base64"), body.passphrase), { headers: { "Cache-Control": "private, no-store" } }); } catch (error) { return failure(error); }
}
