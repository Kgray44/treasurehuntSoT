export type TideglassSemanticChange = {
  changeCode?: string;
  category?: string;
  kind?: string;
  significance?: string;
  spoilerLevel?: string;
  disclosureState?: "VISIBLE" | "DISCLOSABLE" | "WITHHELD";
  compatibilityRelevant?: boolean;
  entityType?: string;
  entityId?: string;
};

function readable(value: string | undefined, fallback: string) {
  return (value ?? fallback).replaceAll("_", " ").toLocaleLowerCase();
}

function heading(value: string | undefined, fallback: string) {
  return readable(value, fallback).replace(/\b\p{L}/gu, (letter) => letter.toLocaleUpperCase());
}

export function TideglassChangeCards({
  changes,
  category,
  creatorTechnical = false,
}: {
  changes: readonly TideglassSemanticChange[];
  category?: string;
  creatorTechnical?: boolean;
}) {
  const visible = changes.filter(
    (change) => change.disclosureState !== "WITHHELD" && (!category || change.category === category),
  );
  if (!visible.length) return null;
  return (
    <ol className="tideglass-change-cards" aria-label="Semantic changes">
      {visible.map((change, index) => (
        <li key={`${change.changeCode ?? "semantic-change"}-${index}`}>
          <article>
            <h4>
              {heading(change.category, "Chronicle")} {heading(change.kind, "update")}
            </h4>
            <p>
              Classified as {readable(change.significance, "meaningful")} because its governed semantic category
              changed.
            </p>
            <dl>
              <div>
                <dt>Disclosure</dt>
                <dd>{heading(change.disclosureState, "Visible")}</dd>
              </div>
              <div>
                <dt>Compatibility</dt>
                <dd>{change.compatibilityRelevant ? "Assessment included" : "No separate assessment"}</dd>
              </div>
              {creatorTechnical && change.changeCode ? (
                <div>
                  <dt>Change code</dt>
                  <dd>{change.changeCode}</dd>
                </div>
              ) : null}
              {creatorTechnical && change.entityType && change.entityId ? (
                <div>
                  <dt>Semantic entity</dt>
                  <dd>
                    {change.entityType}: {change.entityId}
                  </dd>
                </div>
              ) : null}
            </dl>
          </article>
        </li>
      ))}
    </ol>
  );
}
