"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PublishedBlockView } from "@/components/tales/PublishedBlockView";
import type { JsonObject } from "@/tall-tale/types";

type State = {
  csrfToken?: string;
  session: {
    id: string;
    status: string;
    previewMode: boolean;
    versionId: string;
    currentSequence: number;
    completedAt: string | null;
  };
  tale: { title: string; slug: string };
  chapter: { title: string; orderIndex: number } | null;
  block: {
    id: string;
    blockType: string;
    title: string;
    configuration: JsonObject;
    connections: Array<{ targetBlockId: string; connectionType: string; label?: string | null }>;
  } | null;
  pendingVerification: { id: string; providerType: string; expiresAt: string | null } | null;
  assets: Array<{ id: string; displayName: string; url: string }>;
};

export function PlayerRuntime({ sessionId }: { sessionId: string }) {
  const [state, setState] = useState<State | null>(null);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(false);
  const [now, setNow] = useState(0);
  const load = useCallback(async () => {
    const response = await fetch(`/api/play/sessions/${sessionId}`, { cache: "no-store" });
    const body = (await response.json()) as State & { error?: string };
    if (!response.ok) setError(body.error ?? "The voyage state could not be read.");
    else {
      setState(body);
      setError("");
    }
  }, [sessionId]);
  useEffect(() => {
    queueMicrotask(() => {
      setNow(Date.now());
      void load();
    });
    const source = new EventSource(`/api/play/sessions/${sessionId}/events`);
    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);
    source.addEventListener("progression", () => void load());
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => {
      source.close();
      clearInterval(timer);
    };
  }, [load, sessionId]);
  const waitRemaining = useMemo(
    () => Math.max(0, Date.parse(state?.pendingVerification?.expiresAt ?? "") - now),
    [now, state],
  );
  async function act(action: "continue" | "confirm" | "answer" | "choice" | "timer", extra: JsonObject = {}) {
    setBusy(true);
    setError("");
    const response = await fetch(`/api/play/sessions/${sessionId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(state?.csrfToken ? { "x-csrf-token": state.csrfToken } : {}),
      },
      body: JSON.stringify({ action, idempotencyKey: crypto.randomUUID(), answer, ...extra }),
    });
    const body = (await response.json()) as { state?: State; accepted?: boolean; error?: string };
    if (!response.ok) setError(body.error ?? "The story could not advance.");
    else if (body.state) {
      setState({ ...body.state, csrfToken: body.state.csrfToken ?? state?.csrfToken });
      if (body.accepted) setAnswer("");
    }
    setBusy(false);
  }
  if (!state)
    return (
      <main className="player-runtime loading">
        <p role="status">{error || "Finding the current mark on the chart…"}</p>
      </main>
    );
  const choices =
    state.block?.blockType === "choice" && Array.isArray(state.block.configuration.choices)
      ? (state.block.configuration.choices as Array<Record<string, unknown>>)
      : [];
  return (
    <main className={`player-runtime ${state.session.previewMode ? "preview-mode" : ""}`}>
      <header>
        <div>
          <p className="eyebrow">
            {state.session.previewMode ? "Preview Mode — no real progress" : (state.chapter?.title ?? "Tall Tale")}
          </p>
          <h1>{state.tale.title}</h1>
        </div>
        <div className={`runtime-connection ${connected ? "connected" : "reconnecting"}`}>
          <i />
          {connected ? "Captain channel connected" : "Reconnecting to canonical state"}
        </div>
      </header>
      <section className="runtime-stage">
        {state.block ? (
          <PublishedBlockView block={state.block} assets={state.assets} />
        ) : (
          <article className="runtime-block unknown-block">
            <h2>No safe story block is available.</h2>
          </article>
        )}
        <div className="runtime-actions" aria-live="polite">
          {state.session.status === "COMPLETED" ? (
            <>
              <strong>This Tall Tale is complete.</strong>
              <Link className="brass-button" href={`/play/${state.tale.slug}/history`}>
                View voyage history
              </Link>
              <Link href="/tales">Choose another tale</Link>
            </>
          ) : state.pendingVerification?.providerType === "captainManual" ? (
            <div className="awaiting-captain">
              <span>◷</span>
              <strong>{String(state.block?.configuration.waitingText ?? "Awaiting the Captain's approval…")}</strong>
              <p>The player view will update automatically when the Captain responds.</p>
            </div>
          ) : state.pendingVerification?.providerType === "textAnswer" ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void act("answer");
              }}
            >
              <label>
                <span>Your answer</span>
                <input value={answer} onChange={(event) => setAnswer(event.target.value)} autoComplete="off" required />
              </label>
              <button className="brass-button" disabled={busy}>
                {busy ? "Testing the answer…" : "Submit answer"}
              </button>
            </form>
          ) : state.pendingVerification?.providerType === "timer" ? (
            <button className="brass-button" disabled={busy || waitRemaining > 0} onClick={() => void act("timer")}>
              {waitRemaining > 0 ? `Continue in ${Math.ceil(waitRemaining / 1000)}s` : "Continue"}
            </button>
          ) : choices.length ? (
            <div className="choice-actions">
              <p>{String(state.block?.configuration.prompt ?? "Choose a course.")}</p>
              {choices.map((choice) => (
                <button
                  key={String(choice.id ?? choice.label)}
                  disabled={busy || !choice.targetBlockId}
                  onClick={() => void act("choice", { targetBlockId: choice.targetBlockId })}
                >
                  <strong>{String(choice.label ?? "Choice")}</strong>
                  {Boolean(choice.description) && <span>{String(choice.description)}</span>}
                </button>
              ))}
            </div>
          ) : (
            <button
              className="brass-button"
              disabled={busy || state.block?.blockType === "condition" || state.block?.blockType === "setVariable"}
              onClick={() => void act("continue")}
            >
              {busy
                ? "Writing progress…"
                : String(
                    state.block?.configuration.buttonLabel ?? state.block?.configuration.primaryLabel ?? "Continue",
                  )}
            </button>
          )}
          {error && (
            <p className="runtime-error" role="alert">
              {error}
            </p>
          )}
        </div>
      </section>
      <footer>
        <span>
          Version {state.session.versionId.startsWith("draft:") ? "draft preview" : state.session.versionId.slice(0, 8)}
        </span>
        <span>Event sequence {state.session.currentSequence}</span>
      </footer>
    </main>
  );
}
