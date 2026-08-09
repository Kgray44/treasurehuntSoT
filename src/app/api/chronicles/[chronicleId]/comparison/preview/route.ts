import { NextResponse } from "next/server";
import { z } from "zod";
import {
  compareExactEditions,
  prismaTideglassAnnotationRepository,
  prismaTideglassEditionRepository,
  projectTideglassComparison,
  selectTideglassAudience,
  tideglassAudiences,
  tideglassSummaryModes,
} from "@/tideglass";
import { exactIdSchema } from "@/tideglass/core";
import {
  enforceTideglassRateLimit,
  parseBoundedTideglassJson,
  requireTideglassCreatorChronicle,
  tideglassSafeError,
  tideglassUnavailable,
} from "@/tideglass/http";

const previewSchema = z
  .object({
    sourceEditionId: exactIdSchema,
    targetEditionId: exactIdSchema,
    audience: z.enum(tideglassAudiences),
    mode: z.enum(tideglassSummaryModes).optional(),
  })
  .strict();

export async function POST(request: Request, context: { params: Promise<{ chronicleId: string }> }) {
  const { chronicleId } = await context.params;
  const session = await requireTideglassCreatorChronicle(chronicleId, request);
  if (!session) return tideglassUnavailable();
  const rate = enforceTideglassRateLimit("projection-preview", session.accountId, chronicleId);
  if (!rate.ok) return rate.response;
  try {
    const parsed = previewSchema.safeParse(await parseBoundedTideglassJson(request));
    if (!parsed.success) return tideglassSafeError(new Error("INVALID"));
    const result = await compareExactEditions(
      prismaTideglassEditionRepository,
      { kind: "ACCOUNT", accountId: session.accountId },
      {
        chronicleId,
        sourceEditionId: parsed.data.sourceEditionId,
        targetEditionId: parsed.data.targetEditionId,
      },
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
    const audience = selectTideglassAudience("CREATOR_FULL", parsed.data.audience);
    return NextResponse.json(
      { projection: projectTideglassComparison(result.value, audience, parsed.data.mode ?? "DETAILED", history) },
      { headers: rate.headers },
    );
  } catch (cause) {
    return tideglassSafeError(cause);
  }
}
