"use client";
import { useState } from "react";
import type { SpatialLibraryRecord } from "@/parallax/library-service";
import type { RoomEnvironment } from "@/parallax/environment-contracts";
import { SceneGraphRename } from "./SceneGraphRename";
import { StudioIcon, useStudioContextMenu } from "./StudioContextMenu";
import styles from "./SpatialStudio.module.css";

function RoomPlan({ room }: { room: RoomEnvironment }) {
  return (
    <svg
      role="img"
      aria-label={`${room.name}: schematic floor plan`}
      viewBox={`0 0 ${room.width} ${room.depth}`}
      className={styles.environmentArt}
    >
      <rect width={room.width} height={room.depth} fill="var(--studio-background)" />
      {room.features
        .filter((feature) => !["FLOOR", "CEILING"].includes(feature.classification))
        .map((feature) => (
          <rect
            key={feature.id}
            x={-feature.dimensions[0] / 2}
            y={-feature.dimensions[2] / 2}
            width={feature.dimensions[0]}
            height={feature.dimensions[2]}
            transform={`translate(${feature.position.x + room.width / 2} ${feature.position.z + room.depth / 2}) rotate(${-feature.yawDegrees})`}
            fill={feature.classification === "WALL" ? "var(--studio-muted)" : "var(--studio-selected)"}
            stroke="var(--studio-accent)"
            strokeWidth={Math.max(room.width, room.depth) / 180}
          />
        ))}
    </svg>
  );
}

export function EnvironmentLibrary({
  items,
  busy,
  onApply,
  onEdit,
  onRename,
  onArchive,
}: {
  items: SpatialLibraryRecord[];
  busy: boolean;
  onApply: (item: SpatialLibraryRecord) => void;
  onEdit: (item: SpatialLibraryRecord) => void;
  onRename: (item: SpatialLibraryRecord, name: string) => void;
  onArchive: (item: SpatialLibraryRecord) => void;
}) {
  const [query, setQuery] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const context = useStudioContextMenu();
  const entries = items.filter(
    (item) =>
      item.draft.content.studio?.environment &&
      !item.draft.content.studio.environmentLibraryArchived &&
      !item.draft.content.studio.libraryDefinition,
  );
  const visible = entries.filter((item) =>
    `${item.draft.content.studio!.environment!.name} ${item.draft.content.title}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <section aria-label="Environment Library">
      <label>
        Find environment
        <input
          aria-label="Find environment"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <p className={styles.dockHelp}>
        Edited and reconstructed rooms appear here automatically. Scene copies keep their own geometry.
      </p>
      {!entries.length && <p>Edit a room or reconstruct one from photos to add your first environment.</p>}
      {entries.length > 0 && !visible.length && <p>No matching environments.</p>}
      <div className={styles.environmentEntries}>
        {visible.map((item) => {
          const room = item.draft.content.studio!.environment!;
          const actions = [
            { label: "Use environment", icon: "frame" as const, disabled: busy, run: () => onApply(item) },
            { label: "Edit environment", icon: "inspect" as const, disabled: busy, run: () => onEdit(item) },
            { label: "Rename environment", icon: "rename" as const, disabled: busy, run: () => setRenaming(item.id) },
            { label: "Delete from Library", icon: "trash" as const, disabled: busy, run: () => onArchive(item) },
          ];
          return (
            <article
              key={item.id}
              aria-label={`Environment ${room.name}`}
              tabIndex={0}
              onContextMenu={(event) => context.open(event, room.name, actions)}
              onKeyDown={(event) => {
                if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10"))
                  context.open(event, room.name, actions);
              }}
            >
              <RoomPlan room={room} />
              {renaming === item.id ? (
                <SceneGraphRename
                  name={room.name}
                  maximumLength={120}
                  onCancel={() => setRenaming(null)}
                  onCommit={(name) => {
                    setRenaming(null);
                    onRename(item, name);
                  }}
                />
              ) : (
                <button
                  className={styles.environmentName}
                  disabled={busy}
                  title="Rename environment"
                  onClick={() => setRenaming(item.id)}
                >
                  {room.name}
                </button>
              )}
              <small>
                {room.features.length} features ·{" "}
                {room.origin === "PHOTO_RECONSTRUCTION" ? "From photos" : "Edited room"}
              </small>
              <small>Scene: {item.draft.content.title}</small>
              <div className={styles.environmentCommands}>
                <button disabled={busy} onClick={() => onApply(item)}>
                  Use environment
                </button>
                {actions.slice(1).map((action) => (
                  <button
                    key={action.label}
                    aria-label={action.label}
                    title={action.label}
                    disabled={busy}
                    onClick={action.run}
                  >
                    <StudioIcon name={action.icon} />
                  </button>
                ))}
              </div>
            </article>
          );
        })}
      </div>
      {context.menu}
    </section>
  );
}
