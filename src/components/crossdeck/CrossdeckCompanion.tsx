"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { MotionMode } from "@/animation/core/animation-types";
import type { PlayerJournalBlock } from "@/chronicle/journal-contract";
import { experienceProfiles, roleNames } from "@/crossdeck/experiences";
import { roleSchema, type SurfaceRole } from "@/crossdeck/contracts";
import type { Continuity, ObjectRef, TransferMode } from "@/crossdeck/sync-contracts";
import type { SessionState, ConnectionState } from "@/components/player/journal/ChronicleJournalSession";
import { ChronicleJournalPageContent, type JournalAsset } from "@/components/player/journal/ChronicleJournalPage";
import { LandfallJournalChart, LandfallJournalProvider } from "@/components/player/journal/LandfallJournalChart";
import { ChronicleLensEntry, ParallaxJournalProvider } from "@/components/player/parallax/ChronicleLens";
import { useCrossdeckContinuity } from "./CrossdeckContinuity";
import { CrossdeckHandoff, type CrossdeckSyncConnection } from "./CrossdeckHandoff";
import type { CrossdeckConnection } from "./useCrossdeckSession";
import { VoyageContext } from "./VoyageContext";
import styles from "./CrossdeckCompanion.module.css";

type Props = {
  state: SessionState;
  blocks: PlayerJournalBlock[];
  assets: JournalAsset[];
  mode: MotionMode;
  connection: CrossdeckConnection;
  liveConnection: ConnectionState;
  liveNotice: string;
  error: string;
  onRefresh: () => void;
};
type SelectedView = { role: SurfaceRole; blockId: string; context: Continuity; readOnly: boolean };
const familyRoles: Record<ObjectRef["family"], SurfaceRole> = {
  MAP: "CHART",
  NOTE: "JOURNAL",
  ARTIFACT: "ARTIFACT_VIEWER",
};
const objectFamily = (block: PlayerJournalBlock): ObjectRef["family"] | null =>
  block.journalKind === "map"
    ? "MAP"
    : block.journalKind === "artifact"
      ? "ARTIFACT"
      : ["story", "message"].includes(block.journalKind)
        ? "NOTE"
        : null;

function preferredBlock(blocks: PlayerJournalBlock[], role: SurfaceRole, currentId: string | null) {
  const available = blocks.filter((block) =>
    role === "CHRONICLE_LENS"
      ? Boolean(block.presentation.spatialMoment)
      : role === "CHART"
        ? block.journalKind === "map"
        : role === "ARTIFACT_VIEWER"
          ? block.journalKind === "artifact"
          : true,
  );
  return available.find((block) => block.id === currentId) ?? available.at(-1);
}

/** A composition of released domain projections. Device purposes never create progression authority. */
export function CrossdeckCompanion({
  state,
  blocks,
  assets,
  mode,
  connection,
  liveConnection,
  liveNotice,
  error,
  onRefresh,
}: Props) {
  const parsedRole = roleSchema.safeParse(connection.here?.role);
  const role = parsedRole.success ? parsedRole.data : "JOURNAL";
  const [selectedView, setSelectedView] = useState<SelectedView | null>(null);
  const [chartAvailable, setChartAvailable] = useState(false);
  const [textScale, setTextScale] = useState(1);
  const [purposeFocus, setPurposeFocus] = useState<SurfaceRole | null>(null);
  const [purposesOpen, setPurposesOpen] = useState(false);
  const [morePurposesOpen, setMorePurposesOpen] = useState(false);
  const [lensPresented, setLensPresented] = useState(false);
  const [syncConnection, setSyncConnection] = useState<CrossdeckSyncConnection>("connecting");
  const root = useRef<HTMLElement>(null);
  const purposes = useRef<HTMLDetailsElement>(null);
  const morePurposes = useRef<HTMLDetailsElement>(null);
  const workspaceHeading = useRef<HTMLHeadingElement>(null);
  const bridge = useCrossdeckContinuity();
  const receiveGeneration = useRef(0);
  const historical = state.session.status === "COMPLETED" || state.journal.mode === "historical";
  const selected = selectedView?.role === role ? blocks.find((block) => block.id === selectedView.blockId) : undefined;
  const block = selected ?? preferredBlock(blocks, role, state.journal.currentBlockId);
  const passive = Boolean(selected && selectedView?.readOnly);
  // The handheld reader lays both printed-page parts into one readable leaf.
  const readerBlock = block
    ? { ...block, presentation: { ...block.presentation, spreadMode: "right" as const } }
    : undefined;
  const object: ObjectRef | null =
    block && objectFamily(block)
      ? { family: objectFamily(block)!, objectId: block.id, version: state.session.versionId }
      : null;
  const profiles = experienceProfiles({
    lens: blocks.some((item) => Boolean(item.presentation.spatialMoment)),
    chart: chartAvailable,
    artifacts: blocks.some((item) => item.journalKind === "artifact"),
  });
  const profile = profiles.find((item) => item.role === role);
  const allowed = Boolean(profile?.available && parsedRole.success);
  const chronicleHref = `/player/playthroughs/${encodeURIComponent(state.session.id)}/journal`;
  const context: Continuity = {
    blockId: block?.id,
    readingPosition: 0,
    toolMode: role === "CHART" ? "CHART" : role === "ARTIFACT_VIEWER" ? "INSPECT" : "READ",
  };

  useEffect(
    () => () => {
      receiveGeneration.current++;
    },
    [],
  );

  useEffect(() => {
    if (purposeFocus !== role) return;
    if (purposes.current) purposes.current.open = false;
    if (morePurposes.current) morePurposes.current.open = false;
    const frame = requestAnimationFrame(() => {
      // The automatically opened Lens dialog owns focus for its purpose.
      if (role !== "CHRONICLE_LENS") workspaceHeading.current?.focus();
      setPurposeFocus(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [purposeFocus, role]);

  const switchPurpose = async (nextRole: SurfaceRole) => {
    if (!connection.here || connection.busy) return;
    const updated = await connection.act(
      { action: "role", surfaceId: connection.here.surfaceId, role: nextRole },
      `${roleNames[nextRole]} is ready on this device.`,
    );
    if (updated) {
      setSelectedView(null);
      setPurposeFocus(nextRole);
    }
  };

  const resume = async (
    ref: ObjectRef,
    received: Continuity,
    presentation?: { mode: TransferMode; readOnly: boolean },
  ) => {
    const released = blocks.find((item) => item.id === ref.objectId);
    if (
      !released ||
      state.session.versionId !== ref.version ||
      objectFamily(released) !== ref.family ||
      !connection.here
    )
      throw new Error("Refresh the Voyage before opening this view.");
    const generation = ++receiveGeneration.current;
    const nextRole = familyRoles[ref.family];
    if (connection.here.role !== nextRole) {
      const updated = await connection.act(
        { action: "role", surfaceId: connection.here.surfaceId, role: nextRole },
        `${roleNames[nextRole]} received from your other device.`,
      );
      if (!updated) throw new Error("The companion purpose could not be changed.");
    }
    setSelectedView({
      role: nextRole,
      blockId: released.id,
      context: received,
      readOnly: presentation?.readOnly ?? false,
    });
    const displayed = () => {
      const panel = root.current?.querySelector<HTMLElement>("[data-companion-object]");
      if (panel?.dataset.companionObject !== ref.objectId || panel.getBoundingClientRect().width === 0) return false;
      return (
        ref.family !== "MAP" ||
        Boolean(
          bridge?.current &&
            panel.querySelector('[aria-label="Virtual Landfall chart"], [aria-label="Physical Landfall map"]'),
        )
      );
    };
    const started = Date.now();
    while (!displayed() && generation === receiveGeneration.current && Date.now() - started < 8000)
      await new Promise((resolve) => setTimeout(resolve, 40));
    if (generation !== receiveGeneration.current || !displayed())
      throw new Error("The companion view is not ready to receive this item.");
    if (ref.family === "NOTE") {
      const reader = root.current?.querySelector<HTMLElement>("[data-companion-reading]");
      if (reader)
        reader.scrollTop = Math.max(0, reader.scrollHeight - reader.clientHeight) * (received.readingPosition ?? 0);
    }
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  };

  const captureContext = () => {
    const reader = root.current?.querySelector<HTMLElement>("[data-companion-reading]");
    return {
      readingPosition:
        reader && reader.scrollHeight > reader.clientHeight
          ? reader.scrollTop / (reader.scrollHeight - reader.clientHeight)
          : 0,
    };
  };
  const choices = blocks.filter((item) =>
    role === "ARTIFACT_VIEWER"
      ? item.journalKind === "artifact"
      : role === "CHRONICLE_LENS"
        ? Boolean(item.presentation.spatialMoment)
        : role === "CHART"
          ? item.journalKind === "map"
          : true,
  );
  const connected = (liveConnection === "live" || liveConnection === "archived") && syncConnection === "live";
  const offline = liveConnection === "offline" || syncConnection === "offline";
  const accessEnded = liveConnection === "revoked" || syncConnection === "revoked";

  return (
    <LandfallJournalProvider
      sessionId={state.session.id}
      publishedVersionId={state.session.versionId}
      revision={state.session.currentSequence}
      mode={mode}
      passages={blocks}
      historical={historical}
      csrfToken={state.csrfToken ?? connection.csrf}
      loadEnabled
      enabled={role === "CHART" && !passive && !historical && state.session.status === "ACTIVE"}
      onAvailabilityChange={setChartAvailable}
      onProgress={onRefresh}
    >
      <main
        ref={root}
        className={styles.companion}
        data-crossdeck-companion
        data-companion-role={role}
        data-experience-voyage={state.session.id}
        data-experience-version={state.session.versionId}
        data-motion-mode={mode}
      >
        <header className={styles.header}>
          <div className={styles.identity} aria-hidden={lensPresented} inert={lensPresented ? true : undefined}>
            <span className={styles.mark} aria-hidden="true">
              ✦
            </span>
            <div>
              <p className={styles.eyebrow}>
                {connection.here?.label} · {roleNames[role]}
              </p>
              <VoyageContext
                voyage={{ voyageId: state.session.id, versionId: state.session.versionId, title: state.tale.title }}
                heading
              />
            </div>
          </div>
          <Link className={styles.returnLink} href={chronicleHref}>
            Return to Chronicle <span aria-hidden="true">↗</span>
          </Link>
        </header>

        <div className={styles.status} role="status" aria-live="polite">
          <span className={connected ? styles.connected : styles.reconnecting} aria-hidden="true" />
          <span>
            {accessEnded
              ? "This device’s access ended. Reconnect to your Voyage."
              : offline
                ? "Offline · showing your released view"
                : historical
                  ? "Preserved Voyage · released passages"
                  : connected
                    ? "Same Voyage · in sync"
                    : "Reconnecting to your Voyage"}
          </span>
          {!connected && (
            <button type="button" onClick={onRefresh}>
              Retry
            </button>
          )}
        </div>

        <section className={styles.workspace} aria-label={roleNames[role]}>
          <div className={styles.workspaceHeading}>
            <p className={styles.eyebrow}>{historical ? "Voyage record" : "Your companion"}</p>
            <h2 ref={workspaceHeading} tabIndex={-1}>
              {roleNames[role]}
            </h2>
            <p>{profile?.description}</p>
          </div>
          {!allowed ? (
            <div className={styles.empty} role="status">
              <h3>{roleNames[role]} is not ready here</h3>
              <p>{profile?.reason ?? "Choose an available purpose below to continue with this Voyage."}</p>
              <p>Your Chronicle remains available on your main screen.</p>
            </div>
          ) : role === "PRIMARY_STORY" ? (
            <div className={styles.empty}>
              <h3>Continue with the full Chronicle</h3>
              <p>The same released passages and Voyage progress are ready on this device.</p>
              <Link className={styles.primaryAction} href={chronicleHref}>
                Open Chronicle
              </Link>
            </div>
          ) : role === "CHART" ? (
            <div className={styles.content} data-companion-object={block?.id}>
              {passive && (
                <p className={styles.notice}>
                  Read-only companion view. The controlling device keeps this view up to date.
                </p>
              )}
              <LandfallJournalChart compact presentationOnly={passive} />
            </div>
          ) : block ? (
            <>
              {choices.length > 1 && (
                <label className={styles.selector}>
                  {role === "ARTIFACT_VIEWER"
                    ? "Released artifact"
                    : role === "CHRONICLE_LENS"
                      ? "Released spatial moment"
                      : "Released passage"}
                  <select
                    disabled={connection.busy}
                    aria-label={
                      role === "ARTIFACT_VIEWER"
                        ? "Released artifact"
                        : role === "CHRONICLE_LENS"
                          ? "Released spatial moment"
                          : "Released passage"
                    }
                    value={block.id}
                    onChange={(event) =>
                      setSelectedView({ role, blockId: event.target.value, context: {}, readOnly: false })
                    }
                  >
                    {choices.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.title}
                        {item.progress === "active" ? " · current" : ""}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <div className={styles.content} data-companion-object={block.id}>
                {passive && (
                  <p className={styles.notice}>
                    Read-only companion view. The controlling device keeps this view up to date.
                  </p>
                )}
                {role === "CHRONICLE_LENS" && block.presentation.spatialMoment ? (
                  <ParallaxJournalProvider
                    sessionId={state.session.id}
                    csrfToken={state.csrfToken ?? connection.csrf}
                    onLensPresentationChange={setLensPresented}
                    voyageContext={{
                      voyageId: state.session.id,
                      versionId: state.session.versionId,
                      title: state.tale.title,
                    }}
                  >
                    <div className={styles.lensSurface}>
                      <h3>{block.title}</h3>
                      <p>
                        {block.progress === "active" && state.session.status === "ACTIVE"
                          ? "Explore the released spatial clue here while your Chronicle stays open on your main screen."
                          : "Revisit this released spatial moment. Replay keeps your Voyage progress unchanged."}
                      </p>
                      <ChronicleLensEntry
                        key={`${state.session.versionId}:${block.id}:${role}`}
                        moment={block.presentation.spatialMoment}
                        blockId={block.id}
                        replayOnly={historical || block.progress !== "active" || state.session.status !== "ACTIVE"}
                        initiallyOpen
                      />
                      <p className={styles.caption}>
                        Guided View preserves the clue when camera placement is unavailable.
                      </p>
                    </div>
                  </ParallaxJournalProvider>
                ) : (
                  <>
                    <div className={styles.readerControls}>
                      <span>Reading size</span>
                      <button
                        type="button"
                        aria-label="Use standard reading size"
                        aria-pressed={textScale === 1}
                        onClick={() => setTextScale(1)}
                      >
                        A
                      </button>
                      <button
                        type="button"
                        aria-label="Use larger reading size"
                        aria-pressed={textScale === 1.2}
                        onClick={() => setTextScale(1.2)}
                      >
                        A+
                      </button>
                    </div>
                    <article
                      className={styles.reader}
                      data-companion-reading
                      style={{ fontSize: `${textScale}rem` }}
                      aria-label={block.title}
                    >
                      <ChronicleJournalPageContent
                        page={{
                          id: `companion:${block.id}`,
                          kind: "block",
                          density: "soft",
                          label: block.title,
                          folio: block.orderIndex + 1,
                          block: readerBlock,
                          blockId: block.id,
                          chapterId: block.chapterId,
                          part: "primary",
                        }}
                        assets={assets}
                        chart={
                          block.blockType === "livingChart" ? (
                            <LandfallJournalChart compact presentationOnly />
                          ) : undefined
                        }
                      />
                    </article>
                  </>
                )}
              </div>
            </>
          ) : (
            <div className={styles.empty}>
              <h3>Your released passages will appear here</h3>
              <p>Keep this device connected while your Voyage releases its next passage.</p>
            </div>
          )}
        </section>

        <div className={styles.transfer}>
          <CrossdeckHandoff
            voyageId={state.session.id}
            csrfToken={state.csrfToken ?? connection.csrf}
            object={object}
            context={context}
            captureContext={captureContext}
            onConnectionChange={setSyncConnection}
            followingFamily={
              role === "CHART" ? "MAP" : role === "ARTIFACT_VIEWER" ? "ARTIFACT" : role === "JOURNAL" ? "NOTE" : null
            }
            resume={resume}
          />
        </div>

        <details
          ref={purposes}
          className={styles.purposes}
          onToggle={(event) => setPurposesOpen(event.currentTarget.open)}
        >
          <summary role="button" aria-expanded={purposesOpen}>
            Change companion purpose
          </summary>
          <div className={styles.purposeGrid}>
            {profiles
              .filter((item) => !item.advanced)
              .map((item) => (
                <button
                  type="button"
                  key={item.role}
                  aria-label={item.title}
                  disabled={connection.busy || !item.available}
                  aria-pressed={item.role === role}
                  onClick={() => void switchPurpose(item.role)}
                >
                  <strong>{item.title}</strong>
                  <span>{item.available ? item.description : item.reason}</span>
                </button>
              ))}
          </div>
          <details
            ref={morePurposes}
            className={styles.morePurposes}
            onToggle={(event) => setMorePurposesOpen(event.currentTarget.open)}
          >
            <summary role="button" aria-expanded={morePurposesOpen}>
              More purposes
            </summary>
            <div className={styles.purposeGrid}>
              {profiles
                .filter((item) => item.advanced)
                .map((item) => (
                  <button
                    type="button"
                    key={item.role}
                    aria-label={item.title}
                    disabled={connection.busy || !item.available}
                    aria-pressed={item.role === role}
                    onClick={() => void switchPurpose(item.role)}
                  >
                    <strong>{item.title}</strong>
                    <span>{item.available ? item.description : item.reason}</span>
                  </button>
                ))}
            </div>
          </details>
        </details>
        {(connection.message || error) && (
          <p className={styles.notice} role={error ? "alert" : "status"}>
            {error || connection.message}
          </p>
        )}
        <p className="sr-only" aria-live="polite">
          {liveNotice}
        </p>
      </main>
    </LandfallJournalProvider>
  );
}
