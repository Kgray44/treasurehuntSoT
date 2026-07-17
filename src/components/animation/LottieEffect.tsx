"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { AnimationItem } from "lottie-web";
import type { MotionMode } from "@/animation/core/animation-types";
import { changeMountedMetric, recordAssetFailure } from "@/animation/core/metrics";
import { observeDocumentVisibility, observeElementVisibility } from "@/animation/core/visibility";
import type { LottieAssetContract } from "@/animation/assets/lottie-contracts";
import { AssetFallback } from "./AssetFallback";

export type LottieEffectHandle = {
  play: () => void;
  pause: () => void;
  stop: () => void;
  goToFrame: (frame: number) => void;
  playSegment: (segment: [number, number]) => void;
  setSpeed: (speed: number) => void;
  setDirection: (direction: 1 | -1) => void;
  destroy: () => void;
};

export const LottieEffect = forwardRef<
  LottieEffectHandle,
  {
    asset: LottieAssetContract;
    mode: MotionMode;
    className?: string;
    label: string;
    autoplay?: boolean;
    onStatus?: (status: "loading" | "ready" | "failed" | "fallback") => void;
  }
>(function LottieEffect({ asset, mode, className = "", label, autoplay = true, onStatus }, ref) {
  const container = useRef<HTMLDivElement>(null);
  const instance = useRef<AnimationItem | null>(null);
  const destroyRuntime = useRef<() => void>(() => undefined);
  const onStatusRef = useRef(onStatus);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");

  useEffect(() => {
    onStatusRef.current = onStatus;
  }, [onStatus]);

  useImperativeHandle(ref, () => ({
    play: () => instance.current?.play(),
    pause: () => instance.current?.pause(),
    stop: () => instance.current?.stop(),
    goToFrame: (frame) => instance.current?.goToAndStop(frame, true),
    playSegment: (segment) => instance.current?.playSegments(segment, true),
    setSpeed: (speed) => instance.current?.setSpeed(speed),
    setDirection: (direction) => instance.current?.setDirection(direction),
    destroy: () => destroyRuntime.current(),
  }));

  useEffect(() => {
    const target = container.current;
    if (!target) return;
    let disposed = false;
    let visible = true;
    let cleanupRuntime: (() => void) | undefined;
    setStatus("loading");
    onStatusRef.current?.("loading");
    void import("lottie-web")
      .then(({ default: lottie }) => {
        if (disposed) return;
        const animation = lottie.loadAnimation({
          container: target,
          renderer: asset.renderer,
          loop: asset.loop,
          autoplay: autoplay && mode !== "reduced",
          path: asset.path,
          rendererSettings: { preserveAspectRatio: "xMidYMid slice", title: label, description: label },
        });
        instance.current = animation;
        changeMountedMetric("lottie", 1);
        let runtimeDestroyed = false;
        const ready = () => {
          if (disposed) return;
          setStatus("ready");
          onStatusRef.current?.("ready");
          animation.setSpeed(mode === "gentle" ? 0.65 : 1);
          if (mode === "reduced") animation.goToAndStop(0, true);
        };
        const failed = () => {
          if (disposed) return;
          setStatus("failed");
          onStatusRef.current?.("failed");
          recordAssetFailure(asset.key);
        };
        animation.addEventListener("data_ready", ready);
        animation.addEventListener("data_failed", failed);
        const stopElement = observeElementVisibility(target, (nextVisible) => {
          visible = nextVisible;
          if (!nextVisible) animation.pause();
          else if (autoplay && mode !== "reduced" && !document.hidden) animation.play();
        });
        const stopDocument = observeDocumentVisibility((documentVisible) => {
          if (!documentVisible) animation.pause();
          else if (visible && autoplay && mode !== "reduced") animation.play();
        });
        cleanupRuntime = () => {
          try {
            animation.removeEventListener("data_ready", ready);
            animation.removeEventListener("data_failed", failed);
          } catch {
            // Some renderers clear their listener table as part of an internal failure teardown.
          }
          stopElement();
          stopDocument();
        };
        const teardown = () => {
          if (runtimeDestroyed) return;
          runtimeDestroyed = true;
          cleanupRuntime?.();
          cleanupRuntime = undefined;
          animation.destroy();
          if (instance.current === animation) instance.current = null;
          changeMountedMetric("lottie", -1);
        };
        destroyRuntime.current = teardown;
      })
      .catch(() => {
        if (disposed) return;
        setStatus("failed");
        onStatusRef.current?.("failed");
        recordAssetFailure(asset.key);
      });
    return () => {
      disposed = true;
      destroyRuntime.current();
      destroyRuntime.current = () => undefined;
      target.replaceChildren();
    };
  }, [asset, autoplay, label, mode]);

  return (
    <div className={`lottie-effect ${className}`} data-animation-owner="lottie" data-lottie-status={status}>
      <div ref={container} aria-hidden="true" />
      {status === "failed" && <AssetFallback src={asset.fallback} label={`${label} static fallback`} />}
      <span className="sr-only">{label}</span>
    </div>
  );
});
