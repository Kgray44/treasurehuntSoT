import { TideglassChangeCards, type TideglassSemanticChange } from "@/components/tideglass/TideglassChangeCards";

export type TideglassStudioComparisonDto = {
  selection: { kind: "PAIR" | "UP_TO_DATE"; sourceEditionId: string; targetEditionId: string };
  projection: {
    projectionStatus: string;
    visibleChangeCount: number;
    changes: TideglassSemanticChange[];
    summary: {
      headline: { templateKey?: string; parameters?: { visibleChangeCount?: unknown } } | null;
      categoryGroups: Array<{
        id: string;
        category: string;
        lines: Array<{ id: string; changeIds: string[] }>;
      }>;
      compatibility: Array<{ id: string; dimension: string; impact: string }>;
      partial: boolean;
      unavailableSections: Array<{ section?: string; code?: string }>;
    };
    annotations: Array<{ headline?: string | null; body?: string | null; highlighted?: boolean }>;
  };
};

function readable(value: string) {
  return value.replaceAll("_", " ").toLocaleLowerCase();
}

function heading(value: string) {
  return readable(value).replace(/\b\p{L}/gu, (letter) => letter.toLocaleUpperCase());
}

function headlineCopy(comparison: TideglassStudioComparisonDto) {
  const line = comparison.projection.summary.headline;
  const count = line?.parameters?.visibleChangeCount;
  if (line?.templateKey === "tideglass.summary.no-meaningful-change")
    return "No meaningful changes were recorded between these editions.";
  if (line?.templateKey === "tideglass.summary.partial")
    return "This comparison is partial. Some semantic sections are unavailable.";
  const semanticCount =
    typeof count === "number" && Number.isFinite(count) ? count : comparison.projection.visibleChangeCount;
  return `${semanticCount} meaningful ${semanticCount === 1 ? "change" : "changes"} are available to review.`;
}

export function TideglassStudioComparison({
  comparison,
  versionLabels,
  onClose,
}: {
  comparison: TideglassStudioComparisonDto;
  versionLabels: Record<string, string>;
  onClose: () => void;
}) {
  const { selection, projection } = comparison;
  const sourceLabel = versionLabels[selection.sourceEditionId] ?? "selected edition";
  const targetLabel = versionLabels[selection.targetEditionId] ?? "selected edition";
  return (
    <section className="version-comparison tideglass-studio-comparison" aria-live="polite">
      <header>
        <div>
          <p className="eyebrow">Tideglass semantic comparison</p>
          <h3>
            Version {sourceLabel} to Version {targetLabel}
          </h3>
        </div>
        <button type="button" onClick={onClose}>
          Close comparison
        </button>
      </header>
      <p>{headlineCopy(comparison)}</p>
      {projection.projectionStatus === "NO_MEANINGFUL_CHANGE" ? (
        <p>No replay recommendation is implied by this comparison.</p>
      ) : null}
      {projection.summary.partial ? <p className="platform-error">This comparison is partial.</p> : null}
      {projection.summary.unavailableSections.length ? (
        <p className="platform-error">Some semantic sections could not be compared.</p>
      ) : null}
      {projection.summary.categoryGroups.length ? (
        <section className="tideglass-studio-comparison__groups" aria-label="Semantic change categories">
          {projection.summary.categoryGroups.map((group) => {
            const changeCount = group.lines.reduce((total, line) => total + line.changeIds.length, 0);
            return (
              <article key={group.id}>
                <h4>{heading(group.category)}</h4>
                <p>
                  {changeCount} semantic {changeCount === 1 ? "change" : "changes"}
                </p>
              </article>
            );
          })}
        </section>
      ) : null}
      {projection.changes.length ? (
        <section aria-label="Creator semantic change detail">
          <h4>Technical semantic detail</h4>
          <p>These are governed Tideglass records, not a raw storage diff.</p>
          <TideglassChangeCards changes={projection.changes} creatorTechnical />
        </section>
      ) : null}
      {projection.summary.compatibility.length ? (
        <section aria-label="Compatibility assessment">
          <h4>Compatibility</h4>
          <ul>
            {projection.summary.compatibility.map((item) => (
              <li key={item.id}>
                {readable(item.dimension)}: {readable(item.impact)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {projection.annotations.length ? (
        <section aria-label="Creator annotations">
          <h4>Creator annotations</h4>
          {projection.annotations.map((annotation, index) => (
            <article key={`${annotation.headline ?? "annotation"}-${index}`}>
              {annotation.headline ? <h5>{annotation.headline}</h5> : null}
              {annotation.body ? <p>{annotation.body}</p> : null}
            </article>
          ))}
        </section>
      ) : null}
    </section>
  );
}
