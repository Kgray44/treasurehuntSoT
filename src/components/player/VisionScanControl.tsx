"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { mockVisionScenarios, type MockVisionScenario, type VerificationAttemptState } from "@/vision/domain";
import { selectVisionPlatformAdapter, type VerificationAttemptResult } from "@/vision/platform-adapters";

const resultCopy: Record<string, string> = {
  VERIFIED: "Waypoint verified. The chart is advancing.",
  INSUFFICIENT_VISUAL_EVIDENCE: "More of the surroundings are needed. Move slowly and try again.",
  NOT_AT_TARGET: "This does not appear to be the target. Check the clue and try another bearing.",
  AMBIGUOUS: "The view is ambiguous. Include another landmark and inspect again.",
  SYSTEM_ERROR: "The development verifier could not finish. Ask the Captain for help.",
  CANCELLED: "Inspection cancelled. Nothing in the story changed.",
};

export function VisionScanControl({
  sessionId,
  blockId,
  waypointVersionId,
  csrfToken,
  configuration,
  onStoryChanged,
}: {
  sessionId: string;
  blockId: string;
  waypointVersionId: string;
  csrfToken?: string;
  configuration: Record<string, unknown>;
  onStoryChanged: () => Promise<void>;
}) {
  const adapter = useMemo(() => selectVisionPlatformAdapter(), []);
  const [scenario, setScenario] = useState<MockVisionScenario>("verified");
  const [status, setStatus] = useState<VerificationAttemptState>("IDLE");
  const [result, setResult] = useState<VerificationAttemptResult | null>(null);
  const [error, setError] = useState("");
  const [holding, setHolding] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const startedAt = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const holdDuration = Math.max(250, Math.min(Number(configuration.holdDurationMs ?? 5000), 15_000));
  const mode = configuration.scanMode === "TOGGLE" ? "TOGGLE" : "HOLD";

  function stopHold() {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setHolding(false);
    setHoldProgress(0);
  }

  async function scan() {
    stopHold();
    setError("");
    setResult(null);
    try {
      const completed = await adapter.beginPlayerScan({
        sessionId,
        blockId,
        waypointVersionId,
        scenario,
        csrfToken,
        onProgress: setStatus,
      });
      setResult(completed);
      setStatus(completed.attemptState);
      if (completed.result === "VERIFIED") await onStoryChanged();
    } catch (cause) {
      setStatus("ERROR");
      setError(cause instanceof Error ? cause.message : "Inspection failed.");
    }
  }

  function beginHold() {
    if (holding || !waypointVersionId || status === "CAPTURING") return;
    if (mode === "TOGGLE") {
      void scan();
      return;
    }
    setHolding(true);
    startedAt.current = performance.now();
    timer.current = setInterval(() => {
      const fraction = Math.min(1, (performance.now() - startedAt.current) / holdDuration);
      setHoldProgress(fraction);
      if (fraction >= 1) void scan();
    }, 50);
  }

  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current);
    },
    [],
  );

  const busy = [
    "ARMED",
    "CAPTURING",
    "CURATING_FRAMES",
    "RETRIEVING",
    "MATCHING",
    "LOCALIZING",
    "EVALUATING_SEQUENCE",
    "EVALUATING_SPECIAL_RULES",
  ].includes(status);
  return (
    <section className="vision-scan-control" aria-labelledby="vision-scan-title">
      <p className="eyebrow">Development Vision · {adapter.getPlatformKind()}</p>
      <h2 id="vision-scan-title">{String(configuration.prompt ?? "Inspect Surroundings")}</h2>
      <p>This Phase B-1 control uses a deterministic mock. It does not access a camera or the game.</p>
      {process.env.NODE_ENV !== "production" && (
        <label className="vision-scenario">
          <span>Test scenario</span>
          <select
            value={scenario}
            disabled={busy || holding}
            onChange={(event) => setScenario(event.target.value as MockVisionScenario)}
          >
            {mockVisionScenarios.map((item) => (
              <option key={item} value={item}>
                {item.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
      )}
      <button
        type="button"
        className={`vision-hold-button ${holding ? "holding" : ""}`}
        disabled={busy || !waypointVersionId}
        style={{ "--scan-progress": `${holdProgress * 100}%` } as React.CSSProperties}
        onPointerDown={beginHold}
        onPointerUp={() => {
          if (holding && holdProgress < 1) stopHold();
        }}
        onPointerCancel={stopHold}
        onPointerLeave={() => {
          if (holding && holdProgress < 1) stopHold();
        }}
        onKeyDown={(event) => {
          if ((event.key === " " || event.key === "Enter") && !event.repeat) beginHold();
        }}
        onKeyUp={(event) => {
          if ((event.key === " " || event.key === "Enter") && holding && holdProgress < 1) stopHold();
        }}
      >
        {busy
          ? "Inspecting…"
          : mode === "HOLD"
            ? holding
              ? `Keep holding · ${Math.ceil(holdProgress * 100)}%`
              : "Hold to Inspect Surroundings"
            : "Start Inspecting"}
      </button>
      <div className="vision-scan-status" role="status" aria-live="polite">
        <strong>{status.replaceAll("_", " ").toLocaleLowerCase()}</strong>
        {result?.result && <p>{resultCopy[result.result] ?? result.guidanceCode ?? "Inspection complete."}</p>}
        {result?.duplicateResultRejected && (
          <p>Duplicate result safely rejected; story progress was written exactly once.</p>
        )}
        {error && <p className="runtime-error">{error}</p>}
      </div>
    </section>
  );
}
