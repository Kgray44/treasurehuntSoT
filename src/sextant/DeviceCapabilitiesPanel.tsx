"use client";
import { useEffect, useId, useRef, useState } from "react";
import { webSextantRuntime, type WebSextantRuntime } from "./web-runtime";
import type { WebSensorTarget } from "./web-provider";
import type { CapabilityState } from "./contracts";
import { DeviceContextControls } from "./DeviceContextControls";
const capabilities = [
  ["sextant.orientation.relative", "Orientation"],
  ["sextant.motion.stability", "Motion"],
  ["sextant.magnetic.field", "Magnetic guidance"],
  ["sextant.pressure.observation", "Relative elevation"],
  ["sextant.media.camera", "Camera"],
  ["sextant.media.microphone", "Microphone"],
  ["sextant.haptics.basic", "Vibration"],
  ["sextant.nearby.ble.scan", "Nearby Bluetooth"],
  ["sextant.nearby.nfc.read", "Contactless tags"],
  ["sextant.nearby.uwb.range", "Nearby ranging"],
] as const;
export function deviceCapabilityCopy(state: CapabilityState) {
  if (state.lifecycle === "SUSPENDED") return "Paused while this screen is inactive";
  if (state.support === "UNSUPPORTED") return "Unavailable on this device";
  if (state.permission === "DENIED" || state.permission === "RESTRICTED")
    return "Permission is unavailable; use screen controls";
  if (state.support === "UNKNOWN") return "Availability has not been confirmed";
  if (state.availability === "BUSY") return "Currently in use";
  if (state.permission === "PROMPT") return "Permission is needed for this optional input";
  if (state.availability === "TEMPORARILY_UNAVAILABLE") return "Temporarily unavailable";
  if (state.quality === "LOW" || state.availability === "DEGRADED")
    return "Limited input; screen controls remain available";
  return "Available for optional use";
}
/** Normal account-device surface. Discovery starts no input; previews hold only
 * consumer-owned ephemeral leases and never call a progression writer. */
export function DeviceCapabilitiesPanel() {
  const id = useId(),
    consumerId = `device-controls-${id}`;
  const mounted = useRef(false),
    preview = useRef<AbortController | null>(null);
  const [runtime, setRuntime] = useState<WebSextantRuntime | null>(null),
    [states, setStates] = useState<Record<string, CapabilityState>>({}),
    [message, setMessage] = useState(""),
    [enabled, setEnabled] = useState(true),
    [reduced, setReduced] = useState(false),
    [systemReduced, setSystemReduced] = useState(false);
  useEffect(() => {
    const current = webSextantRuntime(window as unknown as WebSensorTarget, navigator);
    mounted.current = true;
    const refresh = () => {
      if (mounted.current)
        setStates(Object.fromEntries(capabilities.map(([id]) => [id, current.projectCapability(id)])));
    };
    setRuntime(current);
    setEnabled(current.haptics.status().enabled);
    setReduced(current.haptics.status().reducedSensory);
    const detach = current.onStatusChange(refresh);
    refresh();
    void current.ready.then(refresh).catch(() => {
      if (mounted.current) setMessage("Device availability could not be checked. Screen controls remain available.");
    });
    const sensory = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncSensory = () => {
      setSystemReduced(sensory.matches);
      if (sensory.matches) {
        current.setHapticPreferences(current.haptics.status().enabled, true);
        setReduced(true);
      }
    };
    syncSensory();
    sensory.addEventListener("change", syncSensory);
    return () => {
      mounted.current = false;
      preview.current?.abort();
      sensory.removeEventListener("change", syncSensory);
      detach();
      void current.leases.cancelConsumer(consumerId);
      current.haptics.cancelConsumer(consumerId);
    };
  }, [consumerId]);
  async function previewMotion() {
    if (!runtime) return;
    preview.current?.abort();
    const scope = new AbortController();
    preview.current = scope;
    try {
      await runtime.leases.cancelConsumer(consumerId);
      if (!mounted.current || scope.signal.aborted) return;
      await runtime.acquire(
        {
          capabilityId: "sextant.motion.stability",
          consumerId,
          surfaceId: "device-settings",
          purpose: "Preview optional motion; screen controls remain available",
          consent: true,
          userInitiated: true,
          updateClass: "INTERACTIVE",
          minimumQuality: "MEDIUM",
          maxAgeMs: 500,
          expiresAt: performance.now() + 10000,
          frames: ["DEVICE"],
          retentionClass: "EPHEMERAL",
          foregroundRequirement: true,
        },
        (event) => {
          if (!mounted.current || scope.signal.aborted) return;
          if (event.type === "OBSERVATION")
            setMessage(
              event.observation.value === "STABLE"
                ? "The device is steady."
                : event.observation.value === "MOVING"
                  ? "Movement was observed."
                  : "Waiting for a steady reading.",
            );
          else setMessage("Motion preview ended. Screen controls remain available.");
        },
        { signal: scope.signal },
      );
    } catch {
      if (mounted.current && !scope.signal.aborted)
        setMessage("Motion preview is unavailable. Screen controls remain available.");
    }
  }
  return (
    <section aria-label="Optional device input" className="mt-6 rounded-xl border border-amber-200/20 p-4">
      <h2>Optional device input</h2>
      <p>Choose whether to use this device&apos;s input. You can continue with screen controls at any time.</p>
      <dl className="my-4 grid gap-3 sm:grid-cols-2">
        {capabilities.map(([capability, label]) => (
          <div key={capability}>
            <dt className="font-semibold">{label}</dt>
            <dd>{states[capability] ? deviceCapabilityCopy(states[capability]) : "Checking availability…"}</dd>
          </div>
        ))}
      </dl>
      {runtime && (
        <DeviceContextControls
          runtime={runtime}
          capabilityId="sextant.motion.stability"
          purpose={{
            consumerId,
            surfaceId: "device-settings",
            purpose: "Preview optional motion for up to ten seconds. Readings stay on this device.",
          }}
          fallbackLabel="Continue with screen controls"
          onReady={() => void previewMotion()}
          onAlternative={() => setMessage("Screen controls are ready. Device input is optional.")}
        />
      )}
      <div className="mt-4 flex flex-wrap gap-3">
        <label>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => {
              setEnabled(event.target.checked);
              runtime?.setHapticPreferences(event.target.checked, reduced);
            }}
          />{" "}
          Allow vibration feedback
        </label>
        <label>
          <input
            type="checkbox"
            checked={reduced}
            disabled={systemReduced}
            onChange={(event) => {
              setReduced(event.target.checked);
              runtime?.setHapticPreferences(enabled, event.target.checked);
            }}
          />{" "}
          Reduce sensory feedback
        </label>
        <button
          type="button"
          className="rounded-lg border px-4 py-2 focus-visible:outline"
          disabled={!runtime || !enabled || reduced || states["sextant.haptics.basic"]?.support !== "SUPPORTED"}
          onClick={() =>
            void runtime?.haptics
              .requestAsync({
                cue: "TICK",
                consumerId,
                purpose: "Preview optional feedback",
                fallback: "Show confirmation on screen",
              })
              .then((result) => {
                if (mounted.current)
                  setMessage(
                    result.state === "REQUESTED"
                      ? "Feedback requested. Confirmation remains on screen."
                      : "Vibration is unavailable. Confirmation remains on screen.",
                  );
              })
          }
        >
          Try a short vibration
        </button>
      </div>
      <p role="status" aria-live="polite">
        {message}
      </p>
    </section>
  );
}
