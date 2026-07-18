"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { selectCapturePlatformAdapter, type CapturePlatformAdapter } from "@/vision/capture-adapters";
import { waypointTypes } from "@/vision/domain";

type Version = {
  id: string;
  versionNumber: number;
  lifecycleStatus: string;
  publishedAt: string | null;
  publication: { packageHash: string } | null;
  representativeAssetId: string | null;
};
type Waypoint = {
  id: string;
  name: string;
  description: string;
  type: string;
  sharingScope: string;
  usageCount: number;
  locationTags: string[];
  updatedAt: string;
  versions: Version[];
};

export function VisionWaypointLibrary({ authenticated }: { authenticated: boolean }) {
  const captureAdapter = useMemo(() => selectCapturePlatformAdapter(), []);
  const [items, setItems] = useState<Waypoint[]>([]);
  const [csrf, setCsrf] = useState("");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sort, setSort] = useState("UPDATED_DESC");
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
  const visible = useMemo(() => {
    const filtered = items.filter((item) => {
      const latest = item.versions[0]?.lifecycleStatus ?? "NONE";
      return (
        `${item.name} ${item.description} ${item.type} ${item.locationTags.join(" ")}`
          .toLocaleLowerCase()
          .includes(query.toLocaleLowerCase()) &&
        (typeFilter === "ALL" || item.type === typeFilter) &&
        (statusFilter === "ALL" || latest === statusFilter)
      );
    });
    return [...filtered].sort((left, right) =>
      sort === "NAME_ASC"
        ? left.name.localeCompare(right.name)
        : sort === "USAGE_DESC"
          ? right.usageCount - left.usageCount
          : Date.parse(right.updatedAt) - Date.parse(left.updatedAt),
    );
  }, [items, query, sort, statusFilter, typeFilter]);
  async function archive(waypointId: string) {
    if (!window.confirm("Archive this waypoint? Existing exact story bindings remain unchanged.")) return;
    const response = await fetch(`/api/vision-waypoints/${waypointId}/archive`, {
      method: "POST",
      headers: { "x-csrf-token": csrf },
    });
    if (!response.ok)
      setError(((await response.json()) as { error?: string }).error ?? "Waypoint could not be archived.");
    else await load();
  }
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
          <p className="eyebrow">Reusable authoring library</p>
          <h1>Vision Waypoints</h1>
          <p>Search, resume, version, and reuse durable recognition goals across Tall Tales.</p>
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
          <div className="vision-library-filters">
            <label>
              <span>Search</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Name, tags, description, or type"
              />
            </label>
            <label>
              <span>Type</span>
              <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                <option value="ALL">All types</option>
                {waypointTypes.map((item) => (
                  <option value={item} key={item}>
                    {item.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Latest status</span>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="ALL">All statuses</option>
                <option>DRAFT</option>
                <option>READY_TO_BUILD</option>
                <option>PUBLISHED</option>
                <option>DEPRECATED</option>
              </select>
            </label>
            <label>
              <span>Sort</span>
              <select value={sort} onChange={(event) => setSort(event.target.value)}>
                <option value="UPDATED_DESC">Recently updated</option>
                <option value="NAME_ASC">Name</option>
                <option value="USAGE_DESC">Most used</option>
              </select>
            </label>
          </div>
          {error && (
            <p role="alert" className="studio-error">
              {error}
            </p>
          )}
          <p>
            {visible.length} waypoint{visible.length === 1 ? "" : "s"}
          </p>
          <div className="vision-waypoint-grid">
            {visible.length === 0 && (
              <div className="authoring-empty">
                <h2>No waypoints match</h2>
                <p>Clear a filter or create a draft from the form. No sample waypoint is inserted automatically.</p>
              </div>
            )}
            {visible.map((item) => {
              const latest = item.versions[0];
              return (
                <article key={item.id}>
                  <LibraryThumbnail
                    adapter={captureAdapter}
                    artifactId={latest?.representativeAssetId ?? null}
                    type={item.type}
                  />
                  <p className="card-kicker">
                    {item.type.replaceAll("_", " ")} · {item.sharingScope.toLocaleLowerCase()}
                  </p>
                  <h2>{item.name}</h2>
                  <p>{item.description || "No description yet."}</p>
                  {item.locationTags.length > 0 && <p className="tag-line">{item.locationTags.join(" · ")}</p>}
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
                  <div className="library-card-actions">
                    <Link className="brass-button" href={`/studio/vision-waypoints/${item.id}`}>
                      {latest?.lifecycleStatus === "DRAFT" ? "Resume authoring" : "Open waypoint"}
                    </Link>
                    <Link href="/studio/tales">Use in a Tale</Link>
                    <button type="button" onClick={() => void archive(item.id)}>
                      Archive
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </section>
    </main>
  );
}

function LibraryThumbnail({
  adapter,
  artifactId,
  type,
}: {
  adapter: CapturePlatformAdapter;
  artifactId: string | null;
  type: string;
}) {
  const [preview, setPreview] = useState("");
  const [message, setMessage] = useState(
    artifactId ? "Load local representative preview" : "No representative recording yet",
  );
  if (preview)
    return (
      <video
        className="library-waypoint-preview"
        src={preview}
        muted
        preload="metadata"
        aria-label="Local representative waypoint recording"
      />
    );
  return (
    <div className="library-waypoint-thumbnail">
      <strong>
        {type
          .split("_")
          .map((part) => part[0])
          .join("")}
      </strong>
      {artifactId ? (
        <button
          type="button"
          onClick={() =>
            void adapter
              .previewCreatorArtifact(artifactId)
              .then((value) => setPreview(value.previewUrl))
              .catch(() => setMessage("Connect Companion to load the local preview"))
          }
        >
          {message}
        </button>
      ) : (
        <span>{message}</span>
      )}
    </div>
  );
}
