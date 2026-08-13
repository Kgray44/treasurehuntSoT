import { NextResponse } from "next/server";
import { apiError } from "@/chronicle/api";
import { requireOwnedStudioTale } from "@/chronicle/studio-authorization";
import { getDrydockPublishingEvidence } from "@/drydock/evidence-store";

const privateHeaders = { "Cache-Control": "private, no-store" };

/** Owner-safe historical publishing evidence; no Scenario inputs, authored prose, or provider raw evidence is returned. */
export async function GET(request: Request, context: { params: Promise<{ taleId: string; versionId: string }> }) {
  const { taleId, versionId } = await context.params;
  if (!(await requireOwnedStudioTale(taleId, request)))
    return NextResponse.json({ error: "This Chronicle is not available to this Creator account." }, { status: 404, headers: privateHeaders });
  try {
    const evidence = await getDrydockPublishingEvidence(taleId, versionId);
    if (!evidence)
      return NextResponse.json({ error: "Publishing evidence is not available for this Chronicle version." }, { status: 404, headers: privateHeaders });
    return NextResponse.json({ evidence }, { headers: privateHeaders });
  } catch (cause) {
    return apiError(cause);
  }
}
