"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { useMotionMode } from "@/animation/motion/useMotionMode";
import {
  isJournalInteractive,
  waitForJournalPhase,
  type JournalOpeningPhase,
} from "@/animation/journal/opening-machine";
import type { FlipBookPage, PageFlipBookHandle } from "@/components/animation/PageFlipBook";
import { ExperienceSectionPages } from "@/components/player/journal/ExperienceSectionPages";
import { PhysicalJournalBook } from "@/components/player/journal/PhysicalJournalBook";
import { TallTaleJournalPageContent, type JournalAsset } from "@/components/player/journal/TallTaleJournalPage";
import { VisionScanControl } from "@/components/player/VisionScanControl";
import {
  emptyJournalReadingState,
  type PlayerJournalBlock,
  type PlayerJournalProjection,
  type PlayerJournalReadingState,
  type PlayerJournalReadingStateInput,
} from "@/tall-tale/journal-contract";
import {
  buildTallTaleJournalPages,
  pageIndexForJournalBlock,
  pageIndexForJournalChapter,
  pageIndexForReadingState,
} from "@/tall-tale/journal-page-model";
import type { JsonObject } from "@/tall-tale/types";
import {
  experienceSectionFromPath,
  experienceSectionHref,
  experienceSections,
  type ExperienceSection,
} from "@/lib/experience-routes";

type SessionState = {
  csrfToken?: string;
  session: {
    id: string;
    status: string;
    previewMode: boolean;
    versionId: string;
    versionLabel: string;
    versionPublishedAt: string | null;
    versionChecksum: string | null;
    currentSequence: number;
    startedAt: string;
    updatedAt: string;
    completedAt: string | null;
  };
  tale: { title: string; slug: string; subtitle: string | null; shortDescription: string | null; theme?: string };
  chapter: { id: string; title: string; subtitle: string | null; orderIndex: number } | null;
  block: {
    id: string;
    blockType: string;
    title: string;
    configuration: JsonObject;
    connections: Array<{ targetBlockId: string; connectionType: string; label?: string | null }>;
  } | null;
  pendingVerification: { id: string; providerType: string; expiresAt: string | null } | null;
  assets: JournalAsset[];
  journal: PlayerJournalProjection;
};

type ProgressionEvent = { id: string; eventType: string; sequence: number; createdAt: string };
type ConnectionState = "connecting" | "live" | "reconnecting" | "offline";

const openingSequence: JournalOpeningPhase[] = [
  "ENTRY_ACTIVATED",
  "CLOSED_BOOK_REVEAL",
  "LATCH_RELEASING",
  "COVER_OPENING",
  "SEALED_PAGE_REVEAL",
  "SEAL_BREAKING",
  "BOOK_SETTLING",
  "JOURNAL_READY",
];

export function TallTaleJournalSession({
  sessionId,
  identitySession = false,
  routeBase,
}: {
  sessionId: string;
  identitySession?: boolean;
  routeBase: string;
}) {
  const root = useRef<HTMLElement>(null);
  const contentRegion = useRef<HTMLDivElement>(null);
  const book = useRef<PageFlipBookHandle>(null);
  const openingRun = useRef<AbortController | null>(null);
  const openingBusy = useRef(false);
  const initializedOpening = useRef(false);
  const initializedPage = useRef(false);
  const processedSequence = useRef(0);
  const followingCurrent = useRef(true);
  const readingRef = useRef<PlayerJournalReadingState>(emptyJournalReadingState);
  const stateRef = useRef<SessionState | null>(null);
  const [state, setState] = useState<SessionState | null>(null);
  const [reading, setReading] = useState<PlayerJournalReadingState>(emptyJournalReadingState);
  const [readingReady, setReadingReady] = useState(false);
  const [liveReady, setLiveReady] = useState(false);
  const [openingPhase, setOpeningPhase] = useState<JournalOpeningPhase>("ENTRY_IDLE");
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [currentPage, setCurrentPage] = useState(0);
  const [pendingEvent, setPendingEvent] = useState<ProgressionEvent | null>(null);
  const [newContent, setNewContent] = useState(false);
  const [liveNotice, setLiveNotice] = useState("");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(0);
  const { mode, cycle: cycleMotion } = useMotionMode();
  const pathname = usePathname();
  const router = useRouter();
  const section = experienceSectionFromPath(pathname);

  const load = useCallback(
    async (event?: ProgressionEvent) => {
      const response = await fetch(`/api/play/sessions/${sessionId}`, { cache: "no-store" });
      const body = (await response.json()) as SessionState & { error?: string };
      if (!response.ok) {
        setError(body.error ?? "This voyage journal could not be read.");
        return null;
      }
      stateRef.current = body;
      setState(body);
      setError("");
      if (event)
        setPendingEvent({
          ...event,
          sequence: Math.max(event.sequence, body.session.currentSequence),
        });
      return body;
    },
    [sessionId],
  );

  useEffect(() => {
    queueMicrotask(() => {
      setNow(Date.now());
      void load();
    });
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (identitySession) {
        const response = await fetch(`/api/player/playthroughs/${sessionId}/journal-state`, { cache: "no-store" });
        const body = (await response.json()) as { readingState?: PlayerJournalReadingState };
        if (!cancelled && response.ok && body.readingState) {
          readingRef.current = body.readingState;
          setReading(body.readingState);
        }
      } else {
        const stored = localStorage.getItem(`tall-tale-journal:${sessionId}`);
        if (stored) {
          try {
            const value = { ...emptyJournalReadingState, ...JSON.parse(stored) } as PlayerJournalReadingState;
            readingRef.current = value;
            setReading(value);
          } catch {
            localStorage.removeItem(`tall-tale-journal:${sessionId}`);
          }
        }
      }
      if (!cancelled) setReadingReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [identitySession, sessionId]);

  const saveReading = useCallback(
    (patch: PlayerJournalReadingStateInput) => {
      const next: PlayerJournalReadingState = {
        ...readingRef.current,
        ...patch,
        lastEventSequence: Math.max(
          readingRef.current.lastEventSequence,
          patch.lastEventSequence ?? readingRef.current.lastEventSequence,
        ),
        updatedAt: new Date().toISOString(),
      };
      readingRef.current = next;
      setReading(next);
      if (identitySession) {
        const csrfToken = stateRef.current?.csrfToken;
        if (!csrfToken) return;
        void fetch(`/api/player/playthroughs/${sessionId}/journal-state`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
          body: JSON.stringify(patch),
        });
      } else localStorage.setItem(`tall-tale-journal:${sessionId}`, JSON.stringify(next));
    },
    [identitySession, sessionId],
  );

  useEffect(() => {
    if (!state || !readingReady || liveReady) return;
    processedSequence.current = state.session.currentSequence;
    queueMicrotask(() => {
      if (reading.lastEventSequence < state.session.currentSequence)
        saveReading({ lastEventSequence: state.session.currentSequence });
      setLiveReady(true);
    });
  }, [liveReady, reading.lastEventSequence, readingReady, saveReading, state]);

  useEffect(() => {
    if (!liveReady) return;
    const source = new EventSource(`/api/play/sessions/${sessionId}/events?after=${processedSequence.current}`);
    source.onopen = () => setConnection("live");
    source.onerror = () => setConnection("reconnecting");
    source.addEventListener("access-revoked", () => {
      setConnection("offline");
      setError("Your access to this voyage was revoked.");
      source.close();
    });
    source.addEventListener("progression", (message) => {
      try {
        const event = JSON.parse((message as MessageEvent<string>).data) as ProgressionEvent;
        if (event.sequence <= processedSequence.current) return;
        void load(event);
      } catch {
        setConnection("reconnecting");
      }
    });
    return () => source.close();
  }, [liveReady, load, sessionId]);

  useEffect(() => {
    if (connection === "live" || !liveReady) return;
    const timer = setInterval(() => void load(), 5000);
    return () => clearInterval(timer);
  }, [connection, liveReady, load]);

  const pages = useMemo(
    () =>
      state
        ? buildTallTaleJournalPages(state.journal, {
            title: state.tale.title,
            subtitle: state.tale.subtitle,
            versionLabel: state.session.versionLabel,
            publishedAt: state.session.versionPublishedAt,
            completedAt: state.session.completedAt,
          })
        : [],
    [state],
  );
  const flipPages = useMemo<FlipBookPage[]>(
    () =>
      pages.map((page) => ({
        id: page.id,
        density: page.density,
        label: page.label,
        content: <TallTaleJournalPageContent page={page} assets={state?.assets ?? []} />,
      })),
    [pages, state?.assets],
  );
  const initialPage = useMemo(
    () => pageIndexForReadingState(pages, reading.pageId, state?.journal.currentBlockId ?? null),
    [pages, reading.pageId, state?.journal.currentBlockId],
  );

  useEffect(() => {
    if (!pages.length || initializedPage.current) return;
    initializedPage.current = true;
    setCurrentPage(initialPage);
    followingCurrent.current = pages[initialPage]?.blockId === state?.journal.currentBlockId;
  }, [initialPage, pages, state?.journal.currentBlockId]);

  useEffect(() => {
    if (!state || !readingReady || !root.current || initializedOpening.current) return;
    initializedOpening.current = true;
    if (reading.hasOpened || state.session.previewMode || state.session.status === "COMPLETED") {
      queueMicrotask(() => {
        const rootElement = root.current;
        if (!rootElement) return;
        setOpeningPhase("BOOK_SETTLING");
        const controller = new AbortController();
        openingRun.current = controller;
        void waitForJournalPhase(rootElement, "BOOK_SETTLING", mode, controller.signal)
          .catch(() => undefined)
          .finally(() => {
            if (!controller.signal.aborted) setOpeningPhase("JOURNAL_READY");
          });
      });
    }
  }, [mode, reading.hasOpened, readingReady, state]);

  useEffect(() => {
    if (!pendingEvent || !state || !pages.length) return;
    if (pendingEvent.sequence <= processedSequence.current) {
      setPendingEvent(null);
      return;
    }
    processedSequence.current = pendingEvent.sequence;
    const target = pageIndexForJournalBlock(pages, state.journal.currentBlockId);
    const currentBlockId = pages[currentPage]?.blockId ?? null;
    const targetBlockId = pages[target]?.blockId ?? null;
    const label = eventLabel(pendingEvent.eventType, state);
    setLiveNotice("");
    queueMicrotask(() => setLiveNotice(label));
    if (followingCurrent.current || currentBlockId === targetBlockId) {
      if (target !== currentPage) book.current?.flipTo(target);
      setNewContent(false);
    } else setNewContent(true);
    saveReading({ lastEventSequence: pendingEvent.sequence });
    setPendingEvent(null);
  }, [currentPage, pages, pendingEvent, saveReading, state]);

  useEffect(() => {
    return () => openingRun.current?.abort();
  }, []);

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape" && readingRef.current.openDrawer) saveReading({ openDrawer: null });
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [saveReading]);

  const historical = state?.journal.mode === "historical";
  const sectionBase = historical && !routeBase.endsWith("/journal") ? `${routeBase}/journal` : routeBase;

  useEffect(() => {
    if (!historical || routeBase.endsWith("/journal") || pathname.includes("/journal/")) return;
    router.replace(experienceSectionHref(`${routeBase}/journal`, section));
  }, [historical, pathname, routeBase, router, section]);

  useEffect(() => {
    if (!state) return;
    const timer = window.setTimeout(() => contentRegion.current?.focus({ preventScroll: true }), 40);
    return () => window.clearTimeout(timer);
  }, [pathname, state]);

  async function openJournal() {
    if (openingBusy.current || !root.current) return;
    openingBusy.current = true;
    const controller = new AbortController();
    openingRun.current = controller;
    try {
      for (const phase of openingSequence) {
        if (!root.current || controller.signal.aborted) break;
        flushSync(() => setOpeningPhase(phase));
        await waitForJournalPhase(root.current, phase, mode, controller.signal);
      }
      saveReading({ hasOpened: true });
    } catch (cause) {
      if (!(cause instanceof DOMException && cause.name === "AbortError")) setOpeningPhase("JOURNAL_READY");
    } finally {
      openingBusy.current = false;
    }
  }

  function skipOpening() {
    openingRun.current?.abort();
    setOpeningPhase("JOURNAL_READY");
    saveReading({ hasOpened: true });
  }

  function turnTo(page: number) {
    book.current?.flipTo(page);
    saveReading({ openDrawer: null });
  }

  function openBlockInChapters(block: PlayerJournalBlock) {
    const page = pageIndexForJournalBlock(pages, block.id);
    setCurrentPage(page);
    saveReading({ pageId: pages[page]?.id ?? null, openDrawer: null });
    router.push(experienceSectionHref(sectionBase, "chapters"));
  }

  function returnToCurrent() {
    if (!state) return;
    const page = pageIndexForJournalBlock(pages, state.journal.currentBlockId);
    followingCurrent.current = true;
    setNewContent(false);
    setCurrentPage(page);
    saveReading({ pageId: pages[page]?.id ?? null, openDrawer: null });
    if (section === "chapters") book.current?.flipTo(page);
    else router.push(experienceSectionHref(sectionBase, "chapters"));
  }

  async function act(action: "continue" | "confirm" | "answer" | "choice" | "timer", extra: JsonObject = {}) {
    if (!state || state.journal.mode === "historical") return;
    const idempotencyKey = crypto.randomUUID();
    setBusy(true);
    setError("");
    const response = await fetch(`/api/play/sessions/${sessionId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(state.csrfToken ? { "x-csrf-token": state.csrfToken } : {}),
      },
      body: JSON.stringify({ action, idempotencyKey, answer, ...extra }),
    });
    const body = (await response.json()) as { state?: SessionState; accepted?: boolean; error?: string };
    if (!response.ok) setError(body.error ?? "The story could not advance.");
    else if (body.state) {
      const next = { ...body.state, csrfToken: body.state.csrfToken ?? state.csrfToken };
      stateRef.current = next;
      setState(next);
      setPendingEvent({
        id: `player:${idempotencyKey}`,
        eventType: "playerProgress",
        sequence: next.session.currentSequence,
        createdAt: new Date().toISOString(),
      });
      if (body.accepted) setAnswer("");
    }
    setBusy(false);
  }

  if (!state || !readingReady)
    return (
      <JournalStatus
        title="Unbinding the journal"
        message={error || "Finding the current leaf…"}
        error={Boolean(error)}
      />
    );

  const journalReady = isJournalInteractive(openingPhase);
  const currentBlock = findCurrentBlock(state.journal);
  const choices =
    currentBlock?.blockType === "choice" && Array.isArray(currentBlock.configuration.choices)
      ? (currentBlock.configuration.choices as Array<Record<string, unknown>>)
      : [];
  const waitRemaining = Math.max(0, Date.parse(state.pendingVerification?.expiresAt ?? "") - now);
  const currentObjective = objectiveOf(currentBlock);

  return (
    <main
      ref={root}
      className={`voyage-shell tall-tale-journal-shell mode-${state.journal.mode}`}
      data-journal-phase={openingPhase}
      data-live-event={liveNotice ? "revealed" : "idle"}
      data-active-section={section}
      data-theme={experienceThemeOf(state.tale.theme)}
      style={
        {
          "--player-text-scale": reading.textScale,
          "--texture-opacity": 1,
        } as React.CSSProperties
      }
    >
      <div className="ocean-depth" aria-hidden="true">
        <div data-scene-part="sky" />
        <div data-scene-part="horizon" />
        <div data-scene-part="ocean" />
        <div data-scene-part="fog-near" />
      </div>
      <header className="tall-tale-session-header persistent-interface" data-opening-actor="persistent-interface">
        <div>
          <Link href="/player/library">← Tall Tale Library</Link>
          <p className="eyebrow">{historical ? "Completed journal" : (state.chapter?.title ?? "Tall Tale session")}</p>
          <h1>{state.tale.title}</h1>
        </div>
        <div className="journal-session-tools">
          <span className={`runtime-connection ${connection}`} role="status">
            <i />
            {connection === "live"
              ? "Captain channel connected"
              : connection === "offline"
                ? "Access closed"
                : "Reconnecting"}
          </span>
          <button onClick={cycleMotion}>Motion: {mode}</button>
          <label>
            <span>Text size</span>
            <input
              aria-label="Journal text size"
              type="range"
              min="0.85"
              max="1.5"
              step="0.05"
              value={reading.textScale}
              onChange={(event) => saveReading({ textScale: Number(event.target.value) })}
            />
          </label>
        </div>
      </header>

      <ExperienceTabs activeSection={section} basePath={sectionBase} />

      {connection !== "live" && (
        <div className="journal-connection-note" role="status">
          <span>
            <strong>
              {connection === "offline"
                ? "The journal is closed to this sailor."
                : "The signal is crossing rough water."}
            </strong>{" "}
            Reading remains available while canonical state reconnects.
          </span>
          <button type="button" onClick={() => void load()}>
            Retry now
          </button>
        </div>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          ref={contentRegion}
          id="experience-section-content"
          className="experience-route-content"
          role="tabpanel"
          aria-label={`${section[0].toLocaleUpperCase() + section.slice(1)} content`}
          key={pathname}
          tabIndex={-1}
          data-route-key={pathname}
          initial={routeMotion(section, mode).initial}
          animate={routeMotion(section, mode).enter}
          exit={routeMotion(section, mode).exit}
          transition={routeMotion(section, mode).transition}
        >
          {section === "chapters" ? (
            <>
              <section
                className="physical-section journal-workspace tall-tale-journal-workspace"
                aria-labelledby="tall-tale-journal-heading"
              >
                <header className="section-masthead">
                  <div>
                    <p className="eyebrow">{historical ? "Immutable adventure record" : "Canonical Player session"}</p>
                    <h2 id="tall-tale-journal-heading">{state.session.versionLabel} Voyage Journal</h2>
                  </div>
                  <p>
                    {historical
                      ? "Read-only pages from the exact edition this crew experienced."
                      : "The shared session releases every playable leaf."}
                  </p>
                </header>
                <PhysicalJournalBook
                  ref={book}
                  pages={flipPages}
                  revision={state.session.currentSequence}
                  mode={mode}
                  openingPhase={openingPhase}
                  interactive={journalReady}
                  initialPage={initialPage}
                  coverTitle={state.tale.title}
                  coverSubtitle={historical ? "Preserved Tall Tale Journal" : "Player Tall Tale Journal"}
                  sealedMessage={
                    historical
                      ? "This completed voyage remains sealed to its original edition."
                      : "The first released leaf waits beneath the Captain's seal."
                  }
                  tabs={state.journal.chapters.map((chapter) => ({
                    id: chapter.id,
                    ordinal: chapter.orderIndex + 1,
                    label: chapter.title,
                    state: chapter.blocks.every((block) => block.progress === "completed") ? "complete" : "released",
                    pageIndex: pageIndexForJournalChapter(pages, chapter.id),
                  }))}
                  onSelectTab={turnTo}
                  onPageChange={(page) => {
                    setCurrentPage(page);
                    const currentPageBlock = pages[page]?.blockId ?? null;
                    followingCurrent.current = currentPageBlock === state.journal.currentBlockId;
                    if (followingCurrent.current) setNewContent(false);
                    saveReading({ pageId: pages[page]?.id ?? null });
                  }}
                />
              </section>

              {(openingPhase === "ENTRY_IDLE" || openingPhase === "ENTRY_ACTIVATED") && (
                <div className="journal-opening tall-tale-opening">
                  <button className="wax-open" onClick={() => void openJournal()}>
                    <span>✦</span>
                    <strong>Open the journal</strong>
                    <small>{reading.hasOpened ? "Return to your place" : "Begin the Tall Tale"}</small>
                  </button>
                </div>
              )}
              {openingPhase !== "ENTRY_IDLE" && !journalReady && (
                <div className="journal-opening-status" role="status">
                  <span>{openingLabel(openingPhase)}</span>
                  <button onClick={skipOpening}>Skip ceremony</button>
                </div>
              )}
            </>
          ) : (
            <ExperienceSectionPages
              section={section}
              journal={state.journal}
              assets={state.assets}
              reading={reading}
              onReadingChange={saveReading}
              onOpenInBook={openBlockInChapters}
            />
          )}
        </motion.div>
      </AnimatePresence>

      <aside className="experience-objective-bar persistent-objective" data-opening-actor="objective">
        <div>
          <p>{historical ? "Historical volume" : "Current objective"}</p>
          <strong>{historical ? "Browse every released page from this completed voyage." : currentObjective}</strong>
          <span>
            {state.session.status.replaceAll("_", " ").toLocaleLowerCase()} · sequence {state.session.currentSequence}
          </span>
        </div>
        {newContent && (
          <button className="return-current" onClick={returnToCurrent}>
            Return to Current Objective
          </button>
        )}
        {!historical && (
          <JournalActions
            state={state}
            currentBlock={currentBlock}
            choices={choices}
            answer={answer}
            setAnswer={setAnswer}
            waitRemaining={waitRemaining}
            busy={busy}
            act={act}
            onStoryChanged={() => load().then(() => undefined)}
          />
        )}
        {historical && (
          <span className="historical-lock">
            Read-only · edition checksum {state.session.versionChecksum?.slice(0, 12) ?? "unavailable"}
          </span>
        )}
        {error && (
          <p className="runtime-error" role="alert">
            {error}
          </p>
        )}
      </aside>

      <p className="sr-only" aria-live="assertive">
        {liveNotice}
      </p>
    </main>
  );
}

function ExperienceTabs({ activeSection, basePath }: { activeSection: ExperienceSection; basePath: string }) {
  const router = useRouter();

  function move(event: React.KeyboardEvent<HTMLElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLAnchorElement>('[role="tab"]'));
    const current = tabs.indexOf(document.activeElement as HTMLAnchorElement);
    if (current < 0 || !tabs.length) return;
    event.preventDefault();
    const targetIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? tabs.length - 1
          : (current + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    const target = tabs[targetIndex];
    target.focus();
    router.push(target.getAttribute("href") ?? target.href);
  }

  return (
    <nav className="experience-tabs persistent-interface" aria-label="Voyage sections" role="tablist" onKeyDown={move}>
      {experienceSections.map((item) => {
        const active = item === activeSection;
        return (
          <Link
            key={item}
            href={experienceSectionHref(basePath, item)}
            role="tab"
            aria-selected={active}
            aria-current={active ? "page" : undefined}
            aria-controls="experience-section-content"
            tabIndex={active ? 0 : -1}
          >
            <span aria-hidden="true">{sectionMark(item)}</span>
            <strong>{item[0].toLocaleUpperCase() + item.slice(1)}</strong>
          </Link>
        );
      })}
    </nav>
  );
}

function sectionMark(section: ExperienceSection) {
  return section === "chapters" ? "Ⅱ" : section === "map" ? "⌖" : section === "artifacts" ? "✦" : "✉";
}

function routeMotion(section: ExperienceSection, mode: "full" | "gentle" | "reduced") {
  if (mode === "reduced")
    return {
      initial: { opacity: 0 },
      enter: { opacity: 1 },
      exit: { opacity: 0 },
      transition: { duration: 0.08 },
    };
  const duration = mode === "gentle" ? 0.36 : 0.58;
  const variants = {
    chapters: { initial: { opacity: 0, scale: 0.985 }, enter: { opacity: 1, scale: 1 }, exit: { opacity: 0 } },
    map: {
      initial: { opacity: 0, scaleY: 0.94, transformOrigin: "top" },
      enter: { opacity: 1, scaleY: 1 },
      exit: { opacity: 0, scaleY: 0.97 },
    },
    artifacts: { initial: { opacity: 0, y: 22 }, enter: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -10 } },
    messages: { initial: { opacity: 0, x: 28 }, enter: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -18 } },
  } as const;
  return { ...variants[section], transition: { duration, ease: [0.16, 0.78, 0.2, 1] as const } };
}

function experienceThemeOf(value: string | undefined) {
  if (value === "APPLICATION" || !value) return undefined;
  if (value === "MOONLIT_BLUE" || value === "MOONLIT_JOURNAL") return "moonlit-blue";
  return "verdant-depths";
}

function JournalActions({
  state,
  currentBlock,
  choices,
  answer,
  setAnswer,
  waitRemaining,
  busy,
  act,
  onStoryChanged,
}: {
  state: SessionState;
  currentBlock: PlayerJournalBlock | null;
  choices: Array<Record<string, unknown>>;
  answer: string;
  setAnswer: (value: string) => void;
  waitRemaining: number;
  busy: boolean;
  act: (action: "continue" | "confirm" | "answer" | "choice" | "timer", extra?: JsonObject) => Promise<void>;
  onStoryChanged: () => Promise<void>;
}) {
  if (state.session.status === "PAUSED")
    return (
      <div className="awaiting-captain">
        <strong>The Captain has paused this Tall Tale.</strong>
        <p>Your page and progress are preserved.</p>
      </div>
    );
  if (state.pendingVerification?.providerType === "captainManual")
    return (
      <div className="awaiting-captain">
        <strong>{String(currentBlock?.configuration.waitingText ?? "Awaiting the Captain's approval…")}</strong>
        <p>The journal will respond when the shared session advances.</p>
      </div>
    );
  if (state.pendingVerification?.providerType === "visionLocation" && currentBlock)
    return (
      <VisionScanControl
        sessionId={state.session.id}
        blockId={currentBlock.id}
        waypointVersionId={String(currentBlock.configuration.waypointVersionId ?? "")}
        csrfToken={state.csrfToken}
        configuration={currentBlock.configuration}
        onStoryChanged={onStoryChanged}
      />
    );
  if (state.pendingVerification?.providerType === "textAnswer")
    return (
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void act("answer");
        }}
      >
        <label>
          <span>Your answer</span>
          <input value={answer} onChange={(event) => setAnswer(event.target.value)} autoComplete="off" required />
        </label>
        <button className="brass-button" disabled={busy}>
          {busy ? "Testing the answer…" : "Write answer"}
        </button>
      </form>
    );
  if (state.pendingVerification?.providerType === "timer")
    return (
      <button className="brass-button" disabled={busy || waitRemaining > 0} onClick={() => void act("timer")}>
        {waitRemaining > 0 ? `Continue in ${Math.ceil(waitRemaining / 1000)}s` : "Continue"}
      </button>
    );
  if (choices.length)
    return (
      <div className="journal-live-choices">
        {choices.map((choice) => (
          <button
            key={String(choice.id ?? choice.targetBlockId ?? choice.label)}
            disabled={busy || !choice.targetBlockId}
            onClick={() => void act("choice", { targetBlockId: choice.targetBlockId })}
          >
            <strong>{String(choice.label ?? "Choice")}</strong>
            {choice.description ? <span>{String(choice.description)}</span> : null}
          </button>
        ))}
      </div>
    );
  return (
    <button className="brass-button" disabled={busy || !currentBlock} onClick={() => void act("continue")}>
      {busy
        ? "Writing progress…"
        : String(
            currentBlock?.configuration.buttonLabel ??
              currentBlock?.configuration.primaryLabel ??
              "Continue the Tall Tale",
          )}
    </button>
  );
}

function findCurrentBlock(journal: PlayerJournalProjection) {
  return (
    journal.chapters.flatMap((chapter) => chapter.blocks).find((block) => block.id === journal.currentBlockId) ?? null
  );
}

function objectiveOf(block: PlayerJournalBlock | null) {
  if (!block) return "Await the Captain's signal.";
  const config = block.configuration;
  for (const key of [
    "objective",
    "prompt",
    "directionText",
    "playerDescription",
    "waitingText",
    "heading",
    "riddleText",
  ])
    if (typeof config[key] === "string" && config[key]) return String(config[key]);
  return block.title;
}

function openingLabel(phase: JournalOpeningPhase) {
  return (
    {
      ENTRY_IDLE: "The journal waits.",
      ENTRY_ACTIVATED: "The library recedes.",
      CLOSED_BOOK_REVEAL: "The journal settles on the table.",
      LATCH_RELEASING: "The latch releases.",
      COVER_OPENING: "The cover opens.",
      SEALED_PAGE_REVEAL: "A sealed leaf appears.",
      SEAL_BREAKING: "The wax yields.",
      BOOK_SETTLING: "The pages settle at your place.",
      JOURNAL_READY: "The journal is ready.",
    } as const
  )[phase];
}

function eventLabel(eventType: string, state: SessionState) {
  if (eventType === "hintReleased") return "The Captain released a new note in the margin.";
  if (eventType === "artifactGranted") return "A recovered artifact has settled into the journal.";
  if (eventType === "sessionPaused") return "The Captain paused the Tall Tale. Your place is preserved.";
  if (eventType === "sessionResumed") return "The Captain resumed the Tall Tale.";
  if (eventType === "sessionCompleted") return "The final page is now preserved as a completed journal.";
  return `A new page was released: ${state.block?.title ?? "the current objective"}.`;
}

function JournalStatus({ title, message, error }: { title: string; message: string; error: boolean }) {
  return (
    <main
      className="voyage-shell tall-tale-journal-shell journal-status-shell"
      style={{ "--player-text-scale": 1, "--texture-opacity": 1 } as React.CSSProperties}
    >
      <div className="ocean-depth" aria-hidden="true">
        <div data-scene-part="sky" />
        <div data-scene-part="ocean" />
      </div>
      <section className="closed-status-journal">
        <div aria-hidden="true">F</div>
        <p className="eyebrow">Tall Tale journal</p>
        <h1>{title}</h1>
        <p role={error ? "alert" : "status"}>{message}</p>
        {error && <Link href="/player/library">Return to the Tall Tale Library</Link>}
      </section>
    </main>
  );
}
