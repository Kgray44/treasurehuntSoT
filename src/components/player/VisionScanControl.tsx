"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { VisionOnboarding } from "@/components/vision/VisionOnboarding";
import {
  selectCapturePlatformAdapter,
  WebCapturePlatformAdapter,
  type CapturePlatformAdapter,
} from "@/vision/capture-adapters";
import type { CaptureCapabilities, CaptureStatus, CaptureTarget } from "@/vision/capture-protocol";
import { mockVisionScenarios, type MockVisionScenario, type VerificationAttemptState } from "@/vision/domain";
import { selectVisionPlatformAdapter, type VerificationAttemptResult } from "@/vision/platform-adapters";
import { flushVisionResults, pendingVisionEventCount, queueVisionResult } from "@/vision/pending-events";

type RuntimeAuthorization = {
  attemptId: string;
  stageToken: string;
  stageTokenExpiresAt: string;
  packageId: string;
  packageHash: string;
  waypointId: string;
  waypointVersionId: string;
  publishedVersionId: string;
  publishedBindingId: string;
  storyStateVersion: number;
  configuredMode: string;
  effectiveMode: "SHADOW" | "CAPTAIN_CONFIRMED" | "AUTOMATIC";
  demotionReason: string | null;
  scanInteraction: { mode: "HOLD" | "TOGGLE"; holdDurationMs: number };
  scanConfiguration: { durationMs: number; sampleFps: number; minimumFrames: number };
  guidanceConfiguration: Record<string, unknown>;
  rawFramesRetained: false;
};

type RuntimeAttemptView = VerificationAttemptResult & {
  effectiveRuntimeMode?: string;
  captainDecisionStatus?: string;
  eventDeliveryStatus: string;
  result: string | null;
  guidanceCode: string | null;
};

type ActiveScan = {
  authorization: RuntimeAuthorization;
  captureSessionId: string;
  startedAt: number;
};

const defaultResultCopy: Record<string, string> = {
  VERIFIED: "The landmark answers. Your Tall Tale is ready to continue.",
  INSUFFICIENT_VISUAL_EVIDENCE: "The view is not clear enough yet. Move slowly and include more of the surroundings.",
  NOT_AT_TARGET: "This view does not match the destination. Recheck the clue and try another bearing.",
  AMBIGUOUS: "Several places could match. Include another landmark and inspect again.",
  SYSTEM_ERROR: "The Companion could not complete the inspection. Your story progress is safe.",
  CANCELLED: "Inspection cancelled. Your story did not change.",
  STALE: "The Tall Tale moved on before this result arrived. No progress was changed.",
};

function companionInstanceId() {
  const key = "forever-treasure:companion-instance:v1";
  const current = localStorage.getItem(key);
  if (current) return current;
  const created = `companion_${crypto.randomUUID()}`;
  localStorage.setItem(key, created);
  return created;
}

function asRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("The Companion returned invalid data.");
  return value as Record<string, unknown>;
}

async function responseJson(response: Response) {
  const body = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    const error = new Error(String(body.error ?? `Vision request failed (${response.status}).`));
    error.name = "VisionHttpError";
    throw error;
  }
  return body;
}

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
  const configuredMode = String(configuration.runtimeMode ?? "DEVELOPMENT_MOCK");
  const development = configuredMode === "DEVELOPMENT" || configuredMode === "DEVELOPMENT_MOCK";
  const mockAdapter = useMemo(() => selectVisionPlatformAdapter(), []);
  const captureAdapter = useMemo<CapturePlatformAdapter | null>(
    () => (development ? null : selectCapturePlatformAdapter()),
    [development],
  );
  const browserAdapter = captureAdapter instanceof WebCapturePlatformAdapter ? captureAdapter : null;
  const [scenario, setScenario] = useState<MockVisionScenario>("verified");
  const [status, setStatus] = useState<VerificationAttemptState>("IDLE");
  const [phase, setPhase] = useState("Waiting");
  const [result, setResult] = useState<RuntimeAttemptView | null>(null);
  const [error, setError] = useState("");
  const [holding, setHolding] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const [capabilities, setCapabilities] = useState<CaptureCapabilities | null>(null);
  const [companionStatus, setCompanionStatus] = useState<CaptureStatus | null>(null);
  const [targets, setTargets] = useState<CaptureTarget[]>([]);
  const [pairingRequested, setPairingRequested] = useState(false);
  const [pairingCode, setPairingCode] = useState("");
  const [connected, setConnected] = useState(development);
  const [busy, setBusy] = useState("");
  const [activeScan, setActiveScan] = useState<ActiveScan | null>(null);
  const [effectiveMode, setEffectiveMode] = useState(configuredMode);
  const [demotionReason, setDemotionReason] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const startedAt = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoStopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRef = useRef<ActiveScan | null>(null);
  const startPromise = useRef<Promise<void> | null>(null);
  const finishAfterStart = useRef(false);
  const holdDuration = Math.max(250, Math.min(Number(configuration.holdDurationMs ?? 5_000), 15_000));
  const mode = configuration.scanMode === "TOGGLE" ? "TOGGLE" : "HOLD";

  const refreshCompanion = useCallback(async () => {
    if (!captureAdapter) return;
    try {
      const [nextCapabilities, nextStatus] = await Promise.all([
        captureAdapter.getCapabilities(),
        captureAdapter.getStatus(),
      ]);
      setCapabilities(nextCapabilities);
      setCompanionStatus(nextStatus);
      setConnected(true);
      setError("");
    } catch (cause) {
      setConnected(false);
      if (!(cause instanceof Error && cause.message.includes("Pairing is required")))
        setError(cause instanceof Error ? cause.message : "The local Companion is unavailable.");
    }
  }, [captureAdapter]);

  useEffect(() => {
    if (development) return;
    queueMicrotask(() => void refreshCompanion());
    const interval = setInterval(() => void refreshCompanion(), 2_000);
    const unsubscribe = captureAdapter?.subscribe((event) => {
      if (event.eventName !== "vision-runtime-progress") return;
      const payload = asRecord(event.payload);
      const nextPhase = String(payload.stage ?? payload.state ?? "PROCESSING");
      setPhase(nextPhase.replaceAll("_", " ").toLocaleLowerCase());
    });
    return () => {
      clearInterval(interval);
      unsubscribe?.();
    };
  }, [captureAdapter, development, refreshCompanion]);

  useEffect(() => {
    if (development) return;
    const flush = async () => {
      setPendingCount(pendingVisionEventCount());
      if (!navigator.onLine) return;
      try {
        await flushVisionResults(sessionId, csrfToken);
        setPendingCount(pendingVisionEventCount());
        await onStoryChanged();
      } catch {
        setPendingCount(pendingVisionEventCount());
      }
    };
    void flush();
    window.addEventListener("online", flush);
    return () => window.removeEventListener("online", flush);
  }, [csrfToken, development, onStoryChanged, sessionId]);

  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current);
      if (autoStopTimer.current) clearTimeout(autoStopTimer.current);
    },
    [],
  );

  const targetReady = Boolean(companionStatus?.target && companionStatus.target.dimensions.width > 0);
  const runtimeReady = Boolean(
    connected &&
      capabilities?.localInference &&
      capabilities.locationVerification &&
      capabilities.playerScan &&
      targetReady &&
      !companionStatus?.privacy.paused,
  );
  const busyState = [
    "ARMED",
    "CAPTURING",
    "CURATING_FRAMES",
    "RETRIEVING",
    "MATCHING",
    "LOCALIZING",
    "EVALUATING_SEQUENCE",
    "EVALUATING_SPECIAL_RULES",
  ].includes(status);

  function stopProgress() {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    if (autoStopTimer.current) clearTimeout(autoStopTimer.current);
    autoStopTimer.current = null;
    setHolding(false);
    setHoldProgress(0);
  }

  async function runDevelopmentScan() {
    stopProgress();
    setError("");
    setResult(null);
    try {
      const completed = await mockAdapter.beginPlayerScan({
        sessionId,
        blockId,
        waypointVersionId,
        scenario,
        csrfToken,
        onProgress: (next) => {
          setStatus(next);
          setPhase(next.replaceAll("_", " ").toLocaleLowerCase());
        },
      });
      setResult(completed);
      setStatus(completed.attemptState);
      if (completed.result === "VERIFIED") await onStoryChanged();
    } catch (cause) {
      setStatus("ERROR");
      setError(cause instanceof Error ? cause.message : "Inspection failed.");
    }
  }

  function beginDevelopmentHold() {
    if (holding || !waypointVersionId || status === "CAPTURING") return;
    if (mode === "TOGGLE") {
      void runDevelopmentScan();
      return;
    }
    setHolding(true);
    startedAt.current = performance.now();
    timer.current = setInterval(() => {
      const fraction = Math.min(1, (performance.now() - startedAt.current) / holdDuration);
      setHoldProgress(fraction);
      if (fraction >= 1) void runDevelopmentScan();
    }, 50);
  }

  async function startRuntimeScan() {
    if (!captureAdapter || activeRef.current || !runtimeReady || startPromise.current) return;
    const pending = (async () => {
      setBusy("starting");
      setError("");
      setResult(null);
      setStatus("ARMED");
      setPhase("arming the local verifier");
      const instanceId = companionInstanceId();
      try {
        const authorization = (await responseJson(
          await fetch("/api/vision-runtime/attempts", {
            method: "POST",
            cache: "no-store",
            headers: {
              "Content-Type": "application/json",
              ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
            },
            body: JSON.stringify({
              sessionId,
              blockId,
              waypointVersionId,
              platform: window.tallTaleDesktop
                ? "DESKTOP"
                : window.matchMedia("(display-mode: standalone)").matches
                  ? "PWA"
                  : "WEB",
              adapterType: window.tallTaleDesktop ? "DESKTOP" : "WEB_COMPANION",
              companionInstanceId: instanceId,
            }),
          }),
        )) as unknown as RuntimeAuthorization;
        setEffectiveMode(authorization.effectiveMode);
        setDemotionReason(authorization.demotionReason);
        setPhase("validating the immutable local package");
        const packageResponse = await responseJson(
          await fetch(
            `/api/vision-runtime/packages/${encodeURIComponent(authorization.packageId)}?attemptId=${encodeURIComponent(authorization.attemptId)}`,
            { cache: "no-store" },
          ),
        );
        if (
          packageResponse.packageId !== authorization.packageId ||
          packageResponse.packageHash !== authorization.packageHash
        )
          throw new Error("The downloaded runtime package identity does not match the armed attempt.");
        await captureAdapter.installVisionPackage({
          package: asRecord(packageResponse.package),
        });
        await captureAdapter.armVisionRuntime({
          attemptId: authorization.attemptId,
          packageId: authorization.packageId,
          waypointVersionId: authorization.waypointVersionId,
          stageToken: authorization.stageToken,
          expectedStageToken: authorization.stageToken,
          timeoutMs: 12_000,
          allowProviderFallback: true,
          checkpointContext: {
            publishedVersionId: authorization.publishedVersionId,
            publishedBindingId: authorization.publishedBindingId,
            storyStateVersion: authorization.storyStateVersion,
          },
        });
        const capture = await captureAdapter.beginPlayerScan({
          requestId: `request_${crypto.randomUUID()}`,
          attemptId: authorization.attemptId,
          ...authorization.scanConfiguration,
        });
        const active = { authorization, captureSessionId: capture.sessionId, startedAt: performance.now() };
        activeRef.current = active;
        setActiveScan(active);
        setHolding(true);
        setStatus("CAPTURING");
        setPhase("capturing selected game window");
        timer.current = setInterval(() => {
          const elapsed = performance.now() - active.startedAt;
          setHoldProgress(Math.min(1, elapsed / authorization.scanConfiguration.durationMs));
        }, 100);
        autoStopTimer.current = setTimeout(() => void finishRuntimeScan(), authorization.scanConfiguration.durationMs);
        if (finishAfterStart.current) {
          finishAfterStart.current = false;
          await finishRuntimeScan();
        }
      } catch (cause) {
        setStatus("ERROR");
        setError(cause instanceof Error ? cause.message : "The Companion could not start the inspection.");
      } finally {
        setBusy("");
      }
    })();
    startPromise.current = pending;
    await pending.finally(() => {
      startPromise.current = null;
    });
  }

  async function finishRuntimeScan() {
    if (startPromise.current && !activeRef.current) {
      finishAfterStart.current = true;
      return;
    }
    const active = activeRef.current;
    if (!captureAdapter || !active || busy === "finishing") return;
    setBusy("finishing");
    stopProgress();
    setStatus("CURATING_FRAMES");
    setPhase("curating captured evidence");
    try {
      const completion = await captureAdapter.stopPlayerScan(active.captureSessionId);
      if (!completion.verificationResult)
        throw new Error("The Companion captured evidence but did not produce a B-4 verification result.");
      const engine = asRecord(completion.verificationResult);
      const payload = {
        stageToken: active.authorization.stageToken,
        waypointId: String(engine.waypointId),
        waypointVersionId: String(engine.waypointVersionId),
        packageId: String(engine.packageId),
        packageHash: active.authorization.packageHash,
        companionInstanceId: companionInstanceId(),
        result: String(engine.result),
        guidanceCode: String(engine.guidanceCode),
        failedGates: Array.isArray(engine.failedGates) ? engine.failedGates : [],
        evidenceDigest: engine.evidenceDigest === null ? null : String(engine.evidenceDigest),
        engineVersion: String(engine.engineVersion),
        modelBundleVersion: String(engine.modelBundleVersion),
        provider: String(engine.provider),
        providerFallbackUsed: Boolean(engine.providerFallbackUsed),
        capturedFrameCount: Number(engine.capturedFrameCount),
        usableFrameCount: Number(engine.usableFrameCount),
        passingFrameCount: Number(engine.passingFrameCount),
        durationMs: Number(engine.durationMs),
        rawFramesRetained: false as const,
        diagnostics: asRecord(engine.diagnostics),
        observedAt: new Date().toISOString(),
      };
      let completed: RuntimeAttemptView;
      try {
        completed = (await responseJson(
          await fetch(`/api/vision-runtime/attempts/${active.authorization.attemptId}/result`, {
            method: "POST",
            cache: "no-store",
            headers: {
              "Content-Type": "application/json",
              ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
            },
            body: JSON.stringify(payload),
          }),
        )) as unknown as RuntimeAttemptView;
      } catch (cause) {
        if (cause instanceof Error && cause.name === "VisionHttpError") throw cause;
        await queueVisionResult({
          attemptId: active.authorization.attemptId,
          storyStateVersion: active.authorization.storyStateVersion,
          payload,
        });
        setPendingCount(pendingVisionEventCount());
        setStatus("RESULT_DISPLAYED");
        setPhase("saved locally; waiting to reconnect");
        setError("The result is saved on this device and will reconcile when the voyage reconnects.");
        return;
      }
      setResult(completed);
      setStatus(completed.attemptState);
      setPhase(
        completed.eventDeliveryStatus === "DELIVERED"
          ? "story event delivered"
          : completed.captainDecisionStatus === "PENDING"
            ? "awaiting Captain"
            : "result recorded",
      );
      if (completed.eventDeliveryStatus === "DELIVERED") {
        const presentationUrl = `/api/vision-runtime/attempts/${active.authorization.attemptId}/presentation`;
        const headers = {
          "Content-Type": "application/json",
          ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
        };
        await fetch(presentationUrl, {
          method: "POST",
          headers,
          body: JSON.stringify({ status: "STARTED" }),
        }).catch(() => undefined);
        try {
          await onStoryChanged();
          await fetch(presentationUrl, {
            method: "POST",
            headers,
            body: JSON.stringify({ status: "COMPLETED" }),
          });
        } catch (presentationError) {
          await fetch(presentationUrl, {
            method: "POST",
            headers,
            body: JSON.stringify({ status: "FAILED", errorCode: "JOURNAL_PRESENTATION_FAILED" }),
          }).catch(() => undefined);
          throw presentationError;
        }
      }
    } catch (cause) {
      setStatus("ERROR");
      setError(cause instanceof Error ? cause.message : "The Companion could not finish the inspection.");
    } finally {
      await captureAdapter.disarmVisionRuntime(active.authorization.attemptId).catch(() => undefined);
      activeRef.current = null;
      setActiveScan(null);
      setBusy("");
    }
  }

  async function cancelRuntimeScan() {
    const active = activeRef.current;
    if (!captureAdapter || !active) return;
    stopProgress();
    setBusy("cancelling");
    try {
      await captureAdapter.cancelPlayerScan(active.captureSessionId);
      await captureAdapter.disarmVisionRuntime(active.authorization.attemptId);
      await responseJson(
        await fetch(`/api/verification-attempts/${active.authorization.attemptId}/cancel`, {
          method: "POST",
          headers: csrfToken ? { "x-csrf-token": csrfToken } : {},
        }),
      );
      setStatus("CANCELLED");
      setPhase("cancelled safely");
      setResult({
        id: active.authorization.attemptId,
        attemptState: "CANCELLED",
        result: "CANCELLED",
        guidanceCode: "ATTEMPT_CANCELLED",
        eventDeliveryStatus: "NOT_DELIVERED",
        duplicateResultRejected: false,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The inspection could not be cancelled.");
    } finally {
      activeRef.current = null;
      setActiveScan(null);
      setBusy("");
    }
  }

  async function requestPairing() {
    if (!browserAdapter) return;
    setBusy("pairing");
    setError("");
    try {
      await browserAdapter.requestPairing();
      setPairingRequested(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Pairing could not start.");
    } finally {
      setBusy("");
    }
  }

  async function completePairing() {
    if (!browserAdapter) return;
    setBusy("pairing");
    setError("");
    try {
      await browserAdapter.completePairing(pairingCode);
      setPairingCode("");
      await refreshCompanion();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The pairing code was rejected.");
    } finally {
      setBusy("");
    }
  }

  async function loadTargets() {
    if (!captureAdapter) return;
    setBusy("targets");
    try {
      setTargets(await captureAdapter.listTargets());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Capture windows are unavailable.");
    } finally {
      setBusy("");
    }
  }

  const resultMessage = result?.result
    ? typeof configuration[
        result.result === "INSUFFICIENT_VISUAL_EVIDENCE"
          ? "insufficientMessage"
          : result.result === "AMBIGUOUS"
            ? "ambiguousMessage"
            : result.result === "NOT_AT_TARGET"
              ? "notAtTargetMessage"
              : result.result === "SYSTEM_ERROR"
                ? "systemErrorMessage"
                : ""
      ] === "string"
      ? String(
          configuration[
            result.result === "INSUFFICIENT_VISUAL_EVIDENCE"
              ? "insufficientMessage"
              : result.result === "AMBIGUOUS"
                ? "ambiguousMessage"
                : result.result === "NOT_AT_TARGET"
                  ? "notAtTargetMessage"
                  : result.result === "SYSTEM_ERROR"
                    ? "systemErrorMessage"
                    : ""
          ],
        )
      : (defaultResultCopy[result.result] ?? result.guidanceCode ?? "Inspection complete.")
    : null;

  return (
    <section className="vision-scan-control" aria-labelledby="vision-scan-title">
      <VisionOnboarding role="PLAYER" />
      <p className="eyebrow">
        {development ? "Development Vision" : `${effectiveMode.replaceAll("_", " ")} · local Companion`}
      </p>
      <h2 id="vision-scan-title">{String(configuration.prompt ?? "Inspect Surroundings")}</h2>
      {development ? (
        <p>This authorized deterministic mock does not access the game window.</p>
      ) : (
        <p>
          Only the selected game window is sampled. Frames remain in memory, are cleared after inference, and are not
          uploaded.
        </p>
      )}

      {!development && demotionReason && (
        <p className="vision-runtime-notice" role="status">
          Automatic progression is unavailable: {demotionReason.replaceAll("_", " ").toLocaleLowerCase()}. A Captain
          decision is required.
        </p>
      )}

      {!development && !connected && browserAdapter && (
        <div className="vision-pairing">
          <strong>Pair the local Companion</strong>
          <p>Approve this site in the Windows Companion, then enter its six-digit code.</p>
          {!pairingRequested ? (
            <button type="button" onClick={() => void requestPairing()} disabled={Boolean(busy)}>
              Request pairing
            </button>
          ) : (
            <div>
              <label>
                <span>Pairing code</span>
                <input
                  value={pairingCode}
                  inputMode="numeric"
                  maxLength={6}
                  onChange={(event) => setPairingCode(event.target.value.replace(/\D/g, ""))}
                />
              </label>
              <button
                type="button"
                onClick={() => void completePairing()}
                disabled={pairingCode.length !== 6 || Boolean(busy)}
              >
                Complete pairing
              </button>
            </div>
          )}
        </div>
      )}

      {!development && connected && !targetReady && (
        <div className="vision-target-picker">
          <strong>Select the Sea of Thieves window</strong>
          <button type="button" onClick={() => void loadTargets()} disabled={Boolean(busy)}>
            Find game windows
          </button>
          {targets.length > 0 && (
            <ul>
              {targets.map((target) => (
                <li key={target.targetId}>
                  <button
                    type="button"
                    disabled={!target.available || Boolean(busy)}
                    onClick={async () => {
                      await captureAdapter?.selectTarget(target.targetId, true);
                      await refreshCompanion();
                    }}
                  >
                    {target.privacyLabel}
                    {target.likelySeaOfThieves ? " · Sea of Thieves" : ""}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {development && process.env.NODE_ENV !== "production" && (
        <label className="vision-scenario">
          <span>Test scenario</span>
          <select
            value={scenario}
            disabled={busyState || holding}
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
        disabled={
          (development && busyState) ||
          !waypointVersionId ||
          (!development && (!runtimeReady || Boolean(busy && busy !== "starting" && !activeScan))) ||
          configuredMode === "DISABLED"
        }
        style={{ "--scan-progress": `${holdProgress * 100}%` } as React.CSSProperties}
        onPointerDown={() => {
          if (development) beginDevelopmentHold();
          else if (mode === "HOLD") void startRuntimeScan();
        }}
        onPointerUp={() => {
          if (development) {
            if (holding && performance.now() - startedAt.current + 75 >= holdDuration) void runDevelopmentScan();
            else if (holding) stopProgress();
          } else if (mode === "HOLD") void finishRuntimeScan();
        }}
        onPointerCancel={() => {
          if (development) stopProgress();
          else void cancelRuntimeScan();
        }}
        onKeyDown={(event) => {
          if ((event.key === " " || event.key === "Enter") && !event.repeat && mode === "HOLD") {
            event.preventDefault();
            if (development) beginDevelopmentHold();
            else void startRuntimeScan();
          }
        }}
        onKeyUp={(event) => {
          if ((event.key === " " || event.key === "Enter") && mode === "HOLD") {
            event.preventDefault();
            if (development) {
              if (holding && performance.now() - startedAt.current + 75 >= holdDuration) void runDevelopmentScan();
              else if (holding) stopProgress();
            } else void finishRuntimeScan();
          }
        }}
        onClick={() => {
          if (mode !== "TOGGLE") return;
          if (development) void runDevelopmentScan();
          else if (activeScan) void finishRuntimeScan();
          else void startRuntimeScan();
        }}
      >
        {busyState || activeScan
          ? mode === "TOGGLE"
            ? "Finish Inspection"
            : `Keep holding · ${Math.ceil(holdProgress * 100)}%`
          : mode === "HOLD"
            ? "Hold to Inspect Surroundings"
            : "Start Inspecting"}
      </button>

      {!development && activeScan && (
        <button type="button" className="vision-cancel-button" onClick={() => void cancelRuntimeScan()}>
          Cancel inspection
        </button>
      )}

      <div className="vision-scan-status" role="status" aria-live="polite">
        <strong>{phase}</strong>
        {!development && (
          <p>
            Companion {connected ? "connected" : "not connected"} · game window{" "}
            {targetReady ? "selected" : "not selected"}
          </p>
        )}
        {resultMessage && <p>{resultMessage}</p>}
        {result?.captainDecisionStatus === "PENDING" && (
          <p>The verified result is waiting for the Captain. The story has not advanced.</p>
        )}
        {result?.duplicateResultRejected && (
          <p>Duplicate result safely rejected; story progress was written exactly once.</p>
        )}
        {pendingCount > 0 && (
          <p>{pendingCount} derived result event is stored on this device and waiting to reconnect.</p>
        )}
        {error && <p className="runtime-error">{error}</p>}
      </div>
    </section>
  );
}
