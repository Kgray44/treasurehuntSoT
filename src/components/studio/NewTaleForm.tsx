"use client";

import styles from "./ChronicleAuthoring.module.css";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserUuid } from "@/lib/browser-uuid";
import { motion } from "motion/react";
import { useMotionMode } from "@/animation/motion/useMotionMode";
import { platformMotionEasing, resolvePlatformMotionToken } from "@/animation/platform/motion-tokens";

const choices = [
  {
    title: "Create Manually",
    icon: "quill",
    description: "Begin with a blank canvas. Shape your Chapters and Passages as inspiration strikes.",
    available: true,
  },
  {
    title: "Create with AI",
    icon: "stars",
    description: "Build alongside the future Chronicle Architect, from a first spark to a story worth sharing.",
    available: false,
  },
  {
    title: "Adapt a Story",
    icon: "book",
    description: "Bring an existing story or document into a new interactive adventure.",
    available: false,
  },
  {
    title: "Start from a Template",
    icon: "tiles",
    description: "Begin with a ready-made Chronicle structure and make it your own.",
    available: false,
  },
] as const;

function ChoiceIcon({ kind }: { kind: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {kind === "quill" ? (
        <>
          <path d="M7 25 24 8M8 24l2-9L24 4l4 4-11 14-9 2ZM18 10l4 4" />
          <path d="M5 28h15" />
        </>
      ) : kind === "stars" ? (
        <>
          <path d="m16 3 3.5 9.5L29 16l-9.5 3.5L16 29l-3.5-9.5L3 16l9.5-3.5L16 3Z" />
          <path d="M26 3v6M23 6h6" />
        </>
      ) : kind === "book" ? (
        <>
          <path d="M16 8v20M16 8C12 4 7 4 3 5v20c5-1 9 0 13 3 4-3 8-4 13-3V5c-4-1-9-1-13 3Z" />
          <path d="M7 11h5M20 11h5M7 16h5M20 16h5" />
        </>
      ) : (
        <>
          <rect x="4" y="4" width="10" height="10" rx="2" />
          <rect x="18" y="4" width="10" height="10" rx="2" />
          <rect x="4" y="18" width="10" height="10" rx="2" />
          <rect x="18" y="18" width="10" height="10" rx="2" />
        </>
      )}
    </svg>
  );
}

export function NewTaleForm({ authenticated }: { authenticated: boolean }) {
  const router = useRouter();
  const { mode } = useMotionMode();
  const routeMotion = resolvePlatformMotionToken("route", mode);
  const [csrf, setCsrf] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preparing, setPreparing] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const inFlight = useRef(false);
  const createdId = useRef<string | null>(null);
  const creationSlug = useRef<string | null>(null);
  useEffect(() => {
    if (!authenticated) return;
    let active = true;
    void fetch("/api/studio/tales")
      .then(async (response) => {
        const body = (await response.json()) as { csrfToken?: string; error?: string };
        if (!response.ok || !body.csrfToken) throw new Error(body.error ?? "Secure creation could not be prepared.");
        if (active) {
          setCsrf(body.csrfToken);
          setError("");
        }
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Check your connection and try again.");
      })
      .finally(() => {
        if (active) setPreparing(false);
      });
    return () => {
      active = false;
    };
  }, [authenticated, attempt]);

  async function createManually() {
    if (inFlight.current || !csrf) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      if (!createdId.current) {
        creationSlug.current ??= `chronicle-${createBrowserUuid()}`;
        const response = await fetch("/api/studio/tales", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
          body: JSON.stringify({ title: "Untitled Chronicle", slug: creationSlug.current }),
        });
        const body = (await response.json()) as { id?: string; error?: string };
        if (!response.ok || !body.id) throw new Error(body.error ?? "The Chronicle could not be created. Try again.");
        createdId.current = body.id;
      }
      router.push(`/studio/tales/${createdId.current}`);
    } catch (cause) {
      // Recover an acknowledged server save whose response was lost. Retrying
      // this same address also preserves the identity under unique-slug guards.
      if (creationSlug.current) {
        try {
          const response = await fetch("/api/studio/tales", { cache: "no-store" });
          const body = (await response.json()) as { tales?: Array<{ id: string; slug: string }> };
          const recovered = response.ok && body.tales?.find((tale) => tale.slug === creationSlug.current);
          if (recovered) {
            createdId.current = recovered.id;
            router.push(`/studio/tales/${recovered.id}`);
            return;
          }
        } catch {
          /* Keep the original error and offer the authorized Library. */
        }
      }
      setError(
        cause instanceof Error
          ? cause.message
          : "The connection was interrupted. Check your Studio library before trying again.",
      );
      setBusy(false);
      inFlight.current = false;
    }
  }

  if (!authenticated)
    return (
      <main className="studio-auth-gate">
        <section>
          <h1>Account sign-in required</h1>
          <Link className="brass-button" href="/sign-in?returnTo=%2Fstudio%2Ftales%2Fnew">
            Continue to account sign-in
          </Link>
        </section>
      </main>
    );
  return (
    <main className={`new-tale-page ${styles["chronicle-creation-page"]}`}>
      <motion.section
        className={styles["chronicle-creation-sheet"]}
        initial={mode === "reduced" ? false : { opacity: 0, y: routeMotion.distancePx }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: routeMotion.durationSeconds, ease: platformMotionEasing("route") }}
        aria-labelledby="chronicle-creation-title"
      >
        <Link className={styles["chronicle-creation-back"]} href="/studio/library">
          ← Your Chronicles
        </Link>
        <header>
          <p className="eyebrow">Voyagewright Studio · A new beginning</p>
          <h1 id="chronicle-creation-title">Create a Chronicle</h1>
          <p>
            Every great adventure begins with an idea.
            <br />
            How will yours begin?
          </p>
        </header>
        <div className={styles["chronicle-creation-choices"]} aria-label="Ways to create a Chronicle">
          {choices.map((choice) => (
            <button
              key={choice.title}
              type="button"
              className={styles["chronicle-creation-choice"]}
              disabled={!choice.available || busy || !csrf}
              aria-busy={choice.available && busy}
              onClick={choice.available ? () => void createManually() : undefined}
            >
              <span className={styles["chronicle-choice-icon"]}>
                <ChoiceIcon kind={choice.icon} />
              </span>
              <span className={styles["chronicle-choice-heading"]}>{choice.title}</span>
              <span className={styles["chronicle-choice-description"]}>{choice.description}</span>
              <span className={styles["chronicle-choice-footer"]}>
                {choice.available ? (busy ? "Opening your Chronicle…" : "Begin creating →") : "Coming soon"}
              </span>
            </button>
          ))}
        </div>
        <p className={styles["chronicle-creation-note"]}>
          Start with your story. Give it a title, cover, and other details whenever you’re ready in the editor.
        </p>
        <p role="status" aria-live="polite">
          {busy ? "Creating your draft and opening the editor…" : preparing ? "Preparing secure creation…" : ""}
        </p>
        {error && (
          <div className="studio-error" role="alert">
            <p>{error}</p>
            {!csrf && (
              <button
                type="button"
                onClick={() => {
                  setPreparing(true);
                  setAttempt((value) => value + 1);
                }}
              >
                Try again
              </button>
            )}
            <Link href="/studio/library">Open your Chronicles</Link>
          </div>
        )}
      </motion.section>
    </main>
  );
}
