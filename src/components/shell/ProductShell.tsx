"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { useMotionMode } from "@/animation/motion/useMotionMode";
import { platformMotionEasing, resolvePlatformMotionToken } from "@/animation/platform/motion-tokens";
import { RouteMotionBoundary } from "@/animation/platform/RouteMotionBoundary";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { useCurrentUser } from "@/components/auth/CurrentUserProvider";
import { canonicalTerms } from "@/language/canonical-terms";
import {
  classifyRoute,
  projectWorkspaceNavigation,
  resolveActiveWorkspaceItem,
  workspaceRegistry,
  type ShellContext,
} from "@/navigation";

function ShellBrand({ label, compact = false }: { label: string; compact?: boolean }) {
  return (
    <Link className="product-mark" href="/" aria-label="Voyagewright home">
      <span aria-hidden="true">✦</span>
      <span>
        <strong>{canonicalTerms.product}</strong>
        <small>{compact ? "Active Voyage" : label}</small>
      </span>
    </Link>
  );
}

export function ProductShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const route = classifyRoute(pathname);
  const workspace = workspaceRegistry[route.workspace];
  const { mode } = useMotionMode();
  const { state: currentUser, refresh: refreshCurrentUser } = useCurrentUser();
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const profileButtonRef = useRef<HTMLButtonElement>(null);
  const workspaceNavigationRef = useRef<HTMLElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const previousPathnameRef = useRef(pathname);
  const context: ShellContext | null =
    currentUser.status === "authenticated"
      ? {
          authenticated: true,
          canUsePlayer: currentUser.capabilities.canUsePlayer,
          canUseCaptain: currentUser.capabilities.canUseCaptain,
          canUseCreator: currentUser.capabilities.canUseCreator,
          isAdministrator: currentUser.capabilities.isAdministrator,
          profile: {
            displayName: currentUser.user.displayName,
            initials: currentUser.user.initials,
            ...(currentUser.user.handle ? { handle: currentUser.user.handle } : {}),
          },
        }
      : currentUser.status === "loading"
        ? null
        : {
            authenticated: false,
            canUsePlayer: false,
            canUseCaptain: false,
            canUseCreator: false,
            isAdministrator: false,
            profile: null,
          };
  const navigationCapabilities = context ?? {
    authenticated: false,
    canUsePlayer: false,
    canUseCaptain: false,
    canUseCreator: false,
    isAdministrator: false,
  };
  const items = projectWorkspaceNavigation(route.workspace, navigationCapabilities, route.shellMode);
  const activeItem = resolveActiveWorkspaceItem(pathname, items);
  const micro = resolvePlatformMotionToken("micro", mode);
  const compact = route.shellMode === "compact" || route.shellMode === "immersive-player";

  const closeWorkspaceMenu = useCallback(
    (restoreFocus = false) => {
      setWorkspaceMenuOpen(false);
      if (restoreFocus) queueMicrotask(() => menuButtonRef.current?.focus());
    },
    [setWorkspaceMenuOpen],
  );
  const closeProfileMenu = useCallback(
    (restoreFocus = false) => {
      setProfileMenuOpen(false);
      if (restoreFocus) queueMicrotask(() => profileButtonRef.current?.focus());
    },
    [setProfileMenuOpen],
  );

  useEffect(() => {
    if (previousPathnameRef.current === pathname) return;
    previousPathnameRef.current = pathname;
    setWorkspaceMenuOpen(false);
    setProfileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!workspaceMenuOpen && !profileMenuOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (profileMenuOpen) closeProfileMenu(true);
      else closeWorkspaceMenu(true);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [closeProfileMenu, closeWorkspaceMenu, profileMenuOpen, workspaceMenuOpen]);

  useEffect(() => {
    if (!workspaceMenuOpen) return;
    queueMicrotask(() => workspaceNavigationRef.current?.querySelector<HTMLAnchorElement>("a")?.focus());
  }, [workspaceMenuOpen]);

  useEffect(() => {
    if (!profileMenuOpen) return;
    queueMicrotask(() => profileMenuRef.current?.querySelector<HTMLElement>("a, button")?.focus());
  }, [profileMenuOpen]);

  if (route.shellMode === "gateway") return <RouteMotionBoundary pathname={pathname}>{children}</RouteMotionBoundary>;

  const profileLabel =
    context?.profile?.displayName ?? (currentUser.status === "unavailable" ? "Account unavailable" : "Account");
  const profileInitials = context?.profile?.initials ?? "…";
  const signInHref = `/sign-in?returnTo=${encodeURIComponent(pathname)}`;
  const showWorkspaceMenu = route.shellMode !== "authentication" && items.length > 0;

  return (
    <div className={`product-shell workspace-${route.workspace} shell-mode-${route.shellMode}`}>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <header className="product-shell-header">
        <ShellBrand label={workspace.label} compact={compact} />
        {showWorkspaceMenu && (
          <>
            <button
              ref={menuButtonRef}
              className="product-menu-button"
              type="button"
              aria-label={workspaceMenuOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={workspaceMenuOpen}
              aria-controls="product-navigation"
              onClick={() => {
                setWorkspaceMenuOpen((open) => !open);
                setProfileMenuOpen(false);
              }}
            >
              <span aria-hidden="true">{workspaceMenuOpen ? "×" : "☰"}</span>
              <span>{workspaceMenuOpen ? "Close" : "Menu"}</span>
            </button>
            <nav
              ref={workspaceNavigationRef}
              id="product-navigation"
              className="product-navigation"
              aria-label={`${workspace.label} navigation`}
            >
              {items.map((item) => {
                const current = activeItem?.id === item.id;
                return (
                  <Link
                    key={item.id}
                    className={current ? "current" : undefined}
                    href={item.href}
                    aria-current={current ? "page" : undefined}
                  >
                    {current && (
                      <motion.i
                        className="product-navigation-active-plate"
                        layoutId={`product-navigation-active-${route.workspace}`}
                        transition={{ duration: micro.durationSeconds, ease: platformMotionEasing("micro") }}
                        aria-hidden="true"
                      />
                    )}
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </>
        )}
        {route.shellMode === "authentication" ? (
          <Link className="shell-sign-in" href="/">
            Return to Voyagewright
          </Link>
        ) : null}
        {route.shellMode !== "authentication" && (
          <div className="shell-profile-region">
            <button
              ref={profileButtonRef}
              className="shell-profile-trigger"
              type="button"
              aria-label={profileLabel}
              aria-expanded={profileMenuOpen}
              aria-controls="shell-profile-menu"
              onClick={() => {
                setProfileMenuOpen((open) => !open);
                setWorkspaceMenuOpen(false);
              }}
            >
              <span className="shell-avatar" aria-hidden="true">
                {profileInitials}
              </span>
              <span className="shell-profile-name">{profileLabel}</span>
              <span className="shell-profile-caret" aria-hidden="true">
                ▾
              </span>
            </button>
            <div ref={profileMenuRef} id="shell-profile-menu" className="shell-profile-menu" hidden={!profileMenuOpen}>
              {context?.authenticated && context.profile ? (
                <>
                  <p className="shell-profile-summary">
                    <b>{context.profile.displayName}</b>
                    {context.profile.handle ? <small>@{context.profile.handle}</small> : null}
                  </p>
                  <Link href="/passport">Chronicle Passport</Link>
                  <Link href="/account/security">Security</Link>
                  {(context.canUseCaptain || context.canUseCreator) && <hr />}
                  {context.canUsePlayer && route.workspace !== "player" && (
                    <Link href="/player/library">Player workspace</Link>
                  )}
                  {context.canUseCaptain && route.workspace !== "captain" && (
                    <Link href="/captain/library">Captain workspace</Link>
                  )}
                  {context.canUseCreator && route.workspace !== "creator" && (
                    <Link href="/studio/library">Creator workspace</Link>
                  )}
                  <hr />
                  <SignOutButton />
                </>
              ) : currentUser.status === "unavailable" ? (
                <>
                  <p className="shell-profile-summary" role="alert">
                    <b>Account service unavailable</b>
                    <small>No identity or workspace permission was assumed.</small>
                  </p>
                  <button type="button" onClick={() => void refreshCurrentUser()}>
                    Retry account check
                  </button>
                </>
              ) : currentUser.status === "loading" ? (
                <p className="shell-profile-summary" role="status">
                  <b>Checking account…</b>
                  <small>Workspace access will appear after the server responds.</small>
                </p>
              ) : (
                <>
                  <p className="shell-profile-summary">
                    <b>Welcome aboard</b>
                    <small>Sign in to reach your profile and workspaces.</small>
                  </p>
                  <Link href={signInHref}>Sign in</Link>
                  <Link href="/register">Create Account</Link>
                  <Link href="/">Choose a workspace</Link>
                </>
              )}
            </div>
          </div>
        )}
        {(workspaceMenuOpen || profileMenuOpen) && (
          <button
            className="product-menu-backdrop"
            type="button"
            aria-label="Close open menu"
            onClick={() => {
              if (profileMenuOpen) closeProfileMenu(true);
              else closeWorkspaceMenu(true);
            }}
          />
        )}
      </header>
      <div className="product-shell-content" id="main-content" tabIndex={-1}>
        <RouteMotionBoundary pathname={pathname}>{children}</RouteMotionBoundary>
      </div>
      {route.shellMode !== "compact" &&
        route.shellMode !== "immersive-player" &&
        route.shellMode !== "authentication" && (
          <footer className="product-footer">
            <p>Stories made to be played.</p>
            <nav aria-label="Product links">
              <Link href="/">Choose a workspace</Link>
              <Link href="/tales">Explore Chronicles</Link>
            </nav>
          </footer>
        )}
    </div>
  );
}
