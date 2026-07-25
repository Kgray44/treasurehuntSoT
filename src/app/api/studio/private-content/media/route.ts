import { NextResponse } from "next/server";
import { requireGmCapability, verifyCsrf } from "@/lib/security";
import {
  ProtectedMediaError,
  protectedMediaAudiences,
  protectedMediaKinds,
  protectedMediaPurposes,
  protectedMediaWithdrawalReasons,
  type ProtectedMediaAudience,
  type ProtectedMediaPurpose,
  type ProtectedMediaWithdrawalReason,
} from "@/private-content/media/contracts";
import {
  listOwnerProtectedMedia,
  registerProtectedMedia,
  requestProtectedMediaDerivative,
  updateProtectedMediaAccessibilityDescription,
  withdrawProtectedMediaDerivative,
} from "@/private-content/media/service";

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
      action?: string;
      sourcePrivateAssetObjectId?: string;
      mediaKind?: string;
      declaredMediaType?: string;
      accessibilityDescription?: string;
      mediaId?: string;
      associationId?: string;
      purpose?: string;
      audience?: string;
      idempotencyKey?: string;
      derivativeId?: string;
      reason?: string;
    };
    const ownerAccountId = "accountId" in session ? session.accountId : session.userId;
    if (body.action === "request-derivative") {
      if (
        !body.mediaId ||
        !body.associationId ||
        !body.purpose ||
        !body.audience ||
        !body.idempotencyKey ||
        !(protectedMediaPurposes as readonly string[]).includes(body.purpose) ||
        !(protectedMediaAudiences as readonly string[]).includes(body.audience)
      )
        throw new ProtectedMediaError("PROTECTED_MEDIA_INVALID");
      return NextResponse.json(
        await requestProtectedMediaDerivative({
          ownerAccountId,
          mediaId: body.mediaId,
          associationId: body.associationId,
          purpose: body.purpose as ProtectedMediaPurpose,
          audience: body.audience as ProtectedMediaAudience,
          idempotencyKey: body.idempotencyKey,
        }),
        { status: 202, headers: { "Cache-Control": "private, no-store" } },
      );
    }
    if (body.action === "update-description") {
      if (!body.mediaId || !body.accessibilityDescription) throw new ProtectedMediaError("PROTECTED_MEDIA_INVALID");
      await updateProtectedMediaAccessibilityDescription({
        ownerAccountId,
        mediaId: body.mediaId,
        description: body.accessibilityDescription,
      });
      return new NextResponse(null, { status: 204, headers: { "Cache-Control": "private, no-store" } });
    }
    if (body.action === "withdraw-derivative") {
      if (
        !body.derivativeId ||
        !body.reason ||
        !(protectedMediaWithdrawalReasons as readonly string[]).includes(body.reason)
      )
        throw new ProtectedMediaError("PROTECTED_MEDIA_INVALID");
      return NextResponse.json(
        await withdrawProtectedMediaDerivative({
          ownerAccountId,
          derivativeId: body.derivativeId,
          reason: body.reason as ProtectedMediaWithdrawalReason,
        }),
        { headers: { "Cache-Control": "private, no-store" } },
      );
    }
    if (
      !body.sourcePrivateAssetObjectId ||
      !body.declaredMediaType ||
      !body.mediaKind ||
      !(protectedMediaKinds as readonly string[]).includes(body.mediaKind)
    )
      throw new ProtectedMediaError("PROTECTED_MEDIA_INVALID");
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
