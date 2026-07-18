import { NextResponse } from "next/server";
import { requireGmCapability, verifyCsrf } from "@/lib/security";
import { apiError } from "@/tall-tale/api";
import { archiveAsset, assetUsages, ingestAsset, updateAsset } from "@/tall-tale/assets";
import { db } from "@/lib/db";
import { consumeRateLimit, rateLimitHeaders } from "@/lib/rate-limit";

export async function GET(_: Request, context: { params: Promise<{ assetId: string }> }) {
  if (!(await requireGmCapability("MANAGE_ASSETS")))
    return NextResponse.json({ error: "Asset permission required." }, { status: 403 });
  try {
    const asset = await db.taleAsset.findUniqueOrThrow({ where: { id: (await context.params).assetId } });
    return NextResponse.json({ usages: await assetUsages(asset.taleId, asset.id) });
  } catch (cause) {
    return apiError(cause);
  }
}

async function authorized() {
  const session = await requireGmCapability("MANAGE_ASSETS");
  return session && (await verifyCsrf(session)) ? session : null;
}

export async function PATCH(request: Request, context: { params: Promise<{ assetId: string }> }) {
  const session = await authorized();
  if (!session)
    return NextResponse.json(
      { error: "Asset permission and a current creator session are required." },
      { status: 403 },
    );
  try {
    return NextResponse.json(await updateAsset((await context.params).assetId, await request.json()));
  } catch (cause) {
    return apiError(cause);
  }
}

export async function PUT(request: Request, context: { params: Promise<{ assetId: string }> }) {
  const session = await authorized();
  if (!session)
    return NextResponse.json(
      { error: "Asset permission and a current creator session are required." },
      { status: 403 },
    );
  try {
    const rate = consumeRateLimit(`tale-upload:${session.userId}`, { limit: 30, windowMs: 15 * 60_000 });
    if (!rate.allowed)
      return NextResponse.json(
        { error: "The upload limit was reached. Wait before replacing more media." },
        { status: 429, headers: rateLimitHeaders(rate) },
      );
    const { assetId } = await context.params;
    const asset = await db.taleAsset.findUniqueOrThrow({ where: { id: assetId } });
    const file = (await request.formData()).get("file");
    if (!(file instanceof File)) throw new Error("Choose a replacement file.");
    return NextResponse.json(await ingestAsset(asset.taleId, file, session.userId, assetId));
  } catch (cause) {
    return apiError(cause);
  }
}

export async function DELETE(_: Request, context: { params: Promise<{ assetId: string }> }) {
  const session = await authorized();
  if (!session)
    return NextResponse.json(
      { error: "Asset permission and a current creator session are required." },
      { status: 403 },
    );
  try {
    const result = await archiveAsset((await context.params).assetId);
    return NextResponse.json(result, { status: result.archived ? 200 : 409 });
  } catch (cause) {
    return apiError(cause);
  }
}
