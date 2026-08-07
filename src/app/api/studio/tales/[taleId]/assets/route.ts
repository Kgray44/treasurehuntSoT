import { NextResponse } from "next/server";
import { apiError } from "@/chronicle/api";
import { ingestAsset } from "@/chronicle/assets";
import { requireOwnedStudioTale } from "@/chronicle/studio-authorization";
import { getStudioTale } from "@/chronicle/studio-service";
import { consumeRateLimit, rateLimitHeaders } from "@/lib/rate-limit";

export async function GET(_: Request, context: { params: Promise<{ taleId: string }> }) {
  const { taleId } = await context.params;
  if (!(await requireOwnedStudioTale(taleId)))
    return NextResponse.json({ error: "This Chronicle is not available to this Creator account." }, { status: 404 });
  try {
    const studio = await getStudioTale(taleId);
    return NextResponse.json({ assets: studio.assets, collections: studio.collections });
  } catch (cause) {
    return apiError(cause);
  }
}

export async function POST(request: Request, context: { params: Promise<{ taleId: string }> }) {
  const { taleId } = await context.params;
  const authorization = await requireOwnedStudioTale(taleId, request);
  if (!authorization)
    return NextResponse.json({ error: "This Chronicle is not available to this Creator account." }, { status: 404 });
  try {
    const rate = consumeRateLimit(`tale-upload:${authorization.session.accountId}`, {
      limit: 30,
      windowMs: 15 * 60_000,
    });
    if (!rate.allowed)
      return NextResponse.json(
        { error: "The upload limit was reached. Wait before adding more media." },
        { status: 429, headers: rateLimitHeaders(rate) },
      );
    const data = await request.formData();
    const files = data.getAll("files").filter((item): item is File => item instanceof File);
    if (!files.length) return NextResponse.json({ error: "Choose at least one file." }, { status: 400 });
    const assets = [];
    for (const file of files) assets.push(await ingestAsset(taleId, file, authorization.session.accountId));
    return NextResponse.json({ assets }, { status: 201 });
  } catch (cause) {
    return apiError(cause);
  }
}
