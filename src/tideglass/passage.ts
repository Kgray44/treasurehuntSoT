export const tideglassEditionStatuses = [
  "CURRENT_RECOMMENDED",
  "PLAYED_BY_YOU",
  "ORIGINAL",
  "PLAYABLE",
  "HISTORICAL_ONLY",
  "DEPRECATED",
  "INCOMPATIBLE",
  "REDACTED",
] as const;

export type TideglassEditionStatus = (typeof tideglassEditionStatuses)[number];
export type TideglassEditionAvailability = Exclude<
  TideglassEditionStatus,
  "CURRENT_RECOMMENDED" | "PLAYED_BY_YOU" | "ORIGINAL"
>;

export type TideglassEditionOption = {
  id: string;
  label: string;
  publishedAt: string;
  availability?: TideglassEditionAvailability | null;
};

export type TideglassPlayedAnchor = {
  recordId: string;
  editionId: string;
  editionChecksum: string;
  completedAt: string | null;
};

export function editionStatusBadges(
  edition: TideglassEditionOption,
  context: {
    recommendedEditionId?: string | null;
    earliestEditionId?: string | null;
    playedEditionIds?: ReadonlySet<string>;
  } = {},
): TideglassEditionStatus[] {
  const badges: TideglassEditionStatus[] = [];
  if (context.recommendedEditionId === edition.id) badges.push("CURRENT_RECOMMENDED");
  if (context.playedEditionIds?.has(edition.id)) badges.push("PLAYED_BY_YOU");
  if (context.earliestEditionId === edition.id) badges.push("ORIGINAL");
  if (edition.availability) badges.push(edition.availability);
  return badges;
}

export function selectPlayedAnchor(
  anchors: readonly TideglassPlayedAnchor[],
  requestedRecordId?: string | null,
): TideglassPlayedAnchor | null {
  if (requestedRecordId) return anchors.find((anchor) => anchor.recordId === requestedRecordId) ?? null;
  return anchors.length === 1 ? anchors[0] : null;
}

export type TideglassPassageSelection =
  | {
      kind: "PAIR";
      sourceEditionId: string;
      targetEditionId: string;
      playedAnchor: TideglassPlayedAnchor | null;
    }
  | {
      kind: "UP_TO_DATE";
      sourceEditionId: string;
      targetEditionId: string;
      playedAnchor: TideglassPlayedAnchor | null;
    }
  | { kind: "INVALID_HISTORY_RECORD" }
  | { kind: "SELECTION_REQUIRED" };

export function resolveTideglassPassageSelection(input: {
  editions: readonly TideglassEditionOption[];
  recommendedEditionId?: string | null;
  playedAnchors?: readonly TideglassPlayedAnchor[];
  requestedSourceEditionId?: string | null;
  requestedTargetEditionId?: string | null;
  requestedHistoryRecordId?: string | null;
}): TideglassPassageSelection {
  const editionsById = new Map(input.editions.map((edition) => [edition.id, edition]));
  const anchors = input.playedAnchors ?? [];
  const playedAnchor = selectPlayedAnchor(anchors, input.requestedHistoryRecordId);
  if (input.requestedHistoryRecordId && !playedAnchor) return { kind: "INVALID_HISTORY_RECORD" };

  const targetEditionId = input.requestedTargetEditionId ?? input.recommendedEditionId ?? null;
  const sourceEditionId = input.requestedSourceEditionId ?? playedAnchor?.editionId ?? null;
  if (!sourceEditionId || !targetEditionId || !editionsById.has(sourceEditionId) || !editionsById.has(targetEditionId))
    return { kind: "SELECTION_REQUIRED" };

  if (sourceEditionId === targetEditionId && playedAnchor)
    return { kind: "UP_TO_DATE", sourceEditionId, targetEditionId, playedAnchor };
  return { kind: "PAIR", sourceEditionId, targetEditionId, playedAnchor };
}

const tideglassReturnPrefixes = ["/tales", "/chronicles/", "/passport/history", "/studio/tales/"] as const;

export function safeTideglassReturnPath(value: string | null | undefined, fallback: string): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  try {
    const resolved = new URL(value, "https://tideglass.local");
    if (resolved.origin !== "https://tideglass.local") return fallback;
    const path = `${resolved.pathname}${resolved.search}${resolved.hash}`;
    return tideglassReturnPrefixes.some(
      (prefix) => resolved.pathname === prefix || resolved.pathname.startsWith(prefix),
    )
      ? path
      : fallback;
  } catch {
    return fallback;
  }
}

export function buildTideglassCompareHref(input: {
  taleSlug: string;
  sourceEditionId?: string | null;
  targetEditionId?: string | null;
  historyRecordId?: string | null;
  returnTo?: string | null;
}) {
  const params = new URLSearchParams();
  if (input.sourceEditionId) params.set("from", input.sourceEditionId);
  if (input.targetEditionId) params.set("to", input.targetEditionId);
  if (input.historyRecordId) params.set("historyRecord", input.historyRecordId);
  if (input.returnTo) params.set("returnTo", input.returnTo);
  const query = params.toString();
  return `/chronicles/${encodeURIComponent(input.taleSlug)}/compare${query ? `?${query}` : ""}`;
}
