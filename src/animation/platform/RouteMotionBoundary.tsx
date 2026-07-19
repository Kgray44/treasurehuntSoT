"use client";

import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { useEffect, useMemo, useRef } from "react";
import { useMotionMode } from "../motion/useMotionMode";
import { platformMotionEasing, resolvePlatformMotionToken } from "./motion-tokens";

function isTypingTarget(element: Element | null) {
  if (!(element instanceof HTMLElement) || !element.isConnected) return false;
  return (
    element.matches("input, textarea, select, [contenteditable='true']") ||
    Boolean(element.closest("[contenteditable='true']"))
  );
}

export function RouteMotionBoundary({ pathname, children }: { pathname: string; children: React.ReactNode }) {
  const { mode } = useMotionMode();
  const previousPath = useRef(pathname);
  const routeToken = useMemo(() => resolvePlatformMotionToken("route", mode), [mode]);

  useEffect(() => {
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;
    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        if (isTypingTarget(document.activeElement)) return;
        const route = document.querySelector<HTMLElement>(`[data-route-layer="${CSS.escape(pathname)}"]`);
        const destination = route?.querySelector<HTMLElement>("[data-route-focus], h1") ?? route;
        if (!destination) return;
        if (!destination.hasAttribute("tabindex")) destination.setAttribute("tabindex", "-1");
        destination.focus({ preventScroll: true });
      });
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
    };
  }, [pathname]);

  return (
    <LayoutGroup id="lanternwake-route-layout">
      <AnimatePresence initial={false} mode="sync">
        <motion.div
          key={pathname}
          className="product-route-layer"
          data-route-layer={pathname}
          initial={{ opacity: mode === "reduced" ? 1 : 0, y: routeToken.distancePx }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: mode === "reduced" ? 1 : 0, y: -routeToken.distancePx / 2 }}
          transition={{ duration: routeToken.durationSeconds, ease: platformMotionEasing("route") }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </LayoutGroup>
  );
}
