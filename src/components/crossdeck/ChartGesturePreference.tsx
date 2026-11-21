"use client";

import { useState, useSyncExternalStore } from "react";
import { useOptionalCurrentUser } from "@/components/auth/CurrentUserProvider";

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
  const state = useOptionalCurrentUser()?.state;
  return state?.authenticated ? `voyagewright:chart-gestures:${state.user.accountId}` : null;
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
  const [failed, setFailed] = useState(false);
  return (
    <section className="harbor-stack" aria-labelledby="chart-transfer-preference">
      <h2 id="chart-transfer-preference">Chart hand gestures</h2>
      <label>
        <input
          type="checkbox"
          checked={enabled}
          disabled={!key}
          aria-describedby="chart-transfer-privacy"
          onChange={(event) => {
            if (!key) return;
            try {
              if (event.target.checked) localStorage.setItem(key, "enabled");
              else localStorage.removeItem(key);
              setFailed(false);
              window.dispatchEvent(new Event(changeEvent));
            } catch {
              setFailed(true);
            }
          }}
        />{" "}
        Use hand gestures on this device
      </label>
      <p id="chart-transfer-privacy">
        Allow the camera on each device you want to use for gestures. With a Chart open, close an open hand into a fist
        to pick it up. Open your fist in front of another connected device to receive it there. Camera images and hand
        landmarks stay on this device. The camera runs while an eligible connected Voyage is visible.
      </p>
      {failed && <p role="alert">This browser could not save the camera preference.</p>}
    </section>
  );
}
