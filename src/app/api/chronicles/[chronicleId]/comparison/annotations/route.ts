import { NextResponse } from "next/server";
import { z } from "zod";
import {
  appendTideglassAnnotation,
  annotationMutationSchema,
  compareExactEditions,
  prismaTideglassAnnotationRepository,
  prismaTideglassEditionRepository,
  tideglassCreatorAnnotationDto,
} from "@/tideglass";
import { exactIdSchema } from "@/tideglass/core";
import {
  enforceTideglassRateLimit,
  parseBoundedTideglassJson,
  requireTideglassCreatorChronicle,
  tideglassSafeError,
  tideglassUnavailable,
} from "@/tideglass/http";

const pairQuerySchema = z.object({ sourceEditionId: exactIdSchema, targetEditionId: exactIdSchema }).strict();

async function comparison(accountId: string, chronicleId: string, sourceEditionId: string, targetEditionId: string) {
  return compareExactEditions(
    prismaTideglassEditionRepository,
    { kind: "ACCOUNT", accountId },
    { chronicleId, sourceEditionId, targetEditionId },
  );
}

export async function GET(request: Request, context: { params: Promise<{ chronicleId: string }> }) {
  try {
    const { chronicleId } = await context.params;
    const session = await requireTideglassCreatorChronicle(chronicleId);
    if (!session) return tideglassUnavailable();
    const rate = enforceTideglassRateLimit("comparison-read", session.accountId, chronicleId);
    if (!rate.ok) return rate.response;
    const url = new URL(request.url);
    const pair = pairQuerySchema.safeParse({
      sourceEditionId: url.searchParams.get("sourceEditionId"),
      targetEditionId: url.searchParams.get("targetEditionId"),
    });
    if (!pair.success) return tideglassSafeError(new Error("INVALID"));
    const result = await comparison(
      session.accountId,
      chronicleId,
      pair.data.sourceEditionId,
      pair.data.targetEditionId,
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
    return NextResponse.json(
      { annotations: history.map((annotation) => tideglassCreatorAnnotationDto(annotation)) },
      { headers: rate.headers },
    );
  } catch (cause) {
    return tideglassSafeError(cause);
  }
}

export async function POST(request: Request, context: { params: Promise<{ chronicleId: string }> }) {
  try {
    const { chronicleId } = await context.params;
    const session = await requireTideglassCreatorChronicle(chronicleId, request);
    if (!session) return tideglassUnavailable();
    const rate = enforceTideglassRateLimit("annotation-mutation", session.accountId, chronicleId);
    if (!rate.ok) return rate.response;
    const body = await parseBoundedTideglassJson(request);
    const parsed = annotationMutationSchema.safeParse(body);
    if (!parsed.success) return tideglassSafeError(new Error("INVALID"));
    const compared = await comparison(
      session.accountId,
      chronicleId,
      parsed.data.sourceEditionId,
      parsed.data.targetEditionId,
    );
    if (!compared.ok) return tideglassUnavailable(compared.correlationId);
    const result = await appendTideglassAnnotation(
      prismaTideglassAnnotationRepository,
      session.accountId,
      chronicleId,
      compared.value.changeSet,
      parsed.data,
    );
    return NextResponse.json(result.ok ? { ...result, value: tideglassCreatorAnnotationDto(result.value) } : result, {
      status: result.ok ? (result.idempotent ? 200 : 201) : 409,
      headers: rate.headers,
    });
  } catch (cause) {
    return tideglassSafeError(cause);
  }
}
