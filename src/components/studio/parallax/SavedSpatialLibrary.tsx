"use client";
import { useState } from "react";
import type { SpatialLibraryRecord } from "@/parallax/library-service";
import { spatialAssetBounds, spatialLibraryKind, type AssetMetadata } from "@/parallax/reusable-assets";
import { worldTransform, type DraftContent } from "@/parallax/authoring";
import { identityTransform } from "@/parallax/contracts";
import { composeTransform } from "@/parallax/transforms";
import { useStudioContextMenu, StudioIcon, type StudioMenuAction } from "./StudioContextMenu";
import styles from "./SpatialStudio.module.css";

const labels = {
  SCENES: "Saved scene",
  ASSETS: "Reusable object",
  ASSEMBLIES: "Reusable assembly",
  TEMPLATES: "Scene template",
  ROOMS: "Reconstructed room",
  IMPORTED: "Scene with imported model",
};

/** Schematic comes from the saved entity poses, rather than a title-based placeholder. */
export function DefinitionPreview({ content }: { content: DraftContent }) {
  const polygons = content.entities.map((entity) => {
    const pose = worldTransform(content, entity.id);
    return {
      entity,
      points: [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ].map(([x, y]) => {
        const p = composeTransform(pose, {
          ...identityTransform(),
          position: { x: (x * entity.widthMeters) / 2, y: y * entity.widthMeters * 0.375, z: 0 },
        }).position;
        return [p.x + p.z * 0.4, -p.y + p.z * 0.3];
      }),
    };
  });
  const all = polygons.flatMap((p) => p.points),
    minX = Math.min(...all.map((p) => p[0])),
    minY = Math.min(...all.map((p) => p[1]));
  const width = Math.max(0.02, Math.max(...all.map((p) => p[0])) - minX),
    height = Math.max(0.02, Math.max(...all.map((p) => p[1])) - minY);
  const scale = Math.min(140 / width, 66 / height);
  return (
    <svg
      viewBox="0 0 180 90"
      className={styles.assetArt}
      role="img"
      aria-label={`${content.title}: schematic of ${content.entities.length} saved objects`}
    >
      <rect width="180" height="90" rx="6" fill="var(--studio-background)" />
      {polygons.map(({ entity, points }) => (
        <polygon
          key={entity.id}
          points={points
            .map(([x, y]) => `${90 + (x - minX - width / 2) * scale},${45 + (y - minY - height / 2) * scale}`)
            .join(" ")}
          fill={entity.kind === "PARCHMENT" ? "#d7cbae" : entity.kind === "MARKER" ? "#709ccc" : "#516a88"}
          stroke="var(--studio-accent)"
          strokeWidth="1.5"
        />
      ))}
    </svg>
  );
}

export function SaveSpatialAsset({
  name,
  busy,
  onSave,
}: {
  name: string;
  busy: boolean;
  onSave: (metadata: AssetMetadata) => Promise<void>;
}) {
  const [assetName, setAssetName] = useState(name),
    [description, setDescription] = useState(""),
    [classification, setClassification] = useState("Clue");
  return (
    <form
      aria-label="Save reusable asset"
      onSubmit={(e) => {
        e.preventDefault();
        void onSave({ name: assetName, description, classification });
      }}
    >
      <p>
        Save this object and its grouped children as a separate definition. Later instance edits affect only their
        scene.
      </p>
      <label>
        Asset name
        <input required maxLength={240} value={assetName} onChange={(e) => setAssetName(e.target.value)} />
      </label>
      <label>
        Asset description
        <textarea maxLength={1000} value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <label>
        Asset classification
        <input required maxLength={60} value={classification} onChange={(e) => setClassification(e.target.value)} />
      </label>
      <button type="submit" disabled={busy || !assetName.trim() || !classification.trim()}>
        Save selected object as reusable asset
      </button>
    </form>
  );
}

export function SavedSpatialLibrary({
  items,
  busy,
  chronicleId,
  currentId,
  onOpen,
  onInsert,
  onDuplicate,
  onArchive,
}: {
  items: SpatialLibraryRecord[];
  busy: boolean;
  chronicleId?: string;
  currentId: string;
  onOpen: (item: SpatialLibraryRecord) => void;
  onInsert: (item: SpatialLibraryRecord, versionId: string) => void;
  onDuplicate: (item: SpatialLibraryRecord) => void;
  onArchive: (item: SpatialLibraryRecord) => void;
}) {
  const contextMenu = useStudioContextMenu();
  const [query, setQuery] = useState(""),
    [scope, setScope] = useState("ALL"),
    [kind, setKind] = useState("ALL");
  const filtered = items
    .filter(
      (i) =>
        (i.draft.scope === "MY_LIBRARY" || i.draft.chronicleId === (chronicleId ?? null)) &&
        (scope !== "FAVORITES" || i.draft.favorite) &&
        (scope !== "MY_LIBRARY" || i.draft.scope === "MY_LIBRARY") &&
        (kind === "ALL" || kind === "RECENT" || kind === spatialLibraryKind(i.draft)) &&
        `${i.draft.content.title} ${i.draft.tags.join(" ")} ${i.draft.content.studio?.libraryDefinition?.description ?? ""} ${i.draft.content.studio?.libraryDefinition?.classification ?? ""}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .slice(0, kind === "RECENT" ? 8 : undefined);
  return (
    <section aria-label="Saved spatial definitions">
      <h3>Saved Spatial Library · {filtered.length}</h3>
      <p>Open complete scenes, or add a copy of a released object to your current scene.</p>
      <label>
        Search Library
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Name, description, classification or tag"
        />
      </label>
      <select aria-label="Library scope" value={scope} onChange={(e) => setScope(e.target.value)}>
        <option value="ALL">All owned items</option>
        <option value="MY_LIBRARY">My Spatial Library</option>
        <option value="FAVORITES">Favorites</option>
      </select>
      <label>
        Item type
        <select aria-label="Saved item type" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="ALL">All types</option>
          {Object.entries(labels).map(([key, label]) => (
            <option value={key} key={key}>
              {label}
            </option>
          ))}
          <option value="RECENT">Recently saved</option>
        </select>
      </label>
      {!filtered.length && <p>No saved items match. Save a scene or a selected reusable object to begin.</p>}
      {filtered.map((item) => {
        const type = spatialLibraryKind(item.draft),
          definition = item.draft.content.studio?.libraryDefinition,
          bounds = definition ? spatialAssetBounds(item.draft.content).dimensions : null;
        const latest = item.releases[0];
        const actions: StudioMenuAction[] = [
          { label: "Open definition", icon: "inspect", disabled: busy, run: () => onOpen(item) },
          ...(definition
            ? [
                {
                  label: "Add to current scene",
                  icon: "plus" as const,
                  disabled: busy || !latest,
                  run: () => latest && onInsert(item, latest.id),
                },
              ]
            : [
                {
                  label: "Create new scene from this",
                  icon: "copy" as const,
                  disabled: busy,
                  run: () => onDuplicate(item),
                },
              ]),
          { label: "Archive", icon: "archive", disabled: busy || item.id === currentId, run: () => onArchive(item) },
        ];
        return (
          <article
            className={styles.savedDefinition}
            aria-label={`${labels[type]}: ${item.draft.content.title}`}
            key={item.id}
            onContextMenu={(event) => contextMenu.open(event, item.draft.content.title, actions)}
            onKeyDown={(event) => contextMenu.open(event, item.draft.content.title, actions)}
          >
            <DefinitionPreview content={item.draft.content} />
            <button
              className={styles.savedMenuButton}
              aria-label={`Actions for ${item.draft.content.title}`}
              title="Item actions"
              onClick={(event) =>
                contextMenu.openAt(
                  event.currentTarget,
                  event.currentTarget.getBoundingClientRect().right,
                  event.currentTarget.getBoundingClientRect().bottom,
                  item.draft.content.title,
                  actions,
                )
              }
            >
              <StudioIcon name="menu" />
            </button>
            <button className={styles.libraryItem} disabled={busy} onClick={() => onOpen(item)}>
              <strong>{item.draft.content.title}</strong>
              <small>
                {item.draft.scope === "MY_LIBRARY" ? "My Library" : "Chronicle only"} · {item.releases.length} versions
                · {item.usageCount} Chronicle uses
              </small>
            </button>
            <small>
              {labels[type]} · {item.draft.content.entities.length} objects
              {item.id === currentId ? " · currently open" : ""}
            </small>
            {definition && (
              <>
                <p>{definition.description || "No description yet."}</p>
                <small>
                  {definition.classification} · {bounds!.map((n) => n.toFixed(2)).join(" × ")} m authored bounds ·
                  schematic preview
                </small>
              </>
            )}
            {!definition && (
              <small>
                {item.draft.content.studio?.environment?.name ?? "Synthetic preview environment"} · updated{" "}
                {new Date(item.updatedAt).toLocaleDateString()}
              </small>
            )}
            <div className={styles.inline}>
              {definition ? (
                <button
                  disabled={busy || !latest}
                  title={
                    latest
                      ? `Add pinned ${latest.semanticVersion}; definition stays unchanged`
                      : "Open the definition and create an immutable version first"
                  }
                  onClick={() => latest && onInsert(item, latest.id)}
                >
                  Add to current scene
                </button>
              ) : (
                <button disabled={busy} onClick={() => onDuplicate(item)}>
                  Create new scene from this
                </button>
              )}
              <button
                disabled={busy || item.id === currentId}
                title={
                  item.id === currentId
                    ? "Open another scene before archiving this definition"
                    : "Remove from Library; existing copies and released history stay intact"
                }
                onClick={() => onArchive(item)}
              >
                Archive
              </button>
            </div>
            {definition && (
              <small>
                Open to edit the definition; create a new version to reuse its changes. Existing copies stay
                independent.
              </small>
            )}
          </article>
        );
      })}
      <small>Imported models cannot be previewed in this editor.</small>
      {contextMenu.menu}
    </section>
  );
}
