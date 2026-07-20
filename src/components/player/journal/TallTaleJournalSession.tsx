"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import type { JournalPhaseOutcome, MotionMode } from "@/animation/core/animation-types";
import { useMotionMode } from "@/animation/motion/useMotionMode";
import {
  createJournalReadyReceipt,
  isJournalInteractive,
  resolveJournalOpeningPolicy,
  waitForJournalReadiness,
  waitForJournalPhase,
  type JournalOpeningPhase,
  type JournalOpeningPolicy,
  type JournalReadyReceipt,
  type JournalReadyReason,
} from "@/animation/journal/opening-machine";
import type { FlipBookPage, PageFlipBookHandle, PageFlipReadinessSnapshot } from "@/components/animation/PageFlipBook";
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
import { platformCopy } from "@/language/platform-copy";
import { playerCopy } from "@/language/player-copy";

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
type ConnectionState = "connecting" | "live" | "reconnecting" | "offline" | "revoked" | "archived";

type JournalTeardown = () => void;

function onceJournalTeardown(teardown: JournalTeardown): JournalTeardown {
  let active = true;
  return () => {
    if (!active) return;
    active = false;
    teardown();
  };
}

export type JournalTeardownRegistry = {
  register: (teardown: JournalTeardown) => () => void;
  dispose: () => void;
  isDisposed: () => boolean;
  activeCount: () => number;
};

export function createJournalTeardownRegistry(): JournalTeardownRegistry {
  const teardowns = new Set<JournalTeardown>();
  let disposed = false;

  return {
    register(teardown) {
      if (disposed) {
        teardown();
        return () => undefined;
      }
      teardowns.add(teardown);
      return () => {
        teardowns.delete(teardown);
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      const pending = [...teardowns].reverse();
      teardowns.clear();
      for (const teardown of pending) {
        try {
          teardown();
        } catch {
          // A failed resource cleanup must not strand the remaining resources.
        }
      }
    },
    isDisposed: () => disposed,
    activeCount: () => teardowns.size,
  };
}

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

function phaseFailureReason(outcome: JournalPhaseFailureOutcome): JournalReadyReason {
  return outcome.status === "timed-out" ? "phase-timeout" : "runtime-failure";
}

function usableFocusTarget(element: HTMLElement | null): element is HTMLElement {
  return Boolean(
    element?.isConnected && !element.hidden && !element.closest("[inert]") && !element.closest('[aria-hidden="true"]'),
  );
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

type TallTaleJournalSessionProps = Readonly<{
  sessionId: string;
  identitySession?: boolean;
}>;

export function TallTaleJournalSession({ sessionId, identitySession = false }: TallTaleJournalSessionProps) {
  return (
    <TallTaleJournalSessionIdentity
      key={`${identitySession ? "identity" : "compatibility"}:${sessionId}`}
      sessionId={sessionId}
      identitySession={identitySession}
    />
  );
}

function TallTaleJournalSessionIdentity({ sessionId, identitySession = false }: TallTaleJournalSessionProps) {
  const root = useRef<HTMLElement>(null);
  const book = useRef<PageFlipBookHandle>(null);
  const journalHeading = useRef<HTMLHeadingElement>(null);
  const openingStatus = useRef<HTMLDivElement>(null);
  const openingFocusOrigin = useRef<HTMLElement | null>(null);
  const pendingOpeningFocus = useRef<{ origin: HTMLElement | null; generation: number } | null>(null);
  const activeOpeningPolicy = useRef<JournalOpeningPolicy | null>(null);
  const chapterDrawer = useRef<HTMLElement>(null);
  const objectDrawer = useRef<HTMLElement>(null);
  const drawerFocusOrigin = useRef<HTMLElement | null>(null);
  const previousDrawer = useRef<PlayerJournalReadingState["openDrawer"]>(null);
  const openingRun = useRef<AbortController | null>(null);
  const openingRelease = useRef<(() => void) | null>(null);
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
  const [readyReceipt, setReadyReceipt] = useState<JournalReadyReceipt | null>(null);
  const [replayControlsMounted, setReplayControlsMounted] = useState(false);
  const { mode, policy: motionPolicy, cycle: cycleMotion, ready: motionPolicyReady = true } = useMotionMode();
  const openingMode = useRef(mode);
  const teardownRegistry = useRef<JournalTeardownRegistry>(createJournalTeardownRegistry());
  const archiveMode = Boolean(state && (state.journal.mode === "historical" || state.session.status === "COMPLETED"));

  const trackedRequest = useCallback(() => {
    const registry = teardownRegistry.current;
    const controller = new AbortController();
    const release = registry.register(() => controller.abort());
    return { controller, registry, release };
  }, []);

  const recordPageFlipReadiness = useCallback((snapshot: PageFlipReadinessSnapshot) => {
    if (root.current) root.current.dataset.pageFlipReadiness = snapshot.status;
  }, []);

  const forcePageFlipReadableFallback = useCallback((reason: string) => {
    const handle = book.current;
    if (!handle) return false;
    try {
      handle.forceReadableFallback(reason);
      return handle.readiness().ready;
    } catch {
      return false;
    }
  }, []);

  const stopOpeningRun = useCallback(() => {
    const controller = openingRun.current;
    openingRun.current = null;
    openingRelease.current?.();
    openingRelease.current = null;
    openingGeneration.current += 1;
    openingBusy.current = false;
    controller?.abort();
  }, []);

  useLayoutEffect(() => {
    const registry = createJournalTeardownRegistry();
    teardownRegistry.current = registry;
    return () => {
      stopOpeningRun();
      registry.dispose();
    };
  }, [sessionId, stopOpeningRun]);

  const load = useCallback(
    async (event?: ProgressionEvent) => {
      const request = trackedRequest();
      try {
        const response = await fetch(`/api/play/sessions/${sessionId}`, {
          cache: "no-store",
          signal: request.controller.signal,
        });
        const body = (await response.json()) as SessionState & { error?: string };
        if (request.registry.isDisposed()) return null;
        if (!response.ok) {
          setError(body.error ?? "This Voyage Journal could not be opened. Your progress has not changed. Try again.");
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
      } catch (cause) {
        if (request.controller.signal.aborted) return null;
        throw cause;
      } finally {
        request.release();
      }
    },
    [sessionId, trackedRequest],
  );

  useEffect(() => {
    const registry = teardownRegistry.current;
    queueMicrotask(() => {
      if (registry.isDisposed()) return;
      setNow(Date.now());
      void load();
    });
    const timer = setInterval(() => setNow(Date.now()), 500);
    const clearTimer = onceJournalTeardown(() => clearInterval(timer));
    const release = registry.register(clearTimer);
    return () => {
      clearTimer();
      release();
    };
  }, [load]);

  useEffect(() => {
    const registry = teardownRegistry.current;
    let cancelled = false;
    let cancelRequest: (() => void) | null = null;
    void (async () => {
      if (identitySession) {
        const request = trackedRequest();
        cancelRequest = onceJournalTeardown(() => {
          request.controller.abort();
          request.release();
        });
        try {
          const response = await fetch(`/api/player/playthroughs/${sessionId}/journal-state`, {
            cache: "no-store",
            signal: request.controller.signal,
          });
          const body = (await response.json()) as { readingState?: PlayerJournalReadingState };
          if (!cancelled && !request.registry.isDisposed() && response.ok && body.readingState) {
            readingRef.current = body.readingState;
            setReading(body.readingState);
          }
        } catch (cause) {
          if (!request.controller.signal.aborted) throw cause;
        } finally {
          request.release();
          cancelRequest = null;
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
      if (!cancelled && !registry.isDisposed()) setReadingReady(true);
    })();
    return () => {
      cancelled = true;
      cancelRequest?.();
      cancelRequest = null;
    };
  }, [identitySession, sessionId, trackedRequest]);

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
        const request = trackedRequest();
        void fetch(`/api/player/playthroughs/${sessionId}/journal-state`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
          body: JSON.stringify(patch),
          signal: request.controller.signal,
        })
          .catch(() => undefined)
          .finally(request.release);
      } else localStorage.setItem(`tall-tale-journal:${sessionId}`, JSON.stringify(next));
    },
    [identitySession, sessionId, trackedRequest],
  );

  const settleJournalReady = useCallback(
    (
      policy: JournalOpeningPolicy,
      reason: JournalReadyReason,
      outcome: JournalOpeningConsumerStatus,
      notice: string,
    ) => {
      const receipt = createJournalReadyReceipt(policy, reason);
      const focusOrigin = openingFocusOrigin.current;
      const focusGeneration = openingGeneration.current;
      openingFocusOrigin.current = null;
      pendingOpeningFocus.current = { origin: focusOrigin, generation: focusGeneration };
      activeOpeningPolicy.current = null;
      setOpeningPhase(receipt.finalPhase);
      setOpeningOutcome(outcome);
      setOpeningNotice(notice);
      setReadyReceipt(receipt);
      setReplayControlsMounted(true);
      if (receipt.persistHasOpened) saveReading({ hasOpened: true });
    },
    [saveReading],
  );

  useLayoutEffect(() => {
    if (openingPhase !== "JOURNAL_READY") return;
    const pending = pendingOpeningFocus.current;
    pendingOpeningFocus.current = null;
    if (!pending || teardownRegistry.current.isDisposed() || openingGeneration.current !== pending.generation) {
      return;
    }
    const target = usableFocusTarget(pending.origin) ? pending.origin : journalHeading.current;
    target?.focus({ preventScroll: true });
  }, [openingPhase]);

  const startOpening = useCallback(
    async (policy: JournalOpeningPolicy, focusOrigin?: HTMLElement | null) => {
      const rootElement = root.current;
      if (openingBusy.current || !rootElement) return;
      openingBusy.current = true;
      activeOpeningPolicy.current = policy;
      openingFocusOrigin.current =
        focusOrigin ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
      const generation = ++openingGeneration.current;
      const controller = new AbortController();
      openingRun.current = controller;
      openingRelease.current = teardownRegistry.current.register(() => controller.abort());
      setOpeningOutcome("running");
      setOpeningNotice("");
      setReadyReceipt(null);
      queueMicrotask(() => openingStatus.current?.focus({ preventScroll: true }));

      const result = await runJournalOpeningPhases({
        root: rootElement,
        phases: policy.phases,
        mode,
        signal: controller.signal,
        // JOURNAL_READY is committed only after the public PageFlip readiness handoff below.
        onPhase: (phase) => flushSync(() => setOpeningPhase(phase === "JOURNAL_READY" ? "BOOK_SETTLING" : phase)),
      });

      const readiness =
        result.status === "completed" || result.status === "completed-fallback"
          ? await waitForJournalReadiness(() => book.current?.readiness() ?? null, controller.signal)
          : null;

      if (openingGeneration.current !== generation || openingRun.current !== controller) return;
      openingRun.current = null;
      openingRelease.current?.();
      openingRelease.current = null;
      openingBusy.current = false;

      if (result.status === "completed" || result.status === "completed-fallback") {
        if (readiness?.status === "aborted") {
          if (!forcePageFlipReadableFallback("Journal opening readiness was interrupted")) {
            setOpeningOutcome("failure");
            setOpeningNotice("The Voyage Journal could not prepare a readable page. Try Skip opening again.");
            return;
          }
          settleJournalReady(
            policy,
            "recoverable-interruption",
            "aborted",
            "Page preparation was interrupted. The Voyage Journal is ready in its readable final state.",
          );
          return;
        }
        if (readiness?.status !== "ready") {
          const fallbackReason =
            readiness?.status === "timed-out" ? "PageFlip readiness timed out" : "PageFlip readiness probe failed";
          if (!forcePageFlipReadableFallback(fallbackReason)) {
            setOpeningOutcome("failure");
            setOpeningNotice("The Voyage Journal could not prepare a readable page. Try Skip opening again.");
            return;
          }
          settleJournalReady(
            policy,
            "pageflip-readiness-failure",
            "failure",
            "Page turning could not report ready in time. The Voyage Journal is available in a readable fallback state.",
          );
          return;
        }
        const readinessFallback = ["fallback", "reduced"].includes(readiness.readinessStatus);
        const settledOutcome =
          result.status === "completed-fallback" || readinessFallback ? "completed-fallback" : result.status;
        settleJournalReady(
          policy,
          settledOutcome,
          settledOutcome,
          readinessFallback
            ? "Page turning is using its readable fallback. The Voyage Journal is ready."
            : result.status === "completed-fallback"
              ? "Motion was reduced. The Voyage Journal is open in its readable final state."
              : "",
        );
        return;
      }

      if (result.status === "aborted") {
        if (!forcePageFlipReadableFallback("Journal opening was interrupted")) {
          setOpeningOutcome("failure");
          setOpeningNotice("The Voyage Journal could not prepare a readable page. Try Skip opening again.");
          return;
        }
        settleJournalReady(
          policy,
          "recoverable-interruption",
          "aborted",
          "The opening was interrupted. The journal is ready in its readable final state.",
        );
        return;
      }

      const phaseFailureReadiness = book.current?.readiness() ?? null;
      if (phaseFailureReadiness?.ready) {
        const runtimeStillAvailable = phaseFailureReadiness.status === "ready";
        settleJournalReady(
          policy,
          phaseFailureReason(result.outcome),
          "failure",
          runtimeStillAvailable
            ? "The animated opening could not finish. The journal and page turning are ready."
            : "The animated opening could not finish. The journal is ready in a readable fallback state.",
        );
        return;
      }

      if (!forcePageFlipReadableFallback(`Journal opening phase failed: ${result.outcome.status}`)) {
        setOpeningOutcome("failure");
        setOpeningNotice("The Voyage Journal could not prepare a readable page. Try Skip opening again.");
        return;
      }
      settleJournalReady(
        policy,
        phaseFailureReason(result.outcome),
        "failure",
        "The animated opening could not finish. The journal is ready in a readable fallback state.",
      );
    },
    [forcePageFlipReadableFallback, mode, settleJournalReady],
  );

  const abortOpeningForMotionChange = useCallback(() => {
    if (!openingRun.current) return;
    const policy = activeOpeningPolicy.current;
    stopOpeningRun();
    if (!policy) return;
    if (forcePageFlipReadableFallback("Motion changed during the journal opening")) {
      settleJournalReady(
        policy,
        "motion-changed",
        "aborted",
        "Motion changed during the opening. The journal is ready without replaying the ceremony.",
      );
      return;
    }
    setOpeningOutcome("failure");
    setOpeningNotice("The Voyage Journal could not prepare a readable page. Try Skip opening again.");
  }, [forcePageFlipReadableFallback, settleJournalReady, stopOpeningRun]);

  const changeMotionMode = useCallback(() => {
    abortOpeningForMotionChange();
    cycleMotion();
  }, [abortOpeningForMotionChange, cycleMotion]);

  useEffect(() => {
    if (!state || !readingReady || liveReady) return;
    const registry = teardownRegistry.current;
    processedSequence.current = state.session.currentSequence;
    queueMicrotask(() => {
      if (registry.isDisposed()) return;
      if (reading.lastEventSequence < state.session.currentSequence)
        saveReading({ lastEventSequence: state.session.currentSequence });
      if (archiveMode) setConnection("archived");
      setLiveReady(true);
    });
  }, [archiveMode, liveReady, reading.lastEventSequence, readingReady, saveReading, state]);

  useEffect(() => {
    if (!liveReady || archiveMode) return;
    const registry = teardownRegistry.current;
    const source = new EventSource(`/api/play/sessions/${sessionId}/events?after=${processedSequence.current}`);
    source.onopen = () => {
      if (!registry.isDisposed()) setConnection("live");
    };
    source.onerror = () => {
      if (!registry.isDisposed()) setConnection(navigator.onLine === false ? "offline" : "reconnecting");
    };
    function accessRevoked() {
      if (registry.isDisposed()) return;
      setConnection("revoked");
      setError("");
      closeSource();
    }
    function progression(message: Event) {
      if (registry.isDisposed()) return;
      try {
        const event = JSON.parse((message as MessageEvent<string>).data) as ProgressionEvent;
        if (event.sequence <= processedSequence.current) return;
        void load(event);
      } catch {
        setConnection("reconnecting");
      }
    }
    source.addEventListener("access-revoked", accessRevoked);
    source.addEventListener("progression", progression);
    const closeSource = onceJournalTeardown(() => {
      source.onopen = null;
      source.onerror = null;
      source.removeEventListener("access-revoked", accessRevoked);
      source.removeEventListener("progression", progression);
      source.close();
    });
    const release = registry.register(closeSource);
    return () => {
      closeSource();
      release();
    };
  }, [archiveMode, liveReady, load, sessionId]);

  useEffect(() => {
    if (connection === "live" || connection === "revoked" || !liveReady || archiveMode) return;
    const registry = teardownRegistry.current;
    const timer = setInterval(() => void load(), 5000);
    const clearTimer = onceJournalTeardown(() => clearInterval(timer));
    const release = registry.register(clearTimer);
    return () => {
      clearTimer();
      release();
    };
  }, [archiveMode, connection, liveReady, load]);

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
    if (!motionPolicyReady || !state || !readingReady || !root.current || initializedOpening.current) return;
    const registry = teardownRegistry.current;
    initializedOpening.current = true;
    const request = archiveMode
      ? "completed-archive"
      : reading.hasOpened || state.session.previewMode
        ? "returning"
        : "first";
    const policy = resolveJournalOpeningPolicy({ request, mode });
    if (policy.autoStart) {
      queueMicrotask(() => {
        if (!registry.isDisposed()) void startOpening(policy);
      });
    }
  }, [archiveMode, mode, motionPolicyReady, reading.hasOpened, readingReady, startOpening, state]);

  useEffect(() => {
    if (openingMode.current === mode) return;
    openingMode.current = mode;
    abortOpeningForMotionChange();
  }, [abortOpeningForMotionChange, mode]);

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
    const registry = teardownRegistry.current;
    setLiveNotice("");
    queueMicrotask(() => {
      if (!registry.isDisposed()) setLiveNotice(label);
    });
    if (followingCurrent.current || currentBlockId === targetBlockId) {
      if (target !== currentPage) book.current?.flipTo(target);
      setNewContent(false);
    } else setNewContent(true);
    saveReading({ lastEventSequence: pendingEvent.sequence });
    setPendingEvent(null);
  }, [currentPage, pages, pendingEvent, saveReading, state]);

  useEffect(() => {
    const journalRoot = root.current;
    if (!journalRoot) return;
    const registry = teardownRegistry.current;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape" && readingRef.current.openDrawer) saveReading({ openDrawer: null });
    };
    journalRoot.addEventListener("keydown", close);
    const remove = onceJournalTeardown(() => journalRoot.removeEventListener("keydown", close));
    const release = registry.register(remove);
    return () => {
      remove();
      release();
    };
  }, [saveReading, state?.session.id]);

  useEffect(() => {
    const prior = previousDrawer.current;
    previousDrawer.current = reading.openDrawer;
    const registry = teardownRegistry.current;
    queueMicrotask(() => {
      if (registry.isDisposed()) return;
      if (reading.openDrawer) {
        const panel = reading.openDrawer === "chapters" ? chapterDrawer.current : objectDrawer.current;
        panel?.querySelector<HTMLElement>("button")?.focus({ preventScroll: true });
      } else if (prior) {
        const origin = drawerFocusOrigin.current;
        drawerFocusOrigin.current = null;
        const target = usableFocusTarget(origin) ? origin : journalHeading.current;
        target?.focus({ preventScroll: true });
      }
    });
  }, [reading.openDrawer]);

  async function openJournal(focusOrigin: HTMLElement) {
    await startOpening(resolveJournalOpeningPolicy({ request: "first", mode }), focusOrigin);
  }

  async function replayOpening(request: "manual-full-replay" | "manual-abbreviated-replay", focusOrigin: HTMLElement) {
    await startOpening(resolveJournalOpeningPolicy({ request, mode }), focusOrigin);
  }

  function skipOpening() {
    const policy = activeOpeningPolicy.current;
    stopOpeningRun();
    if (!policy) return;
    if (forcePageFlipReadableFallback("Journal opening skipped")) {
      settleJournalReady(policy, "skipped", "skipped", "Opening skipped. The journal is ready.");
      return;
    }
    setOpeningOutcome("failure");
    setOpeningNotice("The Voyage Journal could not prepare a readable page. Try Skip opening again.");
  }

  function toggleDrawer(drawer: NonNullable<PlayerJournalReadingState["openDrawer"]>, trigger: HTMLElement) {
    if (reading.openDrawer === drawer) {
      saveReading({ openDrawer: null });
      return;
    }
    drawerFocusOrigin.current = trigger;
    saveReading({ openDrawer: drawer });
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
    const request = trackedRequest();
    try {
      const response = await fetch(`/api/play/sessions/${sessionId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(state.csrfToken ? { "x-csrf-token": state.csrfToken } : {}),
        },
        body: JSON.stringify({ action, idempotencyKey, answer, ...extra }),
        signal: request.controller.signal,
      });
      const body = (await response.json()) as { state?: SessionState; accepted?: boolean; error?: string };
      if (request.registry.isDisposed()) return;
      if (!response.ok)
        setError(body.error ?? "The Voyage could not advance. Your progress has not changed. Try again.");
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
    } catch {
      if (!request.controller.signal.aborted && !request.registry.isDisposed()) {
        setError("The Voyage could not advance. Your progress has not changed. Try again.");
      }
    } finally {
      request.release();
      if (!request.registry.isDisposed()) setBusy(false);
    }
  }

  if (!state || !readingReady)
    return (
      <JournalStatus
        title="Opening Voyage Journal"
        message={error || "Loading the current Passage..."}
        error={Boolean(error)}
        motionMode={mode}
        motionLevel={motionPolicy.level}
      />
    );

  const journalReady = isJournalInteractive(openingPhase);
  const openingActive = !journalReady;
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
      data-journal-ready-reason={readyReceipt?.reason}
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
      <header
        className="tall-tale-session-header persistent-interface"
        data-opening-actor="persistent-interface"
        aria-hidden={openingActive}
        inert={openingActive ? true : undefined}
      >
        <div>
          <Link href="/player/library">← {platformCopy.chronicleLibrary.value}</Link>
          <p className="eyebrow">{historical ? "Voyage Record" : (state.chapter?.title ?? "Active Voyage")}</p>
          <h1>{state.tale.title}</h1>
        </div>
        <div className="journal-session-tools">
          <span className={`runtime-connection ${connection}`} role="status">
            <i />
            {connection === "live"
              ? "Captain channel connected"
              : connection === "archived"
                ? "Completed archive"
                : connection === "revoked"
                  ? "Access revoked"
                  : connection === "offline"
                    ? "Offline"
                    : "Reconnecting"}
          </span>
          <button onClick={changeMotionMode}>Motion: {mode}</button>
          {replayControlsMounted && (
            <div role="group" aria-label="Journal opening replay">
              <button onClick={(event) => void replayOpening("manual-full-replay", event.currentTarget)}>
                Replay full opening
              </button>
              <button onClick={(event) => void replayOpening("manual-abbreviated-replay", event.currentTarget)}>
                Replay short opening
              </button>
            </div>
          )}
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
        aria-hidden={openingActive}
        inert={openingActive ? true : undefined}
      >
        <header className="section-masthead">
          <div>
            <p className="eyebrow">{historical ? "Preserved Voyage Record" : "Active Voyage"}</p>
            <h2 ref={journalHeading} id="tall-tale-journal-heading" tabIndex={-1}>
              {state.session.versionLabel} Voyage Journal
            </h2>
          </div>
          <p>
            {historical
              ? "Read-only pages from the exact edition this crew experienced."
              : "The Captain releases each Passage for this Voyage."}
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
          coverSubtitle={historical ? "Preserved Voyage Record" : "Voyage Journal"}
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
          onReadinessChange={recordPageFlipReadiness}
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
        <div
          ref={openingStatus}
          className="journal-opening tall-tale-opening"
          role="dialog"
          aria-modal="true"
          aria-labelledby="journal-opening-heading"
          tabIndex={-1}
        >
          <h2 id="journal-opening-heading" className="sr-only">
            Open the voyage journal
          </h2>
          <button className="wax-open" onClick={(event) => void openJournal(event.currentTarget)}>
            <span>âœ¦</span>
            <strong>Open the journal</strong>
            <small>{reading.hasOpened ? "Return to your place" : platformCopy.beginVoyage.value}</small>
          </button>
          <Link href="/player/library">Return to {platformCopy.chronicleLibrary.value}</Link>
        </div>
      )}
      {openingPhase !== "ENTRY_IDLE" && !journalReady && (
        <div
          ref={openingStatus}
          className="journal-opening-status"
          role="dialog"
          aria-modal="true"
          aria-label="Journal opening in progress"
          tabIndex={-1}
        >
          <span>{openingLabel(openingPhase)}</span>
          {openingNotice && openingOutcome === "failure" && <p role="alert">{openingNotice}</p>}
          <button onClick={skipOpening}>Skip ceremony</button>
          <button onClick={changeMotionMode}>Motion: {mode}</button>
          <Link href="/player/library">Return to {platformCopy.chronicleLibrary.value}</Link>
        </div>
      )}
      {openingNotice && (journalReady || openingOutcome === "aborted") && (
        <p className="journal-opening-status" role={openingOutcome === "failure" ? "alert" : "status"}>
          {openingNotice}
        </p>
      )}

      <aside
        ref={chapterDrawer}
        className={`journal-context-drawer journal-chapters-drawer ${reading.openDrawer === "chapters" ? "open" : ""}`}
        aria-hidden={reading.openDrawer !== "chapters"}
        inert={openingActive || reading.openDrawer !== "chapters" ? true : undefined}
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
        ref={objectDrawer}
        className={`journal-context-drawer journal-objects-drawer ${reading.openDrawer && reading.openDrawer !== "chapters" ? "open" : ""}`}
        aria-hidden={!reading.openDrawer || reading.openDrawer === "chapters"}
        inert={openingActive || !reading.openDrawer || reading.openDrawer === "chapters" ? true : undefined}
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

      <nav
        className="journal-context-tabs persistent-interface"
        aria-label="Journal tools"
        aria-hidden={openingActive}
        inert={openingActive ? true : undefined}
      >
        {(["chapters", "map", "artifacts", "messages"] as const).map((drawer) => (
          <button
            key={drawer}
            aria-expanded={reading.openDrawer === drawer}
            onClick={(event) => toggleDrawer(drawer, event.currentTarget)}
          >
            {drawer}
          </button>
        ))}
      </nav>

      <aside
        className="tall-tale-objective-tray persistent-objective"
        data-opening-actor="objective"
        aria-hidden={openingActive}
        inert={openingActive ? true : undefined}
      >
        <div>
          <p>{historical ? "Historical volume" : "Current objective"}</p>
          <strong>{historical ? "Browse every released page from this completed voyage." : currentObjective}</strong>
          <span>
            {state.session.status.replaceAll("_", " ").toLocaleLowerCase()} · update {state.session.currentSequence}
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

      {connection === "revoked" && journalReady && (
        <div className="journal-connection-note" role="alert">
          <strong>Your access to this Voyage was revoked.</strong>
          <span>
            The released Passages remain readable, but this Journal will not reconnect or request new progress.
          </span>
        </div>
      )}
      {connection !== "live" && connection !== "archived" && connection !== "revoked" && journalReady && (
        <div className="journal-connection-note" role="status">
          <strong>{connection === "offline" ? "You appear to be offline." : "Reconnecting to the Captain."}</strong>
          <span>Your released Passages remain available while Voyage updates reconnect.</span>
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
        <strong>The Captain has paused this Voyage.</strong>
        <p>Your current Passage and progress are preserved.</p>
      </div>
    );
  if (state.pendingVerification?.providerType === "captainManual")
    return (
      <div className="awaiting-captain">
        <strong>{String(currentBlock?.configuration.waitingText ?? playerCopy.awaitingCaptain.value)}</strong>
        <p>{playerCopy.awaitingCaptainDetail.value}</p>
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
              platformCopy.continueVoyage.value,
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
  if (!block) return playerCopy.awaitingCaptain.value;
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
  if (eventType === "sessionPaused") return "The Captain paused this Voyage. Your progress is preserved.";
  if (eventType === "sessionResumed") return "The Captain resumed this Voyage.";
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
        <p className="eyebrow">Voyage Journal</p>
        <h1>{title}</h1>
        <p role={error ? "alert" : "status"}>{message}</p>
        {error && <Link href="/player/library">Return to {platformCopy.chronicleLibrary.value}</Link>}
      </section>
    </main>
  );
}
