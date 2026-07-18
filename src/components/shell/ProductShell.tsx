"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

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
      { href: "/tales", label: "Explore Tall Tales", exact: true },
      { href: "/player", label: "Player Library" },
      { href: "/captain", label: "Host a Voyage" },
      { href: "/studio", label: "Create" },
    ],
  },
  player: {
    workspace: "player",
    label: "Player Waters",
    navigation: [
      { href: "/player/library", label: "My Library" },
      { href: "/tales", label: "Explore Tall Tales", exact: true },
      { href: "/player/sign-in#invitation-code", label: "Join with a Code" },
      { href: "/", label: "Switch Role", exact: true },
    ],
  },
  captain: {
    workspace: "captain",
    label: "Captain's Command",
    navigation: [
      { href: "/captain/library", label: "Voyages" },
      { href: "/captain/invitations", label: "Invitations" },
      { href: "/tales", label: "Explore Tall Tales", exact: true },
      { href: "/studio/library", label: "Creator Workspace" },
    ],
  },
  creator: {
    workspace: "creator",
    label: "Tall Tale Studio",
    navigation: [
      { href: "/studio/library", label: "Studio Library" },
      { href: "/studio/tales/new", label: "New Tall Tale" },
      { href: "/tales", label: "Player Preview", exact: true },
      { href: "/captain/library", label: "Captain Workspace" },
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

  if (isImmersiveRoute(pathname)) return children;

  const definition = shellDefinitions[getWorkspace(pathname)];
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
      <div className="product-shell-content" id="main-content" tabIndex={-1}>
        {children}
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
