"use client";

/* eslint-disable react-hooks/refs -- The boundary intentionally retains the last committed visual route across concurrent pathname renders. */
/* eslint-disable react-hooks/set-state-in-effect -- Layout synchronization owns the governed pending/loading transition state. */

import { AnimatePresence, LayoutGroup, motion, useIsPresent } from "motion/react";
import { useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from "react";
import { useMotionMode } from "../motion/useMotionMode";
import { platformMotionEasing, resolvePlatformMotionToken } from "./motion-tokens";

function isTypingTarget(element: Element | null) {
  if (!(element instanceof HTMLElement) || !element.isConnected) return false;
  return (
    element.matches("input, textarea, select, [contenteditable='true']") ||
    Boolean(element.closest("[contenteditable='true']"))
  );
}

function lastRouteLayer(pathname: string) {
  return [...document.querySelectorAll<HTMLElement>(`[data-route-layer="${CSS.escape(pathname)}"]`)].at(-1) ?? null;
}

function RoutePreparationFallback({ pathname }: { pathname: string }) {
  const community = pathname.startsWith("/community");
  return (
    <main className="community-route-loading" aria-busy="true" aria-live="polite">
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
  duration,
  forcedInactive = false,
  snapshotHtml,
  children,
}: {
  pathname: string;
  duration: number;
  forcedInactive?: boolean;
  snapshotHtml?: string;
  children: React.ReactNode;
}) {
  const isPresent = useIsPresent();
  const layerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    const inactive = forcedInactive || !isPresent;
    layer.inert = inactive;
    if (!inactive) layer.removeAttribute("aria-hidden");
    else layer.setAttribute("aria-hidden", "true");
  }, [forcedInactive, isPresent]);
  return (
    <motion.div
      ref={layerRef}
      className="product-route-layer"
      data-route-layer={pathname}
      data-route-crossfade="direct"
      data-route-interactive={!forcedInactive && isPresent ? "true" : "false"}
      initial={{ opacity: 0.08 }}
      animate={{ opacity: 1, pointerEvents: "auto" }}
      exit={{ opacity: 0, pointerEvents: "none" }}
      transition={{ duration, ease: platformMotionEasing("route") }}
      {...(snapshotHtml === undefined ? {} : { dangerouslySetInnerHTML: { __html: snapshotHtml } })}
    >
      {snapshotHtml === undefined ? children : undefined}
    </motion.div>
  );
}

export function RouteMotionBoundary({ pathname, children }: { pathname: string; children: React.ReactNode }) {
  const { mode } = useMotionMode();
  const focusPath = useRef(pathname);
  const committedRoute = useRef({ pathname, children });
  const stableSnapshot = useRef({ pathname, html: "" });
  const pendingNavigation = useRef<{ pathname: string; startedAt: number; timer: number | null } | null>(null);
  const boundaryLoadingTimer = useRef<number | null>(null);
  const [boundaryLoadingPath, setBoundaryLoadingPath] = useState<string | null>(null);
  const [revision, forceRender] = useReducer((value) => value + 1, 0);
  const routeToken = useMemo(() => resolvePlatformMotionToken("route", mode), [mode]);
  const routeChanged = committedRoute.current.pathname !== pathname;

  useLayoutEffect(() => {
    if (routeChanged) return;
    const route = lastRouteLayer(pathname);
    if (!route) return;
    let frame = 0;
    const capture = () => {
      frame = 0;
      if (!route.textContent?.trim() || route.querySelector('[data-async-state="pending-delay"], .ui-loading-state'))
        return;
      stableSnapshot.current = { pathname, html: route.innerHTML };
    };
    capture();
    const observer = new MutationObserver(() => {
      if (!frame) frame = requestAnimationFrame(capture);
    });
    observer.observe(route, { attributes: true, characterData: true, childList: true, subtree: true });
    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [pathname, routeChanged]);

  useLayoutEffect(() => {
    if (!routeChanged) {
      if (boundaryLoadingTimer.current != null) window.clearTimeout(boundaryLoadingTimer.current);
      boundaryLoadingTimer.current = null;
      if (boundaryLoadingPath !== null) setBoundaryLoadingPath(null);
      committedRoute.current = { pathname, children };
      return;
    }
    if (pendingNavigation.current?.pathname !== pathname) {
      if (pendingNavigation.current?.timer != null) window.clearTimeout(pendingNavigation.current.timer);
      pendingNavigation.current = { pathname, startedAt: performance.now(), timer: null };
    }
    const pending = pendingNavigation.current;
    const incoming = lastRouteLayer(pathname);
    const outgoing = lastRouteLayer(committedRoute.current.pathname);
    const destinationNotPrepared =
      children === committedRoute.current.children ||
      Boolean(incoming && outgoing && incoming.textContent === outgoing.textContent);
    const hasNativeLoading = Boolean(incoming?.querySelector('[data-async-state="pending-delay"], .ui-loading-state'));
    const isDelayedDestination = mode !== "reduced" && (destinationNotPrepared || hasNativeLoading);
    if (isDelayedDestination) {
      if (hasNativeLoading && boundaryLoadingTimer.current != null) {
        window.clearTimeout(boundaryLoadingTimer.current);
        boundaryLoadingTimer.current = null;
      } else if (destinationNotPrepared && !hasNativeLoading && boundaryLoadingTimer.current === null) {
        boundaryLoadingTimer.current = window.setTimeout(
          () => {
            boundaryLoadingTimer.current = null;
            setBoundaryLoadingPath(pathname);
          },
          Math.max(0, 500 - (performance.now() - (pending?.startedAt ?? performance.now()))),
        );
      }
      if (pending && pending.timer === null) {
        const remaining = Math.max(0, 700 - (performance.now() - pending.startedAt));
        pending.timer = window.setTimeout(() => {
          committedRoute.current = { pathname, children };
          pendingNavigation.current = null;
          forceRender();
        }, remaining);
      }
      return;
    }
    if (pending && performance.now() - pending.startedAt < 16) {
      if (pending.timer === null) {
        pending.timer = window.setTimeout(
          () => {
            if (pendingNavigation.current) pendingNavigation.current.timer = null;
            forceRender();
          },
          Math.max(0, 16 - (performance.now() - pending.startedAt)),
        );
      }
      return;
    }
    if (pendingNavigation.current?.timer != null) window.clearTimeout(pendingNavigation.current.timer);
    if (boundaryLoadingTimer.current != null) window.clearTimeout(boundaryLoadingTimer.current);
    boundaryLoadingTimer.current = null;
    if (boundaryLoadingPath !== null) setBoundaryLoadingPath(null);
    pendingNavigation.current = null;
    committedRoute.current = { pathname, children };
    forceRender();
  }, [boundaryLoadingPath, children, mode, pathname, revision, routeChanged]);

  useEffect(
    () => () => {
      if (pendingNavigation.current?.timer != null) window.clearTimeout(pendingNavigation.current.timer);
      if (boundaryLoadingTimer.current != null) window.clearTimeout(boundaryLoadingTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (focusPath.current === pathname) return;
    focusPath.current = pathname;
    let timer = 0;
    let frame = 0;
    let attempts = 0;
    const focusWhenSettled = () => {
      if (isTypingTarget(document.activeElement)) return;
      const route = lastRouteLayer(pathname);
      const routeIsInactive =
        route?.getAttribute("data-route-interactive") === "false" ||
        route?.getAttribute("aria-hidden") === "true" ||
        route?.inert === true;
      const unsettled =
        !route ||
        routeIsInactive ||
        pendingNavigation.current?.pathname === pathname ||
        Boolean(route.querySelector('[data-async-state="pending-delay"], .ui-loading-state'));
      if (unsettled && attempts < 30) {
        attempts += 1;
        timer = window.setTimeout(focusWhenSettled, 50);
        return;
      }
      if (!route || unsettled) return;
      frame = requestAnimationFrame(() => {
        const destination = route.querySelector<HTMLElement>("[data-route-focus], h1") ?? route;
        if (!destination || isTypingTarget(document.activeElement)) return;
        if (!destination.hasAttribute("tabindex")) destination.setAttribute("tabindex", "-1");
        destination.focus({ preventScroll: true });
      });
    };
    timer = window.setTimeout(focusWhenSettled, routeToken.durationSeconds * 1_000 + 24);
    return () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
  }, [pathname, routeToken.durationSeconds]);

  if (mode === "reduced") {
    return (
      <div className="product-route-layer" data-route-layer={pathname}>
        {children}
      </div>
    );
  }

  return (
    <LayoutGroup id="lanternwake-route-layout">
      <AnimatePresence initial={false} mode="sync">
        {routeChanged ? (
          <RouteLayer
            key={committedRoute.current.pathname}
            pathname={committedRoute.current.pathname}
            duration={routeToken.durationSeconds}
            forcedInactive
            snapshotHtml={
              stableSnapshot.current.pathname === committedRoute.current.pathname
                ? stableSnapshot.current.html
                : undefined
            }
          >
            {committedRoute.current.children}
          </RouteLayer>
        ) : null}
        <RouteLayer key={pathname} pathname={pathname} duration={routeToken.durationSeconds}>
          {routeChanged && boundaryLoadingPath === pathname ? (
            <RoutePreparationFallback pathname={pathname} />
          ) : (
            children
          )}
        </RouteLayer>
      </AnimatePresence>
    </LayoutGroup>
  );
}
