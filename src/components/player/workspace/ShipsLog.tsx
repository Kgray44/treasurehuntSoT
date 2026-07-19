"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { SceneHost, useRuntimeOwnedSceneTarget, useSceneTargetRegistration } from "@/animation/hosts/SceneHost";
import { useOptionalSceneHost } from "@/animation/hosts/SceneHostContext";
import type { SceneHostHandle, SceneTargetHandle } from "@/animation/hosts/scene-host-types";
import type { PublicLogEntry, PublicSnapshot } from "@/domain/story";
import type { CompanionView } from "./types";

export type ShipsLogTargetKind = "log-day-layout" | "log-row" | "fresh-ink" | "log-symbol";

export type ShipsLogTargetRegistration = Readonly<{
  kind: ShipsLogTargetKind;
  key: PublicLogEntry["key"];
  host: SceneHostHandle | null;
  handle: SceneTargetHandle | null;
}>;

export type ShipsLogProps = Readonly<{
  snapshot: PublicSnapshot;
  navigate: (view: CompanionView) => void;
  /** Exact progress identity; it never falls back to the last visible row. */
  progressEntryKey?: PublicLogEntry["key"];
  /** Gives the progression-host integrator the source host and exact target handle needed for a bounded export. */
  onTargetRegistrationChange?: (registration: ShipsLogTargetRegistration) => void;
}>;

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
  const rowTarget = useMemo(
    () => ({
      targetKey: `log:${entry.key}:row`,
      part: "log-row",
      runtime: "motion" as const,
      allowedProperties: ["layout"] as const,
      properties: ["layout"] as const,
    }),
    [entry.key],
  );
  const inkTarget = useMemo(
    () => ({
      targetKey: `log:${entry.key}:fresh-ink`,
      part: isProgressEntry ? "log-entry-new" : "log-entry-ink",
      ownerHint: "gsap" as const,
      allowedProperties: ["opacity", "clip-path", "filter"] as const,
    }),
    [entry.key, isProgressEntry],
  );
  const symbolTarget = useMemo(
    () => ({
      targetKey: `log:${entry.key}:symbol`,
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
  const { bindTarget: bindSymbolTarget, handle: symbolHandle } = useSceneTargetRegistration(symbolTarget);
  useReportTarget("log-row", entry.key, rowHandle, report);
  useReportTarget("fresh-ink", entry.key, inkHandle, report);
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
      data-progress-target={isProgressEntry ? "true" : undefined}
      style={{ position: "relative" }}
    >
      <span
        ref={bindInkTarget}
        className="log-fresh-ink"
        data-scene-part={isProgressEntry ? "log-entry-new" : "log-entry-ink"}
        data-gsap-visual-boundary
        data-log-ink-key={entry.key}
        aria-hidden="true"
        style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      />
      <span
        ref={bindSymbolTarget}
        className="log-symbol"
        data-scene-part={isProgressEntry ? "log-symbol-new" : "log-symbol"}
        data-gsap-visual-boundary
        data-log-symbol-key={entry.key}
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
  progressEntryKey: ShipsLogProps["progressEntryKey"];
  report: ShipsLogProps["onTargetRegistrationChange"];
}>) {
  const firstTimestamp = entries[0]?.timestamp ?? "1970-01-01T00:00:00.000Z";
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
        <span className="moon-phase" aria-hidden="true">
          ◐
        </span>
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
  progressEntryKey,
  onTargetRegistrationChange,
}: ShipsLogProps & Readonly<{ headingId: string }>) {
  const [filter, setFilter] = useState("all");
  const groups = useMemo(() => {
    const entries = filter === "all" ? snapshot.log : snapshot.log.filter((entry) => entry.section === filter);
    return entries.reduce<Record<string, typeof entries>>((result, entry) => {
      const day = new Date(entry.timestamp).toLocaleDateString([], { dateStyle: "long" });
      (result[day] ??= []).push(entry);
      return result;
    }, {});
  }, [filter, snapshot.log]);

  return (
    <>
      <header className="section-masthead">
        <div>
          <p className="eyebrow">Chronicle of the voyage</p>
          <h2 id={headingId}>Ship&apos;s Log</h2>
        </div>
        <p>Dated entries, weather marks, moon phases, and routes back to the physical workspace.</p>
      </header>
      <label className="log-filter">
        Show{" "}
        <select value={filter} onChange={(event) => setFilter(event.target.value)}>
          <option value="all">All entries</option>
          <option value="journal">Journal</option>
          <option value="chart">Chart</option>
          <option value="treasures">Treasures</option>
          <option value="quests">Quests</option>
          <option value="finale">Finale</option>
        </select>
      </label>
      {Object.keys(groups).length ? (
        <div className="captains-logbook">
          <AnimatePresence initial={false} mode="popLayout">
            {Object.entries(groups).map(([day, entries]) => (
              <LogDaySection
                key={day}
                day={day}
                entries={entries}
                progressEntryKey={progressEntryKey}
                navigate={navigate}
                report={onTargetRegistrationChange}
              />
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <div className="physical-empty">
          <span aria-hidden="true">◇</span>
          <h3>The log awaits its first line</h3>
          <p>Released voyage events will be recorded here without inventing private details.</p>
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
