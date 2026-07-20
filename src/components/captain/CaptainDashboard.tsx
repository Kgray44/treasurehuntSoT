"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type Session = {
  id: string;
  taleId: string;
  taleTitle: string;
  versionLabel: string;
  ownerLabel: string | null;
  status: string;
  previewMode: boolean;
  currentBlockId: string | null;
  pendingVerification: { providerType: string; requestedAt: string } | null;
  lastEventAt: string;
  connected: boolean;
};
type Tale = { id: string; slug: string; title: string; status: string; visibility: string };

export function CaptainDashboard({ authenticated, taleFilter }: { authenticated: boolean; taleFilter?: string }) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [tales, setTales] = useState<Tale[]>([]);
  const [error, setError] = useState("");
  const [clock, setClock] = useState(0);
  const load = useCallback(async () => {
    const response = await fetch("/api/captain/sessions", { cache: "no-store" });
    const body = (await response.json()) as { sessions?: Session[]; tales?: Tale[]; error?: string };
    if (!response.ok)
      setError(body.error ?? "Captain's Console is unavailable. No Voyage progress has changed. Check your connection, then try again.");
    else {
      setSessions(body.sessions ?? []);
      setTales(body.tales ?? []);
      setError("");
    }
  }, []);
  useEffect(() => {
    if (!authenticated) return;
    queueMicrotask(() => {
      setClock(Date.now());
      void load();
    });
    const timer = setInterval(() => {
      setClock(Date.now());
      void load();
    }, 2500);
    return () => clearInterval(timer);
  }, [authenticated, load]);
  const shown = useMemo(
    () => (taleFilter ? sessions.filter((session) => session.taleId === taleFilter) : sessions),
    [sessions, taleFilter],
  );
  if (!authenticated)
    return (
      <main className="captain-auth">
        <section>
          <p className="eyebrow">Captain&apos;s Console</p>
          <h1>Captain access required</h1>
          <p>Sign in to open live Voyages and their controls.</p>
          <Link className="brass-button" href="/quartermaster">
            Sign in to Captain&apos;s Console
          </Link>
        </section>
      </main>
    );
  return (
    <main className="captain-dashboard">
      <header>
        <div>
          <Link href="/">← Return to Voyagewright</Link>
          <p className="eyebrow">Live Voyage control</p>
          <h1>Captain&apos;s Console</h1>
          <p>This Console refreshes server state every 2.5 seconds. Every progression action is recorded and auditable.</p>
        </div>
        <nav>
          <Link href="/studio">Voyagewright Studio</Link>
          <Link href="/tales">Chronicle Library</Link>
        </nav>
      </header>
      {error && (
        <p role="alert" className="captain-error">
          {error}
        </p>
      )}
      <section className="captain-summary">
        <article>
          <strong>{shown.filter((session) => session.status === "ACTIVE" && !session.previewMode).length}</strong>
          <span>active Voyages</span>
        </article>
        <article>
          <strong>{shown.filter((session) => session.pendingVerification && !session.previewMode).length}</strong>
          <span>awaiting verification</span>
        </article>
        <article>
          <strong>{shown.filter((session) => session.previewMode).length}</strong>
          <span>Preview Voyages</span>
        </article>
        <article className="live-poll">
          <i />
          <strong>Live</strong>
          <span>server refresh</span>
        </article>
      </section>
      <div className="captain-layout">
        <aside>
          <p className="eyebrow">Available Chronicles</p>
          {tales.map((tale) => (
            <Link className={tale.id === taleFilter ? "active" : ""} key={tale.id} href={`/captain/tales/${tale.id}`}>
              <strong>{tale.title}</strong>
              <span>
                {tale.visibility.toLocaleLowerCase()} · {tale.status.toLocaleLowerCase()}
              </span>
            </Link>
          ))}
        </aside>
        <section className="captain-sessions">
          <header>
            <h2>{taleFilter ? tales.find((tale) => tale.id === taleFilter)?.title : "All Voyages"}</h2>
            <span>{shown.length} total</span>
          </header>
          {!shown.length && (
            <div className="captain-empty">
              <span>◌</span>
              <h3>No Voyages yet</h3>
              <p>Begin a Voyage from a published Chronicle or create a Preview Voyage in Voyagewright Studio.</p>
            </div>
          )}
          {shown
            .filter((session) => !session.previewMode)
            .map((session) => (
              <SessionCard key={session.id} session={session} clock={clock} />
            ))}
          {shown.some((session) => session.previewMode) && (
            <>
              <h3 className="preview-divider">Preview Voyages</h3>
              {shown
                .filter((session) => session.previewMode)
                .map((session) => (
                  <SessionCard key={session.id} session={session} clock={clock} />
                ))}
            </>
          )}
        </section>
      </div>
    </main>
  );
}

function SessionCard({ session, clock }: { session: Session; clock: number }) {
  const waiting = session.pendingVerification
    ? Math.max(0, clock - Date.parse(session.pendingVerification.requestedAt))
    : 0;
  return (
    <article
      className={`captain-session-card ${session.pendingVerification ? "waiting" : ""} ${session.previewMode ? "preview" : ""}`}
    >
      <div className="session-signal">
        <i className={session.connected ? "connected" : "quiet"} />
        <span>{session.connected ? "Crew member recently connected" : "No recent Crew connection"}</span>
      </div>
      <p className="card-kicker">{session.previewMode ? "Preview Voyage" : `Version ${session.versionLabel}`}</p>
      <h3>{session.taleTitle}</h3>
      <p>{session.ownerLabel ?? "Guest Crew"}</p>
      <dl>
        <div>
          <dt>Status</dt>
          <dd>{session.status.toLocaleLowerCase()}</dd>
        </div>
        <div>
          <dt>Current Passage</dt>
          <dd>{session.currentBlockId?.slice(0, 8) ?? "none"}</dd>
        </div>
        <div>
          <dt>Verification</dt>
          <dd>
            {session.pendingVerification
              ? `${session.pendingVerification.providerType} · ${Math.floor(waiting / 1000)}s`
              : "No request"}
          </dd>
        </div>
        <div>
          <dt>Last update</dt>
          <dd>{new Date(session.lastEventAt).toLocaleTimeString()}</dd>
        </div>
      </dl>
      <Link className="brass-button" href={`/captain/sessions/${session.id}`}>
        Open Voyage controls
      </Link>
    </article>
  );
}
