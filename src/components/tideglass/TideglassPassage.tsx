"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { editionStatusBadges, safeTideglassReturnPath, type TideglassEditionOption } from "@/tideglass/passage";

export type TideglassPassageContextDto = {
  chronicle: { slug: string; title: string };
  editions: TideglassEditionOption[];
  recommendation: { available: boolean; editionId?: string; reason?: string };
  playedAnchors: Array<{ recordId: string; editionId: string; completedAt: string | null }>;
};

type PassageSummaryLine = {
  templateKey?: string;
  category?: string;
  parameters?: { count?: unknown; visibleChangeCount?: unknown };
};

type PassageCategoryGroup = {
  id?: string;
  category?: string;
  label?: string;
  summary?: string;
  disclosureState?: "VISIBLE" | "DISCLOSABLE" | "WITHHELD";
  lines?: PassageSummaryLine[];
};

type PassageProjection = {
  projectionStatus?: "NO_MEANINGFUL_CHANGE" | "PARTIAL" | "AVAILABLE" | "COMPLETE" | "PROJECTED";
  visibleChangeCount?: number;
  summary?: {
    headline?: PassageSummaryLine | string | null;
    categoryGroups?: PassageCategoryGroup[];
    compatibility?: Array<{ dimension?: string; impact?: string }> | { summary?: string; state?: string };
    partial?: boolean | { state?: string; summary?: string };
    unavailableSections?: Array<{ section?: string; code?: string }>;
  };
  annotations?: Array<{
    headline?: string | null;
    body?: string | null;
    disclosureState?: "VISIBLE" | "DISCLOSABLE" | "WITHHELD";
    highlighted?: boolean;
  }>;
};

export type TideglassPassageComparisonDto = {
  selection?: { kind: "PAIR" | "UP_TO_DATE"; sourceEditionId: string; targetEditionId: string };
  projection?: PassageProjection;
};

type PassageError = { error?: string; code?: string };

function labelForCategory(category?: string) {
  return (category ?? "Chronicle").replaceAll("_", " ").toLocaleLowerCase();
}

function safeCount(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function summaryLineCopy(line: PassageSummaryLine | string | null | undefined) {
  if (typeof line === "string") return line;
  if (!line) return "This comparison is ready to review.";
  const count = safeCount(line.parameters?.visibleChangeCount) ?? safeCount(line.parameters?.count);
  if (line.templateKey === "tideglass.summary.no-meaningful-change")
    return "No meaningful changes were recorded between these editions.";
  if (line.templateKey === "tideglass.summary.partial")
    return "This comparison is partial. Some semantic sections are unavailable.";
  if (count === null) return "This comparison is ready to review.";
  return `${count} meaningful ${count === 1 ? "change" : "changes"} are available to review.`;
}

function categoryGroupCopy(group: PassageCategoryGroup) {
  if (group.summary) return group.summary;
  const line = group.lines?.[0];
  const count = safeCount(line?.parameters?.count);
  const category = labelForCategory(group.category ?? line?.category);
  if (count === null) return `Changes to ${category} are available to review.`;
  return `${count} ${category} ${count === 1 ? "change is" : "changes are"} available to review.`;
}

function compatibilityCopy(compatibility: NonNullable<NonNullable<PassageProjection["summary"]>["compatibility"]>) {
  if (!Array.isArray(compatibility)) return compatibility.summary ?? null;
  if (!compatibility.length) return null;
  return compatibility.map(
    (item) =>
      `${labelForCategory(item.dimension)}: ${(item.impact ?? "changed").replaceAll("_", " ").toLocaleLowerCase()}`,
  );
}

function editionLabel(edition: TideglassEditionOption, context: TideglassPassageContextDto) {
  const badges = editionStatusBadges(edition, {
    recommendedEditionId: context.recommendation.available ? context.recommendation.editionId : null,
    earliestEditionId: context.editions.at(0)?.id,
    playedEditionIds: new Set(context.playedAnchors.map((anchor) => anchor.editionId)),
  });
  return `${edition.label}${badges.length ? ` — ${badges.join(" · ").replaceAll("_", " ")}` : ""}`;
}

export function TideglassPassage({
  taleSlug,
  initialSourceEditionId,
  initialTargetEditionId,
  initialHistoryRecordId,
  initialReturnTo,
  initialContext,
  initialComparison,
  headingLevel = "h1",
}: {
  taleSlug: string;
  initialSourceEditionId?: string | null;
  initialTargetEditionId?: string | null;
  initialHistoryRecordId?: string | null;
  initialReturnTo?: string | null;
  initialContext?: TideglassPassageContextDto;
  initialComparison?: TideglassPassageComparisonDto;
  headingLevel?: "h1" | "h2";
}) {
  const [context, setContext] = useState<TideglassPassageContextDto | null>(initialContext ?? null);
  const [sourceEditionId, setSourceEditionId] = useState(initialSourceEditionId ?? null);
  const [targetEditionId, setTargetEditionId] = useState(initialTargetEditionId ?? null);
  const [historyRecordId, setHistoryRecordId] = useState(initialHistoryRecordId ?? null);
  const [comparison, setComparison] = useState<TideglassPassageComparisonDto | null>(initialComparison ?? null);
  const [mode, setMode] = useState<"CONCISE" | "DETAILED">("CONCISE");
  const [loading, setLoading] = useState(!initialContext);
  const [comparing, setComparing] = useState(false);
  const [error, setError] = useState("");
  const [detailsRevealed, setDetailsRevealed] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const requestedInitialComparison = useRef(Boolean(initialComparison));
  const Heading = headingLevel;

  const returnTo = safeTideglassReturnPath(initialReturnTo, `/chronicles/${encodeURIComponent(taleSlug)}`);

  const loadContext = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/tideglass/chronicles/${encodeURIComponent(taleSlug)}`, { cache: "no-store" });
      const body = (await response.json()) as TideglassPassageContextDto & PassageError;
      if (!response.ok) throw new Error(body.error ?? "This Chronicle comparison is unavailable.");
      setContext(body);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "This Chronicle comparison is unavailable.");
    } finally {
      setLoading(false);
    }
  }, [taleSlug]);

  useEffect(() => {
    if (!initialContext) queueMicrotask(() => void loadContext());
  }, [initialContext, loadContext]);

  const selectedHistoryAnchor =
    context && historyRecordId
      ? (context.playedAnchors.find((item) => item.recordId === historyRecordId) ?? null)
      : null;
  // These defaults are derived from the server-owned current publishing pointer, never a client-side date calculation.
  const currentPublishingEditionId = context?.recommendation.available
    ? (context.recommendation.editionId ?? null)
    : null;
  const fallbackSourceEditionId =
    context?.editions.find((edition) => edition.id !== (currentPublishingEditionId ?? targetEditionId))?.id ?? null;
  const selectedSourceEditionId = sourceEditionId ?? selectedHistoryAnchor?.editionId ?? fallbackSourceEditionId;
  const selectedTargetEditionId = targetEditionId ?? currentPublishingEditionId ?? context?.editions.at(-1)?.id ?? null;

  const requestComparison = useCallback(
    async (requestedMode: "CONCISE" | "DETAILED" = mode) => {
      if (!selectedSourceEditionId || !selectedTargetEditionId) {
        setError("Choose both editions before comparing them.");
        return;
      }
      setComparing(true);
      setError("");
      try {
        const response = await fetch(`/api/tideglass/chronicles/${encodeURIComponent(taleSlug)}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            from: selectedSourceEditionId,
            to: selectedTargetEditionId,
            ...(historyRecordId ? { historyRecord: historyRecordId } : {}),
            mode: requestedMode,
          }),
        });
        const body = (await response.json()) as TideglassPassageComparisonDto & PassageError;
        if (!response.ok) throw new Error(body.error ?? "This edition pair cannot be compared.");
        setMode(requestedMode);
        setComparison(body);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "This edition pair cannot be compared.");
      } finally {
        setComparing(false);
      }
    },
    [historyRecordId, mode, selectedSourceEditionId, selectedTargetEditionId, taleSlug],
  );

  useEffect(() => {
    if (requestedInitialComparison.current || !context || !selectedSourceEditionId || !selectedTargetEditionId) return;
    requestedInitialComparison.current = true;
    void requestComparison();
  }, [context, requestComparison, selectedSourceEditionId, selectedTargetEditionId]);

  const sourceLabel =
    context?.editions.find((edition) => edition.id === selectedSourceEditionId)?.label ?? "your selected edition";
  const targetLabel =
    context?.editions.find((edition) => edition.id === selectedTargetEditionId)?.label ?? "your selected edition";
  const projection = comparison?.projection;
  const summary = projection?.summary;
  const revealedGroups = (summary?.categoryGroups ?? []).filter((group) => group.disclosureState !== "WITHHELD");
  const visibleGroups = detailsRevealed
    ? revealedGroups
    : revealedGroups.filter((group) => group.disclosureState === "VISIBLE");
  const filteredGroups =
    categoryFilter === "ALL" ? visibleGroups : visibleGroups.filter((group) => group.category === categoryFilter);
  const annotations = (projection?.annotations ?? []).filter(
    (annotation) =>
      annotation.disclosureState !== "WITHHELD" && (detailsRevealed || annotation.disclosureState === "VISIBLE"),
  );
  const compatibility = useMemo(
    () => (summary?.compatibility ? compatibilityCopy(summary.compatibility) : null),
    [summary],
  );

  if (loading)
    return (
      <section className="tideglass-passage" aria-busy="true">
        <p className="community-eyebrow">Tideglass</p>
        <Heading>What changed?</Heading>
        <p>Opening the exact published editions for this Chronicle…</p>
      </section>
    );

  if (!context)
    return (
      <section className="tideglass-passage" role="alert">
        <Heading>What changed?</Heading>
        <p>{error || "This Chronicle comparison is unavailable."}</p>
        <button type="button" className="community-button community-button--primary" onClick={() => void loadContext()}>
          Try again
        </button>
      </section>
    );

  return (
    <section className="tideglass-passage">
      <header className="tideglass-passage__header">
        <p className="community-eyebrow">Tideglass edition intelligence</p>
        <Heading>What changed?</Heading>
        <p>
          Compare published editions of <strong>{context.chronicle.title}</strong> without exposing raw Chronicle data.
        </p>
      </header>

      <div className="tideglass-passage__selectors" aria-label="Choose editions to compare">
        <label>
          <span>Played or starting edition</span>
          <select
            value={selectedSourceEditionId ?? ""}
            onChange={(event) => {
              setSourceEditionId(event.target.value || null);
              setComparison(null);
              requestedInitialComparison.current = true;
            }}
          >
            <option value="">Choose an edition</option>
            {context.editions.map((edition) => (
              <option key={edition.id} value={edition.id}>
                {editionLabel(edition, context)}
              </option>
            ))}
          </select>
        </label>
        <div className="tideglass-passage__selector-actions">
          <button
            type="button"
            className="community-button community-button--quiet"
            disabled={!selectedSourceEditionId || !selectedTargetEditionId}
            onClick={() => {
              setSourceEditionId(selectedTargetEditionId);
              setTargetEditionId(selectedSourceEditionId);
              setHistoryRecordId(null);
              setComparison(null);
              requestedInitialComparison.current = true;
            }}
          >
            Swap selected editions
          </button>
          <button
            type="button"
            className="community-button community-button--quiet"
            disabled={!context.recommendation.available || !context.recommendation.editionId}
            onClick={() => {
              setTargetEditionId(context.recommendation.editionId ?? null);
              setComparison(null);
              requestedInitialComparison.current = true;
            }}
          >
            Compare to current publishing edition
          </button>
        </div>
        <label>
          <span>Edition to review</span>
          <select
            value={selectedTargetEditionId ?? ""}
            onChange={(event) => {
              setTargetEditionId(event.target.value || null);
              setComparison(null);
              requestedInitialComparison.current = true;
            }}
          >
            <option value="">Choose an edition</option>
            {context.editions.map((edition) => (
              <option key={edition.id} value={edition.id}>
                {editionLabel(edition, context)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {context.playedAnchors.length > 0 ? (
        <label className="tideglass-passage__history">
          <span>Your recorded Voyage</span>
          <select
            value={historyRecordId ?? ""}
            onChange={(event) => {
              const recordId = event.target.value || null;
              setHistoryRecordId(recordId);
              const anchor = context.playedAnchors.find((item) => item.recordId === recordId);
              if (anchor) setSourceEditionId(anchor.editionId);
              setComparison(null);
              requestedInitialComparison.current = true;
            }}
          >
            <option value="">Compare without a recorded Voyage</option>
            {context.playedAnchors.map((anchor) => (
              <option key={anchor.recordId} value={anchor.recordId}>
                {anchor.completedAt
                  ? `Completed ${new Date(anchor.completedAt).toLocaleDateString()}`
                  : "Recorded Voyage"}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <div className="tideglass-passage__actions">
        <button
          type="button"
          className="community-button community-button--primary"
          onClick={() => void requestComparison()}
          disabled={comparing}
        >
          {comparing ? "Comparing editions…" : "Compare editions"}
        </button>
        <Link className="community-button community-button--quiet" href={returnTo}>
          Return to Chronicle
        </Link>
      </div>

      {error ? (
        <p className="tideglass-passage__error" role="alert">
          {error}
        </p>
      ) : null}

      {comparison?.selection?.kind === "UP_TO_DATE" ? (
        <section className="tideglass-passage__result" aria-live="polite">
          <h2>You already played this current edition</h2>
          <p>{sourceLabel} is the current publishing edition for this Chronicle.</p>
        </section>
      ) : null}

      {projection ? (
        <section className="tideglass-passage__result" aria-live="polite">
          <p className="community-eyebrow">
            {sourceLabel} to {targetLabel}
          </p>
          <h2>{summaryLineCopy(summary?.headline)}</h2>
          {projection.projectionStatus === "NO_MEANINGFUL_CHANGE" ? (
            <p>No replay recommendation is implied by this result.</p>
          ) : null}
          {summary?.partial ? (
            <p className="tideglass-passage__limitation">
              {typeof summary.partial === "object"
                ? (summary.partial.summary ?? "This comparison is partial.")
                : "This comparison is partial."}
            </p>
          ) : null}
          {summary?.unavailableSections?.length ? (
            <p className="tideglass-passage__limitation">Some semantic sections could not be compared.</p>
          ) : null}

          {revealedGroups.some((group) => group.disclosureState === "DISCLOSABLE") ? (
            <button
              type="button"
              className="community-button community-button--quiet"
              onClick={() => setDetailsRevealed((current) => !current)}
            >
              {detailsRevealed ? "Hide safe-to-reveal details" : "Show safe-to-reveal details"}
            </button>
          ) : null}

          {visibleGroups.length > 1 ? (
            <label className="tideglass-passage__filter">
              <span>Filter changes by category</span>
              <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                <option value="ALL">All categories</option>
                {visibleGroups.map((group, index) => (
                  <option key={group.id ?? `${group.category ?? "category"}-${index}`} value={group.category ?? ""}>
                    {group.label ?? labelForCategory(group.category)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {filteredGroups.length ? (
            <section className="tideglass-passage__groups" aria-label="Comparison details">
              {filteredGroups.map((group, index) => (
                <article key={group.id ?? `${group.category ?? "category"}-${index}`}>
                  <h3>{group.label ?? labelForCategory(group.category)}</h3>
                  <p>{categoryGroupCopy(group)}</p>
                </article>
              ))}
            </section>
          ) : null}

          {compatibility ? (
            <section className="tideglass-passage__compatibility" aria-label="Compatibility">
              <h3>Compatibility</h3>
              {Array.isArray(compatibility) ? (
                <ul>
                  {compatibility.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p>{compatibility}</p>
              )}
            </section>
          ) : null}

          {annotations.length ? (
            <section className="tideglass-passage__annotations" aria-label="Creator guidance">
              <h3>Creator guidance</h3>
              {annotations.map((annotation, index) => (
                <article key={`${annotation.headline ?? "guidance"}-${index}`}>
                  {annotation.headline ? <h4>{annotation.headline}</h4> : null}
                  {annotation.body ? <p>{annotation.body}</p> : null}
                </article>
              ))}
            </section>
          ) : null}

          {mode === "CONCISE" ? (
            <button
              type="button"
              className="community-button community-button--quiet"
              onClick={() => void requestComparison("DETAILED")}
              disabled={comparing}
            >
              Show detailed comparison
            </button>
          ) : (
            <button
              type="button"
              className="community-button community-button--quiet"
              onClick={() => void requestComparison("CONCISE")}
              disabled={comparing}
            >
              Show concise comparison
            </button>
          )}
        </section>
      ) : null}
    </section>
  );
}
