"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useMotionMode } from "@/animation/motion/useMotionMode";

type Workspace = "public" | "player" | "captain" | "creator";

type ShellDefinition = {
  workspace: Workspace;
  label: string;
  navigation: Array<{ href: string; label: string; exact?: boolean }>;
};

const shellDefinitions: Record<Workspace, ShellDefinition> = {
  public: {
    workspace: "public",
    label: "Tall Tale Harbor",
    navigation: [
      { href: "/tales", label: "Tall Tale Library", exact: true },
      { href: "/captain", label: "Captain Studio" },
      { href: "/player", label: "Player Library" },
      { href: "/settings", label: "Settings", exact: true },
    ],
  },
  player: {
    workspace: "player",
    label: "Player Waters",
    navigation: [
      { href: "/player/library", label: "Library" },
      { href: "/player/history", label: "History", exact: true },
      { href: "/tales", label: "Browse Tall Tales", exact: true },
      { href: "/player/settings", label: "Settings", exact: true },
    ],
  },
  captain: {
    workspace: "captain",
    label: "Captain's Command",
    navigation: [
      { href: "/captain/library", label: "Library" },
      { href: "/captain/sessions", label: "Active Sessions", exact: true },
      { href: "/studio/library", label: "Captain Studio" },
      { href: "/captain/settings", label: "Settings", exact: true },
    ],
  },
  creator: {
    workspace: "creator",
    label: "Tall Tale Studio",
    navigation: [
      { href: "/studio/library", label: "Library" },
      { href: "/studio/tales/new", label: "New Tall Tale" },
      { href: "/captain/library", label: "Captain Workspace" },
      { href: "/studio/settings", label: "Settings", exact: true },
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
    queueMicrotask(() => {
      setMenuOpen(false);
      window.setTimeout(() => document.getElementById("main-content")?.focus({ preventScroll: true }), 40);
    });
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

  if (isImmersiveRoute(pathname)) return children;

  const definition = shellDefinitions[getWorkspace(pathname)];
  const breadcrumbs = breadcrumbTrail(pathname);
  return (
    <div className={`product-shell workspace-${definition.workspace}`}>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <header className="product-shell-header">
        <Link className="product-mark" href="/" aria-label="Forever Treasure role gateway">
          <span aria-hidden="true">✦</span>
          <span>
            <strong>Forever Treasure</strong>
            <small>{definition.label}</small>
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
              <Link key={item.href} href={item.href} aria-current={current ? "page" : undefined}>
                {item.label}
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
      {breadcrumbs.length > 1 && (
        <nav className="product-breadcrumbs" aria-label="Breadcrumb">
          <ol>
            {breadcrumbs.map((item, index) => (
              <li key={`${item.href ?? "current"}-${item.label}`}>
                {item.href && index < breadcrumbs.length - 1 ? (
                  <Link href={item.href}>{item.label}</Link>
                ) : (
                  <span aria-current={index === breadcrumbs.length - 1 ? "page" : undefined}>{item.label}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div className="product-shell-content" id="main-content" tabIndex={-1}>
        <AnimatePresence mode="wait">
          <motion.div
            className="product-route-transition"
            key={pathname}
            data-route-transition={routeFamily(pathname)}
            initial={shellRouteMotion(pathname, mode).initial}
            animate={shellRouteMotion(pathname, mode).enter}
            exit={shellRouteMotion(pathname, mode).exit}
            transition={shellRouteMotion(pathname, mode).transition}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </div>
      <footer className="product-footer">
        <p>Interactive Tall Tales for friends, families, groups, and celebrations.</p>
        <nav aria-label="Product links">
          <Link href="/">Role gateway</Link>
          <Link href="/tales">Explore Tall Tales</Link>
        </nav>
      </footer>
    </div>
  );
}

function breadcrumbTrail(pathname: string): Array<{ href?: string; label: string }> {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] === "studio" && parts[1] === "tales") {
    if (parts[2] === "new") return [{ href: "/studio/library", label: "Library" }, { label: "New Tall Tale" }];
    if (parts[2])
      return [
        { href: "/studio/library", label: "Library" },
        { href: `/studio/tales/${parts[2]}`, label: "Tall Tale" },
        ...(parts[3] ? [{ label: titleCase(parts[3]) }] : []),
      ];
  }
  if (parts[0] === "studio" && parts[1] === "vision-waypoints")
    return [
      { href: "/studio/library", label: "Library" },
      { href: "/studio/vision-waypoints", label: "Vision Waypoints" },
      ...(parts[2] ? [{ label: "Waypoint" }] : []),
    ];
  if (parts[0] === "captain" && parts[1] === "sessions" && parts[2])
    return [
      { href: "/captain/library", label: "Library" },
      { href: "/captain/sessions", label: "Active Sessions" },
      { label: "Session" },
    ];
  if (parts[0] === "captain" && parts[1] === "tales" && parts[2])
    return [{ href: "/captain/library", label: "Library" }, { label: "Tall Tale" }];
  if (parts[0] === "captain" && parts[1] === "voyages" && parts[2])
    return [
      { href: "/captain/library", label: "Library" },
      { label: parts[3] === "player-preview" ? "Player Preview" : "Voyage" },
    ];
  return [];
}

function titleCase(value: string) {
  return value.replaceAll("-", " ").replace(/\b\w/g, (character) => character.toLocaleUpperCase());
}

function routeFamily(pathname: string) {
  if (pathname.includes("settings")) return "settings";
  if (pathname.includes("library") || pathname === "/tales" || pathname.endsWith("/history")) return "library";
  if (pathname.startsWith("/studio")) return "studio";
  if (pathname.startsWith("/captain")) return "captain";
  return "page";
}

function shellRouteMotion(pathname: string, mode: "full" | "gentle" | "reduced") {
  if (mode === "reduced")
    return {
      initial: { opacity: 0 },
      enter: { opacity: 1 },
      exit: { opacity: 0 },
      transition: { duration: 0.08 },
    };
  const family = routeFamily(pathname);
  const duration = mode === "gentle" ? 0.28 : 0.48;
  const variants =
    family === "library"
      ? { initial: { opacity: 0, y: 18 }, enter: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -8 } }
      : family === "studio"
        ? { initial: { opacity: 0, scale: 0.99 }, enter: { opacity: 1, scale: 1 }, exit: { opacity: 0 } }
        : family === "captain"
          ? { initial: { opacity: 0, x: 20 }, enter: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -12 } }
          : family === "settings"
            ? { initial: { opacity: 0, y: 12 }, enter: { opacity: 1, y: 0 }, exit: { opacity: 0 } }
            : { initial: { opacity: 0 }, enter: { opacity: 1 }, exit: { opacity: 0 } };
  return { ...variants, transition: { duration, ease: [0.16, 1, 0.3, 1] as const } };
}
