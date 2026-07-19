"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import type { JournalPhaseOutcome, MotionMode } from "@/animation/core/animation-types";
import { useMotionMode } from "@/animation/motion/useMotionMode";
import {
  isJournalInteractive,
  waitForJournalPhase,
  type JournalOpeningPhase,
} from "@/animation/journal/opening-machine";
import type { FlipBookPage, PageFlipBookHandle } from "@/components/animation/PageFlipBook";
import { PhysicalJournalBook } from "@/components/player/journal/PhysicalJournalBook";
import { TallTaleJournalPageContent, type JournalAsset } from "@/components/player/journal/TallTaleJournalPage";
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
  tale: { title: string; slug: string; subtitle: string | null; shortDescription: string | null };
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

const returningOpeningSequence: JournalOpeningPhase[] = ["BOOK_SETTLING", "JOURNAL_READY"];

export type JournalOpeningConsumerStatus =
  | "idle"
  | "running"
  | "completed"
  | "completed-fallback"
  | "aborted"
  | "failure"
  | "skipped";

type JournalPhaseFailureOutcome = Exclude<
  JournalPhaseOutcome,
  { status: "completed" | "completed-fallback" | "aborted" }
>;

export type JournalOpeningRunResult =
  | { status: "completed" }
  | { status: "completed-fallback"; reasons: string[] }
  | { status: "aborted"; phase: JournalOpeningPhase }
  | { status: "failure"; outcome: JournalPhaseFailureOutcome };

type JournalPhaseWaiter = typeof waitForJournalPhase;

export function journalOpeningAllowsPersistence(status: JournalOpeningConsumerStatus) {
  return status === "completed" || status === "completed-fallback" || status === "skipped";
}

export async function runJournalOpeningPhases({
  root,
  phases,
  mode,
  signal,
  onPhase,
  waitForPhase = waitForJournalPhase,
}: {
  root: HTMLElement;
  phases: readonly JournalOpeningPhase[];
  mode: MotionMode;
  signal: AbortSignal;
  onPhase: (phase: JournalOpeningPhase) => void;
  waitForPhase?: JournalPhaseWaiter;
}): Promise<JournalOpeningRunResult> {
  const fallbackReasons: string[] = [];
  for (const phase of phases) {
    if (signal.aborted) return { status: "aborted", phase };
    let outcome: JournalPhaseOutcome;
    try {
      onPhase(phase);
      outcome = await waitForPhase(root, phase, mode, signal);
    } catch {
      return {
        status: "failure",
        outcome: { status: "runtime-failed", phase, errorCode: "journal-phase-wait-rejected" },
      };
    }
    if (outcome.status === "completed") continue;
    if (outcome.status === "completed-fallback") {
      fallbackReasons.push(outcome.reason);
      continue;
    }
    if (outcome.status === "aborted") return { status: "aborted", phase: outcome.phase };
    return { status: "failure", outcome };
  }
  return fallbackReasons.length
    ? { status: "completed-fallback", reasons: [...new Set(fallbackReasons)] }
    : { status: "completed" };
}

export function TallTaleJournalSession({
  sessionId,
  identitySession = false,
}: {
  sessionId: string;
  identitySession?: boolean;
}) {
  const root = useRef<HTMLElement>(null);
  const book = useRef<PageFlipBookHandle>(null);
  const openingRun = useRef<AbortController | null>(null);
  const openingGeneration = useRef(0);
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
  const [openingOutcome, setOpeningOutcome] = useState<JournalOpeningConsumerStatus>("idle");
  const [openingNotice, setOpeningNotice] = useState("");
  const { mode, policy: motionPolicy, cycle: cycleMotion } = useMotionMode();
  const openingMode = useRef(mode);

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

  const startOpening = useCallback(
    async (phases: readonly JournalOpeningPhase[], persistOnCompletion: boolean) => {
      const rootElement = root.current;
      if (openingBusy.current || !rootElement) return;
      openingBusy.current = true;
      const generation = ++openingGeneration.current;
      const controller = new AbortController();
      openingRun.current = controller;
      setOpeningOutcome("running");
      setOpeningNotice("");

      const result = await runJournalOpeningPhases({
        root: rootElement,
        phases,
        mode,
        signal: controller.signal,
        onPhase: (phase) => flushSync(() => setOpeningPhase(phase)),
      });

      if (openingGeneration.current !== generation || openingRun.current !== controller) return;
      openingRun.current = null;
      openingBusy.current = false;

      if (result.status === "completed" || result.status === "completed-fallback") {
        setOpeningPhase("JOURNAL_READY");
        setOpeningOutcome(result.status);
        setOpeningNotice(
          result.status === "completed-fallback"
            ? "Motion was reduced. The journal is open in its readable final state."
            : "",
        );
        if (persistOnCompletion && journalOpeningAllowsPersistence(result.status)) {
          saveReading({ hasOpened: true });
        }
        return;
      }

      if (result.status === "aborted") {
        setOpeningPhase("ENTRY_IDLE");
        setOpeningOutcome("aborted");
        setOpeningNotice("The opening stopped before completion. You can open the journal again.");
        return;
      }

      setOpeningPhase("JOURNAL_READY");
      setOpeningOutcome("failure");
      setOpeningNotice("The animated opening could not finish. The journal is ready in a readable fallback state.");
    },
    [mode, saveReading],
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
      queueMicrotask(() => void startOpening(returningOpeningSequence, false));
    }
  }, [reading.hasOpened, readingReady, startOpening, state]);

  useEffect(() => {
    if (openingMode.current === mode) return;
    openingMode.current = mode;
    const controller = openingRun.current;
    if (!controller) return;
    openingRun.current = null;
    openingGeneration.current += 1;
    openingBusy.current = false;
    controller.abort();
    setOpeningPhase("JOURNAL_READY");
    setOpeningOutcome("aborted");
    setOpeningNotice("Motion changed during the opening. The journal is ready without replaying the ceremony.");
  }, [mode]);

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

  useEffect(
    () => () => {
      const controller = openingRun.current;
      openingRun.current = null;
      openingGeneration.current += 1;
      openingBusy.current = false;
      controller?.abort();
    },
    [sessionId],
  );

  useEffect(() => {
    const journalRoot = root.current;
    if (!journalRoot) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape" && readingRef.current.openDrawer) saveReading({ openDrawer: null });
    };
    journalRoot.addEventListener("keydown", close);
    return () => journalRoot.removeEventListener("keydown", close);
  }, [saveReading, state?.session.id]);

  async function openJournal() {
    await startOpening(openingSequence, true);
  }

  function skipOpening() {
    const controller = openingRun.current;
    openingRun.current = null;
    openingGeneration.current += 1;
    openingBusy.current = false;
    controller?.abort();
    setOpeningPhase("JOURNAL_READY");
    setOpeningOutcome("skipped");
    setOpeningNotice("Opening skipped. The journal is ready.");
    if (journalOpeningAllowsPersistence("skipped")) saveReading({ hasOpened: true });
  }

  function turnTo(page: number) {
    book.current?.flipTo(page);
    saveReading({ openDrawer: null });
  }

  function returnToCurrent() {
    if (!state) return;
    const page = pageIndexForJournalBlock(pages, state.journal.currentBlockId);
    followingCurrent.current = true;
    setNewContent(false);
    book.current?.flipTo(page);
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
        message={error || "Finding the current leafâ€¦"}
        error={Boolean(error)}
        motionMode={mode}
        motionLevel={motionPolicy.level}
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
  const historical = state.journal.mode === "historical";
  const contextBlocks = state.journal.chapters.flatMap((chapter) => chapter.blocks);

  return (
    <main
      ref={root}
      className={`voyage-shell tall-tale-journal-shell mode-${state.journal.mode}`}
      data-journal-phase={openingPhase}
      data-journal-opening-outcome={openingOutcome}
      data-live-event={liveNotice ? "revealed" : "idle"}
      data-motion-mode={mode}
      data-motion-level={motionPolicy.level}
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
          <Link href="/player/library">â† Tall Tale Library</Link>
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
            <span>âœ¦</span>
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
      {openingNotice && (journalReady || openingOutcome === "aborted") && (
        <p className="journal-opening-status" role={openingOutcome === "failure" ? "alert" : "status"}>
          {openingNotice}
        </p>
      )}

      <aside
        className={`journal-context-drawer journal-chapters-drawer ${reading.openDrawer === "chapters" ? "open" : ""}`}
        aria-hidden={reading.openDrawer !== "chapters"}
      >
        <button
          className="drawer-close"
          onClick={() => saveReading({ openDrawer: null })}
          aria-label="Close chapter drawer"
        >
          Ã—
        </button>
        <h2>Released chapters</h2>
        {state.journal.chapters.map((chapter) => (
          <button key={chapter.id} onClick={() => turnTo(pageIndexForJournalChapter(pages, chapter.id))}>
            <strong>{chapter.title}</strong>
            <span>{chapter.blocks.length} released leaves</span>
          </button>
        ))}
      </aside>
      <aside
        className={`journal-context-drawer journal-objects-drawer ${reading.openDrawer && reading.openDrawer !== "chapters" ? "open" : ""}`}
        aria-hidden={!reading.openDrawer || reading.openDrawer === "chapters"}
      >
        <button
          className="drawer-close"
          onClick={() => saveReading({ openDrawer: null })}
          aria-label="Close journal tool drawer"
        >
          Ã—
        </button>
        <h2>{drawerTitle(reading.openDrawer)}</h2>
        {contextBlocks
          .filter((block) => drawerIncludes(reading.openDrawer, block))
          .map((block) => (
            <button key={block.id} onClick={() => turnTo(pageIndexForJournalBlock(pages, block.id))}>
              <strong>{block.title}</strong>
              <span>{block.progress}</span>
            </button>
          ))}
        {!contextBlocks.some((block) => drawerIncludes(reading.openDrawer, block)) && (
          <p>No released pages of this kind yet.</p>
        )}
      </aside>

      <nav className="journal-context-tabs persistent-interface" aria-label="Journal tools">
        {(["chapters", "map", "artifacts", "messages"] as const).map((drawer) => (
          <button
            key={drawer}
            aria-expanded={reading.openDrawer === drawer}
            onClick={() => saveReading({ openDrawer: reading.openDrawer === drawer ? null : drawer })}
          >
            {drawer}
          </button>
        ))}
      </nav>

      <aside className="tall-tale-objective-tray persistent-objective" data-opening-actor="objective">
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

      {connection !== "live" && journalReady && (
        <div className="journal-connection-note" role="status">
          <strong>
            {connection === "offline" ? "The journal is closed to this sailor." : "The signal is crossing rough water."}
          </strong>
          <span>Reading remains available while canonical state reconnects.</span>
          <button onClick={() => void load()}>Retry now</button>
        </div>
      )}
      <p className="sr-only" aria-live="assertive">
        {liveNotice}
      </p>
    </main>
  );
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
}: {
  state: SessionState;
  currentBlock: PlayerJournalBlock | null;
  choices: Array<Record<string, unknown>>;
  answer: string;
  setAnswer: (value: string) => void;
  waitRemaining: number;
  busy: boolean;
  act: (action: "continue" | "confirm" | "answer" | "choice" | "timer", extra?: JsonObject) => Promise<void>;
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
        <strong>{String(currentBlock?.configuration.waitingText ?? "Awaiting the Captain's approvalâ€¦")}</strong>
        <p>The journal will respond when the shared session advances.</p>
      </div>
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
          {busy ? "Testing the answerâ€¦" : "Write answer"}
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
        ? "Writing progressâ€¦"
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

function drawerIncludes(drawer: PlayerJournalReadingState["openDrawer"], block: PlayerJournalBlock) {
  if (drawer === "map") return ["map", "locationVerification"].includes(block.journalKind);
  if (drawer === "artifacts") return block.journalKind === "artifact";
  if (drawer === "messages") return block.journalKind === "message";
  return false;
}

function drawerTitle(drawer: PlayerJournalReadingState["openDrawer"]) {
  return drawer === "map"
    ? "Charts and locations"
    : drawer === "artifacts"
      ? "Recovered artifacts"
      : "Letters and messages";
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

function JournalStatus({
  title,
  message,
  error,
  motionMode,
  motionLevel,
}: {
  title: string;
  message: string;
  error: boolean;
  motionMode: MotionMode;
  motionLevel: MotionMode;
}) {
  return (
    <main
      className="voyage-shell tall-tale-journal-shell journal-status-shell"
      data-motion-mode={motionMode}
      data-motion-level={motionLevel}
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
