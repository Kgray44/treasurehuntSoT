"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  environmentDraftSchema,
  type EnvironmentDraft,
  type EnvironmentLibraryRecord,
} from "@/parallax/library-lifecycle-contracts";
import { environmentPreviewDraft } from "@/parallax/environment-workspace";
import { transformEditingSelection } from "@/parallax/editing-groups";
import type { RoomPerceptionProposal } from "@/parallax/room-perception-service";
import { SpatialCanvas } from "./SpatialCanvas";
import { RoomEnvironmentEditor } from "./RoomEnvironmentEditor";
import { EnvironmentCreateDialog } from "./EnvironmentCreateDialog";
import { LibraryManagementDialog, libraryEntries, type LibraryDialogRequest } from "./SpatialLibrary";
import { journalWorking, readWorkingJournal, clearWorkingJournal } from "./working-recovery";
import styles from "./SpatialStudio.module.css";

export function EnvironmentDefinitionWorkspace({
  record,
  accountId,
  api,
  csrfToken,
  onClose,
  onRefresh,
  environments = [],
}: {
  record: EnvironmentLibraryRecord;
  accountId: string;
  api: (input: Record<string, unknown>) => Promise<any>;
  csrfToken: () => string;
  onClose: () => Promise<void>;
  onRefresh: () => Promise<EnvironmentLibraryRecord[]>;
  environments?: EnvironmentLibraryRecord[];
}) {
  const [document, setDocument] = useState(record.draft),
    [selected, setSelected] = useState<string | null>(null),
    [status, setStatus] = useState("Environment working draft"),
    [error, setError] = useState(""),
    [dialog, setDialog] = useState<LibraryDialogRequest | null>(null),
    [setup, setSetup] = useState(!record.draft.room),
    [currentRecord, setRecord] = useState(record),
    [recovery, setRecovery] = useState<
      (NonNullable<ReturnType<typeof readWorkingJournal>> & { server?: EnvironmentLibraryRecord }) | null
    >(null);
  const latest = useRef(document),
    revision = useRef(record.revision),
    saved = useRef(JSON.stringify(record.draft)),
    saving = useRef<Promise<void> | null>(null),
    generation = useRef(0),
    past = useRef<EnvironmentDraft[]>([]),
    future = useRef<EnvironmentDraft[]>([]);
  const update = useCallback(
    (next: EnvironmentDraft) => {
      const parsed = environmentDraftSchema.parse({
        ...next,
        room: next.room ? { ...next.room, name: next.name } : null,
      });
      past.current.push(latest.current);
      future.current = [];
      latest.current = parsed;
      generation.current++;
      journalWorking(accountId, parsed.id, parsed, revision.current);
      setDocument(parsed);
    },
    [accountId],
  );
  const travel = useCallback(
    (direction: "UNDO" | "REDO") => {
      const next = (direction === "UNDO" ? past.current : future.current).pop();
      if (!next) return;
      (direction === "UNDO" ? future.current : past.current).push(latest.current);
      latest.current = next;
      generation.current++;
      setDocument(next);
      journalWorking(accountId, next.id, next, revision.current);
    },
    [accountId],
  );
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (
        (event.target as HTMLElement)?.closest?.('input,textarea,select,dialog,[role="menu"],[contenteditable="true"]')
      )
        return;
      if ((event.ctrlKey || event.metaKey) && ["z", "y"].includes(event.key.toLowerCase())) {
        event.preventDefault();
        travel(event.shiftKey || event.key.toLowerCase() === "y" ? "REDO" : "UNDO");
      }
    };
    window.document.addEventListener("keydown", key);
    return () => window.document.removeEventListener("keydown", key);
  }, [travel]);
  const persist = useCallback(async () => {
    if (saving.current) return saving.current;
    const run = async () => {
      while (saved.current !== JSON.stringify(latest.current)) {
        const snapshot = latest.current;
        setStatus("Saving environment…");
        const result = await api({ action: "ENVIRONMENT_SAVE", document: snapshot, revision: revision.current });
        revision.current = result.revision;
        saved.current = JSON.stringify(snapshot);
        clearWorkingJournal(accountId, snapshot.id, snapshot);
        if (snapshot !== latest.current) journalWorking(accountId, snapshot.id, latest.current, revision.current);
      }
      setStatus("Working draft saved");
    };
    saving.current = run().finally(() => {
      saving.current = null;
    });
    return saving.current;
  }, [accountId, api]);
  const attempt = async (run: () => Promise<void>) => {
    setError("");
    try {
      await run();
    } catch (c) {
      setError(c instanceof Error ? c.message : "The change could not be saved.");
      setStatus("Unsaved changes · retry available");
    }
  };
  useEffect(() => {
    const found = readWorkingJournal(accountId, record.id);
    if (found && JSON.stringify(found.document) !== saved.current) setRecovery(found);
  }, [accountId, record.id]);
  useEffect(() => {
    if (recovery) return;
    const timer = setTimeout(
      () =>
        void persist().catch((c) => {
          setError(c.message);
          setStatus("Unsaved changes · retry available");
        }),
      800,
    );
    return () => clearTimeout(timer);
  }, [document, persist, recovery]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (saved.current !== JSON.stringify(latest.current)) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  const refresh = async (id?: string) => {
    const entries = await onRefresh();
    const found = entries.find((e) => e.id === (id ?? record.id));
    if (found && found.id === record.id) {
      revision.current = found.revision;
      saved.current = JSON.stringify(found.draft);
      if (JSON.stringify(latest.current) !== saved.current) {
        past.current.push(latest.current);
        future.current = [];
        latest.current = found.draft;
        setDocument(found.draft);
      }
      setRecord(found);
    } else if (id) {
      await onClose();
      window.location.assign(`/studio/parallax?environment=${encodeURIComponent(id)}`);
    }
  };
  const entry = libraryEntries([], [{ ...currentRecord, draft: document, revision: revision.current }])[0];
  const canvas = environmentPreviewDraft(document);
  const acknowledge = (next: EnvironmentDraft, nextRevision: number) => {
    past.current.push(latest.current);
    future.current = [];
    latest.current = next;
    revision.current = nextRevision;
    saved.current = JSON.stringify(next);
    generation.current++;
    setDocument(next);
    clearWorkingJournal(accountId, next.id, next);
  };
  return (
    <main className={styles.studio}>
      <header className={styles.header}>
        <div>
          <small>Parallax / Environment definition</small>
          <h1>{document.name}</h1>
          <span role="status">{status}</span>
        </div>
        <div className={styles.inline}>
          <button
            onClick={() =>
              void attempt(async () => {
                await persist();
                await onClose();
              })
            }
          >
            Back to scene
          </button>
          <button onClick={() => travel("UNDO")} disabled={!past.current.length}>
            Undo
          </button>
          <button onClick={() => travel("REDO")} disabled={!future.current.length}>
            Redo
          </button>
          <button
            onClick={() =>
              void attempt(async () => {
                await persist();
                const result = await api({
                  action: "SAVE_TO_LIBRARY",
                  definitionId: document.id,
                  revision: revision.current,
                });
                revision.current = result.revision;
                await refresh();
                setStatus("Saved to Library · one environment definition");
              })
            }
          >
            Save to Library
          </button>
          <button
            onClick={() =>
              void attempt(async () => {
                await persist();
                setDialog({ entry: { ...entry, revision: revision.current }, mode: "SAVE_AS" });
              })
            }
          >
            Save as new…
          </button>
          <button
            onClick={() =>
              void attempt(async () => {
                await persist();
                setDialog({ entry: { ...entry, revision: revision.current }, mode: "VERSIONS" });
              })
            }
          >
            Versions
          </button>
        </div>
      </header>
      {error && (
        <div role="alert" className={styles.error}>
          {error}
          <button onClick={() => void attempt(persist)}>Retry save</button>
          <button
            onClick={() =>
              void attempt(async () => {
                const rows = await onRefresh();
                const row = rows.find((e) => e.id === document.id);
                if (row)
                  setRecovery({
                    document: latest.current,
                    revision: revision.current,
                    at: new Date().toISOString(),
                    server: row,
                  });
              })
            }
          >
            Review conflict
          </button>
        </div>
      )}
      {recovery && (
        <section className={styles.savedDefinition} aria-label="Environment recovery">
          <h2>Recover unsaved room edits</h2>
          <p>
            {recovery.revision === (recovery.server?.revision ?? revision.current)
              ? "Your browser retained edits that were not acknowledged by the server."
              : "Another editor changed this definition. Your unsaved room is retained separately; review it before applying."}
          </p>
          <button
            onClick={() => {
              if (!("format" in recovery.document)) return;
              setDialog({
                entry: { ...entry, revision: recovery.revision },
                mode: "SAVE_AS",
                retainedSnapshot: recovery.document,
              });
              setRecovery(null);
            }}
          >
            Preserve retained room as new…
          </button>
          <button
            onClick={() => {
              revision.current = recovery.revision;
              if (recovery.document && "format" in recovery.document) update(recovery.document);
              setRecovery(null);
            }}
          >
            Review my retained edits
          </button>
          <button
            onClick={() => {
              clearWorkingJournal(accountId, document.id, recovery.document);
              if (recovery.server) acknowledge(recovery.server.draft, recovery.server.revision);
              setRecovery(null);
            }}
          >
            Keep saved room
          </button>
          {recovery.revision !== revision.current && (
            <p>
              Save will still check the original revision. Reload the saved definition or deliberately Save as New to
              preserve an independent copy.
            </p>
          )}
        </section>
      )}
      <div className={styles.environmentWorkspace}>
        <section>
          {document.room ? (
            <SpatialCanvas
              draft={canvas}
              selectedId={null}
              onSelect={() => {}}
              selectionMembers={selected ? [{ kind: "ROOM_FEATURE", id: selected }] : []}
              environmentEditing
              environmentOnly
              selectedFeatureId={selected}
              onSelectFeature={setSelected}
              onEdit={(edit) => {
                if (edit.type === "REPLACE" && edit.draft.content.studio?.environment)
                  update({ ...latest.current, room: edit.draft.content.studio.environment });
              }}
              onTransformSelection={(delta, pivot) => {
                if (!selected) return;
                const next = transformEditingSelection(
                  canvas,
                  [{ kind: "ROOM_FEATURE", id: selected }],
                  delta,
                  document.room?.id,
                  pivot,
                );
                if (next.content.studio?.environment)
                  update({ ...latest.current, room: next.content.studio.environment });
              }}
              onPreset={() => {}}
              mode="GUIDED"
              preview="EDITOR"
              environmentId={document.room?.id ?? "bedroom"}
              timeMs={0}
              inputs={[]}
            />
          ) : (
            <div className={styles.savedDefinition}>
              <h2>Start your environment</h2>
              <p>
                This working definition has no room geometry yet. Add photos, choose a preset or create an empty room.
              </p>
              <button onClick={() => setSetup(true)}>Choose a starting point</button>
            </div>
          )}
        </section>
        <aside>
          <h2>Environment</h2>
          <label>
            Name
            <input
              value={document.name}
              maxLength={120}
              onChange={(e) => update({ ...latest.current, name: e.target.value || "New environment" })}
            />
          </label>
          <small>Independent definition · {entry.state === "SAVED" ? "Saved in Library" : "Working draft"}</small>
          {document.room ? (
            <RoomEnvironmentEditor
              room={document.room}
              selectedFeatureId={selected}
              onSelectFeature={setSelected}
              onChange={(room) => update({ ...latest.current, room })}
            />
          ) : (
            <p>Build a room from photos or start with an existing environment.</p>
          )}
          <button onClick={() => setSetup(true)}>Reconstruct or start from a room…</button>
          <button onClick={() => setDialog({ entry, mode: "METADATA" })}>Organize environment</button>
        </aside>
      </div>
      {setup && (
        <EnvironmentCreateDialog
          items={[]}
          environments={environments}
          onClose={() => setSetup(false)}
          onCreate={async (room) => {
            update({ ...latest.current, room: { ...room, id: document.id, name: document.name } });
            await persist();
          }}
          photo={{
            draft: canvas,
            csrfToken,
            prepare: async () => {
              await persist();
              return {
                draft: environmentPreviewDraft(latest.current),
                revision: revision.current,
                editorGeneration: generation.current,
              };
            },
            isCurrent: (base) => base.editorGeneration === generation.current && base.revision === revision.current,
            apply: async (base, proposal: RoomPerceptionProposal) => {
              const response = await fetch("/api/studio/parallax/room-photo", {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken() },
                body: JSON.stringify({ action: "APPLY", ...base, proposal }),
              });
              const data = await response.json();
              if (!response.ok)
                throw new Error(data.message ?? data.error ?? "Room reconstruction could not be applied.");
              acknowledge(environmentDraftSchema.parse(data.environmentDraft), data.revision);
              setSetup(false);
              await refresh();
            },
          }}
        />
      )}
      {dialog && (
        <LibraryManagementDialog
          request={dialog}
          api={api}
          prepare={async () => {
            if (dialog.retainedSnapshot) return dialog.entry.revision;
            await persist();
            return revision.current;
          }}
          onChanged={refresh}
          onClose={() => setDialog(null)}
        />
      )}
    </main>
  );
}
