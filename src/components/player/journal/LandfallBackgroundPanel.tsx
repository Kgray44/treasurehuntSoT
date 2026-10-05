"use client";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { landfallNativeHost, landfallNativeRequest } from "@/landfall/native-bridge";
import { z } from "zod";

const stateSchema = z.object({
  state: z.enum([
    "GRANTED",
    "PROMPTABLE",
    "DENIED",
    "DENIED_PERMANENTLY",
    "UNAVAILABLE",
    "UNSUPPORTED",
    "PERMISSION_REQUIRED",
  ]),
});
const clearSchema = z.object({ accepted: z.literal(true) });
const subscribeHost = (notify: () => void) => {
  window.addEventListener("landfall-native-event", notify);
  return () => window.removeEventListener("landfall-native-event", notify);
};
const nativeSnapshot = () => Boolean(landfallNativeHost());
async function bounded<T>(promise: Promise<T>) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("REMINDER_TIMEOUT")), 8000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
const registrationSchema = z.object({
  available: z.literal(true),
  returnHandle: z.string().regex(/^[A-Za-z0-9_-]{32,2048}$/),
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  radiusMeters: z.number().min(100).max(10000),
  expiresAt: z.number().int().nonnegative(),
});
export function LandfallBackgroundPanel({ sessionId, csrfToken }: { sessionId: string; csrfToken: string }) {
  const native = useSyncExternalStore(subscribeHost, nativeSnapshot, () => false);
  const [busy, setBusy] = useState(false);
  const [notices, setNotices] = useState(true);
  const [message, setMessage] = useState("Background reminders are off. Foreground navigation remains available.");
  const generation = useRef(0),
    active = useRef(false),
    registering = useRef(false),
    abort = useRef<AbortController | null>(null);
  const cancel = useCallback((update = false) => {
    generation.current++;
    abort.current?.abort();
    active.current = false;
    if (registering.current) void landfallNativeRequest("GEOFENCE_CLEAR").catch(() => undefined);
    registering.current = false;
    if (update) {
      setBusy(false);
      setMessage("Return to the Chart and choose Enable reminders again. Nothing starts automatically.");
    }
  }, []);
  useEffect(() => {
    const receive = (event: Event) => {
      const value = (event as CustomEvent).detail;
      if (value?.type === "lifecycle" && value.state === "BACKGROUND" && active.current) {
        cancel(true);
      }
      if (value?.type === "lifecycle" && Array.isArray(value.pendingHints) && value.pendingHints.length)
        setMessage(
          "A broad arrival hint is waiting. Open the current Chart and choose Use my location for a fresh check. No visit has been confirmed.",
        );
    };
    window.addEventListener("landfall-native-event", receive);
    return () => {
      window.removeEventListener("landfall-native-event", receive);
      cancel();
    };
  }, [cancel]);
  if (!native) return null;
  const enable = async () => {
    if (active.current) return;
    const attempt = ++generation.current,
      controller = new AbortController();
    active.current = true;
    abort.current = controller;
    setBusy(true);
    try {
      const foreground = stateSchema.parse(await bounded(landfallNativeRequest("LOCATION_PERMISSION")));
      if (attempt !== generation.current) return;
      if (foreground.state !== "GRANTED") {
        setMessage(
          "Precise foreground permission is needed for a broad reminder. You can continue with the chart and readable fallback.",
        );
        return;
      }
      const background = stateSchema.parse(await bounded(landfallNativeRequest("BACKGROUND_PERMISSION")));
      if (attempt !== generation.current) return;
      if (background.state !== "GRANTED") {
        setMessage(
          "Allow background location in the system prompt or app settings, then return and choose Enable reminders again. You can leave it off.",
        );
        return;
      }
      if (notices) {
        const notification = stateSchema.parse(await bounded(landfallNativeRequest("NOTIFICATION_PERMISSION")));
        if (attempt !== generation.current) return;
        if (notification.state !== "GRANTED") {
          setMessage(
            "Allow notifications, then choose Enable reminders again, or turn off notifications for silent wake hints.",
          );
          return;
        }
      }
      const response = await bounded(
        fetch(`/api/player/playthroughs/${encodeURIComponent(sessionId)}/landfall/background`, {
          method: "POST",
          headers: { "x-csrf-token": csrfToken },
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        }),
      );
      if (attempt !== generation.current) return;
      if (!response.ok) throw new Error("ACCESS_CHANGED");
      const registration = registrationSchema.parse(await bounded(response.json()));
      if (attempt !== generation.current) return;
      clearSchema.parse(await bounded(landfallNativeRequest("GEOFENCE_CLEAR")));
      if (attempt !== generation.current) return;
      registering.current = true;
      const state = stateSchema.parse(
        await bounded(landfallNativeRequest("GEOFENCE_REGISTER", { ...registration, notifications: notices })),
      );
      if (attempt !== generation.current) return;
      registering.current = false;
      setMessage(
        state.state === "GRANTED"
          ? "Broad reminder enabled for the released objective for up to one hour. Wake and notification timing depend on the device. A fresh foreground check is required to confirm arrival."
          : "Background reminders are unavailable on this device. Foreground navigation and readable fallback remain available.",
      );
    } catch {
      if (attempt !== generation.current) return;
      if (registering.current) void landfallNativeRequest("GEOFENCE_CLEAR").catch(() => undefined);
      registering.current = false;
      setMessage(
        "The reminder could not be prepared. Reopen the current Chart and verify Voyage access; foreground navigation remains available.",
      );
    } finally {
      controller.abort();
      if (attempt === generation.current) {
        active.current = false;
        abort.current = null;
        setBusy(false);
      }
    }
  };
  const disable = async () => {
    generation.current++;
    abort.current?.abort();
    abort.current = null;
    active.current = true;
    const attempt = generation.current;
    setBusy(true);
    try {
      clearSchema.parse(await bounded(landfallNativeRequest("GEOFENCE_CLEAR")));
      if (attempt !== generation.current) return;
      registering.current = false;
      setMessage("Background reminders and their pending hints are cleared.");
    } catch {
      if (attempt !== generation.current) return;
      setMessage("Open system app settings to disable background location if the device cannot clear reminders.");
    } finally {
      if (attempt === generation.current) {
        active.current = false;
        setBusy(false);
      }
    }
  };
  return (
    <section aria-label="Optional background reminders">
      <p>
        Broad reminders share the released objective’s area with this device’s location service. They may be delayed and
        do not verify arrival. Turn them off at any time.
      </p>
      <label>
        <input
          type="checkbox"
          checked={notices}
          disabled={busy}
          onChange={(event) => setNotices(event.target.checked)}
        />{" "}
        Receive a generic notification when near the objective
      </label>
      <p role="status">{message}</p>
      <button type="button" style={{ minHeight: 48 }} disabled={busy} onClick={() => void enable()}>
        Enable reminders
      </button>
      <button type="button" style={{ minHeight: 48 }} onClick={() => void disable()}>
        Disable reminders
      </button>
    </section>
  );
}
