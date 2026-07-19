"use client";

import { forwardRef, useCallback, useEffect, useId, useImperativeHandle, useMemo, useRef, useState } from "react";
import type { PageFlip as PageFlipInstance } from "page-flip";
import type { MotionMode } from "@/animation/core/animation-types";
import { changeMountedMetric, recordAssetFailure } from "@/animation/core/metrics";
import { SceneHost } from "@/animation/hosts/SceneHost";
import { useOptionalSceneHost } from "@/animation/hosts/SceneHostContext";
import type {
  ExternalSceneTargetHandle,
  ExternalTargetExportRequest,
  RuntimeSurfaceLease,
  SceneHostHandle,
  SceneTargetHandle,
} from "@/animation/hosts/scene-host-types";
import {
  createPageFlipMountId,
  PageFlipBoundaryController,
  type PageFlipBoundarySnapshot,
  type PageFlipPageTargetCapability,
  type PageFlipPageTargetAuthority,
} from "./pageflip-boundary";

export type PageFlipBookHandle = {
  next: () => void;
  previous: () => void;
  turnTo: (page: number) => void;
  flipTo: (page: number) => void;
  currentPage: () => number;
  pageCount: () => number;
  orientation: () => "portrait" | "landscape";
  boundary: () => PageFlipBoundarySnapshot | null;
  pageTargets: () => PageFlipPageTargetExportAuthority | null;
  readiness: () => PageFlipReadinessSnapshot;
  /** Abandons an unready or unhealthy StPageFlip runtime and exposes the readable static current page. */
  forceReadableFallback: (reason: string) => void;
};

export type FlipBookPage = {
  id: string;
  density: "hard" | "soft";
  label: string;
  content: React.ReactNode;
};

export type PageTurnLifecyclePhase = "turn-start" | "turn-commit" | "turn-settle" | "turn-cancel" | "turn-failed";

export const PAGE_TURN_LIFECYCLE_BROWSER_EVENT = "forever:page-turn-lifecycle" as const;
export const PAGE_FLIP_DEVELOPMENT_FAILPOINT_GLOBAL = "__FOREVER_PAGEFLIP_FAILPOINT__" as const;

export type PageFlipDevelopmentFailpoint = "dynamic-import" | "runtime-init" | "readiness-probe";
export type PageTurnLifecycleBrowserPhase = "start" | "commit" | "settle" | "cancel" | "failed";
export type PageTurnLifecycleBrowserReason =
  | "none"
  | "page-boundary-no-op"
  | "same-spread-or-boundary-no-op"
  | "replaced-by-newer-intent"
  | "runtime-disposed"
  | "runtime-failure"
  | "readiness-timeout"
  | "readable-fallback"
  | "development-dynamic-import"
  | "development-runtime-init"
  | "development-readiness-probe"
  | "unknown";
export type PageTurnLifecycleBrowserOutcome = "started" | "committed" | "settled" | "cancelled" | "failed";
export type PageTurnLifecycleBrowserDetail = Readonly<{
  version: 1;
  bookId: string;
  mountId: string;
  request: PageTurnSource;
  source: PageTurnSource;
  fromPage: number;
  toPage: number;
  phase: PageTurnLifecycleBrowserPhase;
  reason: PageTurnLifecycleBrowserReason;
  outcome: PageTurnLifecycleBrowserOutcome;
  boundaryGeneration: number;
  runtimeGeneration: number;
  currentPage: number;
  fallbackStatus: "runtime" | "reduced" | "fallback";
}>;

declare global {
  interface Window {
    __FOREVER_PAGEFLIP_FAILPOINT__?: PageFlipDevelopmentFailpoint;
  }

  interface HTMLElementEventMap {
    "forever:page-turn-lifecycle": CustomEvent<PageTurnLifecycleBrowserDetail>;
  }
}

export type PageTurnSource =
  | "control-next"
  | "control-previous"
  | "keyboard-next"
  | "keyboard-previous"
  | "imperative-next"
  | "imperative-previous"
  | "imperative-turn-to"
  | "imperative-flip-to"
  | "runtime-gesture"
  | "runtime-initialization";

export type PageTurnLifecycleEvent = Readonly<{
  phase: PageTurnLifecyclePhase;
  bookId: string;
  mountId: string;
  source: PageTurnSource;
  fromPage: number;
  toPage: number;
  orientation: "portrait" | "landscape";
  mode: MotionMode;
  timestamp: number;
  reason?: string;
  fallback: boolean;
  generation: number;
}>;

export type PageFlipReadinessSnapshot = Readonly<{
  status: "initializing" | "ready" | "busy" | "reduced" | "fallback" | "disposed";
  ready: boolean;
  bookId: string;
  mountId: string;
  mode: MotionMode;
  generation: number;
}>;

export type PageFlipPageTargetExportAuthority = PageFlipPageTargetAuthority &
  Readonly<{
    exportTarget: (
      capability: PageFlipPageTargetCapability,
      request: Omit<ExternalTargetExportRequest, "target">,
    ) => ExternalSceneTargetHandle;
  }>;

type FocusMemory = { kind: "control"; name: "previous" | "next" } | { kind: "page"; index: number };
type PageFlipTurnIntent =
  | Readonly<{ kind: "next"; source: PageTurnSource }>
  | Readonly<{ kind: "previous"; source: PageTurnSource }>
  | Readonly<{ kind: "turn-to"; page: number; source: PageTurnSource }>
  | Readonly<{ kind: "flip-to"; page: number; source: PageTurnSource }>;
type ActivePageTurn = Readonly<{
  source: PageTurnSource;
  fromPage: number;
  requestedPage: number;
  generation: number;
}>;
type QueuedPageTurn = Readonly<{ intent: PageFlipTurnIntent }>;
type PageFlipTurnDispatch = "animated" | "immediate" | "no-op";
type PageFlipCollectionView = Readonly<{
  getSpreadIndexByPage: (page: number) => number | null;
}>;
type PageFlipWithCollection = PageFlipInstance & Readonly<{ getPageCollection: () => PageFlipCollectionView }>;

const pageFlipRuntimeProperties = ["transform", "clip-path", "width", "height"] as const;

function clampPage(page: number, count: number) {
  return Math.min(Math.max(0, page), Math.max(0, count - 1));
}

function deterministicMountToken(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isSafeFocusTarget(element: HTMLElement | null, root: HTMLElement) {
  if (!element?.isConnected || !root.contains(element)) return false;
  if (element instanceof HTMLButtonElement && element.disabled) return false;
  if (element.closest("[inert],[aria-hidden='true'],[hidden]")) return false;

  let current: HTMLElement | null = element;
  while (current && root.contains(current)) {
    const style = current.ownerDocument.defaultView?.getComputedStyle(current);
    if (style?.display === "none" || style?.visibility === "hidden") return false;
    current = current.parentElement;
  }
  return true;
}

function browserPhase(phase: PageTurnLifecyclePhase): PageTurnLifecycleBrowserPhase {
  if (phase === "turn-start") return "start";
  if (phase === "turn-commit") return "commit";
  if (phase === "turn-settle") return "settle";
  if (phase === "turn-cancel") return "cancel";
  return "failed";
}

function browserOutcome(phase: PageTurnLifecyclePhase): PageTurnLifecycleBrowserOutcome {
  if (phase === "turn-start") return "started";
  if (phase === "turn-commit") return "committed";
  if (phase === "turn-settle") return "settled";
  if (phase === "turn-cancel") return "cancelled";
  return "failed";
}

function sanitizedBrowserReason(reason?: string): PageTurnLifecycleBrowserReason {
  if (!reason) return "none";
  if (reason === "page-boundary-no-op") return "page-boundary-no-op";
  if (reason === "same-spread-or-boundary-no-op") return "same-spread-or-boundary-no-op";
  if (reason === "replaced-by-newer-intent") return "replaced-by-newer-intent";
  if (reason.includes("runtime-disposed") || reason.includes("runtime-disposal")) return "runtime-disposed";
  if (reason.includes("development-failpoint:dynamic-import")) return "development-dynamic-import";
  if (reason.includes("development-failpoint:runtime-init")) return "development-runtime-init";
  if (reason.includes("development-failpoint:readiness-probe")) return "development-readiness-probe";
  if (reason.includes("readiness-timeout") || reason.includes("readiness did not converge")) {
    return "readiness-timeout";
  }
  if (reason.includes("readable-fallback")) return "readable-fallback";
  if (reason.includes("runtime") || reason.includes("PageFlip")) return "runtime-failure";
  return "unknown";
}

function readDevelopmentFailpoint(ownerWindow: Window): PageFlipDevelopmentFailpoint | null {
  if (process.env.NODE_ENV === "production") return null;
  const value = ownerWindow[PAGE_FLIP_DEVELOPMENT_FAILPOINT_GLOBAL];
  return value === "dynamic-import" || value === "runtime-init" || value === "readiness-probe" ? value : null;
}

function dispatchPageFlipTurn(
  book: PageFlipInstance,
  intent: PageFlipTurnIntent,
  currentSpreadAnchor: number,
  onImmediatePageChange: (page: number) => void,
): PageFlipTurnDispatch {
  const pages = (book as PageFlipWithCollection).getPageCollection();
  const currentSpread = pages.getSpreadIndexByPage(currentSpreadAnchor);
  const firstSpread = pages.getSpreadIndexByPage(0);
  const lastSpread = pages.getSpreadIndexByPage(book.getPageCount() - 1);

  switch (intent.kind) {
    case "next": {
      if (currentSpread === null || lastSpread === null || currentSpread >= lastSpread) return "no-op";
      book.flipNext("top");
      return "animated";
    }
    case "previous": {
      if (currentSpread === null || firstSpread === null || currentSpread <= firstSpread) return "no-op";
      book.flipPrev("top");
      return "animated";
    }
    case "flip-to": {
      const targetSpread = pages.getSpreadIndexByPage(intent.page);
      if (currentSpread === null || targetSpread === null || targetSpread === currentSpread) return "no-op";
      book.flip(intent.page, "top");
      return "animated";
    }
    case "turn-to":
      if (intent.page === currentSpreadAnchor) return "no-op";
      book.turnToPage(intent.page);
      onImmediatePageChange(book.getCurrentPageIndex());
      return "immediate";
  }
}

export const PageFlipBook = forwardRef<
  PageFlipBookHandle,
  {
    pages: FlipBookPage[];
    mode: MotionMode;
    className?: string;
    initialPage?: number;
    showCover?: boolean;
    bookId?: string;
    playbackRate?: 0.25 | 0.5 | 1;
    revision?: string | number;
    onPageChange?: (page: number) => void;
    onFlipStateChange?: (state: "folding" | "flipping" | "read") => void;
    onTurnLifecycle?: (event: PageTurnLifecycleEvent) => void;
    onReadinessChange?: (snapshot: PageFlipReadinessSnapshot) => void;
    onBoundaryChange?: (snapshot: PageFlipBoundarySnapshot) => void;
    onPageTargetsChange?: (authority: PageFlipPageTargetExportAuthority | null) => void;
  }
>(function PageFlipBook(
  {
    pages,
    mode,
    className = "",
    initialPage = 0,
    showCover = true,
    bookId,
    playbackRate = 1,
    revision = 0,
    onPageChange,
    onFlipStateChange,
    onTurnLifecycle,
    onReadinessChange,
    onBoundaryChange,
    onPageTargetsChange,
  },
  ref,
) {
  const root = useRef<HTMLElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const source = useRef<HTMLDivElement>(null);
  const instance = useRef<PageFlipInstance | null>(null);
  const boundary = useRef<PageFlipBoundaryController | null>(null);
  const runtimeGeneration = useRef(0);
  const reactId = useId();
  const [logicalBookId] = useState(() => bookId ?? `book-${reactId.replaceAll(":", "")}`);
  const [hydrationMountId] = useState(
    () => `pageflip-${deterministicMountToken(logicalBookId) || "book"}-${reactId.replaceAll(":", "")}`,
  );
  const clientMountId = useRef<string | null>(null);
  const [mountId, setMountId] = useState(hydrationMountId);
  const [clientIdentityReady, setClientIdentityReady] = useState(false);
  const pendingTurn = useRef<QueuedPageTurn | null>(null);
  const activeTurn = useRef<ActivePageTurn | null>(null);
  const turnReady = useRef(false);
  const turnReadinessFrame = useRef<number | null>(null);
  const turnRuntimeIdentity = useRef(0);
  const focusMemory = useRef<FocusMemory | null>(null);
  const pagesLength = useRef(pages.length);
  const initialCurrent = clampPage(initialPage, pages.length);
  const currentPage = useRef(initialCurrent);
  const pageChangeCallback = useRef(onPageChange);
  const flipStateCallback = useRef(onFlipStateChange);
  const turnLifecycleCallback = useRef(onTurnLifecycle);
  const readinessCallback = useRef(onReadinessChange);
  const boundaryCallback = useRef(onBoundaryChange);
  const pageTargetsCallback = useRef(onPageTargetsChange);
  const pageTargetsAuthority = useRef<PageFlipPageTargetExportAuthority | null>(null);
  const flipStateRef = useRef<"folding" | "flipping" | "read">("read");
  const [current, setCurrent] = useState(initialCurrent);
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("landscape");
  const orientationRef = useRef<"portrait" | "landscape">("landscape");
  const [flipState, setFlipState] = useState<"folding" | "flipping" | "read">("read");
  const [failed, setFailed] = useState(false);
  const failedRef = useRef(false);
  const [fallbackReason, setFallbackReason] = useState<string | null>(null);
  const abandonRuntime = useRef<(() => void) | null>(null);
  const [sceneHost, setSceneHost] = useState<SceneHostHandle | null>(null);
  const readiness = useRef<PageFlipReadinessSnapshot>({
    status: mode === "reduced" ? "reduced" : "initializing",
    ready: mode === "reduced",
    bookId: logicalBookId,
    mountId: hydrationMountId,
    mode,
    generation: 0,
  });
  const readinessPublished = useRef(false);
  const signature = useMemo(() => pages.map((page) => page.id).join("|"), [pages]);
  const pageIds = useMemo(() => pages.map((page) => page.id), [pages]);
  const pageIdentity = useRef({ pageIds, contentRevision: `${String(revision)}:${signature}` });
  const reduced = mode === "reduced";

  useEffect(() => {
    failedRef.current = failed;
  }, [failed]);

  useEffect(() => {
    clientMountId.current ??= createPageFlipMountId(logicalBookId);
    setMountId(clientMountId.current);
    setClientIdentityReady(true);
  }, [logicalBookId]);

  useEffect(() => {
    pageIdentity.current = { pageIds, contentRevision: `${String(revision)}:${signature}` };
  }, [pageIds, revision, signature]);

  useEffect(() => {
    flipStateCallback.current = onFlipStateChange;
    turnLifecycleCallback.current = onTurnLifecycle;
    readinessCallback.current = onReadinessChange;
    boundaryCallback.current = onBoundaryChange;
    pageTargetsCallback.current = onPageTargetsChange;
    pageChangeCallback.current = onPageChange;
  }, [onBoundaryChange, onFlipStateChange, onPageChange, onPageTargetsChange, onReadinessChange, onTurnLifecycle]);

  useEffect(() => {
    pagesLength.current = pages.length;
  }, [pages.length]);

  const changePage = useCallback((page: number) => {
    const next = clampPage(page, pagesLength.current);
    currentPage.current = next;
    setCurrent(next);
    pageChangeCallback.current?.(next);
  }, []);

  const publishReadiness = useCallback(
    (status: PageFlipReadinessSnapshot["status"], generation = runtimeGeneration.current) => {
      const next: PageFlipReadinessSnapshot = {
        status,
        ready: status === "ready" || status === "reduced" || status === "fallback",
        bookId: logicalBookId,
        mountId,
        mode,
        generation,
      };
      const previous = readiness.current;
      readiness.current = next;
      if (
        !readinessPublished.current ||
        previous.status !== next.status ||
        previous.ready !== next.ready ||
        previous.mountId !== next.mountId ||
        previous.mode !== next.mode ||
        previous.generation !== next.generation
      ) {
        readinessPublished.current = true;
        readinessCallback.current?.(next);
      }
    },
    [logicalBookId, mode, mountId],
  );

  const emitTurnLifecycle = useCallback(
    (
      phase: PageTurnLifecyclePhase,
      turn: ActivePageTurn,
      options: Readonly<{ toPage?: number; reason?: string; fallback?: boolean }> = {},
    ) => {
      const rootElement = root.current;
      if (
        !rootElement?.isConnected ||
        readiness.current.status === "disposed" ||
        rootElement.dataset.pageflipBookId !== logicalBookId ||
        rootElement.dataset.pageflipMountId !== mountId
      ) {
        return;
      }
      const lifecycleEvent: PageTurnLifecycleEvent = {
        phase,
        bookId: logicalBookId,
        mountId,
        source: turn.source,
        fromPage: turn.fromPage,
        toPage: options.toPage ?? turn.requestedPage,
        orientation: mode === "reduced" ? "portrait" : orientationRef.current,
        mode,
        timestamp: Date.now(),
        reason: options.reason,
        fallback: options.fallback ?? (failedRef.current || mode === "reduced"),
        generation: turn.generation,
      };
      const boundarySnapshot = boundary.current?.snapshot() ?? null;
      const fallbackStatus: PageTurnLifecycleBrowserDetail["fallbackStatus"] =
        lifecycleEvent.fallback || readiness.current.status === "fallback"
          ? "fallback"
          : mode === "reduced"
            ? "reduced"
            : "runtime";
      const detail: PageTurnLifecycleBrowserDetail = {
        version: 1,
        bookId: lifecycleEvent.bookId,
        mountId: lifecycleEvent.mountId,
        request: lifecycleEvent.source,
        source: lifecycleEvent.source,
        fromPage: lifecycleEvent.fromPage,
        toPage: lifecycleEvent.toPage,
        phase: browserPhase(lifecycleEvent.phase),
        reason: sanitizedBrowserReason(lifecycleEvent.reason),
        outcome: browserOutcome(lifecycleEvent.phase),
        boundaryGeneration:
          boundarySnapshot && !boundarySnapshot.disposed && boundarySnapshot.mountId === mountId
            ? boundarySnapshot.cloneGeneration
            : 0,
        runtimeGeneration: lifecycleEvent.generation,
        currentPage: currentPage.current,
        fallbackStatus,
      };
      const ownerWindow = rootElement.ownerDocument.defaultView;
      if (ownerWindow) {
        rootElement.dispatchEvent(
          new ownerWindow.CustomEvent<PageTurnLifecycleBrowserDetail>(PAGE_TURN_LIFECYCLE_BROWSER_EVENT, {
            bubbles: true,
            composed: true,
            detail,
          }),
        );
      }
      turnLifecycleCallback.current?.(lifecycleEvent);
    },
    [logicalBookId, mode, mountId],
  );

  const requestedPageForIntent = useCallback((intent: PageFlipTurnIntent, fromPage: number) => {
    if (intent.kind === "next") return clampPage(fromPage + 1, pagesLength.current);
    if (intent.kind === "previous") return clampPage(fromPage - 1, pagesLength.current);
    return clampPage(intent.page, pagesLength.current);
  }, []);

  const createTurn = useCallback(
    (intent: PageFlipTurnIntent, generation = runtimeGeneration.current) => {
      const fromPage = currentPage.current;
      return {
        source: intent.source,
        fromPage,
        requestedPage: requestedPageForIntent(intent, fromPage),
        generation,
      } satisfies ActivePageTurn;
    },
    [requestedPageForIntent],
  );

  const startTurn = useCallback(
    (intent: PageFlipTurnIntent, generation = runtimeGeneration.current) => {
      const turn = createTurn(intent, generation);
      emitTurnLifecycle("turn-start", turn);
      return turn;
    },
    [createTurn, emitTurnLifecycle],
  );

  const cancelTurn = useCallback(
    (turn: ActivePageTurn | null, reason: string) => {
      if (!turn) return;
      emitTurnLifecycle("turn-cancel", turn, { reason, toPage: currentPage.current });
      if (activeTurn.current === turn) activeTurn.current = null;
    },
    [emitTurnLifecycle],
  );

  const cancelQueuedIntent = useCallback(
    (queued: QueuedPageTurn | null, reason: string) => {
      if (!queued) return;
      emitTurnLifecycle("turn-cancel", createTurn(queued.intent), {
        reason,
        toPage: currentPage.current,
      });
    },
    [createTurn, emitTurnLifecycle],
  );

  useEffect(() => {
    if (reduced) publishReadiness("reduced");
    else if (failed) publishReadiness("fallback");
    else if (!clientIdentityReady || !sceneHost) publishReadiness("initializing");
  }, [clientIdentityReady, failed, publishReadiness, reduced, sceneHost]);

  useEffect(() => {
    const identity = { bookId: logicalBookId, mountId };
    return () => {
      const previous = readiness.current;
      if (
        previous.status === "disposed" &&
        previous.bookId === identity.bookId &&
        previous.mountId === identity.mountId
      ) {
        return;
      }
      const disposedSnapshot: PageFlipReadinessSnapshot = {
        ...previous,
        status: "disposed",
        ready: false,
        bookId: identity.bookId,
        mountId: identity.mountId,
      };
      readiness.current = disposedSnapshot;
      readinessCallback.current?.(disposedSnapshot);
    };
  }, [logicalBookId, mountId]);

  const rememberFocus = useCallback((event: React.FocusEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    const control = target.closest<HTMLElement>("[data-pageflip-focus]");
    const controlName = control?.dataset.pageflipFocus;
    if (controlName === "previous" || controlName === "next") {
      focusMemory.current = { kind: "control", name: controlName };
      return;
    }
    const page = target.closest<HTMLElement>("[data-page-index]");
    if (page) focusMemory.current = { kind: "page", index: Number(page.dataset.pageIndex) };
  }, []);

  const forgetExternalFocus = useCallback((event: React.FocusEvent<HTMLElement>) => {
    const next = event.relatedTarget;
    if (next instanceof Node && !event.currentTarget.contains(next)) focusMemory.current = null;
  }, []);

  const restoreFocus = useCallback(() => {
    const rootElement = root.current;
    const memory = focusMemory.current;
    if (!rootElement || !memory) return;
    const active = rootElement.ownerDocument.activeElement;
    if (active && active !== rootElement.ownerDocument.body && !rootElement.contains(active)) return;

    const safeControl = (name: "previous" | "next") => {
      const control = rootElement.querySelector<HTMLElement>(`[data-pageflip-focus="${name}"]`);
      return isSafeFocusTarget(control, rootElement) ? control : null;
    };
    if (memory.kind === "control") {
      const matchingControl = safeControl(memory.name);
      if (matchingControl) {
        matchingControl.focus({ preventScroll: true });
        return;
      }
      const alternateControl = safeControl(memory.name === "previous" ? "next" : "previous");
      const readableHost = rootElement.querySelector<HTMLElement>(".page-flip-host,.reduced-page-stage");
      const fallback =
        alternateControl ?? (isSafeFocusTarget(readableHost, rootElement) ? readableHost : null) ?? rootElement;
      fallback.focus({ preventScroll: true });
      return;
    }

    const pageIndex = clampPage(memory.index, pagesLength.current);
    const readinessSnapshot = readiness.current;
    if (readinessSnapshot.status === "reduced" || readinessSnapshot.status === "fallback") {
      const staticPage = Array.from(
        rootElement.querySelectorAll<HTMLElement>(".reduced-page-stage > [data-page-index]"),
      ).find((candidate) => candidate.dataset.pageIndex === String(pageIndex));
      if (staticPage && isSafeFocusTarget(staticPage, rootElement)) {
        staticPage.focus({ preventScroll: true });
        return;
      }
    } else if (readinessSnapshot.status === "ready" && flipStateRef.current === "read") {
      const snapshot = boundary.current?.snapshot() ?? null;
      const authority = pageTargetsAuthority.current;
      const authorityMatches =
        !authority ||
        (snapshot &&
          authority.pageFlipInstanceId === snapshot.pageFlipInstanceId &&
          authority.cloneGeneration === snapshot.cloneGeneration);
      if (
        snapshot &&
        !snapshot.disposed &&
        snapshot.lifecycle === "visible" &&
        snapshot.mountId === mountId &&
        rootElement.dataset.pageflipMountId === mountId &&
        authorityMatches
      ) {
        const primary = Array.from(
          rootElement.querySelectorAll<HTMLElement>(
            '.page-flip-host [data-pageflip-role="primary"][data-pageflip-current="true"]',
          ),
        ).find(
          (candidate) =>
            candidate.dataset.pageflipInstanceId === snapshot.pageFlipInstanceId &&
            candidate.dataset.pageflipCloneGeneration === String(snapshot.cloneGeneration) &&
            candidate.dataset.pageflipBookId === logicalBookId &&
            candidate.dataset.pageflipPageIndex === String(pageIndex) &&
            candidate.dataset.pageflipLifecycle === "visible" &&
            candidate.dataset.pageflipOrientation === snapshot.orientation &&
            !candidate.hasAttribute("data-pageflip-temporary-clone") &&
            !candidate.hasAttribute("data-pageflip-unproven-clone") &&
            !candidate.hasAttribute("data-pageflip-source") &&
            isSafeFocusTarget(candidate, rootElement),
        );
        if (primary) {
          primary.focus({ preventScroll: true });
          return;
        }
      }
    } else {
      // Initializing and moving runtimes may contain transient clones; wait for the read/visible boundary.
      return;
    }

    const matchingControl = pageIndex > 0 ? safeControl("previous") : safeControl("next");
    const alternateControl = pageIndex > 0 ? safeControl("next") : safeControl("previous");
    const readableHost = rootElement.querySelector<HTMLElement>(".page-flip-host,.reduced-page-stage");
    const fallback =
      matchingControl ??
      alternateControl ??
      (isSafeFocusTarget(readableHost, rootElement) ? readableHost : null) ??
      rootElement;
    fallback.focus({ preventScroll: true });
  }, [logicalBookId, mountId]);

  const scheduleTurnReadiness = useCallback(
    function schedule(book: PageFlipInstance, runtimeIdentity: number) {
      if (turnReadinessFrame.current !== null) window.cancelAnimationFrame(turnReadinessFrame.current);
      turnReady.current = false;
      turnReadinessFrame.current = window.requestAnimationFrame(() => {
        turnReadinessFrame.current = null;
        if (
          turnRuntimeIdentity.current !== runtimeIdentity ||
          instance.current !== book ||
          flipStateRef.current !== "read"
        ) {
          turnReady.current = false;
          return;
        }

        turnReady.current = true;
        const queued = pendingTurn.current;
        if (!queued) return;
        pendingTurn.current = null;
        turnReady.current = false;
        const turn = startTurn(queued.intent, runtimeGeneration.current);
        activeTurn.current = turn;
        const dispatch = dispatchPageFlipTurn(book, queued.intent, currentPage.current, changePage);
        if (dispatch === "immediate") {
          emitTurnLifecycle("turn-commit", turn, { toPage: currentPage.current });
          emitTurnLifecycle("turn-settle", turn, { toPage: currentPage.current });
          activeTurn.current = null;
        } else if (dispatch === "no-op") {
          cancelTurn(turn, "same-spread-or-boundary-no-op");
        }
        if (dispatch !== "animated") {
          boundary.current?.updateCurrentPage(currentPage.current, "visible");
          schedule(book, runtimeIdentity);
        }
      });
    },
    [cancelTurn, changePage, emitTurnLifecycle, startTurn],
  );

  const requestTurn = useCallback(
    (intent: PageFlipTurnIntent) => {
      const normalizedIntent =
        intent.kind === "flip-to" || intent.kind === "turn-to"
          ? ({ ...intent, page: clampPage(intent.page, pagesLength.current) } as PageFlipTurnIntent)
          : intent;
      if (reduced || failed) {
        const turn = startTurn(normalizedIntent);
        const target = requestedPageForIntent(normalizedIntent, currentPage.current);
        if (target === currentPage.current) {
          cancelTurn(turn, "page-boundary-no-op");
          return;
        }
        changePage(target);
        emitTurnLifecycle("turn-commit", turn, { toPage: target, fallback: failed });
        emitTurnLifecycle("turn-settle", turn, { toPage: target, fallback: failed });
        return;
      }

      const book = instance.current;
      if (!book || flipStateRef.current !== "read" || !turnReady.current) {
        const replaced = pendingTurn.current;
        if (replaced) cancelQueuedIntent(replaced, "replaced-by-newer-intent");
        pendingTurn.current = { intent: normalizedIntent };
        return;
      }

      const turn = startTurn(normalizedIntent);
      pendingTurn.current = null;
      activeTurn.current = turn;
      turnReady.current = false;
      const dispatch = dispatchPageFlipTurn(book, normalizedIntent, currentPage.current, changePage);
      if (dispatch === "immediate") {
        emitTurnLifecycle("turn-commit", turn, { toPage: currentPage.current });
        emitTurnLifecycle("turn-settle", turn, { toPage: currentPage.current });
        activeTurn.current = null;
      } else if (dispatch === "no-op") {
        cancelTurn(turn, "same-spread-or-boundary-no-op");
      }
      if (dispatch !== "animated") {
        boundary.current?.updateCurrentPage(currentPage.current, "visible");
        scheduleTurnReadiness(book, turnRuntimeIdentity.current);
      }
    },
    [
      cancelTurn,
      cancelQueuedIntent,
      changePage,
      emitTurnLifecycle,
      failed,
      reduced,
      requestedPageForIntent,
      scheduleTurnReadiness,
      startTurn,
    ],
  );

  const forceReadableFallback = useCallback(
    (requestedReason: string) => {
      const reason = requestedReason.trim() || "PageFlip readiness did not converge";
      if (failedRef.current) {
        publishReadiness("fallback", runtimeGeneration.current);
        window.requestAnimationFrame(restoreFocus);
        return;
      }

      const failedTurn: ActivePageTurn = activeTurn.current ?? {
        source: "runtime-initialization",
        fromPage: currentPage.current,
        requestedPage: currentPage.current,
        generation: runtimeGeneration.current,
      };
      emitTurnLifecycle("turn-failed", failedTurn, {
        reason,
        toPage: currentPage.current,
        fallback: true,
      });
      activeTurn.current = null;
      cancelQueuedIntent(pendingTurn.current, `queued-intent-cancelled-by-readable-fallback:${reason}`);
      pendingTurn.current = null;
      turnReady.current = false;
      if (turnReadinessFrame.current !== null) {
        window.cancelAnimationFrame(turnReadinessFrame.current);
        turnReadinessFrame.current = null;
      }

      failedRef.current = true;
      setFallbackReason(reason);
      abandonRuntime.current?.();
      setFailed(true);
      publishReadiness("fallback", runtimeGeneration.current);
      window.requestAnimationFrame(restoreFocus);
    },
    [cancelQueuedIntent, emitTurnLifecycle, publishReadiness, restoreFocus],
  );

  useImperativeHandle(ref, () => ({
    next: () => requestTurn({ kind: "next", source: "imperative-next" }),
    previous: () => requestTurn({ kind: "previous", source: "imperative-previous" }),
    turnTo: (page) => requestTurn({ kind: "turn-to", page, source: "imperative-turn-to" }),
    flipTo: (page) => requestTurn({ kind: "flip-to", page, source: "imperative-flip-to" }),
    currentPage: () => currentPage.current,
    pageCount: () => (reduced ? pages.length : (instance.current?.getPageCount() ?? pages.length)),
    orientation: () => (reduced ? "portrait" : (instance.current?.getOrientation() ?? orientation)),
    boundary: () => boundary.current?.snapshot() ?? null,
    pageTargets: () => pageTargetsAuthority.current,
    readiness: () => readiness.current,
    forceReadableFallback,
  }));

  useEffect(() => {
    const hostElement = host.current;
    const sourceElement = source.current;
    if (reduced || failed || !clientIdentityReady || !sceneHost || !hostElement || !sourceElement) return;

    publishReadiness("initializing");

    let book: PageFlipInstance | null = null;
    let disposed = false;
    let destroyed = false;
    let countedAsMounted = false;
    let boundaryController: PageFlipBoundaryController | null = null;
    let runtimeLease: RuntimeSurfaceLease | null = null;
    let runtimeTarget: SceneTargetHandle | null = null;
    const runtimeElement = hostElement.ownerDocument.createElement("div");
    runtimeElement.className = "page-flip-runtime";
    runtimeElement.dataset.pageflipRuntime = "";
    hostElement.replaceChildren(runtimeElement);
    turnRuntimeIdentity.current += 1;
    const runtimeIdentity = turnRuntimeIdentity.current;
    turnReady.current = false;
    if (turnReadinessFrame.current !== null) {
      window.cancelAnimationFrame(turnReadinessFrame.current);
      turnReadinessFrame.current = null;
    }

    const destroyBook = () => {
      if (destroyed) return;
      destroyed = true;
      const ownedBook = book;
      const ownedBoundary = boundaryController;
      book = null;
      if (ownedBook) {
        currentPage.current = clampPage(currentPage.current, pagesLength.current);
        if (instance.current === ownedBook) instance.current = null;
        try {
          ownedBook.destroy();
        } catch {
          // Cleanup still owns the runtime node and mounted metric if library teardown is partial.
        }
      }
      ownedBoundary?.dispose();
      boundaryController = null;
      if (boundary.current === ownedBoundary) boundary.current = null;
      runtimeLease?.release();
      runtimeLease = null;
      runtimeTarget?.release();
      runtimeTarget = null;
      delete runtimeElement.dataset.pageflipRuntimeClaim;
      delete runtimeElement.dataset.pageflipTurnOwner;
      if (countedAsMounted) {
        countedAsMounted = false;
        changeMountedMetric("pageFlip", -1);
      }
      runtimeElement.remove();
    };

    const abandon = () => {
      disposed = true;
      turnReady.current = false;
      if (turnReadinessFrame.current !== null) {
        window.cancelAnimationFrame(turnReadinessFrame.current);
        turnReadinessFrame.current = null;
      }
      destroyBook();
      hostElement.replaceChildren();
    };
    abandonRuntime.current = abandon;

    const developmentFailpoint = readDevelopmentFailpoint(hostElement.ownerDocument.defaultView ?? window);
    const runtimeImport =
      developmentFailpoint === "dynamic-import"
        ? Promise.reject(new Error("development-failpoint:dynamic-import"))
        : import("page-flip");

    void runtimeImport
      .then(({ PageFlip }) => {
        if (disposed) return;
        const startPage = clampPage(currentPage.current, sourceElement.children.length);
        runtimeGeneration.current += 1;
        runtimeTarget = sceneHost.registerTarget({
          targetKey: "pageflip-runtime-surface",
          part: "page-flip-surface",
          element: runtimeElement,
          ownerHint: "page-flip",
          allowedProperties: pageFlipRuntimeProperties,
        });
        const claimResult = sceneHost.claimRuntimeSurface({
          target: runtimeTarget,
          element: runtimeElement,
          runtime: "page-flip",
          properties: pageFlipRuntimeProperties,
        });
        if (claimResult.status !== "granted") throw new Error(`PageFlip runtime lease rejected: ${claimResult.reason}`);
        runtimeLease = claimResult;
        runtimeElement.dataset.pageflipRuntimeClaim = "granted";
        runtimeElement.dataset.pageflipTurnOwner = "st-page-flip";
        const initialized = runtimeLease.withProperties(pageFlipRuntimeProperties, (element) => {
          if (!(element instanceof HTMLElement)) throw new Error("PageFlip runtime target is not an HTML element");
          boundaryController = new PageFlipBoundaryController({
            mountId,
            runtimeGeneration: runtimeGeneration.current,
            bookId: logicalBookId,
            runtimeRoot: element,
            sourceRoot: sourceElement,
            sceneHost,
            onChange: (snapshot) => boundaryCallback.current?.(snapshot),
            onPageTargetsChange: (authority) => {
              const exportAuthority: PageFlipPageTargetExportAuthority | null = authority
                ? {
                    ...authority,
                    exportTarget: (capability, request) =>
                      sceneHost.exportTarget({ ...request, target: capability.handle }),
                  }
                : null;
              pageTargetsAuthority.current = exportAuthority;
              pageTargetsCallback.current?.(exportAuthority);
            },
          });
          boundary.current = boundaryController;
          const clones = boundaryController.preparePages(
            pageIdentity.current.pageIds,
            pageIdentity.current.contentRevision,
          );
          if (developmentFailpoint === "runtime-init") {
            throw new Error("development-failpoint:runtime-init");
          }
          const initializedBook = new PageFlip(element, {
            width: 560,
            height: 760,
            size: "stretch",
            minWidth: 300,
            maxWidth: 720,
            minHeight: 420,
            maxHeight: 960,
            showCover,
            usePortrait: true,
            autoSize: true,
            drawShadow: true,
            maxShadowOpacity: 0.45,
            flippingTime: Math.round((mode === "full" ? 1100 : 620) / playbackRate),
            swipeDistance: 24,
            mobileScrollSupport: true,
            // Hovering an idle page corner can leave StPageFlip in its
            // nonterminal fold-corner state. Controls, keyboard, and drag
            // gestures remain available; idle pointer position is not a turn.
            showPageCorners: false,
            startPage,
          });
          book = initializedBook;
          initializedBook.loadFromHTML(clones);
          return initializedBook;
        });
        if (initialized.status !== "applied") throw new Error(`PageFlip runtime lease denied: ${initialized.reason}`);
        book = initialized.value;
        const activeBoundary = boundary.current;
        if (!activeBoundary) throw new Error("PageFlip clone boundary was not initialized");
        const initialSpreadAnchor = clampPage(book.getCurrentPageIndex(), sourceElement.children.length);
        const initialOrientation = book.getOrientation() as "portrait" | "landscape";
        orientationRef.current = initialOrientation;
        setOrientation(initialOrientation);
        activeBoundary.bindPrimaryPages(initialSpreadAnchor, initialOrientation);
        book.on("flip", (event) => {
          const page = Number(event.data);
          let turn = activeTurn.current;
          if (!turn) {
            turn = {
              source: "runtime-gesture",
              fromPage: currentPage.current,
              requestedPage: page,
              generation: runtimeGeneration.current,
            };
            activeTurn.current = turn;
            emitTurnLifecycle("turn-start", turn);
          }
          changePage(page);
          emitTurnLifecycle("turn-commit", turn, { toPage: page });
          activeBoundary.updateCurrentPage(page, flipStateRef.current === "read" ? "visible" : "settling");
          focusMemory.current = { kind: "page", index: page };
          window.requestAnimationFrame(restoreFocus);
        });
        book.on("changeOrientation", (event) => {
          const nextOrientation = event.data as "portrait" | "landscape";
          orientationRef.current = nextOrientation;
          setOrientation(nextOrientation);
          activeBoundary.rebindOrientation(nextOrientation, currentPage.current);
          window.requestAnimationFrame(restoreFocus);
        });
        book.on("changeState", (event) => {
          const state = event.data === "flipping" ? "flipping" : event.data === "read" ? "read" : "folding";
          flipStateRef.current = state;
          setFlipState(state);
          flipStateCallback.current?.(state);
          activeBoundary.updateCurrentPage(currentPage.current, state === "read" ? "visible" : "settling");
          if (state === "read") {
            const completedTurn = activeTurn.current;
            if (completedTurn) {
              if (currentPage.current === completedTurn.fromPage) {
                cancelTurn(completedTurn, "runtime-returned-without-page-change");
              } else {
                emitTurnLifecycle("turn-settle", completedTurn, { toPage: currentPage.current });
                activeTurn.current = null;
              }
            }
            publishReadiness("ready", runtimeGeneration.current);
            if (book) scheduleTurnReadiness(book, runtimeIdentity);
            window.requestAnimationFrame(restoreFocus);
          } else {
            if (!activeTurn.current) {
              const gestureTurn: ActivePageTurn = {
                source: "runtime-gesture",
                fromPage: currentPage.current,
                requestedPage: currentPage.current,
                generation: runtimeGeneration.current,
              };
              activeTurn.current = gestureTurn;
              emitTurnLifecycle("turn-start", gestureTurn);
            }
            publishReadiness("busy", runtimeGeneration.current);
            turnReady.current = false;
            if (turnReadinessFrame.current !== null) {
              window.cancelAnimationFrame(turnReadinessFrame.current);
              turnReadinessFrame.current = null;
            }
          }
        });
        if (developmentFailpoint === "readiness-probe") {
          throw new Error("development-failpoint:readiness-probe");
        }
        instance.current = book;
        turnReady.current = true;
        currentPage.current = initialSpreadAnchor;
        setCurrent(initialSpreadAnchor);
        changeMountedMetric("pageFlip", 1);
        countedAsMounted = true;
        publishReadiness("ready", runtimeGeneration.current);
        if (pendingTurn.current) scheduleTurnReadiness(book, runtimeIdentity);
        window.requestAnimationFrame(restoreFocus);
      })
      .catch((error: unknown) => {
        const reason = error instanceof Error ? error.message : "PageFlip runtime initialization failed";
        forceReadableFallback(reason);
        recordAssetFailure("page-flip");
      });

    return () => {
      disposed = true;
      if (abandonRuntime.current === abandon) abandonRuntime.current = null;
      if (turnRuntimeIdentity.current === runtimeIdentity) turnRuntimeIdentity.current += 1;
      if (turnReadinessFrame.current !== null) {
        window.cancelAnimationFrame(turnReadinessFrame.current);
        turnReadinessFrame.current = null;
      }
      turnReady.current = false;
      cancelTurn(activeTurn.current, "runtime-disposed-before-settle");
      activeTurn.current = null;
      cancelQueuedIntent(pendingTurn.current, "queued-intent-cancelled-by-runtime-disposal");
      pendingTurn.current = null;
      destroyBook();
      hostElement.replaceChildren();
    };
  }, [
    changePage,
    clientIdentityReady,
    failed,
    logicalBookId,
    mode,
    mountId,
    playbackRate,
    publishReadiness,
    reduced,
    restoreFocus,
    sceneHost,
    cancelTurn,
    cancelQueuedIntent,
    emitTurnLifecycle,
    forceReadableFallback,
    scheduleTurnReadiness,
    showCover,
  ]);

  useEffect(() => {
    if (reduced || !instance.current || !source.current) return;
    const activeBoundary = boundary.current;
    if (!activeBoundary) return;
    try {
      const clones = activeBoundary.preparePages(pageIds, `${String(revision)}:${signature}`);
      instance.current.updateFromHtml(clones);
      const safeCurrent = clampPage(currentPage.current, pages.length);
      if (instance.current.getCurrentPageIndex() !== safeCurrent) instance.current.turnToPage(safeCurrent);
      activeBoundary.bindPrimaryPages(safeCurrent, instance.current.getOrientation());
      if (safeCurrent !== currentPage.current) {
        currentPage.current = safeCurrent;
        setCurrent(safeCurrent);
      }
      window.requestAnimationFrame(restoreFocus);
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : "PageFlip content refresh failed";
      const failedTurn: ActivePageTurn = activeTurn.current ?? {
        source: "runtime-initialization",
        fromPage: currentPage.current,
        requestedPage: currentPage.current,
        generation: runtimeGeneration.current,
      };
      emitTurnLifecycle("turn-failed", failedTurn, {
        reason,
        toPage: currentPage.current,
        fallback: true,
      });
      activeTurn.current = null;
      failedRef.current = true;
      setFallbackReason(reason);
      recordAssetFailure("page-flip");
      setFailed(true);
    }
  }, [emitTurnLifecycle, pageIds, pages.length, reduced, restoreFocus, revision, signature]);

  useEffect(() => {
    if (!reduced && !failed) return;
    window.requestAnimationFrame(restoreFocus);
  }, [failed, reduced, restoreFocus]);

  const pageNodes = pages.map((page, index) => (
    <article
      key={page.id}
      className={`ft-page density-${page.density} page-side-${index % 2 === 0 ? "right" : "left"}`}
      data-density={page.density}
      data-page-index={index}
      data-page-side={index % 2 === 0 ? "right" : "left"}
      tabIndex={-1}
      aria-label={page.label}
    >
      {page.content}
    </article>
  ));

  const visibleCurrent = clampPage(current, pages.length);

  if (reduced || failed) {
    return (
      <section
        ref={root}
        className={`page-flip-book reduced-page-book ${className}`}
        data-pageflip-status={failed ? "fallback" : "reduced"}
        data-pageflip-fallback-reason={failed ? (fallbackReason ?? "runtime-failure") : undefined}
        data-pageflip-book-id={logicalBookId}
        data-pageflip-mount-id={mountId}
        tabIndex={-1}
        onFocusCapture={rememberFocus}
        onBlurCapture={forgetExternalFocus}
      >
        <div className="reduced-page-stage" tabIndex={-1}>
          <article
            className={`ft-page density-${pages[visibleCurrent]?.density ?? "soft"} page-side-${visibleCurrent % 2 === 0 ? "right" : "left"}`}
            data-page-index={visibleCurrent}
            data-page-side={visibleCurrent % 2 === 0 ? "right" : "left"}
            tabIndex={-1}
            aria-label={pages[visibleCurrent]?.label}
          >
            {pages[visibleCurrent]?.content}
          </article>
        </div>
        <PageControls
          current={visibleCurrent}
          count={pages.length}
          busy={false}
          previous={() => requestTurn({ kind: "previous", source: "control-previous" })}
          next={() => requestTurn({ kind: "next", source: "control-next" })}
        />
      </section>
    );
  }

  return (
    <section
      ref={root}
      className={`page-flip-book orientation-${orientation} ${className}`}
      data-animation-owner="page-flip"
      data-pageflip-book-id={logicalBookId}
      data-pageflip-mount-id={mountId}
      data-flip-state={flipState}
      tabIndex={-1}
      onFocusCapture={rememberFocus}
      onBlurCapture={forgetExternalFocus}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight" || event.key === "PageDown") {
          event.preventDefault();
          requestTurn({ kind: "next", source: "keyboard-next" });
        }
        if (event.key === "ArrowLeft" || event.key === "PageUp") {
          event.preventDefault();
          requestTurn({ kind: "previous", source: "keyboard-previous" });
        }
      }}
    >
      <SceneHost
        kind="player-section-enhancement"
        hostKey={`pageflip-${hydrationMountId}`}
        className="page-flip-scene-host"
        data-pageflip-boundary-host="true"
      >
        <SceneHostHandleBridge onChange={setSceneHost} />
        <div ref={source} className="page-flip-source" data-pageflip-source aria-hidden="true" inert>
          {pageNodes}
        </div>
        <div ref={host} className="page-flip-host" aria-label="Physical journal pages" tabIndex={-1} />
      </SceneHost>
      <PageControls
        current={current}
        count={pages.length}
        busy={flipState !== "read"}
        previous={() => requestTurn({ kind: "previous", source: "control-previous" })}
        next={() => requestTurn({ kind: "next", source: "control-next" })}
      />
    </section>
  );
});

function SceneHostHandleBridge({ onChange }: { onChange: (host: SceneHostHandle | null) => void }) {
  const host = useOptionalSceneHost();
  useEffect(() => {
    onChange(host);
    return () => onChange(null);
  }, [host, onChange]);
  return null;
}

function PageControls({
  current,
  count,
  busy,
  previous,
  next,
}: {
  current: number;
  count: number;
  busy: boolean;
  previous: () => void;
  next: () => void;
}) {
  return (
    <div className="page-controls" data-animation-owner="motion">
      <button
        onClick={previous}
        disabled={busy || current <= 0}
        aria-label="Previous journal page"
        data-pageflip-focus="previous"
      >
        ← Previous
      </button>
      <span aria-live="polite">
        Page {Math.min(current + 1, count)} of {count}
      </span>
      <button
        onClick={next}
        disabled={busy || current >= count - 1}
        aria-label="Next journal page"
        data-pageflip-focus="next"
      >
        Next →
      </button>
    </div>
  );
}
