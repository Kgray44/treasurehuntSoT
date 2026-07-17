"use client";

import { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { MotionMode } from "@/animation/core/animation-types";
import type { PublicSnapshot } from "@/domain/story";
import { PageFlipBook, type FlipBookPage, type PageFlipBookHandle } from "@/components/animation/PageFlipBook";

type Filter = "all" | "rumor" | "active" | "complete";

export function SideQuestLedger({ snapshot, mode }: { snapshot: PublicSnapshot; mode: MotionMode }) {
  const [filter, setFilter] = useState<Filter>("all");
  const book = useRef<PageFlipBookHandle>(null);
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
      ...quests.flatMap((quest, index) => [
        {
          id: `${quest.key}-summary`,
          density: "soft" as const,
          label: quest.title ?? quest.teaser ?? "A safe rumor",
          content: (
            <div
              className="quest-ledger-page"
              data-scene-part={index === quests.length - 1 ? "quest-note-new" : "quest-note"}
              data-gsap-owned
            >
              <span className="wax-pin" aria-hidden="true" />
              <p className="eyebrow">{quest.state.replaceAll("_", " ")}</p>
              <h3>{quest.title ?? "A whispered rumor"}</h3>
              <p>{quest.description ?? quest.teaser ?? "Only a safe symbol has surfaced."}</p>
              <svg viewBox="0 0 400 120" aria-hidden="true">
                <path data-scene-part="red-thread" data-gsap-owned d="M20 88C120 20 250 15 380 82" />
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
                  <li key={item.ordinal} className={item.complete ? "complete" : ""}>
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
                <span className="quest-complete-stamp" data-scene-part="quest-stamp" data-gsap-owned>
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
      <AnimatePresence mode="wait">
        <motion.div
          key={filter}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
        >
          <PageFlipBook ref={book} pages={pages} mode={mode} className="quest-page-book" />
        </motion.div>
      </AnimatePresence>
    </section>
  );
}
