"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { PersonalHarborDraftProvider, usePersonalHarbor } from "@/components/homeport/PersonalHarborLayout";
import type { PersonalHarborSectionId } from "@/homeport/personal-harbor-navigation";

const passportSections = [
  ["passport-home", "Passport", "/passport"],
  ["passport-history", "Your Voyages", "/passport/history"],
  ["passport-timeline", "Timeline", "/passport/timeline"],
  ["passport-people", "People", "/passport/people"],
  ["passport-statistics", "Statistics", "/passport/statistics"],
  ["passport-memories", "Memories", "/passport/memories"],
  ["passport-artifacts", "Artifacts", "/passport/artifacts"],
  ["passport-saved", "Saved", "/passport/saved"],
] as const satisfies ReadonlyArray<readonly [PersonalHarborSectionId, string, string]>;

const compatibilityAnchors: Record<string, string> = {
  profile: "/account/profile",
  preferences: "/account/preferences",
  privacy: "/account/privacy",
  providers: "/account/linked-identities",
  history: "/passport/history",
  artifacts: "/passport/artifacts",
  saved: "/passport/saved",
};

type PassportLayoutProps = {
  activeSection: PersonalHarborSectionId;
  eyebrow: string;
  title: string;
  description: string;
  csrfToken: string;
  children: ReactNode;
};

function PassportNavigation({
  activeSection,
  onNavigate,
}: {
  activeSection: PersonalHarborSectionId;
  onNavigate: (event: MouseEvent<HTMLAnchorElement>, href: string) => void;
}) {
  return (
    <nav className="passport-shell__navigation" aria-label="Chronicle Passport sections">
      <ul>
        {passportSections.map(([sectionId, label, href]) => (
          <li key={sectionId}>
            <Link
              href={href}
              aria-current={activeSection === sectionId ? "page" : undefined}
              onClick={(event) => onNavigate(event, href)}
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function PassportLayoutContent({
  activeSection,
  eyebrow,
  title,
  description,
  children,
}: Omit<PassportLayoutProps, "csrfToken">) {
  const pathname = usePathname();
  const router = useRouter();
  const { dirty, setDirty } = usePersonalHarbor();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [compatibilityTarget, setCompatibilityTarget] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const target = pathname === "/passport" ? compatibilityAnchors[window.location.hash.slice(1)] : undefined;
    if (!target) return;
    // The compatibility notice is intentionally visible before the scheduled route adapter runs.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCompatibilityTarget(target);
    const timer = window.setTimeout(() => router.replace(target), 0);
    return () => window.clearTimeout(timer);
  }, [pathname, router]);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);

  useEffect(() => {
    if (!pendingHref) return;
    const firstButton = dialogRef.current?.querySelector<HTMLButtonElement>("button");
    firstButton?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPendingHref(null);
        returnFocusRef.current?.focus();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const controls = [...dialogRef.current.querySelectorAll<HTMLElement>("button")];
      if (!controls.length) return;
      const index = controls.indexOf(document.activeElement as HTMLElement);
      event.preventDefault();
      controls[
        (event.shiftKey ? (index <= 0 ? controls.length - 1 : index - 1) : index + 1) % controls.length
      ]?.focus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pendingHref]);

  const navigate = useCallback(
    (event: MouseEvent<HTMLAnchorElement>, href: string) => {
      if (!dirty) return;
      event.preventDefault();
      returnFocusRef.current = event.currentTarget;
      setPendingHref(href);
    },
    [dirty],
  );

  const stay = () => {
    setPendingHref(null);
    window.setTimeout(() => returnFocusRef.current?.focus(), 0);
  };
  const discard = () => {
    const href = pendingHref;
    setDirty(false);
    setPendingHref(null);
    if (href) router.push(href);
  };

  return (
    <main className="passport-shell" data-passport-section={activeSection}>
      <header className="passport-shell__hero">
        <div className="passport-shell__masthead">
          <Link
            href="/account"
            className="passport-shell__harbor-link"
            onClick={(event) => navigate(event, "/account")}
          >
            <span aria-hidden="true">←</span> Personal Harbor
          </Link>
          <p className="personal-harbor__eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <PassportNavigation activeSection={activeSection} onNavigate={navigate} />
      </header>

      <section className="passport-shell__content" aria-label={`${title} content`}>
        {compatibilityTarget ? (
          <p className="passport-shell__notice" role="status">
            This Passport link is continuing to its current destination. If navigation does not continue,{" "}
            <Link href={compatibilityTarget}>open the destination</Link>.
          </p>
        ) : null}
        {children}
      </section>

      {pendingHref ? (
        <div className="personal-harbor__dialog-backdrop" role="presentation">
          <div
            ref={dialogRef}
            className="personal-harbor__dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="passport-unsaved-title"
            aria-describedby="passport-unsaved-description"
          >
            <p className="personal-harbor__eyebrow">Unsaved changes</p>
            <h2 id="passport-unsaved-title">Leave this section?</h2>
            <p id="passport-unsaved-description">
              Your changes have not been saved. Stay to keep editing, or discard them and continue.
            </p>
            <div className="personal-harbor__actions">
              <button type="button" className="button button--primary" onClick={stay}>
                Stay
              </button>
              <button type="button" className="button button--danger" onClick={discard}>
                Discard changes
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

export function PassportLayout({ csrfToken, ...props }: PassportLayoutProps) {
  return (
    <PersonalHarborDraftProvider csrfToken={csrfToken}>
      <PassportLayoutContent {...props} />
    </PersonalHarborDraftProvider>
  );
}
