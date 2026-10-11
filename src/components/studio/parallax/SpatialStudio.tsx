"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import {
  changeHistory,
  createSpatialDraft,
  draftSchema,
  forkSpatialDraft,
  previewModes,
  redo,
  undo,
  type Edit,
  type History,
  type SpatialDraft,
} from "@/parallax/authoring";
import { materializeIntent, type IntentProposal } from "@/parallax/ai-authoring";
import type { SpatialLibraryRecord } from "@/parallax/library-service";
import type { SpatialMoment, SpatialVersion } from "@/parallax/contracts";
import { emptyStudioContent } from "@/parallax/studio-contracts";
import {
  simulationEnvironments,
  simulateSpatialEnvironments,
  spatialPerformanceEstimate,
  validateSpatialAuthoring,
  type SpatialFinding,
} from "@/parallax/studio-validation";
import { SpatialCanvas } from "./SpatialCanvas";
import { SpatialDependencies } from "./SpatialDependencies";
import { AdaptivePlacement } from "./AdaptivePlacement";
import { SpatialFieldQuality } from "./SpatialFieldQuality";
import { SpatialAssetBrowser } from "./SpatialAssetBrowser";
import { PlacementComposer } from "./PlacementComposer";
import { BehaviorTracks } from "./BehaviorTracks";
import { insertSpatialPreset } from "@/parallax/editor-assets";
import { syntheticEnvironmentEvidence } from "@/parallax/adaptive-authoring";
import { resolveAdaptiveScene } from "@/parallax/adaptive";
import type { SpatialInput } from "@/parallax/behavior";
import styles from "./SpatialStudio.module.css";

type Chronicle = {
  id: string;
  title: string;
  autosaveVersion: number;
  blocks: { id: string; title: string; spatialMoment: SpatialMoment | null }[];
};
type Loaded = { csrfToken: string; items: SpatialLibraryRecord[]; chronicle: Chronicle | null; aiAvailable: boolean };
type AttachmentChange = { blockId: string; before: SpatialMoment | null; after: SpatialMoment };
const fresh = (chronicleId?: string) => createSpatialDraft(crypto.randomUUID(), "Desk Map", chronicleId ?? null);
export function SpatialStudio({
  chronicleId,
  definitionId,
  entityId,
  blockId,
}: {
  chronicleId?: string;
  definitionId?: string;
  entityId?: string;
  blockId?: string;
}) {
  const [loaded, setLoaded] = useState<Loaded | null>(null),
    [history, setHistory] = useState<History | null>(null);
  const [attachmentPast, setAttachmentPast] = useState<AttachmentChange[]>([]),
    [attachmentFuture, setAttachmentFuture] = useState<AttachmentChange[]>([]);
  const [selected, setSelected] = useState<string | null>(entityId ?? null),
    [mode, setMode] = useState("GUIDED"),
    [preview, setPreview] = useState("EDITOR"),
    [environment, setEnvironment] = useState("bedroom");
  const [query, setQuery] = useState(""),
    [sceneQuery, setSceneQuery] = useState(""),
    [filter, setFilter] = useState("ALL"),
    [status, setStatus] = useState("Opening Spatial Studio…"),
    [error, setError] = useState("");
  const [busy, setBusy] = useState(false),
    [request, setRequest] = useState(""),
    [proposal, setProposal] = useState<IntentProposal | null>(null),
    [critique, setCritique] = useState<{ topic: string; message: string }[]>([]);
  const [findings, setFindings] = useState<SpatialFinding[] | null>(null),
    [releaseId, setReleaseId] = useState(""),
    [targetBlock, setTargetBlock] = useState(blockId ?? ""),
    [override, setOverride] = useState("");
  const [timeMs, setTimeMs] = useState(0),
    [inputs, setInputs] = useState<SpatialInput[]>([
      { trigger: "SCENE_ENTER", atMs: 0 },
      { trigger: "TIMER", atMs: 0 },
    ]);
  const draftRef = useRef<SpatialDraft | null>(null),
    revision = useRef(0),
    savedJson = useRef(""),
    saving = useRef<Promise<void> | null>(null),
    csrf = useRef(""),
    initialized = useRef(false);
  const proposalBinding = useRef<string | null>(null);
  const proposalTarget = useRef<string | null>(null);
  const draft = history?.present;
  const [placementPreview, setPlacementPreview] = useState<SpatialDraft | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(true),
    [inspectorOpen, setInspectorOpen] = useState(true);
  const [libraryWidth, setLibraryWidth] = useState(240),
    [inspectorWidth, setInspectorWidth] = useState(300);
  const [playing, setPlaying] = useState(false);
  const [validationOpen, setValidationOpen] = useState(false);
  useEffect(() => {
    queueMicrotask(() => setPlacementPreview(null));
  }, [draft, selected]);
  const dockDrag = useRef<{ side: "library" | "inspector"; x: number; width: number } | null>(null);
  const dockHandle = (side: "library" | "inspector") => (
    <div
      className={styles.dockHandle}
      role="separator"
      aria-label={`Resize ${side} panel`}
      aria-orientation="vertical"
      aria-valuenow={side === "library" ? libraryWidth : inspectorWidth}
      aria-valuemin={210}
      aria-valuemax={420}
      tabIndex={0}
      onPointerDown={(event) => {
        dockDrag.current = { side, x: event.clientX, width: side === "library" ? libraryWidth : inspectorWidth };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        const drag = dockDrag.current;
        if (drag?.side === side) {
          const value = Math.max(
            210,
            Math.min(420, drag.width + (event.clientX - drag.x) * (side === "library" ? 1 : -1)),
          );
          (side === "library" ? setLibraryWidth : setInspectorWidth)(value);
        }
      }}
      onPointerUp={() => {
        dockDrag.current = null;
      }}
      onPointerCancel={() => {
        dockDrag.current = null;
      }}
      onKeyDown={(event) => {
        if (["ArrowLeft", "ArrowRight"].includes(event.key)) {
          event.preventDefault();
          const update = side === "library" ? setLibraryWidth : setInspectorWidth;
          update((w) => Math.max(210, Math.min(420, w + (event.key === "ArrowRight" ? 16 : -16))));
        }
      }}
    />
  );
  useEffect(() => {
    if (!playing) return;
    const interval = setInterval(() => {
      if (!document.hidden)
        setTimeMs((t) => {
          if (t >= 59900) return 60000;
          return t + 100;
        });
    }, 100);
    return () => clearInterval(interval);
  }, [playing]);
  const adaptiveResolution = draft?.content.adaptive
    ? resolveAdaptiveScene(
        draft.content,
        syntheticEnvironmentEvidence(
          simulationEnvironments.find((e) => e.id === environment) ?? simulationEnvironments[0],
        ),
        `studio-preview-${draft.content.adaptive.variant}`,
      )
    : null;
  useEffect(() => {
    draftRef.current = draft ?? null;
  }, [draft]);
  const api = useCallback(async (body: unknown) => {
    const response = await fetch("/api/studio/parallax", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-csrf-token": csrf.current },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Spatial Studio could not save this change.");
    return data;
  }, []);
  const persist = useCallback(async () => {
    if (saving.current) return saving.current;
    if (!draftRef.current || savedJson.current === JSON.stringify(draftRef.current)) return;
    const task = async () => {
      while (draftRef.current && savedJson.current !== JSON.stringify(draftRef.current)) {
        const snapshot = draftRef.current;
        setStatus("Saving working draft…");
        const result = await api({ action: "SAVE", draft: snapshot, revision: revision.current });
        revision.current = result.revision;
        savedJson.current = JSON.stringify(snapshot);
      }
      setStatus("Working draft saved");
    };
    saving.current = task().finally(() => {
      saving.current = null;
    });
    return saving.current;
  }, [api]);
  const install = useCallback(
    (next: SpatialDraft, nextRevision: number, saved: boolean) => {
      draftRef.current = next;
      revision.current = nextRevision;
      savedJson.current = saved ? JSON.stringify(next) : "";
      setHistory({ past: [], present: next, future: [] });
      setSelected(next.content.entities.some((e) => e.id === entityId) ? entityId! : next.content.entities[0].id);
      setProposal(null);
      setFindings(null);
      setReleaseId("");
      setError("");
      setTimeMs(0);
      setInputs([
        { trigger: "SCENE_ENTER", atMs: 0 },
        { trigger: "TIMER", atMs: 0 },
      ]);
    },
    [entityId],
  );
  const load = useCallback(async () => {
    const response = await fetch(
      `/api/studio/parallax${chronicleId ? `?chronicle=${encodeURIComponent(chronicleId)}` : ""}`,
      { cache: "no-store" },
    );
    const data = (await response.json()) as Loaded & { error?: string };
    if (!response.ok) throw new Error(data.error ?? "Spatial Studio is unavailable.");
    csrf.current = data.csrfToken;
    setLoaded(data);
    return data;
  }, [chronicleId]);
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      void load()
        .then((data) => {
          if (cancelled || initialized.current) return;
          initialized.current = true;
          const item = data.items.find((i) => i.id === definitionId);
          if (item) install(item.draft, item.revision, true);
          else {
            const capsule = data.chronicle?.blocks.find((b) => b.id === blockId)?.spatialMoment;
            if (capsule) {
              const { checksum: _checksum, ...content } = capsule.version;
              void _checksum;
              const next = fresh(chronicleId);
              install(
                draftSchema.parse({
                  ...next,
                  content: { ...content, id: next.content.id, definitionId: next.content.definitionId },
                  lineage: { definitionId: capsule.definition.id, versionId: capsule.version.id },
                }),
                0,
                false,
              );
            } else install(fresh(chronicleId), 0, false);
          }
          setStatus(item ? "Working draft opened" : "New working draft");
        })
        .catch((cause) => {
          if (!cancelled) setError(cause.message);
        });
      try {
        const preference = sessionStorage.getItem("parallax.authoring-mode");
        if (["GUIDED", "DETAILED", "ENGINEERING"].includes(preference ?? "")) setMode(preference!);
      } catch {}
    });
    return () => {
      cancelled = true;
    };
  }, [load, install, definitionId, chronicleId, blockId]);
  useEffect(() => {
    if (!draft || !loaded) return;
    const timer = setTimeout(
      () =>
        void persist().catch((cause) => {
          setError(cause.message);
          setStatus("Unsaved changes — retry or fork to preserve them");
        }),
      800,
    );
    return () => clearTimeout(timer);
  }, [draft, loaded, persist]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (draftRef.current && savedJson.current !== JSON.stringify(draftRef.current)) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  const edit = (change: Edit) => {
    try {
      if (history) setHistory(changeHistory(history, change));
      setFindings(null);
      setProposal(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The edit could not be applied.");
    }
  };
  const replace = (next: SpatialDraft) => edit({ type: "REPLACE", draft: next });
  const addPreset = (name: string) => {
    if (!draft) return;
    try {
      const next = insertSpatialPreset(draft, name, crypto.randomUUID());
      replace(next);
      setSelected(next.content.entities[draft.content.entities.length].id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Asset could not be added.");
    }
  };
  const action = async (run: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await run();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "This action could not be completed.");
    } finally {
      setBusy(false);
    }
  };
  const newPreset = (name: string) =>
    void action(async () => {
      await persist();
      const next = createSpatialDraft(crypto.randomUUID(), name, chronicleId ?? null);
      install(next, 0, false);
    });
  const restoreAttachment = (change: AttachmentChange, direction: "UNDO" | "REDO") =>
    void action(async () => {
      const current = await load();
      if (!current.chronicle) throw new Error("Chronicle unavailable.");
      const expected = direction === "UNDO" ? change.after : change.before;
      const actual = current.chronicle.blocks.find((b) => b.id === change.blockId)?.spatialMoment ?? null;
      if (JSON.stringify(actual) !== JSON.stringify(expected))
        throw new Error("This attachment changed. Reopen its current version before editing history.");
      await api({
        action: "RESTORE_ATTACHMENT",
        chronicleId: current.chronicle.id,
        blockId: change.blockId,
        autosaveVersion: current.chronicle.autosaveVersion,
        moment: direction === "UNDO" ? change.before : change.after,
      });
      await load();
      if (direction === "UNDO") {
        setAttachmentPast(attachmentPast.slice(0, -1));
        setAttachmentFuture([...attachmentFuture, change]);
      } else {
        setAttachmentPast([...attachmentPast, change]);
        setAttachmentFuture(attachmentFuture.slice(0, -1));
      }
      setStatus(direction === "UNDO" ? "Spatial attachment undone" : "Spatial attachment redone");
    });
  const currentEntity = draft?.content.entities.find((e) => e.id === selected);
  const record = loaded?.items.find((i) => i.id === draft?.content.definitionId);
  const releases = record?.releases ?? [];
  const localFindings = draft ? (findings ?? validateSpatialAuthoring(draft.content)) : [];
  const filtered =
    loaded?.items.filter(
      (i) =>
        (i.draft.scope === "MY_LIBRARY" || i.draft.chronicleId === (chronicleId ?? null)) &&
        (filter !== "FAVORITES" || i.draft.favorite) &&
        (filter !== "MY_LIBRARY" || i.draft.scope === "MY_LIBRARY") &&
        `${i.draft.content.title} ${i.draft.tags.join(" ")} ${i.draft.category} ${i.draft.collection}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    ) ?? [];
  const chooseRelease = (version: SpatialVersion) => {
    setReleaseId(version.id);
  };
  const updateEntity = (patch: Partial<NonNullable<typeof currentEntity>>) => {
    if (draft && currentEntity)
      replace({
        ...draft,
        content: {
          ...draft.content,
          entities: draft.content.entities.map((e) => (e.id === currentEntity.id ? { ...e, ...patch } : e)),
        },
      });
  };
  if (!draft || !loaded)
    return (
      <main className={styles.studio}>
        <Link href="/studio/library">Chronicle Library</Link>
        <h1>Parallax Spatial Studio</h1>
        {error ? <p role="alert">{error}</p> : <p role="status">{status}</p>}
        <button
          onClick={() =>
            void action(async () => {
              initialized.current = false;
              const data = await load();
              install(data.items[0]?.draft ?? fresh(chronicleId), data.items[0]?.revision ?? 0, Boolean(data.items[0]));
            })
          }
        >
          Try again
        </button>
      </main>
    );
  return (
    <main className={styles.studio} data-mode={mode}>
      <header className={styles.header}>
        <div>
          <Link
            href={chronicleId ? `/studio/tales/${encodeURIComponent(chronicleId)}` : "/studio/library"}
            onClick={(event) => {
              if (event.ctrlKey || event.metaKey) return;
              event.preventDefault();
              if (busy) return;
              const href = event.currentTarget.href;
              void action(async () => {
                await persist();
                window.location.assign(href);
              });
            }}
          >
            ← {loaded.chronicle?.title ?? "Creator Studio"}
          </Link>
          <p className={styles.eyebrow}>PARALLAX / Spatial Studio</p>
          <h1>{draft.content.title}</h1>
          <span role="status">{status}</span>
        </div>
        <div className={styles.toolbar}>
          <label>
            Authoring mode
            <select
              value={mode}
              onChange={(e) => {
                setMode(e.target.value);
                try {
                  sessionStorage.setItem("parallax.authoring-mode", e.target.value);
                } catch {}
              }}
            >
              {["GUIDED", "DETAILED", "ENGINEERING"].map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </label>
          <button
            disabled={!history.past.length || busy}
            onClick={() => {
              setHistory(undo(history));
              setFindings(null);
            }}
          >
            Undo
          </button>
          <button
            disabled={!history.future.length || busy}
            onClick={() => {
              setHistory(redo(history));
              setFindings(null);
            }}
          >
            Redo
          </button>
          <button
            disabled={busy}
            onClick={() =>
              void action(async () => {
                await persist();
                await load();
              })
            }
          >
            Save draft
          </button>
          <button
            disabled={busy}
            onClick={() =>
              void action(async () => {
                const result = await api({ action: "VALIDATE", draft });
                setFindings(result.findings);
                setValidationOpen(true);
                setStatus("Drydock spatial checks complete — simulations are synthetic");
              })
            }
          >
            Validate in Drydock
          </button>
          <button
            disabled={busy || localFindings.some((i) => i.severity === "ERROR")}
            onClick={() =>
              void action(async () => {
                await persist();
                const result = await api({
                  action: "RELEASE",
                  definitionId: draft.content.definitionId,
                  revision: revision.current,
                });
                revision.current = result.revision;
                setReleaseId(result.version.id);
                setValidationOpen(false);
                await load();
                setStatus("Immutable version created. Attach it to a Chronicle to publish.");
              })
            }
          >
            Create immutable version
          </button>
        </div>
      </header>
      {error && (
        <div role="alert" className={styles.error}>
          {error}
          <button disabled={busy} onClick={() => void action(persist)}>
            Retry save
          </button>
          <button
            onClick={() => {
              const next = forkSpatialDraft(draft, crypto.randomUUID());
              install(next, 0, false);
            }}
          >
            Preserve as new fork
          </button>
        </div>
      )}
      <nav className={styles.workstationNavigation} aria-label="Workstation panels">
        <div>
          <strong className={styles.workstationBrand}>◈ PARALLAX</strong>
          <span>SPATIAL WORKSTATION</span>
        </div>
        <div>
          <button aria-pressed={libraryOpen} onClick={() => setLibraryOpen(!libraryOpen)}>
            Library &amp; hierarchy
          </button>
          <button aria-pressed={inspectorOpen} onClick={() => setInspectorOpen(!inspectorOpen)}>
            Inspector
          </button>
          <button aria-expanded={validationOpen} onClick={() => setValidationOpen(!validationOpen)}>
            Diagnostics {localFindings.length ? `· ${localFindings.length}` : "· clear"}
          </button>
        </div>
      </nav>
      <div
        className={styles.workspace}
        data-library={libraryOpen ? "open" : "closed"}
        data-inspector={inspectorOpen ? "open" : "closed"}
        style={{ "--library-width": `${libraryWidth}px`, "--inspector-width": `${inspectorWidth}px` } as CSSProperties}
      >
        <aside className={styles.library} aria-label="Spatial Library">
          {dockHandle("library")}
          <h2>Spatial Library</h2>
          <SpatialAssetBrowser busy={busy} onAdd={addPreset} onNew={() => newPreset("Desk Map")} />
          <label>
            Search Library
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Title, tag, category or collection"
            />
          </label>
          <select aria-label="Library scope" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="ALL">Recent / all owned items</option>
            <option value="MY_LIBRARY">My Spatial Library</option>
            <option value="FAVORITES">Favorites</option>
          </select>
          <h3>Owned items</h3>
          {!filtered.length && <p>No saved items match. Create and save a spatial moment to begin.</p>}
          {filtered.map((item) => (
            <button
              className={styles.libraryItem}
              key={item.id}
              disabled={busy}
              onClick={() =>
                void action(async () => {
                  await persist();
                  const data = await load();
                  const refreshed = data.items.find((i) => i.id === item.id)!;
                  install(refreshed.draft, refreshed.revision, true);
                })
              }
            >
              <span className={styles.thumbnail} aria-hidden="true">
                {item.draft.content.entities[0]?.kind === "PARCHMENT" ? "▱" : "◇"}
              </span>
              <strong>{item.draft.content.title}</strong>
              <small>
                {item.draft.scope === "MY_LIBRARY" ? "My Library" : "Chronicle only"} · {item.releases.length} versions
                · {item.usageCount} uses
              </small>
              <small>{item.draft.category.replaceAll("_", " ")} · Guided compatible · Creator owned</small>
            </button>
          ))}
          <section className={styles.graph} aria-label="Scene graph">
            <h2>Scene graph</h2>
            <label>
              Find an entity
              <input
                aria-label="Scene graph search"
                value={sceneQuery}
                onChange={(e) => setSceneQuery(e.target.value)}
              />
            </label>
            <ul>
              {draft.content.entities
                .filter((e) =>
                  `${e.name} ${e.kind} ${e.anchorId} ${e.interactions.join(" ")} ${draft.content.studio?.layers.find((l) => l.entityId === e.id)?.tags.join(" ")}`
                    .toLowerCase()
                    .includes(sceneQuery.toLowerCase()),
                )
                .map((entity) => {
                  const l = draft.content.studio?.layers.find((l) => l.entityId === entity.id);
                  return (
                    <li key={entity.id} style={{ paddingLeft: entity.parentEntityId ? 24 : 0 }}>
                      <button aria-pressed={selected === entity.id} onClick={() => setSelected(entity.id)}>
                        {entity.parentEntityId ? "↳ " : "◇ "}
                        {entity.name}
                      </button>
                      <button
                        aria-label={`Toggle visibility of ${entity.name}`}
                        onClick={() =>
                          edit({ type: "LAYER", entityId: entity.id, patch: { visible: !(l?.visible ?? true) } })
                        }
                      >
                        {l?.visible === false ? "Hidden" : "Visible"}
                      </button>
                      <button
                        aria-label={`Toggle lock of ${entity.name}`}
                        onClick={() => edit({ type: "LAYER", entityId: entity.id, patch: { locked: !l?.locked } })}
                      >
                        {l?.locked ? "Locked" : "Unlocked"}
                      </button>
                    </li>
                  );
                })}
            </ul>
          </section>
        </aside>
        <section className={styles.center}>
          <div className={styles.previewControls}>
            <label>
              Preview
              <select aria-label="Preview" value={preview} onChange={(e) => setPreview(e.target.value)}>
                {previewModes.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
            <label>
              Environment
              <select aria-label="Environment" value={environment} onChange={(e) => setEnvironment(e.target.value)}>
                {simulationEnvironments.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              onClick={() => {
                setFindings(validateSpatialAuthoring(draft.content));
                setValidationOpen(true);
              }}
            >
              Test in 10 environments
            </button>
          </div>
          <SpatialCanvas
            draft={placementPreview ?? draft}
            selectedId={selected}
            onSelect={setSelected}
            onEdit={
              placementPreview
                ? () => setError("Approve or discard the proposal preview before editing objects.")
                : edit
            }
            onPreset={addPreset}
            mode={mode}
            preview={preview}
            environmentId={environment}
            timeMs={timeMs}
            inputs={inputs}
          />
          <PlacementComposer
            draft={draft}
            selectedId={selected}
            aiAvailable={loaded.aiAvailable}
            onPreview={setPlacementPreview}
            onApply={replace}
          />
          <details className={styles.assistantDetails}>
            <summary>Configured AI assistance / critique</summary>
            <p>
              {loaded.aiAvailable
                ? "Review the proposed configuration before accepting. AI critique is advisory; Drydock governs validation."
                : "AI provider unavailable. Configure a trusted authoring provider to enable intent and critique."}
            </p>
            <label>
              Intent
              <textarea
                value={request}
                onChange={(e) => setRequest(e.target.value)}
                placeholder="Put a folded letter near the entrance, on a table."
              />
            </label>
            <div className={styles.inline}>
              {["INTENT", "CRITIQUE"].map((kind) => (
                <button
                  key={kind}
                  disabled={!loaded.aiAvailable || !request || busy || !selected}
                  onClick={() =>
                    void action(async () => {
                      const binding = JSON.stringify(draftRef.current);
                      const target = selected;
                      const result = await api({ action: "AI", kind, request, draft: draftRef.current });
                      if (result.status !== "PROPOSED") throw new Error(result.message);
                      if (kind === "INTENT") {
                        proposalBinding.current = binding;
                        proposalTarget.current = target;
                        setProposal(result.proposal);
                      } else setCritique(result.critique.findings);
                    })
                  }
                >
                  {kind === "INTENT" ? "Propose intent" : "Critique scene"}
                </button>
              ))}
            </div>
            {proposal && (
              <div>
                <p>{proposal.explanation}</p>
                <pre>{JSON.stringify(proposal, null, 2)}</pre>
                <button
                  onClick={() => {
                    if (proposalBinding.current !== JSON.stringify(draft) || proposalTarget.current !== selected) {
                      setError("The scene or selected object changed. Request a fresh AI proposal.");
                      return;
                    }
                    try {
                      replace(materializeIntent(draft, selected!, proposal));
                      setProposal(null);
                    } catch (cause) {
                      setError(cause instanceof Error ? cause.message : "The proposal cannot edit this object.");
                    }
                  }}
                >
                  Accept as reversible edit
                </button>
                <button onClick={() => setProposal(null)}>Discard</button>
              </div>
            )}
            {critique.map((f, i) => (
              <p key={i}>
                <strong>{f.topic}:</strong> {f.message}
              </p>
            ))}
          </details>
          {preview === "PERFORMANCE" && (
            <p className={styles.notice}>Estimate only: {JSON.stringify(spatialPerformanceEstimate(draft.content))}</p>
          )}
          {preview === "REMOTE" && (
            <p className={styles.notice}>
              Compare the same intent across synthetic rooms. Placements, safety rejections and fallbacks change with
              available evidence. Physical qualification remains pending.
            </p>
          )}
          <section className={styles.timeline} aria-label="Behavior timeline">
            <div className={styles.timelineHeader}>
              <h2>Behavior timeline</h2>
              <div>
                <button
                  aria-pressed={playing}
                  disabled={timeMs >= 60000 && !playing}
                  onClick={() => {
                    setPlaying(!playing);
                    setPreview("LENS");
                  }}
                >
                  {playing ? "Pause timeline" : "Play timeline"}
                </button>
                <span>{(timeMs / 1000).toFixed(1)} / 60.0 s</span>
              </div>
            </div>
            <BehaviorTracks
              draft={draft}
              timeMs={timeMs}
              selected={selected}
              onSelect={setSelected}
              onTime={setTimeMs}
              onChange={replace}
            />
            <small>
              Spatial state changes only · events are relative to their trigger · Chronicle progression remains One
              Voyage-owned.
            </small>
            <label>
              Preview time
              <input
                aria-label="Timeline time in milliseconds"
                type="range"
                min="0"
                max="60000"
                step="100"
                value={timeMs}
                onChange={(e) => setTimeMs(Number(e.target.value))}
              />
              {(timeMs / 1000).toFixed(1)} seconds
            </label>
            <div className={styles.inline}>
              {["INSPECT", "PICK", "PLACE"].map((trigger) => (
                <button
                  key={trigger}
                  disabled={
                    !currentEntity || !currentEntity.interactions.includes(trigger as "INSPECT" | "PICK" | "PLACE")
                  }
                  onClick={() =>
                    setInputs([
                      ...inputs,
                      { trigger: trigger as SpatialInput["trigger"], entityId: selected!, atMs: timeMs },
                    ])
                  }
                >
                  Simulate {trigger.toLowerCase()}
                </button>
              ))}
              <button
                onClick={() => {
                  setPlaying(false);
                  setTimeMs(0);
                  setInputs([
                    { trigger: "SCENE_ENTER", atMs: 0 },
                    { trigger: "TIMER", atMs: 0 },
                  ]);
                }}
              >
                Reset simulation
              </button>
            </div>
            {(draft.content.studio?.behaviors ?? []).map((b, index) => (
              <div className={styles.behavior} key={b.id}>
                <select
                  aria-label={`Behavior ${index + 1} trigger`}
                  value={b.trigger}
                  onChange={(e) => {
                    const next = structuredClone(draft);
                    const node = next.content.studio!.behaviors[index];
                    node.trigger = e.target.value as typeof b.trigger;
                    if (["PICK", "INSPECT", "PLACE"].includes(node.trigger))
                      node.sourceEntityId = selected ?? undefined;
                    else delete node.sourceEntityId;
                    replace(next);
                  }}
                >
                  {["SCENE_ENTER", "TIMER", "INSPECT", "PICK", "PLACE"].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
                <select
                  aria-label={`Behavior ${index + 1} source`}
                  value={b.sourceEntityId ?? ""}
                  disabled={["TIMER", "SCENE_ENTER"].includes(b.trigger)}
                  onChange={(e) => {
                    const next = structuredClone(draft);
                    next.content.studio!.behaviors[index].sourceEntityId = e.target.value;
                    replace(next);
                  }}
                >
                  <option value="">Scene</option>
                  {draft.content.entities.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
                <input
                  aria-label={`Behavior ${index + 1} delay milliseconds`}
                  type="number"
                  min="0"
                  max="60000"
                  value={b.delayMs}
                  onChange={(e) => {
                    const next = structuredClone(draft);
                    next.content.studio!.behaviors[index].delayMs = Number(e.target.value);
                    replace(next);
                  }}
                />
                <select
                  aria-label={`Behavior ${index + 1} action`}
                  value={b.action}
                  onChange={(e) => {
                    const next = structuredClone(draft);
                    next.content.studio!.behaviors[index].action = e.target.value as typeof b.action;
                    replace(next);
                  }}
                >
                  {["SHOW", "HIDE", "HIGHLIGHT"].map((a) => (
                    <option key={a}>{a}</option>
                  ))}
                </select>
                <select
                  aria-label={`Behavior ${index + 1} target`}
                  value={b.targetEntityId}
                  onChange={(e) => {
                    const next = structuredClone(draft);
                    next.content.studio!.behaviors[index].targetEntityId = e.target.value;
                    replace(next);
                  }}
                >
                  {draft.content.entities.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    const next = structuredClone(draft);
                    next.content.studio!.behaviors.splice(index, 1);
                    replace(next);
                  }}
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              disabled={!selected || (draft.content.studio?.behaviors.length ?? 0) >= 64}
              onClick={() => {
                const next = structuredClone(draft);
                next.content.studio ??= emptyStudioContent();
                next.content.studio.behaviors.push({
                  id: crypto.randomUUID(),
                  trigger: "SCENE_ENTER",
                  delayMs: 0,
                  targetEntityId: selected!,
                  action: "HIGHLIGHT",
                });
                replace(next);
              }}
            >
              Add spatial behavior
            </button>
          </section>
        </section>
        <aside className={styles.inspector} aria-label="Spatial inspector">
          {dockHandle("inspector")}
          <h2>{currentEntity?.name ?? "Select an entity"}</h2>
          <AdaptivePlacement
            draft={draft}
            selectedId={selected}
            mode={mode}
            replace={replace}
            resolution={adaptiveResolution}
          />
          <SpatialFieldQuality key={draft.content.definitionId} draft={draft} api={api} replace={replace} />
          <label>
            Experience title
            <input
              value={draft.content.title}
              onChange={(e) => replace({ ...draft, content: { ...draft.content, title: e.target.value } })}
            />
          </label>
          {currentEntity && (
            <fieldset disabled={draft.content.studio?.layers.find((l) => l.entityId === currentEntity.id)?.locked}>
              <legend>Selected spatial object</legend>
              <label>
                Object name
                <input value={currentEntity.name} onChange={(e) => updateEntity({ name: e.target.value })} />
              </label>
              <label>
                Clue or message
                <textarea value={currentEntity.content} onChange={(e) => updateEntity({ content: e.target.value })} />
              </label>
              <label>
                Accessible description
                <textarea
                  value={currentEntity.alternativeText}
                  onChange={(e) => updateEntity({ alternativeText: e.target.value })}
                />
              </label>
              <label>
                Where should this appear?
                <select
                  aria-label="Semantic placement"
                  disabled={Boolean(draft.content.adaptive)}
                  value=""
                  onChange={(e) =>
                    edit({
                      type: "PLACEMENT",
                      entityId: selected!,
                      placement: e.target.value as "DESK" | "WALL" | "ENTRANCE" | "LOCAL",
                    })
                  }
                >
                  <option value="" disabled>
                    Choose a placement
                  </option>
                  <option value="DESK">On a desk or table</option>
                  <option value="WALL">On a wall at eye level</option>
                  <option value="ENTRANCE">Near the entrance (reference scene)</option>
                  <option value="LOCAL">In the local scene</option>
                </select>
              </label>
              <small>
                {draft.content.adaptive
                  ? "Use semantic surface and scene relationships above to place adaptive objects."
                  : "Authored fixed placement. Surface-relative placement asks the Player to choose a surface."}
              </small>
              <div className={styles.inline}>
                <button onClick={() => edit({ type: "DUPLICATE", entityId: selected!, newId: crypto.randomUUID() })}>
                  Duplicate
                </button>
                <button
                  disabled={draft.content.entities.length < 2}
                  onClick={() => edit({ type: "DELETE", entityId: selected! })}
                >
                  Delete
                </button>
                <button onClick={() => edit({ type: "REORDER", entityId: selected!, offset: -1 })}>Layer up</button>
                <button onClick={() => edit({ type: "REORDER", entityId: selected!, offset: 1 })}>Layer down</button>
              </div>
              <label>
                Group / parent
                <select
                  value={currentEntity.parentEntityId ?? ""}
                  disabled={Boolean(draft.content.adaptive)}
                  onChange={(e) => edit({ type: "PARENT", entityId: selected!, parentId: e.target.value || null })}
                >
                  <option value="">Scene root</option>
                  {draft.content.entities
                    .filter((e) => e.id !== selected)
                    .map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Size in meters
                <input
                  aria-label="Object width in meters"
                  type="number"
                  min="0.01"
                  max="5"
                  step="0.01"
                  value={currentEntity.widthMeters}
                  onChange={(e) => updateEntity({ widthMeters: Number(e.target.value) })}
                />
              </label>
              <label>
                Rotate
                <input
                  aria-label="Object rotation in degrees"
                  type="range"
                  min="-180"
                  max="180"
                  value={
                    (2 * Math.atan2(currentEntity.transform.rotation.y, currentEntity.transform.rotation.w) * 180) /
                    Math.PI
                  }
                  onChange={(e) => {
                    const r = (Number(e.target.value) * Math.PI) / 360;
                    edit({
                      type: "TRANSFORM",
                      entityId: selected!,
                      transform: {
                        ...currentEntity.transform,
                        rotation: { x: 0, y: Math.sin(r), z: 0, w: Math.cos(r) },
                      },
                    });
                  }}
                />
              </label>
              <label>
                Scale
                <input
                  aria-label="Object scale"
                  type="range"
                  min="0.1"
                  max="5"
                  step="0.05"
                  value={currentEntity.transform.scale}
                  onChange={(e) =>
                    edit({
                      type: "TRANSFORM",
                      entityId: selected!,
                      transform: { ...currentEntity.transform, scale: Number(e.target.value) },
                    })
                  }
                />
              </label>
              {mode !== "GUIDED" && (
                <>
                  <label>
                    Layer audience
                    <select
                      value={draft.content.studio?.layers.find((l) => l.entityId === selected)?.audience ?? "BOTH"}
                      onChange={(e) =>
                        edit({
                          type: "LAYER",
                          entityId: selected!,
                          patch: { audience: e.target.value as "BOTH" | "EDITOR_ONLY" | "RUNTIME_ONLY" },
                        })
                      }
                    >
                      <option>BOTH</option>
                      <option>EDITOR_ONLY</option>
                      <option>RUNTIME_ONLY</option>
                    </select>
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={draft.content.studio?.layers.find((l) => l.entityId === selected)?.selectable ?? true}
                      onChange={(e) =>
                        edit({ type: "LAYER", entityId: selected!, patch: { selectable: e.target.checked } })
                      }
                    />
                    Selectable
                  </label>
                  <label>
                    Entity tags
                    <input
                      value={draft.content.studio?.layers.find((l) => l.entityId === selected)?.tags.join(", ") ?? ""}
                      onChange={(e) =>
                        edit({
                          type: "LAYER",
                          entityId: selected!,
                          patch: {
                            tags: e.target.value
                              .split(",")
                              .map((t) => t.trim())
                              .filter(Boolean),
                          },
                        })
                      }
                    />
                  </label>
                  <p>Sharing: personal. Persistence: local ephemeral. Guided fallback preserves meaning.</p>
                </>
              )}
              {mode === "ENGINEERING" && (
                <>
                  <p>
                    Coordinate frame: {currentEntity.coordinateSpace}
                    <br />
                    Anchor: {currentEntity.anchorId}
                    <br />
                    Evidence: nonauthoritative
                  </p>
                  {["x", "y", "z"].map((axis) => (
                    <label key={axis}>
                      Position {axis}
                      <input
                        aria-label={`Position ${axis}`}
                        type="number"
                        step="0.05"
                        value={currentEntity.transform.position[axis as "x" | "y" | "z"]}
                        onChange={(e) =>
                          edit({
                            type: "TRANSFORM",
                            entityId: selected!,
                            transform: {
                              ...currentEntity.transform,
                              position: { ...currentEntity.transform.position, [axis]: Number(e.target.value) },
                            },
                          })
                        }
                      />
                    </label>
                  ))}
                </>
              )}
            </fieldset>
          )}
          <label>
            When AR is unavailable
            <textarea
              value={draft.content.fallback.narrative}
              onChange={(e) =>
                replace({
                  ...draft,
                  content: { ...draft.content, fallback: { ...draft.content.fallback, narrative: e.target.value } },
                })
              }
            />
          </label>
          <section>
            <h3>My Spatial Library</h3>
            <button disabled={draft.scope === "MY_LIBRARY"} onClick={() => replace({ ...draft, scope: "MY_LIBRARY" })}>
              Save to Spatial Library
            </button>
            <label>
              Category
              <select
                value={draft.category}
                onChange={(e) => replace({ ...draft, category: e.target.value as SpatialDraft["category"] })}
              >
                {[
                  "MOMENT",
                  "ENTITY",
                  "PLACEMENT_RECIPE",
                  "INTERACTION_BEHAVIOR",
                  "EFFECT",
                  "DISCOVERY_PROFILE",
                  "SCENE_TEMPLATE",
                ].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label>
              Tags
              <input
                value={draft.tags.join(", ")}
                onChange={(e) =>
                  replace({
                    ...draft,
                    tags: e.target.value
                      .split(",")
                      .map((t) => t.trim())
                      .filter(Boolean),
                  })
                }
              />
            </label>
            <label>
              Collection
              <input value={draft.collection} onChange={(e) => replace({ ...draft, collection: e.target.value })} />
            </label>
            <label>
              <input
                type="checkbox"
                checked={draft.favorite}
                onChange={(e) => replace({ ...draft, favorite: e.target.checked })}
              />
              Favorite
            </label>
            <button
              onClick={() =>
                void action(async () => {
                  await persist();
                  install(forkSpatialDraft(draft, crypto.randomUUID()), 0, false);
                })
              }
            >
              Fork / remix
            </button>
          </section>
          {currentEntity && mode !== "GUIDED" && (
            <SpatialDependencies draft={draft} entityId={currentEntity.id} onChange={replace} />
          )}
          <section>
            <h3>Versions and attachment</h3>
            {!releases.length && <p>Create an immutable version after validation.</p>}
            {releases.map((v) => (
              <button key={v.id} aria-pressed={releaseId === v.id} onClick={() => chooseRelease(v)}>
                v{v.semanticVersion} · {v.entities.length} objects
              </button>
            ))}
            {releaseId && (
              <p>
                <small>Pinned {releases.find((v) => v.id === releaseId)?.checksum.slice(0, 16)}…</small>
                <button
                  onClick={() => {
                    const v = releases.find((v) => v.id === releaseId)!;
                    const { checksum: _checksum, ...content } = v;
                    void _checksum;
                    replace({ ...draft, content });
                  }}
                >
                  Open version in working draft
                </button>
              </p>
            )}
            {loaded.chronicle ? (
              <>
                <label>
                  Attach to Passage
                  <select value={targetBlock} onChange={(e) => setTargetBlock(e.target.value)}>
                    <option value="">Choose a Passage</option>
                    {loaded.chronicle.blocks.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.title}
                        {b.spatialMoment ? ` · pinned v${b.spatialMoment.version.semanticVersion}` : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Contextual narrative override
                  <textarea value={override} onChange={(e) => setOverride(e.target.value)} />
                </label>
                <button
                  disabled={!targetBlock || !releaseId || busy}
                  onClick={() =>
                    void action(async () => {
                      await persist();
                      const before = loaded.chronicle!.blocks.find((b) => b.id === targetBlock)?.spatialMoment ?? null;
                      await api({
                        action: "ATTACH",
                        definitionId: draft.content.definitionId,
                        versionId: releaseId,
                        chronicleId: loaded.chronicle!.id,
                        blockId: targetBlock,
                        autosaveVersion: loaded.chronicle!.autosaveVersion,
                        narrative: override || undefined,
                      });
                      const refreshed = await load();
                      const after = refreshed.chronicle!.blocks.find((b) => b.id === targetBlock)!.spatialMoment!;
                      if (
                        !before ||
                        loaded.items.some((i) =>
                          i.releases.some((v) => v.id === before.version.id && v.checksum === before.version.checksum),
                        )
                      ) {
                        setAttachmentPast([...attachmentPast, { blockId: targetBlock, before, after }].slice(-100));
                        setAttachmentFuture([]);
                      } else
                        setStatus(
                          "Pinned version attached. Imported attachment history remains in its original Chronicle.",
                        );
                      setStatus(
                        "Pinned spatial version attached. Continue Chronicle validation and publication in Creator Studio.",
                      );
                    })
                  }
                >
                  Attach exact version
                </button>
                <button
                  disabled={!attachmentPast.length || busy}
                  onClick={() => restoreAttachment(attachmentPast[attachmentPast.length - 1], "UNDO")}
                >
                  Undo attachment
                </button>
                <button
                  disabled={!attachmentFuture.length || busy}
                  onClick={() => restoreAttachment(attachmentFuture[attachmentFuture.length - 1], "REDO")}
                >
                  Redo attachment
                </button>
                <Link
                  href={`/studio/tales/${encodeURIComponent(loaded.chronicle.id)}/versions`}
                  onClick={(event) => {
                    if (event.ctrlKey || event.metaKey) return;
                    event.preventDefault();
                    if (busy) return;
                    const href = event.currentTarget.href;
                    void action(async () => {
                      await persist();
                      window.location.assign(href);
                    });
                  }}
                >
                  Publish and reopen Chronicle →
                </Link>
              </>
            ) : (
              <p>Open Spatial Studio from a Chronicle Passage to attach an exact release version.</p>
            )}
          </section>
        </aside>
      </div>
      <section className={styles.validation} data-open={validationOpen} aria-label="Drydock spatial validation">
        <h2>Validation and environment previews</h2>
        {localFindings.length ? (
          localFindings.map((finding, i) => (
            <button
              key={i}
              onClick={() => {
                if (finding.entityId) setSelected(finding.entityId);
                setMode("DETAILED");
              }}
            >
              <strong>
                {finding.severity} / {finding.code}
              </strong>{" "}
              {finding.message}
            </button>
          ))
        ) : (
          <p>No blocking static findings. Synthetic previews and physical/owner acceptance are separate.</p>
        )}
        <div className={styles.environments}>
          {simulateSpatialEnvironments(draft.content).map((e) => (
            <button
              key={e.id}
              onClick={() => {
                setEnvironment(e.id);
                setPreview(e.status === "GUIDED_FALLBACK" ? "FALLBACK" : "EDITOR");
              }}
            >
              <strong>{e.name}</strong>
              <span>{e.status.replaceAll("_", " ")}</span>
              <small>{e.reason}</small>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
