import { NextResponse } from "next/server";
import { requireGmCapability, verifyCsrf } from "@/lib/security";
import { PrivateContentError } from "@/private-content/core";
import { exportPrivateImport } from "@/private-content/service";

export async function POST(request: Request) {
  const session = await requireGmCapability("CREATE_TALES");
  if (!session || !(await verifyCsrf(session))) return NextResponse.json({ error: "Creator authorization is required." }, { status: 403 });
  try {
    const body = await request.json() as { importId?: string; passphrase?: string };
    if (!body.importId || typeof body.passphrase !== "string") throw new Error("invalid");
    const receipt = await exportPrivateImport(body.importId, body.passphrase);
    return NextResponse.json({ ...receipt, packageBytes: receipt.packageBytes.toString("base64") }, { headers: { "Cache-Control": "private, no-store", "Pragma": "no-cache" } });
  } catch (error) {
    const correlationId = error instanceof PrivateContentError ? error.correlationId : crypto.randomUUID();
    return NextResponse.json({ code: error instanceof PrivateContentError ? error.code : "PRIVATE_PACKAGE_AUTHENTICATION_FAILED", error: "The private export could not be created.", correlationId }, { status: 400, headers: { "Cache-Control": "private, no-store" } });
  }
}
