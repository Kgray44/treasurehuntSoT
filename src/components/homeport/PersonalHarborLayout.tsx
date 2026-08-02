"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import {
  personalHarborNavigation,
  type PersonalHarborSectionId,
} from "@/homeport/personal-harbor-navigation";

type DraftState = {
  dirty: boolean;
  setDirty: (dirty: boolean) => void;
  csrfToken: string;
};

const PersonalHarborContext = createContext<DraftState | null>(null);

export function usePersonalHarbor() {
  const value = useContext(PersonalHarborContext);
  if (!value) throw new Error("usePersonalHarbor must be used inside PersonalHarborLayout.");
  return value;
}

const compatibilityAnchors: Record<string, string> = {
  profile: "/account/profile",
  preferences: "/account/preferences",
  privacy: "/account/privacy",
  providers: "/account/linked-identities",
  history: "/passport/history",
  artifacts: "/passport/artifacts",
  saved: "/passport/saved",
};

function HarborNavigation({
  activeSection,
  onNavigate,
}: {
  activeSection: PersonalHarborSectionId;
  onNavigate: (event: MouseEvent<HTMLAnchorElement>, href: string) => void;
}) {
  return (
    <nav aria-label="Personal Harbor sections" className="personal-harbor__navigation">
      {personalHarborNavigation.map((group) => (
        <section key={group.label} className="personal-harbor__nav-group" aria-labelledby={`harbor-group-${group.label.replaceAll(" ", "-")}`}>
          <h2 id={`harbor-group-${group.label.replaceAll(" ", "-")}`}>{group.label}</h2>
          <ul>
            {group.items.map(([sectionId, label, href]) => (
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
        </section>
      ))}
    </nav>
  );
}

export function PersonalHarborLayout({
  activeSection,
  eyebrow,
  title,
  description,
  csrfToken,
  children,
}: {
  activeSection: PersonalHarborSectionId;
  eyebrow: string;
  title: string;
  description: string;
  csrfToken: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [dirty, setDirty] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [compatibilityTarget, setCompatibilityTarget] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    const target = compatibilityAnchors[hash];
    if (pathname === "/passport" && target) {
      setCompatibilityTarget(target);
      const redirectTimer = window.setTimeout(() => router.replace(target), 0);
      return () => window.clearTimeout(redirectTimer);
    }
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
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const controls = [...dialogRef.current.querySelectorAll<HTMLElement>("button")];
      if (!controls.length) return;
      const index = controls.indexOf(document.activeElement as HTMLElement);
      const next = event.shiftKey ? (index <= 0 ? controls.length - 1 : index - 1) : (index + 1) % controls.length;
      event.preventDefault();
      controls[next]?.focus();
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
    <PersonalHarborContext.Provider value={{ dirty, setDirty, csrfToken }}>
      <main className="personal-harbor" data-homeport-section={activeSection}>
        <header className="personal-harbor__hero">
          <div>
            <p className="personal-harbor__eyebrow">{eyebrow}</p>
            <h1>{title}</h1>
            <p>{description}</p>
          </div>
          <Link href="/" className="personal-harbor__return">
            Return to Home
          </Link>
        </header>

        <details className="personal-harbor__mobile-sections">
          <summary>Personal Harbor sections</summary>
          <HarborNavigation activeSection={activeSection} onNavigate={navigate} />
        </details>

        <div className="personal-harbor__grid">
          <aside className="personal-harbor__rail">
            <HarborNavigation activeSection={activeSection} onNavigate={navigate} />
          </aside>
          <section className="personal-harbor__content" aria-label={`${title} content`}>
            {compatibilityTarget && (
              <p className="harbor-callout" role="status">
                This older Passport link now has a dedicated Personal Harbor section. If navigation does not continue,
                {" "}<Link href={compatibilityTarget}>open the new destination</Link>.
              </p>
            )}
            {children}
          </section>
        </div>
      </main>

      {pendingHref && (
        <div className="personal-harbor__dialog-backdrop" role="presentation">
          <div
            ref={dialogRef}
            className="personal-harbor__dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="unsaved-title"
            aria-describedby="unsaved-description"
          >
            <p className="personal-harbor__eyebrow">Unsaved changes</p>
            <h2 id="unsaved-title">Leave this section?</h2>
            <p id="unsaved-description">Your changes have not been saved. Stay to keep editing, or discard them and continue.</p>
            <div className="personal-harbor__actions">
              <button type="button" className="button button--primary" onClick={stay}>Stay</button>
              <button type="button" className="button button--danger" onClick={discard}>Discard changes</button>
            </div>
          </div>
        </div>
      )}
    </PersonalHarborContext.Provider>
  );
}
