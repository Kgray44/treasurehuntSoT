"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { VisionOnboarding } from "@/components/vision/VisionOnboarding";

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
  runtimeMode?: string;
  effectiveRuntimeMode?: string;
  captainDecisionStatus?: string;
  captainAction?: string | null;
  presentationStatus?: string;
  evidenceDigest?: string | null;
  failedGates?: string[];
  engineVersion?: string | null;
  modelBundleVersion?: string | null;
  provider?: string | null;
  providerFallbackUsed?: boolean;
  capturedFrameCount?: number;
  usableFrameCount?: number;
  passingFrameCount?: number;
  durationMs?: number | null;
  rawFramesRetained?: boolean;
  packageHash?: string | null;
  createdAt: string;
  resultReceivedAt?: string | null;
  progressionAppliedAt?: string | null;
  waypoint?: { name: string };
  waypointVersion?: { versionNumber: number; lifecycleStatus: string };
  transitions?: Array<{ sequence: number; toState: string; createdAt: string }>;
  captainDecisions?: Array<{
    id: string;
    action: string;
    reason: string;
    truthLabel: string | null;
    createdAt: string;
  }>;
  presentationRuns?: Array<{ id: string; storyEventKey: string; status: string; errorCode: string | null }>;
};

const truthLabels = [
  "TRUE_POSITIVE",
  "FALSE_POSITIVE",
  "TRUE_NEGATIVE",
  "FALSE_NEGATIVE",
  "INSUFFICIENT",
  "AMBIGUOUS",
  "UNREVIEWABLE",
] as const;

function normalizeAttempt(attempt: Attempt): Attempt {
  const raw = attempt.failedGates as unknown;
  if (Array.isArray(raw)) return { ...attempt, failedGates: raw.map(String) };
  if (typeof raw !== "string") return { ...attempt, failedGates: [] };
  try {
    const parsed = JSON.parse(raw) as unknown;
    return { ...attempt, failedGates: Array.isArray(parsed) ? parsed.map(String) : [] };
  } catch {
    return { ...attempt, failedGates: raw.trim() ? [raw] : [] };
  }
}

export function VisionAttemptDiagnostics({ sessionId }: { sessionId: string }) {
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [csrf, setCsrf] = useState("");
  const [busy, setBusy] = useState("");
  const [platformSummary, setPlatformSummary] = useState<Record<string, unknown>>({});
  const load = useCallback(async () => {
    const [legacy, governed, diagnostics] = await Promise.all([
      fetch(`/api/verification-attempts?sessionId=${encodeURIComponent(sessionId)}`, { cache: "no-store" }),
      fetch(`/api/vision-runtime/attempts?sessionId=${encodeURIComponent(sessionId)}`, { cache: "no-store" }),
      fetch(`/api/vision-diagnostics?sessionId=${encodeURIComponent(sessionId)}`, { cache: "no-store" }),
    ]);
    const combined = new Map<string, Attempt>();
    if (legacy.ok) {
      const body = (await legacy.json()) as { csrfToken?: string; attempts: Attempt[] };
      for (const attempt of body.attempts) combined.set(attempt.id, normalizeAttempt(attempt));
      if (body.csrfToken) setCsrf(body.csrfToken);
    }
    if (governed.ok) {
      const body = (await governed.json()) as { csrfToken?: string; attempts: Attempt[] };
      for (const attempt of body.attempts) combined.set(attempt.id, normalizeAttempt(attempt));
      if (body.csrfToken) setCsrf(body.csrfToken);
    }
    setAttempts(
      [...combined.values()].sort(
        (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
      ),
    );
    if (diagnostics.ok) setPlatformSummary((await diagnostics.json()) as Record<string, unknown>);
  }, [sessionId]);

  useEffect(() => {
    queueMicrotask(() => void load());
    const timer = setInterval(() => void load(), 2_000);
    return () => clearInterval(timer);
  }, [load]);

  async function captainAction(
    attempt: Attempt,
    action:
      | "APPROVE"
      | "REJECT"
      | "REQUEST_RESCAN"
      | "MANUAL_OVERRIDE"
      | "LABEL_TRUTH"
      | "PAUSE_AUTOMATIC"
      | "DEMOTE_TO_CAPTAIN_CONFIRMED"
      | "PROMOTE_TO_CAPTAIN_CONFIRMED"
      | "PROMOTE_TO_AUTOMATIC",
    truthLabel?: (typeof truthLabels)[number],
  ) {
    const reason = window.prompt(`Record the reason for ${action.replaceAll("_", " ").toLocaleLowerCase()}:`);
    if (!reason) return;
    if (
      ["MANUAL_OVERRIDE", "PAUSE_AUTOMATIC", "DEMOTE_TO_CAPTAIN_CONFIRMED"].includes(action) &&
      !window.confirm("This changes governed story or runtime behavior and will be permanently audited. Continue?")
    )
      return;
    setBusy(`${attempt.id}:${action}`);
    setError("");
    try {
      const response = await fetch(`/api/vision-runtime/attempts/${attempt.id}/captain-action`, {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
        body: JSON.stringify({
          action,
          reason,
          truthLabel,
          idempotencyKey: `captain:${attempt.id}:${crypto.randomUUID()}`,
        }),
      });
      const body = (await response.json()) as { error?: string; code?: string };
      if (!response.ok) throw new Error(`${body.error ?? "Captain action failed."} (${body.code ?? response.status})`);
      setMessage(`${action.replaceAll("_", " ")} recorded for ${attempt.id.slice(0, 12)}.`);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Captain action failed.");
    } finally {
      setBusy("");
    }
  }

  const diagnostic = useMemo(
    () =>
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          appVersion: "0.8.0-b6",
          protocolVersions: ["1.0", "2.0"],
          implementation: "player-story-captain-governed-integration",
          sessionId,
          platformSummary,
          rawFramesIncluded: false,
          attempts,
        },
        null,
        2,
      ),
    [attempts, platformSummary, sessionId],
  );

  return (
    <section className="vision-diagnostics">
      <VisionOnboarding role="CAPTAIN" />
      <p className="card-kicker">Phase B-5 · governed Vision</p>
      <header>
        <div>
          <h2>Vision attempt diagnostics</h2>
          <strong>Active waypoint and governed attempt ledger</strong>
          <p>Exact package, model, result, decision, and story-delivery evidence. Raw frames are never shown.</p>
        </div>
        <button
          onClick={async () => {
            await navigator.clipboard.writeText(diagnostic);
            setMessage("Derived diagnostic summary copied.");
          }}
        >
          Copy summary
        </button>
      </header>
      {message && <p role="status">{message}</p>}
      {error && (
        <p className="runtime-error" role="alert">
          {error}
        </p>
      )}
      {!attempts.length ? (
        <p>No Vision attempts have been recorded for this session.</p>
      ) : (
        <ol className="vision-attempt-list">
          {attempts.map((attempt) => {
            const governed = attempt.protocolVersion === "2.0";
            const actionBusy = busy.startsWith(attempt.id);
            return (
              <li key={attempt.id}>
                <div>
                  <strong>{attempt.waypoint?.name ?? "Vision Waypoint"}</strong>
                  <code>{attempt.id.slice(0, 18)}</code>
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
                    <dt>Story delivery</dt>
                    <dd>{attempt.eventDeliveryStatus}</dd>
                  </div>
                  <div>
                    <dt>Runtime mode</dt>
                    <dd>{attempt.effectiveRuntimeMode ?? attempt.runtimeMode ?? "DEVELOPMENT_MOCK"}</dd>
                  </div>
                  <div>
                    <dt>Captain decision</dt>
                    <dd>{attempt.captainDecisionStatus ?? attempt.captainAction ?? "not required"}</dd>
                  </div>
                  <div>
                    <dt>Runtime</dt>
                    <dd>
                      {attempt.platform} · {attempt.adapterType}
                    </dd>
                  </div>
                  <div>
                    <dt>Contract</dt>
                    <dd>
                      protocol {attempt.protocolVersion} · frames retained: {attempt.rawFramesRetained ? "yes" : "no"}
                    </dd>
                  </div>
                  {governed && (
                    <>
                      <div>
                        <dt>Engine</dt>
                        <dd>
                          {attempt.engineVersion ?? "pending"} · {attempt.modelBundleVersion ?? "pending"}
                        </dd>
                      </div>
                      <div>
                        <dt>Provider</dt>
                        <dd>
                          {attempt.provider ?? "pending"}
                          {attempt.providerFallbackUsed ? " · fallback used" : ""}
                        </dd>
                      </div>
                      <div>
                        <dt>Evidence</dt>
                        <dd>
                          {attempt.passingFrameCount ?? 0}/{attempt.usableFrameCount ?? 0}/
                          {attempt.capturedFrameCount ?? 0} passing/usable/captured
                        </dd>
                      </div>
                      <div>
                        <dt>Duration</dt>
                        <dd>
                          {attempt.durationMs === null || attempt.durationMs === undefined
                            ? "pending"
                            : `${attempt.durationMs} ms`}
                        </dd>
                      </div>
                    </>
                  )}
                </dl>
                {attempt.failedGates && attempt.failedGates.length > 0 && (
                  <p className="diagnostic-guardrail">Failed gates: {attempt.failedGates.join(", ")}</p>
                )}
                {(attempt.duplicateResultRejected || attempt.staleResultRejected) && (
                  <p className="diagnostic-guardrail">
                    {attempt.duplicateResultRejected ? "Duplicate rejected" : "Stale result rejected"}
                  </p>
                )}
                {governed && (
                  <div className="vision-captain-actions" aria-label={`Captain actions for ${attempt.id}`}>
                    {attempt.result === "VERIFIED" && attempt.effectiveRuntimeMode !== "SHADOW" && (
                      <button disabled={actionBusy} onClick={() => void captainAction(attempt, "APPROVE")}>
                        Approve verified result
                      </button>
                    )}
                    <button disabled={actionBusy} onClick={() => void captainAction(attempt, "REJECT")}>
                      Reject
                    </button>
                    <button disabled={actionBusy} onClick={() => void captainAction(attempt, "REQUEST_RESCAN")}>
                      Request rescan
                    </button>
                    <button disabled={actionBusy} onClick={() => void captainAction(attempt, "MANUAL_OVERRIDE")}>
                      Manual override
                    </button>
                    <label>
                      <span>Human truth label</span>
                      <select
                        defaultValue=""
                        disabled={actionBusy}
                        onChange={(event) => {
                          if (!event.target.value) return;
                          void captainAction(
                            attempt,
                            "LABEL_TRUTH",
                            event.target.value as (typeof truthLabels)[number],
                          );
                          event.target.value = "";
                        }}
                      >
                        <option value="">Choose label</option>
                        {truthLabels.map((label) => (
                          <option key={label} value={label}>
                            {label.replaceAll("_", " ").toLocaleLowerCase()}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button disabled={actionBusy} onClick={() => void captainAction(attempt, "PAUSE_AUTOMATIC")}>
                      Pause automatic
                    </button>
                    <button
                      disabled={actionBusy}
                      onClick={() => void captainAction(attempt, "DEMOTE_TO_CAPTAIN_CONFIRMED")}
                    >
                      Demote to Captain-confirmed
                    </button>
                    {attempt.effectiveRuntimeMode === "SHADOW" && (
                      <button
                        disabled={actionBusy}
                        onClick={() => void captainAction(attempt, "PROMOTE_TO_CAPTAIN_CONFIRMED")}
                      >
                        Evaluate Captain-confirmed promotion
                      </button>
                    )}
                    <button disabled={actionBusy} onClick={() => void captainAction(attempt, "PROMOTE_TO_AUTOMATIC")}>
                      Evaluate automatic promotion
                    </button>
                  </div>
                )}
                {attempt.captainDecisions && attempt.captainDecisions.length > 0 && (
                  <details>
                    <summary>Captain decision history</summary>
                    <ol>
                      {attempt.captainDecisions.map((decision) => (
                        <li key={decision.id}>
                          <strong>{decision.action.replaceAll("_", " ")}</strong>
                          {decision.truthLabel ? ` · ${decision.truthLabel.replaceAll("_", " ")}` : ""}
                          <span> · {decision.reason}</span>
                        </li>
                      ))}
                    </ol>
                  </details>
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
            );
          })}
        </ol>
      )}
    </section>
  );
}
