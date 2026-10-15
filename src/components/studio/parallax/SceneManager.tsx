"use client";
import { useEffect, useRef, useState } from "react";
import type { SpatialDraft } from "@/parallax/authoring";
import type { SpatialLibraryRecord } from "@/parallax/library-service";
import type { EnvironmentContent, EnvironmentRecord, EnvironmentVersion } from "@/parallax/environment-contracts";
import { environmentContentSchema } from "@/parallax/environment-contracts";
import {
  createEnvironmentScene,
  duplicateEnvironmentScene,
  environmentFromBaseline,
  reviewEnvironmentImpact,
  updateSceneEnvironment,
} from "@/parallax/environment-authoring";
import type { SceneDifference } from "@/parallax/scene-comparison";
import styles from "./SceneManager.module.css";

type Props = {
  draft: SpatialDraft;
  items: SpatialLibraryRecord[];
  environments: EnvironmentRecord[];
  revision: number;
  dirty: boolean;
  disabled: boolean;
  save: () => Promise<void>;
  refresh: () => Promise<unknown>;
  api: (body: unknown) => Promise<unknown>;
  replace: (draft: SpatialDraft) => void;
  openScene: (id: string) => Promise<SpatialDraft>;
  createScene: (draft: SpatialDraft) => Promise<void>;
  preview: () => void;
};
function Thumbnail({ draft }: { draft: SpatialDraft }) {
  return (
    <svg viewBox="0 0 200 110" aria-hidden="true" className={styles.thumbnail}>
      <path d="M20 86V25L100 9 180 25V86L100 103Z" fill="var(--studio-raised)" stroke="var(--studio-border-strong)" />
      <path d="M20 86L100 65 180 86M100 9V65" fill="none" stroke="var(--studio-border)" />
      {draft.content.entities.slice(0, 16).map((e, i) => (
        <g
          key={e.id}
          transform={`translate(${50 + (i % 5) * 24 + e.transform.position.x * 4},${38 + Math.floor(i / 5) * 16 + e.transform.position.z * 3})`}
        >
          <rect
            width="18"
            height="13"
            rx="2"
            fill={e.kind === "PARCHMENT" ? "#dac299" : "#9bc3ff"}
            opacity={draft.content.studio?.layers.find((l) => l.entityId === e.id)?.visible === false ? 0.35 : 1}
          />
          <path d="M4 4H14M4 8H11" stroke="#203044" strokeWidth="1.5" />
        </g>
      ))}
    </svg>
  );
}
export function SceneManager(props: Props) {
  const [open, setOpen] = useState(false);
  const manageButton = useRef<HTMLButtonElement>(null);
  const close = () => {
    setOpen(false);
    requestAnimationFrame(() => manageButton.current?.focus());
  };
  const association = props.environments.find((e) => e.id === props.draft.content.environment?.environmentId);
  const pinned = association?.versions.find(
    (v) => v.reference.versionId === props.draft.content.environment?.versionId,
  );
  const updateAvailable =
    association &&
    props.draft.content.environment &&
    association.current.reference.revision > props.draft.content.environment.revision;
  return (
    <section className={styles.context} aria-label="Environment and Scene">
      <div>
        <small>SHARED ENVIRONMENT</small>
        <strong>{pinned?.content.name ?? association?.current.content.name ?? "Unassociated Scene"}</strong>
        <span>
          {props.draft.content.environment
            ? `Pinned revision ${props.draft.content.environment.revision}`
            : "Choose an Environment in Scene Manager"}
          {updateAvailable ? ` · Revision ${association.current.reference.revision} available` : ""}
        </span>
      </div>
      <span className={styles.connector} aria-hidden="true">
        →
      </span>
      <div>
        <small>EDITING SCENE</small>
        <strong>{props.draft.content.title}</strong>
        <span>{props.dirty ? "Unsaved changes" : `Saved · revision ${props.revision}`}</span>
      </div>
      <button ref={manageButton} disabled={props.disabled} onClick={() => setOpen(true)}>
        Manage Scenes
      </button>
      {open && <SceneManagerDialog {...props} close={close} />}
    </section>
  );
}
function SceneManagerDialog(props: Props & { close: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [selectedEnvironment, setSelectedEnvironment] = useState(
    props.draft.content.environment?.environmentId ?? props.environments[0]?.id ?? "",
  );
  const [title, setTitle] = useState("New Scene");
  const [description, setDescription] = useState("");
  const [source, setSource] = useState("");
  const [startingContent, setStartingContent] = useState("BASELINE");
  const [rename, setRename] = useState(props.draft.content.title);
  const [compareId, setCompareId] = useState("");
  const [comparison, setComparison] = useState<{
    sourceTitle: string;
    targetTitle: string;
    differences: SceneDifference[];
  } | null>(null);
  const [editing, setEditing] = useState<EnvironmentContent | null>(null);
  const [environmentRevision, setEnvironmentRevision] = useState(0);
  const [environmentPast, setEnvironmentPast] = useState<EnvironmentContent[]>([]);
  const [environmentFuture, setEnvironmentFuture] = useState<EnvironmentContent[]>([]);
  const [importText, setImportText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [archiveId, setArchiveId] = useState("");
  const [review, setReview] = useState(false);
  const environment = props.environments.find((e) => e.id === selectedEnvironment);
  const scenes = props.items.filter((i) => i.draft.content.environment?.environmentId === selectedEnvironment);
  const activePin = props.draft.content.environment;
  const activeEnvironment = props.environments.find((e) => e.id === activePin?.environmentId);
  const activeVersion = activeEnvironment?.versions.find((v) => v.reference.versionId === activePin?.versionId);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (editing) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [editing]);
  const replaceDraft = (next: SpatialDraft) => {
    setComparison(null);
    props.replace(next);
  };
  const openScene = async (id: string) => {
    const current = await props.openScene(id);
    setRename(current.content.title);
    setCompareId("");
    return current;
  };
  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setComparison(null);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "This operation could not finish.");
    } finally {
      setBusy(false);
    }
  };
  const editEnvironment = (next: EnvironmentContent) => {
    if (editing) setEnvironmentPast((p) => [...p.slice(-49), editing]);
    setEditing(next);
    setEnvironmentFuture([]);
  };
  const beginEnvironment = (value: EnvironmentContent, revision: number) => {
    setComparison(null);
    setEditing(structuredClone(value));
    setEnvironmentRevision(revision);
    setEnvironmentPast([]);
    setEnvironmentFuture([]);
  };
  const saveEnvironment = () =>
    run(async () => {
      if (!editing) return;
      const content = environmentContentSchema.safeParse(editing);
      if (!content.success) throw new Error(content.error.issues.map((issue) => issue.message).join(" "));
      await props.save();
      const saved = (await props.api({
        action: "ENVIRONMENT_SAVE",
        environment: content.data,
        revision: environmentRevision,
      })) as EnvironmentVersion;
      setSelectedEnvironment(saved.reference.environmentId);
      setEditing(null);
      await props.refresh();
      setReview(true);
      setNotice(
        "Environment revision saved. Existing Scenes keep their pinned revisions until you review and update each one.",
      );
    });
  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby="scene-manager-title"
      onCancel={(e) => {
        if (editing || busy) {
          e.preventDefault();
          setError("Save or discard the Environment changes before closing.");
        } else props.close();
      }}
    >
      <div className={styles.heading}>
        <div>
          <small>PARALLAX / AUTHORING</small>
          <h2 id="scene-manager-title">Environments &amp; Scenes</h2>
          <p>Build the room once. Give every Scene its own story.</p>
        </div>
        <button aria-label="Close Scene Manager" disabled={busy || Boolean(editing)} onClick={props.close}>
          Close
        </button>
      </div>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className={styles.notice}>
          {notice}
        </p>
      )}
      <div className={styles.mode}>
        <strong>{editing ? "Editing Environment · shared structure" : "Editing Scene · independent content"}</strong>
        <span>
          {editing
            ? "Saving creates a new Environment revision. Scenes update only after review."
            : "Scene objects, transforms and behaviors are saved independently."}
        </span>
      </div>
      <fieldset disabled={busy} className={styles.controls}>
        {editing ? (
          <section aria-label="Environment editor" className={styles.editor}>
            <div className={styles.heading}>
              <h3>{environmentRevision ? "Edit shared Environment" : "New owned Environment"}</h3>
              <span>Unsaved Environment changes</span>
            </div>
            <label>
              Environment name
              <input
                maxLength={160}
                value={editing.name}
                onChange={(e) => editEnvironment({ ...editing, name: e.target.value })}
              />
            </label>
            <label>
              Environment description
              <textarea
                maxLength={2000}
                value={editing.description}
                onChange={(e) => editEnvironment({ ...editing, description: e.target.value })}
              />
            </label>
            <div className={styles.fields}>
              <label>
                Room width (m)
                <input
                  type="number"
                  min={2}
                  max={20}
                  step={0.1}
                  value={editing.width}
                  onChange={(e) => editEnvironment({ ...editing, width: Number(e.target.value) })}
                />
              </label>
              <label>
                Room depth (m)
                <input
                  type="number"
                  min={2}
                  max={20}
                  step={0.1}
                  value={editing.depth}
                  onChange={(e) => editEnvironment({ ...editing, depth: Number(e.target.value) })}
                />
              </label>
              <label>
                Base lighting
                <select
                  value={editing.light}
                  onChange={(e) => editEnvironment({ ...editing, light: e.target.value as "NORMAL" | "LOW" })}
                >
                  <option value="NORMAL">Normal</option>
                  <option value="LOW">Low</option>
                </select>
              </label>
            </div>
            <label>
              <input
                type="checkbox"
                checked={editing.horizontal}
                onChange={(e) =>
                  editEnvironment({
                    ...editing,
                    horizontal: e.target.checked,
                    evidence: {
                      ...editing.evidence,
                      candidates: e.target.checked
                        ? editing.evidence.candidates
                        : editing.evidence.candidates.filter((c) => !["TABLE", "DESK", "SHELF"].includes(c.surface)),
                    },
                  })
                }
              />{" "}
              Horizontal furniture surfaces
            </label>
            <label>
              <input
                type="checkbox"
                checked={editing.vertical}
                onChange={(e) =>
                  editEnvironment({
                    ...editing,
                    vertical: e.target.checked,
                    evidence: {
                      ...editing.evidence,
                      candidates: e.target.checked
                        ? editing.evidence.candidates
                        : editing.evidence.candidates.filter((c) => c.surface !== "WALL"),
                    },
                  })
                }
              />{" "}
              Architectural walls
            </label>
            <h4>Shared furniture &amp; structure</h4>
            {editing.fixtures.map((fixture, index) => (
              <div className={styles.fixture} key={fixture.id}>
                <label>
                  Fixture name
                  <input
                    value={fixture.name}
                    onChange={(e) =>
                      editEnvironment({
                        ...editing,
                        fixtures: editing.fixtures.map((f, i) => (i === index ? { ...f, name: e.target.value } : f)),
                      })
                    }
                  />
                </label>
                <label>
                  Fixture X (m)
                  <input
                    type="number"
                    step={0.1}
                    value={fixture.position.x}
                    onChange={(e) =>
                      editEnvironment({
                        ...editing,
                        fixtures: editing.fixtures.map((f, i) =>
                          i === index ? { ...f, position: { ...f.position, x: Number(e.target.value) } } : f,
                        ),
                      })
                    }
                  />
                </label>
                <button
                  onClick={() =>
                    editEnvironment({ ...editing, fixtures: editing.fixtures.filter((_, i) => i !== index) })
                  }
                >
                  Remove {fixture.name}
                </button>
              </div>
            ))}
            <button
              disabled={editing.fixtures.length >= 32}
              onClick={() =>
                editEnvironment({
                  ...editing,
                  fixtures: [
                    ...editing.fixtures,
                    {
                      id: crypto.randomUUID(),
                      name: "Bed",
                      kind: "FURNITURE",
                      position: { x: 0, y: 0.35, z: 0 },
                      size: { x: 1.4, y: 0.5, z: 1.8 },
                      color: "#65778d",
                    },
                  ],
                })
              }
            >
              Add shared furniture
            </button>
            <details>
              <summary>Shared semantic features &amp; constraints</summary>
              {editing.evidence.candidates.map((feature, index) => (
                <div className={styles.fixture} key={feature.id}>
                  <span>
                    {feature.id} · {feature.surface} · {feature.safe ? "Safe" : "Excluded"}
                  </span>
                  <label>
                    {`Semantic feature ${feature.id} X (m)`}
                    <input
                      type="number"
                      step={0.1}
                      value={feature.position.x}
                      onChange={(e) =>
                        editEnvironment({
                          ...editing,
                          evidence: {
                            ...editing.evidence,
                            candidates: editing.evidence.candidates.map((c, i) =>
                              i === index ? { ...c, position: { ...c.position, x: Number(e.target.value) } } : c,
                            ),
                          },
                        })
                      }
                    />
                  </label>
                  <button
                    onClick={() =>
                      editEnvironment({
                        ...editing,
                        evidence: {
                          ...editing.evidence,
                          candidates: editing.evidence.candidates.filter((_, i) => i !== index),
                        },
                      })
                    }
                  >
                    Remove feature {feature.id}
                  </button>
                </div>
              ))}
            </details>
            <p>
              {editing.evidence.candidates.length} semantic features ·{" "}
              {editing.origin === "RECONSTRUCTED" ? "Imported reconstructed geometry" : "Synthetic authored geometry"}.
              No physical tracking qualification is implied.
            </p>
            <div className={styles.actions}>
              <button
                disabled={busy || !environmentPast.length}
                onClick={() => {
                  setEnvironmentFuture((f) => [editing, ...f]);
                  setEditing(environmentPast.at(-1)!);
                  setEnvironmentPast((p) => p.slice(0, -1));
                }}
              >
                Undo Environment edit
              </button>
              <button
                disabled={busy || !environmentFuture.length}
                onClick={() => {
                  setEnvironmentPast((p) => [...p, editing]);
                  setEditing(environmentFuture[0]);
                  setEnvironmentFuture((f) => f.slice(1));
                }}
              >
                Redo Environment edit
              </button>
              <button disabled={busy} onClick={() => void saveEnvironment()}>
                Save Environment revision
              </button>
              <button disabled={busy} onClick={() => setEditing(null)}>
                Discard Environment changes
              </button>
            </div>
          </section>
        ) : (
          <>
            <div className={styles.environmentBar}>
              <label>
                Browse Environment
                <select
                  value={selectedEnvironment}
                  onChange={(e) => {
                    setSelectedEnvironment(e.target.value);
                    setReview(false);
                    setComparison(null);
                  }}
                >
                  {props.environments.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.current.content.name} ·{" "}
                      {e.builtin
                        ? "Built-in"
                        : e.current.content.origin === "RECONSTRUCTED"
                          ? "Reconstructed"
                          : "Saved"}{" "}
                      · r{e.current.reference.revision}
                    </option>
                  ))}
                </select>
              </label>
              <button
                disabled={busy || !environment}
                onClick={() => {
                  if (!environment) return;
                  beginEnvironment(
                    environment.builtin
                      ? {
                          ...structuredClone(environment.current.content),
                          id: crypto.randomUUID(),
                          origin: "MANUAL",
                          name: `${environment.current.content.name} copy`,
                          sourceLabel: environment.current.content.sourceLabel,
                        }
                      : environment.current.content,
                    environment.builtin ? 0 : environment.current.reference.revision,
                  );
                }}
              >
                {environment?.builtin ? "Edit an owned copy" : "Edit Environment"}
              </button>
              <button
                disabled={busy}
                onClick={() => beginEnvironment(environmentFromBaseline(crypto.randomUUID(), "bedroom"), 0)}
              >
                New Environment
              </button>
            </div>
            {environment && (
              <p className={styles.description}>
                {environment.current.content.description}{" "}
                <span>
                  {scenes.length} saved {scenes.length === 1 ? "Scene" : "Scenes"} · Shared structure r
                  {environment.current.reference.revision}
                </span>
              </p>
            )}
            <details className={styles.import}>
              <summary>Use a reconstructed Environment</summary>
              <p>
                Import reviewed geometry metadata from an existing reconstruction. Images and provider credentials are
                not accepted.
              </p>
              <label>
                Reconstructed Environment JSON
                <textarea value={importText} onChange={(e) => setImportText(e.target.value)} />
              </label>
              <button
                disabled={busy || !importText.trim()}
                onClick={() =>
                  void run(async () => {
                    const raw = JSON.parse(importText);
                    const imported = environmentContentSchema.parse({
                      ...raw,
                      id: crypto.randomUUID(),
                      origin: "RECONSTRUCTED",
                    });
                    beginEnvironment(imported, 0);
                  })
                }
              >
                Review imported Environment
              </button>
            </details>
            <section aria-label="Create Scene" className={styles.create}>
              <div>
                <h3>Create a Scene</h3>
                <p>Choose a baseline or duplicate a Scene. Shared Environment geometry is referenced once.</p>
              </div>
              <div className={styles.fields}>
                <label>
                  Scene name
                  <input maxLength={240} value={title} onChange={(e) => setTitle(e.target.value)} />
                </label>
                <label>
                  Scene source
                  <select value={source} onChange={(e) => setSource(e.target.value)}>
                    <option value="">Selected Environment baseline</option>
                    {props.items.map((i) => (
                      <option key={i.id} value={i.id}>
                        Duplicate {i.draft.content.title}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                Scene starting content
                <select
                  value={startingContent}
                  disabled={Boolean(source)}
                  onChange={(e) => setStartingContent(e.target.value)}
                >
                  <option value="BASELINE">Environment description only</option>
                  <option value="Ghost Footprint Trail">Ghost Footprint Trail · supported markers</option>
                  <option value="Peeking Letter">Peeking Letter · supported parchment</option>
                  <option value="Hidden Wall Message">Hidden Wall Message · supported text</option>
                </select>
              </label>
              <label>
                Scene description
                <input maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} />
              </label>
              <button
                disabled={busy || !title.trim() || (!source && !environment)}
                onClick={() =>
                  void run(async () => {
                    await props.save();
                    const from = props.items.find((i) => i.id === source);
                    const next = from
                      ? duplicateEnvironmentScene(
                          from.id === props.draft.content.definitionId ? props.draft : from.draft,
                          crypto.randomUUID(),
                          title.trim(),
                        )
                      : createEnvironmentScene(
                          crypto.randomUUID(),
                          title.trim(),
                          environment!.current,
                          props.draft.chronicleId,
                          startingContent,
                        );
                    if (!next.content.environment && environment)
                      next.content.environment = structuredClone(environment.current.reference);
                    next.content.sceneDescription = description.trim() || next.content.sceneDescription;
                    await props.createScene(next);
                    setRename(next.content.title);
                    setSelectedEnvironment(next.content.environment!.environmentId);
                    setNotice(`${next.content.title} created and saved independently.`);
                  })
                }
              >
                {source ? "Duplicate Scene" : "Create Scene from baseline"}
              </button>
            </section>
            <section aria-label="Scene gallery">
              <div className={styles.heading}>
                <h3>Scenes in {environment?.current.content.name ?? "this Environment"}</h3>
                <button disabled={busy || !environment} onClick={() => setReview(!review)} aria-expanded={review}>
                  Review Environment impact
                </button>
              </div>
              {!scenes.length && (
                <p className={styles.empty}>No saved Scenes use this Environment yet. Create your first Scene above.</p>
              )}
              <div className={styles.gallery}>
                {scenes.map((item) => (
                  <article
                    key={item.id}
                    className={styles.card}
                    data-active={item.id === props.draft.content.definitionId}
                  >
                    <Thumbnail draft={item.id === props.draft.content.definitionId ? props.draft : item.draft} />
                    <div className={styles.cardBody}>
                      <small>
                        {item.id === props.draft.content.definitionId ? "ACTIVE SCENE" : "INDEPENDENT SCENE"} ·
                        Environment r{item.draft.content.environment?.revision}
                      </small>
                      <h4>{item.draft.content.title}</h4>
                      <p>
                        {item.draft.content.sceneDescription ||
                          "Authored objects and behaviors in this shared Environment."}
                      </p>
                      <span>
                        {item.draft.content.entities.length} objects · {item.releases.length} immutable versions
                      </span>
                      <div className={styles.actions}>
                        <button
                          disabled={busy || item.id === props.draft.content.definitionId}
                          onClick={() =>
                            void run(async () => {
                              await openScene(item.id);
                              setComparison(null);
                            })
                          }
                        >
                          Open {item.draft.content.title}
                        </button>
                        <button
                          disabled={busy}
                          onClick={() => {
                            setSource(item.id);
                            setTitle(`${item.draft.content.title} copy`);
                          }}
                        >
                          Use as duplication source
                        </button>
                        <button disabled={busy} onClick={() => setArchiveId(item.id)}>
                          Archive
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
              {review && environment && (
                <div className={styles.impact} role="region" aria-label="Environment impact review">
                  <h4>Review revision {environment.current.reference.revision}</h4>
                  <p>Published Scene versions stay pinned. Update each working Scene deliberately.</p>
                  {scenes.map((item) => {
                    const impact = reviewEnvironmentImpact(
                      item.id === props.draft.content.definitionId ? props.draft : item.draft,
                      environment.current,
                      environment.versions.find(
                        (v) => v.reference.versionId === item.draft.content.environment?.versionId,
                      ),
                    );
                    return (
                      <div key={item.id}>
                        <strong>
                          {item.draft.content.title}: {impact.status.replaceAll("_", " ")}
                        </strong>
                        <p>
                          r{impact.fromRevision} → r{impact.toRevision}
                        </p>
                        {impact.changes.map((message, i) => (
                          <p key={`change-${i}`}>{message}</p>
                        ))}
                        {impact.findings.map((f, i) => (
                          <p key={i}>{f.message}</p>
                        ))}
                        <button
                          disabled={busy || impact.status !== "REVIEW_REQUIRED"}
                          onClick={() =>
                            void run(async () => {
                              await props.save();
                              const current =
                                item.id === props.draft.content.definitionId ? props.draft : await openScene(item.id);
                              const result = updateSceneEnvironment(current, environment.current);
                              replaceDraft(result);
                              setNotice(
                                "Environment update applied to this working Scene. Review the canvas and save; Undo restores its prior pin.",
                              );
                            })
                          }
                        >
                          Update and revalidate {item.draft.content.title}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
            {archiveId && (
              <div className={styles.confirm} role="group" aria-label="Confirm Scene archive">
                <p>
                  Archive {props.items.find((i) => i.id === archiveId)?.draft.content.title}? Its immutable versions and
                  existing Chronicle bindings are retained.
                </p>
                <button
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      if (archiveId === props.draft.content.definitionId)
                        throw new Error("Open another Scene before archiving the active Scene.");
                      await props.save();
                      const item = props.items.find((i) => i.id === archiveId)!;
                      await props.api({ action: "SCENE_ARCHIVE", definitionId: item.id, revision: item.revision });
                      setArchiveId("");
                      await props.refresh();
                      setNotice("Scene archived. Released versions remain unchanged.");
                    })
                  }
                >
                  Confirm archive
                </button>
                <button onClick={() => setArchiveId("")}>Cancel archive</button>
              </div>
            )}
            <section className={styles.active} aria-label="Active Scene information">
              <h3>Active Scene · {props.draft.content.title}</h3>
              <p>
                {props.dirty ? "Unsaved changes" : "Saved"} ·{" "}
                {activeVersion?.content.name ?? "No Environment association"}{" "}
                {activePin ? `r${activePin.revision}` : ""}
              </p>
              <div className={styles.fields}>
                <label>
                  Rename active Scene
                  <input maxLength={240} value={rename} onChange={(e) => setRename(e.target.value)} />
                </label>
                <button
                  disabled={busy || !rename.trim()}
                  onClick={() => {
                    replaceDraft({ ...props.draft, content: { ...props.draft.content, title: rename.trim() } });
                    setNotice("Scene renamed. Save or use Undo to restore its name.");
                  }}
                >
                  Rename Scene
                </button>
              </div>
              <label>
                Scene preview lighting
                <select
                  aria-describedby="scene-preview-lighting-help"
                  value={props.draft.content.scenePresentation?.lighting ?? "INHERIT"}
                  onChange={(e) =>
                    replaceDraft({
                      ...props.draft,
                      content: {
                        ...props.draft.content,
                        scenePresentation: { lighting: e.target.value as "INHERIT" | "NORMAL" | "LOW" },
                      },
                    })
                  }
                >
                  <option value="INHERIT">Use Environment base lighting</option>
                  <option value="NORMAL">Normal · this Scene only</option>
                  <option value="LOW">Low · this Scene only</option>
                </select>
              </label>
              <small id="scene-preview-lighting-help">
                Studio preview lighting is independent of physical room illumination.
              </small>
              <label>
                Active Scene description
                <textarea
                  value={props.draft.content.sceneDescription ?? ""}
                  maxLength={2000}
                  onChange={(e) =>
                    replaceDraft({
                      ...props.draft,
                      content: { ...props.draft.content, sceneDescription: e.target.value },
                    })
                  }
                />
              </label>
              <div className={styles.actions}>
                <button
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await props.save();
                      await props.refresh();
                      setNotice("Scene saved.");
                    })
                  }
                >
                  Save Scene
                </button>
                <button
                  disabled={busy}
                  onClick={() => {
                    props.preview();
                    props.close();
                  }}
                >
                  Preview Scene
                </button>
                <button
                  disabled={busy || !activePin}
                  onClick={() =>
                    void run(async () => {
                      await props.save();
                      const next = duplicateEnvironmentScene(
                        props.draft,
                        crypto.randomUUID(),
                        `${props.draft.content.title} copy`,
                      );
                      await props.createScene(next);
                      setRename(next.content.title);
                      setNotice("Independent Scene copy created and saved.");
                    })
                  }
                >
                  Duplicate active Scene
                </button>
                <button
                  disabled={busy || !activeEnvironment}
                  onClick={() => {
                    setSelectedEnvironment(activeEnvironment!.id);
                    beginEnvironment(
                      activeEnvironment!.builtin
                        ? {
                            ...structuredClone(activeEnvironment!.current.content),
                            id: crypto.randomUUID(),
                            origin: "MANUAL",
                            name: `${activeEnvironment!.current.content.name} copy`,
                          }
                        : activeEnvironment!.current.content,
                      activeEnvironment!.builtin ? 0 : activeEnvironment!.current.reference.revision,
                    );
                  }}
                >
                  Open referenced Environment
                </button>
              </div>
              <details>
                <summary>Scene semantic references</summary>
                <p>
                  Track shared features for revision review. This declaration does not move the object; ordinary
                  transform and semantic placement controls remain available in the canvas.
                </p>
                {props.draft.content.entities.map((entity) => (
                  <label key={entity.id}>
                    {`Semantic reference for ${entity.name}`}
                    <select
                      value={
                        props.draft.content.environmentPlacements?.find((p) => p.entityId === entity.id)?.featureId ??
                        ""
                      }
                      onChange={(e) => {
                        const placements = (props.draft.content.environmentPlacements ?? []).filter(
                          (p) => p.entityId !== entity.id,
                        );
                        if (e.target.value) placements.push({ entityId: entity.id, featureId: e.target.value });
                        replaceDraft({
                          ...props.draft,
                          content: { ...props.draft.content, environmentPlacements: placements },
                        });
                      }}
                    >
                      <option value="">No explicit feature reference</option>
                      {activeVersion?.content.evidence.candidates
                        .filter((c) => c.safe)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.id} · {c.surface}
                          </option>
                        ))}
                    </select>
                  </label>
                ))}
              </details>
              <details>
                <summary>Scene identity &amp; immutable versions</summary>
                <dl>
                  <dt>Scene definition</dt>
                  <dd>{props.draft.content.definitionId}</dd>
                  <dt>Saved Scene revision</dt>
                  <dd>{props.revision}</dd>
                  <dt>Environment version</dt>
                  <dd>{activePin?.versionId ?? "Unassociated"}</dd>
                  <dt>Environment checksum</dt>
                  <dd>{activePin?.checksum ?? "Unassociated"}</dd>
                </dl>
                <p>
                  Objects, behaviors, interactions and presentation belong to this Scene. Furniture, surfaces and
                  architecture belong to the Environment.
                </p>
              </details>
              <div className={styles.fields}>
                <label>
                  Associate active Scene with Environment
                  <select value={selectedEnvironment} onChange={(e) => setSelectedEnvironment(e.target.value)}>
                    {props.environments.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.current.content.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  disabled={busy || !environment}
                  onClick={() =>
                    void run(async () => {
                      replaceDraft(updateSceneEnvironment(props.draft, environment!.current));
                      setNotice(
                        "Environment association changed only for the active working Scene. Save or Undo this change.",
                      );
                    })
                  }
                >
                  Review &amp; associate active Scene
                </button>
              </div>
            </section>
            <section aria-label="Scene comparison">
              <h3>Compare Scenes</h3>
              <p>Compare independent content within the same Environment, including different pinned revisions.</p>
              <div className={styles.fields}>
                <label>
                  Compare active Scene with
                  <select
                    value={compareId}
                    onChange={(e) => {
                      setCompareId(e.target.value);
                      setComparison(null);
                    }}
                  >
                    <option value="">Choose another Scene</option>
                    {props.items
                      .filter(
                        (i) =>
                          i.id !== props.draft.content.definitionId &&
                          activePin &&
                          i.draft.content.environment?.environmentId === activePin.environmentId,
                      )
                      .map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.draft.content.title}
                        </option>
                      ))}
                  </select>
                </label>
                <button
                  disabled={busy || !compareId}
                  onClick={() =>
                    void run(async () => {
                      const result = await props.api({
                        action: "SCENE_COMPARE",
                        draft: props.draft,
                        targetDefinitionId: compareId,
                      });
                      setComparison(result as NonNullable<typeof comparison>);
                    })
                  }
                >
                  Compare Scenes
                </button>
              </div>
              {comparison && (
                <div className={styles.comparison} role="status">
                  <strong>
                    {comparison.sourceTitle} → {comparison.targetTitle}
                  </strong>
                  {comparison.differences.length ? (
                    <ul>
                      {comparison.differences.map((d, i) => (
                        <li key={i}>
                          <span>{d.category.replaceAll("_", " ")}</span> {d.message}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>No authored differences.</p>
                  )}
                  <p>Only supported authored fields are compared; this is not a physical rendering qualification.</p>
                </div>
              )}
            </section>
          </>
        )}
      </fieldset>
    </dialog>
  );
}
