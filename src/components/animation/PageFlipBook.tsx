"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
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

export const PageFlipBook = forwardRef<
  PageFlipBookHandle,
  {
    pages: FlipBookPage[];
    mode: MotionMode;
    className?: string;
    initialPage?: number;
    onPageChange?: (page: number) => void;
  }
>(function PageFlipBook({ pages, mode, className = "", initialPage = 0, onPageChange }, ref) {
  const host = useRef<HTMLDivElement>(null);
  const source = useRef<HTMLDivElement>(null);
  const instance = useRef<PageFlipInstance | null>(null);
  const [current, setCurrent] = useState(Math.min(initialPage, Math.max(0, pages.length - 1)));
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("landscape");
  const [failed, setFailed] = useState(false);
  const signature = useMemo(() => pages.map((page) => page.id).join("|"), [pages]);
  const reduced = mode === "reduced";

  const changePage = (page: number) => {
    const next = Math.min(Math.max(0, page), pages.length - 1);
    setCurrent(next);
    onPageChange?.(next);
  };

  useImperativeHandle(ref, () => ({
    next: () => (reduced ? changePage(current + 1) : instance.current?.flipNext("top")),
    previous: () => (reduced ? changePage(current - 1) : instance.current?.flipPrev("top")),
    turnTo: (page) => (reduced ? changePage(page) : instance.current?.turnToPage(page)),
    flipTo: (page) => (reduced ? changePage(page) : instance.current?.flip(page, "top")),
    currentPage: () => (reduced ? current : (instance.current?.getCurrentPageIndex() ?? current)),
    pageCount: () => (reduced ? pages.length : (instance.current?.getPageCount() ?? pages.length)),
    orientation: () => (reduced ? "portrait" : (instance.current?.getOrientation() ?? orientation)),
  }));

  useEffect(() => {
    const hostElement = host.current;
    const sourceElement = source.current;
    if (reduced || !hostElement || !sourceElement) return;
    let disposed = false;
    void import("page-flip")
      .then(({ PageFlip }) => {
        if (disposed) return;
        const book = new PageFlip(hostElement, {
          width: 560,
          height: 760,
          size: "stretch",
          minWidth: 300,
          maxWidth: 720,
          minHeight: 420,
          maxHeight: 960,
          showCover: true,
          usePortrait: true,
          autoSize: true,
          drawShadow: true,
          maxShadowOpacity: 0.45,
          flippingTime: mode === "full" ? 1100 : 620,
          swipeDistance: 24,
          mobileScrollSupport: true,
          startPage: Math.min(initialPage, pages.length - 1),
        });
        const clones = Array.from(sourceElement.children).map((node) => node.cloneNode(true) as HTMLElement);
        book.loadFromHTML(clones);
        book.on("flip", (event) => {
          const page = Number(event.data);
          changePage(page);
          window.requestAnimationFrame(() =>
            hostElement.querySelector<HTMLElement>(`[data-page-index="${page}"]`)?.focus({ preventScroll: true }),
          );
        });
        book.on("changeOrientation", (event) => setOrientation(event.data as "portrait" | "landscape"));
        instance.current = book;
        changeMountedMetric("pageFlip", 1);
      })
      .catch(() => {
        setFailed(true);
        recordAssetFailure("page-flip");
      });
    return () => {
      disposed = true;
      if (instance.current) {
        instance.current.destroy();
        instance.current = null;
        changeMountedMetric("pageFlip", -1);
      }
      hostElement.replaceChildren();
    };
    // The page-flip instance deliberately initializes once; updates are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  useEffect(() => {
    if (reduced || !instance.current || !source.current) return;
    const clones = Array.from(source.current.children).map((node) => node.cloneNode(true) as HTMLElement);
    instance.current.updateFromHtml(clones);
    const safeCurrent = Math.min(instance.current.getCurrentPageIndex(), pages.length - 1);
    if (safeCurrent !== instance.current.getCurrentPageIndex()) instance.current.turnToPage(safeCurrent);
  }, [pages.length, reduced, signature]);

  const pageNodes = pages.map((page, index) => (
    <article
      key={page.id}
      className={`ft-page density-${page.density}`}
      data-density={page.density}
      data-page-index={index}
      tabIndex={-1}
      aria-label={page.label}
    >
      {page.content}
    </article>
  ));

  if (reduced || failed) {
    return (
      <section
        className={`page-flip-book reduced-page-book ${className}`}
        data-pageflip-status={failed ? "fallback" : "reduced"}
      >
        <div className="reduced-page-stage">{pages[current]?.content}</div>
        <PageControls
          current={current}
          count={pages.length}
          previous={() => changePage(current - 1)}
          next={() => changePage(current + 1)}
        />
      </section>
    );
  }

  return (
    <section
      className={`page-flip-book orientation-${orientation} ${className}`}
      data-animation-owner="st-page-flip"
      onKeyDown={(event) => {
        if (event.key === "ArrowRight" || event.key === "PageDown") instance.current?.flipNext("top");
        if (event.key === "ArrowLeft" || event.key === "PageUp") instance.current?.flipPrev("top");
      }}
    >
      <div ref={source} className="page-flip-source" aria-hidden="true" inert>
        {pageNodes}
      </div>
      <div ref={host} className="page-flip-host" aria-label="Physical journal pages" />
      <PageControls
        current={current}
        count={pages.length}
        previous={() => instance.current?.flipPrev("top")}
        next={() => instance.current?.flipNext("top")}
      />
    </section>
  );
});

function PageControls({
  current,
  count,
  previous,
  next,
}: {
  current: number;
  count: number;
  previous: () => void;
  next: () => void;
}) {
  return (
    <div className="page-controls" data-animation-owner="motion">
      <button onClick={previous} disabled={current <= 0} aria-label="Previous journal page">
        ← Previous
      </button>
      <span aria-live="polite">
        Page {Math.min(current + 1, count)} of {count}
      </span>
      <button onClick={next} disabled={current >= count - 1} aria-label="Next journal page">
        Next →
      </button>
    </div>
  );
}
