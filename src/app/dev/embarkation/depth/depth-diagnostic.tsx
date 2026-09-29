"use client";
import { useEffect, useRef, useState } from "react";
import { qualifyDepth } from "@/animation/embarkation/depth-qualification";
import { qualifyLens } from "@/animation/embarkation/lens-qualification";
import { qualifyExposure } from "@/animation/embarkation/exposure-qualification";
export function DepthDiagnostic() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const lensCanvas = useRef<HTMLCanvasElement>(null);
  const exposureCanvas = useRef<HTMLCanvasElement>(null);
  const [result, setResult] = useState<unknown>(null);
  const [lens, setLens] = useState<unknown>(null);
  const [exposure, setExposure] = useState<unknown>(null);
  useEffect(() => {
    let owned = true;
    qualifyDepth(canvas.current!)
      .then((report) => {
        if (owned) {
          setResult(report);
          setLens(qualifyLens(lensCanvas.current!));
          setExposure(qualifyExposure(exposureCanvas.current!));
        }
      })
      .catch((error) => {
        if (owned) setResult({ error: String(error) });
      });
    return () => {
      owned = false;
    };
  }, []);
  return (
    <section style={{ padding: 24 }}>
      <p>
        Four overlapping cutouts exchange depths and submission order. Soft/torn paper, title, timber and a translucent
        card use the production paint and depth passes.
      </p>
      <canvas ref={canvas} width={512} height={384} style={{ width: 512, height: 384 }} />
      <pre data-testid="depth-report" style={{ whiteSpace: "pre-wrap" }}>
        {JSON.stringify(result, null, 2)}
      </pre>
      <p>Lens-water optical proof: independent beads, coalescence, deposited-film refraction and drainage.</p>
      <canvas ref={lensCanvas} width={512} height={384} style={{ width: 512, height: 384 }} />
      <pre data-testid="lens-report" style={{ whiteSpace: "pre-wrap" }}>
        {JSON.stringify(lens, null, 2)}
      </pre>
      <p>
        Exposure proof: moving silhouettes, rotating and deforming material, camera-only travel, near passes and common
        focus.
      </p>
      <canvas ref={exposureCanvas} width={512} height={384} style={{ width: 512, height: 384 }} />
      <pre data-testid="exposure-report" style={{ whiteSpace: "pre-wrap" }}>
        {JSON.stringify(exposure, null, 2)}
      </pre>
    </section>
  );
}
