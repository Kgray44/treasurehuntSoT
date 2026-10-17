"use client";
import { useEffect, useRef, type RefObject } from "react";
import { containedFrame, handConnections, type ReachVisualFrame, type ReachTiming } from "./visualization";
import styles from "./ReachLaboratory.module.css";
type Props = {
  frame: RefObject<ReachVisualFrame>;
  timings: RefObject<ReachTiming>;
  kind: "CAMERA" | "POINTER";
  demo?: boolean;
  overlay?: boolean;
  active?: boolean;
};
export function ReachStage({ frame, timings, kind, demo = false, overlay = false, active = true }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!active) return;
    const el = canvas.current!;
    const context = el.getContext("2d");
    if (!context) return;
    let animation = 0;
    const draw = (at: number) => {
      const width = el.clientWidth,
        height = el.clientHeight,
        dpr = Math.min(2, window.devicePixelRatio || 1);
      if (el.width !== Math.round(width * dpr) || el.height !== Math.round(height * dpr)) {
        el.width = Math.round(width * dpr);
        el.height = Math.round(height * dpr);
      }
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, width, height);
      const value = frame.current,
        o = value.observation;
      const fresh = o && at - o.monotonicCaptureTime >= 0 && at - o.monotonicCaptureTime <= 150;
      if (kind === "CAMERA" && o && (fresh || at - o.monotonicCaptureTime <= 450)) {
        const rect = containedFrame(width, height, o.frameWidth, o.frameHeight);
        context.globalAlpha = fresh ? 1 : 0.3;
        for (const hand of o.hands) {
          const selected = hand.trackId === value.activeTrack;
          context.strokeStyle = selected ? "#8be1cd" : "#e7bb77";
          context.fillStyle = selected ? "#caf8ed" : "#ffe2b6";
          context.lineWidth = selected ? 2.5 : 1.8;
          context.lineCap = "round";
          for (const [a, b] of handConnections) {
            const p = hand.landmarks[a],
              q = hand.landmarks[b];
            if (!p.valid || !q.valid) continue;
            context.beginPath();
            context.moveTo(rect.x + p.x * rect.width, rect.y + p.y * rect.height);
            context.lineTo(rect.x + q.x * rect.width, rect.y + q.y * rect.height);
            context.stroke();
          }
          for (const p of hand.landmarks)
            if (p.valid) {
              context.beginPath();
              context.arc(rect.x + p.x * rect.width, rect.y + p.y * rect.height, selected ? 3.5 : 2.5, 0, Math.PI * 2);
              context.fill();
            }
          const tip = hand.landmarks[8];
          if (selected && tip.valid) {
            context.beginPath();
            context.arc(rect.x + tip.x * rect.width, rect.y + tip.y * rect.height, 11, 0, Math.PI * 2);
            context.stroke();
          }
        }
        context.globalAlpha = 1;
      }
      if (kind === "POINTER" && fresh && value.filtered) {
        const p = value.filtered,
          x = p.x * width,
          y = p.y * height;
        if (value.uncertainty !== null) {
          context.strokeStyle = "rgba(139,225,205,.35)";
          context.fillStyle = "rgba(139,225,205,.05)";
          context.beginPath();
          context.arc(x, y, value.uncertainty, 0, Math.PI * 2);
          context.fill();
          context.stroke();
        }
        if (overlay && value.raw) {
          const raw = value.raw;
          context.strokeStyle = "#f3ad9c";
          context.lineWidth = 1;
          context.beginPath();
          context.moveTo(raw.x * width - 6, raw.y * height);
          context.lineTo(raw.x * width + 6, raw.y * height);
          context.moveTo(raw.x * width, raw.y * height - 6);
          context.lineTo(raw.x * width, raw.y * height + 6);
          context.stroke();
        }
        context.strokeStyle = value.previewEstimate ? "#e7bb77" : "#8be1cd";
        context.lineWidth = 2;
        context.beginPath();
        context.arc(x, y, 14, 0, Math.PI * 2);
        context.stroke();
        context.fillStyle = value.previewEstimate ? "#e7bb77" : "#caf8ed";
        context.beginPath();
        context.arc(x, y, 3, 0, Math.PI * 2);
        context.fill();
      }
      if (kind === "POINTER" && !(fresh && value.filtered) && value.lastSeen) {
        const age = at - value.lastSeen.capturedAt;
        if (age >= 0 && age <= 450) {
          const x = value.lastSeen.point.x * width,
            y = value.lastSeen.point.y * height;
          context.globalAlpha = 0.55 * (1 - age / 450);
          context.strokeStyle = "#d5d8d2";
          context.lineWidth = 2;
          context.setLineDash([4, 4]);
          context.beginPath();
          context.arc(x, y, 14, 0, Math.PI * 2);
          context.stroke();
          context.setLineDash([]);
          context.fillStyle = "#d5d8d2";
          context.font = "11px sans-serif";
          context.textAlign = "center";
          context.fillText("Last seen", x, y + 30);
          context.globalAlpha = 1;
        }
      }
      if (kind === "CAMERA" && !demo && fresh) timings.current.render(at, o.monotonicCaptureTime);
      animation = requestAnimationFrame(draw);
    };
    animation = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animation);
  }, [active, demo, frame, kind, overlay, timings]);
  return (
    <canvas
      ref={canvas}
      className={styles.overlay}
      role="img"
      aria-label={kind === "CAMERA" ? "Live hand joints aligned with the camera image" : "Pointing feedback surface"}
    />
  );
}
