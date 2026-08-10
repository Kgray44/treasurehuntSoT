import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  enforceTideglassRateLimit,
  requireTideglassCreatorChronicle,
  tideglassSafeError,
  tideglassUnavailable,
} from "@/tideglass/http";

export async function GET(_: Request, context: { params: Promise<{ chronicleId: string }> }) {
  try {
    const { chronicleId } = await context.params;
    const session = await requireTideglassCreatorChronicle(chronicleId);
    if (!session) return tideglassUnavailable();
    const rate = enforceTideglassRateLimit("comparison-read", session.accountId, chronicleId);
    if (!rate.ok) return rate.response;
    const editions = await db.publishedTaleVersion.findMany({
      where: { taleId: chronicleId },
      orderBy: { versionNumber: "asc" },
      select: {
        id: true,
        versionNumber: true,
        versionLabel: true,
        publishedAt: true,
        schemaVersion: true,
        isCurrent: true,
      },
    });
    return NextResponse.json(
      {
        editions: editions.map((edition) => ({
          id: edition.id,
          versionNumber: edition.versionNumber,
          versionLabel: edition.versionLabel,
          publishedAt: edition.publishedAt,
          schemaVersion: edition.schemaVersion,
          isCurrent: edition.isCurrent,
          retainedState: null,
          playable: null,
          recommended: null,
        })),
        availability: { available: false, reason: "Publishing does not expose retained/playable edition policy." },
        recommendation: { available: false, reason: "Publishing does not expose a recommendation policy." },
      },
      { headers: rate.headers },
    );
  } catch (cause) {
    return tideglassSafeError(cause);
  }
}
