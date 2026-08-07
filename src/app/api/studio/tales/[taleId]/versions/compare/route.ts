import { NextResponse } from "next/server";
import { requireOwnedStudioTale } from "@/chronicle/studio-authorization";
import { comparePublishedVersions } from "@/chronicle/studio-service";
import { apiError } from "@/chronicle/api";

export async function GET(request: Request, context: { params: Promise<{ taleId: string }> }) {
  const { taleId } = await context.params;
  if (!(await requireOwnedStudioTale(taleId)))
    return NextResponse.json({ error: "This Chronicle is not available to this Creator account." }, { status: 404 });
  const url = new URL(request.url);
  const left = url.searchParams.get("left");
  const right = url.searchParams.get("right");
  if (!left || !right) return NextResponse.json({ error: "Choose two versions to compare." }, { status: 400 });
  try {
    return NextResponse.json(await comparePublishedVersions(taleId, left, right));
  } catch (cause) {
    return apiError(cause);
  }
}
