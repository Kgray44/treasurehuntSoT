"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { SceneHost, useRuntimeOwnedSceneTarget, useSceneTargetRegistration } from "@/animation/hosts/SceneHost";
import { useOptionalSceneHost } from "@/animation/hosts/SceneHostContext";
import type { SceneHostHandle, SceneTargetHandle } from "@/animation/hosts/scene-host-types";
import { useMotionMode } from "@/animation/motion/useMotionMode";
import { consumeOneShot, hasConsumedOneShot, platformOneShotKey } from "@/animation/platform/one-shot";
import { platformMotionEasing, resolvePlatformMotionToken } from "@/animation/platform/motion-tokens";
import { PageFlipBook, type FlipBookPage } from "@/components/animation/PageFlipBook";
import type { ClientProgressEvent, PublicLogEntry, PublicSnapshot } from "@/domain/story";
import type { CompanionView } from "./types";

export type ShipsLogTargetKind = "log-day-layout" | "log-row" | "fresh-ink" | "log-date" | "log-symbol";

export type ShipsLogTargetRegistration = Readonly<{
  kind: ShipsLogTargetKind;
  key: PublicLogEntry["key"];
  host: SceneHostHandle | null;
  handle: SceneTargetHandle | null;
}>;

export type ShipsLogProps = Readonly<{
  snapshot: PublicSnapshot;
  navigate: (view: CompanionView) => void;
  /** Exact immutable ProgressEvent identity; PublicLogEntry.key is the same event id. */
  progressEventId?: ClientProgressEvent["id"];
  /** Gives the progression-host integrator the source host and exact target handle needed for a bounded export. */
  onTargetRegistrationChange?: (registration: ShipsLogTargetRegistration) => void;
}>;

/** The log only becomes a physical book when its history is genuinely long. */
const LOG_BOOK_DAY_THRESHOLD = 7;
const LOG_BOOK_ENTRY_THRESHOLD = 24;
const LOG_BOOK_PAGE_ENTRY_CAPACITY = 12;

function useReportTarget(
  kind: ShipsLogTargetKind,
  key: PublicLogEntry["key"],
  handle: SceneTargetHandle | null,
  report: ShipsLogProps["onTargetRegistrationChange"],
) {
  const host = useOptionalSceneHost();

  useEffect(() => {
    if (!report || !host || !handle) return;
    report({ kind, key, host, handle });
    return () => report({ kind, key, host: null, handle: null });
  }, [handle, host, key, kind, report]);
}

function LogEntryRow({
  entry,
  isProgressEntry,
  navigate,
  report,
}: Readonly<{
  entry: PublicLogEntry;
  isProgressEntry: boolean;
  navigate: ShipsLogProps["navigate"];
  report: ShipsLogProps["onTargetRegistrationChange"];
}>) {
  const { mode } = useMotionMode();
  const entryMotion = resolvePlatformMotionToken("layout", mode);
  const offlineEntryKey = platformOneShotKey("offline-log-entry", entry.key, entry.sequence);
  const animateOfflineEntry =
    Boolean(entry.synchronization) &&
    mode !== "reduced" &&
    typeof window !== "undefined" &&
    !hasConsumedOneShot(offlineEntryKey);
  useEffect(() => {
    if (entry.synchronization && mode === "reduced") consumeOneShot(offlineEntryKey);
  }, [entry.synchronization, mode, offlineEntryKey]);
  const rowTarget = useMemo(
    () => ({
      targetKey: `log-event:${entry.key}:row`,
      part: "log-row",
      runtime: "motion" as const,
      allowedProperties: ["layout"] as const,
      properties: ["layout"] as const,
    }),
    [entry.key],
  );
  const inkTarget = useMemo(
    () => ({
      targetKey: `log-event:${entry.key}:fresh-ink`,
      part: isProgressEntry ? "log-entry-new" : "log-entry-ink",
      ownerHint: "gsap" as const,
      allowedProperties: ["opacity", "clip-path", "filter"] as const,
    }),
    [entry.key, isProgressEntry],
  );
  const dateTarget = useMemo(
    () => ({
      targetKey: `log-event:${entry.key}:date-stamp`,
      part: isProgressEntry ? "log-date-new" : "log-date",
      ownerHint: "gsap" as const,
      allowedProperties: ["opacity", "filter"] as const,
    }),
    [entry.key, isProgressEntry],
  );
  const symbolTarget = useMemo(
    () => ({
      targetKey: `log-event:${entry.key}:symbol`,
      part: isProgressEntry ? "log-symbol-new" : "log-symbol",
      ownerHint: "gsap" as const,
      allowedProperties: ["transform", "scale", "rotate", "opacity"] as const,
    }),
    [entry.key, isProgressEntry],
  );
  const {
    bindTarget: bindRowTarget,
    handle: rowHandle,
    ownershipReady: rowOwnershipReady,
  } = useRuntimeOwnedSceneTarget(rowTarget);
  const { bindTarget: bindInkTarget, handle: inkHandle } = useSceneTargetRegistration(inkTarget);
  const { bindTarget: bindDateTarget, handle: dateHandle } = useSceneTargetRegistration(dateTarget);
  const { bindTarget: bindSymbolTarget, handle: symbolHandle } = useSceneTargetRegistration(symbolTarget);
  useReportTarget("log-row", entry.key, rowHandle, report);
  useReportTarget("fresh-ink", entry.key, inkHandle, report);
  useReportTarget("log-date", entry.key, dateHandle, report);
  useReportTarget("log-symbol", entry.key, symbolHandle, report);

  return (
    <motion.li
      ref={bindRowTarget}
      {...(rowOwnershipReady ? { layout: true } : {})}
      className={`${entry.importance} ${entry.unseen ? "unseen" : ""}`}
      data-scene-part="log-row"
      data-motion-layout-boundary
      data-motion-ownership={rowOwnershipReady ? "ready" : "static"}
      data-log-entry-key={entry.key}
      data-event-id={entry.key}
      data-progress-target={isProgressEntry ? "true" : undefined}
      data-offline-synchronized={entry.synchronization ? "true" : undefined}
      data-synchronized-at={entry.synchronization?.synchronizedAt}
      {...(animateOfflineEntry && rowOwnershipReady
        ? {
            initial: { opacity: 0, y: entryMotion.distancePx, scale: 1 - entryMotion.scaleDelta },
            animate: { opacity: 1, y: 0, scale: 1 },
            exit: { opacity: 0, y: 0, scale: 1 },
            transition: { duration: entryMotion.durationSeconds, ease: platformMotionEasing("layout") },
            onAnimationComplete: () => consumeOneShot(offlineEntryKey),
          }
        : {})}
      style={{ position: "relative" }}
    >
      <span
        ref={bindInkTarget}
        className="log-fresh-ink"
        data-scene-part={isProgressEntry ? "log-entry-new" : "log-entry-ink"}
        data-gsap-visual-boundary
        data-log-ink-key={entry.key}
        data-event-id={entry.key}
        aria-hidden="true"
        style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      />
      <span
        ref={bindDateTarget}
        className="log-date-stamp"
        data-scene-part={isProgressEntry ? "log-date-new" : "log-date"}
        data-gsap-visual-boundary
        data-log-date-key={entry.key}
        data-event-id={entry.key}
        aria-hidden="true"
        style={{ pointerEvents: "none" }}
      >
        {new Date(entry.timestamp).toLocaleDateString([], { month: "short", day: "numeric" })}
      </span>
      <span
        ref={bindSymbolTarget}
        className="log-symbol"
        data-scene-part={isProgressEntry ? "log-symbol-new" : "log-symbol"}
        data-gsap-visual-boundary
        data-log-symbol-key={entry.key}
        data-event-id={entry.key}
        aria-hidden="true"
        style={{ pointerEvents: "none" }}
      >
        {entry.symbol}
      </span>
      <div>
        <time dateTime={entry.timestamp}>
          {new Date(entry.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </time>
        <h4>{entry.title}</h4>
        <p>{entry.summary}</p>
        {entry.synchronization ? (
          <small className="log-offline-synchronization">
            Added after reconnect · server synchronized{" "}
            <time dateTime={entry.synchronization.synchronizedAt}>
              {new Date(entry.synchronization.synchronizedAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </time>
          </small>
        ) : null}
        {entry.section !== "log" && (
          <button type="button" onClick={() => navigate(entry.section)}>
            Open {entry.section}
          </button>
        )}
      </div>
    </motion.li>
  );
}

function LogDaySection({
  day,
  entries,
  navigate,
  progressEntryKey,
  report,
}: Readonly<{
  day: string;
  entries: PublicLogEntry[];
  navigate: ShipsLogProps["navigate"];
  progressEntryKey: ShipsLogProps["progressEventId"];
  report: ShipsLogProps["onTargetRegistrationChange"];
}>) {
  const { mode } = useMotionMode();
  const firstTimestamp = entries[0]?.timestamp ?? "1970-01-01T00:00:00.000Z";
  const moonPhase = entries[0]?.moonPhase ?? "new";
  const dayKey = useMemo(() => {
    const date = new Date(firstTimestamp);
    return [date.getFullYear(), date.getMonth() + 1, date.getDate()]
      .map((part) => String(part).padStart(2, "0"))
      .join("-");
  }, [firstTimestamp]);
  const dayTarget = useMemo(
    () => ({
      targetKey: `log-day:${dayKey}:layout`,
      part: "log-day-layout",
      runtime: "motion" as const,
      allowedProperties: ["layout"] as const,
      properties: ["layout"] as const,
    }),
    [dayKey],
  );
  const {
    bindTarget: bindDayTarget,
    handle: dayHandle,
    ownershipReady: dayOwnershipReady,
  } = useRuntimeOwnedSceneTarget(dayTarget);
  useReportTarget("log-day-layout", dayKey, dayHandle, report);

  return (
    <motion.section
      ref={bindDayTarget}
      {...(dayOwnershipReady ? { layout: true } : {})}
      className="log-day"
      data-motion-layout-boundary
      data-motion-ownership={dayOwnershipReady ? "ready" : "static"}
      data-log-day-key={dayKey}
    >
      <header>
        <motion.span
          key={moonPhase}
          className="moon-phase"
          aria-label={`Moon phase: ${moonPhase.replaceAll("-", " ")}`}
          initial={mode === "reduced" ? false : { opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={mode === "reduced" ? undefined : { opacity: 0, scale: 0.96 }}
          transition={{ duration: mode === "reduced" ? 0 : 0.16 }}
          data-moon-phase={moonPhase}
        >
          ◐
        </motion.span>
        <h3>{day}</h3>
        <small>Weather: calm ink</small>
      </header>
      <ol>
        {entries.map((entry) => (
          <LogEntryRow
            key={entry.key}
            entry={entry}
            isProgressEntry={entry.key === progressEntryKey}
            navigate={navigate}
            report={report}
          />
        ))}
      </ol>
    </motion.section>
  );
}

function ShipsLogContents({
  snapshot,
  navigate,
  headingId,
  progressEventId,
  onTargetRegistrationChange,
}: ShipsLogProps & Readonly<{ headingId: string }>) {
  const [filter, setFilter] = useState("all");
  const { mode } = useMotionMode();
  const groups = useMemo(() => {
    const entries = filter === "all" ? snapshot.log : snapshot.log.filter((entry) => entry.section === filter);
    return entries.reduce<Record<string, typeof entries>>((result, entry) => {
      const day = new Date(entry.timestamp).toLocaleDateString([], { dateStyle: "long" });
      (result[day] ??= []).push(entry);
      return result;
    }, {});
  }, [filter, snapshot.log]);
  const logDays = useMemo(() => Object.entries(groups), [groups]);
  const shouldUsePhysicalBook =
    logDays.length > LOG_BOOK_DAY_THRESHOLD || snapshot.log.length > LOG_BOOK_ENTRY_THRESHOLD;
  const logPages = useMemo<FlipBookPage[]>(
    () =>
      logDays.flatMap(([day, entries], dayIndex) => {
        const leaves = Array.from(
          { length: Math.ceil(entries.length / LOG_BOOK_PAGE_ENTRY_CAPACITY) },
          (_, leafIndex) =>
            entries.slice(leafIndex * LOG_BOOK_PAGE_ENTRY_CAPACITY, (leafIndex + 1) * LOG_BOOK_PAGE_ENTRY_CAPACITY),
        );
        return leaves.map((leafEntries, leafIndex) => ({
          id: `log-day-${leafEntries[0]?.key ?? `${dayIndex}-${leafIndex}`}`,
          density: dayIndex === 0 && leafIndex === 0 ? "hard" : "soft",
          label:
            leaves.length === 1
              ? `Voyage Log: ${day}`
              : `Voyage Log: ${day}, leaf ${leafIndex + 1} of ${leaves.length}`,
          content: (
            <LogDaySection
              day={day}
              entries={leafEntries}
              progressEntryKey={progressEventId}
              navigate={navigate}
              report={onTargetRegistrationChange}
            />
          ),
        }));
      }),
    [logDays, navigate, onTargetRegistrationChange, progressEventId],
  );

  return (
    <>
      <header className="section-masthead">
        <div>
          <p className="eyebrow">Chronicle activity</p>
          <h2 id={headingId}>Voyage Log</h2>
        </div>
        <p>Dated entries, weather marks, moon phases, and routes back to the physical workspace.</p>
      </header>
      <label className="log-filter">
        Show{" "}
        <select value={filter} onChange={(event) => setFilter(event.target.value)}>
          <option value="all">All entries</option>
          <option value="journal">Journal</option>
          <option value="chart">Chart</option>
          <option value="treasures">Artifacts</option>
          <option value="quests">Echoes</option>
          <option value="finale">Finale</option>
        </select>
      </label>
      {logDays.length ? (
        <div className="captains-logbook">
          {shouldUsePhysicalBook ? (
            <PageFlipBook
              pages={logPages}
              mode={mode}
              bookId="ships-log-history"
              revision={`${snapshot.sequence}:${filter}:${logPages.map((page) => page.id).join("|")}`}
              className="ships-log-page-book"
            />
          ) : (
            <AnimatePresence initial={false} mode="popLayout">
              {logDays.map(([day, entries]) => (
                <LogDaySection
                  key={day}
                  day={day}
                  entries={entries}
                  progressEntryKey={progressEventId}
                  navigate={navigate}
                  report={onTargetRegistrationChange}
                />
              ))}
            </AnimatePresence>
          )}
        </div>
      ) : (
        <div className="physical-empty">
          <span aria-hidden="true">◇</span>
          <h3>Nothing has been recorded yet</h3>
          <p>Released Voyage events will appear here without revealing private details.</p>
        </div>
      )}
    </>
  );
}

export function ShipsLog(props: ShipsLogProps) {
  const headingId = useId();

  return (
    <SceneHost
      as="section"
      kind="player-section-enhancement"
      className="physical-section ships-log-section"
      aria-labelledby={headingId}
      data-section-heading
      tabIndex={-1}
    >
      <ShipsLogContents {...props} headingId={headingId} />
    </SceneHost>
  );
}
