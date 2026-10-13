"use client";
import { useEffect, useRef, useState } from "react";
import type { SpatialDraft } from "@/parallax/authoring";
import { groupMemberKey, type EditingGroup, type EditingGroupMember } from "@/parallax/editing-group-contracts";
import { SceneGraphRename } from "./SceneGraphRename";
import { StudioIcon, useStudioContextMenu, type StudioMenuAction } from "./StudioContextMenu";
import styles from "./SpatialStudio.module.css";
import { identityTransform, type Transform } from "@/parallax/contracts";

export type SelectionModifiers = { additive?: boolean; range?: boolean; individual?: boolean };
export const selectionModifiers = (event: {
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey?: boolean;
}): SelectionModifiers => ({
  additive: event.ctrlKey || event.metaKey,
  range: event.shiftKey,
  individual: event.altKey,
});

export function GroupSelectionInspector({
  name,
  count,
  pivot,
  disabled,
  locked,
  members,
  onSelectMember,
  automatic,
  hasRoomFeatures,
  onTransform,
  onGroup,
  onEditMembers,
  onUngroup,
}: {
  name: string;
  count: number;
  pivot: Transform["position"];
  disabled: boolean;
  locked: boolean;
  members: readonly (EditingGroupMember & { name: string })[];
  onSelectMember: (member: EditingGroupMember) => void;
  automatic: boolean;
  hasRoomFeatures: boolean;
  onTransform: (delta: Transform) => void;
  onGroup: () => void;
  onEditMembers?: () => void;
  onUngroup?: () => void;
}) {
  const [yaw, setYaw] = useState("0"),
    [scale, setScale] = useState("1");
  const [error, setError] = useState<string | null>(null);
  const run = (delta: Transform) => {
    try {
      onTransform(delta);
      setError(null);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Review this transform.");
      return false;
    }
  };
  return (
    <section className={styles.groupInspector} aria-label="Group inspector">
      <h3>{name}</h3>
      <p>{count} items selected. Move, rotate and scale them together using the viewport tools or these controls.</p>
      {automatic && (
        <p>Automatic placement owns these asset positions. Switch to Manual placement to transform this selection.</p>
      )}
      {hasRoomFeatures && <p>Room features stay upright: rotation uses the Y axis, and scale is uniform.</p>}
      {locked && <p>Unlock the selected assets before transforming the group.</p>}
      {error && <p role="alert">{error}</p>}
      <fieldset disabled={disabled || automatic || locked}>
        <legend>Selection center</legend>
        <div className={styles.groupVector}>
          {(["x", "y", "z"] as const).map((axis) => (
            <label key={`${axis}:${pivot[axis]}`}>
              {axis.toUpperCase()}
              <input
                aria-label={`Group ${axis.toUpperCase()}`}
                type="number"
                step="0.05"
                defaultValue={Number(pivot[axis].toFixed(4))}
                onBlur={(event) => {
                  const value = Number(event.target.value);
                  if (!event.target.value.trim() || !Number.isFinite(value)) {
                    setError("Enter a finite selection center.");
                    return;
                  }
                  if (event.target.value.trim() && Number.isFinite(value) && value !== Number(pivot[axis].toFixed(4)))
                    run({
                      ...identityTransform(),
                      position: {
                        x: axis === "x" ? value - pivot.x : 0,
                        y: axis === "y" ? value - pivot.y : 0,
                        z: axis === "z" ? value - pivot.z : 0,
                      },
                    });
                }}
              />
            </label>
          ))}
        </div>
        <label>
          Rotation delta (°)
          <input
            aria-label="Group rotation delta"
            type="number"
            step="15"
            value={yaw}
            onChange={(event) => setYaw(event.target.value)}
          />
        </label>
        <label>
          Scale factor
          <input
            aria-label="Group scale factor"
            type="number"
            min="0.01"
            max="10"
            step="0.05"
            value={scale}
            onChange={(event) => setScale(event.target.value)}
          />
        </label>
        <button
          type="button"
          onClick={() => {
            if (
              !yaw.trim() ||
              !scale.trim() ||
              !Number.isFinite(Number(yaw)) ||
              !Number.isFinite(Number(scale)) ||
              Number(scale) < 0.01 ||
              Number(scale) > 10
            ) {
              setError("Enter a finite rotation and a scale factor between 0.01 and 10.");
              return;
            }
            const angle = (Number(yaw) * Math.PI) / 360;
            const applied = run({
              ...identityTransform(),
              rotation: { x: 0, y: Math.sin(angle), z: 0, w: Math.cos(angle) },
              scale: Number(scale),
            });
            if (applied) {
              setYaw("0");
              setScale("1");
            }
          }}
        >
          Apply rotation and scale
        </button>
      </fieldset>
      <div className={styles.groupActions}>
        {onEditMembers ? (
          <button type="button" disabled={disabled} onClick={onEditMembers}>
            Edit members &amp; name
          </button>
        ) : (
          <button type="button" disabled={disabled} onClick={onGroup}>
            Group selection
          </button>
        )}
        {onUngroup && (
          <button type="button" disabled={disabled} onClick={onUngroup}>
            Ungroup items
          </button>
        )}
      </div>
      <details>
        <summary>Members · {members.length}</summary>
        <p>Select a member to inspect it individually.</p>
        <ul>
          {members.map((member) => (
            <li key={groupMemberKey(member)}>
              <button type="button" onClick={() => onSelectMember(member)}>
                {member.name}
              </button>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}

export function SceneGroups({
  groups,
  members,
  query,
  disabled,
  onSelect,
  onSave,
  actions,
}: {
  groups: readonly EditingGroup[];
  members: readonly EditingGroupMember[];
  query: string;
  disabled: boolean;
  onSelect: (group: EditingGroup, modifiers?: SelectionModifiers) => void;
  onSave: (group: EditingGroup) => void;
  actions: (group: EditingGroup) => StudioMenuAction[];
}) {
  const [rename, setRename] = useState<string | null>(null);
  const menu = useStudioContextMenu();
  const keys = new Set(members.map(groupMemberKey));
  const rows = groups.filter((group) => group.name.toLowerCase().includes(query.toLowerCase()));
  return (
    <section aria-label="Scene groupings">
      {groups.length === 0 && (
        <p>No groups yet. Select items and use Group, or create a group to choose its members.</p>
      )}
      {groups.length > 0 && rows.length === 0 && <p>No matching groups.</p>}
      <ul className={styles.groupRows}>
        {rows.map((group) => (
          <li key={group.id}>
            {rename === group.id ? (
              <SceneGraphRename
                name={group.name}
                onCancel={() => setRename(null)}
                onCommit={(name) => {
                  onSave({ ...group, name });
                  setRename(null);
                }}
              />
            ) : (
              <button
                type="button"
                data-graph-group={group.id}
                aria-pressed={group.members.every((member) => keys.has(groupMemberKey(member)))}
                onClick={(event) => onSelect(group, selectionModifiers(event))}
                onKeyDown={(event) => {
                  if (event.key === "F2" && !disabled) {
                    event.preventDefault();
                    setRename(group.id);
                  }
                  if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
                    onSelect(group);
                    menu.open(event, group.name, actions(group));
                  }
                  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                    event.preventDefault();
                    const target =
                      event.key === "ArrowDown"
                        ? event.currentTarget.closest("li")?.nextElementSibling
                        : event.currentTarget.closest("li")?.previousElementSibling;
                    const button = target?.querySelector<HTMLButtonElement>("button");
                    button?.focus();
                    const next = rows.find((row) => row.id === button?.dataset.graphGroup);
                    if (next && event.shiftKey) onSelect(next, { range: true });
                  }
                  if (event.key === " " && (event.ctrlKey || event.metaKey || event.shiftKey)) {
                    event.preventDefault();
                    onSelect(group, selectionModifiers(event));
                  }
                }}
                onContextMenu={(event) => {
                  onSelect(group);
                  menu.open(event, group.name, actions(group));
                }}
              >
                <StudioIcon name="group" />
                <span className={styles.graphAssetName}>
                  <span
                    title="Click to rename; F2 also renames"
                    onClick={(event) => {
                      if (!disabled && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
                        event.stopPropagation();
                        setRename(group.id);
                      }
                    }}
                  >
                    {group.name}
                  </span>
                  <small>{group.members.length} items</small>
                </span>
              </button>
            )}
          </li>
        ))}
      </ul>
      {menu.menu}
    </section>
  );
}

export function GroupMembershipDialog({
  draft,
  group,
  creating,
  onSave,
  onCancel,
}: {
  draft: SpatialDraft;
  group: EditingGroup;
  creating: boolean;
  onSave: (group: EditingGroup) => void;
  onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState(group.name);
  const [members, setMembers] = useState(group.members);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const element = dialog.current;
    if (element?.showModal) element.showModal();
    else element?.setAttribute("open", "");
    return () => {
      if (element?.open && element.close) element.close();
    };
  }, []);
  const keys = new Set(members.map(groupMemberKey));
  const rows: { kind: EditingGroupMember["kind"]; id: string; name: string }[] = [
    ...draft.content.entities.map((entity) => ({ kind: "ASSET" as const, id: entity.id, name: entity.name })),
    ...(draft.content.studio?.environment?.features.map((feature) => ({
      kind: "ROOM_FEATURE" as const,
      id: feature.id,
      name: feature.name,
    })) ?? []),
  ];
  const toggle = (member: EditingGroupMember) =>
    setMembers((previous) =>
      previous.some((item) => groupMemberKey(item) === groupMemberKey(member))
        ? previous.filter((item) => groupMemberKey(item) !== groupMemberKey(member))
        : [...previous, member],
    );
  return (
    <dialog
      ref={dialog}
      aria-labelledby="group-membership-title"
      className={styles.groupDialog}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim() && members.length >= (creating ? 2 : 1)) {
            try {
              onSave({ ...group, name: name.trim(), members });
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : "The group could not be saved.");
            }
          }
        }}
      >
        <h2 id="group-membership-title">{creating ? "Create group" : "Edit group members"}</h2>
        {error && <p role="alert">{error}</p>}
        <label>
          Group name
          <input autoFocus value={name} maxLength={160} onChange={(event) => setName(event.target.value)} />
        </label>
        <p>{members.length} selected · items keep their positions and existing attachments.</p>
        <div className={styles.groupMemberLists}>
          {(["ASSET", "ROOM_FEATURE"] as const).map((kind) => (
            <fieldset key={kind}>
              <legend>{kind === "ASSET" ? "Assets" : "Room features"}</legend>
              <button
                type="button"
                onClick={() =>
                  setMembers((previous) => [
                    ...previous.filter((member) => member.kind !== kind),
                    ...rows.filter((row) => row.kind === kind).map(({ id }) => ({ kind, id })),
                  ])
                }
              >
                Select all {kind === "ASSET" ? "assets" : "room features"}
              </button>
              {rows
                .filter((row) => row.kind === kind)
                .map((row) => (
                  <label key={row.id}>
                    <input
                      type="checkbox"
                      checked={keys.has(groupMemberKey(row))}
                      onChange={() => toggle({ kind: row.kind, id: row.id })}
                    />
                    {row.name}
                  </label>
                ))}
              {!rows.some((row) => row.kind === kind) && (
                <p>
                  {kind === "ROOM_FEATURE"
                    ? "Turn on environment editing to add an editable room, then include its features."
                    : "No assets."}
                </p>
              )}
            </fieldset>
          ))}
        </div>
        <p>Regrouping moves selected items out of their previous groups. Undo remains available.</p>
        <footer>
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" onClick={() => setMembers([])}>
            Clear selection
          </button>
          <button type="submit" disabled={!name.trim() || members.length < (creating ? 2 : 1)}>
            Save group
          </button>
        </footer>
      </form>
    </dialog>
  );
}
