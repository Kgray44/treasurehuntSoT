"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { useMotionMode } from "@/animation/motion/useMotionMode";
import { platformMotionEasing, resolvePlatformMotionToken } from "@/animation/platform/motion-tokens";
import { EmptyState, ErrorState, LoadingState, StatusBanner } from "@/components/ui/AsyncState";

type TaleCard = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  shortDescription: string | null;
  status: string;
  visibility: string;
  savedAt: string;
  validationState: string;
  latestVersion: string | null;
  sessionCount: number;
  assetCount: number;
};

export function StudioHome({ authenticated }: { authenticated: boolean }) {
  const { mode } = useMotionMode();
  const layoutMotion = resolvePlatformMotionToken("layout", mode);
  const [tales, setTales] = useState<TaleCard[]>([]);
  const [csrf, setCsrf] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("recent");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/studio/tales", { cache: "no-store" });
      const body = (await response.json()) as { tales?: TaleCard[]; csrfToken?: string; error?: string };
      if (!response.ok) setError(body.error ?? "The Studio library could not be opened.");
      else {
        setTales(body.tales ?? []);
        setCsrf(body.csrfToken ?? "");
      }
    } catch {
      setError("The Studio library could not be reached. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    queueMicrotask(() => void load());
  }, [authenticated, load]);

  const visible = useMemo(() => {
    const filtered = tales.filter((tale) =>
      `${tale.title} ${tale.subtitle ?? ""} ${tale.shortDescription ?? ""}`
        .toLocaleLowerCase()
        .includes(query.toLocaleLowerCase()),
    );
    return filtered.sort((left, right) =>
      sort === "title"
        ? left.title.localeCompare(right.title)
        : sort === "status"
          ? left.status.localeCompare(right.status)
          : Date.parse(right.savedAt) - Date.parse(left.savedAt),
    );
  }, [query, sort, tales]);

  async function act(tale: TaleCard, action: "duplicate" | "archive" | "restore") {
    if (
      (action === "archive" || action === "restore") &&
      !window.confirm(
        action === "archive"
          ? `Archive “${tale.title}”? Existing published editions and active voyages remain preserved.`
          : `Restore “${tale.title}” to the active Studio library?`,
      )
    )
      return;
    setBusy(tale.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/studio/tales/${tale.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
        body: JSON.stringify({ action }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) setError(body.error ?? "The Studio action failed.");
      else {
        setNotice(
          action === "duplicate"
            ? "A new editable Tall Tale copy was created."
            : action === "archive"
              ? "The Tall Tale was archived without changing published voyages."
              : "The Tall Tale was restored to the active library.",
        );
        await load();
      }
    } catch {
      setError("The Studio action could not be completed. Check your connection and try again.");
    } finally {
      setBusy("");
    }
  }

  if (!authenticated)
    return (
      <main className="studio-auth-gate">
        <section>
          <p className="eyebrow">Tall Tale Studio</p>
          <h1>The Cartographer&apos;s Table is locked.</h1>
          <p>Sign in through the Quartermaster&apos;s Log with a creator-capable account, then return here.</p>
          <Link className="brass-button" href="/quartermaster">
            Open Quartermaster login
          </Link>
        </section>
      </main>
    );

  return (
    <main className="studio-home">
      <header className="studio-home-header">
        <div>
          <p className="eyebrow">Authoring waters</p>
          <h1>Tall Tale Studio</h1>
          <p>Draft stories, bind their assets, and publish voyages from one authoritative chart.</p>
        </div>
        <nav aria-label="Studio destinations">
          <Link className="brass-button" href="/studio/tales/new">
            Create a Tall Tale
          </Link>
        </nav>
      </header>
      <AnimatePresence initial={false}>
        {notice && (
          <motion.div
            key="studio-notice"
            initial={mode === "reduced" ? false : { opacity: 0, y: layoutMotion.distancePx }}
            animate={{ opacity: 1, y: 0 }}
            exit={mode === "reduced" ? { opacity: 0 } : { opacity: 0, y: -layoutMotion.distancePx }}
            transition={{ duration: layoutMotion.durationSeconds, ease: platformMotionEasing("layout") }}
          >
            <StatusBanner tone="success">{notice}</StatusBanner>
          </motion.div>
        )}
        {error && tales.length > 0 && (
          <motion.div key="studio-error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <StatusBanner tone="danger">{error}</StatusBanner>
          </motion.div>
        )}
      </AnimatePresence>
      {!loading && tales.length > 0 && (
        <section className="studio-toolbar" aria-label="Find Tall Tales">
          <label>
            <span>Search</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Title, subtitle, or description"
            />
          </label>
          <label>
            <span>Sort</span>
            <select value={sort} onChange={(event) => setSort(event.target.value)}>
              <option value="recent">Last saved</option>
              <option value="title">Title</option>
              <option value="status">Status</option>
            </select>
          </label>
          <p aria-live="polite">
            {visible.length} {visible.length === 1 ? "tale" : "tales"}
          </p>
        </section>
      )}
      {loading ? (
        <LoadingState
          title="Opening the Studio library"
          detail="Loading drafts, published editions, and validation state."
        />
      ) : error && !tales.length ? (
        <ErrorState
          title="The Studio library could not be opened"
          detail={error}
          action={{ label: "Try Again", onClick: () => void load() }}
        />
      ) : !tales.length ? (
        <EmptyState
          title="Create the first Tall Tale"
          detail="Start with reusable story details, then add chapters, story moments, assets, and publication settings."
          action={{ label: "Create a Tall Tale", href: "/studio/tales/new" }}
        />
      ) : !visible.length ? (
        <EmptyState
          title="No Tall Tales match this search"
          detail="Clear the search to return to every draft and published edition."
          action={{ label: "Clear Search", onClick: () => setQuery("") }}
          symbol="⌕"
        />
      ) : (
        <LayoutGroup id="studio-library">
          <motion.section className="tale-card-grid" aria-label="Tall Tales" layout={mode !== "reduced"}>
            <AnimatePresence initial={false} mode="popLayout">
              {visible.map((tale) => (
                <motion.article
                  className={`tale-studio-card status-${tale.status.toLowerCase()}`}
                  key={tale.id}
                  layout={mode !== "reduced"}
                  layoutId={`studio-tale-${tale.id}`}
                  data-motion-state={busy === tale.id ? "pending" : "settled"}
                  initial={mode === "reduced" ? false : { opacity: 0, y: layoutMotion.distancePx }}
                  animate={{ opacity: busy === tale.id ? 0.62 : 1, y: 0 }}
                  exit={mode === "reduced" ? { opacity: 0 } : { opacity: 0, scale: 1 - layoutMotion.scaleDelta }}
                  transition={{ duration: layoutMotion.durationSeconds, ease: platformMotionEasing("layout") }}
                >
                  <div className="tale-card-stamp">{tale.status.replaceAll("_", " ")}</div>
                  <p className="card-kicker">
                    {tale.visibility.toLocaleLowerCase()} ·{" "}
                    {tale.latestVersion ? `version ${tale.latestVersion}` : "not published"}
                  </p>
                  <h2>{tale.title}</h2>
                  <p>{tale.subtitle ?? tale.shortDescription ?? "No summary has been inked yet."}</p>
                  <dl>
                    <div>
                      <dt>Last saved</dt>
                      <dd>{new Date(tale.savedAt).toLocaleString()}</dd>
                    </div>
                    <div>
                      <dt>Validation</dt>
                      <dd>{tale.validationState.toLocaleLowerCase()}</dd>
                    </div>
                    <div>
                      <dt>Library</dt>
                      <dd>{tale.assetCount} assets</dd>
                    </div>
                    <div>
                      <dt>Sessions</dt>
                      <dd>{tale.sessionCount}</dd>
                    </div>
                  </dl>
                  <div className="tale-card-actions">
                    <Link className="primary" href={`/studio/tales/${tale.id}`}>
                      Open editor
                    </Link>
                    {tale.latestVersion && (
                      <Link href={`/play/${tale.slug}`} target="_blank">
                        Player preview
                      </Link>
                    )}
                    <button
                      disabled={busy === tale.id}
                      aria-busy={busy === tale.id}
                      onClick={() => void act(tale, "duplicate")}
                    >
                      {busy === tale.id ? "Working…" : "Duplicate"}
                    </button>
                    <button
                      className={tale.status === "ARCHIVED" ? "button-secondary" : "button-subtle"}
                      disabled={busy === tale.id}
                      onClick={() => void act(tale, tale.status === "ARCHIVED" ? "restore" : "archive")}
                    >
                      {tale.status === "ARCHIVED" ? "Restore" : "Archive"}
                    </button>
                  </div>
                </motion.article>
              ))}
            </AnimatePresence>
          </motion.section>
        </LayoutGroup>
      )}
    </main>
  );
}
