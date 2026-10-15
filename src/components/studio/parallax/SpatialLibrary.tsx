"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import type { SpatialLibraryRecord } from "@/parallax/library-service";
import type { EnvironmentRecord } from "@/parallax/environment-contracts";
import {
  buildSpatialLibrary,
  filterSpatialLibrary,
  type LibraryEntry,
  type LibraryKind,
  type LibraryOrigin,
} from "@/parallax/library-catalog";
import { AssetPreview } from "./SpatialAssetBrowser";
import styles from "./SpatialLibrary.module.css";

const kinds: { value: LibraryKind; label: string }[] = [
  { value: "ASSETS", label: "Assets" },
  { value: "ENVIRONMENTS", label: "Environments" },
  { value: "SCENES", label: "Scenes" },
  { value: "EFFECTS", label: "Effects" },
  { value: "COMPOSITIONS", label: "Compositions" },
];
const originNames: Record<LibraryOrigin, string> = {
  BUILT_IN: "Built-in",
  MY_CREATIONS: "My Creations",
  RECONSTRUCTED: "From Photos",
};
type Props = {
  initialKind?: LibraryKind;
  items: SpatialLibraryRecord[];
  environments: EnvironmentRecord[];
  busy: boolean;
  onInsert: (preset: string) => void;
  onDragPreset: (preset: string | null) => void;
  onInsertSavedComposition: (record: SpatialLibraryRecord) => void;
  onOpenScene: (record: SpatialLibraryRecord) => void;
  onDuplicateScene: (record: SpatialLibraryRecord) => void;
  onUpdateScene: (
    record: SpatialLibraryRecord,
    patch: { title?: string; favorite?: boolean; collection?: string },
  ) => void;
  onArchiveScene: (record: SpatialLibraryRecord) => void;
  onManageEnvironment: (id: string) => void;
  onPublishSaved: (record: SpatialLibraryRecord, returnFocus: HTMLElement) => void;
  onPublishEnvironment: (record: EnvironmentRecord, returnFocus: HTMLElement) => void;
};

function publishable(item: LibraryEntry) {
  if (item.record)
    return item.record.draft.scope === "MY_LIBRARY" && !item.record.readOnly;
  return Boolean(
    item.environment &&
      !item.environment.builtin &&
      !item.environment.readOnly &&
      item.environment.current.content.origin !== "RECONSTRUCTED",
  );
}

function Artwork({ item }: { item: LibraryEntry }) {
  if (item.thumbnail)
    return (
      <Image
        src={item.thumbnail}
        width={320}
        height={190}
        alt=""
        loading="lazy"
        unoptimized
        className={styles.artwork}
      />
    );
  if (item.id.startsWith("classic:")) return <AssetPreview name={item.name} />;
  if (item.environment) {
    const room = item.environment.current.content;
    return (
      <svg viewBox="0 0 160 96" aria-hidden="true" className={styles.artwork}>
        <rect
          x="5"
          y="5"
          width="150"
          height="86"
          rx="8"
          fill="var(--studio-raised)"
          stroke="var(--studio-border-strong)"
        />
        <path
          d="M18 72V25L80 12l62 13v47L80 86Z M18 72l62-17 62 17M80 12v43"
          fill="none"
          stroke="var(--studio-border-strong)"
        />
        {room.fixtures.slice(0, 12).map((fixture) => (
          <rect
            key={fixture.id}
            x={Math.max(20, Math.min(132, 77 + (fixture.position.x / room.width) * 110))}
            y={Math.max(27, Math.min(69, 49 + (fixture.position.z / room.depth) * 49))}
            width={Math.max(4, Math.min(22, (fixture.size.x / room.width) * 95))}
            height={Math.max(4, Math.min(13, (fixture.size.z / room.depth) * 40))}
            fill={fixture.color}
            stroke="var(--studio-border-strong)"
          />
        ))}
      </svg>
    );
  }
  if (item.record) {
    const entities = item.record.draft.content.entities;
    return (
      <svg viewBox="0 0 160 96" aria-hidden="true" className={styles.artwork}>
        <rect width="160" height="96" rx="8" fill="var(--studio-raised)" />
        <path
          d="M13 74 80 90l67-16V21L80 6 13 21Z M13 74l67-15 67 15M80 6v53"
          fill="none"
          stroke="var(--studio-border-strong)"
        />
        {entities.slice(0, 18).map((entity, i) => (
          <rect
            key={entity.id}
            x={32 + (i % 5) * 20 + entity.transform.position.x * 3}
            y={32 + Math.floor(i / 5) * 15 + entity.transform.position.z * 3}
            width="11"
            height="8"
            rx="2"
            fill={entity.kind === "PARCHMENT" ? "#d7c39d" : "#85b9c9"}
          />
        ))}
      </svg>
    );
  }
  const icon = item.kind === "COMPOSITIONS" ? "✦" : item.family === "Spatial Audio" ? "♫" : "✧";
  return (
    <span className={styles.effectArt} aria-hidden="true">
      {icon}
    </span>
  );
}

function SceneActions({
  item,
  busy,
  onUpdateScene,
  onArchiveScene,
}: Pick<Props, "busy" | "onUpdateScene" | "onArchiveScene"> & { item: LibraryEntry }) {
  const record = item.record!;
  const [title, setTitle] = useState(record.draft.content.title);
  const [collection, setCollection] = useState(record.draft.collection);
  const [confirmArchive, setConfirmArchive] = useState(false);
  return (
    <div className={styles.sceneActions}>
      <label>
        {item.kind === "COMPOSITIONS" ? "Composition name" : "Scene name"}
        <input value={title} maxLength={240} onChange={(event) => setTitle(event.target.value)} />
      </label>
      <label>
        Collection
        <input
          value={collection}
          maxLength={120}
          placeholder="No collection"
          onChange={(event) => setCollection(event.target.value)}
        />
      </label>
      <button
        disabled={
          busy || !title.trim() || (title === record.draft.content.title && collection === record.draft.collection)
        }
        onClick={() => onUpdateScene(record, { title: title.trim(), collection: collection.trim() })}
      >
        Save name &amp; collection
      </button>
      <button disabled={busy} onClick={() => onUpdateScene(record, { favorite: !record.draft.favorite })}>
        {record.draft.favorite ? "Remove favorite" : "Add to favorites"}
      </button>
      {confirmArchive ? (
        <div className={styles.archiveConfirm}>
          <p>Archive this working item? Existing immutable versions and Chronicle references remain pinned.</p>
          <button disabled={busy} onClick={() => onArchiveScene(record)}>
            Archive item
          </button>
          <button onClick={() => setConfirmArchive(false)}>Cancel</button>
        </div>
      ) : (
        <button disabled={busy} onClick={() => setConfirmArchive(true)}>
          Archive…
        </button>
      )}
    </div>
  );
}

export function SpatialLibrary(props: Props) {
  const [kind, setKind] = useState<LibraryKind>(props.initialKind ?? "ASSETS");
  const [search, setSearch] = useState("");
  const [origin, setOrigin] = useState<"ALL" | LibraryOrigin | "FAVORITES">("ALL");
  const [environmentId, setEnvironmentId] = useState("");
  const [sort, setSort] = useState<"NAME" | "RECENT">("NAME");
  const [view, setView] = useState<"GRID" | "LIST">("GRID");
  const [selectedId, setSelectedId] = useState("");
  const [limit, setLimit] = useState(48);
  const entries = useMemo(
    () => buildSpatialLibrary(props.items, props.environments),
    [props.items, props.environments],
  );
  const matching = useMemo(
    () => filterSpatialLibrary(entries, { kind, search, origin, environmentId, sort }),
    [entries, kind, search, origin, environmentId, sort],
  );
  const selected = entries.find((item) => item.id === selectedId && item.kind === kind);
  const chooseKind = (value: LibraryKind) => {
    setKind(value);
    setSearch("");
    setOrigin("ALL");
    setEnvironmentId("");
    setSelectedId("");
    setLimit(48);
  };
  const viewScenes = (id: string) => {
    chooseKind("SCENES");
    setEnvironmentId(id);
  };
  const viewEnvironment = (id: string) => {
    chooseKind("ENVIRONMENTS");
    setSelectedId(`environment:${id}`);
  };
  return (
    <section className={styles.library} aria-label="Spatial content library">
      <div className={styles.heading}>
        <div>
          <small>PARALLAX / LIBRARY</small>
          <h3>Spatial content</h3>
        </div>
        <span>
          {matching.length} {matching.length === 1 ? "item" : "items"}
        </span>
      </div>
      <div className={styles.kinds} role="tablist" aria-label="Library content type">
        {kinds.map((category) => (
          <button
            key={category.value}
            role="tab"
            aria-selected={kind === category.value}
            onClick={() => chooseKind(category.value)}
          >
            {category.label}
          </button>
        ))}
      </div>
      <label className={styles.search}>
        <span>Search {kind.toLowerCase()}</span>
        <input
          type="search"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setLimit(48);
          }}
          placeholder="Name, type, description…"
        />
      </label>
      <div className={styles.controls}>
        <label>
          Source
          <select
            value={origin}
            onChange={(event) => {
              setOrigin(event.target.value as typeof origin);
              setLimit(48);
            }}
          >
            <option value="ALL">All sources</option>
            <option value="BUILT_IN">Built-in</option>
            <option value="MY_CREATIONS">My Creations</option>
            <option value="RECONSTRUCTED">From Photos</option>
            {(kind === "SCENES" || kind === "COMPOSITIONS") && <option value="FAVORITES">Favorites</option>}
          </select>
        </label>
        <label>
          Sort
          <select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}>
            <option value="NAME">Name</option>
            <option value="RECENT">Recently updated</option>
          </select>
        </label>
        <div className={styles.view} role="group" aria-label="Library view">
          <button aria-pressed={view === "GRID"} onClick={() => setView("GRID")}>
            Grid
          </button>
          <button aria-pressed={view === "LIST"} onClick={() => setView("LIST")}>
            List
          </button>
        </div>
      </div>
      {kind === "SCENES" && props.environments.length > 0 && (
        <label className={styles.environmentFilter}>
          Environment
          <select
            value={environmentId}
            onChange={(event) => {
              setEnvironmentId(event.target.value);
              setLimit(48);
            }}
          >
            <option value="">All Environments</option>
            {props.environments.map((environment) => (
              <option key={environment.id} value={environment.id}>
                {environment.current.content.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {selected && (
        <aside className={styles.details} aria-label={`${selected.name} details`}>
          <div className={styles.detailHeader}>
            <strong>{selected.name}</strong>
            <button aria-label="Close item details" onClick={() => setSelectedId("")}>
              ×
            </button>
          </div>
          <p>{selected.description}</p>
          <p className={styles.metadata}>
            {originNames[selected.origin]} · {selected.family}
          </p>
          {selected.dimensions && (
            <p className={styles.metadata}>
              {selected.dimensions.map((size) => size.toFixed(2)).join(" × ")} m · {selected.support?.toLowerCase()}{" "}
              support
            </p>
          )}
          {selected.environment && (
            <p className={styles.metadata}>
              {selected.environment.current.content.width} × {selected.environment.current.content.depth} m ·{" "}
              {selected.environment.current.content.fixtures.length} fixtures · revision {selected.revision}
            </p>
          )}
          {selected.record && (
            <p className={styles.metadata}>
              {selected.environmentName ?? "No saved Environment"} · {selected.objectCount} objects · working revision{" "}
              {selected.revision} · {selected.record.releases.length} immutable versions ·{" "}
              {selected.record.draft.scope === "MY_LIBRARY" ? "Private Library" : "Chronicle only"}
            </p>
          )}
          {selected.blocked && <p className={styles.blocked}>{selected.blocked}</p>}
          {selected.includedElements && (
            <p className={styles.metadata}>Includes: {selected.includedElements.slice(0, 6).join(", ")}</p>
          )}
          <div className={styles.primaryActions}>
            {publishable(selected) && (
              <button
                disabled={props.busy}
                onClick={(event) =>
                  selected.record
                    ? props.onPublishSaved(selected.record, event.currentTarget)
                    : props.onPublishEnvironment(selected.environment!, event.currentTarget)
                }
              >
                Publish to Community
              </button>
            )}
            {selected.preset && (
              <button
                disabled={props.busy || Boolean(selected.blocked)}
                onClick={() => props.onInsert(selected.preset!)}
              >
                Add to active Scene
              </button>
            )}
            {selected.kind === "SCENES" && selected.record && (
              <>
                <button disabled={props.busy} onClick={() => props.onOpenScene(selected.record!)}>
                  Open Scene
                </button>
                <button disabled={props.busy} onClick={() => props.onDuplicateScene(selected.record!)}>
                  Duplicate
                </button>
                {selected.record.draft.content.environment && (
                  <button onClick={() => viewEnvironment(selected.record!.draft.content.environment!.environmentId)}>
                    View Environment
                  </button>
                )}
              </>
            )}
            {selected.kind === "COMPOSITIONS" && selected.record && (
              <button disabled={props.busy} onClick={() => props.onInsertSavedComposition(selected.record!)}>
                Add composition
              </button>
            )}
            {selected.environment && (
              <>
                <button onClick={() => viewScenes(selected.environment!.id)}>View associated Scenes</button>
                <button onClick={() => props.onManageEnvironment(selected.environment!.id)}>Manage Environment</button>
              </>
            )}
          </div>
          {selected.record && (
            <SceneActions
              key={`${selected.id}:${selected.revision}`}
              item={selected}
              busy={props.busy}
              onUpdateScene={props.onUpdateScene}
              onArchiveScene={props.onArchiveScene}
            />
          )}
        </aside>
      )}
      <div className={styles.results} data-view={view}>
        {matching.slice(0, limit).map((item) => (
          <article
            key={item.id}
            className={styles.card}
            data-selected={selectedId === item.id}
            draggable={Boolean(item.preset && !item.blocked && !props.busy)}
            onDragStart={(event) => {
              if (item.preset) {
                event.dataTransfer.setData("application/parallax-preset", item.preset);
                props.onDragPreset(item.preset);
              }
            }}
            onDragEnd={() => props.onDragPreset(null)}
          >
            <button
              className={styles.cardMain}
              aria-label={`Inspect ${item.name}`}
              aria-pressed={selectedId === item.id}
              onClick={() => setSelectedId(item.id)}
            >
              <Artwork item={item} />
              <span className={styles.cardCopy}>
                <strong>{item.name}</strong>
                <small>{item.environmentName ?? item.family}</small>
                <small>
                  {originNames[item.origin]}
                  {item.favorite ? " · Favorite" : ""}
                  {item.blocked ? " · Preview only" : ""}
                </small>
              </span>
            </button>
            <details className={styles.contextMenu}>
              <summary aria-label={`Actions for ${item.name}`}>⋯</summary>
              <div>
                {publishable(item) && (
                  <button
                    disabled={props.busy}
                    onClick={(event) =>
                      item.record
                        ? props.onPublishSaved(item.record, event.currentTarget)
                        : props.onPublishEnvironment(item.environment!, event.currentTarget)
                    }
                  >
                    Publish to Community
                  </button>
                )}
                {item.preset && (
                  <button disabled={props.busy || Boolean(item.blocked)} onClick={() => props.onInsert(item.preset!)}>
                    Add to Scene
                  </button>
                )}
                {item.kind === "SCENES" && item.record && (
                  <>
                    <button disabled={props.busy} onClick={() => props.onOpenScene(item.record!)}>
                      Open Scene
                    </button>
                    <button disabled={props.busy} onClick={() => props.onDuplicateScene(item.record!)}>
                      Duplicate Scene
                    </button>
                    <button
                      disabled={props.busy}
                      onClick={() => props.onUpdateScene(item.record!, { favorite: !item.record!.draft.favorite })}
                    >
                      {item.favorite ? "Remove favorite" : "Add to favorites"}
                    </button>
                  </>
                )}
                {item.kind === "COMPOSITIONS" && item.record && (
                  <button disabled={props.busy} onClick={() => props.onInsertSavedComposition(item.record!)}>
                    Add composition
                  </button>
                )}
                {item.environment && (
                  <>
                    <button onClick={() => viewScenes(item.environment!.id)}>View Scenes</button>
                    <button onClick={() => props.onManageEnvironment(item.environment!.id)}>Manage Environment</button>
                  </>
                )}
              </div>
            </details>
          </article>
        ))}
      </div>
      {matching.length > limit && (
        <button className={styles.more} onClick={() => setLimit((value) => value + 48)}>
          Show more · {matching.length - limit} remaining
        </button>
      )}
      {!matching.length && (
        <p className={styles.empty}>
          {search || origin !== "ALL" || environmentId
            ? "No items match these filters. Clear search or choose another source."
            : `No ${kind.toLowerCase()} are available yet.`}
        </p>
      )}
      <p className={styles.footnote}>
        Saved Scenes and compositions are private to your Library. Immutable Chronicle versions are separate from
        Community publication.
      </p>
    </section>
  );
}
