"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { useMotionMode } from "@/animation/motion/useMotionMode";
import { platformMotionEasing, resolvePlatformMotionToken } from "@/animation/platform/motion-tokens";
import { RouteMotionBoundary } from "@/animation/platform/RouteMotionBoundary";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { useCurrentUser } from "@/components/auth/CurrentUserProvider";
import { canonicalTerms } from "@/language/canonical-terms";
import {
  classifyRoute,
  projectNavigation,
  workspaceRegistry,
  type AccountGroup,
  type ProjectedNavigationItem,
} from "@/navigation";

function ShellBrand({ label, compact = false }: { label: string; compact?: boolean }) {
  return (
    <Link className="product-mark" href="/" aria-label="Voyagewright home" data-navigation-id="brand-home">
      <span aria-hidden="true">✦</span>
      <span>
        <strong>{canonicalTerms.product}</strong>
        <small>{compact ? label : "Stories made to be played"}</small>
      </span>
    </Link>
  );
}

function NavigationLinks({
  items,
  activeId,
  motionKey,
  onNavigate,
}: {
  items: readonly ProjectedNavigationItem[];
  activeId?: string;
  motionKey: string;
  onNavigate: () => void;
}) {
  const { mode } = useMotionMode();
  const micro = resolvePlatformMotionToken("micro", mode);
  return items.map((item) => {
    if (!item.href) return null;
    const current = activeId === item.id;
    return (
      <Link
        key={item.id}
        className={current ? "current" : undefined}
        href={item.href}
        aria-current={current ? "page" : undefined}
        data-navigation-id={item.id}
        onClick={onNavigate}
      >
        {current ? (
          <motion.i
            className="product-navigation-active-plate"
            layoutId={`product-navigation-active-${motionKey}`}
            transition={{ duration: micro.durationSeconds, ease: platformMotionEasing("micro") }}
            aria-hidden="true"
          />
        ) : null}
        <span>{item.label}</span>
      </Link>
    );
  });
}

function accountStatusLabel(status: ReturnType<typeof useCurrentUser>["state"]["status"]) {
  switch (status) {
    case "loading":
      return "Checking account";
    case "unavailable":
      return "Account unavailable";
    case "restricted":
      return "Account restricted";
    case "expired":
    case "revoked":
    case "invalid":
      return "Session ended";
    default:
      return "Account";
  }
}

const accountGroupLabels: Readonly<Record<AccountGroup, string>> = {
  identity: "Identity",
  personal: "Personal Harbor",
  workspace: "Workspaces",
  action: "Account actions",
};

export function ProductShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const route = classifyRoute(pathname);
  const workspace = workspaceRegistry[route.workspace];
  const { state: currentUser, refresh: refreshCurrentUser } = useCurrentUser();
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const navigationButtonRef = useRef<HTMLButtonElement>(null);
  const accountButtonRef = useRef<HTMLButtonElement>(null);
  const navigationDrawerRef = useRef<HTMLDivElement>(null);
  const accountDisclosureRef = useRef<HTMLDivElement>(null);
  const mainContentRef = useRef<HTMLDivElement>(null);
  const previousPathnameRef = useRef(pathname);
  const accountHeadingPrefix = useId();
  const compact = route.shellMode === "COMPACT" || route.shellMode === "IMMERSIVE";
  const ordinaryNavigation = ["GATEWAY_STANDARD", "PUBLIC_STANDARD", "WORKSPACE_STANDARD"].includes(route.shellMode);
  const accountControl = ["GATEWAY_STANDARD", "PUBLIC_STANDARD", "WORKSPACE_STANDARD", "COMPACT", "IMMERSIVE"].includes(
    route.shellMode,
  );
  const projection = projectNavigation({
    pathname,
    shellMode: route.shellMode,
    currentUser,
    workspace: route.workspace,
    presentation: "desktop",
  });
  const mobileProjection = projectNavigation({
    pathname,
    shellMode: route.shellMode,
    currentUser,
    workspace: route.workspace,
    presentation: "mobile",
  });
  const closeAll = useCallback(() => {
    setNavigationOpen(false);
    setAccountOpen(false);
  }, []);
  const closeNavigation = useCallback((restoreFocus = false) => {
    setNavigationOpen(false);
    if (restoreFocus) queueMicrotask(() => navigationButtonRef.current?.focus());
  }, []);
  const closeAccount = useCallback((restoreFocus = false) => {
    setAccountOpen(false);
    if (restoreFocus) queueMicrotask(() => accountButtonRef.current?.focus());
  }, []);

  useLayoutEffect(() => {
    if (previousPathnameRef.current === pathname) return;
    previousPathnameRef.current = pathname;
    closeAll();
    const frame = window.requestAnimationFrame(() => {
      const destinationHeading = mainContentRef.current?.querySelector<HTMLElement>("h1");
      if (destinationHeading) {
        destinationHeading.tabIndex = -1;
        destinationHeading.focus();
      } else mainContentRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [closeAll, pathname]);

  useEffect(() => {
    if (!navigationOpen && !accountOpen) return;
    const previousOverflow = document.body.style.overflow;
    const mainContent = mainContentRef.current;
    document.body.style.overflow = "hidden";
    document.body.dataset.shellOverlay = "open";
    if (mainContent) mainContent.inert = true;
    return () => {
      document.body.style.overflow = previousOverflow;
      delete document.body.dataset.shellOverlay;
      if (mainContent) mainContent.inert = false;
    };
  }, [accountOpen, navigationOpen]);

  useEffect(() => {
    if (!navigationOpen && !accountOpen) return;
    const handleOverlayKeyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (accountOpen) closeAccount(true);
        else closeNavigation(true);
        return;
      }
      if (event.key !== "Tab") return;
      const panel = accountOpen ? accountDisclosureRef.current : navigationDrawerRef.current;
      if (!panel) return;
      const controls = [...panel.querySelectorAll<HTMLElement>("a[href], button:not(:disabled), [tabindex]")].filter(
        (control) => control.tabIndex >= 0 && !control.hasAttribute("hidden"),
      );
      if (!controls.length) return;
      const first = controls[0];
      const last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    window.addEventListener("keydown", handleOverlayKeyboard);
    return () => window.removeEventListener("keydown", handleOverlayKeyboard);
  }, [accountOpen, closeAccount, closeNavigation, navigationOpen]);

  useEffect(() => {
    if (!navigationOpen && !accountOpen) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return;
      if (
        accountOpen &&
        !accountButtonRef.current?.contains(event.target) &&
        !accountDisclosureRef.current?.contains(event.target)
      )
        closeAccount();
      if (
        navigationOpen &&
        !navigationButtonRef.current?.contains(event.target) &&
        !navigationDrawerRef.current?.contains(event.target)
      )
        closeNavigation();
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [accountOpen, closeAccount, closeNavigation, navigationOpen]);

  useEffect(() => {
    if (navigationOpen)
      queueMicrotask(() => navigationDrawerRef.current?.querySelector<HTMLAnchorElement>("a")?.focus());
  }, [navigationOpen]);

  useEffect(() => {
    if (accountOpen)
      queueMicrotask(() => accountDisclosureRef.current?.querySelector<HTMLElement>("a, button")?.focus());
  }, [accountOpen]);

  const profileLabel =
    currentUser.status === "authenticated" ? currentUser.user.displayName : accountStatusLabel(currentUser.status);
  const profileInitials =
    currentUser.status === "authenticated" ? currentUser.user.initials : currentUser.status === "loading" ? "…" : "V";
  const activeAccountId = projection.activeAccountItem?.id;
  const accountGroups = (["identity", "personal", "workspace", "action"] as const).map((group) => ({
    group,
    items: projection.accountItems.filter((item) => item.accountGroup === group),
  }));

  return (
    <div
      className={`product-shell workspace-${route.workspace} shell-mode-${route.shellMode}`}
      data-shell-mode={route.shellMode}
      data-workspace={route.workspace}
      data-functional-destination-count={mobileProjection.functionalDestinationIds.length}
    >
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <header className="product-shell-header">
        <ShellBrand label={workspace.label} compact={compact} />

        {ordinaryNavigation ? (
          <button
            ref={navigationButtonRef}
            className="product-menu-button"
            type="button"
            aria-label={navigationOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={navigationOpen}
            aria-controls="product-navigation-drawer"
            onClick={() => {
              setNavigationOpen((open) => !open);
              setAccountOpen(false);
            }}
          >
            <span aria-hidden="true">{navigationOpen ? "×" : "☰"}</span>
            <span>{navigationOpen ? "Close" : "Navigate"}</span>
          </button>
        ) : null}

        {ordinaryNavigation ? (
          <div
            ref={navigationDrawerRef}
            id="product-navigation-drawer"
            className="product-navigation-drawer"
            data-open={navigationOpen ? "true" : "false"}
            role={navigationOpen ? "dialog" : undefined}
            aria-modal={navigationOpen || undefined}
            aria-label={navigationOpen ? "Product navigation" : undefined}
          >
            <nav className="product-navigation global-navigation" aria-label="Global navigation">
              <NavigationLinks
                items={projection.globalItems}
                activeId={projection.activeGlobalItem?.id}
                motionKey="global"
                onNavigate={closeAll}
              />
            </nav>
            {projection.workspaceItems.length ? (
              <nav className="product-navigation workspace-navigation" aria-label={`${workspace.label} navigation`}>
                <span className="navigation-label">{workspace.label}</span>
                <NavigationLinks
                  items={projection.workspaceItems}
                  activeId={projection.activeWorkspaceItem?.id}
                  motionKey={route.workspace}
                  onNavigate={closeAll}
                />
              </nav>
            ) : null}
          </div>
        ) : null}

        {!ordinaryNavigation ? (
          <div className="shell-purpose">
            <span>{route.shellMode === "DEVELOPMENT" ? "Development tool" : workspace.label}</span>
            {route.exitTarget ? (
              <Link href={route.exitTarget} onClick={closeAll} data-navigation-id="shell-safe-return">
                {route.shellMode === "AUTHENTICATION" || route.shellMode === "TOKENIZED" ? "Safe return" : "Return"}
              </Link>
            ) : null}
          </div>
        ) : null}

        {accountControl ? (
          <div className="shell-profile-region">
            <button
              ref={accountButtonRef}
              className="shell-profile-trigger"
              type="button"
              aria-label={profileLabel}
              aria-expanded={accountOpen}
              aria-controls="shell-account-disclosure"
              onClick={() => {
                setAccountOpen((open) => !open);
                setNavigationOpen(false);
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
            <div
              ref={accountDisclosureRef}
              id="shell-account-disclosure"
              className="shell-account-disclosure"
              hidden={!accountOpen}
              role={accountOpen ? "dialog" : undefined}
              aria-modal={accountOpen || undefined}
              aria-label="Account navigation"
            >
              {currentUser.status === "authenticated" ? (
                <div className="account-identity-summary">
                  <span className="shell-avatar" aria-hidden="true">
                    {currentUser.user.initials}
                  </span>
                  <p>
                    <b>{currentUser.user.displayName}</b>
                    {currentUser.user.handle ? (
                      <small>@{currentUser.user.handle}</small>
                    ) : (
                      <small>Private profile</small>
                    )}
                  </p>
                </div>
              ) : null}

              {currentUser.status === "loading" ? (
                <div className="account-state-panel" role="status">
                  <b>Checking your account…</b>
                  <p>Navigation will appear after the server confirms the current account.</p>
                </div>
              ) : currentUser.status === "unavailable" ? (
                <div className="account-state-panel" role="alert">
                  <b>Account context is unavailable</b>
                  <p>No identity or workspace permission was assumed.</p>
                  <button type="button" onClick={() => void refreshCurrentUser()}>
                    Retry account check
                  </button>
                </div>
              ) : currentUser.status === "restricted" ? (
                <div className="account-state-panel" role="alert">
                  <b>Account access is restricted</b>
                  <p>Workspace navigation is unavailable. Use the account recovery guidance for this status.</p>
                </div>
              ) : (
                <>
                  {currentUser.status === "expired" ||
                  currentUser.status === "revoked" ||
                  currentUser.status === "invalid" ? (
                    <p className="account-session-ended" role="status">
                      Your previous session ended. Sign in again to continue safely.
                    </p>
                  ) : null}
                  {accountGroups.map(({ group, items }) => {
                    if (!items.length) return null;
                    const headingId = `${accountHeadingPrefix}-${group}`;
                    return (
                      <section
                        key={group}
                        className={`account-group account-group-${group}`}
                        aria-labelledby={headingId}
                      >
                        <h2 id={headingId}>{accountGroupLabels[group]}</h2>
                        <nav aria-label={accountGroupLabels[group]}>
                          {items.map((item) => {
                            if (item.action === "sign-out")
                              return (
                                <div key={item.id} className="account-sign-out" data-navigation-id={item.id}>
                                  <SignOutButton />
                                </div>
                              );
                            if (!item.href) return null;
                            const current = activeAccountId === item.id;
                            const currentWorkspace =
                              item.accountGroup === "workspace" && item.id === `account-workspace-${route.workspace}`;
                            return (
                              <Link
                                key={item.id}
                                href={item.href}
                                data-navigation-id={item.id}
                                aria-current={current ? "page" : undefined}
                                onClick={closeAll}
                              >
                                <span>{item.label}</span>
                                {currentWorkspace ? <small>Current</small> : null}
                              </Link>
                            );
                          })}
                        </nav>
                      </section>
                    );
                  })}
                </>
              )}
            </div>
          </div>
        ) : null}

        {(navigationOpen || accountOpen) && (
          <button
            className="product-menu-backdrop"
            type="button"
            aria-label="Close open navigation"
            onClick={() => {
              if (accountOpen) closeAccount(true);
              else closeNavigation(true);
            }}
          />
        )}
      </header>

      {projection.contextualItems.length ? (
        <nav className="shell-contextual-navigation" aria-label="Contextual navigation">
          <span>{compact ? workspace.label : "Current area"}</span>
          <NavigationLinks items={projection.contextualItems} motionKey="contextual" onNavigate={closeAll} />
        </nav>
      ) : null}

      <div ref={mainContentRef} className="product-shell-content" id="main-content" tabIndex={-1}>
        <RouteMotionBoundary pathname={pathname}>{children}</RouteMotionBoundary>
      </div>

      {route.shellMode === "PUBLIC_STANDARD" || route.shellMode === "WORKSPACE_STANDARD" ? (
        <footer className="product-footer">
          <p>
            <b>Voyagewright</b> · Stories made to be played.
          </p>
          <Link href="/" data-navigation-id="footer-home">
            Return Home
          </Link>
        </footer>
      ) : null}
    </div>
  );
}
