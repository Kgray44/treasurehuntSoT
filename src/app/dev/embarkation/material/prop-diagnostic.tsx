"use client";
import { useEffect, useRef, useState } from "react";
import { preparePropQualification } from "@/animation/embarkation/prop-qualification";

type Probe = Awaited<ReturnType<typeof preparePropQualification>>;
declare global {
  interface Window {
    __embarkationPropMaterial?: Probe;
  }
}
export function PropDiagnostic() {
  const canvas = useRef<HTMLCanvasElement>(null),
    probe = useRef<Probe | null>(null);
  const [asset, setAsset] = useState("P1-map-fragment"),
    [angle, setAngle] = useState(0),
    [neutral, setNeutral] = useState(false),
    [warm, setWarm] = useState(false),
    [turn, setTurn] = useState(false);
  const [report, setReport] = useState<unknown>("Preparing hero materials");
  useEffect(() => {
    const abort = new AbortController();
    preparePropQualification(canvas.current!, abort.signal)
      .then((value) => {
        if (abort.signal.aborted) {
          value.dispose();
          return;
        }
        probe.current = value;
        window.__embarkationPropMaterial = value;
        const difference = (a: Uint8Array, b: Uint8Array) => {
          let sum = 0,
            changed = 0,
            peak = 0;
          for (let i = 0; i < a.length; i += 4) {
            let delta = 0;
            for (let k = 0; k < 3; k++) {
              const d = Math.abs(a[i + k] - b[i + k]);
              sum += d;
              delta = Math.max(delta, d);
            }
            if (delta > 8) changed++;
            peak = Math.max(peak, delta);
          }
          return {
            meanByteDifference: sum / ((a.length / 4) * 3),
            changedPixelsAbove8: changed,
            peakByteDifference: peak,
          };
        };
        const samples = [];
        for (const name of ["P1-map-fragment", "P2-compass", "P4-journal-page", "P7-sailcloth", "derived/scrap-2"]) {
          value.draw(name, Math.PI);
          const back = value.pixels();
          value.draw(name, Math.PI, { substitutePrint: true });
          const substitutedBack = value.pixels();
          value.draw(name, Math.PI, { printedReverse: true });
          const mirrored = value.pixels();
          value.draw(name, Math.PI / 2);
          const edge = value.pixels();
          value.draw(name, Math.PI / 2, { thickness: false });
          const flat = value.pixels();
          samples.push({
            asset: name,
            reverseDifference: difference(back, mirrored),
            edgeDifference: difference(edge, flat),
            frontPrintContamination: difference(back, substitutedBack),
          });
        }
        setReport({
          samples,
          initial: value.draw("P1-map-fragment", 0),
          scope:
            "Production shaders and geometry on a neutral stage. Actual shot and audio qualification are separate.",
        });
      })
      .catch((error) => {
        if (!abort.signal.aborted) setReport({ error: String(error) });
      });
    return () => {
      abort.abort();
      probe.current?.dispose();
      probe.current = null;
      delete window.__embarkationPropMaterial;
    };
  }, []);
  useEffect(() => {
    probe.current?.draw(asset, (angle * Math.PI) / 180, { neutral, background: warm ? "warm" : "teal" });
  }, [asset, angle, neutral, warm]);
  useEffect(() => {
    if (!turn) return;
    let frame = 0,
      last = 0;
    const tick = (now: number) => {
      if (last) setAngle((a) => (a + (now - last) * 0.018) % 360);
      last = now;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [turn]);
  return (
    <section style={{ padding: 24 }}>
      <h2>Hero front, reverse and silhouette edges</h2>
      <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        <label>
          Prop{" "}
          <select value={asset} onChange={(e) => setAsset(e.target.value)}>
            {["P1-map-fragment", "P2-compass", "P4-journal-page", "P7-sailcloth", "derived/scrap-2"].map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </label>
        <label>
          Rotation {angle.toFixed(1)}°{" "}
          <input
            aria-label="Prop rotation"
            type="range"
            min={0}
            max={360}
            step={0.1}
            value={angle}
            onChange={(e) => setAngle(+e.target.value)}
          />
        </label>
        <button onClick={() => setTurn((v) => !v)}>{turn ? "Pause turn" : "Slow turn"}</button>
        <label>
          <input type="checkbox" checked={neutral} onChange={(e) => setNeutral(e.target.checked)} />
          Neutral geometry
        </label>
        <label>
          <input type="checkbox" checked={warm} onChange={(e) => setWarm(e.target.checked)} />
          Warm background
        </label>
      </div>
      <canvas
        ref={canvas}
        aria-label="Hero material output"
        width={900}
        height={650}
        style={{ width: 900, maxWidth: "100%", height: "auto" }}
      />
      <pre data-testid="prop-material-report" style={{ whiteSpace: "pre-wrap" }}>
        {JSON.stringify(report, null, 2)}
      </pre>
    </section>
  );
}
