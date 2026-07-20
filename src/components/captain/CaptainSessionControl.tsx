"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { captainCopy } from "@/language/captain-copy";
import type { JsonObject } from "@/tall-tale/types";

type State = {
  session: {
    id: string;
    status: string;
    previewMode: boolean;
    versionId: string;
    ownerLabel: string | null;
    currentSequence: number;
    updatedAt: string;
  };
  tale: { title: string };
  chapter: { title: string } | null;
  block: {
    id: string;
    title: string;
    blockType: string;
    configuration: JsonObject;
    creatorNotes: string | null;
  } | null;
  pendingVerification: { id: string; providerType: string; requestedAt: string } | null;
  inventory: string[];
  variables?: JsonObject;
  events: Array<{
    id: string;
    eventType: string;
    sourceType: string;
    sequence: number;
    payload: JsonObject;
    createdAt: string;
  }>;
  chapters?: Array<{ id: string; title: string; blocks: Array<{ id: string; title: string; blockType: string }> }>;
};

export function CaptainSessionControl({ sessionId, authenticated }: { sessionId: string; authenticated: boolean }) {
  const [state, setState] = useState<State | null>(null);
  const [csrf, setCsrf] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [jumpTarget, setJumpTarget] = useState("");
  const [simResult, setSimResult] = useState("match");
  const [confidence, setConfidence] = useState(0.95);
  const load = useCallback(async () => {
    const [detail, list] = await Promise.all([
      fetch(`/api/captain/sessions/${sessionId}`, { cache: "no-store" }),
      fetch("/api/captain/sessions", { cache: "no-store" }),
    ]);
    const body = (await detail.json()) as State & { error?: string };
    const meta = (await list.json()) as { csrfToken?: string };
    if (!detail.ok)
      setError(body.error ?? "This Voyage could not be opened. No progress has changed. Check your connection, then try again.");
    else {
      setState(body);
      setError("");
    }
    setCsrf(meta.csrfToken ?? "");
  }, [sessionId]);
  useEffect(() => {
    if (!authenticated) return;
    queueMicrotask(() => void load());
    const timer = setInterval(() => void load(), 2000);
    return () => clearInterval(timer);
  }, [authenticated, load]);
  async function action(name: string, options: JsonObject = {}) {
    if (
      ["rollback", "jump", "override"].includes(name) &&
      !window.confirm(
        name === "rollback"
          ? "Restore the prior saved Passage? This changes the Voyage's current progress and records an audit entry."
          : name === "jump"
            ? "Move the Crew to the selected Passage? This changes the Voyage's current progress and records an audit entry."
            : "Approve this verification with an override? This advances the Voyage and records why the normal verification was bypassed.",
      )
    )
      return;
    const reason = ["rollback", "jump", "override", "reject"].includes(name)
      ? window.prompt("Record why this Captain action is needed:")
      : "Captain control";
    if (reason === null) return;
    setBusy(true);
    const response = await fetch(`/api/captain/sessions/${sessionId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
      body: JSON.stringify({ action: name, reason, idempotencyKey: crypto.randomUUID(), ...options }),
    });
    const body = (await response.json()) as { error?: string };
    if (!response.ok)
      setError(body.error ?? "This Captain action could not be completed. Current Voyage progress is unchanged. Review the Console and try again.");
    await load();
    setBusy(false);
  }
  async function simulate(scenario = "valid") {
    setBusy(true);
    const response = await fetch(`/api/captain/sessions/${sessionId}/simulate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
      body: JSON.stringify({ result: simResult, confidence, scenario }),
    });
    const body = (await response.json()) as { error?: string; code?: string };
    setError(
      response.ok
        ? `Verification simulation accepted the ${simResult} result${scenario === "duplicate" ? " and safely deduplicated its replay" : ""}.`
        : `${body.error ?? "The verification simulation could not be applied. No Voyage progress changed."} (${body.code ?? "rejected"})`,
    );
    await load();
    setBusy(false);
  }
  if (!authenticated)
    return (
      <main className="captain-auth">
        <section>
          <h1>Captain access required</h1>
          <Link href="/quartermaster">Sign in to Captain&apos;s Console</Link>
        </section>
      </main>
    );
  if (!state)
    return (
      <main className="captain-session loading">
        <p role="status">{error || "Opening Voyage controls..."}</p>
      </main>
    );
  return (
    <main className="captain-session">
      <header>
        <div>
          <Link href="/captain">All Voyages</Link>
          <p className="eyebrow">
            {state.session.previewMode ? "Preview Voyage" : `Version ${state.session.versionId.slice(0, 12)}`}
          </p>
          <h1>{state.tale.title}</h1>
          <p>
            {state.session.ownerLabel} · {state.session.status.toLocaleLowerCase()} · sequence{" "}
            {state.session.currentSequence}
          </p>
        </div>
        <span className="polling-state">
          <i />
          Server state · 2-second refresh
        </span>
      </header>
      {error && (
        <div className="captain-notice" role="status">
          <span>{error}</span>
          <button onClick={() => setError("")}>Dismiss</button>
        </div>
      )}
      <div className="session-control-grid">
        <section className="current-state">
          <p className="card-kicker">Crew&apos;s current Passage</p>
          <h2>{state.chapter?.title}</h2>
          <h3>{state.block?.title}</h3>
          <span>{state.block?.blockType}</span>
          <p>
            {String(
              state.block?.configuration.prompt ??
                state.block?.configuration.heading ??
                state.block?.configuration.body ??
                "No Crew-facing summary has been configured.",
            )}
          </p>
          {state.block?.creatorNotes && (
            <aside>
              <strong>Private creator note</strong>
              <p>{state.block.creatorNotes}</p>
            </aside>
          )}
          <div className={`pending-request ${state.pendingVerification ? "active" : "quiet"}`}>
            <strong>
              {state.pendingVerification
                ? `Awaiting ${state.pendingVerification.providerType} verification`
                : "No verification request"}
            </strong>
            {state.pendingVerification && (
              <span>Waiting since {new Date(state.pendingVerification.requestedAt).toLocaleTimeString()}</span>
            )}
          </div>
        </section>
        <section className="captain-actions">
          <p className="card-kicker">Captain controls</p>
          <div>
            {state.pendingVerification && (
              <>
                <button className="approve" disabled={busy} onClick={() => void action("approve")}>
                  Approve verification
                </button>
                <button disabled={busy} onClick={() => void action("reject")}>
                  Request another attempt
                </button>
                <button disabled={busy} onClick={() => void action("override")}>
                  Approve with override
                </button>
              </>
            )}
            <button disabled={busy} onClick={() => void action(state.session.status === "PAUSED" ? "resume" : "pause")}>
              {state.session.status === "PAUSED" ? captainCopy.resumeVoyage.value : captainCopy.pauseVoyage.value}
            </button>
            <button disabled={busy} onClick={() => void action("presentation")}>
              Replay presentation
            </button>
            <button disabled={busy} onClick={() => void action("releaseHint")}>
              Release Hint
            </button>
            <button disabled={busy} onClick={() => void action("rollback")}>
              Restore prior Passage
            </button>
          </div>
          <label>
            <span>Choose Passage</span>
            <select value={jumpTarget} onChange={(event) => setJumpTarget(event.target.value)}>
              <option value="">Choose a Passage</option>
              {state.chapters?.map((chapter) => (
                <optgroup key={chapter.id} label={chapter.title}>
                  {chapter.blocks.map((block) => (
                    <option key={block.id} value={block.id}>
                      {block.title} · {block.blockType}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <button disabled={busy || !jumpTarget} onClick={() => void action("jump", { targetBlockId: jumpTarget })}>
            Move Crew to selected Passage
          </button>
        </section>
        <section className="session-debug">
          <p className="card-kicker">Artifacts and Voyage variables</p>
          <h3>Artifacts</h3>
          <ul>{state.inventory.length ? state.inventory.map((item) => <li key={item}>{item}</li>) : <li>No Artifacts</li>}</ul>
          <h3>Voyage variables</h3>
          <pre>{JSON.stringify(state.variables ?? {}, null, 2)}</pre>
        </section>
        <section className="event-ledger">
          <p className="card-kicker">Voyage event history</p>
          <ol>
            {state.events.map((event) => (
              <li key={event.id}>
                <span>{event.sequence}</span>
                <div>
                  <strong>{event.eventType}</strong>
                  <small>
                    {event.sourceType} · {new Date(event.createdAt).toLocaleTimeString()}
                  </small>
                </div>
              </li>
            ))}
          </ol>
        </section>
        {process.env.NODE_ENV !== "production" && (
          <section className="verification-simulator">
            <p className="card-kicker">Development tool: verification provider seam</p>
            <h2>Verification Simulator</h2>
            <p>
              Tests standardized evidence against the current verification request. It cannot advance a Voyage without a
              pending verification request.
            </p>
            <label>
              <span>Outcome</span>
              <select value={simResult} onChange={(event) => setSimResult(event.target.value)}>
                <option value="match">Match</option>
                <option value="notMatch">Not match</option>
                <option value="uncertain">Uncertain</option>
              </select>
            </label>
            <label>
              <span>Confidence {confidence.toFixed(2)}</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={confidence}
                onChange={(event) => setConfidence(Number(event.target.value))}
              />
            </label>
            <div>
              <button disabled={busy || !state.pendingVerification} onClick={() => void simulate()}>
                Submit simulated outcome
              </button>
              <button disabled={busy || !state.pendingVerification} onClick={() => void simulate("duplicate")}>
                Test duplicate
              </button>
              <button disabled={busy || !state.pendingVerification} onClick={() => void simulate("stale")}>
                Test stale
              </button>
              <button disabled={busy || !state.pendingVerification} onClick={() => void simulate("wrongBlock")}>
                Test wrong Passage
              </button>
              <button disabled={busy || !state.pendingVerification} onClick={() => void simulate("wrongVersion")}>
                Test wrong version
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
