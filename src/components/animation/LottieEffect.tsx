"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
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

export type LottiePlaybackPolicy = "ambient" | "commanded";

type LottieEffectProps = {
  asset: LottieAssetContract;
  mode: MotionMode;
  className?: string;
  label: string;
  /** Ambient effects follow visibility and motion policy. Commanded effects never begin before an imperative command. */
  playback?: LottiePlaybackPolicy;
  reducedFrame?: number;
  loadTimeoutMs?: number;
  onStatus?: (status: "loading" | "ready" | "failed" | "fallback") => void;
};

const defaultLoadTimeoutMs = 5_000;

export const LottieEffect = forwardRef<LottieEffectHandle, LottieEffectProps>(function LottieEffect(
  {
    asset,
    mode,
    className = "",
    label,
    playback = asset.loop ? "ambient" : "commanded",
    reducedFrame = 0,
    loadTimeoutMs = defaultLoadTimeoutMs,
    onStatus,
  },
  ref,
) {
  const container = useRef<HTMLDivElement>(null);
  const instance = useRef<AnimationItem | null>(null);
  const destroyRuntime = useRef<() => void>(() => undefined);
  const onStatusRef = useRef(onStatus);
  const labelRef = useRef(label);
  const modeRef = useRef(mode);
  const playbackRef = useRef(playback);
  const reducedFrameRef = useRef(reducedFrame);
  const loadTimeoutRef = useRef(loadTimeoutMs);
  const runtimeReady = useRef(false);
  const elementVisible = useRef(true);
  const documentVisible = useRef(true);
  const manuallyPaused = useRef(false);
  const commandedPlayback = useRef(false);
  const pendingSegment = useRef<[number, number] | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");

  onStatusRef.current = onStatus;
  labelRef.current = label;
  modeRef.current = mode;
  playbackRef.current = playback;
  reducedFrameRef.current = reducedFrame;
  loadTimeoutRef.current = loadTimeoutMs;

  const applyPlaybackPolicy = useCallback((animation: AnimationItem | null = instance.current) => {
    if (!animation || !runtimeReady.current) return;
    const currentMode = modeRef.current;
    animation.setSpeed(currentMode === "gentle" ? 0.65 : 1);
    if (currentMode === "reduced") {
      commandedPlayback.current = false;
      pendingSegment.current = null;
      animation.pause();
      animation.goToAndStop(reducedFrameRef.current, true);
      return;
    }
    const policyWantsPlayback = playbackRef.current === "ambient" || commandedPlayback.current;
    if (policyWantsPlayback && !manuallyPaused.current && elementVisible.current && documentVisible.current) {
      const segment = pendingSegment.current;
      if (segment) {
        pendingSegment.current = null;
        animation.playSegments(segment, true);
      } else {
        animation.play();
      }
    } else {
      animation.pause();
    }
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      play: () => {
        manuallyPaused.current = false;
        commandedPlayback.current = true;
        pendingSegment.current = null;
        applyPlaybackPolicy();
      },
      pause: () => {
        manuallyPaused.current = true;
        instance.current?.pause();
      },
      stop: () => {
        manuallyPaused.current = true;
        commandedPlayback.current = false;
        pendingSegment.current = null;
        instance.current?.stop();
      },
      goToFrame: (frame) => {
        manuallyPaused.current = true;
        commandedPlayback.current = false;
        pendingSegment.current = null;
        instance.current?.goToAndStop(frame, true);
      },
      playSegment: (segment) => {
        manuallyPaused.current = false;
        commandedPlayback.current = true;
        pendingSegment.current = segment;
        applyPlaybackPolicy();
      },
      setSpeed: (speed) => instance.current?.setSpeed(speed),
      setDirection: (direction) => instance.current?.setDirection(direction),
      destroy: () => destroyRuntime.current(),
    }),
    [applyPlaybackPolicy],
  );

  useEffect(() => {
    applyPlaybackPolicy();
  }, [applyPlaybackPolicy, mode, playback, reducedFrame]);

  const assetKey = asset.key;
  const assetPath = asset.path;
  const assetRenderer = asset.renderer;
  const assetLoop = asset.loop;

  useEffect(() => {
    const target = container.current;
    if (!target) return;
    let disposed = false;
    let failed = false;
    let runtimeTeardown: (() => void) | undefined;
    let loadTimer: ReturnType<typeof setTimeout> | undefined;
    runtimeReady.current = false;
    elementVisible.current = true;
    documentVisible.current = !document.hidden;
    setStatus("loading");
    onStatusRef.current?.("loading");

    const clearLoadTimer = () => {
      if (loadTimer !== undefined) clearTimeout(loadTimer);
      loadTimer = undefined;
    };
    const markFailed = () => {
      if (disposed || failed) return;
      failed = true;
      clearLoadTimer();
      runtimeReady.current = false;
      setStatus("failed");
      onStatusRef.current?.("failed");
      recordAssetFailure(assetKey);
      runtimeTeardown?.();
    };

    loadTimer = setTimeout(markFailed, Math.max(0, loadTimeoutRef.current));
    void import("lottie-web")
      .then(({ default: lottie }) => {
        if (disposed || failed) return;
        const animation = lottie.loadAnimation({
          container: target,
          renderer: assetRenderer,
          loop: assetLoop,
          autoplay: false,
          path: assetPath,
          rendererSettings: {
            preserveAspectRatio: "xMidYMid slice",
            title: labelRef.current,
            description: labelRef.current,
          },
        });
        instance.current = animation;
        changeMountedMetric("lottie", 1);
        let runtimeDestroyed = false;
        let stopElement: () => void = () => undefined;
        let stopDocument: () => void = () => undefined;
        const ready = () => {
          if (disposed || failed) return;
          clearLoadTimer();
          runtimeReady.current = true;
          setStatus("ready");
          onStatusRef.current?.("ready");
          applyPlaybackPolicy(animation);
        };
        const complete = () => {
          commandedPlayback.current = false;
          pendingSegment.current = null;
        };
        const failedData = () => markFailed();
        runtimeTeardown = () => {
          if (runtimeDestroyed) return;
          runtimeDestroyed = true;
          clearLoadTimer();
          runtimeReady.current = false;
          try {
            animation.removeEventListener("data_ready", ready);
            animation.removeEventListener("data_failed", failedData);
            animation.removeEventListener("complete", complete);
          } catch {
            // Some renderers clear their listener table as part of an internal failure teardown.
          }
          stopElement();
          stopDocument();
          try {
            animation.destroy();
          } finally {
            if (instance.current === animation) instance.current = null;
            changeMountedMetric("lottie", -1);
          }
        };
        destroyRuntime.current = runtimeTeardown;
        animation.addEventListener("data_ready", ready);
        animation.addEventListener("data_failed", failedData);
        animation.addEventListener("complete", complete);
        stopElement = observeElementVisibility(target, (nextVisible) => {
          elementVisible.current = nextVisible;
          applyPlaybackPolicy(animation);
        });
        stopDocument = observeDocumentVisibility((nextVisible) => {
          documentVisible.current = nextVisible;
          applyPlaybackPolicy(animation);
        });
      })
      .catch(markFailed);
    return () => {
      disposed = true;
      clearLoadTimer();
      runtimeTeardown?.();
      manuallyPaused.current = false;
      commandedPlayback.current = false;
      pendingSegment.current = null;
      destroyRuntime.current = () => undefined;
      target.replaceChildren();
    };
  }, [applyPlaybackPolicy, assetKey, assetLoop, assetPath, assetRenderer]);

  return (
    <div className={`lottie-effect ${className}`} data-animation-owner="lottie" data-lottie-status={status}>
      <div ref={container} aria-hidden="true" />
      {status === "failed" && <AssetFallback src={asset.fallback} label={`${label} static fallback`} />}
      <span className="sr-only">{label}</span>
    </div>
  );
});
