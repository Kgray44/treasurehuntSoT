"use client";

import { useMemo, useRef } from "react";
import type { MotionMode } from "@/animation/core/animation-types";
import { buildJournalPages, pageIndexForChapter, type JournalPage } from "@/animation/journal/page-model";
import type { ClientProgressEvent, PublicSnapshot } from "@/domain/story";
import { PageFlipBook, type FlipBookPage, type PageFlipBookHandle } from "@/components/animation/PageFlipBook";
import { LottieEffect } from "@/components/animation/LottieEffect";
import { lottieAssets } from "@/animation/assets/lottie-contracts";
import type { JournalOpeningPhase } from "@/animation/journal/opening-machine";
import { OpeningWaxSeal } from "./OpeningWaxSeal";

export function JournalWorkspace({
  snapshot,
  mode,
  activeEvent,
  openingPhase,
  interactive,
  playbackRate,
  onPageTurn,
}: {
  snapshot: PublicSnapshot;
  mode: MotionMode;
  activeEvent: ClientProgressEvent | null;
  openingPhase: JournalOpeningPhase;
  interactive: boolean;
  playbackRate: 0.25 | 0.5 | 1;
  onPageTurn?: () => void;
}) {
  const book = useRef<PageFlipBookHandle>(null);
  const pages = useMemo(() => buildJournalPages(snapshot).filter((page) => page.density === "soft"), [snapshot]);
  const flipPages = useMemo<FlipBookPage[]>(
    () =>
      pages.map((page) => ({
        id: page.id,
        density: page.density,
        label: page.title ?? page.eyebrow ?? page.kind,
        content: <JournalPageContent page={page} />,
      })),
    [pages],
  );
  const payload = activeEvent?.type === "CHAPTER_RELEASED" ? activeEvent.payload : null;
  return (
    <section
      className="physical-section journal-workspace"
      aria-labelledby="journal-heading"
      data-section-heading
      data-journal-phase={openingPhase}
      tabIndex={-1}
    >
      <header className="section-masthead">
        <div>
          <p className="eyebrow">Primary story artifact</p>
          <h2 id="journal-heading">The Voyage Journal</h2>
        </div>
        <p>Selectable parchment, physical leaves, and only the words the tide has released.</p>
      </header>
      <div className="journal-table" data-scene-part="journal-stage" data-gsap-owned>
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
              ref={book}
              pages={flipPages}
              mode={mode}
              showCover={false}
              playbackRate={playbackRate}
              initialPage={pageIndexForChapter(pages, snapshot.chapter.ordinal)}
              className="main-journal-book"
              onFlipStateChange={(state) => state === "flipping" && onPageTurn?.()}
            />
          </div>
          <div className="closed-book" data-opening-actor="closed-book" aria-hidden="true">
            <div className="closed-page-block" />
            <div className="opening-sealed-page" data-opening-actor="sealed-page">
              <div className="opening-page-grain" />
              <p>The first leaf waits beneath the captain&apos;s seal.</p>
              <OpeningWaxSeal />
            </div>
            <span className="latch-catch" />
            <div className="front-cover" data-opening-actor="front-cover">
              <div className="cover-face cover-front">
                <span className="cover-border" />
                <span className="cover-emblem">F</span>
                <strong>The Forever Treasure</strong>
                <small>Captain&apos;s Voyage Journal</small>
                <div className="latch-assembly" data-opening-actor="latch">
                  <span className="latch-hinge" />
                  <span className="latch-strap" />
                  <span className="latch-hook" />
                </div>
              </div>
              <div className="cover-face cover-inside" />
            </div>
          </div>
          <nav className="chapter-tabs" aria-label="Journal chapters">
            {snapshot.chapters.map((chapter) => (
              <button
                key={chapter.ordinal}
                disabled={!interactive}
                onClick={() => book.current?.flipTo(pageIndexForChapter(pages, chapter.ordinal))}
                aria-label={`Turn to chapter ${chapter.ordinal}: ${chapter.title ?? chapter.teaser ?? "sealed"}`}
              >
                <span>{chapter.ordinal}</span>
                <b>{chapter.title ?? chapter.teaser ?? "Sealed"}</b>
                <small>{chapter.state.toLowerCase()}</small>
              </button>
            ))}
          </nav>
        </div>
        {payload && interactive && <ChapterCeremonyPage payload={payload} mode={mode} />}
      </div>
    </section>
  );
}

function JournalPageContent({ page }: { page: JournalPage }) {
  return (
    <div className={`journal-leaf page-kind-${page.kind}`}>
      <div className="paper-fibers" aria-hidden="true" />
      {page.folio && <span className="folio">— {page.folio} —</span>}
      {page.eyebrow && <p className="eyebrow">{page.eyebrow}</p>}
      {page.title && <h3>{page.title}</h3>}
      {page.body && <p className="journal-prose">{page.body}</p>}
      {page.objective && (
        <div className="page-objective">
          <span>Present course</span>
          <strong>{page.objective}</strong>
        </div>
      )}
      {page.riddle && (
        <blockquote>
          {page.riddle.split("\n").map((line) => (
            <span key={line}>{line}</span>
          ))}
        </blockquote>
      )}
      {page.note && <p className="captain-hand">{page.note}</p>}
      {page.state && (
        <span className={`chapter-state state-${page.state.toLowerCase()}`}>{page.state.replaceAll("_", " ")}</span>
      )}
      <div className="margin-sketch" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
    </div>
  );
}

function ChapterCeremonyPage({ payload, mode }: { payload: Record<string, unknown>; mode: MotionMode }) {
  return (
    <div className="chapter-ceremony-page" role="status" aria-live="polite">
      <div className="sealed-parchment" data-scene-part="sealed-parchment" data-gsap-owned>
        <div className="page-light" data-scene-part="page-light" data-gsap-owned aria-hidden="true" />
        <div className="ceremony-seal" data-scene-part="seal" data-gsap-owned aria-hidden="true">
          <span>F</span>
          <svg viewBox="0 0 180 180">
            <path data-scene-part="seal-crack" d="M90 12l-8 53 23 18-34 16 15 68M24 88l57-23M105 83l50-20" />
            <path data-scene-part="seal-fragment" d="M24 88l57-23-10 34z" />
            <path data-scene-part="seal-fragment" d="M105 83l50-20-34 42z" />
          </svg>
        </div>
        <p className="eyebrow" data-scene-part="ink-heading" data-gsap-owned>
          Chapter {String(payload.ordinal ?? "")}
        </p>
        <h3 data-scene-part="ink-heading" data-gsap-owned>
          {String(payload.title ?? "")}
        </h3>
        <p className="ceremony-story" data-scene-part="ink-story" data-gsap-owned data-ink-copy>
          {String(payload.narrative ?? "")}
        </p>
        <div className="page-objective" data-scene-part="ink-objective" data-gsap-owned>
          <span>Present course</span>
          <strong>{String(payload.objective ?? "")}</strong>
        </div>
        <blockquote data-scene-part="ink-riddle" data-gsap-owned data-ink-copy>
          {String(payload.riddle ?? "")}
        </blockquote>
        <svg className="ceremony-route" viewBox="0 0 460 120" aria-hidden="true">
          <path data-quill-path d="M18 86C130 12 270 24 438 82" />
          <path data-scene-part="route-path" d="M18 86C130 12 270 24 438 82" />
        </svg>
        <div className="ceremony-map-fog" data-scene-part="map-fog" data-gsap-owned aria-hidden="true" />
        <div className="ceremony-quill" data-scene-part="quill" data-gsap-owned aria-hidden="true" />
        <LottieEffect
          asset={lottieAssets.inkBloom}
          mode={mode}
          label="Ink blooming and drying across the released page"
          className="ceremony-ink-bloom"
        />
      </div>
    </div>
  );
}
