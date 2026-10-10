"use client";
import { useEffect, useId, useRef, useState } from "react";
import type { PermissionPurpose } from "./permissions";
import type { WebSextantRuntime } from "./web-runtime";
/** Consumer-owned placement; shared controls never acquire sensors until the user consents in context. */
export function DeviceContextControls({
  runtime,
  capabilityId,
  purpose,
  fallbackLabel,
  onAlternative,
  onReady,
}: {
  runtime: WebSextantRuntime;
  capabilityId: string;
  purpose: Omit<PermissionPurpose, "consent" | "userInitiated">;
  fallbackLabel: string;
  onAlternative: () => void;
  onReady: () => void;
}) {
  const id = useId();
  const generation = useRef(0);
  useEffect(
    () => () => {
      generation.current++;
      void runtime.leases.cancelConsumer(purpose.consumerId);
      runtime.haptics.cancelConsumer(purpose.consumerId);
    },
    [runtime, purpose.consumerId],
  );
  const [consent, setConsent] = useState(false),
    [pending, setPending] = useState(false),
    [message, setMessage] = useState("");
  const [status, setStatus] = useState(() => runtime.status(capabilityId));
  useEffect(() => {
    const refresh = () => setStatus(runtime.status(capabilityId));
    const unsubscribe = runtime.onStatusChange(refresh);
    const timer = setInterval(refresh, 1000);
    refresh();
    return () => {
      unsubscribe();
      clearInterval(timer);
    };
  }, [runtime, capabilityId]);
  async function enable() {
    const startedGeneration = generation.current;
    setPending(true);
    setMessage("");
    try {
      if (status.paused) runtime.resume(true);
      const decision = await runtime.enable({
        ...purpose,
        consent,
        userInitiated: true,
        retry: status.permission === "DENIED",
      });
      if (generation.current !== startedGeneration) return;
      if (decision === "GRANTED") {
        setMessage("Ready. Device input stays local and stops when you pause or leave this screen.");
        onReady();
      } else setMessage("Device input is unavailable. You can continue with the alternative below.");
    } catch {
      setMessage("Device input could not start. You can continue with the alternative below.");
    } finally {
      setPending(false);
    }
  }
  const disabled = status.support === "UNSUPPORTED" || status.reason === "SESSION_ENDED";
  const explanation = status.paused
    ? "Device input is paused."
    : status.freshness === "STALE"
      ? "The device reading is out of date."
      : disabled
        ? "This browser cannot provide this device input."
        : status.permission === "DENIED"
          ? "Device permission was declined."
          : status.freshness === "FRESH"
            ? "Device input is active."
            : "Device input is optional. Screen controls are available.";
  return (
    <section
      aria-label="Device input"
      className="rounded-xl border border-amber-200/20 bg-slate-950/80 p-4 text-amber-50"
    >
      <p>{purpose.purpose}</p>
      <p role="status" aria-live="polite">
        {message || explanation}
      </p>
      <label htmlFor={id} className="mt-3 flex items-center gap-2">
        <input
          id={id}
          type="checkbox"
          checked={consent}
          onChange={(event) => {
            setConsent(event.target.checked);
            if (!event.target.checked) {
              generation.current++;
              void runtime.leases.cancelConsumer(purpose.consumerId);
              runtime.haptics.cancelConsumer(purpose.consumerId);
            }
          }}
          disabled={pending || disabled}
        />
        Allow device motion for this interaction
      </label>
      <div className="mt-3 flex flex-wrap gap-3">
        <button
          type="button"
          className="rounded-lg border border-amber-200/40 px-4 py-2 focus-visible:outline focus-visible:outline-2"
          disabled={!consent || pending || disabled}
          onClick={() => void enable()}
        >
          {pending
            ? "Requesting permission…"
            : status.paused
              ? "Resume device input"
              : status.permission === "DENIED"
                ? "Try device input again"
                : "Enable device input"}
        </button>
        <button
          type="button"
          className="rounded-lg border border-amber-200/40 px-4 py-2 focus-visible:outline focus-visible:outline-2"
          disabled={pending || status.paused || disabled}
          onClick={() => void runtime.pause()}
        >
          Pause device input
        </button>
        <button
          type="button"
          className="rounded-lg border border-amber-200/40 px-4 py-2 focus-visible:outline focus-visible:outline-2"
          onClick={() => {
            void runtime.pause().then(onAlternative);
          }}
        >
          {fallbackLabel}
        </button>
      </div>
    </section>
  );
}
