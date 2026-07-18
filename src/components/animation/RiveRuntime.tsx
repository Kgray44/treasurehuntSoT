"use client";

import { useEffect, useRef, useState } from "react";
import { Alignment, Fit, Layout, RuntimeLoader, StateMachineInputType, useRive } from "@rive-app/react-webgl2";
import type { MotionMode } from "@/animation/core/animation-types";
import type { RiveAssetContract } from "@/animation/assets/rive-contracts";
import { changeMountedMetric, recordAssetFailure } from "@/animation/core/metrics";
import { observeDocumentVisibility, observeElementVisibility } from "@/animation/core/visibility";
import type { RiveRuntimeInput, RiveSignal } from "./RiveStatefulObject";
import { AssetFallback } from "./AssetFallback";

type RuntimeInput = { name: string; type: number; value?: boolean | number; fire?: () => void };

RuntimeLoader.setWasmUrl("/runtimes/rive.wasm");
RuntimeLoader.setWasmFallbackUrl("/runtimes/rive-fallback.wasm");

export function RiveRuntime({
  asset,
  mode,
  label,
  className,
  signal,
  onInputs,
  onStatus,
}: {
  asset: RiveAssetContract;
  mode: MotionMode;
  label: string;
  className: string;
  signal?: RiveSignal;
  onInputs?: (inputs: RiveRuntimeInput[]) => void;
  onStatus?: (status: "loading" | "ready" | "failed" | "fallback") => void;
}) {
  const wrapper = useRef<HTMLDivElement>(null);
  const counted = useRef(false);
  const onInputsRef = useRef(onInputs);
  const onStatusRef = useRef(onStatus);
  const [failed, setFailed] = useState(false);
  const { rive, RiveComponent } = useRive({
    src: asset.path!,
    artboard: asset.artboard,
    stateMachines: asset.stateMachine,
    autoplay: mode !== "reduced",
    layout: new Layout({ fit: Fit.Contain, alignment: Alignment.Center }),
    useOffscreenRenderer: true,
    shouldDisableRiveListeners: true,
    enableRiveAssetCDN: false,
    automaticallyHandleEvents: false,
    onLoad: () => onStatusRef.current?.("ready"),
    onLoadError: () => {
      setFailed(true);
      recordAssetFailure(asset.key);
      onStatusRef.current?.("failed");
    },
  });

  useEffect(() => {
    onInputsRef.current = onInputs;
  }, [onInputs]);

  useEffect(() => {
    onStatusRef.current = onStatus;
  }, [onStatus]);

  useEffect(() => {
    onStatusRef.current?.("loading");
  }, [asset.key]);

  useEffect(() => {
    if (!rive || !wrapper.current) return;
    if (!counted.current) {
      counted.current = true;
      changeMountedMetric("rive", 1);
    }
    const inputs = rive.stateMachineInputs(asset.stateMachine) as RuntimeInput[];
    onInputsRef.current?.(
      inputs.map((input) => ({
        name: input.name,
        type:
          input.type === StateMachineInputType.Trigger
            ? "trigger"
            : input.type === StateMachineInputType.Boolean
              ? "boolean"
              : "number",
        value: input.value,
      })),
    );
    if (mode === "reduced") rive.pause();
    const stopElement = observeElementVisibility(wrapper.current, (visible) => {
      if (!visible) rive.pause();
      else if (mode !== "reduced" && !document.hidden) rive.play();
    });
    const stopDocument = observeDocumentVisibility((visible) => {
      if (!visible) rive.pause();
      else if (mode !== "reduced") rive.play();
    });
    return () => {
      stopElement();
      stopDocument();
    };
  }, [asset.stateMachine, mode, rive]);

  useEffect(() => {
    if (!rive || !signal) return;
    const input = (rive.stateMachineInputs(asset.stateMachine) as RuntimeInput[]).find(
      (item) => item.name === signal.name,
    );
    if (!input) return;
    if (input.fire && signal.value === undefined) input.fire();
    else if (signal.value !== undefined) input.value = signal.value;
  }, [asset.stateMachine, rive, signal]);

  useEffect(
    () => () => {
      rive?.cleanup();
      if (counted.current) changeMountedMetric("rive", -1);
      counted.current = false;
    },
    [rive],
  );

  if (failed)
    return (
      <AssetFallback
        src={asset.fallback}
        label={`${label} fallback after WebGL or asset failure`}
        className={className}
      />
    );
  return (
    <div ref={wrapper} className={`rive-object ${className}`} data-animation-owner="rive" role="img" aria-label={label}>
      <RiveComponent aria-hidden="true" />
    </div>
  );
}
