"use client";
import { useEffect, useState } from "react";
import { landfallNativeHost, landfallNativeRequest } from "@/landfall/native-bridge";
import { z } from "zod";

const stateSchema = z.object({ state: z.string() });
const registrationSchema = z.object({
  available: z.literal(true),
  returnHandle: z.string().regex(/^[A-Za-z0-9_-]{32,2048}$/),
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  radiusMeters: z.number().min(100).max(10000),
  expiresAt: z.number().int().nonnegative(),
});
export function LandfallBackgroundPanel({ sessionId, csrfToken }: { sessionId: string; csrfToken: string }) {
  const [native, setNative] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notices, setNotices] = useState(true);
  const [message, setMessage] = useState("Background reminders are off. Foreground navigation remains available.");
  useEffect(() => {
    setNative(Boolean(landfallNativeHost()));
    const receive = (event: Event) => {
      const value = (event as CustomEvent).detail;
      if (value?.type === "lifecycle" && Array.isArray(value.pendingHints) && value.pendingHints.length)
        setMessage(
          "A broad arrival hint is waiting. Open the current Chart and choose Use my location for a fresh check. No visit has been confirmed.",
        );
    };
    window.addEventListener("landfall-native-event", receive);
    return () => window.removeEventListener("landfall-native-event", receive);
  }, []);
  if (!native) return null;
  const enable = async () => {
    setBusy(true);
    try {
      const foreground = stateSchema.parse(await landfallNativeRequest("LOCATION_PERMISSION"));
      if (foreground.state !== "GRANTED") {
        setMessage(
          "Precise foreground permission is needed for a broad reminder. You can continue with the chart and readable fallback.",
        );
        return;
      }
      const background = stateSchema.parse(await landfallNativeRequest("BACKGROUND_PERMISSION"));
      if (background.state !== "GRANTED") {
        setMessage(
          "Allow background location in the system prompt or app settings, then return and choose Enable reminders again. You can leave it off.",
        );
        return;
      }
      if (notices) {
        const notification = stateSchema.parse(await landfallNativeRequest("NOTIFICATION_PERMISSION"));
        if (notification.state !== "GRANTED") {
          setMessage(
            "Allow notifications, then choose Enable reminders again, or turn off notifications for silent wake hints.",
          );
          return;
        }
      }
      const response = await fetch(`/api/player/playthroughs/${encodeURIComponent(sessionId)}/landfall/background`, {
        method: "POST",
        headers: { "x-csrf-token": csrfToken },
        cache: "no-store",
      });
      if (!response.ok) throw new Error("ACCESS_CHANGED");
      const registration = registrationSchema.parse(await response.json());
      await landfallNativeRequest("GEOFENCE_CLEAR");
      const state = stateSchema.parse(
        await landfallNativeRequest("GEOFENCE_REGISTER", { ...registration, notifications: notices }),
      );
      setMessage(
        state.state === "GRANTED"
          ? "Broad reminder enabled for the released objective for up to one hour. Wake and notification timing depend on the device. A fresh foreground check is required to confirm arrival."
          : "Background reminders are unavailable on this device. Foreground navigation and readable fallback remain available.",
      );
    } catch {
      setMessage(
        "The reminder could not be prepared. Reopen the current Chart and verify Voyage access; foreground navigation remains available.",
      );
    } finally {
      setBusy(false);
    }
  };
  const disable = async () => {
    setBusy(true);
    try {
      await landfallNativeRequest("GEOFENCE_CLEAR");
      setMessage("Background reminders and their pending hints are cleared.");
    } catch {
      setMessage("Open system app settings to disable background location if the device cannot clear reminders.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section aria-label="Optional background reminders">
      <p>
        Broad reminders share the released objective’s area with this device’s location service. They may be delayed and
        do not verify arrival. Turn them off at any time.
      </p>
      <label>
        <input type="checkbox" checked={notices} onChange={(event) => setNotices(event.target.checked)} /> Receive a
        generic notification when near the objective
      </label>
      <p role="status">{message}</p>
      <button type="button" disabled={busy} onClick={() => void enable()}>
        Enable reminders
      </button>
      <button type="button" disabled={busy} onClick={() => void disable()}>
        Disable reminders
      </button>
    </section>
  );
}
