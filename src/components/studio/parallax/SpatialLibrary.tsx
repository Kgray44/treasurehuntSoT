"use client";
import { useEffect, useRef, useState } from "react";
import type { SpatialLibraryRecord } from "@/parallax/library-service";
import type { EnvironmentLibraryRecord, SpatialLibraryType } from "@/parallax/library-lifecycle-contracts";
import { spatialLibraryKind } from "@/parallax/reusable-assets";
import { environmentPreviewDraft } from "@/parallax/environment-workspace";
import { DefinitionPreview } from "./SavedSpatialLibrary";
import { SpatialCanvas } from "./SpatialCanvas";
import { StudioIcon, useStudioContextMenu } from "./StudioContextMenu";
import styles from "./SpatialStudio.module.css";

export type LibraryEntry = {
  id: string;
  revision: number;
  name: string;
  description: string;
  type: SpatialLibraryType;
  collection: string;
  tags: string[];
  favorite: boolean;
  state: string;
  archived: boolean;
  updatedAt: string;
  lastUsedAt: string | null;
  usageCount: number;
  scene?: SpatialLibraryRecord;
  environment?: EnvironmentLibraryRecord;
};
export function libraryEntries(
  items: SpatialLibraryRecord[],
  environments: EnvironmentLibraryRecord[] = [],
): LibraryEntry[] {
  return [
    ...items.map((i) => ({
      id: i.id,
      revision: i.revision,
      name: i.draft.content.title,
      description: i.draft.library?.description || i.draft.content.studio?.libraryDefinition?.description || "",
      type: ({ SCENES: "SCENE", ASSETS: "ASSET", ASSEMBLIES: "ASSEMBLY", TEMPLATES: "TEMPLATE" } as const)[
        spatialLibraryKind(i.draft)
      ],
      collection: i.draft.collection,
      tags: i.draft.tags,
      favorite: i.draft.favorite,
      state: i.saveState ?? (i.releases.length ? "SAVED" : "LEGACY_REVIEW"),
      archived: !!i.archived,
      updatedAt: i.updatedAt,
      lastUsedAt: i.lastUsedAt ?? null,
      usageCount: i.usageCount,
      scene: i,
    })),
    ...environments.map((i) => ({
      id: i.id,
      revision: i.revision,
      name: i.draft.name,
      description: i.draft.description,
      type: "ENVIRONMENT" as const,
      collection: i.draft.collection,
      tags: i.draft.tags,
      favorite: i.draft.favorite,
      state: i.saveState,
      archived: i.archived,
      updatedAt: i.updatedAt,
      lastUsedAt: i.lastUsedAt,
      usageCount: i.usageCount,
      environment: i,
    })),
  ];
}
const labels: Record<SpatialLibraryType, string> = {
  SCENE: "Scene",
  ASSET: "Asset",
  ASSEMBLY: "Assembly",
  TEMPLATE: "Template",
  ENVIRONMENT: "Environment",
};
export type LibraryDialogRequest = {
  entry: LibraryEntry;
  mode: "SAVE_AS" | "METADATA" | "VERSIONS";
  targetType?: SpatialLibraryType;
  guidance?: string;
  retainedSnapshot?:
    | import("@/parallax/authoring").SpatialDraft
    | import("@/parallax/library-lifecycle-contracts").EnvironmentDraft;
};
export function SpatialLibrary({
  entries,
  busy,
  currentId,
  onOpen,
  onUse,
  onManage,
  onSave,
  onArchive,
  onCreate,
  environmentOnly = false,
}: {
  entries: LibraryEntry[];
  busy: boolean;
  currentId?: string;
  onOpen: (e: LibraryEntry) => void;
  onUse: (e: LibraryEntry, versionId?: string) => void;
  onManage: (r: LibraryDialogRequest) => void;
  onSave: (e: LibraryEntry) => void;
  onArchive: (e: LibraryEntry, archive: boolean) => void;
  onCreate?: () => void;
  environmentOnly?: boolean;
}) {
  const [query, setQuery] = useState(""),
    [view, setView] = useState("SAVED"),
    [type, setType] = useState("ALL"),
    [collection, setCollection] = useState("");
  const menu = useStudioContextMenu();
  const [chosenVersions, setChosenVersions] = useState<Record<string, string>>({});
  const collections = [...new Set(entries.map((e) => e.collection).filter(Boolean))].sort();
  const filtered = entries
    .filter(
      (e) =>
        (!environmentOnly || e.type === "ENVIRONMENT") &&
        (type === "ALL" || type === e.type) &&
        (view === "ARCHIVED" ? e.archived : !e.archived) &&
        (view === "WORKING"
          ? e.state === "WORKING"
          : view === "LEGACY_REVIEW"
            ? e.state === "LEGACY_REVIEW"
            : view === "ARCHIVED"
              ? true
              : e.state === "SAVED") &&
        (view !== "FAVORITES" || e.favorite) &&
        (view !== "IN_USE" || e.usageCount > 0) &&
        (view !== "RECENTLY_USED" || !!e.lastUsedAt) &&
        (view !== "COLLECTIONS" || !collection || e.collection === collection) &&
        `${e.name} ${e.description} ${e.type} ${e.tags.join(" ")} ${e.collection} ${e.scene?.draft.content.studio?.libraryDefinition?.classification ?? e.environment?.draft.category ?? ""}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort((a, b) =>
      view === "RECENTLY_USED"
        ? (b.lastUsedAt ?? "").localeCompare(a.lastUsedAt ?? "")
        : b.updatedAt.localeCompare(a.updatedAt),
    );
  return (
    <section aria-label={environmentOnly ? "Environment definitions" : "Spatial Library"}>
      <header className={styles.environmentLibraryHeader}>
        <h3>{environmentOnly ? "Environments" : "Library"}</h3>
        {onCreate && (
          <button aria-label="Create environment" title="Create environment" disabled={busy} onClick={onCreate}>
            <StudioIcon name="plus" />
          </button>
        )}
      </header>
      <label>
        Search Library
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Name, tags, collection or description"
        />
      </label>
      <div className={styles.libraryFilters}>
        <label>
          View
          <select aria-label="Library view" value={view} onChange={(e) => setView(e.target.value)}>
            {[
              ["SAVED", "Saved"],
              ["WORKING", "Working Drafts"],
              ["LEGACY_REVIEW", "Legacy · review"],
              ["FAVORITES", "Favorites"],
              ["RECENTLY_USED", "Recently used"],
              ["RECENTLY_MODIFIED", "Recently modified"],
              ["COLLECTIONS", "Collections"],
              ["IN_USE", "In use"],
              ["ARCHIVED", "Archived"],
            ].map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </select>
        </label>
        {!environmentOnly && (
          <label>
            Type
            <select aria-label="Library type" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="ALL">All types</option>
              {Object.entries(labels).map(([v, t]) => (
                <option key={v} value={v}>
                  {v === "ASSEMBLY" ? "Assemblies" : `${t}s`}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {view === "COLLECTIONS" && (
        <label>
          Collection
          <select aria-label="Collection" value={collection} onChange={(e) => setCollection(e.target.value)}>
            <option value="">All collections</option>
            {collections.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
      )}
      {view === "LEGACY_REVIEW" && (
        <p>
          These older drafts have no explicit Library save. Keep them as drafts, save them deliberately, or archive
          them. Nothing has been merged or deleted.
        </p>
      )}
      <small>
        {filtered.length} {filtered.length === 1 ? "definition" : "definitions"}
      </small>
      {!filtered.length && (
        <p>
          {view === "SAVED"
            ? "Save to Library when you want to reuse a working draft."
            : "No definitions match this view."}
        </p>
      )}
      {filtered.map((entry) => {
        const actions = [
          {
            label: entry.archived ? "Restore" : "Edit original",
            icon: "inspect" as const,
            disabled: busy,
            run: () => (entry.archived ? onArchive(entry, false) : onOpen(entry)),
          },
          ...(!entry.archived
            ? [
                {
                  label: "Save as new…",
                  icon: "copy" as const,
                  disabled: busy,
                  run: () => onManage({ entry, mode: "SAVE_AS" }),
                },
                {
                  label: "Organize…",
                  icon: "rename" as const,
                  disabled: busy,
                  run: () => onManage({ entry, mode: "METADATA" }),
                },
                {
                  label: "Version history",
                  icon: "undo" as const,
                  disabled: busy,
                  run: () => onManage({ entry, mode: "VERSIONS" }),
                },
                {
                  label: "Archive",
                  icon: "archive" as const,
                  disabled: busy || entry.id === currentId,
                  run: () => onArchive(entry, true),
                },
              ]
            : []),
        ];
        return (
          <article
            key={entry.id}
            className={styles.savedDefinition}
            aria-label={`${labels[entry.type]}: ${entry.name}`}
            onContextMenu={(e) => menu.open(e, entry.name, actions)}
            onKeyDown={(e) => menu.open(e, entry.name, actions)}
          >
            <div className={styles.savedDefinitionTop}>
              <small>
                {labels[entry.type]} ·{" "}
                {entry.archived
                  ? "Archived"
                  : entry.state === "WORKING"
                    ? "Working draft"
                    : entry.state === "LEGACY_REVIEW"
                      ? "Legacy draft"
                      : "Saved"}
              </small>
              <button
                title="Definition actions"
                aria-label={`Actions for ${entry.name}`}
                onClick={(e) => menu.open(e, entry.name, actions)}
              >
                <StudioIcon name="menu" />
              </button>
            </div>
            {entry.scene ? (
              <DefinitionPreview content={entry.scene.draft.content} />
            ) : (
              <svg
                className={styles.environmentArt}
                viewBox="0 0 160 90"
                role="img"
                aria-label={`${entry.name}: room plan`}
              >
                <rect x="10" y="10" width="140" height="70" fill="var(--studio-raised)" stroke="var(--studio-accent)" />
                {entry.environment?.draft.room?.features
                  .filter((f) => !["FLOOR", "CEILING", "WALL"].includes(f.classification))
                  .map((f) => (
                    <rect
                      key={f.id}
                      x={-f.dimensions[0] * 5}
                      y={-f.dimensions[2] * 5}
                      width={f.dimensions[0] * 10}
                      height={f.dimensions[2] * 10}
                      transform={`translate(${80 + f.position.x * 10} ${45 + f.position.z * 10}) rotate(${-f.yawDegrees})`}
                      fill="var(--studio-selected)"
                      stroke="var(--studio-muted)"
                    />
                  ))}
              </svg>
            )}
            <button
              className={styles.savedDefinitionName}
              disabled={busy || entry.archived}
              onClick={() => onOpen(entry)}
            >
              {entry.favorite ? "★ " : ""}
              {entry.name}
              {entry.id === currentId && <small> · Open</small>}
            </button>
            {entry.description && <p>{entry.description}</p>}
            {entry.scene?.draft.content.studio?.libraryDefinition?.classification && (
              <small>{entry.scene.draft.content.studio.libraryDefinition.classification}</small>
            )}
            <small>
              {entry.collection || "Unfiled"} · {entry.usageCount} uses ·{" "}
              {new Date(entry.updatedAt).toLocaleDateString()}
            </small>
            {!entry.archived &&
              entry.state === "SAVED" &&
              ["ASSET", "ASSEMBLY", "ENVIRONMENT"].includes(entry.type) && (
                <label>
                  Use version
                  <select
                    aria-label={`Use version of ${entry.name}`}
                    value={
                      chosenVersions[entry.id] ?? (entry.environment ? "WORKING" : (entry.scene?.releases[0]?.id ?? ""))
                    }
                    onChange={(e) => setChosenVersions({ ...chosenVersions, [entry.id]: e.target.value })}
                  >
                    {entry.environment && <option value="WORKING">Current working snapshot</option>}
                    {entry.environment
                      ? entry.environment.releases.map((v) => (
                          <option value={v.id} key={v.id}>
                            Version {v.number}
                          </option>
                        ))
                      : entry.scene?.releases.map((v) => (
                          <option value={v.id} key={v.id}>
                            Version {v.semanticVersion}
                          </option>
                        ))}
                  </select>
                </label>
              )}
            <div className={styles.inline}>
              {!entry.archived && entry.state !== "SAVED" ? (
                <button disabled={busy} onClick={() => onSave(entry)}>
                  Save to Library
                </button>
              ) : !entry.archived &&
                (entry.type === "ENVIRONMENT" || entry.type === "ASSET" || entry.type === "ASSEMBLY") ? (
                <button
                  disabled={busy || (entry.type !== "ENVIRONMENT" && !entry.scene?.releases.length)}
                  onClick={() =>
                    onUse(
                      entry,
                      chosenVersions[entry.id] === "WORKING"
                        ? undefined
                        : (chosenVersions[entry.id] ?? (entry.environment ? undefined : entry.scene?.releases[0]?.id)),
                    )
                  }
                >
                  Use in current scene
                </button>
              ) : null}
              <button
                disabled={busy}
                onClick={() => (entry.archived ? onArchive(entry, false) : onManage({ entry, mode: "VERSIONS" }))}
              >
                {entry.archived ? "Restore" : "Versions"}
              </button>
            </div>
          </article>
        );
      })}
      {menu.menu}
    </section>
  );
}

type API = (input: Record<string, unknown>) => Promise<{ definitionId?: string }>;
export function LibraryManagementDialog({
  request,
  api,
  prepare,
  onChanged,
  onClose,
}: {
  request: LibraryDialogRequest;
  api: API;
  prepare: () => Promise<number>;
  onChanged: (id?: string) => Promise<void>;
  onClose: () => void;
}) {
  const { entry, mode } = request,
    dialog = useRef<HTMLDialogElement>(null),
    operation = useRef<{ payload: Record<string, unknown> } | null>(null);
  const historicalCopies = useRef(new Map<string, Record<string, unknown>>());
  const [operationStarted, setOperationStarted] = useState(false);
  const [copyOperationIds, setCopyOperationIds] = useState<Set<string>>(() => new Set());
  const [copyingVersion, setCopyingVersion] = useState<string | null>(null);
  const [historicalName, setHistoricalName] = useState("");
  const [name, setName] = useState(mode === "SAVE_AS" ? `${entry.name} copy` : entry.name),
    [description, setDescription] = useState(entry.description),
    [tags, setTags] = useState(entry.tags.join(", ")),
    [collection, setCollection] = useState(entry.collection),
    [favorite, setFavorite] = useState(entry.favorite),
    [type, setType] = useState<SpatialLibraryType>(request.targetType ?? entry.type),
    [destination, setDestination] = useState("SAVED"),
    [notes, setNotes] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const element = dialog.current;
    element?.showModal();
    return () => {
      element?.close();
      previous?.focus();
    };
  }, []);
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (c) {
      setError(c instanceof Error ? c.message : "The operation could not finish. Your definition is unchanged.");
    } finally {
      setBusy(false);
    }
  };
  const versions = entry.environment
    ? entry.environment.releases.map((v) => ({
        id: v.id,
        label: `Version ${v.number}`,
        date: v.createdAt,
        notes: v.notes,
        uses: v.usageCount,
        draft: environmentPreviewDraft(v.content),
      }))
    : entry.scene!.releases.map((v) => ({
        id: v.id,
        label: `Version ${v.semanticVersion}`,
        date: entry.scene!.releaseMetadata?.find((m) => m.id === v.id)?.createdAt,
        notes: entry.scene!.releaseMetadata?.find((m) => m.id === v.id)?.notes,
        uses: entry.scene!.releaseMetadata?.find((m) => m.id === v.id)?.usageCount ?? 0,
        draft: {
          ...entry.scene!.draft,
          content: (({ checksum: _checksum, ...content }) => {
            void _checksum;
            return content;
          })(v),
        },
      }));
  const shown = versions.find((v) => v.id === preview);
  return (
    <dialog
      ref={dialog}
      className={styles.groupDialog}
      aria-label={
        mode === "SAVE_AS" ? "Save as new definition" : mode === "METADATA" ? "Organize definition" : "Version history"
      }
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
    >
      <header className={styles.environmentLibraryHeader}>
        <div>
          <small>
            {labels[entry.type]} / {entry.name}
          </small>
          <h2>{mode === "SAVE_AS" ? "Save as new" : mode === "METADATA" ? "Organize" : "Version history"}</h2>
        </div>
        <button aria-label="Close Library dialog" disabled={busy} onClick={onClose}>
          ×
        </button>
      </header>
      {error && <p role="alert">{error}</p>}
      {mode !== "VERSIONS" ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              const revision = await prepare();
              if (mode === "SAVE_AS") {
                operation.current ??= {
                  payload: {
                    action: "SAVE_AS",
                    definitionId: entry.id,
                    revision,
                    newId: crypto.randomUUID(),
                    operationId: crypto.randomUUID(),
                    name,
                    destination,
                    type,
                    ...(request.retainedSnapshot ? { retainedSnapshot: request.retainedSnapshot } : {}),
                  },
                };
                setOperationStarted(true);
                const result = await api(operation.current.payload);
                await onChanged(result.definitionId);
              } else {
                await api({
                  action: "LIBRARY_METADATA",
                  definitionId: entry.id,
                  revision,
                  change: {
                    name,
                    description,
                    tags: tags
                      .split(",")
                      .map((t) => t.trim())
                      .filter(Boolean),
                    collection,
                    favorite,
                  },
                });
                await onChanged();
              }
              onClose();
            });
          }}
        >
          <label>
            Name
            <input
              required
              maxLength={120}
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={operationStarted}
            />
          </label>
          {mode === "SAVE_AS" ? (
            <>
              {request.guidance && <p>{request.guidance}</p>}
              <p>
                An independent definition with its own working history. The original and its placed instances stay
                unchanged.
              </p>
              <label>
                Type
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as SpatialLibraryType)}
                  disabled={operationStarted}
                >
                  {(request.targetType
                    ? [request.targetType]
                    : entry.type === "ENVIRONMENT"
                      ? ["ENVIRONMENT"]
                      : entry.type === "ASSET" || entry.type === "ASSEMBLY"
                        ? [entry.type]
                        : [
                            "SCENE",
                            "TEMPLATE",
                            ...(entry.scene?.draft.content.studio?.environment ? ["ENVIRONMENT"] : []),
                          ]
                  ).map((t) => (
                    <option key={t} value={t}>
                      {labels[t as SpatialLibraryType]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Destination
                <select
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  disabled={operationStarted}
                >
                  <option value="SAVED">Library</option>
                  <option value="WORKING">Working Drafts</option>
                </select>
              </label>
            </>
          ) : (
            <>
              <label>
                Description
                <textarea maxLength={1000} value={description} onChange={(e) => setDescription(e.target.value)} />
              </label>
              <label>
                Tags · comma separated
                <input value={tags} onChange={(e) => setTags(e.target.value)} />
              </label>
              <label>
                Collection
                <input maxLength={120} value={collection} onChange={(e) => setCollection(e.target.value)} />
              </label>
              <label>
                <input type="checkbox" checked={favorite} onChange={(e) => setFavorite(e.target.checked)} /> Favorite
              </label>
            </>
          )}
          <button type="submit" disabled={busy}>
            {busy ? "Saving…" : mode === "SAVE_AS" ? "Create independent definition" : "Save details"}
          </button>
        </form>
      ) : (
        <>
          <p>
            Working edits autosave in place. Versions freeze a snapshot; restoring one changes only the working draft.
          </p>
          <label>
            Version notes
            <textarea maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
          <button
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await api({
                  action: entry.environment ? "ENVIRONMENT_RELEASE" : "RELEASE",
                  definitionId: entry.id,
                  revision: await prepare(),
                  notes,
                });
                await onChanged();
                onClose();
              })
            }
          >
            Create immutable version
          </button>
          <div className={styles.versionList}>
            <article>
              <strong>Working draft · current</strong>
              <small>Modified {new Date(entry.updatedAt).toLocaleString()}</small>
            </article>
            {versions.map((v) => (
              <article key={v.id}>
                <strong>{v.label}</strong>
                <small>
                  {v.date ? new Date(v.date).toLocaleString() : "Historical snapshot"} · {v.uses} pinned uses
                </small>
                {v.notes && <p>{v.notes}</p>}
                <div className={styles.inline}>
                  <button disabled={busy} onClick={() => setPreview(v.id)}>
                    Preview
                  </button>
                  <button
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await api({
                          action: "VERSION_RESTORE",
                          definitionId: entry.id,
                          revision: await prepare(),
                          versionId: v.id,
                        });
                        await onChanged();
                        onClose();
                      })
                    }
                  >
                    Restore to working draft
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => {
                      setCopyingVersion(v.id);
                      setHistoricalName(String(historicalCopies.current.get(v.id)?.name ?? `${entry.name} ${v.label}`));
                    }}
                  >
                    Copy this version
                  </button>
                </div>
                {copyingVersion === v.id && (
                  <form
                    aria-label={`Copy ${v.label}`}
                    onSubmit={(event) => {
                      event.preventDefault();
                      void run(async () => {
                        let payload = historicalCopies.current.get(v.id);
                        if (!payload) {
                          payload = {
                            action: "SAVE_AS",
                            definitionId: entry.id,
                            revision: await prepare(),
                            newId: crypto.randomUUID(),
                            operationId: crypto.randomUUID(),
                            name: historicalName,
                            destination: "WORKING",
                            type: entry.type,
                            versionId: v.id,
                          };
                          historicalCopies.current.set(v.id, payload);
                          setCopyOperationIds((previous) => new Set(previous).add(v.id));
                        }
                        const result = await api(payload);
                        await onChanged(result.definitionId);
                        onClose();
                      });
                    }}
                  >
                    <label>
                      New definition name
                      <input
                        required
                        maxLength={120}
                        value={historicalName}
                        disabled={copyOperationIds.has(v.id)}
                        onChange={(event) => setHistoricalName(event.target.value)}
                      />
                    </label>
                    <small>Independent working draft from {v.label}. Retrying keeps this copy identity.</small>
                    <div className={styles.inline}>
                      <button type="submit" disabled={busy}>
                        Create version copy
                      </button>
                      <button type="button" disabled={busy} onClick={() => setCopyingVersion(null)}>
                        Cancel copy
                      </button>
                    </div>
                  </form>
                )}
              </article>
            ))}
          </div>
          {shown && (
            <div className={styles.versionPreview}>
              <h3>{shown.label} · read only</h3>
              <SpatialCanvas
                draft={shown.draft}
                selectedId={null}
                onSelect={() => {}}
                onEdit={() => {}}
                onPreset={() => {}}
                mode="GUIDED"
                preview="EDITOR"
                previewOnly
                environmentId={shown.draft.content.studio?.environment?.id ?? "bedroom"}
                timeMs={0}
                inputs={[]}
              />
            </div>
          )}
        </>
      )}
    </dialog>
  );
}
