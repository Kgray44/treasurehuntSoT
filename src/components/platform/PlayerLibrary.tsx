"use client";

/* eslint-disable @next/next/no-img-element -- Images are served by the version- and membership-authorized media route. */
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Card = {
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
    invitations: Card[];
    awaitingCaptain: Card[];
    inProgress: Card[];
    completed: Card[];
    replayOrNewEdition: Card[];
    expiredOrRevoked: Card[];
  };
  total: number;
  serverTime: string;
  csrfToken: string;
};

const groupLabels: Array<[keyof Library["groups"], string, string]> = [
  ["invitations", "Invitations", "Sealed invitations awaiting your answer"],
  ["awaitingCaptain", "Awaiting Captain", "Accepted voyages preparing to launch"],
  ["inProgress", "In Progress", "Living Tall Tales ready to continue"],
  ["completed", "Voyage Archive", "Permanent records of completed playthroughs"],
  ["replayOrNewEdition", "Replay and New Editions", "Only voyages explicitly offered to you"],
  ["expiredOrRevoked", "Closed Invitations", "Expired, declined, or revoked access"],
];

export function PlayerLibrary() {
  const [library, setLibrary] = useState<Library | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [sort, setSort] = useState("RECENT");
  const [view, setView] = useState<"gallery" | "list">("gallery");

  useEffect(() => {
    void fetch("/api/player/library", { cache: "no-store" }).then(async (response) => {
      const body = (await response.json()) as Library & { error?: string };
      if (!response.ok) setError(body.error ?? "Your Tall Tale Library is unavailable.");
      else setLibrary(body);
    });
  }, []);

  async function setPreference(card: Card, action: "pin" | "unpin" | "hide") {
    if (!library) return;
    setError("");
    const response = await fetch(`/api/player/playthroughs/${card.id}/preference`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-csrf-token": library.csrfToken },
      body: JSON.stringify({ action }),
    });
    const body = (await response.json()) as { error?: string };
    if (!response.ok) return setError(body.error ?? "The library preference could not be saved.");
    setLibrary((current) => {
      if (!current) return current;
      const update = (cards: Card[]) =>
        cards
          .filter((item) => action !== "hide" || item.id !== card.id)
          .map((item) => (item.id === card.id ? { ...item, pinned: action === "pin" } : item));
      return {
        ...current,
        total: action === "hide" ? current.total - 1 : current.total,
        groups: Object.fromEntries(
          Object.entries(current.groups).map(([key, cards]) => [key, update(cards)]),
        ) as Library["groups"],
      };
    });
  }

  const groups = useMemo(() => {
    if (!library) return [];
    return groupLabels
      .map(([key, label, description]) => {
        let cards = library.groups[key].filter((card) =>
          `${card.title} ${card.captainName} ${card.voyageName} ${card.completionDate?.slice(0, 4) ?? ""}`
            .toLocaleLowerCase()
            .includes(query.toLocaleLowerCase()),
        );
        if (filter !== "ALL" && key !== filter) cards = [];
        cards = [...cards].sort((left, right) =>
          sort === "TITLE"
            ? left.title.localeCompare(right.title)
            : sort === "COMPLETED"
              ? (right.completionDate ?? "").localeCompare(left.completionDate ?? "")
              : right.lastSynchronizedAt.localeCompare(left.lastSynchronizedAt),
        );
        return { key, label, description, cards };
      })
      .filter((group) => group.cards.length);
  }, [filter, library, query, sort]);

  if (error)
    return (
      <main className="player-library platform-loading">
        <p role="alert" className="platform-error">
          {error}
        </p>
        <Link href="/player/sign-in">Return to Player sign-in</Link>
      </main>
    );
  if (!library)
    return (
      <main className="player-library platform-loading">
        <p role="status">Reading your voyage shelf…</p>
      </main>
    );

  return (
    <main className="player-library">
      <header className="platform-header">
        <div>
          <p className="eyebrow">{library.player.displayName}&apos;s collection</p>
          <h1>My Tall Tale Library</h1>
          <p>Invitations, active adventures, and the exact historical editions you experienced.</p>
        </div>
        <div className="library-truth">
          <i />
          <span>Server confirmed</span>
          <time dateTime={library.serverTime}>{new Date(library.serverTime).toLocaleTimeString()}</time>
        </div>
      </header>
      <section className="library-tools" aria-label="Search and filter Tall Tales">
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
          <button className={view === "gallery" ? "active" : ""} onClick={() => setView("gallery")}>
            Gallery
          </button>
          <button className={view === "list" ? "active" : ""} onClick={() => setView("list")}>
            List
          </button>
        </div>
      </section>
      {!library.total ? (
        <section className="platform-empty">
          <span aria-hidden="true">✦</span>
          <h2>Your shelf is waiting for its first voyage</h2>
          <p>Open a Captain&apos;s invitation link, or enter the short code they shared with you.</p>
          <Link className="brass-button" href="/player/sign-in#invitation-code">
            Enter invitation code
          </Link>
        </section>
      ) : !groups.length ? (
        <section className="platform-empty">
          <h2>No voyages match these filters</h2>
          <button
            onClick={() => {
              setQuery("");
              setFilter("ALL");
            }}
          >
            Clear filters
          </button>
        </section>
      ) : (
        groups.map((group) => (
          <section className="library-group" key={group.key} aria-labelledby={`group-${group.key}`}>
            <header>
              <div>
                <p className="eyebrow">
                  {group.cards.length} {group.cards.length === 1 ? "record" : "records"}
                </p>
                <h2 id={`group-${group.key}`}>{group.label}</h2>
                <p>{group.description}</p>
              </div>
            </header>
            <div className={`player-card-grid ${view}`}>
              {group.cards.map((card) => (
                <PlayerTaleCard card={card} key={card.id} onPreference={setPreference} />
              ))}
            </div>
          </section>
        ))
      )}
    </main>
  );
}

function PlayerTaleCard({
  card,
  onPreference,
}: {
  card: Card;
  onPreference: (card: Card, action: "pin" | "unpin" | "hide") => void;
}) {
  return (
    <article className={`player-tale-card state-${card.state.toLocaleLowerCase()}`}>
      <div className="tale-cover">
        {card.coverUrl ? <img src={card.coverUrl} alt="" /> : <span aria-hidden="true">✦</span>}
        <b>{card.status.replaceAll("_", " ")}</b>
      </div>
      <div className="tale-card-copy">
        <p className="card-kicker">
          Version {card.versionLabel} · {card.voyageName}
          {card.pinned ? " · Pinned" : ""}
        </p>
        <h3>{card.title}</h3>
        {card.subtitle && <h4>{card.subtitle}</h4>}
        <p>{card.shortDescription ?? "A Tall Tale waits inside this volume."}</p>
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
          <button onClick={() => onPreference(card, card.pinned ? "unpin" : "pin")}>
            {card.pinned ? "Unpin" : "Pin to top"}
          </button>
          {["COMPLETED", "EXPIRED_REVOKED"].includes(card.state) && (
            <button onClick={() => onPreference(card, "hide")}>Hide from library</button>
          )}
        </div>
      </div>
    </article>
  );
}
