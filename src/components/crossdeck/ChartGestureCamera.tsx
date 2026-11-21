"use client";

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { ReachBrowserRuntime } from "@/reach/browser-runtime";
import { ChartTransferGesture } from "@/crossdeck/chart-transfer-gesture";

function subscribeVisibility(change: () => void) {
  document.addEventListener("visibilitychange", change);
  return () => document.removeEventListener("visibilitychange", change);
}

const visible = () => document.visibilityState === "visible";

type CameraInputs = {
  enabled: boolean;
  sourceKey: string | null;
  incomingId: string | null;
  holding: boolean;
  feedbackRoot?: HTMLElement | null;
  hold(): void;
  release(id: string): void;
  suspend(): void;
};

export function ChartGestureCamera(inputs: CameraInputs) {
  const video = useRef<HTMLVideoElement>(null);
  const live = useRef(inputs);
  const isVisible = useSyncExternalStore(subscribeVisibility, visible, () => false);
  const [status, setStatus] = useState("");
  useLayoutEffect(() => {
    live.current = inputs;
  });
  useEffect(() => {
    if (!inputs.enabled || !isVisible || !video.current) return;
    let binding = "";
    let recognizer = new ChartTransferGesture();
    let stopped = false;
    let released = "";
    const runtime = new ReachBrowserRuntime(
      video.current,
      (observation) => {
        const { enabled, incomingId, sourceKey, holding, hold, release, suspend } = live.current;
        if (!enabled || !visible()) return;
        if (holding) {
          if (observation.hands.length > 1) suspend();
          binding = "";
          return;
        }
        const key = incomingId ?? sourceKey ?? "receiver";
        if (binding !== key) {
          // A receiver may already see the closed hand when the source's intent arrives.
          if (!(binding === "receiver" && incomingId))
            recognizer = new ChartTransferGesture(!sourceKey || !!incomingId);
          binding = key;
        }
        const phase = recognizer.observe(observation);
        if (phase === "INTERRUPTED") {
          recognizer = new ChartTransferGesture(!sourceKey || !!incomingId);
          if (sourceKey && !incomingId) setStatus("");
        }
        if (phase === "READY" && sourceKey && !incomingId) setStatus("Ready to pick up this Chart.");
        if (phase === "HELD" && sourceKey && !incomingId) {
          recognizer = new ChartTransferGesture();
          hold();
        }
        if (phase === "RELEASED") {
          recognizer = new ChartTransferGesture(!sourceKey || !!incomingId);
          if (incomingId && released !== incomingId) {
            released = incomingId;
            release(incomingId);
          }
        }
      },
      (state) => {
        if (stopped) return;
        if (state === "READY") return;
        if (state === "PERMISSION_DENIED") {
          setStatus("Camera access is off. You can still send this view manually.");
          live.current.suspend();
        } else if (state === "SUSPENDED") {
          live.current.suspend();
        } else if (!["DISABLED", "REQUESTING", "MODEL_STARTING", "STALE_OR_INVALID_OBSERVATION"].includes(state)) {
          setStatus("Camera unavailable. You can still send this view manually.");
          live.current.suspend();
        } else if (state === "STALE_OR_INVALID_OBSERVATION") {
          binding = "";
        }
      },
    );
    void runtime.start(true, false);
    return () => {
      stopped = true;
      runtime.stop();
    };
  }, [inputs.enabled, isVisible]);

  const feedback =
    inputs.enabled && isVisible && inputs.sourceKey && !inputs.holding && status ? (
      <small role="status">{status}</small>
    ) : null;
  return (
    <>
      <video ref={video} hidden muted playsInline aria-hidden="true" />
      {inputs.feedbackRoot && feedback ? createPortal(feedback, inputs.feedbackRoot) : feedback}
    </>
  );
}
