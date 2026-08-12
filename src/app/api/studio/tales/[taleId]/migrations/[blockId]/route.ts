import { NextResponse } from "next/server";
import { apiError } from "@/chronicle/api";
import { requireOwnedStudioTale } from "@/chronicle/studio-authorization";
import { getStudioTale } from "@/chronicle/studio-service";
import { previewDrydockMigration } from "@/drydock/migration-preview";

const privateNoStore = { "Cache-Control": "private, no-store" };

/** Creator-scoped, stale-guarded Drydock migration preview. Applying stays in Studio history/autosave. */
export async function GET(request: Request, context: { params: Promise<{ taleId: string; blockId: string }> }) {
  const { taleId, blockId } = await context.params;
  const authorization = await requireOwnedStudioTale(taleId);
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
        { error: "The migration preview is stale. Reload the current Chronicle draft.", code: "DRAFT_CONFLICT" },
        { status: 409, headers: privateNoStore },
      );
    const source = studio.draft.chapters.flatMap((chapter) => chapter.blocks).find((block) => block.id === blockId);
    if (!source)
      return NextResponse.json(
        { error: "This Passage was not found in the current Chronicle draft." },
        { status: 404, headers: privateNoStore },
      );
    const preview = previewDrydockMigration(source);
    if (!preview)
      return NextResponse.json(
        { error: "No safe deterministic Drydock migration is available for this Passage." },
        { status: 422, headers: privateNoStore },
      );
    return NextResponse.json({ sourceRevision: studio.draft.autosaveVersion, preview }, { headers: privateNoStore });
  } catch (cause) {
    return apiError(cause);
  }
}
