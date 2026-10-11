"use client";
import { useEffect, useRef, useState } from "react";
import { webSextantRuntime, type WebSextantRuntime } from "@/sextant/web-runtime";
import { DeviceContextControls } from "@/sextant/DeviceContextControls";
import type { LeaseEvent } from "@/sextant/leases";
import type { WebSensorTarget } from "@/sextant/web-provider";

export function PilotCompass() {
  const [runtime, setRuntime] = useState<WebSextantRuntime | null>(null);
  const [reading, setReading] = useState("Read the compass rose here, or use this device’s optional heading.");
  const [revealed, setRevealed] = useState(false);
  const generation = useRef(0);
  const release = useRef<(() => Promise<void>) | null>(null);
  const consumerId = "spatial-pilot-compass";
  useEffect(() => {
    const device = webSextantRuntime(window as unknown as WebSensorTarget, navigator);
    setRuntime(device);
    const timer = setInterval(() => {
      if (release.current && device.status("sextant.heading.estimate", 1000).freshness !== "FRESH")
        setReading("The heading is unavailable or out of date. Use the compass rose.");
    }, 1000);
    return () => {
      clearInterval(timer);
      generation.current++;
      void device.leases.cancelConsumer(consumerId);
    };
  }, []);
  async function start() {
    if (!runtime) return;
    const epoch = ++generation.current;
    await release.current?.();
    setReading("Waiting for a trustworthy north-referenced heading…");
    const observe = (event: LeaseEvent) => {
      if (generation.current !== epoch) return;
      if (event.type !== "OBSERVATION") {
        setReading("The heading is unavailable. Use the compass rose.");
        return;
      }
      const o = event.observation;
      if (
        !["EARTH_TRUE", "EARTH_MAGNETIC"].includes(o.referenceFrame) ||
        typeof o.value !== "number" ||
        o.uncertainty === undefined ||
        o.uncertainty > 20
      ) {
        setReading("This reading cannot reliably identify north. Use the compass rose.");
        return;
      }
      setReading(
        `${Math.round(o.value)}° · ${o.referenceFrame === "EARTH_TRUE" ? "true" : "magnetic"} north · uncertainty ±${Math.round(o.uncertainty)}°`,
      );
      if (Math.min(o.value, 360 - o.value) <= 20) setRevealed(true);
    };
    try {
      const lease = await runtime.acquire(
        {
          capabilityId: "sextant.heading.estimate",
          consumerId,
          surfaceId: "pilot-compass",
          purpose: "Find the northern light on Morrow’s chart",
          consent: true,
          userInitiated: true,
          updateClass: "INTERACTIVE",
          minimumQuality: "MEDIUM",
          maxAgeMs: 1000,
          expiresAt: performance.now() + 60000,
          frames: ["EARTH_TRUE", "EARTH_MAGNETIC"],
          retentionClass: "EPHEMERAL",
          foregroundRequirement: true,
        },
        observe,
      );
      if (epoch !== generation.current) await lease.release();
      else release.current = lease.release;
    } catch {
      setReading("This device cannot supply a trustworthy heading. Use the compass rose.");
    }
  }
  return (
    <details className="pilot-compass">
      <summary>Morrow’s compass</summary>
      <p aria-live="polite">{reading}</p>
      <div aria-label="Compass rose" className="pilot-rose">
        <span>N</span>
        <span>✦</span>
        <span>The northern light</span>
      </div>
      {runtime && (
        <DeviceContextControls
          runtime={runtime}
          capabilityId="sextant.heading.estimate"
          purpose={{
            consumerId,
            surfaceId: "pilot-compass",
            purpose: "Find the northern light. Heading stays on this device.",
          }}
          fallbackLabel="Read the compass rose"
          onAlternative={() => {
            generation.current++;
            setRevealed(true);
          }}
          onReady={() => void start()}
        />
      )}
      {revealed && (
        <p className="journal-prose">
          Beyond the northern light, the returning tide leads to the erased harbor. Keep this bearing and continue in
          your Journal.
        </p>
      )}
    </details>
  );
}
