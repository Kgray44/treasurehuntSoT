import { db } from "@/lib/db";
import { prismaTideglassAnnotationRepository } from "./annotations";
import { projectTideglassComparison } from "./projection";
import { compareExactEditions, prismaTideglassEditionRepository } from "./service";

export type TideglassHelmPreflightContext = {
  chronicle: { id: string; slug: string; title: string };
  selectedEdition: { id: string; label: string; publishedAt: string };
  recommendedEdition: { id: string; label: string; publishedAt: string };
};

export type TideglassHelmPreflight =
  | { kind: "UP_TO_DATE"; context: TideglassHelmPreflightContext }
  | {
      kind: "COMPARISON";
      context: TideglassHelmPreflightContext;
      projection: ReturnType<typeof projectTideglassComparison>;
    }
  | { kind: "UNAVAILABLE"; correlationId: string };

/**
 * The Captain Library is the authority for which published editions a Captain
 * may choose.  Tideglass repeats that narrow public-or-own-Chronicle scope at
 * its boundary so a caller cannot use the preflight endpoint as an edition
 * oracle.  It never changes the selected edition or creates a Voyage.
 */
export async function loadTideglassHelmPreflightContext(input: {
  captainAccountId: string;
  taleId: string;
  selectedEditionId: string;
}): Promise<TideglassHelmPreflightContext | null> {
  const chronicle = await db.chronicle.findFirst({
    where: {
      id: input.taleId,
      archivedAt: null,
      latestPublishedVersionId: { not: null },
      OR: [{ creatorAccountId: input.captainAccountId }, { visibility: "PUBLIC" }],
    },
    select: { id: true, slug: true, title: true, latestPublishedVersionId: true },
  });
  if (!chronicle?.latestPublishedVersionId) return null;

  const editions = await db.publishedTaleVersion.findMany({
    where: { taleId: chronicle.id, id: { in: [input.selectedEditionId, chronicle.latestPublishedVersionId] } },
    select: { id: true, versionLabel: true, publishedAt: true },
  });
  const selected = editions.find((edition) => edition.id === input.selectedEditionId);
  const recommended = editions.find((edition) => edition.id === chronicle.latestPublishedVersionId);
  if (!selected || !recommended) return null;

  const edition = (value: typeof selected) => ({
    id: value.id,
    label: value.versionLabel,
    publishedAt: value.publishedAt.toISOString(),
  });
  return {
    chronicle: { id: chronicle.id, slug: chronicle.slug, title: chronicle.title },
    selectedEdition: edition(selected),
    recommendedEdition: edition(recommended),
  };
}

export async function compareTideglassHelmPreflight(
  context: TideglassHelmPreflightContext,
  captainAccountId: string,
): Promise<TideglassHelmPreflight> {
  if (context.selectedEdition.id === context.recommendedEdition.id) return { kind: "UP_TO_DATE", context };

  const result = await compareExactEditions(
    prismaTideglassEditionRepository,
    { kind: "CAPTAIN", accountId: captainAccountId },
    {
      chronicleId: context.chronicle.id,
      sourceEditionId: context.selectedEdition.id,
      targetEditionId: context.recommendedEdition.id,
    },
  );
  if (!result.ok) return { kind: "UNAVAILABLE", correlationId: result.correlationId ?? "tideglass-unavailable" };

  const annotations = await prismaTideglassAnnotationRepository.listPair({
    chronicleId: context.chronicle.id,
    sourceEditionId: result.value.changeSet.pair.source.editionId,
    sourceEditionChecksum: result.value.changeSet.pair.source.editionChecksum,
    targetEditionId: result.value.changeSet.pair.target.editionId,
    targetEditionChecksum: result.value.changeSet.pair.target.editionChecksum,
    comparisonPolicyVersion: result.value.changeSet.comparisonPolicyVersion,
  });
  return {
    kind: "COMPARISON",
    context,
    projection: projectTideglassComparison(result.value, "CAPTAIN_SAFE", "CONCISE", annotations),
  };
}
