"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import type { PageFlip as PageFlipInstance } from "page-flip";
import type { MotionMode } from "@/animation/core/animation-types";
import { changeMountedMetric, recordAssetFailure } from "@/animation/core/metrics";

export type PageFlipBookHandle = {
  next: () => void;
  previous: () => void;
  turnTo: (page: number) => void;
  flipTo: (page: number) => void;
  currentPage: () => number;
  pageCount: () => number;
  orientation: () => "portrait" | "landscape";
};

export type FlipBookPage = {
  id: string;
  density: "hard" | "soft";
  label: string;
  content: React.ReactNode;
};

type FocusMemory = { kind: "control"; name: "previous" | "next" } | { kind: "page"; index: number };

const CLONED_SOURCE_ATTRIBUTES = ["data-pageflip-source", "data-scene-instance", "data-scene-instance-id"] as const;

function clampPage(page: number, count: number) {
  return Math.min(Math.max(0, page), Math.max(0, count - 1));
}

function sanitizedPageClone(node: Element) {
  const clone = node.cloneNode(true) as HTMLElement;
  const elements = [clone, ...Array.from(clone.querySelectorAll<HTMLElement>("*"))];
  for (const element of elements) {
    for (const attribute of CLONED_SOURCE_ATTRIBUTES) element.removeAttribute(attribute);
  }
  return clone;
}

export const PageFlipBook = forwardRef<
  PageFlipBookHandle,
  {
    pages: FlipBookPage[];
    mode: MotionMode;
    className?: string;
    initialPage?: number;
    showCover?: boolean;
    playbackRate?: 0.25 | 0.5 | 1;
    revision?: string | number;
    onPageChange?: (page: number) => void;
    onFlipStateChange?: (state: "folding" | "flipping" | "read") => void;
  }
>(function PageFlipBook(
  {
    pages,
    mode,
    className = "",
    initialPage = 0,
    showCover = true,
    playbackRate = 1,
    revision = 0,
    onPageChange,
    onFlipStateChange,
  },
  ref,
) {
  const root = useRef<HTMLElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const source = useRef<HTMLDivElement>(null);
  const instance = useRef<PageFlipInstance | null>(null);
  const pendingPage = useRef<number | null>(null);
  const focusMemory = useRef<FocusMemory | null>(null);
  const pagesLength = useRef(pages.length);
  const initialCurrent = clampPage(initialPage, pages.length);
  const currentPage = useRef(initialCurrent);
  const pageChangeCallback = useRef(onPageChange);
  const flipStateCallback = useRef(onFlipStateChange);
  const [current, setCurrent] = useState(initialCurrent);
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("landscape");
  const [flipState, setFlipState] = useState<"folding" | "flipping" | "read">("read");
  const [failed, setFailed] = useState(false);
  const signature = useMemo(() => pages.map((page) => page.id).join("|"), [pages]);
  const reduced = mode === "reduced";

  useEffect(() => {
    flipStateCallback.current = onFlipStateChange;
    pageChangeCallback.current = onPageChange;
  }, [onFlipStateChange, onPageChange]);

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

  const requestPage = (page: number, animated: boolean) => {
    if (reduced) {
      changePage(page);
      return;
    }
    if (flipState !== "read") {
      pendingPage.current = page;
      return;
    }
    if (animated) {
      instance.current?.flip(page, "top");
    } else {
      instance.current?.turnToPage(page);
      changePage(page);
    }
  };

  useImperativeHandle(ref, () => ({
    next: () =>
      reduced ? changePage(currentPage.current + 1) : flipState === "read" && instance.current?.flipNext("top"),
    previous: () =>
      reduced ? changePage(currentPage.current - 1) : flipState === "read" && instance.current?.flipPrev("top"),
    turnTo: (page) => requestPage(page, false),
    flipTo: (page) => requestPage(page, true),
    currentPage: () =>
      reduced ? currentPage.current : (instance.current?.getCurrentPageIndex() ?? currentPage.current),
    pageCount: () => (reduced ? pages.length : (instance.current?.getPageCount() ?? pages.length)),
    orientation: () => (reduced ? "portrait" : (instance.current?.getOrientation() ?? orientation)),
  }));

  useEffect(() => {
    const hostElement = host.current;
    const sourceElement = source.current;
    if (reduced || !hostElement || !sourceElement) return;

    let book: PageFlipInstance | null = null;
    let disposed = false;
    let destroyed = false;
    let countedAsMounted = false;
    const runtimeElement = hostElement.ownerDocument.createElement("div");
    runtimeElement.className = "page-flip-runtime";
    runtimeElement.dataset.pageflipRuntime = "";
    hostElement.replaceChildren(runtimeElement);

    const destroyBook = () => {
      if (destroyed) return;
      destroyed = true;
      const ownedBook = book;
      book = null;
      if (ownedBook) {
        try {
          currentPage.current = clampPage(ownedBook.getCurrentPageIndex(), pagesLength.current);
        } catch {
          // A partially initialized runtime may not expose a page collection yet.
        }
        if (instance.current === ownedBook) instance.current = null;
        try {
          ownedBook.destroy();
        } catch {
          // Cleanup still owns the runtime node and mounted metric if library teardown is partial.
        }
      }
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
        book = new PageFlip(runtimeElement, {
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
        const clones = Array.from(sourceElement.children).map(sanitizedPageClone);
        book.loadFromHTML(clones);
        book.on("flip", (event) => {
          const page = Number(event.data);
          changePage(page);
          focusMemory.current = { kind: "page", index: page };
          window.requestAnimationFrame(restoreFocus);
        });
        book.on("changeOrientation", (event) => setOrientation(event.data as "portrait" | "landscape"));
        book.on("changeState", (event) => {
          const state = event.data === "flipping" ? "flipping" : event.data === "read" ? "read" : "folding";
          setFlipState(state);
          flipStateCallback.current?.(state);
          if (state === "read" && pendingPage.current !== null) {
            const page = pendingPage.current;
            pendingPage.current = null;
            if (page !== book?.getCurrentPageIndex()) book?.flip(page, "top");
          }
        });
        instance.current = book;
        currentPage.current = startPage;
        setCurrent(startPage);
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
      destroyBook();
      pendingPage.current = null;
      hostElement.replaceChildren();
    };
  }, [changePage, mode, playbackRate, reduced, restoreFocus, showCover]);

  useEffect(() => {
    if (reduced || !instance.current || !source.current) return;
    const clones = Array.from(source.current.children).map(sanitizedPageClone);
    instance.current.updateFromHtml(clones);
    const page = instance.current.getCurrentPageIndex();
    const safeCurrent = clampPage(page, pages.length);
    if (safeCurrent !== page) instance.current.turnToPage(safeCurrent);
    if (safeCurrent !== currentPage.current) {
      currentPage.current = safeCurrent;
      setCurrent(safeCurrent);
    }
  }, [pages.length, reduced, revision, signature]);

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
      data-flip-state={flipState}
      onFocusCapture={rememberFocus}
      onBlurCapture={forgetExternalFocus}
      onKeyDown={(event) => {
        if (flipState !== "read") return;
        if (event.key === "ArrowRight" || event.key === "PageDown") instance.current?.flipNext("top");
        if (event.key === "ArrowLeft" || event.key === "PageUp") instance.current?.flipPrev("top");
      }}
    >
      <div ref={source} className="page-flip-source" data-pageflip-source aria-hidden="true" inert>
        {pageNodes}
      </div>
      <div ref={host} className="page-flip-host" aria-label="Physical journal pages" />
      <PageControls
        current={current}
        count={pages.length}
        busy={flipState !== "read"}
        previous={() => instance.current?.flipPrev("top")}
        next={() => instance.current?.flipNext("top")}
      />
    </section>
  );
});

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
