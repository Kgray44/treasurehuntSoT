"use client";
import { useEffect, useId, useRef, useState } from "react";
import type { WebSextantRuntime } from "./web-runtime";
import type { PermissionPurpose } from "./permissions";
import { magneticHuntSchema, magneticSafetyCopy } from "./field-context";

/** Reference consumer: optional local guidance with a permanently usable screen alternative. */
export function MagneticHuntControls({
  runtime,
  config: input,
  purpose,
  onAlternative,
  onReferenceReached,
}: {
  runtime: WebSextantRuntime;
  config: unknown;
  purpose: Omit<PermissionPurpose, "consent" | "userInitiated">;
  onAlternative: () => void;
  onReferenceReached: () => void;
}) {
  const config = magneticHuntSchema.parse(input),
    id = useId();
  const [consent, setConsent] = useState(false),
    [active, setActive] = useState(false),
    [message, setMessage] = useState("Magnetic guidance is optional. You can use the screen clue at any time.");
  const session = useRef<{ release: () => Promise<void> } | null>(null),
    generation = useRef(0);
  const stop = async () => {
    generation.current++;
    const previous = session.current;
    session.current = null;
    await previous?.release();
  };
  useEffect(
    () => () => {
      generation.current++;
      void runtime.leases.cancelConsumer(purpose.consumerId);
      runtime.haptics.cancelConsumer(purpose.consumerId);
    },
    [runtime, purpose.consumerId],
  );
  async function start() {
    const epoch = ++generation.current;
    setActive(true);
    const lease = await runtime.beginMagneticHunt(
      config,
      {
        ...purpose,
        consent,
        userInitiated: true,
        updateClass: "INTERACTIVE",
        minimumQuality: "MEDIUM",
        maxAgeMs: 1000,
        expiresAt: performance.now() + config.timeoutMs,
        retentionClass: "EPHEMERAL",
        foregroundRequirement: true,
      },
      (result) => {
        if (epoch !== generation.current) return;
        if (result.state === "SEARCHING")
          setMessage("Establishing a local baseline, then watching for a sustained field change.");
        else if (result.state === "REFERENCE_REACHED") {
          setActive(false);
          setMessage("A sustained local field change was observed. Follow the clue on screen.");
          onReferenceReached();
        } else {
          setActive(false);
          setMessage("Magnetic guidance is unavailable or uncertain. Use the screen clue below.");
        }
      },
    );
    if (epoch !== generation.current) await lease.release();
    else session.current = lease;
  }
  return (
    <section
      aria-label="Magnetic clue guidance"
      className="rounded-xl border border-amber-200/20 bg-slate-950/80 p-4 text-amber-50"
    >
      <p>{purpose.purpose}</p>
      <p>{magneticSafetyCopy}</p>
      <p role="status" aria-live="polite">
        {message}
      </p>
      <label htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          checked={consent}
          onChange={(event) => {
            setConsent(event.target.checked);
            if (!event.target.checked) {
              void stop();
              void runtime.leases.cancelConsumer(purpose.consumerId);
              setActive(false);
            }
          }}
        />{" "}
        Allow local magnetic guidance for this clue
      </label>
      <div className="mt-3 flex flex-wrap gap-3">
        <button
          type="button"
          className="rounded-lg border px-4 py-2 focus-visible:outline"
          disabled={!consent || active}
          onClick={() => void start()}
        >
          Try magnetic guidance
        </button>
        <button
          type="button"
          className="rounded-lg border px-4 py-2 focus-visible:outline"
          disabled={!active}
          onClick={() => {
            void stop();
            void runtime.leases.cancelConsumer(purpose.consumerId);
            setActive(false);
            setMessage("Magnetic guidance is paused. The screen clue remains available.");
          }}
        >
          Pause magnetic guidance
        </button>
        <button
          type="button"
          className="rounded-lg border px-4 py-2 focus-visible:outline"
          onClick={() => {
            void stop();
            void runtime.leases.cancelConsumer(purpose.consumerId);
            setActive(false);
            onAlternative();
          }}
        >
          {config.fallback}
        </button>
      </div>
    </section>
  );
}
