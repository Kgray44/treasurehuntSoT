"use client";

import { FormEvent, useEffect, useState } from "react";

type Artifact = {
  id: string;
  name: string;
  type: string;
  state: string;
  status: string;
  chronicle: string;
  grantedAt: string | null;
  favorite: boolean;
  visibility: string;
  displayed: boolean;
  representation: string;
  archived: boolean;
};
type Cabinet = {
  items: Artifact[];
  nextCursor: string | null;
  collections: Array<{ key: string; collected: number; completeness: string }>;
  assemblies: Array<{ id: string; name: string; status: string; components: number; completedAt: string | null }>;
  achievements: Array<{
    id: string;
    key: string;
    title: string;
    description: string;
    state: string;
    showcased: boolean;
    visibility: string;
    earnedAt: string | null;
  }>;
};
type Case = {
  id: string;
  name: string;
  description: string | null;
  visibility: string;
  unlistedToken: string | null;
  items: Array<{ id: string; artifact: { id: string; artifactNameSnapshot: string }; position: number }>;
};
type ArtifactDetail = {
  artifact: {
    name: string;
    type: string;
    representation: string;
    accessibleRepresentation: string;
  };
  provenance: {
    chronicle: string;
    recipientPolicy: string;
    state: string;
    custody: string;
    status: string;
    grantedAt: string | null;
    witnessedAt: string | null;
    discoveredAt: string | null;
    revokedAt: string | null;
    correctedAt: string | null;
    correctionReason: string | null;
  };
  personalization: {
    favorite: boolean;
    privateNote: string | null;
    visibility: string;
    archived: boolean;
  };
  displayCases: Array<{ name: string; visibility: string; position: number }>;
  assemblies: Array<{ name: string; status: string; role: string }>;
};
const visibility = ["ONLY_ME", "CREW_ONLY", "REGISTERED_USERS", "PUBLIC", "UNLISTED"];

export function ArtifactCabinet() {
  const [cabinet, setCabinet] = useState<Cabinet | null>(null),
    [cases, setCases] = useState<Case[]>([]),
    [query, setQuery] = useState(""),
    [detail, setDetail] = useState<ArtifactDetail | null>(null),
    [csrf, setCsrf] = useState(""),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const headers = { "content-type": "application/json", ...(csrf ? { "x-csrf-token": csrf } : {}) };
  const load = async (search = "") => {
    setLoading(true);
    try {
      const response = await fetch(`/api/passport/artifacts?search=${encodeURIComponent(search)}`, {
        cache: "no-store",
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setCabinet(body);
      const caseResponse = await fetch("/api/passport/artifacts/cases", { cache: "no-store" });
      if (caseResponse.ok) setCases(await caseResponse.json());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to open Artifact Cabinet.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    let active = true;
    void Promise.all([
      fetch("/api/passport/artifacts", { cache: "no-store" }),
      fetch("/api/passport/artifacts/cases", { cache: "no-store" }),
      fetch("/api/auth/sessions"),
    ])
      .then(async ([artifactResponse, caseResponse, sessionResponse]) => {
        const [artifactBody, caseBody, sessionBody] = await Promise.all([
          artifactResponse.json(),
          caseResponse.ok ? caseResponse.json() : [],
          sessionResponse.ok ? sessionResponse.json() : null,
        ]);
        if (!active) return;
        if (artifactResponse.ok) setCabinet(artifactBody);
        else setError(artifactBody.error ?? "Unable to open Artifact Cabinet.");
        if (caseResponse.ok) setCases(caseBody);
        setCsrf(sessionBody?.csrfToken ?? "");
        setLoading(false);
      })
      .catch(() => {
        if (active) {
          setError("Unable to open Artifact Cabinet.");
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);
  async function patchArtifact(id: string, patch: Record<string, unknown>) {
    const response = await fetch(`/api/passport/artifacts/${id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify(patch),
    });
    if (!response.ok) {
      const body = await response.json();
      setError(body.error ?? "Unable to update artifact.");
      return;
    }
    await load(query);
  }
  async function viewDetail(id: string) {
    const response = await fetch(`/api/passport/artifacts/${id}`, { cache: "no-store" });
    const body = await response.json();
    if (response.ok) setDetail(body as ArtifactDetail);
    else setError(body.error ?? "Unable to load artifact.");
  }
  async function createCase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/passport/artifacts/cases", {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: form.get("name"),
        description: form.get("description") || null,
        visibility: form.get("visibility"),
      }),
    });
    if (!response.ok) {
      const body = await response.json();
      setError(body.error ?? "Unable to create display case.");
      return;
    }
    event.currentTarget.reset();
    await load(query);
  }
  async function toggleShowcase(id: string, showcased: boolean) {
    const response = await fetch(`/api/passport/achievements/${id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ showcased: !showcased }),
    });
    if (!response.ok) {
      const body = await response.json();
      setError(body.error ?? "Unable to update achievement.");
      return;
    }
    await load(query);
  }
  return (
    <section id="artifacts" aria-labelledby="artifacts-heading">
      <h2 id="artifacts-heading">Artifact Cabinet</h2>
      <p>
        Your private ledger is based on immutable Voyage receipts. Shared inventory alone is shown only as witness
        evidence and is never treated as personal ownership.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void load(query);
        }}
      >
        <label>
          Search artifacts <input value={query} onChange={(event) => setQuery(event.target.value)} maxLength={120} />
        </label>
        <button>Search</button>
      </form>
      {loading ? (
        <p aria-live="polite">Loading artifacts…</p>
      ) : error ? (
        <p role="alert">{error}</p>
      ) : !cabinet?.items.length ? (
        <p>No personal artifacts are recorded yet.</p>
      ) : (
        <ul>
          {cabinet.items.map((item) => (
            <li key={item.id}>
              <strong>{item.name}</strong> — {item.state.replaceAll("_", " ")} · {item.chronicle} ·{" "}
              {item.representation === "FALLBACK"
                ? "Accessible text fallback"
                : `${item.representation} representation available`}
              <button type="button" onClick={() => void viewDetail(item.id)}>
                Details
              </button>
              <button type="button" onClick={() => void patchArtifact(item.id, { favorite: !item.favorite })}>
                {item.favorite ? "Remove favorite" : "Favorite"}
              </button>
              <label>
                Visibility{" "}
                <select
                  value={item.visibility}
                  onChange={(event) => void patchArtifact(item.id, { visibility: event.target.value })}
                >
                  {visibility.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
            </li>
          ))}
        </ul>
      )}
      {detail ? (
        <aside aria-label="Artifact detail">
          <p className="eyebrow">Owner-authorized record</p>
          <h3>{detail.artifact.name}</h3>
          <p>{detail.artifact.accessibleRepresentation}</p>
          <dl>
            <div>
              <dt>Chronicle</dt>
              <dd>{detail.provenance.chronicle}</dd>
            </div>
            <div>
              <dt>Artifact type</dt>
              <dd>{detail.artifact.type.replaceAll("_", " ").toLocaleLowerCase()}</dd>
            </div>
            <div>
              <dt>Ownership</dt>
              <dd>{detail.provenance.state.replaceAll("_", " ").toLocaleLowerCase()}</dd>
            </div>
            <div>
              <dt>Record status</dt>
              <dd>{detail.provenance.status.replaceAll("_", " ").toLocaleLowerCase()}</dd>
            </div>
            <div>
              <dt>Visibility</dt>
              <dd>{detail.personalization.visibility.replaceAll("_", " ").toLocaleLowerCase()}</dd>
            </div>
            <div>
              <dt>Granted</dt>
              <dd>
                {detail.provenance.grantedAt
                  ? new Date(detail.provenance.grantedAt).toLocaleString()
                  : "Grant time unavailable"}
              </dd>
            </div>
          </dl>
          {detail.personalization.privateNote ? <p>{detail.personalization.privateNote}</p> : null}
          {detail.displayCases.length ? (
            <p>Displayed in {detail.displayCases.map((item) => item.name).join(", ")}.</p>
          ) : null}
          {detail.assemblies.length ? <p>Used in {detail.assemblies.map((item) => item.name).join(", ")}.</p> : null}
          <button type="button" onClick={() => setDetail(null)}>
            Close detail
          </button>
        </aside>
      ) : null}
      <section aria-labelledby="collection-progress-heading">
        <h3 id="collection-progress-heading">Collection progress</h3>
        {cabinet?.collections.length ? (
          <ul>
            {cabinet.collections.map((collection) => (
              <li key={collection.key}>
                {collection.key}: {collection.collected} collected{" "}
                <small>({collection.completeness.replaceAll("_", " ").toLowerCase()})</small>
              </li>
            ))}
          </ul>
        ) : (
          <p>No collection-qualified personal artifacts yet.</p>
        )}
      </section>
      <section aria-labelledby="assembly-heading">
        <h3 id="assembly-heading">Assemblies</h3>
        {cabinet?.assemblies.length ? (
          <ul>
            {cabinet.assemblies.map((assembly) => (
              <li key={assembly.id}>
                {assembly.name}: {assembly.components} components · {assembly.status.replaceAll("_", " ")}
              </li>
            ))}
          </ul>
        ) : (
          <p>No personal assembly components yet.</p>
        )}
      </section>
      <section aria-labelledby="cases-heading">
        <h3 id="cases-heading">Display cases</h3>
        <form onSubmit={createCase}>
          <label>
            Name <input name="name" required maxLength={100} />
          </label>
          <label>
            Description <input name="description" maxLength={1000} />
          </label>
          <label>
            Visibility{" "}
            <select name="visibility" defaultValue="ONLY_ME">
              {visibility.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <button>Create display case</button>
        </form>
        {cases.length ? (
          <ul>
            {cases.map((item) => (
              <li key={item.id}>
                <strong>{item.name}</strong> · {item.visibility.replaceAll("_", " ")} · {item.items.length} ordered
                artifacts
                {item.visibility === "UNLISTED" && item.unlistedToken ? (
                  <p>
                    Keep this case link private: <code>?case={item.unlistedToken}</code>
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p>Display cases start private until you choose otherwise.</p>
        )}
      </section>
      <section aria-labelledby="achievements-heading">
        <h3 id="achievements-heading">Achievements</h3>
        {cabinet?.achievements.length ? (
          <ul>
            {cabinet.achievements.map((achievement) => (
              <li key={achievement.id}>
                <strong>{achievement.title}</strong> — {achievement.description} · {achievement.state}
                <button type="button" onClick={() => void toggleShowcase(achievement.id, achievement.showcased)}>
                  {achievement.showcased ? "Remove from showcase" : "Showcase"}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p>Achievements appear after authoritative facts qualify.</p>
        )}
      </section>
    </section>
  );
}
