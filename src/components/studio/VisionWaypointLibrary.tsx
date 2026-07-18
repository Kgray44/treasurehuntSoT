"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { waypointTypes } from "@/vision/domain";

type Version = {
  id: string;
  versionNumber: number;
  lifecycleStatus: string;
  publishedAt: string | null;
  publication: { packageHash: string } | null;
};
type Waypoint = {
  id: string;
  name: string;
  description: string;
  type: string;
  sharingScope: string;
  usageCount: number;
  updatedAt: string;
  versions: Version[];
};

export function VisionWaypointLibrary({ authenticated }: { authenticated: boolean }) {
  const [items, setItems] = useState<Waypoint[]>([]);
  const [csrf, setCsrf] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<(typeof waypointTypes)[number]>("AREA_ARRIVAL");
  async function load() {
    const response = await fetch("/api/vision-waypoints?limit=100", { cache: "no-store" });
    const body = (await response.json()) as { items?: Waypoint[]; csrfToken?: string; error?: string };
    if (!response.ok) return setError(body.error ?? "Vision Waypoints are unavailable.");
    setItems(body.items ?? []);
    setCsrf(body.csrfToken ?? "");
  }
  useEffect(() => {
    if (authenticated) queueMicrotask(() => void load());
  }, [authenticated]);
  const visible = useMemo(
    () =>
      items.filter((item) =>
        `${item.name} ${item.description} ${item.type}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
      ),
    [items, query],
  );
  async function create(event: React.FormEvent) {
    event.preventDefault();
    setCreating(true);
    setError("");
    const response = await fetch("/api/vision-waypoints", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
      body: JSON.stringify({
        name,
        description,
        type,
        locationTags: [],
        sharingScope: "PRIVATE",
        verificationProfile: "BALANCED",
      }),
    });
    const body = (await response.json()) as { waypointId?: string; error?: string };
    if (!response.ok) setError(body.error ?? "The waypoint could not be created.");
    else window.location.assign(`/studio/vision-waypoints/${body.waypointId}`);
    setCreating(false);
  }
  if (!authenticated)
    return (
      <main className="studio-auth-gate">
        <section>
          <h1>Creator authentication required</h1>
          <Link href="/quartermaster">Open Quartermaster login</Link>
        </section>
      </main>
    );
  return (
    <main className="vision-library">
      <header>
        <div>
          <Link href="/studio">← Tall Tale Studio</Link>
          <p className="eyebrow">Shared platform foundation</p>
          <h1>Vision Waypoints</h1>
          <p>
            Persisted, versioned recognition goals. B-1 publication creates deterministic development packages only.
          </p>
        </div>
      </header>
      <section className="vision-library-layout">
        <form className="vision-create-card" onSubmit={create}>
          <h2>Create waypoint</h2>
          <label>
            <span>Name</span>
            <input required minLength={2} value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label>
            <span>Description</span>
            <textarea rows={4} value={description} onChange={(event) => setDescription(event.target.value)} />
          </label>
          <label>
            <span>Type</span>
            <select value={type} onChange={(event) => setType(event.target.value as typeof type)}>
              {waypointTypes.map((item) => (
                <option key={item}>{item.replaceAll("_", " ")}</option>
              ))}
            </select>
          </label>
          <button className="brass-button" disabled={creating}>
            {creating ? "Creating…" : "Create draft waypoint"}
          </button>
        </form>
        <section className="vision-library-results">
          <label>
            <span>Search</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Name, description, or type"
            />
          </label>
          {error && (
            <p role="alert" className="studio-error">
              {error}
            </p>
          )}
          <p>
            {visible.length} waypoint{visible.length === 1 ? "" : "s"}
          </p>
          <div className="vision-waypoint-grid">
            {visible.map((item) => {
              const latest = item.versions[0];
              return (
                <article key={item.id}>
                  <p className="card-kicker">
                    {item.type.replaceAll("_", " ")} · {item.sharingScope.toLocaleLowerCase()}
                  </p>
                  <h2>{item.name}</h2>
                  <p>{item.description || "No description yet."}</p>
                  <dl>
                    <div>
                      <dt>Latest</dt>
                      <dd>
                        {latest ? `v${latest.versionNumber} · ${latest.lifecycleStatus.toLocaleLowerCase()}` : "none"}
                      </dd>
                    </div>
                    <div>
                      <dt>Story uses</dt>
                      <dd>{item.usageCount}</dd>
                    </div>
                  </dl>
                  <Link className="brass-button" href={`/studio/vision-waypoints/${item.id}`}>
                    Open waypoint
                  </Link>
                </article>
              );
            })}
          </div>
        </section>
      </section>
    </main>
  );
}
