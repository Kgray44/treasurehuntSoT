"use client";

/* eslint-disable react-hooks/refs -- The route authority intentionally owns generation state and the last safe visual snapshot across renders. */

import { LayoutGroup, motion } from "motion/react";
import { useEffect, useLayoutEffect, useMemo, useReducer, useRef } from "react";
import { useMotionMode } from "../motion/useMotionMode";
import { platformMotionEasing, resolvePlatformMotionToken } from "./motion-tokens";

const pendingSelector = '[data-async-state="pending-delay"], .ui-loading-state';
const loadingThresholdMs = 500;

type Navigation = {
  generation: number;
  pathname: string;
  children: React.ReactNode;
  startedAt: number;
  phase: "preparing" | "loading" | "ready";
  loadingShown: boolean;
  outgoing: { pathname: string; html: string } | null;
  loadingTimer: number | null;
  settlementTimer: number | null;
  observer: MutationObserver | null;
  readinessFrame: number | null;
};

function isTypingTarget(element: Element | null) {
  if (!(element instanceof HTMLElement) || !element.isConnected) return false;
  return (
    element.matches("input, textarea, select, [contenteditable='true']") ||
    Boolean(element.closest("[contenteditable='true']"))
  );
}

function routeLayer(pathname: string, generation?: number) {
  const generationSelector = generation === undefined ? "" : `[data-route-generation="${generation}"]`;
  return (
    [...document.querySelectorAll<HTMLElement>(`[data-route-layer="${CSS.escape(pathname)}"]${generationSelector}`)].at(
      -1,
    ) ?? null
  );
}

function routeSnapshotHtml(route: HTMLElement) {
  const snapshot = route.cloneNode(true) as HTMLElement;
  snapshot.querySelectorAll("[id]").forEach((element) => element.removeAttribute("id"));
  snapshot.querySelectorAll("[aria-controls], [aria-describedby], [aria-labelledby], [for]").forEach((element) => {
    element.removeAttribute("aria-controls");
    element.removeAttribute("aria-describedby");
    element.removeAttribute("aria-labelledby");
    element.removeAttribute("for");
  });
  snapshot.querySelectorAll("label").forEach((label) => {
    const visualLabel = document.createElement("div");
    for (const attribute of label.attributes) visualLabel.setAttribute(attribute.name, attribute.value);
    visualLabel.innerHTML = label.innerHTML;
    label.replaceWith(visualLabel);
  });
  return snapshot.innerHTML;
}

function contentIsPending(content: HTMLElement) {
  return Boolean(content.querySelector(pendingSelector));
}

function RoutePreparationFallback({ pathname }: { pathname: string }) {
  const community = pathname.startsWith("/community");
  return (
    <main className="community-route-loading route-preparation-fallback" aria-busy="true" aria-live="polite">
      <section className="ui-state ui-loading-state" data-async-state="pending" role="status" aria-busy="true">
        <span className="ui-spinner" aria-hidden="true" />
        <div>
          <h2>{community ? "Opening Community Harbor" : "Opening the next page"}</h2>
          <p>{community ? "Gathering safe public Community records." : "Preparing the destination."}</p>
        </div>
        <div className="ui-skeleton-lines" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
      </section>
    </main>
  );
}

function RouteLayer({
  pathname,
  generation,
  duration,
  distance,
  outgoing = false,
  snapshotHtml,
  showLoading = false,
  children,
}: {
  pathname: string;
  generation: number;
  duration: number;
  distance: number;
  outgoing?: boolean;
  snapshotHtml?: string;
  showLoading?: boolean;
  children?: React.ReactNode;
}) {
  const layerRef = useRef<HTMLDivElement>(null);
  const inactive = outgoing;
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    layer.inert = inactive;
    if (inactive) layer.setAttribute("aria-hidden", "true");
    else layer.removeAttribute("aria-hidden");
  }, [inactive]);
  return (
    <motion.div
      ref={layerRef}
      className="product-route-layer"
      data-route-layer={pathname}
      data-route-generation={generation}
      data-route-crossfade="direct"
      data-route-role={outgoing ? "outgoing" : "incoming"}
      data-route-interactive={!inactive ? "true" : "false"}
      initial={outgoing ? false : { opacity: 0, y: distance }}
      animate={outgoing ? { opacity: 0, pointerEvents: "none" } : { opacity: 1, y: 0, pointerEvents: "auto" }}
      exit={{ opacity: 0, pointerEvents: "none" }}
      transition={{ duration, ease: platformMotionEasing("route") }}
      {...(snapshotHtml === undefined ? {} : { dangerouslySetInnerHTML: { __html: snapshotHtml } })}
    >
      {snapshotHtml === undefined ? (
        <>
          <div className="product-route-content" data-route-content="true">
            {children}
          </div>
          {showLoading ? <RoutePreparationFallback pathname={pathname} /> : null}
        </>
      ) : undefined}
    </motion.div>
  );
}

function cancelNavigationWork(navigation: Navigation | null) {
  if (!navigation) return;
  if (navigation.loadingTimer !== null) window.clearTimeout(navigation.loadingTimer);
  if (navigation.settlementTimer !== null) window.clearTimeout(navigation.settlementTimer);
  if (navigation.readinessFrame !== null) cancelAnimationFrame(navigation.readinessFrame);
  navigation.observer?.disconnect();
  navigation.loadingTimer = null;
  navigation.settlementTimer = null;
  navigation.readinessFrame = null;
  navigation.observer = null;
}

export function RouteMotionBoundary({ pathname, children }: { pathname: string; children: React.ReactNode }) {
  const { mode } = useMotionMode();
  const [, forceRender] = useReducer((value) => value + 1, 0);
  const routeToken = useMemo(() => resolvePlatformMotionToken("route", mode), [mode]);
  const generation = useRef(0);
  const renderedPath = useRef(pathname);
  const settledRoute = useRef({ pathname, children });
  const stableSnapshot = useRef({ pathname, html: "" });
  const navigation = useRef<Navigation | null>(null);
  const focusPath = useRef(pathname);

  if (mode === "reduced") {
    if (renderedPath.current !== pathname) generation.current += 1;
    cancelNavigationWork(navigation.current);
    navigation.current = null;
    renderedPath.current = pathname;
    settledRoute.current = { pathname, children };
  } else if (renderedPath.current !== pathname) {
    const previousNavigation = navigation.current;
    cancelNavigationWork(previousNavigation);
    const outgoing = previousNavigation
      ? null
      : {
          pathname: settledRoute.current.pathname,
          html: stableSnapshot.current.pathname === settledRoute.current.pathname ? stableSnapshot.current.html : "",
        };
    generation.current += 1;
    navigation.current = {
      generation: generation.current,
      pathname,
      children,
      startedAt: -1,
      phase: "preparing",
      loadingShown: false,
      outgoing,
      loadingTimer: null,
      settlementTimer: null,
      observer: null,
      readinessFrame: null,
    };
    renderedPath.current = pathname;
  } else if (navigation.current?.pathname === pathname) {
    navigation.current.children = children;
  } else {
    settledRoute.current = { pathname, children };
  }

  useLayoutEffect(() => {
    const active = navigation.current;
    if (mode === "reduced" || !active || active.pathname !== pathname) return;
    if (active.startedAt < 0) active.startedAt = performance.now();
    const activeGeneration = active.generation;
    const incoming = routeLayer(pathname, activeGeneration);
    const content = incoming?.querySelector<HTMLElement>("[data-route-content]");
    if (!content) return;

    const isCurrent = () =>
      navigation.current?.generation === activeGeneration && navigation.current.pathname === pathname;
    const settle = () => {
      if (!isCurrent()) return;
      const current = navigation.current!;
      cancelNavigationWork(current);
      navigation.current = null;
      forceRender();
    };
    const markReady = () => {
      if (!isCurrent()) return;
      const current = navigation.current!;
      if (current.phase === "ready") return;
      if (current.loadingTimer !== null) window.clearTimeout(current.loadingTimer);
      current.loadingTimer = null;
      current.observer?.disconnect();
      current.observer = null;
      current.phase = "ready";
      settledRoute.current = { pathname, children: current.children };
      const elapsed = performance.now() - current.startedAt;
      const remaining = Math.max(0, routeToken.durationMs - elapsed);
      current.settlementTimer = window.setTimeout(settle, remaining);
      forceRender();
    };
    const evaluateReadiness = () => {
      if (!isCurrent()) return;
      const currentContent = routeLayer(pathname, activeGeneration)?.querySelector<HTMLElement>("[data-route-content]");
      if (currentContent && !contentIsPending(currentContent)) markReady();
    };

    if (!contentIsPending(content)) {
      markReady();
      return;
    }

    active.observer?.disconnect();
    active.observer = new MutationObserver(() => {
      if (!isCurrent()) return;
      if (navigation.current!.readinessFrame === null)
        navigation.current!.readinessFrame = requestAnimationFrame(() => {
          if (!isCurrent()) return;
          navigation.current!.readinessFrame = null;
          evaluateReadiness();
        });
    });
    active.observer.observe(content, { attributes: true, characterData: true, childList: true, subtree: true });
    if (active.loadingTimer === null) {
      const remaining = Math.max(0, loadingThresholdMs - (performance.now() - active.startedAt));
      active.loadingTimer = window.setTimeout(() => {
        if (!isCurrent()) return;
        const currentContent = routeLayer(pathname, activeGeneration)?.querySelector<HTMLElement>(
          "[data-route-content]",
        );
        if (!currentContent || !contentIsPending(currentContent)) {
          markReady();
          return;
        }
        const current = navigation.current!;
        current.loadingTimer = null;
        current.phase = "loading";
        current.loadingShown = true;
        forceRender();
      }, remaining);
    }
    return () => {
      if (!isCurrent()) return;
      active.observer?.disconnect();
      active.observer = null;
    };
  }, [children, mode, pathname, routeToken.durationMs]);

  useLayoutEffect(() => {
    if (mode === "reduced" || navigation.current) return;
    const currentLayer = routeLayer(pathname);
    const content = currentLayer?.querySelector<HTMLElement>("[data-route-content]") ?? currentLayer;
    if (!content || !content.textContent?.trim() || contentIsPending(content)) return;
    let frame = 0;
    const capture = () => {
      frame = 0;
      if (!content.isConnected || contentIsPending(content)) return;
      stableSnapshot.current = { pathname, html: routeSnapshotHtml(content) };
    };
    capture();
    const observer = new MutationObserver(() => {
      if (!frame) frame = requestAnimationFrame(capture);
    });
    observer.observe(content, { attributes: true, characterData: true, childList: true, subtree: true });
    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [children, mode, pathname]);

  useEffect(
    () => () => {
      cancelNavigationWork(navigation.current);
      navigation.current = null;
    },
    [],
  );

  useEffect(() => {
    if (focusPath.current === pathname) return;
    focusPath.current = pathname;
    const ownedGeneration = generation.current;
    let cancelled = false;
    let timer = 0;
    let frame = 0;
    let attempts = 0;
    const focusWhenSettled = () => {
      if (cancelled || ownedGeneration !== generation.current || isTypingTarget(document.activeElement)) return;
      const active = navigation.current;
      const layer = routeLayer(pathname);
      const content = layer?.querySelector<HTMLElement>("[data-route-content]") ?? layer;
      const unsettled =
        !layer ||
        !content ||
        layer.getAttribute("data-route-interactive") === "false" ||
        layer.getAttribute("aria-hidden") === "true" ||
        layer.inert ||
        Boolean(active && active.pathname === pathname) ||
        contentIsPending(content);
      if (unsettled && attempts < 40) {
        attempts += 1;
        timer = window.setTimeout(focusWhenSettled, 25);
        return;
      }
      if (unsettled || !content) return;
      frame = requestAnimationFrame(() => {
        if (cancelled || ownedGeneration !== generation.current || isTypingTarget(document.activeElement)) return;
        const destination = content.querySelector<HTMLElement>("[data-route-focus], h1") ?? content;
        if (!destination.hasAttribute("tabindex")) destination.setAttribute("tabindex", "-1");
        destination.focus({ preventScroll: true });
      });
    };
    timer = window.setTimeout(focusWhenSettled, routeToken.durationMs + 24);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
  }, [mode, pathname, routeToken.durationMs]);

  if (mode === "reduced") {
    return (
      <div
        className="product-route-layer"
        data-route-layer={pathname}
        data-route-generation={generation.current}
        data-route-state="settled"
      >
        {children}
      </div>
    );
  }

  const active = navigation.current;
  const incomingGeneration = active?.generation ?? generation.current;
  return (
    <LayoutGroup id="lanternwake-route-layout">
      <div
        className="product-route-transition"
        data-route-active-generation={incomingGeneration}
        data-route-state={active?.phase ?? "settled"}
        data-route-loading-shown={active?.loadingShown ? "true" : "false"}
      >
        {active?.outgoing ? (
          <RouteLayer
            key={`outgoing-${active.generation}-${active.outgoing.pathname}`}
            pathname={active.outgoing.pathname}
            generation={active.generation}
            duration={routeToken.durationSeconds}
            distance={0}
            outgoing
            snapshotHtml={active.outgoing.html}
          />
        ) : null}
        <RouteLayer
          key={`incoming-${incomingGeneration}-${pathname}`}
          pathname={pathname}
          generation={incomingGeneration}
          duration={routeToken.durationSeconds}
          distance={routeToken.distancePx}
          showLoading={active?.phase === "loading"}
        >
          {children}
        </RouteLayer>
      </div>
    </LayoutGroup>
  );
}
