"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useMotionMode } from "@/animation/motion/useMotionMode";
import { platformMotionEasing, resolvePlatformMotionToken } from "@/animation/platform/motion-tokens";
import { RouteMotionBoundary } from "@/animation/platform/RouteMotionBoundary";
import { canonicalTerms } from "@/language/canonical-terms";
import { platformCopy } from "@/language/platform-copy";

type Workspace = "public" | "player" | "captain" | "creator";

type ShellDefinition = {
  workspace: Workspace;
  label: string;
  navigation: Array<{ href: string; label: string; exact?: boolean }>;
};

const shellDefinitions: Record<Workspace, ShellDefinition> = {
  public: {
    workspace: "public",
    label: canonicalTerms.product,
    navigation: [
      { href: "/tales", label: platformCopy.exploreChronicles.value, exact: true },
      { href: "/player", label: canonicalTerms.player },
      { href: "/captain", label: canonicalTerms.captainConsole },
      { href: "/studio", label: canonicalTerms.studio },
    ],
  },
  player: {
    workspace: "player",
    label: canonicalTerms.player,
    navigation: [
      { href: "/player/library", label: "My Voyages" },
      { href: "/tales", label: platformCopy.exploreChronicles.value, exact: true },
      { href: "/player/sign-in#invitation-code", label: "Join with an invitation code" },
      { href: "/", label: "Switch Role", exact: true },
    ],
  },
  captain: {
    workspace: "captain",
    label: canonicalTerms.captainConsole,
    navigation: [
      { href: "/captain/library", label: "Voyages" },
      { href: "/captain/invitations", label: "Crew invitations" },
      { href: "/tales", label: platformCopy.exploreChronicles.value, exact: true },
      { href: "/studio/library", label: canonicalTerms.studio },
    ],
  },
  creator: {
    workspace: "creator",
    label: canonicalTerms.studio,
    navigation: [
      { href: "/studio/library", label: canonicalTerms.chronicleLibrary },
      { href: "/studio/tales/new", label: platformCopy.createChronicle.value },
      { href: "/tales", label: "Preview Voyage", exact: true },
      { href: "/captain/library", label: canonicalTerms.captainConsole },
    ],
  },
};

function getWorkspace(pathname: string): Workspace {
  if (pathname.startsWith("/player")) return "player";
  if (pathname.startsWith("/captain")) return "captain";
  if (pathname.startsWith("/studio")) return "creator";
  return "public";
}

function isImmersiveRoute(pathname: string) {
  return (
    pathname === "/" ||
    pathname.startsWith("/dev/") ||
    pathname.startsWith("/quartermaster") ||
    pathname.startsWith("/tale/") ||
    /^\/play\/[^/]+\/session\/[^/]+/.test(pathname) ||
    /^\/player\/playthroughs\/[^/]+\/journal/.test(pathname)
  );
}

function isCurrent(pathname: string, href: string, exact?: boolean) {
  const route = href.split("#")[0];
  if (exact) return pathname === route;
  return pathname === route || pathname.startsWith(`${route}/`);
}

export function ProductShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { mode } = useMotionMode();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const navigationRef = useRef<HTMLElement>(null);
  const previousPathnameRef = useRef(pathname);
  const closeMenuAndRestoreFocus = useCallback(() => {
    setMenuOpen(false);
    queueMicrotask(() => menuButtonRef.current?.focus());
  }, []);

  useEffect(() => {
    if (previousPathnameRef.current === pathname) return;
    previousPathnameRef.current = pathname;
    queueMicrotask(() => setMenuOpen(false));
  }, [pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    queueMicrotask(() => navigationRef.current?.querySelector<HTMLAnchorElement>("a")?.focus());
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMenuAndRestoreFocus();
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [closeMenuAndRestoreFocus, menuOpen]);

  if (isImmersiveRoute(pathname)) return <RouteMotionBoundary pathname={pathname}>{children}</RouteMotionBoundary>;

  const definition = shellDefinitions[getWorkspace(pathname)];
  const micro = resolvePlatformMotionToken("micro", mode);
  return (
    <div className={`product-shell workspace-${definition.workspace}`}>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <header className="product-shell-header">
        <Link className="product-mark" href="/" aria-label="Voyagewright role selection">
          <span aria-hidden="true">✦</span>
          <span>
            <strong>{canonicalTerms.product}</strong>
            <AnimatePresence initial={false} mode="wait">
              <motion.small
                key={definition.workspace}
                initial={{ opacity: 0, y: micro.distancePx }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -micro.distancePx }}
                transition={{ duration: micro.durationSeconds, ease: platformMotionEasing("micro") }}
              >
                {definition.label}
              </motion.small>
            </AnimatePresence>
          </span>
        </Link>
        <button
          ref={menuButtonRef}
          className="product-menu-button"
          type="button"
          aria-expanded={menuOpen}
          aria-controls="product-navigation"
          onClick={() => setMenuOpen((current) => !current)}
        >
          <span aria-hidden="true">{menuOpen ? "×" : "☰"}</span>
          <span>{menuOpen ? "Close" : "Menu"}</span>
        </button>
        <nav
          ref={navigationRef}
          id="product-navigation"
          className="product-navigation"
          aria-label={`${definition.label} navigation`}
        >
          {definition.navigation.map((item) => {
            const current = isCurrent(pathname, item.href, item.exact);
            return (
              <Link
                key={item.href}
                className={current ? "current" : undefined}
                href={item.href}
                aria-current={current ? "page" : undefined}
              >
                {current && (
                  <motion.i
                    className="product-navigation-active-plate"
                    layoutId={`product-navigation-active-${definition.workspace}`}
                    transition={{ duration: micro.durationSeconds, ease: platformMotionEasing("micro") }}
                    aria-hidden="true"
                  />
                )}
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        {menuOpen && (
          <button
            className="product-menu-backdrop"
            type="button"
            aria-label="Close navigation menu"
            onClick={closeMenuAndRestoreFocus}
          />
        )}
      </header>
      <div className="product-shell-content" id="main-content" tabIndex={-1}>
        <RouteMotionBoundary pathname={pathname}>{children}</RouteMotionBoundary>
      </div>
      <footer className="product-footer">
        <p>{platformCopy.productTagline.value}</p>
        <nav aria-label="Product links">
          <Link href="/">Choose a role</Link>
          <Link href="/tales">{platformCopy.exploreChronicles.value}</Link>
        </nav>
      </footer>
    </div>
  );
}
