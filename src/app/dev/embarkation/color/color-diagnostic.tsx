"use client";
import { useEffect, useRef, useState } from "react";
import { qualifyColor } from "@/animation/embarkation/color-qualification";
export function ColorDiagnostic() {
  const floating = useRef<HTMLCanvasElement>(null),
    fallback = useRef<HTMLCanvasElement>(null);
  const [result, setResult] = useState<unknown>(null);
  const job = useRef<Promise<unknown> | null>(null);
  useEffect(() => {
    let active = true;
    job.current ??= (async () => {
      const full = await qualifyColor(floating.current!);
      const limited = await qualifyColor(fallback.current!, true);
      return { floating: full, fallback: limited };
    })();
    void job.current.then(
      (value) => {
        if (active) setResult(value);
      },
      (error) => {
        if (active) setResult({ error: String(error) });
      },
    );
    return () => {
      active = false;
    };
  }, []);
  return (
    <section>
      <p>No-effect ramp, linear alpha/addition, native CSS alpha and unchanged numeric masks.</p>
      <canvas ref={floating} />
      <canvas ref={fallback} />
      <pre data-testid="color-report">{JSON.stringify(result, null, 2)}</pre>
    </section>
  );
}
