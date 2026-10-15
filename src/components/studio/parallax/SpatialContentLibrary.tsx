"use client";

import Image from "next/image";
import { useId, useMemo, useState } from "react";
import type { SpatialLibraryRecord } from "@/parallax/library-service";
import type { EnvironmentCatalogItem } from "@/parallax/spatial-library-environment-catalog";
import {
  buildSpatialContentCatalog,
  filterSpatialContentCatalog,
  sceneEnvironmentIdentity,
  type SpatialCatalogProviderEntry,
  type SpatialContentEntry,
  type SpatialContentKind,
  type SpatialContentOrigin,
} from "@/parallax/spatial-content-catalog";
import { AssetPreview } from "./SpatialAssetBrowser";
import styles from "./SpatialContentLibrary.module.css";

const categoryNames: Record<SpatialContentKind, string> = {
  ASSETS: "Assets",
  ENVIRONMENTS: "Environments",
  SCENES: "Scenes",
  EFFECTS: "Effects",
  COMPOSITIONS: "Compositions",
};
const originNames: Record<SpatialContentOrigin, string> = {
  BUILT_IN: "Built-in",
  MY_CREATIONS: "My Creations",
  RECONSTRUCTED: "From Photos",
  INSTALLED: "Installed Community",
};
type ManageMode = "SAVE_AS" | "METADATA" | "VERSIONS";
type Props = {
  items: SpatialLibraryRecord[];
  environments: EnvironmentCatalogItem[];
  providerEntries?: SpatialCatalogProviderEntry[];
  environmentError?: string;
  busy: boolean;
  currentId?: string;
  kind?: SpatialContentKind;
  onKindChange?: (kind: SpatialContentKind) => void;
  initialKind?: SpatialContentKind;
  onInsertPreset: (preset: string) => void;
  onDragPreset?: (preset: string | null) => void;
  onOpenScene: (record: SpatialLibraryRecord) => void;
  onManageScene: (record: SpatialLibraryRecord, mode: ManageMode) => void;
  onSaveScene: (record: SpatialLibraryRecord) => void;
  onArchiveScene: (record: SpatialLibraryRecord, archive: boolean) => void;
  onUseSaved: (record: SpatialLibraryRecord, versionId: string) => void;
  onOpenEnvironment: (item: EnvironmentCatalogItem) => void;
  onManageEnvironment: (item: EnvironmentCatalogItem, mode: ManageMode) => void;
  onSaveEnvironment: (item: EnvironmentCatalogItem) => void;
  onArchiveEnvironment: (item: EnvironmentCatalogItem, archive: boolean) => void;
  onUseEnvironment: (item: EnvironmentCatalogItem, versionId?: string) => void;
  onReviewCompatibleEnvironment?: (item: EnvironmentCatalogItem) => void;
  onCreateEnvironment: () => void;
  onRetryEnvironments?: () => void;
};

function Artwork({ item }: { item: SpatialContentEntry }) {
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
  if (item.preset) return <AssetPreview name={item.name} />;
  if (item.environment) {
    const preview = item.environment.preview;
    const marks =
      preview?.kind === "RICH_ROOM"
        ? preview.room.features
            .filter((feature) => !["FLOOR", "CEILING", "WALL"].includes(feature.classification))
            .slice(0, 12)
            .map((feature) => ({
              id: feature.id,
              x: 80 + feature.position.x * 8,
              y: 48 + feature.position.z * 8,
              width: Math.max(3, feature.dimensions[0] * 8),
              height: Math.max(3, feature.dimensions[2] * 8),
            }))
        : preview?.kind === "LEGACY_FIXTURES"
          ? preview.environment.fixtures.slice(0, 12).map((fixture) => ({
              id: fixture.id,
              x: 80 + fixture.position.x * 8,
              y: 48 + fixture.position.z * 8,
              width: Math.max(3, fixture.size.x * 8),
              height: Math.max(3, fixture.size.z * 8),
            }))
          : [];
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
        {marks.map((mark) => (
          <rect
            key={mark.id}
            x={mark.x}
            y={mark.y}
            width={mark.width}
            height={mark.height}
            fill="var(--studio-selected)"
            stroke="var(--studio-muted)"
          />
        ))}
      </svg>
    );
  }
  if (item.scene) {
    return (
      <svg viewBox="0 0 160 96" aria-hidden="true" className={styles.artwork}>
        <rect width="160" height="96" rx="8" fill="var(--studio-raised)" />
        <path
          d="M13 74 80 90l67-16V21L80 6 13 21Z M13 74l67-15 67 15M80 6v53"
          fill="none"
          stroke="var(--studio-border-strong)"
        />
        {item.scene.draft.content.entities.slice(0, 18).map((entity, index) => (
          <rect
            key={entity.id}
            x={32 + (index % 5) * 20 + entity.transform.position.x * 3}
            y={32 + Math.floor(index / 5) * 15 + entity.transform.position.z * 3}
            width="11"
            height="8"
            rx="2"
            fill={entity.kind === "PARCHMENT" ? "#d7c39d" : "#85b9c9"}
          />
        ))}
      </svg>
    );
  }
  return (
    <span className={styles.effectArt} aria-hidden="true">
      ✧
    </span>
  );
}

export function SpatialContentLibrary(props: Props) {
  const [localKind, setLocalKind] = useState<SpatialContentKind>(props.initialKind ?? "ASSETS");
  const kind = props.kind ?? localKind;
  const filtersId = useId();
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [origin, setOrigin] = useState<"ALL" | SpatialContentOrigin | "FAVORITES" | "RECENTLY_USED" | "IN_USE">("ALL");
  const [state, setState] = useState<"ACTIVE" | "SAVED" | "WORKING" | "ARCHIVED">("ACTIVE");
  const [environmentId, setEnvironmentId] = useState("");
  const [sort, setSort] = useState<"NAME" | "RECENT">("NAME");
  const [view, setView] = useState<"GRID" | "LIST">("GRID");
  const [selectedId, setSelectedId] = useState("");
  const [limit, setLimit] = useState(48);
  const [chosenVersions, setChosenVersions] = useState<Record<string, string>>({});
  const [archiveId, setArchiveId] = useState("");
  const entries = useMemo(
    () => buildSpatialContentCatalog(props.items, props.environments, props.providerEntries),
    [props.items, props.environments, props.providerEntries],
  );
  const visibleKinds = (["ASSETS", "ENVIRONMENTS", "SCENES", "EFFECTS", "COMPOSITIONS"] as const).filter(
    (candidate) =>
      ["ASSETS", "ENVIRONMENTS", "SCENES"].includes(candidate) || entries.some((item) => item.kind === candidate),
  );
  const matching = useMemo(
    () => filterSpatialContentCatalog(entries, { kind, search, origin, state, environmentId, sort }),
    [entries, kind, search, origin, state, environmentId, sort],
  );
  const selected = entries.find((item) => item.id === selectedId && item.kind === kind);
  const kindEntries = entries.filter((item) => item.kind === kind && !item.archived);
  const availableOrigins = [...new Set(kindEntries.map((item) => item.origin))];
  const activeFilterCount = [
    origin !== "ALL",
    state !== "ACTIVE",
    sort !== "NAME",
    view !== "GRID",
    Boolean(environmentId),
  ].filter(Boolean).length;
  const chooseKind = (next: SpatialContentKind) => {
    if (props.onKindChange) props.onKindChange(next);
    else setLocalKind(next);
    setSearch("");
    setOrigin("ALL");
    setState("ACTIVE");
    setEnvironmentId("");
    setSelectedId("");
    setLimit(48);
  };
  const showScenes = (id: string) => {
    chooseKind("SCENES");
    setEnvironmentId(id);
  };
  const showEnvironment = (id: string) => {
    chooseKind("ENVIRONMENTS");
    setSelectedId(`environment:${id}`);
  };
  const chosenVersion = selected ? chosenVersions[selected.id] : undefined;
  const environment = selected?.environment;
  const scene = selected?.scene;
  const savedComposition = scene?.draft.category === "SCENE_TEMPLATE" && scene.draft.tags.includes("composition");
  const lifecycle = environment?.record.representation === "LIFECYCLE_V1" ? environment.record : null;
  const legacy = environment?.record.representation === "SC01_SCHEMA1" ? environment.record : null;
  const ownedLegacyWorking = Boolean(legacy && !legacy.builtin && legacy.working);
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
        {visibleKinds.map((category) => (
          <button key={category} role="tab" aria-selected={kind === category} onClick={() => chooseKind(category)}>
            {categoryNames[category]}
          </button>
        ))}
      </div>
      <label className={styles.search}>
        <span>Search {categoryNames[kind].toLowerCase()}</span>
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
      <div className={styles.filterSection} data-mobile-open={mobileFiltersOpen}>
        <button
          type="button"
          className={styles.filterToggle}
          aria-controls={filtersId}
          aria-expanded={mobileFiltersOpen}
          onClick={() => setMobileFiltersOpen((open) => !open)}
        >
          <span>Filters &amp; view</span>
          <span>{activeFilterCount ? `${activeFilterCount} active` : "Source, status, sort"}</span>
        </button>
        <div id={filtersId} className={styles.filterContents}>
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
                {availableOrigins.map((value) => (
                  <option key={value} value={value}>
                    {originNames[value]}
                  </option>
                ))}
                {kindEntries.some((item) => item.favorite === true) && <option value="FAVORITES">Favorites</option>}
                {kindEntries.some((item) => item.lastUsedAt) && <option value="RECENTLY_USED">Recently used</option>}
                {kindEntries.some((item) => (item.usageCount ?? 0) > 0) && <option value="IN_USE">In use</option>}
              </select>
            </label>
            <label>
              Show
              <select
                value={state}
                onChange={(event) => {
                  setState(event.target.value as typeof state);
                  setLimit(48);
                }}
              >
                <option value="ACTIVE">All current</option>
                <option value="SAVED">Saved and built-in</option>
                <option value="WORKING">Working drafts</option>
                <option value="ARCHIVED">Archived</option>
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
                {props.environments.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      </div>
      {kind === "ENVIRONMENTS" && (
        <>
          <button onClick={props.onCreateEnvironment} disabled={props.busy}>
            Create Environment
          </button>
          {props.environmentError && (
            <p role="alert" className={styles.blocked}>
              {props.environmentError}{" "}
              {props.onRetryEnvironments && <button onClick={props.onRetryEnvironments}>Retry catalog</button>}
            </p>
          )}
        </>
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
              {selected.dimensions.map((value) => value.toFixed(2)).join(" × ")} m · {selected.support?.toLowerCase()}{" "}
              support
            </p>
          )}
          {environment && (
            <p className={styles.metadata}>
              {environment.widthMeters != null && environment.depthMeters != null
                ? `${environment.widthMeters} × ${environment.depthMeters} m · `
                : ""}
              {environment.authoredFeatureCount != null
                ? `${environment.authoredFeatureCount} ${environment.preview?.kind === "LEGACY_FIXTURES" ? "fixtures" : "room features"} · `
                : ""}
              {environment.immutableVersions.length} immutable versions · {environment.saveState ?? "Built-in"}
            </p>
          )}
          {selected.usageCount != null && (
            <p className={styles.metadata}>
              Used by {selected.usageCount} {selected.usageCount === 1 ? "definition" : "definitions"}
            </p>
          )}
          {scene && (
            <p className={styles.metadata}>
              {selected.environmentName ?? "No saved Environment"} · {selected.objectCount} objects · working revision{" "}
              {selected.revision} · {scene.releases.length} immutable versions ·{" "}
              {selected.saveState === "SAVED"
                ? "Private Library"
                : selected.saveState === "WORKING"
                  ? "Working draft"
                  : "Legacy draft for review"}
            </p>
          )}
          {selected.includedElements?.length ? (
            <p className={styles.metadata}>Includes: {selected.includedElements.slice(0, 6).join(", ")}</p>
          ) : null}
          {selected.blocked && <p className={styles.blocked}>{selected.blocked}</p>}
          {environment && environment.preview?.kind === "LEGACY_FIXTURES" && (
            <p className={styles.metadata}>
              {environment.record.representation === "SC01_SCHEMA1" && environment.record.working
                ? "Fixture preview is read-only here. This Environment has a separate working document; immutable versions stay pinned."
                : "Only immutable fixture versions are available. Preview does not change this Environment."}
            </p>
          )}
          {environment && !environment.preview && (
            <p className={styles.metadata}>No verified geometry preview is available for this Environment.</p>
          )}
          {selected.archived && (
            <p className={styles.metadata}>
              Archived working definition. Existing immutable versions and Scene references remain pinned.
            </p>
          )}
          {((scene && (selected.kind === "ASSETS" || selected.kind === "COMPOSITIONS") && scene.releases.length > 0) ||
            (lifecycle && !selected.archived)) && (
            <label className={styles.environmentFilter}>
              Use version
              <select
                value={chosenVersion ?? (lifecycle ? "WORKING" : (scene?.releases[0]?.id ?? ""))}
                onChange={(event) => setChosenVersions({ ...chosenVersions, [selected.id]: event.target.value })}
              >
                {lifecycle && <option value="WORKING">Current working snapshot</option>}
                {lifecycle?.versions.map((version) => (
                  <option key={version.reference.versionId} value={version.reference.versionId}>
                    Version {version.reference.revision}
                  </option>
                ))}
                {scene?.releases.map((version) => (
                  <option key={version.id} value={version.id}>
                    Version {version.semanticVersion}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className={styles.primaryActions}>
            {selected.preset && (
              <button
                disabled={props.busy || Boolean(selected.blocked)}
                onClick={() => props.onInsertPreset(selected.preset!)}
              >
                Add to active Scene
              </button>
            )}
            {scene && !selected.archived && (
              <>
                <button disabled={props.busy} onClick={() => props.onOpenScene(scene)}>
                  Open original
                </button>
                <button disabled={props.busy} onClick={() => props.onManageScene(scene, "SAVE_AS")}>
                  Create independent copy
                </button>
                {selected.kind === "SCENES" && sceneEnvironmentIdentity(scene) && (
                  <button onClick={() => showEnvironment(sceneEnvironmentIdentity(scene)!)}>View Environment</button>
                )}
                {(selected.kind === "ASSETS" || selected.kind === "COMPOSITIONS") && (
                  <button
                    disabled={
                      props.busy || (savedComposition ? selected.saveState !== "SAVED" : !scene.releases.length)
                    }
                    onClick={() => props.onUseSaved(scene, chosenVersion ?? scene.releases[0]?.id ?? "")}
                  >
                    {savedComposition ? "Add saved composition" : "Add released copy"}
                  </button>
                )}
              </>
            )}
            {environment && !selected.archived && lifecycle && (
              <>
                <button disabled={props.busy} onClick={() => props.onOpenEnvironment(environment)}>
                  Edit original
                </button>
                <button disabled={props.busy} onClick={() => props.onManageEnvironment(environment, "SAVE_AS")}>
                  Create independent copy
                </button>
                <button
                  disabled={props.busy || environment.saveState !== "SAVED"}
                  onClick={() =>
                    props.onUseEnvironment(environment, chosenVersion === "WORKING" ? undefined : chosenVersion)
                  }
                >
                  Use in current Scene
                </button>
                {environment.saveState !== "SAVED" && (
                  <button disabled={props.busy} onClick={() => props.onSaveEnvironment(environment)}>
                    Save Environment to private Library
                  </button>
                )}
                <button onClick={() => showScenes(environment.id)}>View associated Scenes</button>
              </>
            )}
            {environment && !selected.archived && legacy && (
              <>
                {(legacy.builtin || ownedLegacyWorking) && (
                  <button disabled={props.busy} onClick={() => props.onOpenEnvironment(environment)}>
                    {legacy.builtin ? "Create independent copy" : "Edit original"}
                  </button>
                )}
                {props.onReviewCompatibleEnvironment && environment.immutableVersions.length > 0 && (
                  <button disabled={props.busy} onClick={() => props.onReviewCompatibleEnvironment!(environment)}>
                    Review versions in Scene Manager
                  </button>
                )}
                {ownedLegacyWorking && environment.saveState !== "SAVED" && (
                  <button disabled={props.busy} onClick={() => props.onSaveEnvironment(environment)}>
                    Save Environment to private Library
                  </button>
                )}
                <button onClick={() => showScenes(environment.id)}>View associated Scenes</button>
              </>
            )}
            {scene && !selected.archived && selected.saveState !== "SAVED" && (
              <button disabled={props.busy} onClick={() => props.onSaveScene(scene)}>
                Save to private Library
              </button>
            )}
            {selected.archived && scene && (
              <button disabled={props.busy} onClick={() => props.onArchiveScene(scene, false)}>
                Restore
              </button>
            )}
            {selected.archived && (lifecycle || ownedLegacyWorking) && (
              <button disabled={props.busy} onClick={() => props.onArchiveEnvironment(environment!, false)}>
                Restore
              </button>
            )}
          </div>
          {(scene || lifecycle || ownedLegacyWorking) && !selected.archived && (
            <div className={styles.sceneActions}>
              {(scene || lifecycle) && (
                <>
                  <button
                    disabled={props.busy}
                    onClick={() =>
                      scene
                        ? props.onManageScene(scene, "METADATA")
                        : props.onManageEnvironment(environment!, "METADATA")
                    }
                  >
                    Organize / rename
                  </button>
                  <button
                    disabled={props.busy}
                    onClick={() =>
                      scene
                        ? props.onManageScene(scene, "VERSIONS")
                        : props.onManageEnvironment(environment!, "VERSIONS")
                    }
                  >
                    Version history
                  </button>
                </>
              )}
              {archiveId === selected.id ? (
                <div className={styles.archiveConfirm}>
                  <p>Archive this working item? Immutable versions and Scene references remain pinned.</p>
                  <button
                    disabled={props.busy || selected.id === `saved:${props.currentId}`}
                    onClick={() => {
                      if (scene) props.onArchiveScene(scene, true);
                      else if (environment) props.onArchiveEnvironment(environment, true);
                      setArchiveId("");
                    }}
                  >
                    Archive item
                  </button>
                  <button onClick={() => setArchiveId("")}>Cancel</button>
                </div>
              ) : (
                <button
                  disabled={props.busy || selected.id === `saved:${props.currentId}`}
                  onClick={() => setArchiveId(selected.id)}
                >
                  Archive…
                </button>
              )}
            </div>
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
                props.onDragPreset?.(item.preset);
              }
            }}
            onDragEnd={() => props.onDragPreset?.(null)}
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
                  {item.saveState === "WORKING" ? " · Working" : ""}
                </small>
              </span>
            </button>
            <details className={styles.contextMenu}>
              <summary aria-label={`Actions for ${item.name}`}>⋯</summary>
              <div>
                <button onClick={() => setSelectedId(item.id)}>Preview details</button>
                {item.preset && (
                  <button
                    disabled={props.busy || Boolean(item.blocked)}
                    onClick={() => props.onInsertPreset(item.preset!)}
                  >
                    Add to Scene
                  </button>
                )}
                {item.scene && !item.archived && (
                  <button disabled={props.busy} onClick={() => props.onOpenScene(item.scene!)}>
                    Open original
                  </button>
                )}
                {item.environment && !item.archived && (
                  <>
                    {(item.environment.record.representation === "LIFECYCLE_V1" ||
                      item.environment.record.builtin ||
                      item.environment.record.working) && (
                      <button disabled={props.busy} onClick={() => props.onOpenEnvironment(item.environment!)}>
                        {item.environment.record.representation === "SC01_SCHEMA1" && item.environment.record.builtin
                          ? "Create independent copy"
                          : "Edit original"}
                      </button>
                    )}
                    {item.environment.record.representation === "SC01_SCHEMA1" &&
                      item.environment.immutableVersions.length > 0 &&
                      props.onReviewCompatibleEnvironment && (
                        <button
                          disabled={props.busy}
                          onClick={() => props.onReviewCompatibleEnvironment!(item.environment!)}
                        >
                          Review versions in Scene Manager
                        </button>
                      )}
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
            : `No ${categoryNames[kind].toLowerCase()} are available in this view.`}
        </p>
      )}
      <p className={styles.footnote}>
        Library saves are private. Immutable Chronicle versions and Community publication are separate actions.
      </p>
    </section>
  );
}
