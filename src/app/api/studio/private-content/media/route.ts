import { NextResponse } from "next/server";
import { requireGmCapability, verifyCsrf } from "@/lib/security";
import { ProtectedMediaError, protectedMediaKinds } from "@/private-content/media/contracts";
import { listOwnerProtectedMedia, registerProtectedMedia } from "@/private-content/media/service";

function responseError(error: unknown) {
  const known = error instanceof ProtectedMediaError;
  return NextResponse.json(
    {
      code: known ? error.code : "PROTECTED_MEDIA_INVALID",
      error: "The protected-media request could not be completed.",
    },
    {
      status:
        known && ["PROTECTED_MEDIA_NOT_FOUND", "PROTECTED_MEDIA_SOURCE_NOT_CLEAN"].includes(error.code) ? 404 : 400,
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}

export async function GET() {
  const session = await requireGmCapability("CREATE_TALES");
  if (!session) return NextResponse.json({ error: "Creator authorization is required." }, { status: 403 });
  try {
    const ownerAccountId = "accountId" in session ? session.accountId : session.userId;
    return NextResponse.json(
      { media: await listOwnerProtectedMedia(ownerAccountId) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return responseError(error);
  }
}

export async function POST(request: Request) {
  const session = await requireGmCapability("CREATE_TALES");
  if (!session || !(await verifyCsrf(session)))
    return NextResponse.json({ error: "Creator authorization is required." }, { status: 403 });
  try {
    const body = (await request.json()) as {
      sourcePrivateAssetObjectId?: string;
      mediaKind?: string;
      declaredMediaType?: string;
      accessibilityDescription?: string;
    };
    if (
      !body.sourcePrivateAssetObjectId ||
      !body.declaredMediaType ||
      !body.mediaKind ||
      !(protectedMediaKinds as readonly string[]).includes(body.mediaKind)
    )
      throw new ProtectedMediaError("PROTECTED_MEDIA_INVALID");
    const ownerAccountId = "accountId" in session ? session.accountId : session.userId;
    const result = await registerProtectedMedia({
      ownerAccountId,
      sourcePrivateAssetObjectId: body.sourcePrivateAssetObjectId,
      mediaKind: body.mediaKind as (typeof protectedMediaKinds)[number],
      declaredMediaType: body.declaredMediaType,
      accessibilityDescription: body.accessibilityDescription,
    });
    return NextResponse.json(result, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return responseError(error);
  }
}
