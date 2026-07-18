import { NextResponse } from "next/server";
import { requireGmCapability } from "@/lib/security";
import { getVisionReleaseReadiness } from "@/vision/release-readiness";

export async function GET() {
  if (!(await requireGmCapability("CREATE_TALES")))
    return NextResponse.json(
      { error: { code: "RELEASE_READINESS_AUTH_REQUIRED", message: "Creator authentication is required." } },
      { status: 401 },
    );
  const readiness = await getVisionReleaseReadiness();
  if (!readiness)
    return NextResponse.json(
      { error: { code: "RELEASE_BASELINE_MISSING", message: "No persisted release baseline exists." } },
      { status: 503 },
    );
  return NextResponse.json(readiness, {
    headers: { "Cache-Control": "private, no-store", "X-Vision-Release-Schema": "1" },
  });
}
