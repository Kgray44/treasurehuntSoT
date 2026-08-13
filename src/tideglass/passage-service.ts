import { db } from "@/lib/db";
import { compareExactEditions, prismaTideglassEditionRepository, type TideglassEditionRepository } from "./service";
import { prismaTideglassAnnotationRepository } from "./annotations";
import { projectTideglassComparison } from "./projection";
import {
  buildTideglassCompareHref,
  resolveTideglassPassageSelection,
  type TideglassEditionOption,
  type TideglassPlayedAnchor,
  type TideglassPassageSelection,
} from "./passage";

export type TideglassPassageViewer = {
  accountId?: string | null;
  playerProfileId?: string | null;
};

export type TideglassPassageContext = {
  chronicle: { id: string; slug: string; title: string };
  editions: TideglassEditionOption[];
  recommendedEditionId: string | null;
  playedAnchors: TideglassPlayedAnchor[];
  allowedEditionIds: string[];
  audience: "PUBLIC_PREVIEW" | "PLAYER_SAFE";
};

export type TideglassHistoryComparisonEntry = {
  href: string;
  state: "COMPARE" | "UP_TO_DATE";
};

export function constrainTideglassPassageRepository(
  repository: TideglassEditionRepository,
  allowedEditionIds: Iterable<string>,
): TideglassEditionRepository {
  const allowed = new Set(allowedEditionIds);
  return {
    findExactEdition(editionId) {
      return repository.findExactEdition(editionId);
    },
    authorizeEdition(_principal, edition) {
      return Promise.resolve(allowed.has(edition.id));
    },
  };
}

export async function loadTideglassPassageContext(
  taleSlug: string,
  viewer: TideglassPassageViewer = {},
): Promise<TideglassPassageContext | null> {
  const chronicle = await db.chronicle.findUnique({
    where: { slug: taleSlug },
    select: {
      id: true,
      slug: true,
      title: true,
      status: true,
      visibility: true,
      archivedAt: true,
      creatorAccount: { select: { profile: { select: { displayName: true } } } },
      versions: {
        orderBy: { versionNumber: "asc" },
        select: {
          id: true,
          versionLabel: true,
          publishedAt: true,
          publishedBy: true,
          releaseNotes: true,
          isCurrent: true,
        },
      },
    },
  });
  if (!chronicle || chronicle.archivedAt || chronicle.status !== "PUBLISHED") return null;

  const playedAnchors = viewer.playerProfileId
    ? await db.playerChronicleRecord.findMany({
        where: { playerProfileId: viewer.playerProfileId, publishedVersion: { taleId: chronicle.id } },
        orderBy: [{ completedAt: "desc" }, { id: "desc" }],
        select: {
          id: true,
          publishedVersionId: true,
          publishedVersionChecksum: true,
          lifecycleStatus: true,
          outcome: true,
          completedAt: true,
        },
      })
    : [];
  const publiclyComparable = ["PUBLIC", "UNLISTED"].includes(chronicle.visibility);
  if (!publiclyComparable && !playedAnchors.length) return null;

  const currentEditionId = chronicle.versions.find((edition) => edition.isCurrent)?.id ?? null;
  const allowedEditionIds = new Set<string>(publiclyComparable ? chronicle.versions.map((edition) => edition.id) : []);
  for (const anchor of playedAnchors) allowedEditionIds.add(anchor.publishedVersionId);
  if (currentEditionId) allowedEditionIds.add(currentEditionId);

  const visibleEditions = chronicle.versions.filter((edition) => allowedEditionIds.has(edition.id));
  return {
    chronicle: { id: chronicle.id, slug: chronicle.slug, title: chronicle.title },
    editions: visibleEditions.map((edition) => ({
      id: edition.id,
      label: `Edition ${edition.versionLabel}`,
      publishedAt: edition.publishedAt.toISOString(),
      creatorName: chronicle.creatorAccount?.profile?.displayName ?? "Voyagewright Creator",
      releaseNotes: edition.releaseNotes,
      compatibilitySummary: "Compatibility is assessed for the exact pair you choose.",
      availability: edition.isCurrent ? "PLAYABLE" : "HISTORICAL_ONLY",
    })),
    // Publishing sets this pointer atomically with the version used by new Voyage creation.
    // Tideglass consumes that owner-controlled selection and never derives it from dates.
    recommendedEditionId: currentEditionId,
    playedAnchors: playedAnchors.map((anchor) => ({
      recordId: anchor.id,
      editionId: anchor.publishedVersionId,
      editionChecksum: anchor.publishedVersionChecksum,
      lifecycleStatus: anchor.lifecycleStatus,
      outcome: anchor.outcome,
      completedAt: anchor.completedAt?.toISOString() ?? null,
    })),
    allowedEditionIds: [...allowedEditionIds],
    audience: viewer.playerProfileId ? "PLAYER_SAFE" : "PUBLIC_PREVIEW",
  };
}

export function resolveTideglassHistoryComparisonEntry(
  context: TideglassPassageContext,
  input: { historyRecordId: string; returnTo: string },
): TideglassHistoryComparisonEntry | null {
  const selection = resolveTideglassPassageSelection({
    editions: context.editions,
    recommendedEditionId: context.recommendedEditionId,
    playedAnchors: context.playedAnchors,
    requestedHistoryRecordId: input.historyRecordId,
  });
  if ((selection.kind !== "PAIR" && selection.kind !== "UP_TO_DATE") || !selection.playedAnchor) return null;
  return {
    href: buildTideglassCompareHref({
      taleSlug: context.chronicle.slug,
      sourceEditionId: selection.sourceEditionId,
      targetEditionId: selection.targetEditionId,
      historyRecordId: selection.playedAnchor.recordId,
      returnTo: input.returnTo,
    }),
    state: selection.kind === "UP_TO_DATE" ? "UP_TO_DATE" : "COMPARE",
  };
}

export async function loadTideglassHistoryComparisonEntry(input: {
  taleSlug: string;
  playerProfileId: string;
  historyRecordId: string;
  returnTo: string;
}): Promise<TideglassHistoryComparisonEntry | null> {
  const context = await loadTideglassPassageContext(input.taleSlug, { playerProfileId: input.playerProfileId });
  return context ? resolveTideglassHistoryComparisonEntry(context, input) : null;
}

export type TideglassPassageComparison =
  | { kind: "SELECTION"; selection: Exclude<TideglassPassageSelection, { kind: "PAIR" | "UP_TO_DATE" }> }
  | {
      kind: "COMPARISON";
      selection: Extract<TideglassPassageSelection, { kind: "PAIR" | "UP_TO_DATE" }>;
      projection: ReturnType<typeof projectTideglassComparison>;
    }
  | { kind: "UNAVAILABLE"; correlationId: string };

export async function compareTideglassPassage(
  context: TideglassPassageContext,
  input: {
    sourceEditionId?: string | null;
    targetEditionId?: string | null;
    historyRecordId?: string | null;
    mode?: "CONCISE" | "DETAILED";
  },
): Promise<TideglassPassageComparison> {
  const selection = resolveTideglassPassageSelection({
    editions: context.editions,
    recommendedEditionId: context.recommendedEditionId,
    playedAnchors: context.playedAnchors,
    requestedSourceEditionId: input.sourceEditionId,
    requestedTargetEditionId: input.targetEditionId,
    requestedHistoryRecordId: input.historyRecordId,
  });
  if (selection.kind !== "PAIR" && selection.kind !== "UP_TO_DATE") return { kind: "SELECTION", selection };

  const result = await compareExactEditions(
    constrainTideglassPassageRepository(prismaTideglassEditionRepository, context.allowedEditionIds),
    { kind: "PASSAGE", subjectId: `${context.audience}:${context.chronicle.id}` },
    {
      chronicleId: context.chronicle.id,
      sourceEditionId: selection.sourceEditionId,
      targetEditionId: selection.targetEditionId,
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
    selection,
    projection: projectTideglassComparison(result.value, context.audience, input.mode ?? "CONCISE", annotations),
  };
}
