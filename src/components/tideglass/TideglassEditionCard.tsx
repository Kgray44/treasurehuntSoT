import type { TideglassEditionOption, TideglassEditionStatus } from "@/tideglass/passage";

function readable(value: string) {
  return value.replaceAll("_", " ").toLocaleLowerCase();
}

function heading(value: string) {
  return readable(value).replace(/\b\p{L}/gu, (letter) => letter.toLocaleUpperCase());
}

function badgeLabel(value: TideglassEditionStatus) {
  const labels: Record<TideglassEditionStatus, string> = {
    CURRENT_RECOMMENDED: "Recommended",
    PLAYED_BY_YOU: "Played by you",
    ORIGINAL: "Original edition",
    PLAYABLE: "Playable",
    HISTORICAL_ONLY: "Historical edition",
    DEPRECATED: "Deprecated",
    INCOMPATIBLE: "Incompatible",
    REDACTED: "Redacted",
  };
  return labels[value] ?? heading(value);
}

export function TideglassEditionCard({
  edition,
  badges,
  label,
}: {
  edition: TideglassEditionOption;
  badges: readonly TideglassEditionStatus[];
  label: string;
}) {
  return (
    <article className="tideglass-edition-card" aria-label={`${label}: ${edition.label}`}>
      <p className="community-eyebrow">{label}</p>
      <h3>{edition.label}</h3>
      <div className="tideglass-edition-card__badges" aria-label={`${edition.label} status`}>
        {badges.map((badge) => (
          <span key={badge}>{badgeLabel(badge)}</span>
        ))}
      </div>
      <dl>
        <div>
          <dt>Published</dt>
          <dd>{new Date(edition.publishedAt).toLocaleDateString()}</dd>
        </div>
        <div>
          <dt>Creator</dt>
          <dd>{edition.creatorName}</dd>
        </div>
        <div>
          <dt>Compatibility</dt>
          <dd>{edition.compatibilitySummary}</dd>
        </div>
      </dl>
      {edition.releaseNotes ? (
        <p>
          <strong>Release note:</strong> {edition.releaseNotes}
        </p>
      ) : (
        <p>There is no public release note for this edition.</p>
      )}
    </article>
  );
}
