import { NextResponse } from "next/server";
import { requireGmCapability, verifyCsrf } from "@/lib/security";
import { apiError } from "@/tall-tale/api";
import { ingestAsset } from "@/tall-tale/assets";
import { getStudioTale } from "@/tall-tale/studio-service";
import { consumeRateLimit, rateLimitHeaders } from "@/lib/rate-limit";

export async function GET(_: Request, context: { params: Promise<{ taleId: string }> }) {
  if (!(await requireGmCapability("MANAGE_ASSETS")))
    return NextResponse.json(
      { error: "You do not have permission to manage assets in this Chronicle." },
      { status: 403 },
    );
  try {
    const studio = await getStudioTale((await context.params).taleId);
    return NextResponse.json({ assets: studio.assets, collections: studio.collections });
  } catch (cause) {
    return apiError(cause);
  }
}

export async function POST(request: Request, context: { params: Promise<{ taleId: string }> }) {
  const session = await requireGmCapability("MANAGE_ASSETS");
  if (!session)
    return NextResponse.json(
      { error: "You do not have permission to manage assets in this Chronicle." },
      { status: 403 },
    );
  if (!(await verifyCsrf(session)))
    return NextResponse.json(
      { error: "Your creator session has expired. Reload the page and try again." },
      { status: 403 },
    );
  try {
    const rate = consumeRateLimit(`tale-upload:${session.userId}`, { limit: 30, windowMs: 15 * 60_000 });
    if (!rate.allowed)
      return NextResponse.json(
        { error: "The upload limit was reached. Wait before adding more media." },
        { status: 429, headers: rateLimitHeaders(rate) },
      );
    const data = await request.formData();
    const files = data.getAll("files").filter((item): item is File => item instanceof File);
    if (!files.length) return NextResponse.json({ error: "Choose at least one file." }, { status: 400 });
    const assets = [];
    for (const file of files) assets.push(await ingestAsset((await context.params).taleId, file, session.userId));
    return NextResponse.json({ assets }, { status: 201 });
  } catch (cause) {
    return apiError(cause);
  }
}
