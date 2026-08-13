import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCaptainWorkspace } from "@/chronicle/captain-authorization";
import { compareTideglassHelmPreflight, loadTideglassHelmPreflightContext } from "@/tideglass/helm-preflight";

const querySchema = z.object({ taleId: z.string().min(1).max(128), selectedEditionId: z.string().min(1).max(128) });

export async function GET(request: Request) {
  const session = await requireCaptainWorkspace();
  if (!session)
    return NextResponse.json({ error: "Sign in to Captain's Console to review edition readiness." }, { status: 401 });

  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success)
    return NextResponse.json({ error: "Choose a published Chronicle edition to review." }, { status: 400 });

  const context = await loadTideglassHelmPreflightContext({ captainAccountId: session.accountId, ...parsed.data });
  if (!context)
    return NextResponse.json({ error: "That Chronicle edition is unavailable in Captain's Console." }, { status: 404 });

  const preflight = await compareTideglassHelmPreflight(context, session.accountId);
  if (preflight.kind === "UNAVAILABLE")
    return NextResponse.json(
      {
        error: "Edition readiness is temporarily unavailable. No Voyage settings changed.",
        correlationId: preflight.correlationId,
      },
      { status: 503 },
    );

  const common = {
    selectedEdition: preflight.context.selectedEdition,
    recommendedEdition: preflight.context.recommendedEdition,
  };
  if (preflight.kind === "UP_TO_DATE") return NextResponse.json({ state: "UP_TO_DATE", ...common });

  return NextResponse.json({
    state: "COMPARISON",
    ...common,
    visibleChangeCount: preflight.projection.visibleChangeCount,
    summary: {
      partial: preflight.projection.summary.partial,
      categories: Object.entries(preflight.projection.visibleCategoryCounts)
        .filter(([, count]) => count > 0)
        .map(([category, count]) => ({ category, count })),
    },
  });
}
