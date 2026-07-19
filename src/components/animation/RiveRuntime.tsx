"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Alignment, Fit, Layout, StateMachineInputType, useRive } from "@rive-app/react-webgl2";
import type { MotionMode } from "@/animation/core/animation-types";
import type { RiveAssetContract } from "@/animation/assets/rive-contracts";
import { changeMountedMetric, recordAssetFailure } from "@/animation/core/metrics";
import { observeDocumentVisibility, observeElementVisibility } from "@/animation/core/visibility";
import type {
  RiveMotionPolicy,
  RiveReducedMotionContract,
  RiveRuntimeInput,
  RiveRuntimeStatus,
  RiveSignal,
} from "./RiveStatefulObject";
import { AssetFallback } from "./AssetFallback";

type RuntimeInput = { name: string; type: number; value?: boolean | number; fire?: () => void };
type RiveRuntimeProps = {
  asset: RiveAssetContract;
  mode: MotionMode;
  label: string;
  className: string;
  signal?: RiveSignal;
  motionPolicy?: RiveMotionPolicy;
  reducedMotion?: RiveReducedMotionContract;
  onInputs?: (inputs: RiveRuntimeInput[]) => void;
  onStatus?: (status: RiveRuntimeStatus) => void;
};

function serializeInputs(inputs: RuntimeInput[]): RiveRuntimeInput[] {
  return inputs.map((input) => ({
    name: input.name,
    type:
      input.type === StateMachineInputType.Trigger
        ? "trigger"
        : input.type === StateMachineInputType.Boolean
          ? "boolean"
          : "number",
    value: input.value,
  }));
}

function setStableInput(input: RuntimeInput, value: boolean | number) {
  if (input.type === StateMachineInputType.Boolean && typeof value === "boolean") {
    input.value = value;
    return true;
  }
  if (input.type === StateMachineInputType.Number && typeof value === "number" && Number.isFinite(value)) {
    input.value = value;
    return true;
  }
  return false;
}

export function RiveRuntime(props: RiveRuntimeProps) {
  const { asset, label, className } = props;
  const [failedAssetKey, setFailedAssetKey] = useState<string | null>(null);
  if (failedAssetKey === asset.key)
    return (
      <AssetFallback
        src={asset.fallback}
        label={`${label} fallback after WebGL or asset failure`}
        className={className}
      />
    );
  return <LiveRiveRuntime key={asset.key} {...props} onFailure={() => setFailedAssetKey(asset.key)} />;
}

function LiveRiveRuntime({
  asset,
  mode,
  label,
  className,
  signal,
  motionPolicy,
  reducedMotion,
  onInputs,
  onStatus,
  onFailure,
}: RiveRuntimeProps & { onFailure: () => void }) {
  const wrapper = useRef<HTMLDivElement>(null);
  const onInputsRef = useRef(onInputs);
  const onStatusRef = useRef(onStatus);
  const onFailureRef = useRef(onFailure);
  const failureReported = useRef(false);
  const riveOptions = useMemo(
    () => ({
      src: asset.path!,
      artboard: asset.artboard,
      stateMachines: asset.stateMachine,
      autoplay: false,
      layout: new Layout({ fit: Fit.Contain, alignment: Alignment.Center }),
      useOffscreenRenderer: true,
      shouldDisableRiveListeners: true,
      enableRiveAssetCDN: false,
      automaticallyHandleEvents: false,
      onLoad: () => onStatusRef.current?.("ready"),
      onLoadError: () => {
        if (failureReported.current) return;
        failureReported.current = true;
        recordAssetFailure(asset.key);
        onStatusRef.current?.("failed");
        onFailureRef.current();
      },
    }),
    [asset.artboard, asset.key, asset.path, asset.stateMachine],
  );
  const { rive, RiveComponent } = useRive(riveOptions);
  const allowStateTravel =
    mode !== "reduced" && motionPolicy?.level !== "reduced" && (motionPolicy?.allowRiveStateTravel ?? true);

  useEffect(() => {
    onInputsRef.current = onInputs;
  }, [onInputs]);

  useEffect(() => {
    onStatusRef.current = onStatus;
  }, [onStatus]);

  useEffect(() => {
    onFailureRef.current = onFailure;
  }, [onFailure]);

  useEffect(() => {
    onStatusRef.current?.("loading");
  }, [asset.key]);

  useEffect(() => {
    if (!rive) return;
    changeMountedMetric("rive", 1);
    return () => changeMountedMetric("rive", -1);
  }, [rive]);

  useEffect(() => {
    if (!rive) return;
    const inputs = rive.stateMachineInputs(asset.stateMachine) as RuntimeInput[];
    if (!allowStateTravel) {
      rive.pause();
      const pose = reducedMotion?.stablePose ?? {};
      let changed = false;
      Object.entries(pose).forEach(([name, value]) => {
        const input = inputs.find((candidate) => candidate.name === name);
        if (input && setStableInput(input, value)) changed = true;
      });
      if (changed) rive.drawFrame();
    }
    onInputsRef.current?.(serializeInputs(inputs));
  }, [allowStateTravel, asset.stateMachine, reducedMotion?.stablePose, rive]);

  useEffect(() => {
    if (!rive || !wrapper.current) return;
    const stopElement = observeElementVisibility(wrapper.current, (visible) => {
      if (!visible) rive.pause();
      else if (allowStateTravel && !document.hidden) rive.play();
      else rive.pause();
    });
    const stopDocument = observeDocumentVisibility((visible) => {
      if (!visible) rive.pause();
      else if (allowStateTravel) rive.play();
      else rive.pause();
    });
    return () => {
      stopElement();
      stopDocument();
    };
  }, [allowStateTravel, rive]);

  useEffect(() => {
    if (!rive || !signal) return;
    const inputs = rive.stateMachineInputs(asset.stateMachine) as RuntimeInput[];
    const input = inputs.find((item) => item.name === signal.name);
    if (!input) return;
    if (!allowStateTravel) {
      const semanticSignalAllowed = reducedMotion?.allowedSemanticSignals?.includes(signal.name) ?? false;
      if (!semanticSignalAllowed || signal.value === undefined || !setStableInput(input, signal.value)) return;
      rive.pause();
      rive.drawFrame();
    } else if (input.type === StateMachineInputType.Trigger && signal.value === undefined) input.fire?.();
    else if (signal.value !== undefined) setStableInput(input, signal.value);
    onInputsRef.current?.(serializeInputs(inputs));
  }, [allowStateTravel, asset.stateMachine, reducedMotion?.allowedSemanticSignals, rive, signal]);

  return (
    <div ref={wrapper} className={`rive-object ${className}`} data-animation-owner="rive" role="img" aria-label={label}>
      <RiveComponent aria-hidden="true" />
    </div>
  );
}
