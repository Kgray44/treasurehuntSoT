import { NextResponse } from "next/server";
import { requireOwnedStudioTale } from "@/chronicle/studio-authorization";
import { prismaTideglassAnnotationRepository } from "@/tideglass/annotations";
import { enforceTideglassRateLimit, tideglassSafeError } from "@/tideglass/http";
import { projectTideglassComparison } from "@/tideglass/projection";
import { compareExactEditions, prismaTideglassEditionRepository } from "@/tideglass/service";

export async function GET(request: Request, context: { params: Promise<{ taleId: string }> }) {
  const { taleId } = await context.params;
  const authorization = await requireOwnedStudioTale(taleId);
  if (!authorization)
    return NextResponse.json({ error: "This Chronicle is not available to this Creator account." }, { status: 404 });
  const url = new URL(request.url);
  const left = url.searchParams.get("left");
  const right = url.searchParams.get("right");
  if (!left || !right) return NextResponse.json({ error: "Choose two versions to compare." }, { status: 400 });
  try {
    const rate = enforceTideglassRateLimit("comparison-read", authorization.session.accountId, taleId);
    if (!rate.ok) return rate.response;
    const compared = await compareExactEditions(
      prismaTideglassEditionRepository,
      { kind: "ACCOUNT", accountId: authorization.session.accountId },
      { chronicleId: taleId, sourceEditionId: left, targetEditionId: right },
    );
    if (!compared.ok)
      return NextResponse.json(
        { code: "TIDEGLASS_COMPARISON_UNAVAILABLE", error: "This edition pair cannot be compared." },
        { status: 409, headers: rate.headers },
      );
    const annotations = await prismaTideglassAnnotationRepository.listPair({
      chronicleId: taleId,
      sourceEditionId: compared.value.changeSet.pair.source.editionId,
      sourceEditionChecksum: compared.value.changeSet.pair.source.editionChecksum,
      targetEditionId: compared.value.changeSet.pair.target.editionId,
      targetEditionChecksum: compared.value.changeSet.pair.target.editionChecksum,
      comparisonPolicyVersion: compared.value.changeSet.comparisonPolicyVersion,
    });
    return NextResponse.json(
      {
        selection: { kind: "PAIR", sourceEditionId: left, targetEditionId: right },
        projection: projectTideglassComparison(compared.value, "CREATOR_FULL", "DETAILED", annotations),
      },
      { headers: rate.headers },
    );
  } catch (cause) {
    return tideglassSafeError(cause);
  }
}
