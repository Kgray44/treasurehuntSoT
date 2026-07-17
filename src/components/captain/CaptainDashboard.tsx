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
    if (!response.ok) setError(body.error ?? "The Captain ledger is unavailable.");
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
          <p className="eyebrow">Captain control</p>
          <h1>The command cabin is locked.</h1>
          <p>Sign in through the Quartermaster&apos;s Log, then return to active Tall Tale sessions.</p>
          <Link className="brass-button" href="/quartermaster">
            Open Quartermaster login
          </Link>
        </section>
      </main>
    );
  return (
    <main className="captain-dashboard">
      <header>
        <div>
          <Link href="/">← Harbor</Link>
          <p className="eyebrow">Authoritative session control</p>
          <h1>Captain&apos;s Tall Tale Desk</h1>
          <p>State refreshes from the server every 2.5 seconds. Progression actions remain idempotent and audited.</p>
        </div>
        <nav>
          <Link href="/studio">Tall Tale Studio</Link>
          <Link href="/tales">Player catalog</Link>
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
          <span>active voyages</span>
        </article>
        <article>
          <strong>{shown.filter((session) => session.pendingVerification && !session.previewMode).length}</strong>
          <span>awaiting verification</span>
        </article>
        <article>
          <strong>{shown.filter((session) => session.previewMode).length}</strong>
          <span>preview sessions</span>
        </article>
        <article className="live-poll">
          <i />
          <strong>Live</strong>
          <span>canonical polling</span>
        </article>
      </section>
      <div className="captain-layout">
        <aside>
          <p className="eyebrow">Available Tall Tales</p>
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
            <h2>{taleFilter ? tales.find((tale) => tale.id === taleFilter)?.title : "All sessions"}</h2>
            <span>{shown.length} total</span>
          </header>
          {!shown.length && (
            <div className="captain-empty">
              <span>◌</span>
              <h3>No sessions on this chart</h3>
              <p>Start a published tale or create a Studio preview session.</p>
            </div>
          )}
          {shown
            .filter((session) => !session.previewMode)
            .map((session) => (
              <SessionCard key={session.id} session={session} clock={clock} />
            ))}
          {shown.some((session) => session.previewMode) && (
            <>
              <h3 className="preview-divider">Development previews</h3>
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
        <span>{session.connected ? "Recent player heartbeat" : "No recent player heartbeat"}</span>
      </div>
      <p className="card-kicker">{session.previewMode ? "Preview Mode" : `Version ${session.versionLabel}`}</p>
      <h3>{session.taleTitle}</h3>
      <p>{session.ownerLabel ?? "Guest crew"}</p>
      <dl>
        <div>
          <dt>Status</dt>
          <dd>{session.status.toLocaleLowerCase()}</dd>
        </div>
        <div>
          <dt>Current block</dt>
          <dd>{session.currentBlockId?.slice(0, 8) ?? "none"}</dd>
        </div>
        <div>
          <dt>Verification</dt>
          <dd>
            {session.pendingVerification
              ? `${session.pendingVerification.providerType} · ${Math.floor(waiting / 1000)}s`
              : "none pending"}
          </dd>
        </div>
        <div>
          <dt>Last event</dt>
          <dd>{new Date(session.lastEventAt).toLocaleTimeString()}</dd>
        </div>
      </dl>
      <Link className="brass-button" href={`/captain/sessions/${session.id}`}>
        Open session controls
      </Link>
    </article>
  );
}
