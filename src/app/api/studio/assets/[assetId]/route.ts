import { NextResponse } from "next/server";
import { apiError } from "@/chronicle/api";
import { archiveAsset, assetUsages, ingestAsset, updateAsset } from "@/chronicle/assets";
import { consumeRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { requireOwnedStudioAsset } from "@/chronicle/studio-authorization";

export async function GET(_: Request, context: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await context.params;
  const authorization = await requireOwnedStudioAsset(assetId);
  if (!authorization)
    return NextResponse.json({ error: "This asset is not available to this Creator account." }, { status: 404 });
  try {
    return NextResponse.json({ usages: await assetUsages(authorization.asset.taleId, authorization.asset.id) });
  } catch (cause) {
    return apiError(cause);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await context.params;
  if (!(await requireOwnedStudioAsset(assetId, request)))
    return NextResponse.json({ error: "This asset is not available to this Creator account." }, { status: 404 });
  try {
    return NextResponse.json(await updateAsset(assetId, await request.json()));
  } catch (cause) {
    return apiError(cause);
  }
}

export async function PUT(request: Request, context: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await context.params;
  const authorization = await requireOwnedStudioAsset(assetId, request);
  if (!authorization)
    return NextResponse.json({ error: "This asset is not available to this Creator account." }, { status: 404 });
  try {
    const rate = consumeRateLimit(`tale-upload:${authorization.session.accountId}`, {
      limit: 30,
      windowMs: 15 * 60_000,
    });
    if (!rate.allowed)
      return NextResponse.json(
        { error: "The upload limit was reached. Wait before replacing more media." },
        { status: 429, headers: rateLimitHeaders(rate) },
      );
    const file = (await request.formData()).get("file");
    if (!(file instanceof File)) throw new Error("Choose a replacement file.");
    return NextResponse.json(
      await ingestAsset(authorization.asset.taleId, file, authorization.session.accountId, assetId),
    );
  } catch (cause) {
    return apiError(cause);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await context.params;
  if (!(await requireOwnedStudioAsset(assetId, request)))
    return NextResponse.json({ error: "This asset is not available to this Creator account." }, { status: 404 });
  try {
    const result = await archiveAsset(assetId);
    return NextResponse.json(result, { status: result.archived ? 200 : 409 });
  } catch (cause) {
    return apiError(cause);
  }
}
