import { NextResponse } from "next/server";
import { apiError } from "@/chronicle/api";
import { requireOwnedStudioTale } from "@/chronicle/studio-authorization";
import { getStudioTale } from "@/chronicle/studio-service";
import { parseDrydockBlock } from "@/drydock/contracts/parser";
import { previewCanonicalTargetRepair } from "@/drydock/repairs";

const privateNoStore = { "Cache-Control": "private, no-store" };

/** Creator-only preview; application remains in Studio's ordinary undo/autosave path. */
export async function GET(request: Request, context: { params: Promise<{ taleId: string; blockId: string }> }) {
  const { taleId, blockId } = await context.params;
  const authorization = await requireOwnedStudioTale(taleId, request);
  if (!authorization)
    return NextResponse.json(
      { error: "This Chronicle is not available to this Creator account." },
      { status: 404, headers: privateNoStore },
    );
  try {
    const studio = await getStudioTale(taleId);
    const requestedRevision = Number(new URL(request.url).searchParams.get("autosaveVersion"));
    if (!Number.isSafeInteger(requestedRevision) || requestedRevision !== studio.draft.autosaveVersion)
      return NextResponse.json(
        { error: "The repair preview is stale. Reload the current Chronicle draft.", code: "DRAFT_CONFLICT" },
        { status: 409, headers: privateNoStore },
      );
    const source = studio.draft.chapters.flatMap((chapter) => chapter.blocks).find((block) => block.id === blockId);
    if (!source)
      return NextResponse.json(
        { error: "This Passage was not found in the current Chronicle draft." },
        { status: 404, headers: privateNoStore },
      );
    const parsed = parseDrydockBlock(source);
    if (parsed.success || !parsed.repairCandidate)
      return NextResponse.json(
        { error: "No safe automatic repair is available for this Passage." },
        { status: 422, headers: privateNoStore },
      );
    return NextResponse.json(
      { sourceRevision: studio.draft.autosaveVersion, preview: previewCanonicalTargetRepair(parsed.repairCandidate) },
      { headers: privateNoStore },
    );
  } catch (cause) {
    return apiError(cause);
  }
}
