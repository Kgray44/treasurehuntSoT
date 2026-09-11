"use client";

import Link from "next/link";

type StudioSection = "story" | "settings" | "assets" | "locations" | "artifacts" | "versions" | "trials";

const sectionLabels: Record<StudioSection, string> = {
  story: "Passages",
  trials: "Sea Trials",
  settings: "Chronicle settings",
  assets: "Assets",
  locations: "Waypoints",
  artifacts: "Artifacts",
  versions: "Versions",
};

export function StudioNoEditableDraftState({
  tale,
  section = "story",
}: {
  tale: { id: string; slug: string; title: string; subtitle: string | null };
  section?: StudioSection;
}) {
  const surface = sectionLabels[section];
  return (
    <main className="studio-no-editable-draft" data-studio-state="no-editable-draft">
      <div className="studio-no-editable-draft__frame">
        <header className="studio-no-editable-draft__header">
          <p className="eyebrow">Creator Studio · {surface}</p>
          <h1>{tale.title}</h1>
          <p>{tale.subtitle ?? "Chronicle workspace"}</p>
        </header>
        <section className="studio-no-editable-draft__notice" aria-labelledby="no-editable-draft-heading">
          <div className="studio-no-editable-draft__seal" aria-hidden="true">
            ◈
          </div>
          <div>
            <p className="card-kicker">Authoring unavailable</p>
            <h2 id="no-editable-draft-heading">No editable draft is available</h2>
            <p>
              This Chronicle is still part of your Studio library, but it does not currently have an editable draft for
              this authoring surface.
            </p>
          </div>
        </section>
        <section className="studio-no-editable-draft__details" aria-labelledby="no-editable-draft-next-heading">
          <div>
            <p className="card-kicker">Current context</p>
            <dl>
              <div>
                <dt>Chronicle</dt>
                <dd>{tale.title}</dd>
              </div>
              <div>
                <dt>Studio surface</dt>
                <dd>{surface}</dd>
              </div>
              <div>
                <dt>Authoring status</dt>
                <dd>Unavailable without an editable draft</dd>
              </div>
            </dl>
          </div>
          <div className="studio-no-editable-draft__next">
            <p className="card-kicker">Next step</p>
            <h2 id="no-editable-draft-next-heading">Choose another Chronicle</h2>
            <p>
              Return to the Chronicle Library to open a Chronicle with an available draft or review this Chronicle from
              its existing library context.
            </p>
            <Link className="brass-button" href="/studio/library">
              Return to Chronicle Library
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
