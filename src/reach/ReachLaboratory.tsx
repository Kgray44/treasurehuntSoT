"use client";
import { useEffect, useRef, useState } from "react";
import { ReachBrowserRuntime } from "./browser-runtime";
import {
  estimatedPoint,
  calibrationLayout,
  fitCalibration,
  stableSamples,
  validateCalibration,
  type Calibration,
  type CalibrationBinding,
  type CalibrationSample,
} from "./calibration";
import { PointFilter, pointingFeatures, type Point } from "./coordinates";
import { aggregateCalibrationExport } from "./privacy";
import { usableHand, type HandObservation } from "./observation";
import { syntheticObservation } from "./synthetic";
import styles from "./ReachLaboratory.module.css";
type Mode = "OFF" | "LIVE" | "SYNTHETIC";
type Trial = {
  stage: "TRAINING" | "VALIDATION";
  order: Point[];
  groups: CalibrationSample[][];
  collecting: CalibrationSample[];
  binding: CalibrationBinding | null;
  after: number;
};
export function ReachLaboratory() {
  const video = useRef<HTMLVideoElement>(null);
  const plane = useRef<HTMLDivElement>(null);
  const runtime = useRef<ReachBrowserRuntime | null>(null);
  const [mode, setMode] = useState<Mode>("OFF");
  const [replayGeneration, setReplayGeneration] = useState(1);
  const [status, setStatus] = useState("DISABLED");
  const [observation, setObservation] = useState<HandObservation | null>(null);
  const [calibration, setCalibration] = useState<Calibration | null>(null);
  const calibrationRef = useRef<Calibration | null>(null);
  const trial = useRef<Trial | null>(null);
  const [target, setTarget] = useState<Point | null>(null);
  const [progress, setProgress] = useState("Choose a mode to begin.");
  const [raw, setRaw] = useState<Point | null>(null);
  const [filtered, setFiltered] = useState<Point | null>(null);
  const filter = useRef(new PointFilter());
  const epoch = useRef(1);
  const [mirror, setMirror] = useState(false);
  const [exportConsent, setExportConsent] = useState(false);
  const [point, setPoint] = useState<Point>({ x: 0.5, y: 0.5 });
  const syntheticPoint = useRef(point);
  const lastObservation = useRef<HandObservation | null>(null);
  const [logs, setLogs] = useState<{ at: number; reason: string }[]>([]);
  const aggregateHistory = useRef<ReturnType<typeof aggregateCalibrationExport>[]>([]);
  const log = (reason: string) => setLogs((l) => [...l.slice(-99), { at: Math.round(performance.now()), reason }]);
  const invalidate = () => {
    trial.current = null;
    calibrationRef.current = null;
    setCalibration(null);
    setTarget(null);
    filter.current.reset();
    setRaw(null);
    setFiltered(null);
  };
  const bindingFor = (o: HandObservation): CalibrationBinding => ({
    providerId: o.providerId,
    modelDigest: o.modelDigest,
    providerGeneration: o.providerGeneration,
    cameraLeaseId: o.cameraLeaseId,
    cameraFrameVersion: o.cameraFrameVersion,
    viewportEpoch: epoch.current,
    viewportWidth: plane.current?.clientWidth ?? 1,
    viewportHeight: plane.current?.clientHeight ?? 1,
    mirror: o.mirrorTransform === "PREVIEW_X",
    orientation: o.orientation,
    trackId: o.hands[0]?.trackId ?? "missing",
    trackGeneration: o.hands[0]?.trackGeneration ?? 0,
    evidenceTier: o.evidenceTier,
  });
  const accept = useRef<(o: HandObservation) => void>(() => {});
  useEffect(() => {
    accept.current = (o) => {
      lastObservation.current = o;
      setObservation(o);
      const hand = usableHand(o);
      if (!hand) {
        setRaw(null);
        setFiltered(null);
        filter.current.reset();
        if (trial.current) trial.current.collecting = [];
        return;
      }
      const binding = bindingFor(o);
      if (
        calibrationRef.current &&
        Object.entries(calibrationRef.current.binding).some(([k, v]) => binding[k as keyof CalibrationBinding] !== v)
      ) {
        invalidate();
        setProgress("Observation context changed. Recalibration required.");
        log("CALIBRATION_CONTEXT_CHANGED");
        return;
      }
      let features: number[];
      try {
        features = pointingFeatures(hand);
      } catch {
        return;
      }
      const t = trial.current;
      if (t) {
        if (performance.now() < t.after) return;
        if (t.binding && Object.entries(t.binding).some(([k, v]) => binding[k as keyof CalibrationBinding] !== v)) {
          invalidate();
          setProgress("Camera, hand or viewport changed. Start a new calibration.");
          log("CALIBRATION_BINDING_CHANGED");
          return;
        }
        t.binding ??= binding;
        t.collecting.push({ features, at: o.monotonicCaptureTime, target: t.order[t.groups.length] });
        if (t.collecting.length > 30) t.collecting.shift();
        if (stableSamples(t.collecting)) {
          t.groups.push(t.collecting);
          t.collecting = [];
          if (t.groups.length === t.order.length) {
            try {
              const c =
                t.stage === "TRAINING"
                  ? fitCalibration(t.groups, t.binding, performance.now())
                  : validateCalibration(calibrationRef.current!, t.groups);
              calibrationRef.current = c;
              setCalibration(c);
              aggregateHistory.current = [...aggregateHistory.current.slice(-9), aggregateCalibrationExport(c, true)];
              trial.current = null;
              setTarget(null);
              setProgress(
                t.stage === "TRAINING"
                  ? "Fit ready. Run independent validation before using absolute estimates."
                  : c.status === "VALIDATED"
                    ? "Independent validation passed for this session and mode. Physical qualification remains separate."
                    : "Independent validation failed. Retry or use conventional controls.",
              );
              log(t.stage === "TRAINING" ? "FIT_COMPLETE" : `VALIDATION_${c.status}`);
            } catch {
              invalidate();
              setProgress("Insufficient stable evidence. Retry calibration.");
              log("FIT_REJECTED");
            }
          } else {
            t.after = performance.now() + 1500;
            setTarget(t.order[t.groups.length]);
            setProgress(
              `${t.stage}: ${t.groups.length}/${t.order.length} targets sampled. Point naturally at the next dot.`,
            );
          }
        }
      }
      const c = calibrationRef.current;
      const estimate = c ? estimatedPoint(c, o, binding, performance.now()) : null;
      setRaw(estimate);
      setFiltered(estimate ? filter.current.update(estimate, o.monotonicCaptureTime) : null);
    };
  });
  useEffect(() => {
    const r = new ReachBrowserRuntime(
      video.current!,
      (o) => accept.current(o),
      (state) => {
        setStatus(state);
        if (state !== "READY" && state !== "MODEL_STARTING" && state !== "REQUESTING") {
          lastObservation.current = null;
          setObservation(null);
          invalidate();
        }
      },
    );
    runtime.current = r;
    const changed = () => {
      ++epoch.current;
      invalidate();
      setProgress("Viewport changed. Recalibration required.");
    };
    window.addEventListener("resize", changed);
    window.addEventListener("scroll", changed, true);
    window.visualViewport?.addEventListener("resize", changed);
    window.visualViewport?.addEventListener("scroll", changed);
    const freshness = setInterval(() => {
      if (calibrationRef.current && performance.now() >= calibrationRef.current.expiresAt) {
        invalidate();
        setProgress("Calibration expired. Recalibration required.");
      }
      if (lastObservation.current && performance.now() - lastObservation.current.monotonicCaptureTime > 150) {
        lastObservation.current = null;
        setObservation(null);
        setRaw(null);
        setFiltered(null);
        filter.current.reset();
        if (trial.current) trial.current.collecting = [];
      }
    }, 75);
    return () => {
      r.stop();
      clearInterval(freshness);
      window.removeEventListener("resize", changed);
      window.removeEventListener("scroll", changed, true);
      window.visualViewport?.removeEventListener("resize", changed);
      window.visualViewport?.removeEventListener("scroll", changed);
    };
  }, []);
  useEffect(() => {
    syntheticPoint.current = point;
  }, [point]);
  useEffect(() => {
    if (mode !== "SYNTHETIC") return;
    let sequence = 0;
    const timer = setInterval(() => {
      if (sequence >= 3000) {
        clearInterval(timer);
        setMode("OFF");
        invalidate();
        setObservation(null);
        setStatus("REPLAY_LIMIT_REACHED");
        return;
      }
      accept.current(syntheticObservation(syntheticPoint.current, sequence++, performance.now(), replayGeneration));
    }, 50);
    const suspend = () => {
      clearInterval(timer);
      setMode("OFF");
      setStatus("SUSPENDED");
      invalidate();
      setObservation(null);
    };
    const hidden = () => {
      if (document.visibilityState !== "visible") suspend();
    };
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("pagehide", suspend);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("pagehide", suspend);
    };
  }, [mode, replayGeneration]);
  const stop = () => {
    setMode("OFF");
    runtime.current?.stop();
    invalidate();
    aggregateHistory.current = [];
    setExportConsent(false);
    setObservation(null);
    log("STOPPED_AND_DELETED");
  };
  const begin = (stage: Trial["stage"]) => {
    if (!lastObservation.current || !usableHand(lastObservation.current)) {
      setProgress("Show one usable pointing hand first.");
      return;
    }
    if (stage === "VALIDATION" && !calibrationRef.current) return;
    if (stage === "TRAINING") {
      calibrationRef.current = null;
      setCalibration(null);
    }
    const order = stage === "TRAINING" ? [...calibrationLayout.training] : [...calibrationLayout.validation];
    if (stage === "VALIDATION")
      for (let i = order.length - 1; i > 0; i--) {
        const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
        [order[i], order[j]] = [order[j], order[i]];
      }
    trial.current = { stage, order, groups: [], collecting: [], binding: null, after: performance.now() + 1500 };
    setTarget(order[0]);
    setProgress(`${stage}: hold a relaxed index point at each dot; samples are taken from the hand, not from clicks.`);
    log(`${stage}_STARTED`);
  };
  const exportMetrics = () => {
    if (!exportConsent) return;
    const c = calibrationRef.current;
    const data = {
      version: 1,
      mode,
      evidenceTier: mode === "SYNTHETIC" ? "D0" : "UNQUALIFIED_LIVE_CAMERA",
      provider: observation
        ? { id: observation.providerId, modelId: observation.modelId, modelDigest: observation.modelDigest }
        : null,
      calibration: aggregateCalibrationExport(c, exportConsent),
      trialAggregates: aggregateHistory.current,
      snapping: "DISABLED_PHASE_1",
      physicalQualification: "PENDING",
      logs,
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "reach-session-metrics.json";
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <section className={styles.lab} aria-labelledby="reach-heading">
      <header>
        <p>Voyagewright · Interaction laboratory</p>
        <h1 id="reach-heading">Find the Hand</h1>
        <p>
          Explore hand visibility and calibrate an estimate. This laboratory does not select, activate, manipulate or
          transfer objects.
        </p>
      </header>
      <div className={styles.controls}>
        <button
          onClick={() => {
            stop();
            setReplayGeneration((g) => g + 1);
            setMode("SYNTHETIC");
            setStatus("SYNTHETIC_ONLY");
          }}
        >
          Start synthetic replay
        </button>
        <button
          onClick={() => {
            stop();
            setMode("LIVE");
            void runtime.current?.start(true, mirror);
          }}
        >
          Enable live camera
        </button>
        <button onClick={stop}>Stop and delete calibration</button>
        <label>
          <input
            type="checkbox"
            checked={mirror}
            onChange={(e) => {
              stop();
              setMirror(e.target.checked);
            }}
          />
          Mirror camera preview
        </label>
      </div>
      <p>
        Camera frames stay on this device. No microphone, recording, upload or saved calibration. Camera access starts
        only after Enable live camera. Stop releases the camera and clears the fit.
      </p>
      <p role="status">
        Mode: <strong>{mode}</strong> · Status: {status} · Hand: {observation?.reason ?? "NO_FRESH_OBSERVATION"}
      </p>
      <div className={styles.workspace}>
        <div>
          <video
            ref={video}
            muted
            playsInline
            className={mirror ? styles.mirrored : ""}
            aria-label="Local camera preview"
          />
          <p>
            Unmirrored source:{" "}
            {observation
              ? `${observation.frameWidth} × ${observation.frameHeight}, frame ${observation.cameraFrameVersion}, generation ${observation.providerGeneration}`
              : "Unavailable"}
            . Preview mirroring is applied once. Presence/tracking scores are unavailable; handedness score is not
            intent confidence.
          </p>
          {observation && (
            <details>
              <summary>Hand landmarks and software timing</summary>
              <svg
                viewBox="0 0 1 1"
                width="240"
                height="180"
                aria-label="Normalized hand landmark diagnostics"
                role="img"
                className={mirror ? styles.mirrored : ""}
              >
                <title>Ephemeral normalized hand landmarks; image z is not metric depth</title>
                {observation.hands.flatMap((hand, h) =>
                  hand.landmarks.map((p, i) =>
                    p.valid ? <circle key={`${h}-${i}`} cx={p.x} cy={p.y} r="0.01" fill="currentColor" /> : null,
                  ),
                )}
              </svg>
              <p>
                Quality: {observation.quality} · Evidence: {observation.evidenceTier} · Software capture-to-inference:{" "}
                {Math.max(0, observation.monotonicInferenceTime - observation.monotonicCaptureTime).toFixed(1)} ms. This
                timer does not measure exposure-to-visible latency.
              </p>
            </details>
          )}
        </div>
        <div ref={plane} className={styles.plane} aria-label="Calibration plane">
          {target && (
            <span className={styles.target} style={{ left: `${target.x * 100}%`, top: `${target.y * 100}%` }}>
              Point here
            </span>
          )}
          {raw && (
            <span className={styles.raw} style={{ left: `${raw.x * 100}%`, top: `${raw.y * 100}%` }}>
              ＋
            </span>
          )}
          {filtered && (
            <span className={styles.filtered} style={{ left: `${filtered.x * 100}%`, top: `${filtered.y * 100}%` }}>
              ○
            </span>
          )}
          <p>Raw ＋ · Filtered ○ · Snapping disabled</p>
        </div>
      </div>
      {mode === "SYNTHETIC" && (
        <fieldset>
          <legend>Synthetic hand position — simulation cannot prove physical accuracy</legend>
          {(["x", "y"] as const).map((axis) => (
            <label key={axis}>
              {axis.toUpperCase()}{" "}
              <input
                aria-label={`Synthetic ${axis}`}
                type="range"
                min="0.1"
                max="0.9"
                step="0.01"
                value={point[axis]}
                onChange={(e) => setPoint((p) => ({ ...p, [axis]: Number(e.target.value) }))}
              />
              {point[axis].toFixed(2)}
            </label>
          ))}
        </fieldset>
      )}
      <div className={styles.controls}>
        <button onClick={() => begin("TRAINING")}>Start nine-target calibration</button>
        <button disabled={!calibration} onClick={() => begin("VALIDATION")}>
          Run independent validation
        </button>
        <button
          onClick={() => {
            invalidate();
            aggregateHistory.current = [];
            setProgress("Calibration deleted. Conventional controls remain available.");
            log("CALIBRATION_DELETED");
          }}
        >
          Delete calibration
        </button>
      </div>
      <p aria-live="polite">{progress}</p>
      <p>
        Calibration: {calibration?.status ?? "REQUIRED"} · Raw held-out p95:{" "}
        {calibration?.validationP95 == null
          ? "not measured"
          : `${(calibration.validationP95 * 100).toFixed(2)}% diagonal`}{" "}
        · Physical qualification: pending
      </p>
      <p>
        Camera movement may be undetectable. Restart calibration after changing placement. Keep one hand visible; a lost
        or changed hand invalidates continuity. Use these buttons and keyboard controls at any time; no physical gesture
        is required.
      </p>
      <details>
        <summary>Session diagnostics and privacy</summary>
        <p>
          Observations are ephemeral. Logs contain bounded reason codes only. Export contains aggregate fit errors and
          no video, landmarks, camera identifiers or calibration coefficients.
        </p>
        <p>
          Up to ten fit/validation summaries remain in session memory, including failed attempts. Delete calibration or
          stop to clear them. Viewport changes disable the fit while retaining these aggregate summaries.
        </p>
        <label>
          <input type="checkbox" checked={exportConsent} onChange={(e) => setExportConsent(e.target.checked)} />I
          consent to downloading this session&apos;s aggregate metrics to my device.
        </label>
        <button disabled={!exportConsent} onClick={exportMetrics}>
          Export aggregate metrics
        </button>
        <button onClick={() => setLogs([])}>Clear session log</button>
        <ul>
          {logs.map((l, i) => (
            <li key={i}>
              {l.at}: {l.reason}
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
