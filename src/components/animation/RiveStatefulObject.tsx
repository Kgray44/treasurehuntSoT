"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef } from "react";
import type { MotionMode, ResolvedMotionPolicy } from "@/animation/core/animation-types";
import type { RiveAssetContract } from "@/animation/assets/rive-contracts";
import { AssetFallback } from "./AssetFallback";

export type RiveRuntimeInput = { name: string; type: "boolean" | "number" | "trigger"; value?: boolean | number };
export type RiveSignal = { name: string; value?: boolean | number; nonce: number };
export type RiveRuntimeStatus = "loading" | "ready" | "failed" | "fallback";
export type RiveMotionPolicy = Pick<ResolvedMotionPolicy, "level" | "allowRiveStateTravel">;
export type RiveReducedMotionContract = {
  stablePose?: Readonly<Record<string, boolean | number>>;
  allowedSemanticSignals?: readonly string[];
};

const RiveRuntime = dynamic(() => import("./RiveRuntime").then((module) => module.RiveRuntime), {
  ssr: false,
  loading: () => <div className="rive-loading" aria-hidden="true" />,
});

export function RiveStatefulObject({
  asset,
  mode,
  label,
  className = "",
  signal,
  motionPolicy,
  reducedMotion,
  onInputs,
  onStatus,
}: {
  asset: RiveAssetContract;
  mode: MotionMode;
  label: string;
  className?: string;
  signal?: RiveSignal;
  motionPolicy?: RiveMotionPolicy;
  reducedMotion?: RiveReducedMotionContract;
  onInputs?: (inputs: RiveRuntimeInput[]) => void;
  onStatus?: (status: RiveRuntimeStatus) => void;
}) {
  const canLoad = Boolean(asset.path) && (!asset.developmentOnly || process.env.NODE_ENV !== "production");
  const onInputsRef = useRef(onInputs);
  const onStatusRef = useRef(onStatus);
  useEffect(() => {
    onInputsRef.current = onInputs;
  }, [onInputs]);
  useEffect(() => {
    onStatusRef.current = onStatus;
  }, [onStatus]);
  useEffect(() => {
    if (!canLoad) {
      onInputsRef.current?.([]);
      onStatusRef.current?.("fallback");
    }
  }, [asset.key, canLoad]);
  if (!canLoad) {
    return (
      <AssetFallback
        src={asset.fallback}
        label={`${label}. Original Rive artwork is not yet supplied; showing the production fallback.`}
        className={className}
      />
    );
  }
  return (
    <RiveRuntime
      asset={asset}
      mode={mode}
      label={label}
      className={className}
      signal={signal}
      motionPolicy={motionPolicy}
      reducedMotion={reducedMotion}
      onInputs={onInputs}
      onStatus={onStatus}
    />
  );
}
