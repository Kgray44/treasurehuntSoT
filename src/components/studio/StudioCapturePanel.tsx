"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { CapturePlatformAdapter } from "@/vision/capture-adapters";
import type { CaptureStatus, CaptureTarget, CreatorStartInput } from "@/vision/capture-protocol";

function safeId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function messageFor(cause: unknown) {
  const text =
    cause && typeof cause === "object" && "userMessage" in cause
      ? String(cause.userMessage)
      : cause instanceof Error
        ? cause.message
        : "The Companion request failed.";
  if (/pair|authenticate|connect/i.test(text)) return `${text} Open Companion, approve this site, then reconnect.`;
  if (/target|window/i.test(text)) return `${text} Keep the game window open and select it again.`;
  return text;
}

export function StudioCapturePanel({
  adapter,
  versionId,
  csrfToken,
  purpose,
  label,
  onChanged,
}: {
  adapter: CapturePlatformAdapter;
  versionId: string;
  csrfToken: string;
  purpose: CreatorStartInput["purpose"];
  label: string;
  onChanged: () => Promise<void>;
}) {
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState<CaptureStatus | null>(null);
  const [targets, setTargets] = useState<CaptureTarget[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  useEffect(
    () =>
      adapter.subscribe((event) => {
        if (event.eventName === "status") setStatus(event.payload as CaptureStatus);
        if (event.eventName === "capture-error") setError(messageFor(event.payload));
      }),
    [adapter],
  );

  async function perform(name: string, action: () => Promise<void>) {
    setBusy(name);
    setError("");
    try {
      await action();
    } catch (cause) {
      setError(messageFor(cause));
    } finally {
      setBusy("");
    }
  }

  async function connect() {
    await perform("connect", async () => {
      await adapter.getCapabilities();
      setStatus(await adapter.getStatus());
      setConnected(true);
    });
  }

  async function findWindows() {
    await perform("targets", async () => {
      setTargets(await adapter.listTargets());
      setStatus(await adapter.getStatus());
    });
  }

  async function start() {
    await perform("start", async () => {
      const result = await adapter.beginCreatorRecording({
        requestId: safeId("request"),
        waypointVersionId: versionId,
        purpose,
        label,
        allowCloudUpload: false,
        maxDurationMs: 180_000,
      });
      setSessionId(String(result.sessionId));
      setPaused(false);
    });
  }

  async function stop() {
    if (!sessionId) return;
    await perform("stop", async () => {
      const result = await adapter.stopCreator(sessionId);
      const artifact = result.artifact;
      if (!artifact || typeof artifact !== "object")
        throw new Error(
          "Companion finished without a valid creator manifest. The local file was not claimed as saved to Studio.",
        );
      const response = await fetch("/api/vision-capture-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
        body: JSON.stringify(artifact),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(
          body.error ?? "The local recording was retained, but its manifest was not saved to this draft.",
        );
      setSessionId(null);
      setPaused(false);
      await onChanged();
    });
  }

  return (
    <section className="studio-capture-panel" aria-labelledby={`capture-${purpose}`}>
      <header>
        <div>
          <p className="eyebrow">B-2 Companion · real local capture</p>
          <h3 id={`capture-${purpose}`}>Record {label.toLocaleLowerCase()}</h3>
        </div>
        <span className={connected ? "connection-pill live" : "connection-pill"}>
          {connected ? "Connected" : "Not connected"}
        </span>
      </header>
      <p>
        Only the window you choose is captured. Recordings remain in Companion-managed local storage unless you
        explicitly authorize another state.
      </p>
      {!connected && (
        <div className="capture-recovery">
          <button type="button" onClick={() => void connect()} disabled={Boolean(busy)}>
            {busy === "connect" ? "Connecting…" : "Connect to Companion"}
          </button>
          <Link href="/vision-companion" target="_blank">
            Open pairing and privacy controls
          </Link>
        </div>
      )}
      {connected && (
        <>
          <div className="capture-toolbar">
            <button type="button" onClick={() => void findWindows()} disabled={Boolean(busy) || Boolean(sessionId)}>
              Refresh capturable windows
            </button>
            <span>{status?.target ? `Selected: ${status.target.privacyLabel}` : "No game window selected"}</span>
          </div>
          {targets.length > 0 && (
            <ul className="capture-target-list">
              {targets.map((target) => (
                <li key={target.targetId}>
                  <button
                    type="button"
                    onClick={() =>
                      void perform("select", async () => {
                        await adapter.selectTarget(target.targetId, false);
                        setStatus(await adapter.getStatus());
                      })
                    }
                    disabled={Boolean(busy) || Boolean(sessionId)}
                  >
                    {target.privacyLabel} · {target.dimensions.width}×{target.dimensions.height}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="capture-controls">
            <button
              type="button"
              className="brass-button"
              onClick={() => void start()}
              disabled={!status?.target || Boolean(sessionId) || Boolean(busy)}
            >
              Start recording
            </button>
            <button
              type="button"
              onClick={() =>
                sessionId &&
                void perform("pause", async () => {
                  await adapter.pauseCreator(sessionId);
                  setPaused(true);
                })
              }
              disabled={!sessionId || paused || Boolean(busy)}
            >
              Pause
            </button>
            <button
              type="button"
              onClick={() =>
                sessionId &&
                void perform("resume", async () => {
                  await adapter.resumeCreator(sessionId);
                  setPaused(false);
                })
              }
              disabled={!sessionId || !paused || Boolean(busy)}
            >
              Resume
            </button>
            <button type="button" onClick={() => void stop()} disabled={!sessionId || Boolean(busy)}>
              Stop and save
            </button>
            <button
              type="button"
              onClick={() =>
                sessionId &&
                void perform("cancel", async () => {
                  await adapter.cancelCreator(sessionId);
                  setSessionId(null);
                  setPaused(false);
                })
              }
              disabled={!sessionId || Boolean(busy)}
            >
              Cancel
            </button>
          </div>
          {sessionId && (
            <div className="capture-progress" role="status" aria-live="polite">
              <progress value={status?.session?.progress ?? 0} max={1} />
              <span>
                {paused
                  ? "Recording paused"
                  : `Recording · ${status?.session?.frameCount ?? 0} frames · ${status?.session?.droppedFrames ?? 0} dropped`}
              </span>
            </div>
          )}
        </>
      )}
      {error && (
        <p className="studio-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
