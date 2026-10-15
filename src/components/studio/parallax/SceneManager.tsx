"use client";
import { useEffect, useRef, useState } from "react";
import type { SpatialDraft } from "@/parallax/authoring";
import type { SpatialLibraryRecord } from "@/parallax/library-service";
import type { CompatibleEnvironmentRecord } from "@/parallax/environment-library-compatibility";
import { spatialLibraryKind } from "@/parallax/reusable-assets";
import {
  createSceneFromEnvironment,
  environmentVersionName,
  latestEnvironmentVersion,
  reviewSceneEnvironmentImpact,
  sceneEnvironmentId,
  type SceneEnvironmentVersion,
} from "@/parallax/scene-environment-authoring";
import type { compareScenes } from "@/parallax/scene-comparison";
import styles from "./SceneManager.module.css";

type Props = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  preferredEnvironmentId?: string;
  catalogLoading?: boolean;
  catalogError?: string;
  draft: SpatialDraft;
  items: SpatialLibraryRecord[];
  environments: CompatibleEnvironmentRecord[];
  revision: number;
  dirty: boolean;
  disabled: boolean;
  save: () => Promise<void>;
  refresh: () => Promise<unknown>;
  replace: (draft: SpatialDraft) => void;
  openScene: (id: string) => Promise<SpatialDraft>;
  createScene: (draft: SpatialDraft) => Promise<void>;
  duplicateScene: (sourceId: string, title: string, description?: string) => Promise<SpatialDraft>;
  archiveScene: (id: string) => Promise<void>;
  updateEnvironment: (sceneId: string, version: SceneEnvironmentVersion) => Promise<SpatialDraft>;
  compareScene: (targetId: string) => Promise<ReturnType<typeof compareScenes>>;
  editEnvironment: (record: CompatibleEnvironmentRecord) => Promise<void>;
  newEnvironment: (reconstructed: boolean) => Promise<void>;
  preview: () => void;
};
function Thumbnail({ draft }: { draft: SpatialDraft }) {
  return (
    <svg viewBox="0 0 200 110" aria-hidden="true" className={styles.thumbnail}>
      <path d="M20 86V25L100 9 180 25V86L100 103Z" fill="var(--studio-raised)" stroke="var(--studio-border-strong)" />
      <path d="M20 86L100 65 180 86M100 9V65" fill="none" stroke="var(--studio-border)" />
      {draft.content.entities.slice(0, 16).map((entity, index) => (
        <g
          key={entity.id}
          transform={
            "translate(" +
            (50 + (index % 5) * 24 + entity.transform.position.x * 4) +
            "," +
            (38 + Math.floor(index / 5) * 16 + entity.transform.position.z * 3) +
            ")"
          }
        >
          <rect
            width="18"
            height="13"
            rx="2"
            fill={entity.kind === "PARCHMENT" ? "#dac299" : "#9bc3ff"}
            opacity={
              draft.content.studio?.layers.find((layer) => layer.entityId === entity.id)?.visible === false ? 0.35 : 1
            }
          />
          <path d="M4 4H14M4 8H11" stroke="#203044" strokeWidth="1.5" />
        </g>
      ))}
    </svg>
  );
}
function recordName(record: CompatibleEnvironmentRecord) {
  if (record.representation === "LIFECYCLE_V1") return record.working.name;
  return (
    record.working?.content.name ??
    (latestEnvironmentVersion(record) ? environmentVersionName(latestEnvironmentVersion(record)!) : record.id)
  );
}
export function SceneManager(props: Props) {
  const [localOpen, setLocalOpen] = useState(false);
  const open = props.open ?? localOpen;
  const setOpen = props.onOpenChange ?? setLocalOpen;
  const button = useRef<HTMLButtonElement>(null);
  const association = props.environments.find((record) => record.id === sceneEnvironmentId(props.draft));
  const pin = props.draft.content.environment;
  const pinned = association?.versions.find((version) => version.reference.versionId === pin?.versionId);
  const latest = association ? latestEnvironmentVersion(association) : null;
  const close = () => {
    setOpen(false);
    requestAnimationFrame(() => button.current?.focus());
  };
  return (
    <section className={styles.context} aria-label="Environment and Scene">
      <div>
        <small>SHARED ENVIRONMENT</small>
        <strong>
          {pinned
            ? environmentVersionName(pinned)
            : association
              ? recordName(association)
              : (props.draft.content.studio?.environment?.name ??
                (props.catalogLoading
                  ? "Loading Environments…"
                  : pin
                    ? "Referenced Environment unavailable"
                    : "Unassociated Scene"))}
        </strong>
        <span>
          {pin
            ? "Pinned version " + pin.revision
            : association
              ? "Independent working snapshot · no immutable pin"
              : "Choose an Environment in Scene Manager"}
          {pin && latest && latest.reference.revision > pin.revision
            ? " · Version " + latest.reference.revision + " available"
            : ""}
        </span>
      </div>
      <span className={styles.connector} aria-hidden="true">
        →
      </span>
      <div>
        <small>EDITING SCENE</small>
        <strong>{props.draft.content.title}</strong>
        <span>{props.dirty ? "Unsaved changes" : "Working draft saved · revision " + props.revision}</span>
      </div>
      <button ref={button} disabled={props.disabled || props.catalogLoading} onClick={() => setOpen(true)}>
        Manage Scenes
      </button>
      {open && <SceneManagerDialog {...props} close={close} />}
    </section>
  );
}
function SceneManagerDialog(props: Props & { close: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const creationIdentity = useRef<{ key: string; id: string } | null>(null);
  const [environmentId, setEnvironmentId] = useState(
    props.preferredEnvironmentId ??
      sceneEnvironmentId(props.draft) ??
      props.environments.find((record) => !record.archived)?.id ??
      "",
  );
  const [versionId, setVersionId] = useState("");
  const [name, setName] = useState("New Scene"),
    [description, setDescription] = useState("");
  const [sourceId, setSourceId] = useState(""),
    [startingContent, setStartingContent] = useState("BASELINE");
  const [rename, setRename] = useState(props.draft.content.title);
  const [compareId, setCompareId] = useState("");
  const [comparison, setComparison] = useState<ReturnType<typeof compareScenes> | null>(null);
  const [archiveId, setArchiveId] = useState("");
  const [review, setReview] = useState(false),
    [busy, setBusy] = useState(false);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const environment = props.environments.find((record) => record.id === environmentId);
  const target =
    environment?.versions.find((version) => version.reference.versionId === versionId) ??
    (environment ? latestEnvironmentVersion(environment) : null);
  const canCreateFromEnvironment = Boolean(
    target && environment && !environment.archived && (environment.builtin || environment.saveState === "SAVED"),
  );
  const items = props.items.filter((item) => !item.archived && spatialLibraryKind(item.draft) === "SCENES");
  const scenes = items.filter((item) => sceneEnvironmentId(item.draft) === environmentId);
  const activePin = props.draft.content.environment;
  const activeEnvironment = props.environments.find((record) => record.id === sceneEnvironmentId(props.draft));
  const activeVersion = activeEnvironment?.versions.find(
    (version) => version.reference.versionId === activePin?.versionId,
  );
  const semanticFeatureEntries = activeVersion
    ? "content" in activeVersion
      ? activeVersion.content.evidence.candidates
          .filter((feature) => feature.safe && !feature.occluded)
          .map((feature) => ({ id: feature.id, label: feature.id + " · " + feature.surface }))
      : (activeVersion.room?.features ?? [])
          .filter((feature) => feature.classification !== "EXCLUSION_ZONE")
          .flatMap((feature) => [
            { id: feature.id, label: feature.name + " · " + feature.classification },
            ...feature.parts
              .filter((part) => part.surface !== null)
              .map((part) => ({ id: part.id, label: feature.name + " · " + part.surface })),
          ])
    : [];
  const semanticFeatures = [...new Map(semanticFeatureEntries.map((feature) => [feature.id, feature])).values()];
  const actual = (item: SpatialLibraryRecord) =>
    item.id === props.draft.content.definitionId ? props.draft : item.draft;
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  const run = async (work: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    setComparison(null);
    try {
      await work();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "This operation could not finish.");
    } finally {
      setBusy(false);
    }
  };
  const replace = (next: SpatialDraft) => {
    setComparison(null);
    props.replace(next);
  };
  const open = async (id: string) => {
    const next = await props.openScene(id);
    setRename(next.content.title);
    setCompareId("");
    return next;
  };
  const edit = async (record: CompatibleEnvironmentRecord) => {
    await props.save();
    await props.editEnvironment(record);
    props.close();
  };
  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby="scene-manager-title"
      onCancel={(event) => {
        if (busy) event.preventDefault();
        else props.close();
      }}
    >
      <div className={styles.heading}>
        <div>
          <small>PARALLAX / AUTHORING</small>
          <h2 id="scene-manager-title">Environments &amp; Scenes</h2>
          <p>Build the room once. Give every Scene its own story.</p>
        </div>
        <button aria-label="Close Scene Manager" disabled={busy} onClick={props.close}>
          Close
        </button>
      </div>
      {props.catalogError && (
        <div role="alert" className={styles.error}>
          <p>{props.catalogError}</p>
          <button
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await props.refresh();
              })
            }
          >
            Retry Environment catalog
          </button>
        </div>
      )}
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
        <strong>Editing Scene · independent content</strong>
        <span>
          Scene objects, transforms, lighting overrides and behaviors save independently. Environment edits open their
          own workspace.
        </span>
      </div>
      <fieldset disabled={busy} className={styles.controls}>
        <div className={styles.environmentBar}>
          <label>
            Browse Environment
            <select
              value={environmentId}
              onChange={(event) => {
                setEnvironmentId(event.target.value);
                setVersionId("");
                setReview(false);
                setComparison(null);
              }}
            >
              {props.environments
                .filter((record) => !record.archived)
                .map((record) => (
                  <option key={record.id} value={record.id}>
                    {recordName(record)} ·{" "}
                    {record.builtin ? "Built-in" : (record.saveState?.replaceAll("_", " ") ?? "Owned")}
                  </option>
                ))}
            </select>
          </label>
          <button
            disabled={!environment || environment.archived}
            onClick={() =>
              void run(async () => {
                if (environment) await edit(environment);
              })
            }
          >
            {environment?.builtin ? "Edit an owned copy" : "Edit shared Environment"}
          </button>
          <button
            onClick={() =>
              void run(async () => {
                await props.save();
                await props.newEnvironment(false);
                props.close();
              })
            }
          >
            New Environment
          </button>
          <button
            onClick={() =>
              void run(async () => {
                await props.save();
                await props.newEnvironment(true);
                props.close();
              })
            }
          >
            Reconstruct Environment
          </button>
        </div>
        {environment && (
          <p className={styles.description}>
            {environment.representation === "LIFECYCLE_V1"
              ? environment.working.description
              : (environment.working?.content.description ??
                (target && "content" in target ? target.content.description : ""))}
            <span>
              {scenes.length} independent {scenes.length === 1 ? "Scene" : "Scenes"} · {environment.versions.length}{" "}
              immutable Environment versions
            </span>
          </p>
        )}
        {target && "content" in target && !target.content.fixtures.length && (
          <p className={styles.notice}>
            This version has no stored room geometry. Edit the Environment to add shared furniture or architecture.
            Built-in Environments open an owned copy.
          </p>
        )}
        <section aria-label="Create Scene" className={styles.create}>
          <h3>Create a Scene</h3>
          <p>Choose an explicit Environment version or duplicate an existing Scene.</p>
          <div className={styles.fields}>
            <label>
              Scene name
              <input maxLength={120} value={name} onChange={(event) => setName(event.target.value)} />
            </label>
            <label>
              Scene source
              <select value={sourceId} onChange={(event) => setSourceId(event.target.value)}>
                <option value="">Selected Environment baseline</option>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    Duplicate {actual(item).content.title}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Environment source version
            <select
              disabled={!!sourceId || !target}
              value={target?.reference.versionId ?? ""}
              onChange={(event) => {
                setVersionId(event.target.value);
                setReview(false);
              }}
            >
              {!target && <option value="">Create an immutable version in the Environment workspace first</option>}
              {environment?.versions.map((version) => (
                <option key={version.reference.versionId} value={version.reference.versionId}>
                  Version {version.reference.revision} · {environmentVersionName(version)}
                </option>
              ))}
            </select>
          </label>
          {!sourceId && environment && !environment.builtin && environment.saveState !== "SAVED" && (
            <p>Save this Environment to Library before using it for a new Scene.</p>
          )}
          <label>
            Scene starting content
            <select
              disabled={!!sourceId}
              value={startingContent}
              onChange={(event) => setStartingContent(event.target.value)}
            >
              <option value="BASELINE">Environment description only</option>
              <option value="Ghost Footprint Trail">Ghost Footprint Trail · supported markers</option>
              <option value="Peeking Letter">Peeking Letter · supported parchment</option>
              <option value="Hidden Wall Message">Hidden Wall Message · supported text</option>
            </select>
          </label>
          <label>
            Scene description
            <input maxLength={2000} value={description} onChange={(event) => setDescription(event.target.value)} />
          </label>
          <button
            disabled={!name.trim() || (!sourceId && !canCreateFromEnvironment)}
            onClick={() =>
              void run(async () => {
                await props.save();
                if (sourceId) {
                  const next = await props.duplicateScene(sourceId, name.trim(), description.trim() || undefined);
                  setRename(next.content.title);
                  setEnvironmentId(sceneEnvironmentId(next) ?? environmentId);
                } else if (target) {
                  const key = JSON.stringify([name.trim(), description.trim(), target.reference, startingContent]);
                  if (creationIdentity.current?.key !== key)
                    creationIdentity.current = { key, id: crypto.randomUUID() };
                  const next = createSceneFromEnvironment(
                    creationIdentity.current.id,
                    name.trim(),
                    target,
                    props.draft.chronicleId,
                    startingContent,
                  );
                  if (description.trim()) next.content.sceneDescription = description.trim();
                  await props.createScene(next);
                  creationIdentity.current = null;
                  setRename(next.content.title);
                }
                await props.refresh();
                setNotice(name.trim() + " created as an independent working Scene.");
              })
            }
          >
            {sourceId ? "Duplicate Scene" : "Create Scene from baseline"}
          </button>
        </section>
        <section aria-label="Scene gallery">
          <div className={styles.heading}>
            <h3>Scenes in {environment ? recordName(environment) : "this Environment"}</h3>
            <button disabled={!target} aria-expanded={review} onClick={() => setReview(!review)}>
              Review Environment impact
            </button>
          </div>
          {!scenes.length && (
            <p className={styles.empty}>No Scenes use this Environment yet. Create your first Scene above.</p>
          )}
          <div className={styles.gallery}>
            {scenes.map((item) => {
              const scene = actual(item);
              return (
                <article
                  key={item.id}
                  className={styles.card}
                  data-active={item.id === props.draft.content.definitionId}
                >
                  <Thumbnail draft={scene} />
                  <div className={styles.cardBody}>
                    <small>
                      {item.id === props.draft.content.definitionId ? "ACTIVE SCENE" : "INDEPENDENT SCENE"} ·{" "}
                      {item.saveState?.replaceAll("_", " ") ?? "LEGACY REVIEW"}
                    </small>
                    <h4>{scene.content.title}</h4>
                    <p>
                      {scene.content.sceneDescription ||
                        scene.library?.description ||
                        "Authored objects and behaviors in this shared Environment."}
                    </p>
                    <span>
                      {scene.content.entities.length} objects · {item.releases.length} immutable Scene versions ·{" "}
                      {scene.content.environment
                        ? "Environment version " + scene.content.environment.revision
                        : "Working snapshot"}
                    </span>
                    <div className={styles.actions}>
                      <button
                        disabled={item.id === props.draft.content.definitionId}
                        onClick={() =>
                          void run(async () => {
                            await open(item.id);
                          })
                        }
                      >
                        Open {scene.content.title}
                      </button>
                      <button
                        onClick={() => {
                          setSourceId(item.id);
                          setName(scene.content.title.slice(0, 115) + " copy");
                        }}
                      >
                        Use as duplication source
                      </button>
                      <button onClick={() => setArchiveId(item.id)}>Archive {scene.content.title}</button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
          {review && target && (
            <div className={styles.impact} role="region" aria-label="Environment impact review">
              <h4>Review Environment version {target.reference.revision}</h4>
              <p>Published Scene versions stay pinned. Update each working Scene deliberately.</p>
              {scenes.map((item) => {
                const scene = actual(item);
                const previous = environment?.versions.find(
                  (version) => version.reference.versionId === scene.content.environment?.versionId,
                );
                const impact = reviewSceneEnvironmentImpact(scene, target, previous);
                return (
                  <div key={item.id}>
                    <strong>
                      {scene.content.title}: {impact.status.replaceAll("_", " ")}
                    </strong>
                    <p>
                      {impact.fromRevision ?? "Working snapshot"} → {impact.toRevision}
                    </p>
                    {impact.changes.map((message, index) => (
                      <p key={"change-" + index}>{message}</p>
                    ))}
                    {impact.findings.map((finding, index) => (
                      <p key={index}>{finding.message}</p>
                    ))}
                    <button
                      disabled={
                        impact.status !== "REVIEW_REQUIRED" ||
                        (!environment?.builtin && environment?.saveState !== "SAVED")
                      }
                      onClick={() =>
                        void run(async () => {
                          const next = await props.updateEnvironment(item.id, target);
                          setRename(next.content.title);
                          setCompareId("");
                          await props.refresh();
                          setNotice(
                            "Environment update saved for this working Scene. Review the canvas; Undo restores its prior pin. Published versions are unchanged.",
                          );
                        })
                      }
                    >
                      Update and revalidate {scene.content.title}
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
              Archive {items.find((item) => item.id === archiveId)?.draft.content.title}? Immutable versions and
              existing Chronicle bindings remain available.
            </p>
            <button
              onClick={() =>
                void run(async () => {
                  if (archiveId === props.draft.content.definitionId)
                    throw new Error("Open another Scene before archiving the active Scene.");
                  await props.archiveScene(archiveId);
                  await props.refresh();
                  setArchiveId("");
                  setNotice("Scene archived. Its immutable versions are unchanged.");
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
            {props.dirty ? "Unsaved changes" : "Working draft saved"} ·{" "}
            {activeVersion
              ? environmentVersionName(activeVersion)
              : activeEnvironment
                ? recordName(activeEnvironment)
                : "No Environment association"}
          </p>
          <div className={styles.fields}>
            <label>
              Rename active Scene
              <input maxLength={120} value={rename} onChange={(event) => setRename(event.target.value)} />
            </label>
            <button
              disabled={!rename.trim()}
              onClick={() => {
                replace({ ...props.draft, content: { ...props.draft.content, title: rename.trim() } });
                setNotice("Scene renamed. Save or use Undo to restore its name.");
              }}
            >
              Rename Scene
            </button>
          </div>
          <label>
            Scene preview lighting
            <select
              value={props.draft.content.scenePresentation?.lighting ?? "INHERIT"}
              onChange={(event) =>
                replace({
                  ...props.draft,
                  content: {
                    ...props.draft.content,
                    scenePresentation: { lighting: event.target.value as "INHERIT" | "NORMAL" | "LOW" },
                  },
                })
              }
            >
              <option value="INHERIT">Use Environment base lighting</option>
              <option value="NORMAL">Normal · this Scene only</option>
              <option value="LOW">Low · this Scene only</option>
            </select>
          </label>
          <small>Studio preview lighting is independent of physical room illumination.</small>
          <label>
            Active Scene description
            <textarea
              maxLength={2000}
              value={props.draft.content.sceneDescription ?? ""}
              onChange={(event) =>
                replace({ ...props.draft, content: { ...props.draft.content, sceneDescription: event.target.value } })
              }
            />
          </label>
          <div className={styles.actions}>
            <button
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
              onClick={() => {
                props.preview();
                props.close();
              }}
            >
              Preview Scene
            </button>
            <button
              onClick={() =>
                void run(async () => {
                  const next = await props.duplicateScene(
                    props.draft.content.definitionId,
                    props.draft.content.title.slice(0, 115) + " copy",
                  );
                  setRename(next.content.title);
                  await props.refresh();
                  setNotice("Independent Scene copy created.");
                })
              }
            >
              Duplicate active Scene
            </button>
            <button
              disabled={!activeEnvironment || activeEnvironment.archived}
              onClick={() =>
                void run(async () => {
                  if (activeEnvironment) await edit(activeEnvironment);
                })
              }
            >
              Open referenced Environment
            </button>
          </div>
          <details>
            <summary role="button">Scene semantic references</summary>
            <p>
              These references track shared features for version review. Use the canvas placement controls to move
              objects.
            </p>
            {props.draft.content.entities.map((entity) => (
              <label key={entity.id}>
                {"Semantic reference for " + entity.name}
                <select
                  value={
                    props.draft.content.environmentPlacements?.find((placement) => placement.entityId === entity.id)
                      ?.featureId ?? ""
                  }
                  onChange={(event) => {
                    const placements = (props.draft.content.environmentPlacements ?? []).filter(
                      (placement) => placement.entityId !== entity.id,
                    );
                    if (event.target.value) placements.push({ entityId: entity.id, featureId: event.target.value });
                    replace({ ...props.draft, content: { ...props.draft.content, environmentPlacements: placements } });
                  }}
                >
                  <option value="">No explicit feature reference</option>
                  {semanticFeatures.map((feature) => (
                    <option key={feature.id} value={feature.id}>
                      {feature.label}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </details>
          <details>
            <summary role="button">Scene identity &amp; immutable versions</summary>
            <dl>
              <dt>Scene definition</dt>
              <dd>{props.draft.content.definitionId}</dd>
              <dt>Working CAS revision</dt>
              <dd>{props.revision}</dd>
              <dt>Environment version</dt>
              <dd>{activePin?.versionId ?? "Working snapshot or unassociated"}</dd>
              <dt>Environment checksum</dt>
              <dd>{activePin?.checksum ?? "No immutable pin"}</dd>
              <dt>Authored content</dt>
              <dd>
                {props.draft.content.entities.length} objects · {props.draft.content.studio?.behaviors.length ?? 0}{" "}
                behavior rules · {props.draft.content.studio?.animationTracks?.length ?? 0} animation tracks
              </dd>
            </dl>
            <p>
              Environment versions and released Scenes are immutable. Working edits use their own conflict revision.
            </p>
          </details>
        </section>
        <section className={styles.comparison} aria-label="Scene comparison">
          <h3>Compare independent Scenes</h3>
          <label>
            Compare active Scene with
            <select value={compareId} onChange={(event) => setCompareId(event.target.value)}>
              <option value="">Choose a Scene in the same Environment</option>
              {items
                .filter(
                  (item) =>
                    item.id !== props.draft.content.definitionId &&
                    sceneEnvironmentId(item.draft) === sceneEnvironmentId(props.draft),
                )
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.draft.content.title}
                  </option>
                ))}
            </select>
          </label>
          <button
            disabled={!compareId}
            onClick={() =>
              void run(async () => {
                setComparison(await props.compareScene(compareId));
              })
            }
          >
            Compare Scenes
          </button>
          {comparison && (
            <div role="region" aria-label="Scene comparison results">
              <p>
                {comparison.sourceTitle} → {comparison.targetTitle}
              </p>
              {!comparison.differences.length ? (
                <p>No authored differences.</p>
              ) : (
                <ul>
                  {comparison.differences.map((difference, index) => (
                    <li key={index}>
                      <span>{difference.category.replaceAll("_", " ")}</span> {difference.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>
      </fieldset>
    </dialog>
  );
}
