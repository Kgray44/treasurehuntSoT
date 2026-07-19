"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import type { MotionMode } from "@/animation/core/animation-types";
import type { ClientProgressEvent, PublicSnapshot } from "@/domain/story";
import {
  PageFlipBook,
  type FlipBookPage,
  type PageFlipBookHandle,
  type PageFlipPageTargetExportAuthority,
} from "@/components/animation/PageFlipBook";
import type { PageFlipPageTargetCapability } from "@/components/animation/pageflip-boundary";

type Filter = "all" | "rumor" | "active" | "complete";

type SideQuestEventType = "SIDE_QUEST_DISCOVERED" | "SIDE_QUEST_UPDATED" | "SIDE_QUEST_COMPLETED";
export type SideQuestLocalTargetKey = "quest-note" | "quest-red-thread" | "quest-objective" | "quest-stamp";

export type SideQuestLocalTargetReady = Readonly<{
  eventId: string;
  eventType: SideQuestEventType;
  questKey: string;
  objectiveOrdinal?: number;
  pageId: string;
  authority: PageFlipPageTargetExportAuthority;
  targets: Readonly<Partial<Record<SideQuestLocalTargetKey, PageFlipPageTargetCapability>>>;
}>;

function eventQuestKey(event: ClientProgressEvent | null | undefined) {
  return typeof event?.payload.key === "string" && event.payload.key.trim() ? event.payload.key : null;
}

function eventObjectiveOrdinal(event: ClientProgressEvent) {
  const value = event.payload.objectiveOrdinal;
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  return null;
}

function safeTargetToken(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "target"
  );
}

function currentTarget(authority: PageFlipPageTargetExportAuthority, pageId: string, part: string, markerKey: string) {
  const markerSuffix = `:${safeTargetToken(markerKey)}`;
  return authority.targets.find(
    (target) =>
      target.current &&
      target.role === "primary" &&
      target.pageId === pageId &&
      target.part === part &&
      target.targetKey.endsWith(markerSuffix),
  );
}

export function resolveSideQuestLocalTargets(
  event: ClientProgressEvent | null | undefined,
  authority: PageFlipPageTargetExportAuthority | null,
): SideQuestLocalTargetReady | null {
  if (
    !event ||
    !authority ||
    !(["SIDE_QUEST_DISCOVERED", "SIDE_QUEST_UPDATED", "SIDE_QUEST_COMPLETED"] as const).includes(
      event.type as SideQuestEventType,
    )
  )
    return null;
  const eventType = event.type as SideQuestEventType;
  const questKey = eventQuestKey(event);
  if (!questKey) return null;

  if (eventType === "SIDE_QUEST_DISCOVERED") {
    const pageId = `${questKey}-summary`;
    const note = currentTarget(authority, pageId, "quest-note-new", `quest:${questKey}:note`);
    if (!note) return null;
    const thread = currentTarget(authority, pageId, "red-thread", `quest:${questKey}:thread`);
    return Object.freeze({
      eventId: event.id,
      eventType,
      questKey,
      pageId,
      authority,
      targets: Object.freeze({ "quest-note": note, ...(thread ? { "quest-red-thread": thread } : {}) }),
    });
  }

  if (eventType === "SIDE_QUEST_UPDATED") {
    const objectiveOrdinal = eventObjectiveOrdinal(event);
    if (objectiveOrdinal === null) return null;
    const pageId = `${questKey}-objectives`;
    const objective = currentTarget(
      authority,
      pageId,
      "quest-objective-updated",
      `quest:${questKey}:objective:${objectiveOrdinal}`,
    );
    if (!objective) return null;
    return Object.freeze({
      eventId: event.id,
      eventType,
      questKey,
      objectiveOrdinal,
      pageId,
      authority,
      targets: Object.freeze({ "quest-objective": objective }),
    });
  }

  const pageId = `${questKey}-objectives`;
  const stamp = currentTarget(authority, pageId, "quest-stamp", `quest:${questKey}:stamp`);
  if (!stamp) return null;
  return Object.freeze({
    eventId: event.id,
    eventType,
    questKey,
    pageId,
    authority,
    targets: Object.freeze({ "quest-stamp": stamp }),
  });
}

export function SideQuestLedger({
  snapshot,
  mode,
  progressEvent = null,
  onTargetRegistrationChange,
}: {
  snapshot: PublicSnapshot;
  mode: MotionMode;
  progressEvent?: ClientProgressEvent | null;
  onTargetRegistrationChange?: (ready: SideQuestLocalTargetReady | null) => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const book = useRef<PageFlipBookHandle>(null);
  const [pageTargets, setPageTargets] = useState<PageFlipPageTargetExportAuthority | null>(null);
  const quests = snapshot.sideQuests.filter(
    (quest) =>
      filter === "all" ||
      (filter === "rumor"
        ? ["RUMORED", "DISCOVERED"].includes(quest.state)
        : filter === "active"
          ? ["ACTIVE", "PARTIALLY_COMPLETE"].includes(quest.state)
          : quest.state === "COMPLETE"),
  );
  const pages = useMemo<FlipBookPage[]>(
    () => [
      {
        id: "quest-cover",
        density: "hard",
        label: "Side-Quest Ledger cover",
        content: (
          <div className="quest-ledger-cover">
            <span>Optional courses</span>
            <h3>Whispers & Bearings</h3>
            <i aria-hidden="true" />
          </div>
        ),
      },
      {
        id: "quest-dividers",
        density: "hard",
        label: "Quest section dividers",
        content: (
          <div className="quest-divider-page">
            <span>Rumor</span>
            <span>Active</span>
            <span>Complete</span>
            <p>Optional mysteries may enrich the voyage. They never bar the main course.</p>
          </div>
        ),
      },
      ...quests.flatMap((quest) => [
        {
          id: `${quest.key}-summary`,
          density: "soft" as const,
          label: quest.title ?? quest.teaser ?? "A safe rumor",
          content: (
            <div
              className="quest-ledger-page"
              data-scene-part="quest-note-new"
              data-scene-target-key={`quest:${quest.key}:note`}
              data-quest-key={quest.key}
              data-gsap-owned
            >
              <span className="wax-pin" aria-hidden="true" />
              <p className="eyebrow">{quest.state.replaceAll("_", " ")}</p>
              <h3>{quest.title ?? "A whispered rumor"}</h3>
              <p>{quest.description ?? quest.teaser ?? "Only a safe symbol has surfaced."}</p>
              <svg viewBox="0 0 400 120" aria-hidden="true">
                <path
                  data-scene-part="red-thread"
                  data-scene-target-key={`quest:${quest.key}:thread`}
                  data-gsap-owned
                  d="M20 88C120 20 250 15 380 82"
                />
              </svg>
            </div>
          ),
        },
        {
          id: `${quest.key}-objectives`,
          density: "soft" as const,
          label: `${quest.title ?? "Quest"} objectives`,
          content: (
            <div className="quest-ledger-page objective-list">
              <p className="eyebrow">Pinned objectives</p>
              <ol>
                {quest.objectives?.map((item) => (
                  <li
                    key={`${quest.key}:objective:${item.ordinal}`}
                    className={item.complete ? "complete" : ""}
                    data-scene-part="quest-objective-updated"
                    data-scene-target-key={`quest:${quest.key}:objective:${item.ordinal}`}
                    data-quest-key={quest.key}
                    data-objective-ordinal={item.ordinal}
                    data-gsap-owned
                  >
                    <span aria-hidden="true">{item.complete ? "✓" : "○"}</span>
                    {item.body}
                  </li>
                ))}
              </ol>
              {quest.reward && (
                <div className="reward-pocket">
                  <span>Optional reward</span>
                  <b>{quest.reward.label ?? quest.reward.type.replaceAll("_", " ")}</b>
                </div>
              )}{" "}
              {quest.state === "COMPLETE" && (
                <span
                  className="quest-complete-stamp"
                  data-scene-part="quest-stamp"
                  data-scene-target-key={`quest:${quest.key}:stamp`}
                  data-quest-key={quest.key}
                  data-gsap-owned
                >
                  Course complete
                </span>
              )}
            </div>
          ),
        },
      ]),
    ],
    [quests],
  );
  const localTargets = useMemo(
    () => resolveSideQuestLocalTargets(progressEvent, pageTargets),
    [pageTargets, progressEvent],
  );

  useEffect(() => {
    onTargetRegistrationChange?.(localTargets);
    return () => onTargetRegistrationChange?.(null);
  }, [localTargets, onTargetRegistrationChange]);

  return (
    <section
      className="physical-section side-quest-section"
      aria-labelledby="quest-heading"
      data-section-heading
      tabIndex={-1}
    >
      <header className="section-masthead">
        <div>
          <p className="eyebrow">Optional mysteries</p>
          <h2 id="quest-heading">Side-Quest Ledger</h2>
        </div>
        <p>A rough leather book of correspondence, ciphers, and routes that never block the tale.</p>
      </header>
      <div className="ledger-filter" role="group" aria-label="Filter side quests">
        {(["all", "rumor", "active", "complete"] as Filter[]).map((item) => (
          <button key={item} aria-pressed={filter === item} onClick={() => setFilter(item)}>
            {item}
          </button>
        ))}
      </div>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <PageFlipBook
          ref={book}
          pages={pages}
          mode={mode}
          bookId="side-quest-ledger"
          className="quest-page-book"
          revision={snapshot.sequence}
          onPageTargetsChange={setPageTargets}
        />
      </motion.div>
    </section>
  );
}
