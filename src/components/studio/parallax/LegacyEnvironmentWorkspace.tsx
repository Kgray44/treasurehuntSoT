"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  legacyEnvironmentEditStateSchema,
  legacyEnvironmentWorkingSchema,
  type LegacyEnvironmentEditState,
  type LegacyEnvironmentWorking,
} from "@/parallax/legacy-environment-working-contracts";
import { environmentVersionSchema } from "@/parallax/legacy-scene-environment-contracts";
import { journalWorking, clearWorkingJournal, readLegacyWorkingJournal } from "./working-recovery";
import shell from "./SpatialStudio.module.css";
import styles from "./SceneManager.module.css";
export type LegacyEnvironmentWorkspaceState = LegacyEnvironmentEditState & { working: LegacyEnvironmentWorking };
type Initial = LegacyEnvironmentWorkspaceState;
export function LegacyEnvironmentWorkspace({
  initial,
  accountId,
  api,
  onClose,
  onRefresh,
}: {
  initial: Initial;
  accountId: string;
  api: (body: unknown) => Promise<unknown>;
  onClose: () => Promise<void>;
  onRefresh: () => Promise<Initial>;
}) {
  const [document, setDocument] = useState(initial.working);
  const [acknowledgement, setAcknowledgement] = useState<LegacyEnvironmentEditState>(initial);
  const [status, setStatus] = useState("Environment working draft"),
    [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [historyCounts, setHistoryCounts] = useState({ past: 0, future: 0 });
  const [recovery, setRecovery] = useState<ReturnType<typeof readLegacyWorkingJournal>>(null);
  const [server, setServer] = useState<Initial | null>(null);
  const latest = useRef(document),
    revision = useRef(initial.revision),
    saved = useRef(JSON.stringify(document));
  const checksum = useRef(initial.contentChecksum),
    saving = useRef<Promise<void> | null>(null);
  const past = useRef<LegacyEnvironmentWorking[]>([]),
    future = useRef<LegacyEnvironmentWorking[]>([]);
  const releaseOperation = useRef<{
    definitionId: string;
    revision: number;
    operationId: string;
    contentChecksum: string;
  } | null>(null);
  const update = useCallback(
    (next: LegacyEnvironmentWorking) => {
      past.current.push(latest.current);
      future.current = [];
      setHistoryCounts({ past: past.current.length, future: 0 });
      latest.current = next;
      setDocument(next);
      journalWorking(accountId, next.id, next, revision.current);
    },
    [accountId],
  );
  const travel = useCallback(
    (direction: "UNDO" | "REDO") => {
      const next = (direction === "UNDO" ? past.current : future.current).pop();
      if (!next) return;
      (direction === "UNDO" ? future.current : past.current).push(latest.current);
      setHistoryCounts({ past: past.current.length, future: future.current.length });
      latest.current = next;
      setDocument(next);
      journalWorking(accountId, next.id, next, revision.current);
    },
    [accountId],
  );
  const persist = useCallback(async () => {
    if (saving.current) return saving.current;
    const run = async () => {
      while (saved.current !== JSON.stringify(latest.current)) {
        const snapshot = latest.current;
        const checked = legacyEnvironmentWorkingSchema.safeParse(snapshot);
        if (!checked.success)
          throw new Error([...new Set(checked.error.issues.map((issue) => issue.message))].join(" "));
        const parsed = checked.data;
        const result = legacyEnvironmentEditStateSchema.parse(
          await api({ action: "LEGACY_ENVIRONMENT_SAVE", document: parsed, revision: revision.current }),
        );
        if (!result.working || result.working.id !== snapshot.id)
          throw new Error("The working Environment acknowledgement does not match this definition.");
        revision.current = result.revision;
        checksum.current = result.contentChecksum;
        saved.current = JSON.stringify(result.working);
        setAcknowledgement(result);
        clearWorkingJournal(accountId, snapshot.id, result.working);
        if (snapshot === latest.current) {
          latest.current = result.working;
          setDocument(result.working);
        } else journalWorking(accountId, snapshot.id, latest.current, revision.current);
      }
      setStatus("Working Environment saved · Scene pins unchanged");
    };
    saving.current = run().finally(() => {
      saving.current = null;
    });
    return saving.current;
  }, [accountId, api]);
  const attempt = async (work: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The Environment could not be saved.");
      setStatus("Unsaved operation · retry available");
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    const retained = readLegacyWorkingJournal(accountId, initial.working.id);
    let active = true;
    if (retained && JSON.stringify(retained.document) !== saved.current)
      queueMicrotask(() => {
        if (active) setRecovery(retained);
      });
    return () => {
      active = false;
    };
  }, [accountId, initial.working.id]);
  useEffect(() => {
    if (recovery || busy) return;
    const timer = setTimeout(
      () =>
        void persist().catch((cause) => {
          setError(cause instanceof Error ? cause.message : "The working Environment could not be saved.");
          setStatus("Unsaved changes · retry available");
        }),
      800,
    );
    return () => clearTimeout(timer);
  }, [document, persist, recovery, busy]);
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
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement)?.closest?.('input,textarea,select,dialog,[contenteditable="true"]')) return;
      if ((event.ctrlKey || event.metaKey) && ["z", "y"].includes(event.key.toLowerCase())) {
        event.preventDefault();
        travel(event.shiftKey || event.key.toLowerCase() === "y" ? "REDO" : "UNDO");
      }
    };
    window.document.addEventListener("keydown", key);
    return () => window.document.removeEventListener("keydown", key);
  }, [travel]);
  const content = document.content;
  const change = (patch: Partial<LegacyEnvironmentWorking["content"]>) =>
    update({ ...latest.current, content: { ...latest.current.content, ...patch } });
  return (
    <main className={shell.studio}>
      <header className={shell.header}>
        <div>
          <small>Parallax / Shared Environment</small>
          <h1>{content.name}</h1>
          <span role="status">{status}</span>
          <p>
            Working revision {acknowledgement.revision} · {acknowledgement.saveState.replaceAll("_", " ")}
          </p>
        </div>
        <div className={styles.actions}>
          <button
            disabled={busy || !!recovery}
            onClick={() =>
              void attempt(async () => {
                await persist();
                await onClose();
              })
            }
          >
            Back to Scene
          </button>
          <button disabled={busy || !historyCounts.past} onClick={() => travel("UNDO")}>
            Undo Environment edit
          </button>
          <button disabled={busy || !historyCounts.future} onClick={() => travel("REDO")}>
            Redo Environment edit
          </button>
          <button disabled={busy || !!recovery} onClick={() => void attempt(persist)}>
            Save working Environment
          </button>
          <button
            disabled={busy || !!recovery || acknowledgement.saveState === "SAVED"}
            onClick={() =>
              void attempt(async () => {
                await persist();
                const result = legacyEnvironmentEditStateSchema.parse(
                  await api({
                    action: "LEGACY_ENVIRONMENT_LIBRARY_SAVE",
                    definitionId: document.id,
                    revision: revision.current,
                  }),
                );
                revision.current = result.revision;
                setAcknowledgement(result);
                setStatus("Environment saved to private Library · no release created");
              })
            }
          >
            Save Environment to Library
          </button>
          <button
            disabled={busy || !!recovery}
            onClick={() =>
              void attempt(async () => {
                await persist();
                if (!checksum.current)
                  throw new Error("Save and review this working Environment before creating a version.");
                if (!releaseOperation.current || releaseOperation.current.contentChecksum !== checksum.current)
                  releaseOperation.current = {
                    definitionId: document.id,
                    revision: revision.current,
                    operationId: crypto.randomUUID(),
                    contentChecksum: checksum.current,
                  };
                const raw = await api({ action: "LEGACY_ENVIRONMENT_RELEASE", ...releaseOperation.current });
                const result = legacyEnvironmentEditStateSchema.parse(raw);
                const version = environmentVersionSchema.parse((raw as { version: unknown }).version);
                revision.current = result.revision;
                checksum.current = result.contentChecksum;
                setAcknowledgement(result);
                releaseOperation.current = null;
                setStatus(
                  "Immutable Environment version " +
                    version.reference.revision +
                    " created. Review and update each Scene separately.",
                );
              })
            }
          >
            Create immutable Environment version
          </button>
        </div>
      </header>
      {error && (
        <div role="alert" className={styles.error}>
          <p>{error}</p>
          <button disabled={busy} onClick={() => void attempt(persist)}>
            Retry working save
          </button>
          <button
            disabled={busy}
            onClick={() =>
              void attempt(async () => {
                const current = await onRefresh();
                setServer(current);
                setRecovery({ document: latest.current, revision: revision.current, at: new Date().toISOString() });
              })
            }
          >
            Review saved Environment
          </button>
        </div>
      )}
      {recovery && (
        <section className={styles.confirm} aria-label="Environment recovery">
          <h2>Review retained Environment edits</h2>
          <p>
            Your browser retained working edits at revision {recovery.revision}. Restoring them retries that revision;
            another editor’s saved changes remain protected.
          </p>
          <p>
            Retained: {recovery.document.content.name} · {recovery.document.content.width} ×{" "}
            {recovery.document.content.depth} m
          </p>
          {server && (
            <p>
              Server: {server.working.content.name} · revision {server.revision} · {server.working.content.width} ×{" "}
              {server.working.content.depth} m
            </p>
          )}
          <button
            disabled={busy}
            onClick={() => {
              revision.current = recovery.revision;
              update(recovery.document);
              setRecovery(null);
            }}
          >
            Restore retained edits
          </button>
          <button
            disabled={busy}
            onClick={() =>
              void attempt(async () => {
                const current = server ?? (await onRefresh());
                clearWorkingJournal(accountId, document.id, recovery.document);
                revision.current = current.revision;
                checksum.current = current.contentChecksum;
                latest.current = current.working;
                saved.current = JSON.stringify(current.working);
                setDocument(current.working);
                setAcknowledgement(current);
                setRecovery(null);
                setServer(null);
                setError("");
                past.current = [];
                future.current = [];
                setHistoryCounts({ past: 0, future: 0 });
              })
            }
          >
            Keep saved Environment
          </button>
        </section>
      )}
      <fieldset disabled={busy || !!recovery} className={styles.editor}>
        <legend>Shared structure · Scenes keep their released versions until reviewed</legend>
        <div className={styles.fields}>
          <label>
            Environment name
            <input maxLength={160} value={content.name} onChange={(event) => change({ name: event.target.value })} />
          </label>
          <label>
            Base preview lighting
            <select
              value={content.light}
              onChange={(event) => change({ light: event.target.value as "NORMAL" | "LOW" })}
            >
              <option value="NORMAL">Normal</option>
              <option value="LOW">Low</option>
            </select>
          </label>
          {(["width", "depth"] as const).map((axis) => (
            <label key={axis}>
              {axis === "width" ? "Environment width (m)" : "Environment depth (m)"}
              <input
                type="number"
                min={2}
                max={20}
                step={0.1}
                value={content[axis]}
                onChange={(event) => change({ [axis]: Number(event.target.value) })}
              />
            </label>
          ))}
        </div>
        <label>
          Environment description
          <textarea
            maxLength={2000}
            value={content.description}
            onChange={(event) => change({ description: event.target.value })}
          />
        </label>
        <details>
          <summary role="button">Layout overview</summary>
          <svg
            aria-label="Shared fixture layout"
            viewBox={"0 0 " + content.width + " " + content.depth}
            style={{ width: "100%", maxHeight: 280, background: "var(--studio-background)" }}
          >
            <rect
              x={0}
              y={0}
              width={content.width}
              height={content.depth}
              fill="none"
              stroke="var(--studio-accent)"
              strokeWidth={0.03}
            />
            {content.fixtures.map((fixture) => (
              <rect
                key={fixture.id}
                x={fixture.position.x + content.width / 2 - fixture.size.x / 2}
                y={fixture.position.z + content.depth / 2 - fixture.size.z / 2}
                width={fixture.size.x}
                height={fixture.size.z}
                fill={fixture.color}
              >
                <title>{fixture.name}</title>
              </rect>
            ))}
          </svg>
          <p>Layout overview of shared fixtures. Scene objects are edited in the Scene workspace.</p>
        </details>
        <h2>Shared furniture and architecture</h2>
        {content.fixtures.map((fixture, index) => (
          <div key={fixture.id} className={styles.fixture}>
            <label>
              Shared fixture name
              <input
                maxLength={160}
                value={fixture.name}
                onChange={(event) =>
                  change({
                    fixtures: content.fixtures.map((entry, i) =>
                      i === index ? { ...entry, name: event.target.value } : entry,
                    ),
                  })
                }
              />
            </label>
            {(["x", "y", "z"] as const).map((axis) => (
              <label key={axis}>
                {fixture.name + " " + axis.toUpperCase() + " (m)"}
                <input
                  type="number"
                  step={0.1}
                  value={fixture.position[axis]}
                  onChange={(event) =>
                    change({
                      fixtures: content.fixtures.map((entry, i) =>
                        i === index
                          ? { ...entry, position: { ...entry.position, [axis]: Number(event.target.value) } }
                          : entry,
                      ),
                    })
                  }
                />
              </label>
            ))}
            {(["x", "y", "z"] as const).map((axis) => (
              <label key={"size-" + axis}>
                {fixture.name + " size " + axis.toUpperCase() + " (m)"}
                <input
                  type="number"
                  min={0.05}
                  step={0.1}
                  value={fixture.size[axis]}
                  onChange={(event) =>
                    change({
                      fixtures: content.fixtures.map((entry, i) =>
                        i === index ? { ...entry, size: { ...entry.size, [axis]: Number(event.target.value) } } : entry,
                      ),
                    })
                  }
                />
              </label>
            ))}
            <label>
              Fixture color
              <input
                type="color"
                value={fixture.color}
                onChange={(event) =>
                  change({
                    fixtures: content.fixtures.map((entry, i) =>
                      i === index ? { ...entry, color: event.target.value } : entry,
                    ),
                  })
                }
              />
            </label>
            <button onClick={() => change({ fixtures: content.fixtures.filter((_, i) => i !== index) })}>
              Remove {fixture.name}
            </button>
          </div>
        ))}
        <button
          disabled={content.fixtures.length >= 32}
          onClick={() =>
            change({
              fixtures: [
                ...content.fixtures,
                {
                  id: "fixture:" + crypto.randomUUID(),
                  name: "Shared furniture " + (content.fixtures.length + 1),
                  kind: "FURNITURE",
                  position: { x: 0, y: 0.5, z: 0 },
                  size: { x: 1, y: 1, z: 1 },
                  color: "#6784a3",
                },
              ],
            })
          }
        >
          Add shared furniture
        </button>
        <details>
          <summary role="button">Shared semantic features &amp; constraints</summary>
          {content.evidence.candidates.map((feature, index) => (
            <div key={feature.id} className={styles.fixture}>
              <span>
                {feature.id} · {feature.surface} · {feature.safe ? "Safe" : "Excluded"}
              </span>
              {(["x", "z"] as const).map((axis) => (
                <label key={axis}>
                  {"Semantic feature " + feature.id + " " + axis.toUpperCase() + " (m)"}
                  <input
                    type="number"
                    step={0.1}
                    value={feature.position[axis]}
                    onChange={(event) =>
                      change({
                        evidence: {
                          ...content.evidence,
                          candidates: content.evidence.candidates.map((entry, i) =>
                            i === index
                              ? { ...entry, position: { ...entry.position, [axis]: Number(event.target.value) } }
                              : entry,
                          ),
                        },
                      })
                    }
                  />
                </label>
              ))}
              <button
                onClick={() =>
                  change({
                    evidence: {
                      ...content.evidence,
                      candidates: content.evidence.candidates.filter((_, i) => i !== index),
                    },
                  })
                }
              >
                Remove feature {feature.id}
              </button>
            </div>
          ))}
        </details>
        <details>
          <summary role="button">Organize this Environment</summary>
          <label>
            Environment collection
            <input
              maxLength={120}
              value={document.metadata.collection ?? ""}
              onChange={(event) =>
                update({ ...latest.current, metadata: { ...latest.current.metadata, collection: event.target.value } })
              }
            />
          </label>
          <label>
            Environment tags
            <input
              value={document.metadata.tags?.join(", ") ?? ""}
              onChange={(event) =>
                update({
                  ...latest.current,
                  metadata: {
                    ...latest.current.metadata,
                    tags: event.target.value
                      .split(",")
                      .map((tag) => tag.trim())
                      .filter(Boolean),
                  },
                })
              }
            />
          </label>
          <label>
            Favorite preference
            <select
              value={document.metadata.favorite === null ? "UNSET" : document.metadata.favorite ? "YES" : "NO"}
              onChange={(event) =>
                update({
                  ...latest.current,
                  metadata: {
                    ...latest.current.metadata,
                    favorite: event.target.value === "UNSET" ? null : event.target.value === "YES",
                  },
                })
              }
            >
              <option value="UNSET">No saved preference</option>
              <option value="YES">Favorite</option>
              <option value="NO">Not a favorite</option>
            </select>
          </label>
        </details>
        <p>
          {content.evidence.candidates.length} semantic features ·{" "}
          {content.origin === "RECONSTRUCTED" ? "Reconstructed geometry metadata" : "Authored geometry"}. Existing
          Scenes and published versions stay unchanged while you edit this working definition.
        </p>
      </fieldset>
    </main>
  );
}
