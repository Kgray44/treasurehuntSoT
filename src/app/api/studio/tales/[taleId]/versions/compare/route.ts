import { NextResponse } from "next/server";
import { requireGmCapability } from "@/lib/security";
import { comparePublishedVersions } from "@/tall-tale/studio-service";
import { apiError } from "@/tall-tale/api";

export async function GET(request: Request, context: { params: Promise<{ taleId: string }> }) {
  if (!(await requireGmCapability("CREATE_TALES")))
    return NextResponse.json({ error: "Sign in with a creator account to continue." }, { status: 401 });
  const url = new URL(request.url);
  const left = url.searchParams.get("left");
  const right = url.searchParams.get("right");
  if (!left || !right) return NextResponse.json({ error: "Choose two versions to compare." }, { status: 400 });
  try {
    return NextResponse.json(await comparePublishedVersions((await context.params).taleId, left, right));
  } catch (cause) {
    return apiError(cause);
  }
}
