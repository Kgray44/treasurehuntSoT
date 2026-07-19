"use client";

import { forwardRef, useCallback, useEffect, useId, useImperativeHandle, useMemo, useRef, useState } from "react";
import type { PageFlip as PageFlipInstance } from "page-flip";
import type { MotionMode } from "@/animation/core/animation-types";
import { changeMountedMetric, recordAssetFailure } from "@/animation/core/metrics";
import { SceneHost } from "@/animation/hosts/SceneHost";
import { useOptionalSceneHost } from "@/animation/hosts/SceneHostContext";
import type { RuntimeSurfaceLease, SceneHostHandle, SceneTargetHandle } from "@/animation/hosts/scene-host-types";
import {
  createPageFlipMountId,
  PageFlipBoundaryController,
  type PageFlipBoundarySnapshot,
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
};

export type FlipBookPage = {
  id: string;
  density: "hard" | "soft";
  label: string;
  content: React.ReactNode;
};

type FocusMemory = { kind: "control"; name: "previous" | "next" } | { kind: "page"; index: number };
type PageFlipTurnIntent =
  | Readonly<{ kind: "next" }>
  | Readonly<{ kind: "previous" }>
  | Readonly<{ kind: "turn-to"; page: number }>
  | Readonly<{ kind: "flip-to"; page: number }>;
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
    onBoundaryChange?: (snapshot: PageFlipBoundarySnapshot) => void;
    onPageTargetsChange?: (authority: PageFlipPageTargetAuthority | null) => void;
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
  const pendingTurn = useRef<PageFlipTurnIntent | null>(null);
  const turnReady = useRef(false);
  const turnReadinessFrame = useRef<number | null>(null);
  const turnRuntimeIdentity = useRef(0);
  const focusMemory = useRef<FocusMemory | null>(null);
  const pagesLength = useRef(pages.length);
  const initialCurrent = clampPage(initialPage, pages.length);
  const currentPage = useRef(initialCurrent);
  const pageChangeCallback = useRef(onPageChange);
  const flipStateCallback = useRef(onFlipStateChange);
  const boundaryCallback = useRef(onBoundaryChange);
  const pageTargetsCallback = useRef(onPageTargetsChange);
  const flipStateRef = useRef<"folding" | "flipping" | "read">("read");
  const [current, setCurrent] = useState(initialCurrent);
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("landscape");
  const [flipState, setFlipState] = useState<"folding" | "flipping" | "read">("read");
  const [failed, setFailed] = useState(false);
  const [sceneHost, setSceneHost] = useState<SceneHostHandle | null>(null);
  const signature = useMemo(() => pages.map((page) => page.id).join("|"), [pages]);
  const pageIds = useMemo(() => pages.map((page) => page.id), [pages]);
  const pageIdentity = useRef({ pageIds, contentRevision: `${String(revision)}:${signature}` });
  const reduced = mode === "reduced";

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
    boundaryCallback.current = onBoundaryChange;
    pageTargetsCallback.current = onPageTargetsChange;
    pageChangeCallback.current = onPageChange;
  }, [onBoundaryChange, onFlipStateChange, onPageChange, onPageTargetsChange]);

  useEffect(() => {
    pagesLength.current = pages.length;
  }, [pages.length]);

  const changePage = useCallback((page: number) => {
    const next = clampPage(page, pagesLength.current);
    currentPage.current = next;
    setCurrent(next);
    pageChangeCallback.current?.(next);
  }, []);

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

    const target =
      memory.kind === "control"
        ? rootElement.querySelector<HTMLElement>(`[data-pageflip-focus="${memory.name}"]`)
        : (rootElement.querySelector<HTMLElement>(
            `.page-flip-host [data-page-index="${clampPage(memory.index, pagesLength.current)}"]`,
          ) ??
          rootElement.querySelector<HTMLElement>(
            `.reduced-page-stage [data-page-index="${clampPage(memory.index, pagesLength.current)}"]`,
          ));
    target?.focus({ preventScroll: true });
  }, []);

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
        const intent = pendingTurn.current;
        if (!intent) return;
        pendingTurn.current = null;
        turnReady.current = false;
        const dispatch = dispatchPageFlipTurn(book, intent, currentPage.current, changePage);
        if (dispatch !== "animated") {
          boundary.current?.updateCurrentPage(currentPage.current, "visible");
          schedule(book, runtimeIdentity);
        }
      });
    },
    [changePage],
  );

  const requestTurn = useCallback(
    (intent: PageFlipTurnIntent) => {
      const normalizedIntent =
        intent.kind === "flip-to" || intent.kind === "turn-to"
          ? ({ ...intent, page: clampPage(intent.page, pagesLength.current) } as PageFlipTurnIntent)
          : intent;
      if (reduced) {
        if (normalizedIntent.kind === "next") changePage(currentPage.current + 1);
        else if (normalizedIntent.kind === "previous") changePage(currentPage.current - 1);
        else changePage(normalizedIntent.page);
        return;
      }

      const book = instance.current;
      if (!book) return;
      if (flipStateRef.current !== "read" || !turnReady.current) {
        pendingTurn.current = normalizedIntent;
        return;
      }

      pendingTurn.current = null;
      turnReady.current = false;
      const dispatch = dispatchPageFlipTurn(book, normalizedIntent, currentPage.current, changePage);
      if (dispatch !== "animated") {
        boundary.current?.updateCurrentPage(currentPage.current, "visible");
        scheduleTurnReadiness(book, turnRuntimeIdentity.current);
      }
    },
    [changePage, reduced, scheduleTurnReadiness],
  );

  useImperativeHandle(ref, () => ({
    next: () => requestTurn({ kind: "next" }),
    previous: () => requestTurn({ kind: "previous" }),
    turnTo: (page) => requestTurn({ kind: "turn-to", page }),
    flipTo: (page) => requestTurn({ kind: "flip-to", page }),
    currentPage: () => currentPage.current,
    pageCount: () => (reduced ? pages.length : (instance.current?.getPageCount() ?? pages.length)),
    orientation: () => (reduced ? "portrait" : (instance.current?.getOrientation() ?? orientation)),
    boundary: () => boundary.current?.snapshot() ?? null,
  }));

  useEffect(() => {
    const hostElement = host.current;
    const sourceElement = source.current;
    if (reduced || failed || !clientIdentityReady || !sceneHost || !hostElement || !sourceElement) return;

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
    pendingTurn.current = null;
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

    void import("page-flip")
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
            onPageTargetsChange: (authority) => pageTargetsCallback.current?.(authority),
          });
          boundary.current = boundaryController;
          const clones = boundaryController.preparePages(
            pageIdentity.current.pageIds,
            pageIdentity.current.contentRevision,
          );
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
        setOrientation(initialOrientation);
        activeBoundary.bindPrimaryPages(initialSpreadAnchor, initialOrientation);
        book.on("flip", (event) => {
          const page = Number(event.data);
          changePage(page);
          activeBoundary.updateCurrentPage(page, flipStateRef.current === "read" ? "visible" : "settling");
          focusMemory.current = { kind: "page", index: page };
          window.requestAnimationFrame(restoreFocus);
        });
        book.on("changeOrientation", (event) => {
          const nextOrientation = event.data as "portrait" | "landscape";
          setOrientation(nextOrientation);
          activeBoundary.rebindOrientation(nextOrientation, currentPage.current);
        });
        book.on("changeState", (event) => {
          const state = event.data === "flipping" ? "flipping" : event.data === "read" ? "read" : "folding";
          flipStateRef.current = state;
          setFlipState(state);
          flipStateCallback.current?.(state);
          activeBoundary.updateCurrentPage(currentPage.current, state === "read" ? "visible" : "settling");
          if (state === "read") {
            if (book) scheduleTurnReadiness(book, runtimeIdentity);
          } else {
            turnReady.current = false;
            if (turnReadinessFrame.current !== null) {
              window.cancelAnimationFrame(turnReadinessFrame.current);
              turnReadinessFrame.current = null;
            }
          }
        });
        instance.current = book;
        turnReady.current = true;
        currentPage.current = initialSpreadAnchor;
        setCurrent(initialSpreadAnchor);
        changeMountedMetric("pageFlip", 1);
        countedAsMounted = true;
        window.requestAnimationFrame(restoreFocus);
      })
      .catch(() => {
        destroyBook();
        setFailed(true);
        recordAssetFailure("page-flip");
      });

    return () => {
      disposed = true;
      if (turnRuntimeIdentity.current === runtimeIdentity) turnRuntimeIdentity.current += 1;
      if (turnReadinessFrame.current !== null) {
        window.cancelAnimationFrame(turnReadinessFrame.current);
        turnReadinessFrame.current = null;
      }
      turnReady.current = false;
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
    reduced,
    restoreFocus,
    sceneHost,
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
    } catch {
      recordAssetFailure("page-flip");
      setFailed(true);
    }
  }, [pageIds, pages.length, reduced, revision, signature]);

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
        data-pageflip-book-id={logicalBookId}
        data-pageflip-mount-id={mountId}
        onFocusCapture={rememberFocus}
        onBlurCapture={forgetExternalFocus}
      >
        <div className="reduced-page-stage">
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
          previous={() => changePage(visibleCurrent - 1)}
          next={() => changePage(visibleCurrent + 1)}
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
      onFocusCapture={rememberFocus}
      onBlurCapture={forgetExternalFocus}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight" || event.key === "PageDown") {
          event.preventDefault();
          requestTurn({ kind: "next" });
        }
        if (event.key === "ArrowLeft" || event.key === "PageUp") {
          event.preventDefault();
          requestTurn({ kind: "previous" });
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
        <div ref={host} className="page-flip-host" aria-label="Physical journal pages" />
      </SceneHost>
      <PageControls
        current={current}
        count={pages.length}
        busy={flipState !== "read"}
        previous={() => requestTurn({ kind: "previous" })}
        next={() => requestTurn({ kind: "next" })}
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
