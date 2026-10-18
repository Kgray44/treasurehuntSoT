"use client";
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ReachBrowserRuntime } from "./browser-runtime";
import { useReachRuntimePolicy } from "./runtime-policy-client";
import { ReachStage } from "./ReachStage";
import { ReachTiming, type ReachVisualFrame } from "./visualization";
import {
  PoseRecordingSession,
  poseRecordingDurationMs,
  poseRecordingLimits,
  poseRecordingSteps,
} from "./pose-recording";
import styles from "./ReachPoseRecorder.module.css";

type Phase = "IDLE" | "RECORDING" | "PAUSED" | "FINISHING" | "REVIEW";
type Download = {
  video: string | null;
  trace: string;
  extension: string;
  frames: number;
  reason: string;
  filenameBase: string;
};
const firstView: ReturnType<PoseRecordingSession["tick"]> = {
  step: poseRecordingSteps[0],
  elapsedMs: 0,
  frames: 0,
  stopped: false,
  paused: false,
};
export function ReachPoseRecorder() {
  const runtimePolicy = useReachRuntimePolicy();
  const policyRef = useRef(runtimePolicy);
  useLayoutEffect(() => {
    policyRef.current = runtimePolicy;
  }, [runtimePolicy]);
  const allowed = runtimePolicy.status === "READY" && runtimePolicy.policy?.localRecorderEnabled === true;
  const video = useRef<HTMLVideoElement>(null),
    stage = useRef<HTMLDivElement>(null);
  const runtime = useRef<ReachBrowserRuntime | null>(null),
    session = useRef<PoseRecordingSession | null>(null);
  const recorder = useRef<MediaRecorder | null>(null),
    recordingStream = useRef<MediaStream | null>(null);
  const animation = useRef(0),
    chunks = useRef<Blob[]>([]),
    bytes = useRef(0),
    discard = useRef(false);
  const videoFailure = useRef(false),
    stopReason = useRef("USER_STOPPED"),
    mounted = useRef(true);
  const saved = useRef<Download | null>(null),
    phaseRef = useRef<Phase>("IDLE");
  const frame = useRef<ReachVisualFrame>({
    observation: null,
    activeTrack: null,
    raw: null,
    filtered: null,
    uncertainty: null,
    previewEstimate: false,
  });
  const timings = useRef(new ReachTiming());
  const [status, setStatus] = useState("DISABLED"),
    [phase, setPhase] = useState<Phase>("IDLE");
  const [captureReady, setCaptureReady] = useState(false);
  const [view, setView] = useState(firstView),
    [error, setError] = useState("");
  const [download, setDownload] = useState<Download | null>(null),
    [frameAspect, setFrameAspect] = useState(4 / 3);
  const stopRef = useRef<(reason?: string, cancel?: boolean) => void>(() => {});
  const setRecordingPhase = (next: Phase) => {
    runtime.current?.setCalibrationCollecting(next === "RECORDING");
    phaseRef.current = next;
    if (mounted.current) setPhase(next);
  };
  const revoke = () => {
    if (saved.current) {
      if (saved.current.video) URL.revokeObjectURL(saved.current.video);
      URL.revokeObjectURL(saved.current.trace);
    }
    saved.current = null;
  };
  const stopCanvasStream = () => {
    cancelAnimationFrame(animation.current);
    recordingStream.current?.getTracks().forEach((track) => track.stop());
    recordingStream.current = null;
  };
  const stopRecording = (reason = "USER_STOPPED", cancel = false) => {
    discard.current ||= cancel;
    stopReason.current = reason;
    const current = session.current;
    if (current && !current.stopped) current.stop(performance.now(), reason);
    cancelAnimationFrame(animation.current);
    const media = recorder.current;
    if (media && media.state !== "inactive") {
      setRecordingPhase("FINISHING");
      // Final dataavailable precedes stop. Keep chunks and the canvas track alive
      // until onstop constructs the completed video.
      media.stop();
    } else if (!media) {
      stopCanvasStream();
      session.current = null;
      if (cancel) {
        chunks.current = [];
        setRecordingPhase("IDLE");
      }
    }
  };
  useEffect(() => {
    stopRef.current = stopRecording;
  });
  useEffect(() => {
    mounted.current = true;
    const r = new ReachBrowserRuntime(
      video.current!,
      (observation) => {
        frame.current.observation = observation;
        frame.current.activeTrack = observation.hands[0]?.trackId ?? null;
        timings.current.observe(observation);
        if (mounted.current) setCaptureReady(true);
      },
      (next) => {
        if (mounted.current) {
          setStatus(next);
          if (!["READY", "STALE_OR_INVALID_OBSERVATION"].includes(next)) setCaptureReady(false);
        }
        if (!["DISABLED", "READY", "MODEL_STARTING", "REQUESTING", "STALE_OR_INVALID_OBSERVATION"].includes(next))
          stopRef.current(next);
      },
      undefined,
      (raw) => {
        const current = session.current;
        if (!current || current.stopped || current.paused) return;
        current.append(raw, performance.now());
        if (current.stopped) stopRef.current("TRACE_OR_GUIDE_LIMIT");
      },
    );
    runtime.current = r;
    const policy = policyRef.current.policy;
    if (policy)
      r.setTrackingLimits({
        normalMaximumHz: policy.normalMaximumHz,
        calibrationMaximumHz: policy.calibrationMaximumHz,
        unfocusedMaximumHz: policy.unfocusedMaximumHz,
        modelMaximumHz: policy.modelMaximumHz,
      });
    const hidden = () => {
      if (document.visibilityState !== "visible") {
        stopRef.current("PAGE_HIDDEN");
        r.stop("SUSPENDED");
      }
    };
    document.addEventListener("visibilitychange", hidden);
    const pagehide = () => {
      stopRef.current("PAGE_LEFT", true);
      r.stop();
    };
    window.addEventListener("pagehide", pagehide);
    return () => {
      mounted.current = false;
      discard.current = true;
      stopRef.current("PAGE_LEFT", true);
      r.stop();
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("pagehide", pagehide);
      revoke();
    };
  }, []);
  useEffect(() => {
    if (allowed && runtimePolicy.policy) {
      const { normalMaximumHz, calibrationMaximumHz, unfocusedMaximumHz, modelMaximumHz } = runtimePolicy.policy;
      runtime.current?.setTrackingLimits({ normalMaximumHz, calibrationMaximumHz, unfocusedMaximumHz, modelMaximumHz });
    } else if (runtimePolicy.status !== "LOADING") {
      stopRef.current("ADMINISTRATOR_POLICY_STOPPED");
      runtime.current?.stop();
    }
  }, [allowed, runtimePolicy.status, runtimePolicy.policy]);
  useEffect(() => {
    const timer = setInterval(() => {
      const current = session.current;
      if (!current || current.stopped) return;
      const next = current.tick(performance.now());
      setView(next);
      if (next.stopped) stopRef.current("GUIDE_OR_TIME_LIMIT");
    }, 100);
    return () => clearInterval(timer);
  }, []);
  const clearRecording = () => {
    if (["RECORDING", "PAUSED", "FINISHING"].includes(phaseRef.current)) return;
    revoke();
    chunks.current = [];
    session.current = null;
    bytes.current = 0;
    setDownload(null);
    setView(firstView);
    setRecordingPhase("IDLE");
    setError("");
  };
  const start = () => {
    if (policyRef.current.status !== "READY" || !policyRef.current.policy?.localRecorderEnabled) return;
    setError("");
    if (phaseRef.current !== "IDLE" || saved.current) return;
    const sourceVideo = video.current,
      sourceOverlay = stage.current?.querySelector("canvas");
    if (
      !sourceVideo ||
      sourceVideo.readyState < 2 ||
      !sourceVideo.srcObject ||
      status !== "READY" ||
      !captureReady ||
      !sourceOverlay
    ) {
      setError("Enable the camera and wait for live tracking before recording.");
      return;
    }
    if (typeof MediaRecorder === "undefined" || typeof HTMLCanvasElement.prototype.captureStream !== "function") {
      setError(
        "This browser cannot record the diagnostic video. Use a current desktop Edge or Chrome; no trace-only recording was started.",
      );
      return;
    }
    const mime = [
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/mp4;codecs=avc1.42E01E",
      "video/webm",
      "video/mp4",
    ].find((type) => MediaRecorder.isTypeSupported(type));
    if (!mime) {
      setError("No supported video recording format is available. No recording was started.");
      return;
    }
    try {
      const canvas = document.createElement("canvas");
      canvas.width = Math.min(1280, sourceVideo.videoWidth || 640);
      const imageHeight = Math.round(
        (canvas.width * (sourceVideo.videoHeight || 480)) / (sourceVideo.videoWidth || 640),
      );
      canvas.height = imageHeight + 112;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("The browser could not create the recording canvas.");
      const started = performance.now();
      const filenameBase = `reach-pose-recording-${new Date().toISOString().replace(/[-:.]/g, "")}-${crypto.randomUUID().slice(0, 8)}`;
      session.current = new PoseRecordingSession(started, sourceVideo.currentTime, filenameBase);
      chunks.current = [];
      bytes.current = 0;
      discard.current = false;
      videoFailure.current = false;
      stopReason.current = "USER_STOPPED";
      setView(firstView);
      const paint = (at: number) => {
        const current = session.current;
        if (!current) return;
        context.fillStyle = "#102925";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.save();
        context.translate(canvas.width, 0);
        context.scale(-1, 1);
        context.drawImage(sourceVideo, 0, 0, canvas.width, imageHeight);
        context.drawImage(
          sourceOverlay,
          0,
          0,
          sourceOverlay.width,
          sourceOverlay.height,
          0,
          0,
          canvas.width,
          imageHeight,
        );
        context.restore();
        const step = current.currentStep(at);
        context.fillStyle = "#c9f4e5";
        context.font = "bold 16px sans-serif";
        context.fillText(
          `${step.id} · ${(current.activeElapsed(at) / 1000).toFixed(1)}s · camera ${sourceVideo.currentTime.toFixed(3)}s`,
          12,
          imageHeight + 23,
        );
        context.font = "15px sans-serif";
        const words = step.prompt.split(" ");
        let line = "",
          y = imageHeight + 46;
        for (const word of words) {
          const next = line ? `${line} ${word}` : word;
          if (context.measureText(next).width > canvas.width - 24 && line) {
            context.fillText(line, 12, y);
            y += 19;
            line = word;
          } else line = next;
        }
        context.fillText(line, 12, y);
        context.fillStyle = "#9abbb1";
        context.font = "11px sans-serif";
        context.fillText(
          "Local diagnostic composite · prompt labels are not verified intent · not latency qualification",
          12,
          canvas.height - 9,
        );
      };
      paint(started);
      const stream = canvas.captureStream(20);
      recordingStream.current = stream;
      const media = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 2_500_000 });
      recorder.current = media;
      media.ondataavailable = (event) => {
        if (!event.data.size || discard.current || videoFailure.current) return;
        if (bytes.current + event.data.size > poseRecordingLimits.videoBytes) {
          videoFailure.current = true;
          chunks.current = [];
          if (mounted.current)
            setError(
              "The 64 MiB video memory limit was reached. Video is unavailable; the trace is retained as partial evidence.",
            );
          stopRef.current("VIDEO_MEMORY_LIMIT");
          return;
        }
        chunks.current.push(event.data);
        bytes.current += event.data.size;
      };
      media.onerror = () => {
        videoFailure.current = true;
        if (mounted.current)
          setError(
            "Video recording failed. The trace is retained as partial evidence; this is not a complete video-and-trace capture.",
          );
        stopRef.current("VIDEO_ERROR");
      };
      media.onstop = () => {
        stopCanvasStream();
        recorder.current = null;
        runtime.current?.stop();
        const current = session.current;
        session.current = null;
        if (discard.current || !mounted.current || !current) {
          chunks.current = [];
          setRecordingPhase("IDLE");
          return;
        }
        const captured = current.export();
        const trace = {
          ...captured,
          video: {
            ...captured.video,
            compositeWidth: canvas.width,
            compositeHeight: canvas.height,
            imageRegion: { x: 0, y: 0, width: canvas.width, height: imageHeight },
            annotationStripHeight: 112,
            previewMirrorX: true,
          },
        };
        const movie = new Blob(chunks.current, { type: media.mimeType });
        chunks.current = [];
        if (!movie.size && !videoFailure.current) {
          videoFailure.current = true;
          setError("The browser returned no video. Only the partial trace is available.");
        }
        const result: Download = {
          video: videoFailure.current ? null : URL.createObjectURL(movie),
          trace: URL.createObjectURL(new Blob([JSON.stringify(trace, null, 2)], { type: "application/json" })),
          extension: media.mimeType.includes("mp4") ? "mp4" : "webm",
          frames: trace.frames.length,
          reason: trace.stopReason ?? stopReason.current,
          filenameBase: trace.recordingId,
        };
        saved.current = result;
        setDownload(result);
        setRecordingPhase("REVIEW");
      };
      media.start(500);
      setRecordingPhase("RECORDING");
      let lastPaint = started;
      const draw = (at: number) => {
        if (media.state === "inactive") return;
        if (media.state === "recording" && at - lastPaint >= 50) {
          paint(at);
          lastPaint = at;
        }
        animation.current = requestAnimationFrame(draw);
      };
      animation.current = requestAnimationFrame(draw);
    } catch (failure) {
      discard.current = true;
      if (recorder.current && recorder.current.state !== "inactive") recorder.current.stop();
      stopCanvasStream();
      session.current = null;
      recorder.current = null;
      setRecordingPhase("IDLE");
      setError(failure instanceof Error ? failure.message : "Video recording could not start.");
    }
  };
  const pause = () => {
    const current = session.current,
      media = recorder.current;
    if (!current || !media) return;
    const now = performance.now();
    if (media.state === "recording") {
      current.pause(now);
      if (current.stopped) {
        stopRecording("TIME_LIMIT");
        return;
      }
      media.pause();
      setView(current.tick(now));
      setRecordingPhase("PAUSED");
    } else if (media.state === "paused") {
      current.resume(now);
      if (current.stopped) {
        stopRecording("TIME_LIMIT");
        return;
      }
      media.resume();
      setView(current.tick(now));
      setRecordingPhase("RECORDING");
    }
  };
  const busy = ["RECORDING", "PAUSED", "FINISHING"].includes(phase);
  const reviewing = phase === "REVIEW";
  const stepIndex = poseRecordingSteps.findIndex((step) => step.id === view.step.id);
  const promptTarget = "target" in view.step ? view.step.target : { x: 0.5, y: 0.5 };
  return (
    <main className={styles.recorder}>
      <header>
        <p className={styles.eyebrow}>Local developer testing · no calibration fit</p>
        <h1>Record natural hand movement</h1>
        <p>
          Follow a {poseRecordingDurationMs / 1000}-second guide. Record the camera image, its existing rendered hand
          trace, and raw landmark results for later frame-by-frame comparison.
        </p>
      </header>
      <div className={styles.layout}>
        <section>
          {/* The runtime retains this capture element; hide it during review without unmounting it. */}
          <div ref={stage} className={styles.stage} style={{ aspectRatio: frameAspect }} hidden={reviewing}>
            <div className={styles.mirrored}>
              <video
                ref={video}
                muted
                playsInline
                onLoadedMetadata={() => {
                  const v = video.current!;
                  if (v.videoWidth) setFrameAspect(v.videoWidth / v.videoHeight);
                }}
              />
              <ReachStage frame={frame} timings={timings} kind="CAMERA" />
            </div>
          </div>
          {reviewing && download?.video && (
            <video
              className={styles.review}
              src={download.video}
              controls
              playsInline
              aria-label="Review local diagnostic recording"
            />
          )}
          <p className={styles.cameraStatus}>
            {reviewing
              ? download?.video
                ? "Saved diagnostic recording · camera and hand overlay · no microphone"
                : "Diagnostic video is unavailable. The partial trace remains available in the review controls."
              : `Camera: ${status === "READY" && !captureReady ? "waiting for tracking" : status.replaceAll("_", " ").toLowerCase()} · mirrored preview · no microphone`}
          </p>
        </section>
        <section className={styles.controls}>
          <p className={styles.eyebrow}>
            {reviewing
              ? "Saved recording"
              : phase === "RECORDING" || phase === "PAUSED"
                ? `Step ${stepIndex + 1} of ${poseRecordingSteps.length}`
                : "Guided recording"}
          </p>
          <h2>
            {phase === "REVIEW"
              ? "Review your local recording"
              : phase === "FINISHING"
                ? "Finishing the video…"
                : view.step.prompt}
          </h2>
          {download && (
            <div className={styles.downloads}>
              <p>
                {download.frames} raw results · {download.reason.replaceAll("_", " ").toLowerCase()}. Video and trace
                remain in this page’s memory.
              </p>
              <div className={styles.actions}>
                {download.video && (
                  <a href={download.video} download={`${download.filenameBase}.${download.extension}`}>
                    Download diagnostic video
                  </a>
                )}
                <a href={download.trace} download={`${download.filenameBase}.json`}>
                  Download landmark trace
                </a>
                <button onClick={clearRecording}>Delete recording from this page</button>
              </div>
            </div>
          )}
          {!reviewing && (
            <>
              <p aria-live="polite">
                {phase === "PAUSED"
                  ? "Paused. The guide, video and trace are paused together."
                  : phase === "RECORDING"
                    ? `${Math.floor(view.elapsedMs / 1000)} of ${poseRecordingDurationMs / 1000} seconds · ${view.frames} raw results recorded`
                    : "No setup is fitted or validated here. Missing hands, clipped wrists and uncertain frames are retained."}
              </p>
              <progress aria-label="Guided recording progress" max={poseRecordingDurationMs} value={view.elapsedMs} />
              <div
                className={styles.guidePlane}
                role="img"
                aria-label={`Prompt position: ${view.step.id.replaceAll("_", " ").toLowerCase()}; no calibration fit`}
              >
                <span
                  className={styles.targetDot}
                  style={{ left: `${promptTarget.x * 100}%`, top: `${promptTarget.y * 100}%` }}
                />
              </div>
              <p className={styles.cameraStatus}>Prompt position only · no fit or pointing eligibility gate</p>
            </>
          )}
          {!allowed && runtimePolicy.status !== "LOADING" && (
            <p className={styles.error} role="status">
              {runtimePolicy.status === "UNAVAILABLE"
                ? "Current Reach policy is unavailable."
                : "An administrator disabled Reach or local recording."}{" "}
              Capture stopped; existing recording data is retained for review.
            </p>
          )}
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
          {!reviewing && (
            <div className={styles.actions}>
              {!busy && status !== "READY" && (
                <button
                  disabled={!allowed}
                  onClick={() => {
                    if (policyRef.current.status !== "READY" || !policyRef.current.policy?.localRecorderEnabled) return;
                    setError("");
                    void runtime.current?.start(true, true);
                  }}
                >
                  Enable camera preview
                </button>
              )}
              {phase === "IDLE" && (
                <button disabled={!allowed || status !== "READY" || !captureReady} onClick={start}>
                  Start guided video + trace recording
                </button>
              )}
              {(phase === "RECORDING" || phase === "PAUSED") && (
                <>
                  <button onClick={pause}>{phase === "PAUSED" ? "Resume recording" : "Pause recording"}</button>
                  <button onClick={() => stopRecording()}>Stop & review</button>
                  <button onClick={() => stopRecording("CANCELLED", true)}>Cancel & delete recording</button>
                </>
              )}
              {!busy && status !== "DISABLED" && <button onClick={() => runtime.current?.stop()}>Stop camera</button>}
            </div>
          )}
          <aside className={styles.privacy}>
            <strong>Local recording details</strong>
            <p>
              Video includes your visible camera background and the same hand overlay shown here. The trace contains up
              to two hands, 21 joint coordinates, relative depth, model identity, timing and prompt labels. Prompts
              describe requested intent; they are not verified ground truth.
            </p>
            <p>
              Nothing is uploaded, fitted, saved to an account or added to aggregate exports. Recording stops within 90
              seconds, 3,000 results, 16 MiB of trace or 64 MiB of video. Diagnostic compositing adds overhead and does
              not measure sensor-to-display latency.
            </p>
            <p>
              Download the two files before leaving. Leaving this page discards unsaved recordings and stops its camera.
              Hiding the page stops recording for review.
            </p>
          </aside>
          <Link
            href="/devices/reach"
            onClick={(event) => {
              if (busy) {
                event.preventDefault();
                stopRecording("RETURN_REQUESTED");
              } else runtime.current?.stop();
            }}
          >
            Back to Reach Laboratory
          </Link>
        </section>
      </div>
    </main>
  );
}
