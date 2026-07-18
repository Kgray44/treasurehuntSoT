"use client";

import { forwardRef } from "react";
import type { MotionMode } from "@/animation/core/animation-types";
import type { JournalOpeningPhase } from "@/animation/journal/opening-machine";
import { PageFlipBook, type FlipBookPage, type PageFlipBookHandle } from "@/components/animation/PageFlipBook";
import { OpeningWaxSeal } from "@/components/player/workspace/OpeningWaxSeal";

export type PhysicalJournalTab = {
  id: string;
  label: string;
  ordinal: number;
  state: string;
  pageIndex: number;
};

export const PhysicalJournalBook = forwardRef<
  PageFlipBookHandle,
  {
    pages: FlipBookPage[];
    mode: MotionMode;
    openingPhase: JournalOpeningPhase;
    interactive: boolean;
    playbackRate?: 0.25 | 0.5 | 1;
    revision?: string | number;
    initialPage: number;
    coverTitle: string;
    coverSubtitle: string;
    sealedMessage?: string;
    tabs?: PhysicalJournalTab[];
    onSelectTab?: (pageIndex: number) => void;
    onPageChange?: (page: number) => void;
    onPageTurn?: () => void;
    overlay?: React.ReactNode;
  }
>(function PhysicalJournalBook(
  {
    pages,
    mode,
    openingPhase,
    interactive,
    playbackRate = 1,
    revision = 0,
    initialPage,
    coverTitle,
    coverSubtitle,
    sealedMessage = "The first leaf waits beneath the Captain's seal.",
    tabs = [],
    onSelectTab,
    onPageChange,
    onPageTurn,
    overlay,
  },
  ref,
) {
  return (
    <div className="journal-table" data-scene-part="journal-stage" data-gsap-owned data-journal-phase={openingPhase}>
      <div className="book-camera" data-opening-actor="book-camera">
        <div className="book-shadow" aria-hidden="true" />
        <div className="rear-book-cover" aria-hidden="true" />
        <div className="page-stack page-stack-left" aria-hidden="true" />
        <div className="page-stack page-stack-right" aria-hidden="true" />
        <div className="book-binding" aria-hidden="true">
          <span className="binding-fold" />
          <span className="binding-cord cord-one" />
          <span className="binding-cord cord-two" />
          <span className="binding-cord cord-three" />
          <span className="binding-cord cord-four" />
          <span className="binding-cord cord-five" />
        </div>
        <div className="open-page-stage">
          <PageFlipBook
            ref={ref}
            pages={pages}
            mode={mode}
            showCover={false}
            playbackRate={playbackRate}
            revision={revision}
            initialPage={initialPage}
            className="main-journal-book"
            onPageChange={onPageChange}
            onFlipStateChange={(state) => state === "flipping" && onPageTurn?.()}
          />
        </div>
        <div className="closed-book" data-opening-actor="closed-book" aria-hidden="true">
          <div className="closed-page-block" />
          <div className="opening-sealed-page" data-opening-actor="sealed-page">
            <div className="opening-page-grain" />
            <p>{sealedMessage}</p>
            <OpeningWaxSeal />
          </div>
          <span className="latch-catch" />
          <div className="front-cover" data-opening-actor="front-cover">
            <div className="cover-face cover-front">
              <span className="cover-border" />
              <span className="cover-emblem">F</span>
              <strong>{coverTitle}</strong>
              <small>{coverSubtitle}</small>
              <div className="latch-assembly" data-opening-actor="latch">
                <span className="latch-hinge" />
                <span className="latch-strap" />
                <span className="latch-hook" />
              </div>
            </div>
            <div className="cover-face cover-inside" />
          </div>
        </div>
        {tabs.length > 0 && (
          <nav className="chapter-tabs" aria-label="Journal chapters">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                disabled={!interactive}
                onClick={() => onSelectTab?.(tab.pageIndex)}
                aria-label={`Turn to chapter ${tab.ordinal}: ${tab.label}`}
              >
                <span>{tab.ordinal}</span>
                <b>{tab.label}</b>
                <small>{tab.state}</small>
              </button>
            ))}
          </nav>
        )}
      </div>
      {overlay}
    </div>
  );
});
