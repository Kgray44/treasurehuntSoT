"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Alignment, Fit, Layout, StateMachineInputType, useRive } from "@rive-app/react-webgl2";
import type { MotionMode } from "@/animation/core/animation-types";
import type { RiveAssetContract, RiveInputContract } from "@/animation/assets/rive-contracts";
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
type ViewModelValue = { value: boolean | number };
type ViewModelTrigger = { trigger: () => void };
type ViewModelInstance = {
  boolean: (name: string) => ViewModelValue | null;
  number: (name: string) => ViewModelValue | null;
  trigger: (name: string) => ViewModelTrigger | null;
};
type RiveRuntimeProps = {
  asset: RiveAssetContract;
  mode: MotionMode;
  label: string;
  className: string;
  signal?: RiveSignal;
  signals?: readonly RiveSignal[];
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

function viewModelInput(viewModel: ViewModelInstance, contract: RiveInputContract): RuntimeInput | null {
  if (contract.type === "trigger") {
    const property = viewModel.trigger(contract.name);
    return property
      ? { name: contract.name, type: StateMachineInputType.Trigger, fire: () => property.trigger() }
      : null;
  }
  const property = contract.type === "boolean" ? viewModel.boolean(contract.name) : viewModel.number(contract.name);
  if (!property) return null;
  return {
    name: contract.name,
    type: contract.type === "boolean" ? StateMachineInputType.Boolean : StateMachineInputType.Number,
    get value() {
      return property.value;
    },
    set value(value: boolean | number | undefined) {
      if (value !== undefined) property.value = value;
    },
  };
}

function runtimeInputs(
  asset: RiveAssetContract,
  rive: {
    stateMachineInputs: (name: string) => RuntimeInput[];
    viewModelInstance?: ViewModelInstance | null;
  },
): RuntimeInput[] {
  if (asset.runtimeInterface.kind === "state-machine-inputs") return rive.stateMachineInputs(asset.stateMachine);
  const viewModel = rive.viewModelInstance;
  if (!viewModel) return [];
  return asset.inputs.flatMap((contract) => {
    const input = viewModelInput(viewModel, contract);
    return input ? [input] : [];
  });
}

export function RiveRuntime(props: RiveRuntimeProps) {
  const { asset, label, className } = props;
  const [failedAssetKey, setFailedAssetKey] = useState<string | null>(null);
  if (failedAssetKey === asset.key)
    return <FailedRiveFallback asset={asset} label={label} className={className} onStatus={props.onStatus} />;
  return <LiveRiveRuntime key={asset.key} {...props} onFailure={() => setFailedAssetKey(asset.key)} />;
}

function FailedRiveFallback({
  asset,
  label,
  className,
  onStatus,
}: Pick<RiveRuntimeProps, "asset" | "label" | "className" | "onStatus">) {
  useEffect(() => {
    onStatus?.("fallback");
  }, [asset.key, onStatus]);

  return (
    <AssetFallback
      src={asset.fallback}
      label={`${label} fallback after WebGL or asset failure`}
      className={className}
    />
  );
}

function LiveRiveRuntime({
  asset,
  mode,
  label,
  className,
  signal,
  signals,
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
  const loaded = useRef(false);
  const [runtimeRevision, setRuntimeRevision] = useState(0);
  const clearLoadTimeout = useRef<() => void>(() => undefined);
  const riveOptions = useMemo(
    () => ({
      src: asset.path!,
      artboard: asset.artboard,
      stateMachines: asset.stateMachine,
      autoBind: asset.runtimeInterface.kind === "view-model",
      autoplay: false,
      layout: new Layout({ fit: Fit.Contain, alignment: Alignment.Center }),
      useOffscreenRenderer: true,
      shouldDisableRiveListeners: true,
      enableRiveAssetCDN: false,
      automaticallyHandleEvents: false,
      onLoad: () => {
        loaded.current = true;
        clearLoadTimeout.current();
        setRuntimeRevision((revision) => revision + 1);
        onStatusRef.current?.("ready");
      },
      onLoadError: () => {
        if (failureReported.current) return;
        failureReported.current = true;
        clearLoadTimeout.current();
        recordAssetFailure(asset.key);
        onStatusRef.current?.("failed");
        onFailureRef.current();
      },
    }),
    [asset.artboard, asset.key, asset.path, asset.runtimeInterface.kind, asset.stateMachine],
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
    let released = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const clear = () => {
      if (timeout !== undefined) clearTimeout(timeout);
      timeout = undefined;
    };
    clearLoadTimeout.current = clear;
    if (!loaded.current) {
      onStatusRef.current?.("loading");
      timeout = setTimeout(() => {
        if (released || loaded.current || failureReported.current) return;
        failureReported.current = true;
        recordAssetFailure(asset.key);
        onStatusRef.current?.("timed-out");
        onFailureRef.current();
      }, asset.loadTimeoutMs);
    }
    return () => {
      released = true;
      clear();
      clearLoadTimeout.current = () => undefined;
    };
  }, [asset.key, asset.loadTimeoutMs]);

  useEffect(() => {
    if (!rive) return;
    changeMountedMetric("rive", 1);
    return () => changeMountedMetric("rive", -1);
  }, [rive]);

  useEffect(() => {
    if (!rive) return;
    const inputs = runtimeInputs(asset, rive as Parameters<typeof runtimeInputs>[1]);
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
  }, [allowStateTravel, asset, reducedMotion?.stablePose, rive, runtimeRevision]);

  useEffect(() => {
    if (!rive || !wrapper.current) return;
    const stopElement = observeElementVisibility(wrapper.current, (visible) => {
      if (!visible) {
        rive.pause();
        onStatusRef.current?.("hidden");
      } else if (allowStateTravel && !document.hidden) rive.play();
      else {
        rive.pause();
        onStatusRef.current?.("paused");
      }
    });
    const stopDocument = observeDocumentVisibility((visible) => {
      if (!visible) {
        rive.pause();
        onStatusRef.current?.("hidden");
      } else if (allowStateTravel) rive.play();
      else {
        rive.pause();
        onStatusRef.current?.("paused");
      }
    });
    return () => {
      stopElement();
      stopDocument();
    };
  }, [allowStateTravel, rive]);

  useEffect(() => {
    const latestSignals = signals ?? (signal ? [signal] : []);
    if (!rive || latestSignals.length === 0) return;
    const inputs = runtimeInputs(asset, rive as Parameters<typeof runtimeInputs>[1]);
    let reducedPoseChanged = false;
    for (const nextSignal of latestSignals) {
      const input = inputs.find((item) => item.name === nextSignal.name);
      if (!input) continue;
      if (!allowStateTravel) {
        const semanticSignalAllowed = reducedMotion?.allowedSemanticSignals?.includes(nextSignal.name) ?? false;
        if (semanticSignalAllowed && nextSignal.value !== undefined && setStableInput(input, nextSignal.value)) {
          reducedPoseChanged = true;
        }
      } else if (input.type === StateMachineInputType.Trigger && nextSignal.value === undefined) input.fire?.();
      else if (nextSignal.value !== undefined) setStableInput(input, nextSignal.value);
    }
    if (!allowStateTravel && reducedPoseChanged) {
      rive.pause();
      rive.drawFrame();
    }
    onInputsRef.current?.(serializeInputs(inputs));
  }, [allowStateTravel, asset, reducedMotion?.allowedSemanticSignals, rive, runtimeRevision, signal, signals]);

  return (
    <div ref={wrapper} className={`rive-object ${className}`} data-animation-owner="rive" role="img" aria-label={label}>
      <RiveComponent aria-hidden="true" />
    </div>
  );
}
