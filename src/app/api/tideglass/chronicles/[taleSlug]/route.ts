import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWayfarerAccount } from "@/wayfarer/http";
import { compareTideglassPassage, loadTideglassPassageContext } from "@/tideglass/passage-service";
import {
  enforceTideglassRateLimit,
  parseBoundedTideglassJson,
  tideglassSafeError,
  tideglassUnavailable,
} from "@/tideglass/http";

const requestSchema = z
  .object({
    from: z.string().min(1).max(191).optional(),
    to: z.string().min(1).max(191).optional(),
    historyRecord: z.string().min(1).max(191).optional(),
    mode: z.enum(["CONCISE", "DETAILED"]).optional(),
  })
  .strict();

async function viewer() {
  const session = await requireWayfarerAccount();
  return session
    ? { accountId: session.account.id, playerProfileId: session.account.profile?.id ?? null }
    : { accountId: null, playerProfileId: null };
}

function contextDto(context: NonNullable<Awaited<ReturnType<typeof loadTideglassPassageContext>>>) {
  return {
    chronicle: context.chronicle,
    editions: context.editions,
    recommendation: context.recommendedEditionId
      ? { available: true, editionId: context.recommendedEditionId }
      : { available: false, reason: "No current publishing selection is available for this Chronicle." },
    playedAnchors: context.playedAnchors.map(({ recordId, editionId, lifecycleStatus, outcome, completedAt }) => ({
      recordId,
      editionId,
      lifecycleStatus,
      outcome,
      completedAt,
    })),
  };
}

function unavailable(correlationId?: string) {
  return tideglassUnavailable(correlationId);
}

export async function GET(_: Request, context: { params: Promise<{ taleSlug: string }> }) {
  try {
    const { taleSlug } = await context.params;
    const activeViewer = await viewer();
    const passage = await loadTideglassPassageContext(taleSlug, activeViewer);
    if (!passage) return unavailable();
    const rate = enforceTideglassRateLimit(
      "comparison-read",
      activeViewer.accountId ?? "anonymous",
      passage.chronicle.id,
    );
    if (!rate.ok) return rate.response;
    return NextResponse.json(contextDto(passage), { headers: rate.headers });
  } catch (cause) {
    return tideglassSafeError(cause);
  }
}

export async function POST(request: Request, context: { params: Promise<{ taleSlug: string }> }) {
  try {
    const { taleSlug } = await context.params;
    const activeViewer = await viewer();
    const passage = await loadTideglassPassageContext(taleSlug, activeViewer);
    if (!passage) return unavailable();
    const rate = enforceTideglassRateLimit(
      "comparison-read",
      activeViewer.accountId ?? "anonymous",
      passage.chronicle.id,
    );
    if (!rate.ok) return rate.response;
    const parsed = requestSchema.safeParse(await parseBoundedTideglassJson(request));
    if (!parsed.success)
      return NextResponse.json(
        { code: "TIDEGLASS_REQUEST_INVALID", error: "The Tideglass request is invalid." },
        { status: 400 },
      );
    const result = await compareTideglassPassage(passage, {
      sourceEditionId: parsed.data.from,
      targetEditionId: parsed.data.to,
      historyRecordId: parsed.data.historyRecord,
      mode: parsed.data.mode,
    });
    if (result.kind === "UNAVAILABLE") return unavailable(result.correlationId);
    if (result.kind === "SELECTION")
      return NextResponse.json({ code: `TIDEGLASS_${result.selection.kind}` }, { status: 409, headers: rate.headers });
    return NextResponse.json(
      {
        selection: {
          kind: result.selection.kind,
          sourceEditionId: result.selection.sourceEditionId,
          targetEditionId: result.selection.targetEditionId,
          playedAnchor: result.selection.playedAnchor
            ? {
                recordId: result.selection.playedAnchor.recordId,
                editionId: result.selection.playedAnchor.editionId,
                completedAt: result.selection.playedAnchor.completedAt,
              }
            : null,
        },
        projection: result.projection,
      },
      { headers: rate.headers },
    );
  } catch (cause) {
    return tideglassSafeError(cause);
  }
}
