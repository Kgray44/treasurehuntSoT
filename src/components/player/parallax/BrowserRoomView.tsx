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
import {
  alignRoomPoints,
  alignmentApplies,
  hasLiveWorldPose,
  type BrowserTrackingSample,
  type RoomAlignment,
  type BrowserWorldTrackingProvider,
} from "@/parallax/browser-world-tracking";
import { triangulateTrackingRays, type TrackingRay } from "@/parallax/browser-tracking-rays";
import { waitForTrackingOperation } from "@/parallax/browser-tracking-lifecycle";
import type { SpatialMoment } from "@/parallax/contracts";
import type { ParallaxLensRuntime } from "@/parallax/runtime";
import styles from "./ChronicleLens.module.css";

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
  const broker = useRef<BrowserCameraBroker | null>(null),
    abort = useRef<AbortController | null>(null);
  const generation = useRef(0),
    viewSamples = useRef(0);
  const browserRequested = useRef(false);
  const alignmentRef = useRef<RoomAlignment | null>(null),
    raysRef = useRef<TrackingRay[]>([]);
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
  const [prototypeEngine, setPrototypeEngine] = useState<"TINYVIO" | "PUBLIC_SOURCE">("TINYVIO");
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
        if (availability.localPrototype === true) {
          setPrototypeEngine(availability.engine === "PUBLIC_SOURCE" ? "PUBLIC_SOURCE" : "TINYVIO");
          setLocalPrototype(true);
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  const clearAlignment = () => {
    alignmentRef.current = null;
    raysRef.current = [];
    setAlignment(null);
    setRays([]);
  };
  useEffect(() => {
    const timer = setInterval(() => setClock(performance.now()), 250);
    const hidden = () => {
      if (document.visibilityState !== "hidden" || !browserRequested.current) return;
      abort.current?.abort();
      broker.current?.release();
      void provider.current?.stop();
      void runtime()?.close();
      alignmentRef.current = null;
      raysRef.current = [];
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
      prototypeEngine === "PUBLIC_SOURCE"
        ? requestBrowserOrientationPermission().catch(() => false)
        : Promise.resolve(true);
    const token = ++generation.current;
    setBusy(true);
    setError("");
    setRequested(true);
    browserRequested.current = true;
    activeChanged(true);
    clearAlignment();
    setSample(null);
    abort.current?.abort();
    broker.current?.release();
    abort.current = new AbortController();
    const signal = abort.current.signal;
    try {
      await runtime()?.close();
      await provider.current?.stop();
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
      if (!video.current || !host.current) {
        lease.release();
        throw new Error("The camera surface is unavailable.");
      }
      const tracker =
        prototypeEngine === "PUBLIC_SOURCE" ? new PublicSourceBrowserProvider() : new TinyvioBrowserProvider();
      provider.current = tracker;
      await tracker.start({
        lease,
        video: video.current,
        motionGranted: true,
        signal,
        sample: (s) => {
          if (token !== generation.current) return;
          adapter.current?.updateTracking(s);
          const now = performance.now();
          if (now - viewSamples.current >= 100 || s.status !== "TRACKING") {
            viewSamples.current = now;
            setSample(s);
            setClock(now);
          }
          const intrinsics = tracker.cameraIntrinsics();
          if (intrinsics && host.current?.parentElement)
            host.current.parentElement.style.aspectRatio = `${intrinsics.width} / ${intrinsics.height}`;
          if (["LOST", "SUSPENDED"].includes(s.status)) {
            clearAlignment();
            if (adapter.current) {
              adapter.current = null;
              void runtime()?.close();
            }
          }
        },
      });
      if (token !== generation.current) await tracker.stop();
    } catch (cause) {
      if (token === generation.current) {
        setError(cause instanceof Error ? cause.message : "Browser tracking could not start.");
        abort.current?.abort();
        broker.current?.release();
        await provider.current?.stop();
        provider.current = null;
        setSample(null);
      }
    } finally {
      if (token === generation.current) setBusy(false);
    }
  }
  async function guided() {
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
    const ray = provider.current.ray(
      (event.clientX - rect.left) / rect.width,
      (event.clientY - rect.top) / rect.height,
    );
    if (!ray) {
      setError("Wait for fresh world tracking before tapping a room corner.");
      return;
    }
    setError("");
    const next = [...raysRef.current, ray];
    raysRef.current = next;
    setRays(next);
    if (next.length !== 6) return;
    setBusy(true);
    try {
      const tracked = [0, 1, 2].map((i) => triangulateTrackingRays(next[i], next[i + 3]));
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
        nowMs: latest.timestampMs,
        versionChecksum: moment.version.checksum,
        semanticFeatureId: feature.id,
        points: scene.map((point, i) => ({ scene: point, tracked: tracked[i] })),
      });
      alignmentRef.current = fitted;
      setAlignment(fitted);
      const lens = runtime();
      if (!lens) throw new Error("This Chronicle passage is unavailable.");
      await lens.updateDeviceContext({
        ...unknownState(),
        support: "SUPPORTED",
        permission: "GRANTED",
        availability: "AVAILABLE",
        lifecycle: "FOREGROUND_ONLY",
      });
      const renderer = new BrowserSpatialAdapter(host.current, provider.current, moment, fitted, select);
      adapter.current = renderer;
      await lens.open(renderer);
      if (lens.read().state === "DEGRADED") throw new Error(lens.read().guidance);
    } catch (cause) {
      adapter.current = null;
      await runtime()?.close();
      clearAlignment();
      setError(cause instanceof Error ? cause.message : "The room corners could not be aligned.");
    } finally {
      setBusy(false);
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
      {localPrototype && <p>Local tracking prototype · not cleared for product release.</p>}
      {!available && (
        <p>
          {localPrototype
            ? "Browser AR requires a released room environment with an alignment table. Adaptive physical-surface placement remains unavailable in this provider."
            : "Browser world tracking is not enabled on this server. Guided View remains available."}
        </p>
      )}
      {!requested && available && (
        <p>
          Camera and motion are processed locally. Move sideways to initialize world tracking, then match three table
          corners from two views. No room measurement is required.
        </p>
      )}
      {requested && (
        <>
          <p role="status">
            {aligned
              ? "Room aligned · relative world tracking"
              : tracking
                ? "World tracking ready · room alignment needed"
                : error
                  ? "Browser AR stopped · retry tracking or choose Guided View"
                  : sample?.reason || "Opening browser AR…"}
          </p>
          <p>
            Tracking: {sample?.status === "TRACKING" && !tracking ? "LIMITED" : (sample?.status ?? "INITIALIZING")} ·
            Confidence:{" "}
            {sample?.confidence === "POSITION_NO_SCALE"
              ? tracking
                ? "relative 6DoF; metric scale unverified"
                : "no fresh position"
              : (sample?.confidence ?? "NONE")}{" "}
            · Alignment: {aligned ? "aligned" : "not aligned"}
          </p>
          {!alignment && (
            <div className={styles.alignmentControls}>
              <label>
                Alignment table{" "}
                <select
                  value={featureId}
                  disabled={rays.length > 0 || busy}
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
                aria-label="Top view of your selected table. Match corners 1, 2 and 3 in this order from both camera positions."
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
                {rays.length < 3
                  ? `First view: tap corner ${rays.length + 1}.`
                  : `Move sideways to a second view, then tap the same corner ${rays.length - 2}.`}{" "}
                Keep the phone upright and match the table diagram to the reconstructed room.
              </p>
              {rays.length > 0 && (
                <button type="button" disabled={busy} onClick={clearAlignment}>
                  Clear corner taps
                </button>
              )}
            </div>
          )}
          <div className={styles.worldCamera} style={{ aspectRatio: "3 / 4" }} onPointerUp={(e) => void tap(e)}>
            <video ref={video} muted playsInline aria-label="Live rear camera for room alignment" />
            <div ref={host} className={styles.worldCanvas} />
            {!aligned && (
              <span className={styles.cameraHint}>
                {tracking ? "Tap the requested table corner" : "Move slowly sideways across a detailed surface"}
              </span>
            )}
          </div>
          <p>
            The camera view is not a metric room survey. Objects pause when tracking is limited. Restarting or rotating
            the phone requires fresh alignment.
          </p>
          {error && <p role="alert">{error}</p>}
        </>
      )}
    </section>
  );
}
