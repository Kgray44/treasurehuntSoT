"use client";

import { useEffect, useState } from "react";
import { readAnimationMetrics } from "@/animation/core/metrics";
import type { DirectorSnapshot } from "@/animation/core/animation-types";

export function AnimationMetrics({ snapshot }: { snapshot: DirectorSnapshot }) {
  const [fps, setFps] = useState(60);
  const [longTasks, setLongTasks] = useState(0);
  const [mounted, setMounted] = useState(readAnimationMetrics());
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    let animationFrame = 0;
    const tick = (now: number) => {
      frame += 1;
      if (now - last >= 1000) {
        setFps(Math.round((frame * 1000) / (now - last)));
        frame = 0;
        last = now;
      }
      animationFrame = requestAnimationFrame(tick);
    };
    animationFrame = requestAnimationFrame(tick);
    const metrics = () => setMounted(readAnimationMetrics());
    const visibility = () => setVisible(!document.hidden);
    window.addEventListener("forever-animation-metrics", metrics);
    document.addEventListener("visibilitychange", visibility);
    let observer: PerformanceObserver | undefined;
    try {
      observer = new PerformanceObserver((list) => setLongTasks((count) => count + list.getEntries().length));
      observer.observe({ type: "longtask", buffered: true });
    } catch {
      // Long Task API is not available in every supported browser.
    }
    return () => {
      cancelAnimationFrame(animationFrame);
      observer?.disconnect();
      window.removeEventListener("forever-animation-metrics", metrics);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  return (
    <aside className="animation-metrics" aria-label="Development performance metrics">
      <h2>Live metrics</h2>
      <dl>
        <div>
          <dt>FPS estimate</dt>
          <dd className={fps < 30 ? "metric-warning" : ""}>{fps}</dd>
        </div>
        <div>
          <dt>Scene</dt>
          <dd>{snapshot.scene ?? "idle"}</dd>
        </div>
        <div>
          <dt>GSAP timelines</dt>
          <dd>{mounted.gsap}</dd>
        </div>
        <div>
          <dt>Rive instances</dt>
          <dd>{mounted.rive}</dd>
        </div>
        <div>
          <dt>Lottie instances</dt>
          <dd>{mounted.lottie}</dd>
        </div>
        <div>
          <dt>PageFlip instances</dt>
          <dd>{mounted.pageFlip}</dd>
        </div>
        <div>
          <dt>Visibility</dt>
          <dd>{visible ? "visible" : "hidden"}</dd>
        </div>
        <div>
          <dt>Motion mode</dt>
          <dd>{snapshot.mode}</dd>
        </div>
        <div>
          <dt>Long tasks</dt>
          <dd>{longTasks}</dd>
        </div>
        <div>
          <dt>Asset failures</dt>
          <dd>{mounted.failures.length ? mounted.failures.join(", ") : "none"}</dd>
        </div>
      </dl>
    </aside>
  );
}
