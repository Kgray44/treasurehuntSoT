"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Attempt = {
  id: string;
  attemptState: string;
  result: string | null;
  guidanceCode: string | null;
  eventDeliveryStatus: string;
  duplicateResultRejected: boolean;
  staleResultRejected: boolean;
  platform: string;
  adapterType: string;
  protocolVersion: string;
  createdAt: string;
  waypoint?: { name: string };
  waypointVersion?: { versionNumber: number; lifecycleStatus: string };
  transitions?: Array<{ sequence: number; toState: string; createdAt: string }>;
};

export function VisionAttemptDiagnostics({ sessionId }: { sessionId: string }) {
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [message, setMessage] = useState("");
  const [platformSummary, setPlatformSummary] = useState<Record<string, unknown>>({});
  const load = useCallback(async () => {
    const [response, diagnostics] = await Promise.all([
      fetch(`/api/verification-attempts?sessionId=${encodeURIComponent(sessionId)}`, { cache: "no-store" }),
      fetch(`/api/vision-diagnostics?sessionId=${encodeURIComponent(sessionId)}`, { cache: "no-store" }),
    ]);
    if (!response.ok) return;
    const body = (await response.json()) as { attempts: Attempt[] };
    setAttempts(body.attempts);
    if (diagnostics.ok) setPlatformSummary((await diagnostics.json()) as Record<string, unknown>);
  }, [sessionId]);
  useEffect(() => {
    queueMicrotask(() => void load());
    const timer = setInterval(() => void load(), 2000);
    return () => clearInterval(timer);
  }, [load]);
  const diagnostic = useMemo(
    () =>
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          appVersion: "0.3.0-b1",
          protocolVersion: "1.0",
          packageSchemaVersion: 1,
          implementation: "deterministic-development-mock",
          sessionId,
          platformSummary,
          attempts,
        },
        null,
        2,
      ),
    [attempts, platformSummary, sessionId],
  );
  return (
    <section className="vision-diagnostics">
      <p className="card-kicker">Phase B-1 · deterministic Vision</p>
      <header>
        <div>
          <h2>Vision attempt diagnostics</h2>
          <p>No camera frames or raw evidence are stored.</p>
        </div>
        <button
          onClick={async () => {
            await navigator.clipboard.writeText(diagnostic);
            setMessage("Diagnostic summary copied.");
          }}
        >
          Copy summary
        </button>
      </header>
      {message && <p role="status">{message}</p>}
      {!attempts.length ? (
        <p>No Vision attempts have been recorded for this session.</p>
      ) : (
        <ol className="vision-attempt-list">
          {attempts.map((attempt) => (
            <li key={attempt.id}>
              <div>
                <strong>{attempt.waypoint?.name ?? "Vision Waypoint"}</strong>
                <code>{attempt.id.slice(0, 12)}</code>
              </div>
              <dl>
                <div>
                  <dt>State</dt>
                  <dd>{attempt.attemptState}</dd>
                </div>
                <div>
                  <dt>Result</dt>
                  <dd>{attempt.result ?? "pending"}</dd>
                </div>
                <div>
                  <dt>Delivery</dt>
                  <dd>{attempt.eventDeliveryStatus}</dd>
                </div>
                <div>
                  <dt>Runtime</dt>
                  <dd>
                    {attempt.platform} · {attempt.adapterType}
                  </dd>
                </div>
                <div>
                  <dt>Contract</dt>
                  <dd>protocol {attempt.protocolVersion} · package v1</dd>
                </div>
              </dl>
              {(attempt.duplicateResultRejected || attempt.staleResultRejected) && (
                <p className="diagnostic-guardrail">
                  {attempt.duplicateResultRejected ? "Duplicate rejected" : "Stale result rejected"}
                </p>
              )}
              <details>
                <summary>State transitions</summary>
                <ol>
                  {attempt.transitions?.map((step) => (
                    <li key={step.sequence}>
                      {step.sequence}. {step.toState}
                    </li>
                  ))}
                </ol>
              </details>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
