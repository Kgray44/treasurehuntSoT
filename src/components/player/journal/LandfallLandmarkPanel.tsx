"use client";

import { useEffect, useRef, useState } from "react";
import type { LandfallObservation } from "@/landfall/observation";
import type { LandmarkResult } from "@/landfall/landmark-contract";

export function LandfallLandmarkPanel(props: {
  sessionId: string;
  publishedVersionId: string;
  expectedSequence: number;
  csrfToken: string;
  worldspaceId: string;
  waypointId: string;
  landmark: { id: string; name: string; guidance: string; minimumFrames: number };
  observations: LandfallObservation[];
  eligible: boolean;
  historical: boolean;
  onVerified: (receipt: string) => Promise<void>;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const abort = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const [camera, setCamera] = useState(false);
  const [busy, setBusy] = useState(false);
  const binding = `${props.sessionId}:${props.publishedVersionId}:${props.landmark.id}:${props.eligible}:${props.historical}`;
  const [previousBinding, setPreviousBinding] = useState(binding);
  // Reset presentation in the same render as an acquisition boundary changes.
  // The effects below independently release the external media resources.
  if (binding !== previousBinding) {
    setPreviousBinding(binding);
    setCamera(false);
    setBusy(false);
  }
  const [message, setMessage] = useState(
    "Use the camera to compare this landmark, or follow the configured observation or Captain path.",
  );
  const stop = () => {
    generation.current++;
    abort.current?.abort();
    abort.current = null;
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    if (video.current) video.current.srcObject = null;
  };
  useEffect(() => {
    const pause = () => {
      if (document.hidden || !navigator.onLine) {
        stop();
        setCamera(false);
        setBusy(false);
      }
    };
    document.addEventListener("visibilitychange", pause);
    window.addEventListener("offline", pause);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", pause);
      window.removeEventListener("offline", pause);
    };
  }, [props.sessionId, props.publishedVersionId, props.landmark.id]);
  useEffect(() => {
    if (!props.eligible || props.historical) stop();
  }, [props.eligible, props.historical]);

  async function start() {
    if (!props.eligible || props.historical || !navigator.onLine || busy || stream.current) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setMessage("Camera comparison is unavailable. Continue with the configured observation or Captain path.");
      return;
    }
    const current = ++generation.current;
    setBusy(true);
    try {
      const acquired = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      if (generation.current !== current || document.hidden) {
        acquired.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = acquired;
      if (video.current) {
        video.current.srcObject = acquired;
        await video.current.play();
      }
      setCamera(true);
      setMessage(
        "Align your view with the Creator's landmark. Compare when the scene is steady; a changed angle may need the observation path.",
      );
    } catch {
      stop();
      setCamera(false);
      setMessage("The camera could not be opened. Continue with the configured observation or Captain path.");
    } finally {
      if (generation.current === current) setBusy(false);
      else setBusy(false);
    }
  }
  async function compare() {
    if (busy || !camera || !props.eligible || props.historical || !navigator.onLine) return;
    const current = generation.current;
    const controller = new AbortController();
    abort.current = controller;
    setBusy(true);
    try {
      const element = video.current;
      if (!element || !element.videoWidth || !element.videoHeight) throw new Error("camera not ready");
      const canvas = document.createElement("canvas");
      canvas.width = 320;
      canvas.height = Math.max(1, Math.round((320 * element.videoHeight) / element.videoWidth));
      const painter = canvas.getContext("2d");
      if (!painter) throw new Error("camera unavailable");
      const frames: string[] = [];
      for (let i = 0; i < props.landmark.minimumFrames; i++) {
        if (controller.signal.aborted || generation.current !== current) return;
        painter.drawImage(element, 0, 0, canvas.width, canvas.height);
        frames.push(canvas.toDataURL("image/jpeg", 0.75));
        if (i + 1 < props.landmark.minimumFrames) await new Promise((resolve) => setTimeout(resolve, 400));
      }
      const response = await fetch(
        `/api/player/playthroughs/${encodeURIComponent(props.sessionId)}/landfall/landmark`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-csrf-token": props.csrfToken },
          signal: controller.signal,
          body: JSON.stringify({
            sessionId: props.sessionId,
            publishedVersionId: props.publishedVersionId,
            expectedSequence: props.expectedSequence,
            worldspaceId: props.worldspaceId,
            waypointId: props.waypointId,
            landmarkId: props.landmark.id,
            observations: props.observations.slice(-20),
            frames,
          }),
        },
      );
      frames.length = 0;
      canvas.width = canvas.height = 0;
      const result = (await response.json()) as { result?: LandmarkResult; receipt?: string; error?: string };
      if (controller.signal.aborted || generation.current !== current) return;
      if (!response.ok) {
        setMessage(
          "This landmark could not be verified here. Refresh your location or continue with the configured fallback.",
        );
        return;
      }
      if (result.result === "confirmed" && result.receipt) {
        setMessage("The landmark view matches. Recording this context with the Voyage…");
        await props.onVerified(result.receipt);
        setMessage(
          "Comparison finished. The Voyage status below shows whether this arrival was recorded. Use the configured fallback if it could not be recorded.",
        );
        stop();
        setCamera(false);
      } else
        setMessage(
          result.result === "likely" || result.result === "possible"
            ? "The view may match, but it is still uncertain. Try another reference view or use the observation path."
            : "A clear match is unavailable. Use the observation or Captain path to continue.",
        );
    } catch {
      if (!controller.signal.aborted)
        setMessage("Comparison is unavailable. Use the configured observation or Captain path.");
    } finally {
      setBusy(false);
    }
  }
  if (props.historical) return null;
  return (
    <section aria-label="Natural landmark" data-landfall-landmark>
      <h4>{props.landmark.name}</h4>
      <p>{props.landmark.guidance}</p>
      <p>
        Comparison uses a few small stills only while you ask. Player images are processed transiently and are not
        saved. This compares the authored view; it does not identify arbitrary objects.
      </p>
      <p role="status" aria-live="polite">
        {props.eligible
          ? message
          : "Reach the surrounding area before comparing this landmark. You can still use the configured fallback."}
      </p>
      <video
        ref={video}
        aria-label="Landmark camera preview"
        muted
        playsInline
        hidden={!camera}
        style={{ width: "100%", maxWidth: 320 }}
      />
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
        {!camera ? (
          <button type="button" disabled={!props.eligible || busy} onClick={() => void start()}>
            Open landmark camera
          </button>
        ) : (
          <>
            <button type="button" disabled={busy || !props.eligible} onClick={() => void compare()}>
              Compare landmark view
            </button>
            <button
              type="button"
              onClick={() => {
                stop();
                setCamera(false);
                setBusy(false);
              }}
            >
              Close landmark camera
            </button>
          </>
        )}
      </div>
    </section>
  );
}
