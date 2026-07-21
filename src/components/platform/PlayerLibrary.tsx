"use client";

/* eslint-disable @next/next/no-img-element -- Images are served by the version- and membership-authorized media route. */
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { useMotionMode } from "@/animation/motion/useMotionMode";
import { consumeOneShot, platformOneShotKey } from "@/animation/platform/one-shot";
import { reconcileVersionedRows } from "@/animation/platform/polling-delta";
import { platformMotionEasing, resolvePlatformMotionToken } from "@/animation/platform/motion-tokens";
import { EmptyState, ErrorState, LoadingState, StatusBanner } from "@/components/ui/AsyncState";
import { platformCopy } from "@/language/platform-copy";
import { playerCopy } from "@/language/player-copy";

export type PlayerLibraryCard = {
  id: string;
  title: string;
  subtitle: string | null;
  shortDescription: string | null;
  coverUrl: string | null;
  captainName: string;
  voyageName: string;
  state: string;
  status: string;
  pinned: boolean;
  versionLabel: string;
  completionDate: string | null;
  plannedStartAt: string | null;
  currentChapterTitle: string | null;
  revealedChapterCount: number;
  memoriesCollected: number;
  lastSynchronizedAt: string;
  primaryHref: string;
  primaryLabel: string;
};

type Library = {
  player: { displayName: string };
  groups: {
    invitations: PlayerLibraryCard[];
    awaitingCaptain: PlayerLibraryCard[];
    inProgress: PlayerLibraryCard[];
    completed: PlayerLibraryCard[];
    replayOrNewEdition: PlayerLibraryCard[];
    expiredOrRevoked: PlayerLibraryCard[];
  };
  total: number;
  serverTime: string;
  csrfToken: string;
};

type GroupKey = keyof Library["groups"];
type VersionedCard = { group: GroupKey; card: PlayerLibraryCard };
type PreferenceAction = "pin" | "unpin" | "hide" | "show";

const groupLabels: Array<[GroupKey, string, string]> = [
  ["invitations", "Invitations", "Invitations awaiting your answer"],
  ["awaitingCaptain", playerCopy.awaitingCaptain.value, "Accepted Voyages preparing to begin"],
  ["inProgress", platformCopy.activeVoyages.value, "Voyages ready to continue"],
  ["completed", platformCopy.voyageHistory.value, "Preserved records of completed Voyages"],
  ["replayOrNewEdition", "New Voyages and editions", "Voyages explicitly offered to you"],
  ["expiredOrRevoked", "Closed Invitations", "Expired, declined, or revoked access"],
];

function flattenGroups(groups: Library["groups"]): VersionedCard[] {
  return groupLabels.flatMap(([group]) => groups[group].map((card) => ({ group, card })));
}

function rebuildGroups(rows: readonly VersionedCard[]): Library["groups"] {
  const groups = Object.fromEntries(groupLabels.map(([key]) => [key, []])) as unknown as Library["groups"];
  for (const row of rows) groups[row.group].push(row.card);
  return groups;
}

function semanticCardVersion(row: VersionedCard) {
  const card = row.card;
  return JSON.stringify([
    card.status,
    card.state,
    card.pinned,
    card.versionLabel,
    card.currentChapterTitle,
    card.revealedChapterCount,
    card.memoriesCollected,
    card.lastSynchronizedAt,
    card.primaryHref,
    card.primaryLabel,
  ]);
}

export function PlayerLibrary() {
  const { mode } = useMotionMode();
  const token = resolvePlatformMotionToken("layout", mode);
  const requestSequence = useRef(0);
  const activeLoad = useRef<AbortController | null>(null);
  const entranceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const libraryRef = useRef<Library | null>(null);
  const [library, setLibrary] = useState<Library | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [sort, setSort] = useState("RECENT");
  const [view, setView] = useState<"gallery" | "list">("gallery");
  const [busyCard, setBusyCard] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [enteringIds, setEnteringIds] = useState<ReadonlySet<string>>(new Set());
  const [changedIds, setChangedIds] = useState<ReadonlySet<string>>(new Set());
  const [newInvitationIds, setNewInvitationIds] = useState<ReadonlySet<string>>(new Set());
  const [collapsed, setCollapsed] = useState<ReadonlySet<GroupKey>>(new Set());
  const [hiddenUndo, setHiddenUndo] = useState<VersionedCard | null>(null);

  const markChanged = useCallback((ids: readonly string[], entrances: readonly string[] = []) => {
    if (!ids.length && !entrances.length) return;
    setChangedIds(new Set(ids));
    setEnteringIds(new Set(entrances));
    if (entranceTimer.current) clearTimeout(entranceTimer.current);
    entranceTimer.current = setTimeout(() => {
      setChangedIds(new Set());
      setEnteringIds(new Set());
    }, 900);
  }, []);

  const applyAuthoritativeLibrary = useCallback(
    (next: Library) => {
      const previous = libraryRef.current;
      const nextRows = flattenGroups(next.groups);
      if (!previous) {
        markChanged(
          nextRows.map((row) => row.card.id),
          nextRows.map((row) => row.card.id),
        );
        setNewInvitationIds(
          new Set(
            next.groups.invitations
              .filter((card) => consumeOneShot(platformOneShotKey("new-invitation", card.id, card.versionLabel)))
              .map((card) => card.id),
          ),
        );
        libraryRef.current = next;
        setLibrary(next);
        return;
      }
      const diff = reconcileVersionedRows({
        previous: flattenGroups(previous.groups),
        next: nextRows,
        previousVersion: requestSequence.current - 1,
        nextVersion: requestSequence.current,
        getId: (row) => row.card.id,
        getVersion: semanticCardVersion,
        getGroup: (row) => row.group,
      });
      if (diff.changed) {
        markChanged([...diff.addedIds, ...diff.changedIds], diff.addedIds);
        const badges = next.groups.invitations
          .filter((card) => diff.addedIds.includes(card.id))
          .filter((card) => consumeOneShot(platformOneShotKey("new-invitation", card.id, card.versionLabel)))
          .map((card) => card.id);
        if (badges.length) setNewInvitationIds((current) => new Set([...current, ...badges]));
      }
      const committed = { ...next, groups: diff.changed ? rebuildGroups(diff.rows) : previous.groups };
      libraryRef.current = committed;
      setLibrary(committed);
    },
    [markChanged],
  );

  const load = useCallback(
    async ({ quiet = false }: { quiet?: boolean } = {}) => {
      if (activeLoad.current) return;
      const controller = new AbortController();
      activeLoad.current = controller;
      if (!quiet) setError("");
      try {
        const response = await fetch("/api/player/library", { cache: "no-store", signal: controller.signal });
        const body = (await response.json()) as Library & { error?: string };
        if (!response.ok) {
          setConfirmed(false);
          setError(body.error ?? "Your Chronicle Library is unavailable.");
          return;
        }
        requestSequence.current += 1;
        applyAuthoritativeLibrary(body);
        setConfirmed(true);
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setConfirmed(false);
        setError("Your Chronicle Library could not be reached. Check your connection, then try again.");
      } finally {
        if (activeLoad.current === controller) activeLoad.current = null;
      }
    },
    [applyAuthoritativeLibrary],
  );

  useEffect(() => {
    queueMicrotask(() => void load());
    const timer = window.setInterval(() => {
      if (!document.hidden) void load({ quiet: true });
    }, 5_000);
    return () => {
      window.clearInterval(timer);
      activeLoad.current?.abort("unmounted");
      if (entranceTimer.current) clearTimeout(entranceTimer.current);
    };
  }, [load]);

  async function writePreference(card: PlayerLibraryCard, action: PreferenceAction) {
    if (!library) return false;
    const response = await fetch(`/api/player/playthroughs/${card.id}/preference`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-csrf-token": library.csrfToken },
      body: JSON.stringify({ action }),
    });
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) throw new Error(body.error ?? "The library preference could not be saved.");
    return true;
  }

  async function setPreference(card: PlayerLibraryCard, action: Exclude<PreferenceAction, "show">) {
    if (!library) return;
    if (action === "hide" && !window.confirm(`Hide “${card.title}” from your library?`)) return;
    setBusyCard(card.id);
    setError("");
    setNotice("");
    try {
      await writePreference(card, action);
      const current = libraryRef.current;
      if (!current) return;
      const rows = flattenGroups(current.groups);
      const hidden = rows.find((row) => row.card.id === card.id) ?? null;
      const nextRows = rows
        .filter((row) => action !== "hide" || row.card.id !== card.id)
        .map((row) => (row.card.id === card.id ? { ...row, card: { ...row.card, pinned: action === "pin" } } : row));
      const committed = {
        ...current,
        total: action === "hide" ? current.total - 1 : current.total,
        groups: rebuildGroups(nextRows),
      };
      libraryRef.current = committed;
      setLibrary(committed);
      markChanged([card.id]);
      if (action === "hide") setHiddenUndo(hidden);
      setNotice(
        action === "hide" ? "The Chronicle was hidden. Undo remains available." : "Your library preference was saved.",
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The library preference could not be saved.");
    } finally {
      setBusyCard("");
    }
  }

  async function undoHide() {
    if (!hiddenUndo || !library) return;
    setBusyCard(hiddenUndo.card.id);
    try {
      await writePreference(hiddenUndo.card, "show");
      const current = libraryRef.current;
      if (!current) return;
      const committed = {
        ...current,
        total: current.total + 1,
        groups: rebuildGroups([...flattenGroups(current.groups), hiddenUndo]),
      };
      libraryRef.current = committed;
      setLibrary(committed);
      setNotice("The Chronicle was restored to your library.");
      markChanged([hiddenUndo.card.id], [hiddenUndo.card.id]);
      setHiddenUndo(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The Chronicle could not be restored.");
    } finally {
      setBusyCard("");
    }
  }

  function toggleGroup(key: GroupKey, button: HTMLButtonElement) {
    const anchor = button.closest<HTMLElement>(".library-group");
    const top = anchor?.getBoundingClientRect().top;
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    window.requestAnimationFrame(() => {
      if (top === undefined || !anchor) return;
      const delta = anchor.getBoundingClientRect().top - top;
      if (delta && typeof window.scrollBy === "function") window.scrollBy({ top: delta });
      button.focus();
    });
  }

  const groups = useMemo(() => {
    if (!library) return [];
    const normalizedQuery = query.toLocaleLowerCase();
    return groupLabels
      .map(([key, label, description]) => {
        let cards = library.groups[key].filter((card) =>
          `${card.title} ${card.captainName} ${card.voyageName} ${card.completionDate?.slice(0, 4) ?? ""}`
            .toLocaleLowerCase()
            .includes(normalizedQuery),
        );
        if (filter !== "ALL" && key !== filter) cards = [];
        cards = [...cards].sort((left, right) => {
          if (left.pinned !== right.pinned) return left.pinned ? -1 : 1;
          return sort === "TITLE"
            ? left.title.localeCompare(right.title)
            : sort === "COMPLETED"
              ? (right.completionDate ?? "").localeCompare(left.completionDate ?? "")
              : right.lastSynchronizedAt.localeCompare(left.lastSynchronizedAt);
        });
        return { key, label, description, cards };
      })
      .filter((group) => group.cards.length);
  }, [filter, library, query, sort]);

  const resultCount = groups.reduce((total, group) => total + group.cards.length, 0);

  if (error && !library)
    return (
      <main className="player-library platform-loading">
        <ErrorState
          title="Your Chronicle Library could not be opened"
          detail={error}
          action={{ label: "Try Again", onClick: () => void load() }}
        />
      </main>
    );
  if (!library)
    return (
      <main className="player-library platform-loading">
        <LoadingState
          title={`Opening your ${platformCopy.chronicleLibrary.value}`}
          detail="Loading invitations, active Voyages, and Voyage History."
        />
      </main>
    );

  return (
    <motion.main
      className="player-library"
      data-motion-mode={mode}
      initial={{ opacity: 0, y: token.distancePx }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: token.durationSeconds, ease: platformMotionEasing("layout") }}
    >
      <header className="platform-header">
        <div>
          <p className="eyebrow">{library.player.displayName}’s collection</p>
          <h1>My Chronicle Library</h1>
          <p>Invitations, active Voyages, and the exact Chronicle versions you experienced.</p>
        </div>
        <div className="library-truth" data-confirmed={confirmed}>
          <i />
          <span>{confirmed ? "Server confirmed" : "Reconnecting"}</span>
          <time dateTime={library.serverTime}>{new Date(library.serverTime).toLocaleTimeString()}</time>
        </div>
      </header>
      {error && <StatusBanner tone="danger">{error}</StatusBanner>}
      {notice && (
        <StatusBanner tone="success">
          {notice}{" "}
          {hiddenUndo && (
            <button onClick={() => void undoHide()} disabled={busyCard === hiddenUndo.card.id}>
              Undo hide
            </button>
          )}
        </StatusBanner>
      )}
      {library.total > 0 && (
        <section className="library-tools" aria-label="Search and filter Chronicles">
          <label>
            <span>Search</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Title, Captain, voyage, or year"
            />
          </label>
          <label>
            <span>State</span>
            <select value={filter} onChange={(event) => setFilter(event.target.value)}>
              <option value="ALL">All states</option>
              {groupLabels.map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Sort</span>
            <select value={sort} onChange={(event) => setSort(event.target.value)}>
              <option value="RECENT">Recently active</option>
              <option value="TITLE">Title</option>
              <option value="COMPLETED">Completion date</option>
            </select>
          </label>
          <div className="view-toggle" role="group" aria-label="Library view">
            <button
              className={view === "gallery" ? "active" : ""}
              aria-pressed={view === "gallery"}
              onClick={() => setView("gallery")}
            >
              Gallery
            </button>
            <button
              className={view === "list" ? "active" : ""}
              aria-pressed={view === "list"}
              onClick={() => setView("list")}
            >
              List
            </button>
          </div>
          <p className="sr-only" role="status" aria-live="polite">
            {resultCount} {resultCount === 1 ? "Chronicle result" : "Chronicle results"}
          </p>
        </section>
      )}
      {!library.total ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <EmptyState
            title={platformCopy.noChronicles.value}
            detail="Accept a Captain's invitation, enter a short code, or explore published Chronicles to begin a Voyage."
            action={{ label: "Join with an Invitation", href: "/player/sign-in#invitation-code" }}
          />
        </motion.div>
      ) : !groups.length ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <EmptyState
            title="No Chronicles match these filters"
            detail="Broaden your search or return to all Voyage states."
            action={{
              label: "Clear Filters",
              onClick: () => {
                setQuery("");
                setFilter("ALL");
              },
            }}
            symbol="⌕"
          />
        </motion.div>
      ) : (
        <LayoutGroup id="player-library">
          {groups.map((group) => {
            const isCollapsed = collapsed.has(group.key);
            return (
              <motion.section
                layout="position"
                className="library-group"
                key={group.key}
                aria-labelledby={`group-${group.key}`}
              >
                <header>
                  <div>
                    <p className="eyebrow">
                      {group.cards.length} {group.cards.length === 1 ? "record" : "records"}
                    </p>
                    <h2 id={`group-${group.key}`}>
                      <button
                        aria-expanded={!isCollapsed}
                        onClick={(event) => toggleGroup(group.key, event.currentTarget)}
                      >
                        {group.label}
                      </button>
                    </h2>
                    <p>{group.description}</p>
                  </div>
                </header>
                <AnimatePresence initial={false}>
                  {!isCollapsed && (
                    <motion.div
                      key={`${group.key}-cards`}
                      className={`player-card-grid ${view}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      <AnimatePresence mode="popLayout" initial={false}>
                        {group.cards.map((card, index) => (
                          <PlayerTaleCard
                            card={card}
                            key={card.id}
                            busy={busyCard === card.id}
                            changed={changedIds.has(card.id)}
                            entering={enteringIds.has(card.id)}
                            index={index}
                            mode={mode}
                            newInvitation={newInvitationIds.has(card.id)}
                            onPreference={setPreference}
                          />
                        ))}
                      </AnimatePresence>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.section>
            );
          })}
        </LayoutGroup>
      )}
    </motion.main>
  );
}

function PlayerTaleCard({
  card,
  busy,
  changed,
  entering,
  index,
  mode,
  newInvitation,
  onPreference,
}: {
  card: PlayerLibraryCard;
  busy: boolean;
  changed: boolean;
  entering: boolean;
  index: number;
  mode: ReturnType<typeof useMotionMode>["mode"];
  newInvitation: boolean;
  onPreference: (card: PlayerLibraryCard, action: "pin" | "unpin" | "hide") => void;
}) {
  const token = resolvePlatformMotionToken("layout", mode);
  const stateClass = card.state.toLocaleLowerCase().replaceAll("_", "-");
  return (
    <motion.article
      layout
      layoutId={`player-voyage-${card.id}`}
      className={`player-tale-card state-${stateClass}`}
      data-card-changed={changed}
      data-card-state={card.state}
      initial={entering ? { opacity: 0, y: token.distancePx } : false}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: mode === "reduced" ? 1 : 0.98 }}
      transition={{
        duration: token.durationSeconds,
        delay: mode === "reduced" ? 0 : Math.min(index * 0.04, 0.2),
        ease: platformMotionEasing("layout"),
      }}
    >
      <motion.div className="tale-cover" layoutId={`player-cover-${card.id}`}>
        {card.coverUrl ? <img src={card.coverUrl} alt="" /> : <span aria-hidden="true">✦</span>}
        <b>{card.status.replaceAll("_", " ")}</b>
        {newInvitation && card.state === "INVITATIONS" && <span className="new-invitation-badge">New invitation</span>}
        {card.state === "AWAITING_CAPTAIN" && <span className="waiting-lantern" aria-hidden="true" />}
        {card.state === "COMPLETED" && <span className="completed-ribbon" aria-hidden="true" />}
        {card.state === "REPLAY_NEW_EDITION" && <span className="new-edition-badge">New edition</span>}
      </motion.div>
      <div className="tale-card-copy">
        <p className="card-kicker">
          Version {card.versionLabel} · {card.voyageName}
          {card.pinned ? " · Pinned" : ""}
        </p>
        <h3>{card.title}</h3>
        {card.subtitle && <h4>{card.subtitle}</h4>}
        <p>{card.shortDescription ?? "A Chronicle is ready when the Captain opens the next Passage."}</p>
        {card.state === "AWAITING_CAPTAIN" && (
          <p className="sr-only">
            {playerCopy.awaitingCaptain.value}. {playerCopy.awaitingCaptainDetail.value}
          </p>
        )}
        <dl>
          <div>
            <dt>Captain</dt>
            <dd>{card.captainName}</dd>
          </div>
          {card.currentChapterTitle && (
            <div>
              <dt>Present chapter</dt>
              <dd>{card.currentChapterTitle}</dd>
            </div>
          )}
          {card.revealedChapterCount > 0 && (
            <div>
              <dt>Revealed chapters</dt>
              <dd>{card.revealedChapterCount}</dd>
            </div>
          )}
          {card.completionDate && (
            <div>
              <dt>Completed</dt>
              <dd>{new Date(card.completionDate).toLocaleDateString()}</dd>
            </div>
          )}
          {card.completionDate && (
            <div>
              <dt>Memories</dt>
              <dd>{card.memoriesCollected}</dd>
            </div>
          )}
          {card.plannedStartAt && (
            <div>
              <dt>Planned start</dt>
              <dd>{new Date(card.plannedStartAt).toLocaleString()}</dd>
            </div>
          )}
        </dl>
        <div className="card-actions">
          <Link className="brass-button" href={card.primaryHref}>
            {card.primaryLabel}
          </Link>
          <button disabled={busy} aria-busy={busy} onClick={() => onPreference(card, card.pinned ? "unpin" : "pin")}>
            {busy ? "Saving…" : card.pinned ? "Unpin" : "Pin to top"}
          </button>
          {["COMPLETED", "EXPIRED_REVOKED"].includes(card.state) && (
            <button className="button-subtle" disabled={busy} onClick={() => onPreference(card, "hide")}>
              Hide from library
            </button>
          )}
        </div>
      </div>
    </motion.article>
  );
}
