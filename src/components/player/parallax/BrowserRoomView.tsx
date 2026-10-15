"use client";
import { useEffect, useRef, useState } from "react";
import { BrowserCameraBroker } from "@/sextant/camera";
import { unknownState } from "@/sextant/contracts";
import { TinyvioBrowserProvider, requestBrowserMotionPermission } from "@/parallax/tinyvio-browser-provider";
import {
  PublicSourceBrowserProvider,
  requestBrowserOrientationPermission,
} from "@/parallax/public-source-browser-provider";
import { BrowserSpatialAdapter } from "@/parallax/browser-spatial-adapter";
import { ZapparBrowserProvider, type ZapparAuthorizedConfig } from "@/parallax/zappar-browser-provider";
import { EighthWallBrowserProvider, type EighthWallAuthorizedConfig } from "@/parallax/eighthwall-browser-provider";
import {
  alignRoomPoints,
  alignmentApplies,
  hasLiveWorldPose,
  type BrowserTrackingSample,
  type RoomAlignment,
  type BrowserWorldTrackingProvider,
} from "@/parallax/browser-world-tracking";
import { containedCameraPoint, triangulateTrackingRays, type TrackingRay } from "@/parallax/browser-tracking-rays";
import { waitForTrackingOperation } from "@/parallax/browser-tracking-lifecycle";
import { intersectTrackingPlanes } from "@/parallax/browser-tracking-planes";
import type { SpatialMoment } from "@/parallax/contracts";
import type { ParallaxLensRuntime } from "@/parallax/runtime";
import styles from "./ChronicleLens.module.css";

type AlignmentEvent = {
  seconds: number;
  step:
    | "Starting tracking"
    | "Tracking status changed"
    | "Tracking map changed"
    | "Corner captured"
    | "Corner rejected"
    | "Checking room fit"
    | "Preparing scene"
    | "Opening scene"
    | "Room aligned"
    | "Alignment failed"
    | "Corner taps cleared"
    | "Camera paused"
    | "Guided View selected";
  tracking?: BrowserTrackingSample["status"];
  corners?: number;
  detail?: "Camera image boundary" | "Fresh pose unavailable" | "Insufficient parallax" | "Corners disagree";
};

export function BrowserRoomView({
  moment,
  runtime,
  activeChanged,
  select,
}: {
  moment: SpatialMoment;
  runtime(): ParallaxLensRuntime | null;
  activeChanged(active: boolean): void;
  select(id: string): void;
}) {
  const video = useRef<HTMLVideoElement>(null),
    host = useRef<HTMLDivElement>(null);
  const provider = useRef<BrowserWorldTrackingProvider | null>(null),
    adapter = useRef<BrowserSpatialAdapter | null>(null);
  const lastRenderer = useRef<BrowserSpatialAdapter | null>(null);
  const broker = useRef<BrowserCameraBroker | null>(null),
    abort = useRef<AbortController | null>(null);
  const generation = useRef(0),
    viewSamples = useRef(0);
  const browserRequested = useRef(false);
  const alignmentRef = useRef<RoomAlignment | null>(null),
    raysRef = useRef<TrackingRay[]>([]);
  const surfacePoints = useRef<{ planeId: string; position: TrackingRay["origin"] }[]>([]);
  const trackingSession = useRef("");
  const alignmentAttempt = useRef(0);
  const previousStatus = useRef("");
  const diagnosticStart = useRef<number | null>(null);
  const [events, setEvents] = useState<AlignmentEvent[]>([]);
  const [diagnosticsCopied, setDiagnosticsCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  function record(step: AlignmentEvent["step"], details: Omit<AlignmentEvent, "step" | "seconds"> = {}) {
    const now = performance.now();
    diagnosticStart.current ??= now;
    const event = { seconds: Math.round((now - diagnosticStart.current) / 100) / 10, step, ...details };
    // Bounded, local metadata only: no camera frames, map IDs, poses, room names or account data.
    setEvents((previous) => [...previous.slice(-23), event]);
    setDiagnosticsCopied(false);
  }
  const [alignmentMethod, setAlignmentMethod] = useState<"SURFACE" | "TWO_VIEWS">("TWO_VIEWS");
  const [surfacePointCount, setSurfacePointCount] = useState(0);
  const [notice, setNotice] = useState("");
  const [resetCount, setResetCount] = useState(0);
  const [planeCount, setPlaneCount] = useState(0);
  const [cameraAspect, setCameraAspect] = useState(3 / 4);
  const [requested, setRequested] = useState(false),
    [busy, setBusy] = useState(false);
  const [sample, setSample] = useState<BrowserTrackingSample | null>(null),
    [error, setError] = useState("");
  const [alignment, setAlignment] = useState<RoomAlignment | null>(null),
    [rays, setRays] = useState<TrackingRay[]>([]);
  const features =
    moment.version.studio?.environment?.features.filter((f) => ["TABLE", "DESK"].includes(f.classification)) ?? [];
  const [featureId, setFeatureId] = useState(features[0]?.id ?? "");
  const feature = features.find((f) => f.id === featureId);
  const [localPrototype, setLocalPrototype] = useState(false);
  const [prototypeEngine, setPrototypeEngine] = useState<"TINYVIO" | "PUBLIC_SOURCE" | "ZAPPAR" | "EIGHTHWALL" | null>(
    null,
  );
  const [zapparConfig, setZapparConfig] = useState<ZapparAuthorizedConfig | null>(null);
  const [eighthwallConfig, setEighthwallConfig] = useState<EighthWallAuthorizedConfig | null>(null);
  const [providerBlocker, setProviderBlocker] = useState("");
  const [sourceCommit, setSourceCommit] = useState<string | null>(null);
  const [sourceDirty, setSourceDirty] = useState<boolean | null>(null);
  const sessionStats = useRef({ reportedSamples: 0, livePoseSamples: 0, longestSampleGapMs: 0, previousTimestamp: 0 });
  const providerLabel =
    prototypeEngine === "EIGHTHWALL"
      ? "8th Wall world tracking"
      : prototypeEngine === "ZAPPAR"
        ? "Zappar World Tracking"
        : prototypeEngine === "PUBLIC_SOURCE"
          ? "Public-source SLAM experiment"
          : prototypeEngine === "TINYVIO"
            ? "TinyVIO experiment"
            : "No tracking provider selected";
  const [clock, setClock] = useState(0);
  const tracking = Boolean(sample && hasLiveWorldPose(sample, clock, sample.sessionId));
  const aligned = sample && alignment && alignmentApplies(alignment, sample, clock, moment.version.checksum);
  const available =
    localPrototype && !!moment.version.studio?.environment && !moment.version.adaptive && features.length > 0;
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/dev/parallax-tracker/availability", { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return;
        const availability = await response.json();
        setProviderBlocker(typeof availability.blockedReason === "string" ? availability.blockedReason : "");
        setSourceDirty(typeof availability.sourceDirty === "boolean" ? availability.sourceDirty : null);
        setSourceCommit(
          typeof availability.sourceCommit === "string" && /^[a-f0-9]{40}$/.test(availability.sourceCommit)
            ? availability.sourceCommit
            : null,
        );
        if (availability.localPrototype === true) {
          if (!["TINYVIO", "PUBLIC_SOURCE", "ZAPPAR", "EIGHTHWALL"].includes(availability.engine)) return;
          if (availability.engine === "ZAPPAR" && !availability.zappar) return;
          if (availability.engine === "EIGHTHWALL" && !availability.eighthwall) return;
          setPrototypeEngine(availability.engine);
          setZapparConfig(availability.engine === "ZAPPAR" ? availability.zappar : null);
          setEighthwallConfig(availability.engine === "EIGHTHWALL" ? availability.eighthwall : null);
          setLocalPrototype(true);
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  const clearAlignment = () => {
    ++alignmentAttempt.current;
    alignmentRef.current = null;
    raysRef.current = [];
    setAlignment(null);
    setRays([]);
    surfacePoints.current = [];
    setSurfacePointCount(0);
  };
  useEffect(() => {
    const timer = setInterval(() => setClock(performance.now()), 250);
    const hidden = () => {
      if (document.visibilityState !== "hidden" || !browserRequested.current) return;
      record("Camera paused");
      ++alignmentAttempt.current;
      setBusy(false);
      abort.current?.abort();
      broker.current?.release();
      void provider.current?.stop();
      void runtime()?.close();
      alignmentRef.current = null;
      raysRef.current = [];
      surfacePoints.current = [];
      setSurfacePointCount(0);
      setAlignment(null);
      setRays([]);
      setSample((previous) =>
        previous
          ? {
              ...previous,
              status: "SUSPENDED",
              confidence: "NONE",
              sessionFromCamera: null,
              reason: "Camera tracking paused. Restart and align again.",
            }
          : null,
      );
    };
    document.addEventListener("visibilitychange", hidden);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", hidden);
      // This ref is a cancellation generation, not a DOM reference.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      ++generation.current;
      abort.current?.abort();
      broker.current?.release();
      void adapter.current?.stop();
      void provider.current?.stop();
    };
  }, [runtime]);

  async function start() {
    // iOS requires this permission request to be made directly within the button gesture.
    const motionPermission = requestBrowserMotionPermission().catch(() => false);
    const orientationPermission =
      prototypeEngine === "PUBLIC_SOURCE" || prototypeEngine === "ZAPPAR" || prototypeEngine === "EIGHTHWALL"
        ? requestBrowserOrientationPermission().catch(() => false)
        : Promise.resolve(true);
    const token = ++generation.current;
    setBusy(true);
    record("Starting tracking");
    setError("");
    setNotice("");
    setRequested(true);
    browserRequested.current = true;
    activeChanged(true);
    clearAlignment();
    setSample(null);
    lastRenderer.current = null;
    sessionStats.current = { reportedSamples: 0, livePoseSamples: 0, longestSampleGapMs: 0, previousTimestamp: 0 };
    abort.current?.abort();
    broker.current?.release();
    abort.current = new AbortController();
    const signal = abort.current.signal;
    try {
      await waitForTrackingOperation(
        Promise.resolve(runtime()?.close()),
        signal,
        "The previous scene could not close. Close Chronicle Lens and reopen it before retrying.",
      );
      await waitForTrackingOperation(
        Promise.resolve(provider.current?.stop()),
        signal,
        "The previous tracker could not stop. Close Chronicle Lens and reopen it before retrying.",
      );
      if (!isSecureContext || !navigator.mediaDevices?.getUserMedia)
        throw new Error("Use the trusted HTTPS test link to open the camera.");
      if (
        !(await waitForTrackingOperation(
          Promise.all([motionPermission, orientationPermission]).then((results) => results.every(Boolean)),
          signal,
          "Motion permission is still pending. Retry browser AR.",
          30000,
        ))
      )
        throw new Error("Motion permission was not granted. Allow it, then retry browser AR.");
      if (token !== generation.current) return;
      const cameraBroker = new BrowserCameraBroker(navigator.mediaDevices);
      broker.current = cameraBroker;
      if (!video.current || !host.current) {
        throw new Error("The camera surface is unavailable.");
      }
      if (
        !prototypeEngine ||
        (prototypeEngine === "ZAPPAR" && !zapparConfig) ||
        (prototypeEngine === "EIGHTHWALL" && !eighthwallConfig)
      )
        throw new Error("Select an authorized tracking provider before starting.");
      const tracker =
        prototypeEngine === "EIGHTHWALL"
          ? new EighthWallBrowserProvider(eighthwallConfig!)
          : prototypeEngine === "ZAPPAR"
            ? new ZapparBrowserProvider(zapparConfig!)
            : prototypeEngine === "PUBLIC_SOURCE"
              ? new PublicSourceBrowserProvider()
              : new TinyvioBrowserProvider();
      provider.current = tracker;
      const context = {
        video: video.current,
        motionGranted: true,
        signal,
        sample: (s: BrowserTrackingSample) => {
          if (token !== generation.current) return;
          const stats = sessionStats.current;
          stats.reportedSamples++;
          if (hasLiveWorldPose(s, performance.now(), s.sessionId)) stats.livePoseSamples++;
          if (stats.previousTimestamp > 0)
            stats.longestSampleGapMs = Math.max(stats.longestSampleGapMs, s.timestampMs - stats.previousTimestamp);
          stats.previousTimestamp = s.timestampMs;
          const changedMap = trackingSession.current && trackingSession.current !== s.sessionId;
          trackingSession.current = s.sessionId;
          const statusChanged = previousStatus.current !== s.status;
          previousStatus.current = s.status;
          if (changedMap) record("Tracking map changed", { tracking: s.status });
          else if (statusChanged) record("Tracking status changed", { tracking: s.status });
          if (changedMap || (statusChanged && ["LOST", "SUSPENDED"].includes(s.status))) {
            if (alignmentRef.current || raysRef.current.length || surfacePoints.current.length) {
              setNotice(
                `Tracking lost its room position. Your corner taps were cleared because they no longer share a reliable map. ${s.reason} Wait for tracking to recover before trying again.`,
              );
              setResetCount((value) => value + 1);
            }
            clearAlignment();
            setBusy(false);
            if (adapter.current) {
              adapter.current = null;
              void runtime()?.close();
            }
          }
          adapter.current?.updateTracking(s);
          const now = performance.now();
          if (now - viewSamples.current >= 100 || statusChanged) {
            viewSamples.current = now;
            setSample(s);
            setClock(now);
            setPlaneCount(tracker.planes().length);
            const intrinsics = tracker.cameraIntrinsics();
            if (intrinsics) setCameraAspect(intrinsics.width / intrinsics.height);
          }
        },
      };
      if (tracker instanceof EighthWallBrowserProvider) {
        await tracker.startManaged({ ...context, broker: cameraBroker });
      } else {
        const lease = await waitForTrackingOperation(
          cameraBroker.acquire(true, document.visibilityState === "visible", undefined, "environment"),
          signal,
          "Camera permission is still pending. Finish or dismiss the Safari permission prompt, then retry.",
          30000,
        );
        if (token !== generation.current) {
          lease.release();
          return;
        }
        await tracker.start({ ...context, lease });
      }
      if (token !== generation.current) await tracker.stop();
    } catch (cause) {
      if (token === generation.current) {
        record("Alignment failed");
        setError(cause instanceof Error ? cause.message : "Browser tracking could not start.");
        abort.current?.abort();
        broker.current?.release();
        void provider.current?.stop().catch(() => {});
        provider.current = null;
        setSample(null);
      }
    } finally {
      if (token === generation.current) setBusy(false);
    }
  }
  async function guided() {
    record("Guided View selected");
    ++generation.current;
    abort.current?.abort();
    broker.current?.release();
    await provider.current?.stop();
    provider.current = null;
    adapter.current = null;
    clearAlignment();
    setSample(null);
    setError("");
    setRequested(false);
    browserRequested.current = false;
    setBusy(false);
    activeChanged(false);
    await runtime()?.useGuidedView();
  }
  async function tap(event: React.PointerEvent<HTMLDivElement>) {
    if (alignmentRef.current || busy || !feature || !host.current || !provider.current) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const intrinsics = provider.current.cameraIntrinsics();
    const point =
      intrinsics &&
      containedCameraPoint({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
        viewportWidth: rect.width,
        viewportHeight: rect.height,
        frameWidth: intrinsics.width,
        frameHeight: intrinsics.height,
      });
    if (!point) {
      record("Corner rejected", { corners: raysRef.current.length, detail: "Camera image boundary" });
      setError("Tap a corner inside the live camera image.");
      return;
    }
    const ray = provider.current.ray(point.x, point.y);
    if (!ray) {
      record("Corner rejected", { corners: raysRef.current.length, detail: "Fresh pose unavailable" });
      setError("Wait for fresh world tracking before tapping a room corner.");
      return;
    }
    setError("");
    setNotice("");
    let tracked: TrackingRay["origin"][];
    if (alignmentMethod === "SURFACE") {
      const hit = intersectTrackingPlanes(ray, provider.current.planes());
      if (!hit) {
        setError(
          "No detected tabletop at that point yet. Scan the table slowly, then tap a corner. You can also choose Two views.",
        );
        return;
      }
      if (surfacePoints.current.length && surfacePoints.current[0].planeId !== hit.planeId) {
        setError(
          "That tap hit a different surface. Keep all three corners on the same detected tabletop, or clear the taps.",
        );
        return;
      }
      surfacePoints.current.push({ planeId: hit.planeId, position: hit.transform.position });
      setSurfacePointCount(surfacePoints.current.length);
      record("Corner captured", { corners: surfacePoints.current.length });
      if (surfacePoints.current.length !== 3) return;
      tracked = surfacePoints.current.map((point) => point.position);
    } else {
      const next = [...raysRef.current, ray];
      // Validate the current correspondence immediately. A bad second-view tap must
      // not discard earlier valid second-view corners or advance to the next one.
      if (next.length > 3) {
        try {
          triangulateTrackingRays(next[next.length - 4], ray);
        } catch (cause) {
          record("Corner rejected", {
            corners: raysRef.current.length,
            detail:
              cause instanceof Error && cause.message.startsWith("Move sideways")
                ? "Insufficient parallax"
                : "Corners disagree",
          });
          setError(cause instanceof Error ? cause.message : "That corner did not match. Tap it again.");
          return;
        }
      }
      raysRef.current = next;
      setRays(next);
      record("Corner captured", { corners: next.length });
      if (next.length !== 6) return;
      try {
        tracked = [0, 1, 2].map((i) => triangulateTrackingRays(next[i], next[i + 3]));
      } catch (cause) {
        raysRef.current = next.slice(0, 3);
        setRays(raysRef.current);
        setError(cause instanceof Error ? cause.message : "The second view did not match. Try it again.");
        return;
      }
    }
    const token = generation.current;
    const attempt = ++alignmentAttempt.current;
    const sourceProvider = provider.current;
    const lens = runtime();
    let renderer: BrowserSpatialAdapter | null = null;
    const ownsAttempt = () =>
      token === generation.current &&
      attempt === alignmentAttempt.current &&
      sourceProvider === provider.current &&
      lens === runtime();
    setBusy(true);
    record("Checking room fit");
    try {
      const yaw = (feature.yawDegrees * Math.PI) / 180,
        c = Math.cos(yaw),
        s = Math.sin(yaw);
      const [w, h, d] = feature.dimensions;
      const scene = [
        [-w / 2, -d / 2],
        [w / 2, -d / 2],
        [w / 2, d / 2],
      ].map(([x, z]) => ({
        x: feature.position.x + c * x + s * z,
        y: feature.position.y + h / 2,
        z: feature.position.z - s * x + c * z,
      }));
      const latest = provider.current.read();
      if (!latest) throw new Error("Tracking stopped. Restart browser AR and align again.");
      const fitted = alignRoomPoints({
        sample: latest,
        // This is a pointer handler; admission uses the real clock, not the sample's own age.
        // eslint-disable-next-line react-hooks/purity
        nowMs: performance.now(),
        versionChecksum: moment.version.checksum,
        semanticFeatureId: feature.id,
        points: scene.map((point, i) => ({ scene: point, tracked: tracked[i] })),
      });
      if (!lens) throw new Error("This Chronicle passage is unavailable.");
      const signal = abort.current!.signal;
      record("Preparing scene");
      await waitForTrackingOperation(
        lens.updateDeviceContext({
          ...unknownState(),
          support: "SUPPORTED",
          permission: "GRANTED",
          availability: "AVAILABLE",
          lifecycle: "FOREGROUND_ONLY",
        }),
        signal,
        "Room alignment could not prepare the scene. Retry alignment.",
      );
      if (!ownsAttempt() || !host.current) return;
      renderer = new BrowserSpatialAdapter(host.current, sourceProvider, moment, fitted, select);
      adapter.current = renderer;
      lastRenderer.current = renderer;
      record("Opening scene");
      await waitForTrackingOperation(
        lens.open(renderer),
        signal,
        "The scene took too long to open. Your camera is still available; retry alignment.",
      );
      if (!ownsAttempt()) {
        await renderer.stop();
        return;
      }
      if (lens.read().state === "DEGRADED") throw new Error(lens.read().guidance);
      const current = provider.current?.read();
      // Match the UI to the same fresh snapshot admitted after asynchronous opening.
      // eslint-disable-next-line react-hooks/purity
      const completedAt = performance.now();
      if (
        token !== generation.current ||
        !current ||
        !alignmentApplies(fitted, current, completedAt, moment.version.checksum)
      ) {
        throw new Error("Tracking changed while opening the scene. Wait for tracking to recover, then align again.");
      }
      alignmentRef.current = fitted;
      setSample(current);
      setClock(completedAt);
      setAlignment(fitted);
      record("Room aligned");
      setNotice("Room alignment complete. Your Chronicle scene is now open.");
    } catch (cause) {
      if (!ownsAttempt()) {
        await renderer?.stop();
        return;
      }
      adapter.current = null;
      // Report failure before cleanup: a slow close must not hide the recovery message.
      if (!ownsAttempt()) return;
      setBusy(false);
      record("Alignment failed");
      clearAlignment();
      const message = cause instanceof Error ? cause.message : "The room corners could not be aligned.";
      setError(
        message === "PARALLAX_ALIGNMENT_LIVE_WORLD_POSE_REQUIRED"
          ? "Tracking paused before alignment could finish. Wait for fresh world tracking, then try again."
          : message.startsWith("PARALLAX_ALIGNMENT_")
            ? "The corners do not yet match the room’s table shape and order. Check the selected table and numbered corners, then try again."
            : message,
      );
      void lens?.close().catch(() => {});
    } finally {
      if (ownsAttempt()) setBusy(false);
    }
  }
  return (
    <section aria-label="Browser world tracking" className={styles.browserControls}>
      <div className={styles.controls}>
        <button type="button" disabled={busy || !available} onClick={() => void start()}>
          {requested ? "Restart tracking / recalibrate" : "Start browser AR"}
        </button>
        {requested && (
          <button type="button" onClick={() => void guided()}>
            Use Guided View
          </button>
        )}
      </div>
      {localPrototype && <p>{providerLabel} · local evaluation · physical qualification pending.</p>}
      {providerBlocker && <p role="status">{providerBlocker}</p>}
      {!available && (
        <p>
          {localPrototype
            ? "Browser AR requires a released room environment with an alignment table. Adaptive physical-surface placement remains unavailable in this provider."
            : "Browser world tracking is not enabled on this server. Guided View remains available."}
        </p>
      )}
      {!requested && available && (
        <p>
          Camera and motion stay on your device. Move slowly sideways to initialize tracking, then match three table
          corners from two views. No room measurement is required.
        </p>
      )}
      {requested && (
        <>
          {error && (
            <p role="alert" className={styles.trackingAlert}>
              {error}
            </p>
          )}
          {notice && (!alignment || aligned) && <p role="status">{notice}</p>}
          <p role="status">
            {aligned
              ? "Room aligned · relative world tracking"
              : alignment
                ? "Tracking paused · waiting for a fresh camera pose"
                : tracking
                  ? "World tracking ready · room alignment needed"
                  : error
                    ? "Browser AR stopped · retry tracking or choose Guided View"
                    : sample?.status === "TRACKING"
                      ? "Tracking paused · waiting for a fresh camera pose"
                      : sample?.reason || "Opening browser AR…"}
          </p>
          <p>
            Tracking:{" "}
            {sample?.status === "TRACKING" && !tracking
              ? "LIMITED"
              : (sample?.status ?? (error ? "STOPPED" : "INITIALIZING"))}{" "}
            · Confidence:{" "}
            {sample?.confidence === "POSITION_NO_SCALE"
              ? tracking
                ? "relative 6DoF; metric scale unverified"
                : "no fresh position"
              : (sample?.confidence ?? "NONE")}{" "}
            · Alignment: {aligned ? "aligned" : "not aligned"}
            {resetCount > 0 && ` · Alignment resets: ${resetCount}`}
          </p>
          {!alignment && (sample || busy) && (
            <div className={styles.alignmentControls}>
              <label>
                Alignment method{" "}
                <select
                  value={alignmentMethod}
                  disabled={busy}
                  onChange={(event) => {
                    clearAlignment();
                    setError("");
                    setNotice("");
                    setAlignmentMethod(event.target.value as "SURFACE" | "TWO_VIEWS");
                  }}
                >
                  <option value="SURFACE" disabled={!tracking || !planeCount}>
                    Detected surface · 3 corners
                  </option>
                  <option value="TWO_VIEWS">Two views · 6 taps</option>
                </select>
              </label>
              {(!tracking || !planeCount) && (
                <p>
                  Verified surface detection is unavailable with this tracker. Two-view alignment remains experimental.
                </p>
              )}
              {alignmentMethod === "SURFACE" && (
                <p>
                  {tracking ? planeCount : 0} detected horizontal surfaces. Tap three numbered corners on the same
                  tabletop. Detection is experimental; edges are not automatically identified.
                </p>
              )}
              <label>
                Alignment table{" "}
                <select
                  value={featureId}
                  disabled={rays.length > 0 || surfacePointCount > 0 || busy}
                  onChange={(e) => setFeatureId(e.target.value)}
                >
                  {features.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </label>
              <svg
                viewBox="0 0 180 105"
                width="180"
                height="105"
                role="img"
                aria-label={
                  alignmentMethod === "SURFACE"
                    ? "Top view of your selected table. Match corners 1, 2 and 3 on the same detected surface."
                    : "Top view of your selected table. Match corners 1, 2 and 3 in this order from both camera positions."
                }
              >
                <rect x="30" y="20" width="120" height="65" rx="4" fill="none" stroke="currentColor" />
                <text x="15" y="20">
                  1
                </text>
                <text x="155" y="20">
                  2
                </text>
                <text x="155" y="95">
                  3
                </text>
                <text x="50" y="58">
                  Table top
                </text>
              </svg>
              <p>
                {busy
                  ? rays.length === 6 || surfacePointCount === 3
                    ? "Checking alignment and opening your scene…"
                    : "Starting camera and tracking…"
                  : alignmentMethod === "SURFACE"
                    ? `Tap corner ${Math.min(3, surfacePointCount + 1)} · ${surfacePointCount} of 3 captured.`
                    : rays.length < 3
                      ? `First view: tap corner ${rays.length + 1}.`
                      : `Move sideways to a second view, then tap the same corner ${rays.length - 2}.`}{" "}
                Keep the phone upright and match the table diagram to the reconstructed room.
              </p>
              {(rays.length > 0 || surfacePointCount > 0) && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    record("Corner taps cleared");
                    clearAlignment();
                  }}
                >
                  Clear corner taps
                </button>
              )}
            </div>
          )}
          <div
            hidden={!busy && !sample}
            className={styles.worldCamera}
            style={{ aspectRatio: cameraAspect }}
            onPointerUp={(e) => void tap(e)}
          >
            <video ref={video} muted playsInline aria-label="Live rear camera for room alignment" />
            <div ref={host} className={styles.worldCanvas} />
            {!aligned && (
              <span className={styles.cameraHint}>
                {error ||
                  (!alignment && notice) ||
                  (alignment ? "Tracking paused · waiting for a fresh camera pose" : "") ||
                  (busy
                    ? "Checking alignment and opening your scene…"
                    : tracking
                      ? alignmentMethod === "SURFACE"
                        ? `Tap corner ${Math.min(3, surfacePointCount + 1)} · ${surfacePointCount} of 3 captured`
                        : rays.length < 3
                          ? `First view · tap corner ${rays.length + 1} of 3`
                          : `Second view · tap the same corner ${Math.min(3, rays.length - 2)} of 3`
                      : "Move slowly sideways across a detailed surface")}
              </span>
            )}
          </div>
          <p>
            The camera view is not a metric room survey. Objects pause when tracking is limited. Restarting or rotating
            the phone requires fresh alignment.
          </p>
          <details className={styles.trackingDetails}>
            <summary>Tracking details</summary>
            <p>
              {providerLabel} · {events.length} recent session events
            </p>
            <ol aria-label="Recent tracking events">
              {events.map((event, index) => (
                <li key={`${event.seconds}:${index}`}>
                  {event.seconds}s · {event.step}
                  {event.tracking && ` · ${event.tracking}`}
                  {event.corners !== undefined && ` · ${event.corners} corners`}
                  {event.detail && ` · ${event.detail}`}
                </li>
              ))}
            </ol>
            <button
              type="button"
              onClick={async () => {
                setCopyError("");
                try {
                  await navigator.clipboard.writeText(
                    JSON.stringify(
                      {
                        schemaVersion: 1,
                        evidenceTier: "UNQUALIFIED_DEVICE_SESSION",
                        sourceCommit,
                        sourceDirty,
                        engine: prototypeEngine,
                        providerVersion: provider.current?.version ?? null,
                        renderTimings: lastRenderer.current?.diagnostics?.() ?? null,
                        resets: resetCount,
                        samples: {
                          reported: sessionStats.current.reportedSamples,
                          livePose: sessionStats.current.livePoseSamples,
                          longestGapMs: Math.round(sessionStats.current.longestSampleGapMs),
                        },
                        events,
                      },
                      null,
                      2,
                    ),
                  );
                  setDiagnosticsCopied(true);
                } catch {
                  setDiagnosticsCopied(false);
                  setCopyError("Copy is unavailable. You can select the session events above to share them.");
                }
              }}
            >
              {diagnosticsCopied ? "Details copied" : "Copy tracking details"}
            </button>
            {copyError && <p role="status">{copyError}</p>}
          </details>
        </>
      )}
    </section>
  );
}
