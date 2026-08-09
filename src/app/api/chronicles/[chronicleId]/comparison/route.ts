import { NextResponse } from "next/server";
import { z } from "zod";
import {
  prismaTideglassAnnotationRepository,
  prismaTideglassEditionRepository,
  compareExactEditions,
  projectTideglassComparison,
  selectTideglassAudience,
  tideglassAudiences,
  tideglassSummaryModes,
} from "@/tideglass";
import { exactIdSchema } from "@/tideglass/core";
import { logger } from "@/lib/logger";
import {
  enforceTideglassRateLimit,
  parseBoundedTideglassJson,
  requireTideglassCreatorChronicle,
  tideglassSafeError,
  tideglassUnavailable,
} from "@/tideglass/http";

const requestSchema = z
  .object({
    sourceEditionId: exactIdSchema,
    targetEditionId: exactIdSchema,
    requestedAudience: z.enum(tideglassAudiences).optional(),
    mode: z.enum(tideglassSummaryModes).optional(),
  })
  .strict();

export async function POST(request: Request, context: { params: Promise<{ chronicleId: string }> }) {
  const { chronicleId } = await context.params;
  const session = await requireTideglassCreatorChronicle(chronicleId);
  if (!session) return tideglassUnavailable();
  const rate = enforceTideglassRateLimit("comparison-read", session.accountId, chronicleId);
  if (!rate.ok) return rate.response;
  try {
    const parsed = requestSchema.safeParse(await parseBoundedTideglassJson(request));
    if (!parsed.success) return tideglassSafeError(new Error("INVALID"));
    const result = await compareExactEditions(
      prismaTideglassEditionRepository,
      { kind: "ACCOUNT", accountId: session.accountId },
      { chronicleId, sourceEditionId: parsed.data.sourceEditionId, targetEditionId: parsed.data.targetEditionId },
    );
    if (!result.ok) return tideglassUnavailable(result.correlationId);
    const history = await prismaTideglassAnnotationRepository.listPair({
      chronicleId,
      sourceEditionId: result.value.changeSet.pair.source.editionId,
      sourceEditionChecksum: result.value.changeSet.pair.source.editionChecksum,
      targetEditionId: result.value.changeSet.pair.target.editionId,
      targetEditionChecksum: result.value.changeSet.pair.target.editionChecksum,
      comparisonPolicyVersion: result.value.changeSet.comparisonPolicyVersion,
    });
    const audience = selectTideglassAudience("CREATOR_FULL", parsed.data.requestedAudience);
    const projection = projectTideglassComparison(result.value, audience, parsed.data.mode ?? "CONCISE", history);
    logger.info(
      {
        area: "tideglass-comparison",
        comparisonId: result.value.changeSet.comparisonId,
        chronicleId,
        sourceEditionId: result.value.changeSet.pair.source.editionId,
        targetEditionId: result.value.changeSet.pair.target.editionId,
        sourceChecksum: result.value.changeSet.pair.source.editionChecksum,
        targetChecksum: result.value.changeSet.pair.target.editionChecksum,
        semanticSchemaVersion: result.value.changeSet.semanticSchemaVersion,
        comparisonPolicyVersion: result.value.changeSet.comparisonPolicyVersion,
        projectionPolicyVersion: projection.policy.projectionPolicyVersion,
        summaryPolicyVersion: projection.policy.summaryPolicyVersion,
        audience,
        resultStatus: projection.projectionStatus,
        overallSignificance: projection.summary.overallSignificance?.level ?? null,
        visibleCategoryCounts: projection.visibleCategoryCounts,
        compatibilityDeltaCount: projection.summary.compatibility.length,
        cacheStatus: result.value.operation.cacheStatus,
        durationMs: result.value.operation.totalDurationMs,
        correlationId: result.value.operation.correlationId,
      },
      "Tideglass comparison projection completed",
    );
    return NextResponse.json(
      {
        projection,
        operation: {
          correlationId: result.value.operation.correlationId,
          cacheStatus: result.value.operation.cacheStatus,
        },
      },
      { headers: rate.headers },
    );
  } catch (cause) {
    return tideglassSafeError(cause);
  }
}
