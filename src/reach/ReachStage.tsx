"use client";
import { useEffect, useRef, type RefObject } from "react";
import { observationFreshnessTime } from "@/watchglass/hand-observation";
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
    const el = canvas.current!;
    const context = el.getContext("2d");
    if (!context) return;
    if (!active) {
      // Stop keeps this canvas mounted. Clear its full backing bitmap before
      // leaving it idle, including pixels drawn under a previous DPR transform.
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, el.width, el.height);
      return;
    }
    let animation = 0;
    let previous: unknown[] | null = null;
    const draw = (at: number) => {
      const width = el.clientWidth,
        height = el.clientHeight,
        dpr = Math.min(2, window.devicePixelRatio || 1);
      const value = frame.current,
        o = value.observation;
      const age = o ? at - observationFreshnessTime(o) : Infinity;
      const fresh = o && age >= 0 && age <= 150;
      const cameraPhase = !o ? 0 : fresh ? 1 : age >= 0 && age <= 450 ? 2 : 0;
      const ghostAge = value.lastSeen ? at - value.lastSeen.capturedAt : -1;
      const fading = kind === "POINTER" && !(fresh && value.filtered) && ghostAge >= 0 && ghostAge <= 450;
      // The ref is mutated in place. Snapshot primitives rather than retaining
      // its object; only the observation itself is an immutable input envelope.
      const current =
        kind === "CAMERA"
          ? [width, height, dpr, o, value.activeTrack, cameraPhase]
          : [
              width,
              height,
              dpr,
              !!fresh,
              value.filtered?.x,
              value.filtered?.y,
              overlay ? value.raw?.x : null,
              overlay ? value.raw?.y : null,
              value.uncertainty,
              value.previewEstimate,
              value.lastSeen?.point.x,
              value.lastSeen?.point.y,
              value.lastSeen?.capturedAt,
              fading,
            ];
      const resized = el.width !== Math.round(width * dpr) || el.height !== Math.round(height * dpr);
      if (!resized && !fading && previous?.every((item, i) => Object.is(item, current[i]))) {
        animation = requestAnimationFrame(draw);
        return;
      }
      previous = current;
      if (resized) {
        el.width = Math.round(width * dpr);
        el.height = Math.round(height * dpr);
      }
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, width, height);
      if (kind === "CAMERA" && o && cameraPhase > 0) {
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
      // Measures actual canvas submissions, not repeated RAFs of one capture.
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
