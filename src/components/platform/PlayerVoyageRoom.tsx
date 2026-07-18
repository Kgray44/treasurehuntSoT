"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Playthrough = {
  id: string;
  title: string;
  subtitle: string | null;
  voyageName: string;
  versionLabel: string;
  status: string;
  state: string;
  plannedStartAt: string | null;
  lastSynchronizedAt: string;
  primaryHref: string;
  primaryLabel: string;
  crew: Array<{ displayName: string; crewRole: string | null; status: string }>;
  canEnter: boolean;
  runtimeHref: string | null;
};

export function PlayerVoyageRoom({ playthroughId }: { playthroughId: string }) {
  const router = useRouter();
  const [voyage, setVoyage] = useState<Playthrough | null>(null);
  const [error, setError] = useState("");
  const [connection, setConnection] = useState<"CONNECTING" | "LIVE" | "POLLING" | "DISCONNECTED">("CONNECTING");

  const load = useCallback(async () => {
    const response = await fetch(`/api/player/playthroughs/${playthroughId}`, { cache: "no-store" });
    const body = (await response.json()) as { playthrough?: Playthrough; error?: string };
    if (!response.ok) return setError(body.error ?? "This voyage is unavailable.");
    setVoyage(body.playthrough ?? null);
    setError("");
  }, [playthroughId]);

  useEffect(() => {
    queueMicrotask(() => void load());
    const timer = setInterval(() => {
      setConnection((value) => (value === "LIVE" ? value : "POLLING"));
      void load();
    }, 5000);
    const source = new EventSource(`/api/play/sessions/${playthroughId}/events`);
    source.onopen = () => setConnection("LIVE");
    source.addEventListener("progression", () => void load());
    source.addEventListener("access-revoked", () => {
      setConnection("DISCONNECTED");
      setError("Your access to this voyage was revoked.");
    });
    source.onerror = () => setConnection("POLLING");
    return () => {
      clearInterval(timer);
      source.close();
    };
  }, [load, playthroughId]);

  useEffect(() => {
    if (voyage?.canEnter && voyage.runtimeHref) {
      const timer = setTimeout(() => router.push(voyage.runtimeHref!), 900);
      return () => clearTimeout(timer);
    }
    if (voyage?.state === "COMPLETED") router.replace(`/player/playthroughs/${playthroughId}/journal`);
  }, [playthroughId, router, voyage]);

  if (error && !voyage)
    return (
      <main className="waiting-room platform-loading">
        <p className="platform-error" role="alert">
          {error}
        </p>
        <Link href="/player/library">Return to library</Link>
      </main>
    );
  if (!voyage)
    return (
      <main className="waiting-room platform-loading">
        <p role="status">Opening the waiting room…</p>
      </main>
    );
  if (voyage.state === "COMPLETED") {
    return (
      <main className="waiting-room platform-loading">
        <p role="status">Opening your completed voyage archive…</p>
      </main>
    );
  }
  return (
    <main className="waiting-room">
      <div className="closed-journal" aria-hidden="true">
        <i />
        <b>✦</b>
      </div>
      <section aria-labelledby="waiting-title">
        <Link href="/player/library">Back to my library</Link>
        <p className="eyebrow">{voyage.status.replaceAll("_", " ")}</p>
        <h1 id="waiting-title">{voyage.title}</h1>
        <h2>{voyage.voyageName}</h2>
        <p>
          {voyage.canEnter
            ? "The Captain has launched the voyage. Opening your journal…"
            : "Your place is secured. The journal will open only after the Captain launches the voyage."}
        </p>
        <dl>
          <div>
            <dt>Edition</dt>
            <dd>{voyage.versionLabel}</dd>
          </div>
          <div>
            <dt>Readiness</dt>
            <dd>{voyage.status === "SCHEDULED" ? "Scheduled" : "Awaiting Captain"}</dd>
          </div>
          {voyage.plannedStartAt && (
            <div>
              <dt>Planned start</dt>
              <dd>{new Date(voyage.plannedStartAt).toLocaleString()}</dd>
            </div>
          )}
          <div>
            <dt>Connection</dt>
            <dd className={`connection-${connection.toLowerCase()}`}>{connection.toLocaleLowerCase()}</dd>
          </div>
          <div>
            <dt>Last server confirmation</dt>
            <dd>{new Date(voyage.lastSynchronizedAt).toLocaleTimeString()}</dd>
          </div>
        </dl>
        <section className="crew-readiness">
          <h3>Crew readiness</h3>
          <ul>
            {voyage.crew.map((member) => (
              <li key={`${member.displayName}-${member.crewRole}`}>
                <span>{member.displayName}</span>
                <small>
                  {member.crewRole ?? "Player"} · {member.status.replaceAll("_", " ").toLocaleLowerCase()}
                </small>
              </li>
            ))}
          </ul>
        </section>
        {error && (
          <p className="platform-error" role="alert">
            {error}
          </p>
        )}
        <div className="waiting-actions">
          <button onClick={() => void load()}>Reconnect and refresh</button>
          <Link href="/player/library">Leave waiting room</Link>
        </div>
      </section>
    </main>
  );
}
