"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { BrowserCameraBroker } from "@/sextant/camera";
import { useCurrentUser } from "@/components/auth/CurrentUserProvider";

const changeEvent = "crossdeck-gesture-preference";
const disabled = () => false;

function subscribe(change: () => void) {
  window.addEventListener("storage", change);
  window.addEventListener(changeEvent, change);
  return () => {
    window.removeEventListener("storage", change);
    window.removeEventListener(changeEvent, change);
  };
}

function usePreferenceKey() {
  const { state } = useCurrentUser();
  return state.authenticated ? `voyagewright:chart-gestures:${state.user.accountId}` : null;
}

export function useChartGestureEnabled() {
  const key = usePreferenceKey();
  return useSyncExternalStore(
    subscribe,
    () => {
      try {
        return key !== null && localStorage.getItem(key) === "enabled";
      } catch {
        return false;
      }
    },
    disabled,
  );
}

export function ChartGesturePreference() {
  const enabled = useChartGestureEnabled();
  const key = usePreferenceKey();
  const [message, setMessage] = useState("");
  const [requestingKey, setRequestingKey] = useState<string | null>(null);
  const requesting = !!key && requestingKey === key;
  const cameraRequest = useRef<BrowserCameraBroker | null>(null);
  useEffect(
    () => () => {
      cameraRequest.current?.release();
      cameraRequest.current = null;
    },
    [key],
  );

  const save = (next: boolean) => {
    if (!key) return;
    try {
      if (next) localStorage.setItem(key, "enabled");
      else localStorage.removeItem(key);
      setMessage("");
      window.dispatchEvent(new Event(changeEvent));
    } catch {
      setMessage("This browser could not save the camera preference.");
    }
  };

  const enable = async () => {
    if (!key) return;
    if (!window.isSecureContext || !navigator.mediaDevices) {
      setMessage("Camera access is unavailable here. You can still send Charts manually.");
      return;
    }
    const broker = new BrowserCameraBroker(navigator.mediaDevices);
    cameraRequest.current = broker;
    setRequestingKey(key);
    setMessage("");
    try {
      const lease = await broker.acquire(true, document.visibilityState === "visible");
      lease.release();
      if (cameraRequest.current === broker) save(true);
    } catch {
      if (cameraRequest.current === broker)
        setMessage("Allow camera access to enable hand gestures. Manual transfer is available.");
    } finally {
      if (cameraRequest.current === broker) {
        cameraRequest.current = null;
        setRequestingKey(null);
      }
    }
  };
  return (
    <section className="harbor-stack" aria-labelledby="chart-transfer-preference">
      <h2 id="chart-transfer-preference">Chart hand gestures</h2>
      <label>
        <input
          type="checkbox"
          checked={enabled}
          disabled={!key || requesting}
          aria-describedby="chart-transfer-privacy"
          onChange={(event) => {
            if (event.target.checked) void enable();
            else save(false);
          }}
        />{" "}
        Use hand gestures on this device
      </label>
      <p id="chart-transfer-privacy">
        Allow the camera on each device you want to use for gestures. With a Chart open, close an open hand into a fist
        to pick it up. Open your fist in front of another connected device to receive it there. Camera images and hand
        landmarks stay on this device. The camera runs while an eligible connected Voyage is visible.
      </p>
      {requesting && <p role="status">Waiting for camera permission…</p>}
      {message && <p role="alert">{message}</p>}
    </section>
  );
}
